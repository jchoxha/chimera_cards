# Biology Kit Systems — biology selects how a creature's card pool is built

> Status: **direction captured 2026-06-27; the 5 framework questions ANSWERED 2026-06-27
> (Jeton).** The framework below is now **LOCKED**; per-biology card content is still to be
> authored one biology at a time (Beast first). This reframes the §7 generator and the §14
> "card content" plane of `docs/synthesis-matrix-spec.md` — read that first for the 3-axis
> taxonomy.

## Answered framework decisions (2026-06-27, Jeton)
1. **Axis-2 is reused per biology AND multi-valued.** Keep all 3 tag slots for everyone;
   the 2nd slot's vocabulary is biology-conditional (Humanoid → Archetype, Beast → Family,
   …). A creature's axis-2 holds **one tag per biology base it has**, so a Beast|Humanoid
   hybrid carries **both** an Archetype tag **and** a Beast Family tag.
2. **Beast uses BOTH** Families (behaviour + signatures) **and** Anatomy tags (pool bulk).
3. **4–6 sub-types per biology** to start; we step through each biology deliberately (e.g.
   Dragonkin will get Anatomy **plus** 4–6 "flights" keyed to colours/characteristics that
   mesh with the attunement matrix).
4. **Hybrids combine elegantly with NO primary/secondary** — the creature simply **gets the
   tags (and their kits) from BOTH base biologies**, merged into one pool.
5. **Beast is built first.**
6. Beast Families = **basic scientific animal classes** (Mammalian, Reptilian, …). Anatomy
   tags are **all nouns, never verbs** (Teeth/Beak, not Bite); Roar is an allowed exception;
   Shell is included.

---

## 0. The locked decision

> **LOCKED (Jeton 2026-06-27):** The **archetype system (the Class axis — Warrior,
> Rogue, Mage, …) applies ONLY to Humanoids and Humanoid hybrids.** Every other
> biology gets its own native kit system. Archetypes are *trained disciplines* — they
> only make sense for sapient, tool-using, culture-bearing creatures.

Consequence: **Biology is promoted to the primary kit selector.** It answers the
question the Class axis used to answer for everyone — *"where do this creature's cards
come from?"* The pipeline becomes:

```
biology → KIT SYSTEM → base card pool
                       ↓
attunement → reskin damage element + imbue signature status + attunement-own cards
                       ↓
size/form → stat scaling (HP, Might…)
```

Attunement and size stay exactly as they are today (orthogonal layers). Only the
**source of the base pool** changes: it was always Class; now it is biology-conditional.

---

## 1. The axis-2 model — RESOLVED: biology-conditional + multi-valued

Keep the 3-axis *structure*; the **2nd axis's vocabulary is biology-conditional.**
"Archetype" is just the *Humanoid name* for axis-2. For a Beast the same slot holds a
**Family**; Mechanical → **Chassis**; Undead → **type**; etc. Each biology defines its own
axis-2 enum + kit templates, and "Humanoid → Archetype" is just one row of that table.

**Axis-2 is MULTI-VALUED, keyed to the creature's biology bases.** A creature gets **one
axis-2 tag per biology it has**:
- Pure Humanoid → 1 Archetype tag.
- Pure Beast → 1 Family tag.
- **Beast|Humanoid → an Archetype tag AND a Beast Family tag** (both kits contribute).

So the stored shape is no longer "one class string" but a small set of `(system, tag)`
pairs derived from the biology bases — e.g. `[{Archetype: 'Warrior'}, {Family: 'Mammalian'}]`.
The generator unions every base biology's kit (see §4). This keeps a clean, uniform record
for every creature while letting hybrids legitimately speak two kit languages at once.

---

## 2. The kit-system taxonomy (one per biology)

Each biology's kit is one of three *flavours*:
- **Discipline** — learned roles (like archetypes). Sapient biologies.
- **Arsenal/Anatomy** — the pool is assembled from the body parts / tools the creature
  physically has (claws, bite, breath, modules).
- **Theme/Mechanic** — the pool is built around a defining mechanic (sacrifice, decay,
  mass), not a body or a discipline.

| Biology | Kit flavour | Axis-2 ("the class slot") | Pool is built from |
|---|---|---|---|
| **Humanoid** | Discipline | **Archetype** (LOCKED, existing 8→36) | trained discipline: gear, spells, techniques |
| **Beast** | Arsenal + behaviour | **Family** | **Family** (behaviour + signatures) ∪ **Anatomy** tags (the bulk) |
| **Undead** | Theme + type | **Undead type** | affliction / reanimation theme by type |
| **Dragonkin** | Arsenal + role | **Draconic role** | **Breath** weapon + scales/aerial/hoard |
| **Elemental** | Pure attunement | **Elemental form** | mostly the attunement's own pool, amplified |
| **Demon** | Theme + caste | **Caste** | pact / sacrifice / curse / summon |
| **Mechanical** | Modular | **Chassis** | **Modules/parts** the creature is assembled from |
| **Giant** | Mass | **Giant kind** | few, huge cards: stomp / throw / quake |
| **Aberration** | Unreality | **Strain** | mutation / mind / rule-bending |

