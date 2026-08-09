# Seamless creature fusion — design (opened 2026-08-05, Jeton)

Jeton: *"I want to shift gears to dynamic monster generation. I want to emulate the
system from Cassette Beasts that allows for seamless monster fusion."*

**Decisions locked this session:**
1. Fusion produces a **permanent new creature** you own and collect (not a temporary
   in-battle transformation as in CB proper).
2. Art will be a **factor-sprite part library**, and it **must support dynamically
   generating new parts** as new factors are authored.

**STATUS:** Step 1 (the headless fusion engine) is **BUILT + tested** —
`src/engine/content/fuse.js`, `npm run test:fuse` (73 checks). Steps 2–3 below are
designed but unbuilt.

---

## 1. Why this repo was already ready

Cassette Beasts' hard problem was art: every monster is designed **twice** — once as a
bespoke animated character, once as a modular parts rig with a fusion config of parts +
coordinates. On fusion the primary's config is the base and parts are swapped in from
the secondary. Body never swaps (always the primary); the engine takes the **Head** from
one monster and the **Helmet** (external details) from the other. 120 species → 14,400
fusions.

**Our taxonomy is already that parts rig**, for free:

| Cassette Beasts | Chimera Cards |
|---|---|
| `Body` (primary only, never swaps) | **Body type** — Humanoid / Beast / Aberration silhouette |
| `Head` / `HelmetFront` / `HelmetBack` | **Factors** — Claws, Wings, Tentacle, Carapace, Horns, Sword… |
| (per-species, hand-authored) | **Kit** — Archetype / Family / Manifestation |
| palette / typing | **Attunement** (element + colour) and **Subtypes** (surface/material) |
| both types · both movesets · boosted stats | axis union |

The decisive property: **stats and decks are already pure functions of the axes**
(`statProfile({kits, factors})`, `basePoolFor(axes)`). So merging the axes yields a
coherent statline and a merged movepool **with no bespoke math**. Naming is likewise
already solved by the locked synthesis matrices (`synthName`, `attunementDisplayName`,
`biologyDisplayName`).

Verified blend (Warrior/Hammer+Shield × Avian/Wings+Beak):

```
A  hp ×1.21  might 1.23  guard 1.29  speed −1  eva −4
B  hp ×0.83  might 1.05  guard 0.85  speed +2  eva +14
F  hp ×1.03  might 1.23  guard 1.12  speed +1  eva +7   ← sits between, clones neither
```

---

## 2. The fusion engine (BUILT) — `src/engine/content/fuse.js`

Pure and node-testable: no JSON kit imports (kit slots are inferred from each parent's
own `biology`), pool injected by the caller — same contract as `makeCreature`.

### Order matters
As in CB, `fuse(A,B) ≠ fuse(B,A)`. The **primary** donates the body/size, leads every
axis, and changes the generated Fusion Power.

### Axis merge — `fuseAxes(primary, secondary)`

| Axis | Rule | Cap |
|---|---|---|
| Body type | union, primary first → `Chimera`/`Anomalous`/`Warped` | 2 |
| Kit | one axis-2 per surviving body base; primary wins a contested slot. Beast→`family`, Aberration→`manifestation`, Humanoid→`class` | — |
| Factors | half the budget from each parent, then top up from the primary (both parents must be visible) | 4 |
| Subtypes | union in canonical adjective order (`orderSubtypes`) | 3 |
| Attunement | union, primary first, then **archetype legality repair** | 2 |
| Size | the **primary's** (the body donor sets the frame) | — |

A kit whose body type drops out of the merge is discarded, so no orphan kits.
`Aberration` uses a dedicated `manifestation` field — `statProfile.kitsOf` already reads
it, so a Beast×Aberration fusion carries **both** kits.

**Legality repair** matters: `attunementComboLegal(['Warrior'], ['Shadow','Fire'])` is
`false`, so a fusion landing on a Humanoid archetype repairs to a legal combo (same
approach `sanitizeForgedDef` uses).

