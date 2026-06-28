# Biology Kit Systems — biology selects how a creature's card pool is built

> Status: **framework LOCKED (2026-06-27); Beast + Humanoid BUILT (v3.85/3.88).** Per-biology
> card content is authored one biology at a time. This reframes the §7 generator and the §14
> "card content" plane of `docs/synthesis-matrix-spec.md`. **🔒 MODEL REWORKED (§9, 2026-06-28 PM,
> Jeton): the 9 biologies collapse into 3 BODY TYPES (Humanoid · Beast · Aberration) + a set of
> DESCRIPTIVE SUBTYPES (Mechanical/Elemental/Giant/Demonic…) that apply across the whole body-type
> hybrid matrix in any combination. Dragonkin → a Beast "Draconic" family. §8 is SUPERSEDED by §9.**

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

### 3.1 Humanoid — Archetypes + Weapons *(BUILT)*
Axis-2 = the existing **Archetype** system: Warrior · Rogue · Mage · Warlock · Priest ·
Shaman · Ranger · Engineer (+ 28 hybrids), each a full StS-style discipline (see
`docs/archetype-design.md`) — now **one biology's** kit, not the universal one.
**Special factors = WEAPONS** (the Humanoid analogue of Beast anatomy, v3.88.0): 12 weapon
noun-tags (Sword/Axe/Dagger/Bow/Crossbow/Spear/Mace/Hammer/Staff/Wand/Shield/Fist), each a
small card cluster that ADDS to the archetype pool and shows as a special-factor icon. Each
archetype is **proficient** with a subset (a plausibility gate, like family→anatomy). 28
cards in `src/data/humanoidKit.json`, loaded by `src/engine/cards/humanoidPool.js`
(`humanoidWeaponPool(weapons)` / `weaponsForArchetype(klass)`), `test:humanoid` (159). Wired
through `basePoolFor` + Editor weapon pickers, exactly parallel to Beast.

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

- **Humanoid — ✅ BUILT.** Archetypes (existing) + the Weapons special-factor system
  (v3.88.0; see §3.1). Hybrid biology names now resolve through the synthesis matrix on the
  card (Beast|Humanoid → "Chimera") via `biologyName()`/`synthName('biology',…)`.
- **Beast — ✅ BUILT (v3.85.0).** 6 Families (Mammalian/Reptilian/Avian/Piscine/Insectoid/
  Amphibian) + 12 Anatomy noun-tags, each family allowing a plausible subset; 50 cards in
  `src/data/beastKit.json`, loaded by `src/engine/cards/beastPool.js` (`beastPool({family,
  anatomy})`), validated by `npm run test:beast` (245 checks). Wired into generation via the
  app-layer `basePoolFor` (biology selects the base pool; injected into `buildRoster` so
  roster.js stays JSON-free); the Editor's Monster page exposes Family + Anatomy pickers when
  biology = Beast. Numbers provisional — tune later.
- **Then each other biology** gets the same treatment (Dragonkin = Anatomy + 4–6 Flights
  mapped to the attunement matrix; Undead/Demon/Mechanical/Giant/Elemental/Aberration per
  their §3 seeds).
- **Hybrid budgeting** (§4): how much of each kit lands + dedup + the deck/rarity budget that
  keeps a two-kit creature fair. Principle locked (equal union); tuning open.
- **Generator/data-model migration** (§6): axis-2 becomes a multi-valued, biology-keyed set;
  `inferTypings` infers biology + each biology's axis-2 tag; editor/UI show multiple kit tags.

---

## 8. ~~OPEN REDESIGN — base biologies vs condition templates~~ — SUPERSEDED by §9

> Kept for history. §8 proposed 7 bases + a small "condition" tier. Jeton then went further:
> collapse to **3 body types + descriptive subtypes** — see **§9 (the locked model)**.

