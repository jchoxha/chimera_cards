# Art-direction experiment — 2026-06-15

Goal: find a generated-art style for Chimera Cards and prove it holds across
different elements and asset types, before committing to a full batch run.

**Pipeline:** all images generated with Google's Antigravity CLI (`agy`) driven
headlessly via `scripts/agy_call.py` (ConPTY + idle detection). Prompts are
prefixed with "generate the following image:" and instructed to save a JPG to an
absolute path. ~22–40s per image. Output is 512²–768² JPEG.

**Outcome: "Variant B" (Adventure-Time-forward flat 2D) was chosen** and is now
the locked spec in `docs/art-pipeline.md`.

Image-model quirks observed:
- The phrase "trading-card art" with no negatives makes the model bake in a full
  card frame + name banner + level badge. A forceful "No text, no card frame, no
  border, no UI — only the illustration" clause suppresses it.
- Even then, monster shots occasionally leak a thin border (crop in post).
- Image generation has a long *silent* compute phase, so the headless caller
  needs a long idle window (≈45–60s) or it kills `agy` mid-generation.

---

## The style search (subject held constant: a fire lion cub)

### 01-terse-prompt-framed.jpg — ❌ rejected
**Prompt:** `a heroic fire lion cub monster, bold cartoon trading-card creature
art, thick black outlines, flat cel-shaded saturated colors, large expressive
eyes, fiery background.` (terse, **no negative constraints**)
**Thinking:** first end-to-end test, just to prove `agy` can produce a file.
**Result/direction:** model added a full card frame, a "LEVEL 4" badge, and a
name banner ("PYRION, THE BLAZE CUB"). Proved the pipeline works, and proved
"trading-card art" + no negatives = baked-in card chrome. Need negatives.

### 02-oldspec-too-disney.jpg — ❌ rejected (style)
**Prompt:** the original canonical spec from `docs/art-pipeline.md` — "Yu-Gi-Oh
trading-card creature art crossed with Adventure Time… rounded, friendly cartoon
shapes; flat cel-shaded…; large expressive eyes… No text, no card frame, no
border."
**Thinking:** use the real documented spec; the negatives should kill the frame.
**Result/direction:** frame/text successfully gone — but the look was **"too
Disney": glossy, rounded, cute**, with none of Yu-Gi-Oh's seriousness and none
of Adventure Time's hand-drawn charm. The "rounded friendly" + "cel-shaded"
wording pulled toward glossy 3D cuteness. Style needs a rethink.

### 03-variantA-ygo-forward.jpg — ⚖️ strong, not chosen
**Prompt:** rewritten spec leaning into Yu-Gi-Oh: "SERIOUS, intense and slightly
menacing, dramatic dynamic action pose, high-contrast moody lighting… detailed
confident hand-inked linework" + AT flat fills + "absolutely NOT Disney, NOT
Pixar, NOT a glossy 3D render, NOT cute baby styling."
**Thinking:** push hard on the missing "seriousness," explicitly negate Disney/3D.
**Result/direction:** got real gravity — menacing, dynamic, detailed inked
linework, lava atmosphere, spiked collar. Edgy but a little more rendered/
painterly and less "charming." Good, but see B.

### 04-variantB-at-forward-CHOSEN.jpg — ✅ CHOSEN
**Prompt:** "Flat 2D hand-drawn cartoon illustration in the spirit of Adventure
Time / Pendleton Ward: simple bold shapes, thick confident black outlines, flat
matte color fills, minimal shading, genuinely charming and characterful. BUT
with the dramatic seriousness of Yu-Gi-Oh trading-card monster art: an intense,
slightly menacing creature in a dynamic heroic pose, moody dramatic lighting, an
epic elemental backdrop. Absolutely NOT Disney, NOT Pixar, NOT 3D, NOT glossy,
NOT soft, NOT overly cute. … No text, no card frame, no border. Square 1:1."
**Thinking:** lead with the flat 2D AT graphic look (the charm that was missing),
keep YGO drama as the tone, negate gloss/cute.
**Result/direction:** **the winner.** Flat, graphic, bold-outlined, charming but
serious — the look the user wanted. Note: leaked a faint cream paper border (to
suppress/crop). Locked as the canonical spec.

---

## Consistency test (Variant B across real game data from `src/data/`)

Same Variant-B spec applied to different elements and asset types to confirm the
style stays cohesive across a real roster. Monsters use the creature spec; moves
and items use a generic variant (same look, drops the "creature" wording).

### 05-glaciathar-B.jpg — ✅ frost/stone monster
**Subject:** Glaciathar — "a massive bear-like behemoth sheathed in translucent
blue glacier ice… jagged ice crowns… eyes two points of cold white light."
**Result/direction:** excellent. Cohesive with 04 despite a totally different
(cold blue) palette and silhouette; even rendered the "ancient creature frozen
within" detail. Faint border again.

### 06-verdantaur-B.jpg — ✅ flora monster
**Subject:** Verdantaur — "a great stag fused with an ancient oak… antlers that
branch into a treetop… eyes glow warm green."
**Result/direction:** strong and on-style. Background ran a touch busy (forest +
storm); fine behind a CSS frame, but a note for "simpler backgrounds" if needed.

### 07-move-avalanche-maw-B.jpg — ✅ ability/move art
**Subject:** "Avalanche Maw" — a frost attack; crushing wave of jagged ice/snow,
cold blue palette, dynamic impact action.
**Result/direction:** the generic-B style works for non-creature *action* art —
dramatic ice-maw, clear ability read. Confirms moves are covered.

### 08-item-ember-heart-B.jpg — ✅ item art
**Subject:** "Ember Heart" sigil — a glowing fiery heart-shaped ember talisman,
single object, warm palette.
**Result/direction:** excellent object render — charred ember heart with glowing
runes/sigil. Confirms items are covered.

---

## Conclusion / next steps

Variant B is consistent across elements (fire, frost/stone, flora) and asset
types (monster, move, item). Ready to proceed to the Phase-1 validation batch in
`docs/art-pipeline.md`, then scale up. Before/while scaling:
- decide on suppressing/cropping the occasional leaked border,
- add WebP post-processing (resize + convert, ~30–80 KB) per the pipeline doc,
- consider a "simpler background" nudge for busy scenes.