### Naming — the portmanteau
`fusionName(a, b)` = primary's opening syllables + secondary's final syllable, seam
de-duplicated. The split is the **last consonant→vowel boundary**, ignoring a trailing
silent `e` (so "hide" doesn't split as "hi|de"):

```
Ironhide + Voltfang → Ironfang      Voltfang + Ironhide → Volthide
Emberwisp + Thornroot → Emberoot    Maw + Emberwisp     → Mawisp
Nightveil + Grizzlord → Nightlord   Thornroot + Frostmind → Thornmind
```

The taxonomy name comes free on top: *Kinetic Giant Chimera*, *Smoke Elemental Horror*.

### The Fusion Power card
CB's signature mechanic: every fusion grants a unique move, named **prefix (element) +
suffix (shape)**, where the suffix decides targeting/range/power. Deterministic per
*ordered* pair via an FNV-1a hash, so it is stable and cacheable but flips with order.

- 13 element prefix sets (`Blazing`, `Umbral`, `Voltaic`, `Devouring`…).
- 6 shape suffixes: `Strike` (single, cheap) · `Barrage` (multi-hit) · `Wave` (AoE) ·
  `Bane` (+debuff) · `Aegis` (+block) · `Surge` (+buff).
- Always a valid `CardSpec` (`validateCard` = clean), `rarity: 'rare'`, `imbue: 1`.

### Two deck bugs found by playing real fusions (fixed, regression-tested)
1. **The power must not lead the pool.** `starterDeck` picks its Strike/Defend bases by
   scanning for the first card with a `damage`/`block` op — an `Aegis`-shaped power has
   both, so it was cloned into all six basic slots (observed: 6× *Hollow Aegis*).
2. **The power is `rare`, and signature slots only accept `common`** — so in a large
   pool it silently vanished. It is now inserted into the deck explicitly, exactly once.
3. **Both movesets**: passing the two *parent* pools interleaves them, so the signature
   slots alternate between kits instead of going to whichever kit sorts first. Result:
   `Ironfang` → *Pursuit* + *Bite* (beast) **and** *Cleave* (warrior).

---

## 3. Art — the factor-sprite part library (RIG BUILT 2026-08-06, art unbaked)

### Why ours is cheaper than CB's
CB needed **120 bespoke part rigs** because parts are per-species. Our parts are
**taxonomy tags**, so one sprite per tag composes across *every* creature and *every*
fusion: ~13 beast anatomy + 12 weapons + 13 aberrant features ≈ **38 shared parts**, plus
a handful of body silhouettes.

### Layer model
```
z0 body      ← body type (+ family/manifestation variant)   — from the PRIMARY
z1 surface   ← subtype overlay (Mechanical plating, Undead rot), tinted
z2 attach    ← factor parts (Wings, Claws, Tentacle, Carapace…), anchored
z3 fx        ← attunement palette / rim light
```

### Manifest, mirroring `sprites.json`
`src/data/partsManifest.json` — `{ id, tag, kind: 'body'|'surface'|'attach', bodyType?,
file, anchor:{x,y}, scale, z }`. Runtime resolver `src/data/parts.js`
`resolveParts(creature) → ordered layers`; renderer composites them. **Every layer is
optional** — a missing part degrades to the existing chain (baked PNG → pixel placeholder
→ axis icon), so the library can grow incrementally without breaking anything.

### Dynamically generating new parts (the explicit requirement)
The pipeline already exists for HD-2D environment sprites and is reused wholesale:

1. Prompt the part on a **flat magenta chroma-key** background (`scripts/gen_roster.py`
   `STYLE` + a per-part subject line).
2. `scripts/decode_and_cut.py` → `scripts/sprite_cutout.py`: magenta→alpha with edge
   feather + despill, autocrop, downscale.
3. `scripts/gen_parts_manifest.py` refreshes `partsManifest.json`.

So **authoring a new factor tag → baking its part → it instantly appears on every
creature and fusion that carries the tag.** Parts may also arrive as data-URI SVGs from
the in-app forge, so a forged creature can ship bespoke parts.

---

## 4. Build order

1. ✅ **Headless fusion engine** — `fuse.js` + `test:fuse` (73 checks).
2. **Parts framework** — manifest + resolver + composite renderer + fallback chain, then
   the `gen_parts` baking script and a first tranche of parts.
3. **Game wiring** — a fusion screen (pick two owned instances → preview → confirm),
   persistence into `app/collection.js` as a new owned species, and retirement of the
   legacy catalyst fusion in `src/ui/components.jsx`.

## 5. Open questions

- **Cost/gating** — is fusion free, catalyst-gated, or does it consume the parents?
  (Legacy fusion consumed a `fusioncatalyst` item and both parents.)
- **Re-fusion depth** — can a fusion fuse again? Caps already prevent axis blowup, but
  names would compound (*Ironfangwisp*).
- **Collection identity** — a fused creature needs a stable species id; `fuse_<hash>` is
  deterministic per ordered pair, so the same pair always yields the same species.
- **Balance** — `FUSION_HP_BONUS = 1.1` and the power's numbers are first-pass.


---

## 6. The parts rig (BUILT) — how it actually works

Whole-creature AI generation was tried first (v3.173.0) and rejected: it is
unreliable and, crucially, **incoherent** — every creature comes back in a
different visual language. The parts rig replaces it.

### Modules
| file | role |
|---|---|
| `src/data/partsRig.js` | SLOTS (z-order) · BODY_ANCHORS per body type · the 46-part library. Plain JS so node tests can read it. |
| `src/render/composeCreature.js` | PURE: creature → ordered, positioned layers. No art, no DOM. |
| `src/render/partShapes.jsx` | Procedural stand-in art for every part — the rig runs with **zero assets**. |
| `src/ui/PartsPortrait.jsx` | Renders a composition as one scalable SVG. |
| `src/data/partsBaked.json` | `partId → file`. A baked PNG always beats the procedural shape. |
| `scripts/gen_parts.py` | Bakes real part sprites. |

### The rules it enforces
- **Body from the primary, head from the secondary** — CB's fusion rule.
  `fuseCreatures` records it as `creature.parts = {bodyFrom, headFrom, headBody}`.
- Anything below the body's `z` paints **behind** it (wings, tail, aura).
- `mirror: true` emits a reflected twin about the centre line (wings, claws, horns).
- Geometry is normalised 0..1, so one composition renders at any size.
- Unknown factor tags are skipped, never fatal.

`npm run test:parts` — 315 checks (rig integrity, selection, placement, z-order,
mirroring, determinism, the fusion body/head rule, coverage).

### Incremental art adoption — the important property
Every part renders procedurally **today**. Baking one part is: drop
`public/art/parts/<id>.png`, add a line to `partsBaked.json`. No code change, and
the portrait never looks broken mid-migration. `composeCreature().missingArt`
reports exactly which parts are still procedural — i.e. the live bake queue.

### Generating parts is a COHERENCE problem, not a prompting problem
38 parts drawn in 38 separate calls will not share a palette, light direction, or
line weight, and the composite looks like a ransom note. `scripts/gen_parts.py`
attacks that three ways:

1. **Sheet generation** — one request yields a *grid of variants of that part*.
   Everything inside a single image is consistent by construction, so you pick
   the best cell and its neighbours still match.
2. **One shared style** — the Variant-B block is parsed out of `gen_roster.py`,
   never retyped. (It is parsed as text, not imported, because `gen_roster`
   depends on the Windows-only agy bridge.)
3. **Flat chroma key + the proven cutout** — parts are drawn on uniform magenta
   and keyed by `scripts/sprite_cutout.py`, already battle-tested on the HD-2D
   environment sprites.

**Anchors come for free:** after autocrop each sprite is tight to its own bounds,
and the rig's pivot is expressed in those normalised bounds — so a wing cut from
any sheet lands correctly with no hand-measuring.

Parts are drawn **isolated and in a fixed orientation** (a wing points RIGHT, a
claw points DOWN, a head faces LEFT, weapons stand upright with the grip at the
bottom) because the rig owns placement and mirroring.

```bash
python3 scripts/gen_parts.py --list          # 46 parts, bake status each
python3 scripts/gen_parts.py wings tail      # request sheets
python3 scripts/sprite_cutout.py <sheet> public/art/parts/wings.png --size 512
```

### Open
- **Palette unification.** Even sheet-generated parts drift between part types. A
  post-pass quantising every part to one game palette is the likely fix.
- **Per-part-type sheets still need a human to pick the cell.** Worth automating
  (score cells by how cleanly they key out) once there is a corpus to judge.
- The procedural stand-ins are deliberately crude. They exist to prove the rig and
  to keep the game shippable offline — not as final art.

---

## 7. Retro Diffusion bake pipeline (BUILT 2026-08-06) — coherent parts, cheaply

Whole-creature AI (v3.173.0) and blind Pollinations parts both fail on COHERENCE:
independently generated parts share no palette, light, or line weight. Retro
Diffusion (a pixel-art API) fixes this with three NATIVE features, so the fix is
built into generation rather than bolted on after:

- `reference_images` (RD Pro, up to 9) — generate the 3 bodies FIRST, then pass
  them as references for every other part → one locked style across the set.
- `remove_bg` — transparent PNG straight from the API. **Deletes the chroma-key
  cutout step entirely** (sprite_cutout.py / the studio's cut UI become optional).
- `input_palette` / custom user styles — palette lock, if we want it later.
- `check_cost` — FREE dry run; the script prices every request before spending.

### `scripts/bake_parts_rd.mjs` (zero-dep Node, runs on the dev's machine)
The key lives in `RD_API_KEY`, never in the repo or the browser — RD is keyed, so
it is a DEV tool, not a runtime path. (Runtime stays Pollinations/on-device, which
are keyless; this matches the "two systems" split in docs/art-pipeline.md.)

```
RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs --probe      # 2 imgs, ~$0.36
RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs --bodies     # the 3 bodies
RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs wings tail   # specific parts
```

**Spend safety** (a small prepaid balance is the norm): every request is priced
with `check_cost` first; the summed price must fit BOTH `--budget` (default $0.40)
and the account's real balance or the run aborts having spent nothing; PNGs +
manifest are written after each part (crash-safe); RD auto-refunds failures.
Verified offline with a stubbed fetch (7 logic checks + the abort path): bodies
generate first with no refs, heads carry the body as a reference, `remove_bg` is
always set, and a $0.54 plan under a $0.40 cap aborts with zero generations.

### Cost (verified from RD's API spec, 2026-07)
RD Pro $0.18/img (the one with references); RD Fast ~$0.02–0.03/img (no refs, so
no cross-part coherence). Full 46-part library on Pro ≈ $8 one-time; a single
re-bake ≈ 2–18¢. Prepaid pay-as-you-go, no subscription — cheaper than
Scenario/PixelLab monthly for a bake-once library.

### Style note
RD is a PIXEL-ART engine, so parts come back as pixel art, not the smooth
flat "Variant B" look. That is arguably more authentic (Cassette Beasts is pixel
art) and composites better (hard edges, limited palette, native transparency),
but it is a deliberate style change — the `--probe` run shows it on real creatures
before committing more than ~$0.36.

### Shared with the studio
`src/data/partSubjects.js` (`PART_SUBJECT`) is the single source of truth for what
each part depicts; both the browser studio and the bake script import it so they
cannot drift.