The numbers (how many families/types per biology) are TBD — start small (**4–6 each**,
vs the 8 archetypes) and grow.

---

## 3. Per-biology seeds (DRAFT — flesh out one at a time)

### 3.1 Humanoid — Archetypes *(LOCKED / already built)*
The existing system: Warrior · Rogue · Mage · Warlock · Priest · Shaman · Ranger ·
Engineer (+ 28 hybrids), each a full StS-style discipline. See `docs/archetype-design.md`.
No change except: this is now **one biology's** kit, not the universal one.

### 3.2 Beast — Families + Anatomy *(built first; the idea that kicked this off)*
**Two lenses that compose.** A beast is defined by `{family, anatomy[]}`.

- **Family** = the **basic scientific animal class** (Jeton: stick to real taxonomy, not
  playstyle labels). It themes behaviour/AI + a few signature cards. Starter 4–6:
  **Mammalian** (adaptable; pack/pursuit, balanced), **Reptilian** (cold-blooded; tough,
  ramps, ambush), **Avian** (aerial; evasion, dive, tempo), **Piscine** (aquatic; Soak /
  flow / control), **Insectoid/Arthropod** (swarm; multiply, venom, fragile-but-many),
  **Amphibian** (versatile; toxins, adaptation, terrain). Family is the
  archetype-equivalent for beasts.
- **Anatomy / Arsenal** = the physical tools the creature has; the pool's **bulk** is
  assembled from these tags. **All tags are NOUNS** (the body part), not actions —
  card names express the verb, tags don't. Starter set: **Claws**, **Teeth/Fangs**,
  **Beak**, **Horns** (incl. antlers/tusks), **Tail**, **Hooves**, **Wings**, **Quills**
  (spines), **Venom** (gland), **Hide**, **Shell**, **Roar** *(allowed exception — a
  behaviour, but iconic)*.

**Composition rule:** Family picks behaviour + ~2–3 signature cards; the creature's
**anatomy tag list fills the rest** of the pool (a winged, horned beast draws its Wing and
Horn cards). Anatomy should be plausible for the Family (Avian → Beak/Wings, not Hooves) —
the generator constrains anatomy by family.

### 3.3 Undead — Affliction & Reanimation *(seed)*
Decay/rot DoTs (Decay already exists), life-drain, **raise/reassemble** minions, status
immunities (no poison/fear), **Undying** (cheat death once). Types: **Skeletal** (cheap
fragile bodies, reassemble), **Ghostly** (phase/evasion, fear), **Plague/Zombie** (spread
infection), **Lich** (curse-caster — bridges toward archetype casting).

### 3.4 Dragonkin — Breath, Anatomy & Flights *(seed; Jeton wants Anatomy + Flights)*
Like Beast, Dragonkin gets **Anatomy** tags (Scales → block/resist, Breath → big charged
attack scaled by attunement, Wings → aerial dodge, Claws, Tail, Hoard-sense…) **plus** an
axis-2 set of **4–6 Flights** — dragon lineages with **key colours/characteristics chosen
to mesh with the attunement matrix** (e.g. a Red/Fire flight, Blue/Frost-or-Water, Black/
Void-or-Shadow, Green/Nature, Gold/Holy, Bronze/Stone-or-Arcane — final mapping when we
step through Dragonkin). Flight = the behaviour/identity themer; Anatomy fills the pool;
attunement skins the element. Plus **hoard/greed** (scales with gold/cards) and **draconic
might** (raw stat dominance) as cross-flight motifs.

### 3.5 Elemental — Pure Attunement Embodiment *(seed)*
These creatures **are** their element — the most attunement-coupled biology. Pool is
mostly the **attunement's own cards, amplified**, plus form-shifting / overload /
unstable mechanics and immunity to anatomy-based effects (no body to claw). Its "kit
system" is essentially "attunement, but more."

### 3.6 Demon — Pact & Corruption *(seed)*
Risk/reward: **Sacrifice** (pay HP/cards for power), **Curses** (load the enemy),
**Summon** lesser demons, **Corruption** (steal/convert). Soul economy. Castes: **Imp**
(swarm), **Fiend** (bruiser), **Tempter** (curse-caster).

### 3.7 Mechanical — Modules & Constructs *(seed)*
The creature **is** the machine (vs the Engineer humanoid who *uses* machines). Assembled
from **parts/modules** (cannon arm, shield generator, treads — each a card cluster);
**Overheat**, energy management, deploy **Constructs/Turrets**, self-repair. Chassis sets
the frame; modules fill the pool.

