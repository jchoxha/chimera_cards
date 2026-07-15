# Chimera art pipeline (Phase 3)

How generated art is produced, styled, stored, and loaded. Built around the
`claude-image-gen` MCP (Google Gemini, `create_asset` tool) once installed.

## Decisions (locked 2026-06-14)

- **Aesthetic:** Yu-Gi-Oh trading-card creature art × Adventure Time — the
  game's original `ART_STYLE` (`src/ai/claude.js`). Reference: the user's
  "Blazaur, the Ember Lion" card.
- **Scope:** generate art for *everything* — 108 monster portraits, ~348 move
  arts, 16 items, 20 materials, ~6–10 shared backgrounds.
- **Frames stay CSS** (the gold/gem frame), not generated per card.
- **Storage:** hybrid. Pre-bake + commit the fixed roster's art; generate
  player-created (Forge/Fusion) monster art at runtime with graceful fallback.
- **Icons vs art:** small UI/status glyphs stay vector (game-icons via
  Iconify). Generated art is only the big art windows.

## Style spec (raster, for Gemini)

**Locked 2026-06-15 ("Variant B").** The earlier Yu-Gi-Oh×Adventure-Time spec
read as "too Disney" — glossy 3D rendering, generic cute TCG art, missing both
Yu-Gi-Oh seriousness and Adventure Time charm. The chosen direction is
**Adventure-Time-forward flat 2D**. Every prompt appends this for consistency:

> Flat 2D hand-drawn cartoon illustration in the spirit of Adventure Time /
> Pendleton Ward: simple bold shapes, thick confident black outlines, flat matte
> color fills, minimal shading, genuinely charming and characterful. BUT with the
> dramatic seriousness of Yu-Gi-Oh trading-card monster art: an intense, slightly
> menacing creature in a dynamic heroic pose, moody dramatic lighting, an epic
> elemental backdrop. Absolutely NOT Disney, NOT Pixar, NOT 3D, NOT glossy, NOT
> soft, NOT overly cute. Centered subject filling the frame.
> **No text, no card frame, no border, no UI — only the illustration** (our frame
> is drawn separately). Square 1:1 composition.

> ⚠️ Known issue: even with "no border," the model sometimes adds a cream paper
> border. Strengthen the negative cue or crop in post-processing.

Generation runs through `agy` (Antigravity CLI) headlessly — see
`scripts/agy_call.py`. Prefix prompts with "generate the following image:".
Image gen has a long silent compute phase, so use a long idle window (≈45–60s).

## Prompt templates

Placeholders come from the game data (`src/data/*`).

- **Monster portrait** (`art/monsters/<dexNumber>-<slug>.webp`):
  `Trading-card creature illustration of "{name}", a {element}-element monster. {lore||desc}. {STYLE}`
- **Move/card art** (`art/gen/cards/<id>.png`): every card in
  `src/data/cards/*.json` now carries a per-card **`artPrompt`** scene (baked by
  `scripts/bake_card_art_prompts.mjs`, hand-refinable in the Card Forge). The
  generator-ready brief = `cardArtPrompt(card)` (`src/data/cardArtPrompt.js`) =
  `artPrompt` + the locked `CARD_ART_STYLE`. Batch-generate with
  `python scripts/gen_cards.py`; generated ids land in `src/data/cardGenArt.json`
  and `cardArt()` (`src/data/artPool.js`) prefers them over the pixel placeholder.
- **Item** (`art/items/<id>.webp`):
  `Game item illustration of "{name}": {text}. Single object centered on a simple soft background. {STYLE}`
- **Material** (`art/materials/<id>.webp`):
  `Crafting-material illustration of "{name}", a {element} material. Single object, gem/ore/essence. {STYLE}`
- **Background** (`art/bg/<element>.webp`):
  `Wide fantasy battle backdrop for a {element} arena. No creatures, no text. {STYLE-minus-square}, 16:9.`

## Post-processing

Gemini returns PNGs to disk. For each asset: resize + convert to **WebP**
(portraits/moves ~640², items/materials ~256², backgrounds ~1280×720),
quality ~80. Target ~30–80 KB each. Write to `public/art/...`. Produce
`public/art/manifest.json` mapping `id → file` so the UI resolves art by id.

## Storage & delivery

- Fixed-roster WebP committed under `public/art/`. Estimated ~500 images.
  Monsters+items+materials+bg alone ≈ ~10 MB; all moves pushes toward ~40 MB.
