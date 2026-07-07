# Hybrids + the Aberration "Manifestation" rename — design (opened 2026-07-08, Jeton)

Jeton: *"flesh out our biological hybrids as well as biological subtype hybrids
(archetypes/families); the aberration subtype should be renamed from families to
'Manifestation'."* This doc plans that content work. It sits on top of the locked
body-type framework in **`docs/biology-kits.md` §9** — read that first.

## Terminology fix — Aberration "families" → "Manifestation"

Each body type has an axis-2 kit vocabulary: Humanoid → **Archetype** (Warrior…),
Beast → **Family** (Mammalian/Draconic…), Aberration → **families** today
(Eldritch/Construct/Ooze/Flora/Crystalline/Formless). Rename the ABERRATION axis-2
from "Family" to **"Manifestation"** — an aberration doesn't have a biological
family, it *manifests* as a form. Beast keeps "Family".

**Rename scope (recommendation: LABEL-first, keep data keys):**
- Change every player-facing "Family" label for Aberrations → "Manifestation":
  `AXIS_INFO`, `MonsterPage`/`CardFace` axes line, editor pickers, Codex, the
  `CreatureFilter` facet label (show "Manifestation" when the value comes from an
  Aberration), `biologyNaming`.
- KEEP the JSON/key names (`aberrationKit.json` `families`, `ABERRATION_FAMILIES`,
  `axes.family`) to avoid a data migration — add a display alias
  `axisLabelFor(bodyType) → 'Family' | 'Manifestation'`. (A full key rename is a
  follow-up if we want the code to read cleanly.)
- The six manifestations stay: Eldritch · Construct · Ooze · Flora · Crystalline ·
  Formless (biology-kits.md §9.4).

## Body-type hybrids (Humanoid × Beast × Aberration)

The matrix already works mechanically — a hybrid is the UNION of both body types'
axis-2 kits (a Beast|Humanoid carries a Family AND an Archetype; `basePoolFor`
stacks the pools) with a synthesised name (`biologyNaming.js` FUSIONS:
Chimera/Anomalous/Warped…). What's UNBUILT is depth:

- **Signature hybrid cards** — each body-type pair should get a few cards that only
  make sense at the union (e.g. Beast|Humanoid "Weapon + Fang" combos, Aberration|
  Humanoid "armed horror" cards). Today a hybrid just concatenates two kits; add a
  small `hybridKit.json` keyed by the unordered body-type pair.
- **Naming coverage** — confirm every pair (and pair×subtype) has a FUSIONS entry;
  fill gaps (biology-kits.md §9.6 reference list).
- **Budget** — a hybrid draws from two kits, so its potential pool is larger; decide
  whether to trim (pick N from each) or lean into breadth (currently breadth).

## Subtype hybrids (multiple descriptive subtypes on one body)

Subtypes (Mechanical · Elemental · Giant · Demonic; backlog Undead/…) already stack
in ANY combination across the whole matrix (`subtypeKit.json`/`subtypePool.js`,
`SUBTYPE_TRAITS`). Fleshing out = the interesting *combinations*:

- **Combo cards / traits** — a Mechanical+Elemental creature (a living reactor), a
  Giant+Demonic (a titan fiend) should get a couple of cards/traits that reward the
  pairing, not just the sum of two trait auras.
- **Naming** — `BIOLOGY_SYNTHESIS`/`FUSIONS` already name body×subtype (Cybeast =
  Mechanical Beast, Leviathan = Giant Draconic…); extend to subtype×subtype flavor.
- **Constitution stacking** — two subtypes = two elemental constitutions
  (`matchups.js constitutionKeysOf`); confirm the layered magnitudes still read
  sanely when three+ keys apply.

## Suggested sequencing

1. **Aberration → Manifestation** label rename (small, self-contained; do first).
2. **Naming coverage** audit (fill missing FUSIONS for pairs + subtype combos).
3. **Body-type hybrid signature cards** (`hybridKit.json` + loader; stack in
   `basePoolFor`) — a few per pair.
4. **Subtype-combo cards/traits** for the built subtypes.
5. Balance pass on hybrid pool breadth vs budget.

All new content is DATA (JSON kits + naming tables) run through the existing
generator/pool builders — no engine changes expected beyond a `hybridKit` loader.