### 3.8 Giant — Mass & Devastation *(seed)*
**Few cards, each huge.** Stomp/**Quake** (AoE), **Throw** (hurl enemy/objects), **Brace**
(immovable), slow but overwhelming. Size *is* the kit (ties into the size/form ladder).
Low card count, high impact.

### 3.9 Aberration — Mutation & Unreality *(seed)*
Rule-benders: **Mind** effects (Confuse/control), **Mutation** (cards/stats change
mid-fight), eldritch Void/Decay, deliberate randomness, breaking normal constraints
(extra targets, ignore rules). Strains: Eyed, Tentacled, Mind-render, Cosmic.

---

## 4. Hybrids (1–2 biology bases) — UNION, no primary/secondary

A creature carries up to two biology bases; the hybrid **name already exists** in
`src/data/synthesis.js` `BIOLOGY_SYNTHESIS` (Chimera, Dragonspawn, Cybeast, Felbeast,
Ghoul, Augmented, Behemoth, Primal, Stitched, …). That name = the merged-kit identity.

**RESOLVED (Jeton): hybrids combine elegantly with NO frame/graft hierarchy — the creature
simply gets the tags AND kits of BOTH base biologies, merged into one pool.** Per §1, axis-2
holds **one tag per biology**, so a hybrid speaks both kit languages at full strength:

- **Beast|Humanoid "Chimera"** → an **Archetype** tag *and* a **Family** + Anatomy tags →
  a pool that is genuinely *both* a trained discipline *and* a beast arsenal. (This is the
  locked "Humanoid hybrids use the archetype system" — they do, alongside their beast kit.)
- **Dragonkin|Humanoid "Dragonspawn"** → Archetype + a Flight + dragon Anatomy.
- **Beast|Mechanical "Cybeast"** → a Family + Anatomy + a Chassis + Modules.
- **Beast|Demon "Felbeast"** → a Family + Anatomy + a Caste + pact/curse cards.

**Merge mechanics to design when we build hybrids (post-Beast):** how much of each kit lands
(full union risks bloated/overpowered decks), de-duplication when both kits offer similar
cards, and how the **deck-size / rarity budget** (§14) keeps a two-kit creature fair. The
*principle* is locked (equal union of both biologies' tags); the *budgeting* is the tuning
problem. Anatomy plausibility still applies (a Cybeast's mechanical half may swap organic
parts for analogues — armor-plating for Hide, etc.).

---

## 5. What stays unchanged

- **Attunement** layer: reskin damage element + imbue signature status + the
  attunement-own card pool (`src/data/attunementCards.json`). Applies to ALL biologies
  (Elemental just leans hardest on it).
- **Size/form** ladder + evolution (`src/data/forms.js`) — orthogonal stat scaling.
- **Combat matchups** (`matchups.js`): attunement→attunement + biology→attunement
  constitution. Class already has no matchup effect, so dropping universal Class costs
  nothing here.
- The **rarity ladder** and `generateDeck(triple,{mode})` contract (§14) — the *interface*
  is the same; only the **pool source** behind it changes per biology.

---

## 6. Generator impact (what code this touches, later)

Not building tonight — capture only. When we do:
1. **`src/engine/content/generate.js`** — `makeCreature` currently takes a `pool` keyed by
   Class. It needs to select the pool by **biology kit** instead (Humanoid → archetype
   pool as today; others → their kit builder).
2. **`docs/synthesis-matrix-spec.md` §14** — the "card content = Class × Attunement" plane
   becomes **"card content = BiologyKit × Attunement"**, where Humanoid's kit *is* the
   Class×Attunement plane (so §14 stays correct for Humanoids, generalises for the rest).
3. New per-biology kit data files (parallel to `src/data/cards/<archetype>.json`): e.g.
   `beastFamilies.json` + `beastAnatomy.json`, `undead.json`, … built **data-driven /
   swappable** (per the spec's standing instruction for §5/§7).
4. **Axis-2 model** (Option A vs B above) drives `Fighter`/def shape, `POOLS`, reward
   pools, the editor, and the team-assembly/AI-typing inference (`data/inferTypings.js`
   would infer biology-kit axis-2, not always an archetype).

---

## 7. Status — framework answered; per-biology authoring remains

The 5 framework questions are **answered** (see the box at the top). What's left is the
per-biology *content* pass, stepping through one biology at a time:

- **Beast (next, building first):** finalise the 4–6 Families (Mammalian/Reptilian/Avian/
  Piscine/Insectoid/Amphibian) + the Anatomy noun-tag set + which anatomy each family allows,
  then author the card clusters (Family signatures + per-Anatomy cards) as data.
- **Then each other biology** gets the same treatment (Dragonkin = Anatomy + 4–6 Flights
  mapped to the attunement matrix; Undead/Demon/Mechanical/Giant/Elemental/Aberration per
  their §3 seeds).
- **Hybrid budgeting** (§4): how much of each kit lands + dedup + the deck/rarity budget that
  keeps a two-kit creature fair. Principle locked (equal union); tuning open.
- **Generator/data-model migration** (§6): axis-2 becomes a multi-valued, biology-keyed set;
  `inferTypings` infers biology + each biology's axis-2 tag; editor/UI show multiple kit tags.