- If `public/art/` exceeds ~25–30 MB, move it to **git-LFS** and set
  `lfs: true` on `actions/checkout` in `.github/workflows/deploy.yml` so Pages
  serves the real files (decide at generation time, not before).
- Lazy-load images in the UI (`loading="lazy"`) so play-time bandwidth is
  per-card-seen, not the whole set.

## Runtime layer (player-created monsters)

- Forge/Fusion monsters call Gemini live when a key is present; cache the
  result in the save. No key → fall back to the procedural game-icon
  silhouette (already styled in the battle mockup).
- Public Pages site (no key): built-in monsters always show baked art; player
  creations show the fallback. Honest, no broken images.
- Converge the in-game `generateArt` onto the same Gemini style so runtime and
  baked art match (currently it asks Anthropic for SVG — different look).

## Generation plan (phased — avoids mass-producing a rejected style)

1. **Validate (≈10 images):** the Battle screen's needs — 2 monsters
   (one stone, one fire), ~5 moves (1 per type/element mix), 1 item, 1
   background. Drop into the mockup, lock the look with the user.
2. **Batch by type:** monsters → items/materials → backgrounds → moves, via a
   manifest the script emits from game data. Iterate `create_asset` per entry,
   post-process to WebP, update the manifest.
3. **Wire the UI** to read `manifest.json` (replaces emoji/silhouette/SVG art).
4. **Runtime** Gemini + fallback for Forge/Fusion.

## Per-size portraits (framework live 2026-07-07)

Size no longer rescales one image (that stretched/blurred it). Each form can have
its OWN portrait at `public/art/gen/<id>-<form>.png` (`regular` = the base
`<id>.png`). The game resolves it via `src/data/sizeArt.js` `sizedPortrait(url,
form)`, gated by `src/data/creatureArtSizes.json` (a `{ id: ["large","boss",…] }`
manifest of which sized variants exist) — until a variant is baked it falls back
to the base file, so nothing breaks.

Two ways to bake the images:
- **Windows `agy` CLI** — `python gen_roster.py --sizes` (every form for every
  creature) or `python gen_roster.py --form=baby,boss ironhide` (just those
  forms/ids). Prints a JSON snippet to paste into `creatureArtSizes.json`.
- **AGY Image-Gen MCP, straight from a cloud Claude session** (see next section —
  this now WORKS in-session; no Windows box needed).

Each form uses distinct prompt phrasing (`SIZE_DESC` in `gen_roster.py`, mirroring
`sizeArt.js` `FORM_ART_DESC`), so a Baby is drawn small/cute and a Boss colossal.
The AI forge (`forgeCreature.js`) already stamps a size-aware
`artPromptBase`/`artPrompt`.

## ✅ Generating art from a CLOUD session (AGY Image-Gen MCP — verified 2026-07-07)

Image generation NO LONGER needs the Windows box. The AGY connector exposes MCP
tools that drive the same `agy` pipeline from a web/cloud Claude Code session.

> ⚠️ **Connector name drifts.** It has appeared as **AGY Image Gen/Editing** and
> (2026-07-15) **AGY & Codex Image Gen**, plus a sibling **Codex CLI Image Gen**.
> Don't hard-code the namespace: run `ListConnectors` to find the current one and
> `ToolSearch("agy codex image generate edit")` to load whatever the live tool
> names are (`generate_image`/`edit_image`/`get_result`/… under the current prefix).

**Prereq: the connector must be ENABLED for the chat** (`ListConnectors` → if
`enabledInChat:false`, turn it on in the chat's connector settings; the tools
silently vanish otherwise). It is also **backed by a live process on the user's
Windows box** (the `agy`/codex bridge) — if `installState` reads `unknown` and the
tools won't load, the bridge is down and only the user can restart it; no amount of
retrying from the session fixes it.

> ⚠️ **PACE THE JOBS — do NOT mass-fire.** (Learned 2026-07-15.) The codex image
> backend is rate-limited and its host is not robust. A burst of parallel jobs (e.g.
> fanning out subagents, one per image) trips a codex rate limit (`rc=1`) AND can
> knock the whole bridge offline for hours. **Generate ONE creature/form at a time,
> sequentially**: fire → poll → save → verify → next. This supersedes the older
> "fire several, then poll, they run concurrently" advice below.

The flow is async (a single call can exceed the ~60s cloud timeout, so it runs as a
background job):

