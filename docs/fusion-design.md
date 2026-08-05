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

## 3. Art — the factor-sprite part library (DESIGNED, unbuilt)

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
