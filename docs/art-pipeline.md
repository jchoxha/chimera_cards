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

## Blocked on

`claude-image-gen` installed + `GEMINI_API_KEY` set + Claude Code restarted.

## TODO — roster portraits to regenerate (flagged 2026-06-23, Jeton)

Two roster creatures have bad/missing portraits (regen needs the `agy` env —
`scripts/gen_roster.py` — which only runs on the Windows machine, not the web
session):

- **tidecaller** — NO portrait at all (absent from `src/data/creatureArt.json`);
  currently falls back to the attunement icon. Generate `public/art/gen/tidecaller.png`
  and add `"tidecaller"` to `creatureArt.json`.
- **frostmind** ("the thought" one) — portrait reads off; regenerate
  `public/art/gen/frostmind.png`. *(Confirm this is the one meant — flagged as
  "the thought".)*