1. `mcp__AGY_Image_Gen_Editing__generate_image({ prompt })` → returns a `job_id`
   immediately. (Optional `idle_seconds`, `hard_cap_seconds`.)
2. Poll `mcp__AGY_Image_Gen_Editing__get_result({ job_id })` every ~15–20s until
   `status: done` (it returns the image inline so you can eyeball it).
3. `mcp__AGY_Image_Gen_Editing__get_image_base64({ job_id })` → raw base64 **JPEG**
   bytes. Decode and write to `public/art/gen/<id>-<form>.png` (an `<img>` renders
   JPEG bytes in a `.png`-named file fine; if you want true PNGs downscaled to
   ~384², pipe through ImageMagick/`sharp` first, matching the existing portraits).
4. `mcp__AGY_Image_Gen_Editing__edit_image({ instructions, image_path|image_base64 })`
   to tweak an existing image (else edits the most recent generate).

Prompt recipe (reuse verbatim from `scripts/gen_roster.py`): `Subject: <CREATURES
subject for the id>. <SIZE_DESC[form]>\n\nStyle: <STYLE>`.

### NEXT-SESSION PLAN — bake per-size portraits

1. Confirm the connector is enabled in-chat; `ToolSearch("AGY_Image_Gen_Editing")`.
   The size ladder is **`baby · young · regular · elite · boss`** (`Large` was
   removed and `Small` renamed `Young`, 2026-07-15; `regular` = the base `<id>.png`,
   so the four non-`regular` forms to bake are baby/young/elite/boss).
2. Pick scope with the user:
   - **Sanity set** (prove the loop): e.g. `nightveil-elite`, `emberwisp-baby`.
   - **Full sweep**: 12 roster creatures × 4 non-`regular` forms = **48 images**.
3. Work **ONE `(id, form)` at a time, sequentially** (see the pacing warning above —
   do not fan out): build the prompt from `gen_roster.py` `CREATURES[id]` +
   `SIZE_DESC[form]` + `STYLE`; `generate_image` → keep the `job_id`.
4. Poll `get_result` until done; `get_image_base64`; write
   `public/art/gen/<id>-<form>.png` (downscale to ~384² PNG for parity). Then move to
   the next form — don't queue the next job until this one is saved + eyeballed.
5. Add the baked forms to `src/data/creatureArtSizes.json`, e.g.
   `{ "ironhide": ["boss"], "emberwisp": ["baby"] }`.
6. Verify in-browser (Playwright, `/app.html` → assemble → practice fight): a
   creature at that form now shows `<id>-<form>.png` (its `<img src>` ends
   `-<form>.png`); `regular` still uses the base file.
7. Bump `APP_VERSION`, add a changelog entry, update this doc + CLAUDE.md's
   project-state, commit per-milestone, push to `main` (deploy auto-builds).

The JS framework (resolver + manifest + size-aware prompts) is already shipped in
v3.101.0, so once the PNGs + the manifest entries land, the game uses them with
zero further code.

## TODO — per-size portrait sweep (updated 2026-07-15)

Regen runs via the AGY MCP in-session (above) or `scripts/gen_roster.py` on the
Windows box. Use the FIXED prompts (full-bleed clause + composition-based size).
**Bake ONE creature/form at a time (pacing warning above).**

**DONE this session** (in `creatureArtSizes.json` + base fixes):
- **ironhide** — arm-fixed base + full baby/young/elite/boss set.
- **emberwisp** — full baby/young/elite/boss set.
- **voltfang** — full baby/young/elite/boss set.
- **nightveil** — baby + young (elite/boss still pending).
- **tidecaller** — base portrait generated (earlier session).

**REMAINING** — the image host went down mid-sweep (2026-07-15); resume here once
the AGY bridge is reachable again. For each creature, bake baby/young/elite/boss:
1. **nightveil** — elite + boss (baby/young already done).
2. **frostmind** — base reads off, plus its 4 forms.
3. **grimsoul**
4. **dawnkeeper**
5. **thornroot**
6. **wildeye**
7. **cogwright**
8. **maw**

After each creature: add its baked forms to `creatureArtSizes.json`, spot-check in
`/app.html`, then commit that one creature before starting the next (per-milestone
commits — a mid-sweep cutoff then loses at most one creature).

Broader generation-model issues (size-neutral subject texts, per-size identity,
evolution↔art) are collected in **`docs/creature-model-rework.md`**.