> Jeton's observation: not all 9 "biologies" are the same *kind* of thing. Some are genuine
> **body plans** (what a creature **is**); others read more like **conditions / templates**
> (what's been **done** to it, or a flavor overlay), and could ride on top of a body plan
> instead of standing alone. This section is a **PROPOSAL pending sign-off** — nothing here
> is built, and it would amend the LOCKED biology base list in `src/data/synthesis.js`.

### 8.1 The test (SHARPENED — Jeton's "is Mechanical a descriptor?" question, 2026-06-28)
A first cut asked "noun vs adjective," but that's too loose: **almost every type can be used as
an adjective** (mechanical wolf, demonic knight, elemental serpent, mutated hound). The real
discriminator is **mechanical/design, not grammatical**:

> **Does it have a standalone, kit-worthy BODY — or is it only a TRAIT PACKAGE that always
> rides a host?**
> - **Standalone full kit → BASE.** A pure robot/golem *is* a complete creature with its own
>   rich kit (chassis, modules, overheat, constructs). It is not a "mechanized *something*."
> - **Package-only, no standalone body → CONDITION.** "Giant" tells you scale, nothing about the
>   body ("a giant *what?*"). "Undead" is a *state of death* applied to a former body ("an undead
>   *what?*"). Neither is a complete creature on its own.

**Key consequence:** the "X-ified" overlay sense (mechanized/demonic/elemental *beast*) is ALREADY
covered by the **two-base hybrid** mechanism — and SHOULD be, because both halves are kit-rich. A
clockwork wolf = `[Beast, Mechanical]` = **Cybeast**; a mechadragon = `[Dragonkin, Mechanical]` =
**Geargon**; a possessed human = `[Humanoid, Demon]` = **Fiend** (all already named in
`BIOLOGY_SYNTHESIS`). So **dual-natured types stay BASES** — we do NOT need Mechanical/Demon/
Elemental conditions; their overlays are hybrids.

| Current "biology" | Verdict | Why |
|---|---|---|
| **Beast** | **Base** | standalone body, full kit (Families + Anatomy) |
| **Humanoid** | **Base** | standalone body, full kit (Archetypes + Weapons) |
| **Dragonkin** | **Base** | standalone body, full kit (Flights + Anatomy/Breath) |
| **Mechanical** | **Base** ✔ | a pure robot/golem IS the body — kit-rich (Chassis + Modules). "Mechanized X" = the X\|Mechanical **hybrid** (Cybeast/Geargon), not a condition |
| **Elemental** | **Base** | a being made of element; "infused X" = the X\|Elemental hybrid |
| **Aberration** | **Base** | an alien body with its own kit; "mutated X" = the X\|Aberration hybrid |
| **Demon** | **Base** (revised — was "demote?") | kit-rich (castes/summons/sacrifice); "demonic X" = the X\|Demon **hybrid** (Fiend/Felbeast…), so no separate *Fiendish* condition needed |
| **Undead** | **Condition** | no standalone body — a *state of death* on a former body (Stitched beast, Ghoul humanoid, Scourgewyrm…) |
| **Giant** | **Condition** | pure **scale** descriptor ("a giant *what?*") — and overlaps the existing **size** ladder |

### 8.2 Proposed two-tier model
- **Base biologies (7, all kit-worthy standalone bodies):** Beast · Humanoid · Dragonkin ·
  Mechanical · Elemental · Aberration · Demon. Each owns a **full kit** (axis-2 + special factors).
- **Conditions / templates (NEW tier):** a creature optionally carries **0–1 condition** on its
  base. A condition grants a **trait/card package** (NOT a full kit, NO axis-2 tag):
  - **Undead** — undying (cheat death once), Decay/rot, immune to poison/fear, reanimate.
    Flavor subtypes: *Skeletal · Rotting · Spectral · Lich.*
  - **Giant** — gates size to Large+, Stomp/Quake AoE, Throw, immovable; fewer-but-bigger cards
    (rides the size ladder for stats, adds its own mechanics on top).
- **New conditions to flesh it out (proposed; these are genuinely package-only overlays, not
  standalone bodies — pick a starting few):**
  - **Hallowed** — holy-touched: regen, ward, smite (the angelic counterpart).
  - **Feral** — wild/berserk: frenzy, more damage while hurt, little defense.
  - **Ancient** — old & powerful: slow start, scaling payoff (elder dragons, elder things).
  - **Swarm** — many-bodied: multiply, sacrifice bodies, weak individually.
  - **Cursed/Plagued** — spreads debuffs at a cost to itself.
  - **Spectral** — incorporeal: evasion/phase, fear (could also be an Undead subtype).

### 8.3 Where conditions live (data model — RECOMMENDED: Option C)
- **A — new 4th axis "Condition."** Cleanest conceptually, but adds an axis everywhere.
- **B — flat template tags** on the creature (a perks list). Lightweight, but parallel to nothing.
- **C — split the biology vocabulary into BASES + MODIFIERS, reuse the existing 1–2 biology
  slot (RECOMMENDED).** A creature's biology = **exactly one base + at most one modifier**, OR
  **two bases** (a true cross-body hybrid). This *subsumes* today's model: `[Beast]` (pure),
  `[Beast, Undead]` (undead beast — Beast base + Undead modifier), `[Beast, Humanoid]` (Chimera —
  two bases). The union/synthesis machinery already handles 2 entries, and `BIOLOGY_SYNTHESIS`
  already names the modified pairs (Stitched = Beast|Undead, Ghoul = Humanoid|Undead, Behemoth =
  Beast|Giant…). New rules: a **modifier can't be the sole biology** (needs a base); a modifier
  contributes a **trait package, not a kit/axis-2 tag**; (TBD) disallow two modifiers.

### 8.4 Open decisions (need Jeton's call before building more biologies)
1. **Adopt the base-vs-condition split at all?** (proposal: yes.)
2. **Demote which?** Under the sharpened test, **only Undead + Giant** demote — every other type
   (incl. **Mechanical** and **Demon**) is a kit-worthy standalone body and STAYS a base; their
   overlay senses are hybrids. (proposal: demote exactly Undead + Giant.)
3. **Data model:** A / B / **C** (proposal: C — bases + modifiers share the biology slot).
4. **Starting condition set:** Undead + Giant first; then how many of the new ones
   (Hallowed/Feral/Ancient/Swarm/Cursed/Spectral) to author?
5. **Giant vs size:** does Giant-the-condition just *gate* size to Large+, or also add its own
   stomp/throw kit on top of raw size scaling? (proposal: both — size scales stats, the condition
   adds mechanics.)
6. **Two modifiers?** Allow e.g. an Undead + Giant creature, or cap at one condition? (proposal:
   cap at one to start.)

If we adopt C, the build order for "remaining biologies" shrinks: we author **Dragonkin /
Mechanical / Elemental / Aberration / Demon** as full kits, and **Undead / Giant (+ new)** as
lighter **condition packages** — less work and a cleaner taxonomy.

---

## 9. 🔒 LOCKED MODEL — Body Types + Descriptive Subtypes (2026-06-28 PM, Jeton)

> Supersedes §8 and the 9-biology framing. The "biology" axis splits into TWO concepts: a
> **Body Type** (the FORM) and zero-or-more **Descriptive Subtypes** (what it's MADE OF / AFFECTED
> BY). Big migration — captured here; built in stages (§9.3).

### 9.1 A. Body Types (the base — the FORM). Exactly three.
Partition by *form*; a creature has **1–2** (pairwise hybrid matrix).
- **Humanoid** — person-shaped (bipedal, limbed, tool-using). Kit: **Archetypes + Weapons** (built).
- **Beast** — animal-shaped (recognisable creature anatomy). Kit: **Families + Anatomy** (built).
  **Dragonkin folds in as the "Draconic" Beast family** — chromatic dragons come from the
  attunement axis (red=Fire, blue=Frost/Water…); **Breath** becomes an Anatomy tag.
- **Aberration** — *neither* person nor animal: formless, geometric, eldritch, plant, ooze,
  crystal, abstract. The **catch-all FORM**, which is what makes the trichotomy exhaustive. Kit:
  **wide, EXHAUSTIVE families** so the big tent has texture (Jeton — confirmed). Family list:
  **Eldritch** (cosmic/tentacled horrors) · **Construct** (animated objects / abstract built
  forms — the *non*-Mechanical-subtype constructs: stone golems, living statues) · **Ooze**
  (slimes, gels, amorphous) · **Flora** (plants, fungi, treants) · **Crystalline** (gem/mineral
  beings) · **Formless** (gas, energy, shadow, clouds — the immaterial). These six are meant to
  span *every* non-person/non-animal form; special factors TBD when we author Aberration.

The 3 body-type hybrids already have names in `BIOLOGY_SYNTHESIS`: Beast|Humanoid = **Chimera**,
Beast|Aberration = **Anomalous**, Humanoid|Aberration = **Warped**.

### 9.2 B. Descriptive Subtypes (modifiers — composition / affliction).
Apply to **ANY** body type or hybrid, in **ANY combination (0–N)**. Each = a **trait/card package**,
NOT a full kit (no axis-2 tag). Start with four; the rest are backlog.
- **Mechanical** — built/constructed: modules, overheat, constructs, self-repair.
- **Elemental** — made of an element: leans hard on attunement, form-shifting, overload.
- **Giant** — titanic scale: gates size to Large+, stomp/throw/quake, immovable (rides the size
  ladder for stats, adds mechanics on top).
- **Demonic** — fiend-touched: sacrifice, curse, fel, summon.
- *Backlog:* Undead · Hallowed · Feral · Ancient · Swarm · Cursed · Spectral.

**Jeton's axiom (endorsed):** there is no subtype creature WITHOUT a body type — every
Mechanical/Elemental/Giant/Demonic thing is one of *Humanoid / Beast / Aberration*. Formless
elementals and abstract machines are the **Aberration** body type (the non-person/non-animal
catch-all). Robustly exhaustive; the cost is Aberration's breadth (§9.4).

**Continuity bonus:** old biology-hybrid names become **body × subtype flavor names** — Mechanical
Beast = **Cybeast**, Giant Beast = **Behemoth**, Demonic Beast = **Felbeast**, Mechanical Dragon
(Draconic Beast) = **Geargon**, etc. Reuse `BIOLOGY_SYNTHESIS` as a naming source.

### 9.3 Migration (large — data-model touch points)
- **`synthesis.js`:** `BIOLOGY_BASES` (9) → `BODY_TYPES` (Humanoid/Beast/Aberration) + new
  `SUBTYPES` (Mechanical/Elemental/Giant/Demonic…). Keep `BIOLOGY_SYNTHESIS` as the body×subtype
  name source; body-type hybrid names are the 3 pairs.
- **Beast kit:** add the **Draconic** family + **Breath** anatomy tag (Dragonkin fold-in).
- **Aberration kit:** author its wide families + special factors (§9.4).
- **Subtype packages:** new data + a `subtypePool`/trait-applier (cards + passives a subtype grants).
- **`matchups.js`:** biology→attunement constitution currently keys on the 9 biologies; re-key onto
  body types + subtypes (the Mechanical/Elemental/etc. subtype likely carries the constitution now).
- **Generator/`basePoolFor`:** pool = body-type kit(s) ∪ each subtype's package.
- **Display:** body-type icon(s) in the corner cluster (per the card redesign); **subtype icons**
  need a home (§9.5); biology label → body-type synth name with subtype prefixes
  ("Giant Mechanical Chimera").
- **Editor / inferTypings / Codex / roster:** re-tag the 12 roster creatures (Ironhide = Giant
  Humanoid?; Emberwisp = Elemental Aberration; Cogwright = Mechanical Humanoid; Grimsoul = Undead
  Humanoid; Maw = Aberration; Voltfang = Beast; …), add body-type + subtype pickers.

### 9.4 Pushback captured — Aberration's double duty (decide before building Aberration)
Aberration is now BOTH a flavored eldritch body type AND the junk-drawer for every non-person/
non-animal form. A Mechanical Aberration turret isn't *eldritch*, just non-animal. **Recommend:**
accept Aberration = "other form," broadly, and give it **wide internal families** so the bucket has
texture (don't add a 4th body type). Alternative: keep Aberration narrowly eldritch + add a generic
"Construct/Other" form — rejected as it breaks the clean three.

### 9.5 RESOLVED conventions (Jeton, 2026-06-28 PM)
1. **Aberration families** — WIDE + exhaustive (§9.1/§9.4), **Flora** (renamed from Plant). ✅
2. **Card display (REVISED 2026-06-28 PM-2):**
   - **Corner = STRICTLY the Archetype** (a Humanoid body type's trained class), or a single
     **catch-all "non-archetype" icon** (`NONARCHETYPE_ICON` = beast-eye) for instinct-driven
     creatures (Beasts/Aberrations, and Beast-without-Humanoid). Families/subtypes are NOT in the
     corner anymore — they moved into the name. (A Beast|Humanoid hybrid shows the archetype.)
   - **Biology name (left, under the name)** now reads as **subtype prefixes + a core noun built
     from body type + FAMILY**, via the **easy-to-extend** `data/biologyNaming.js`:
     - `FAMILY_NOUN` — a Beast/Aberration family's noun (Draconic→"Dragon", Mammalian→"Beast",
       Eldritch→"Horror"…).
     - `FUSIONS` — `"<noun>|<subtype>"` → a fused name that consumes the subtype and chains
       (Dragon+Giant→"Leviathan"; Beast+Giant→"Behemoth"; Beast+Mechanical→"Cybeast"…).
     - Anything not fused → ordered subtype prefixes + the noun. So **a Giant+Undead Draconic
       Beast → "Undead Leviathan"**; Mammalian Beast → "Beast"; Elemental Aberration; Giant
       Demonic Mechanical Chimera (hybrid uses the body-type synth name). **To coin a new
       convention, add ONE line to `FAMILY_NOUN` or `FUSIONS`.**
   - **Special factors (weapons/anatomy)** stay on the **right** of that line.
   - **Subtype prefix ordering** = `SUBTYPE_ORDER` (SIZE → CONDITION → COMPOSITION).
3. **Still open (settle during build):** triple body-type hybrid cap (proposal: cap at 2);
   subtype stacking cap (proposal: any combination legal, soft-cap ~2 for UI); Draconic family
   specifics (Breath-as-anatomy + attunement-as-chroma; optional hoard/flight signatures);
   curated hybrid-name FUSIONS (families don't yet flavor a 2-body name beyond the synth name).

### 9.6 Comprehensive biological-name reference (generated 2026-06-28)
Built by `data/biologyNaming.js` (`FAMILY_NOUN` + `FUSIONS`, reusing `BIOLOGY_SYNTHESIS`;
new names coined where the matrix had none). Anything without a fusion uses readable
prefix form, so the table is open-ended — add a `FUSIONS`/`FAMILY_NOUN` line to coin more.

**Pure body types:** Humanoid → *Humanoid* · Beast(Mammalian) → *Beast* · Aberration(Eldritch) → *Horror*
**Body-type hybrids:** Beast|Humanoid → *Chimera* · Beast|Aberration → *Anomalous* · Humanoid|Aberration → *Warped*

**Beast families (pure):** Mammalian → *Beast* · Reptilian → *Reptile* · Avian → *Bird* ·
Piscine → *Fish* · Insectoid → *Insect* · Amphibian → *Amphibian* · Draconic → *Dragon*

**Aberration families (pure):** Eldritch → *Horror* · Construct → *Construct* · Ooze → *Ooze* ·
Flora → *Flora* · Crystalline → *Crystal* · Formless → *Wisp*

**Family + a subtype (matrix-derived fusions):**

| + subtype | Beast (Mammalian) | Draconic | Humanoid |
|---|---|---|---|
| Mechanical | Cybeast | Geargon | Augmented |
| Elemental | Primal | Aspect | Attuned |
| Giant | Behemoth | Leviathan | Half-Giant |
| Demonic | Felbeast | Hellwing | Fiend |
| Undead | Stitched | Scourgewyrm | Ghoul |

Aberration families default to prefix form (Mechanical Horror, Giant Ooze, Demonic Crystal…)
with flagship fusions: Construct+Mechanical → *Golem*, Eldritch+Demonic → *Eldritch*,
Formless+Elemental → *Elemental*.

**Multi-subtype (prefixes + chained fusions):** Draconic+Giant+Undead → **Undead Leviathan** ·
Mammalian+Giant+Undead → **Abomination** (Behemoth→Abomination) · Mammalian+Demonic+Giant →
**Demonic Behemoth** · Chimera+Giant+Demonic+Mechanical → **Giant Demonic Mechanical Chimera** ·
Humanoid+Demonic+Giant → **Demonic Half-Giant**.
