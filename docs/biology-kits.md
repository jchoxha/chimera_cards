# Biology Kit Systems — biology selects how a creature's card pool is built

> Status: **direction captured 2026-06-27 (Jeton, late-night).** ONE decision is
> **LOCKED**; everything else here is a **DRAFT proposal / seeds** for review.
> This reframes the §7 generator and the §14 "card content" plane of
> `docs/synthesis-matrix-spec.md` — read that first for the 3-axis taxonomy.

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

## 1. The structural fork (OPEN — needs a call)

Today every creature carries a **Class** (the 2nd axis is mandatory). If non-humanoids
have no archetype, what fills that slot?

- **Option A — nullable Class.** Class becomes Humanoid-only; non-humanoids have
  `class: null`. Simplest data change, but the "triple" stops being uniform and a lot of
  code assumes a class is present (`POOLS[class]`, reward pools, generator).
- **Option B — biology-conditional axis-2 vocabulary (RECOMMENDED).** Keep the 3-axis
  *structure*; the **2nd axis's vocabulary depends on biology.** "Archetype" is just the
  *Humanoid name* for axis-2. For a Beast, the same slot holds a **Family**; for
  Mechanical, a **Chassis**; for Undead, an **Undead type**; etc. Every creature still has
  a clean triple `(axis2, biology, attunement)` — the data model barely moves, but each
  biology defines its own axis-2 enum + kit templates.

I recommend **Option B**: it preserves the generator's shape and the synthesis-matrix
data model, and it makes "Humanoid → Archetype" just one row of a general table. The rest
of this doc assumes B, but the choice is yours.

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

### 3.2 Beast — Families + Anatomy *(the idea that kicked this off)*
**Two lenses that compose:**
- **Family** (WoW-hunter-pet style) — the behaviour themer + a signature trick. Seeds:
  **Predator** (ambush burst / stealth), **Pack** (summon/ally synergy, "the more the
  deadlier"), **Reptile** (tough, cold-blooded ramp), **Raptor/Bird** (aerial, dive,
  evasion), **Insectoid** (swarm, venom, multiply), **Aquatic** (Soak/control),
  **Ungulate/Horned** (charge, knockback), **Primate** (tools/throw, adaptive).
  Family ≈ the archetype-equivalent: it sets the AI + a few signature cards.
- **Anatomy / Arsenal** — the physical tools the creature actually has; the pool's
  **bulk** is assembled from these tags: **Claws** (multi-hit), **Bite/Fangs** (heavy
  single + bleed), **Horns/Antlers** (charge/gore), **Tail** (sweep/AoE), **Hooves/
  Stomp**, **Wings** (dive/dodge), **Quills/Spines** (thorns/retaliate), **Venom**
  (poison), **Hide/Armor** (block), **Roar** (buff/fear).

**Composition rule (draft):** Family picks behaviour + ~2–3 signature cards; the
creature's **anatomy tag list fills the rest** of the pool. A winged, horned predator =
Pounce + Gore + Dive. A beast is defined by `{family, anatomy[]}`.

### 3.3 Undead — Affliction & Reanimation *(seed)*
Decay/rot DoTs (Decay already exists), life-drain, **raise/reassemble** minions, status
immunities (no poison/fear), **Undying** (cheat death once). Types: **Skeletal** (cheap
fragile bodies, reassemble), **Ghostly** (phase/evasion, fear), **Plague/Zombie** (spread
infection), **Lich** (curse-caster — bridges toward archetype casting).

### 3.4 Dragonkin — Breath & Hoard *(seed)*
Signature **Breath weapon** (one big charged attack, element = attunement). Plus
**scales** (heavy block/resist), **aerial** (positioning/dodge), **hoard/greed** (scales
with gold/cards), **draconic might** (raw stat dominance). Roles: **Wyrm** (bruiser),
**Drake** (agile flyer), **Wyvern** (venom).

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

## 4. Hybrids (1–2 biology bases)

A creature carries up to two biology bases; the hybrid **name already exists** in
`src/data/synthesis.js` `BIOLOGY_SYNTHESIS` (Chimera, Dragonspawn, Cybeast, Felbeast,
Ghoul, Augmented, Behemoth, Primal, Stitched, …). That name = the merged-kit identity.

**Graft rule (draft):** the **primary** biology's system is the *frame*; the **secondary**
biology grafts in its **signature cluster** (a handful of its most identifying cards).

- **Humanoid hybrids → archetype frame + grafted arsenal.** This is exactly the locked
  decision: Humanoid hybrids *do* use the archetype system, augmented by the other half.
  - **Chimera** (Beast|Humanoid) = an archetype build + Claw/Bite cards.
  - **Dragonspawn** (Dragonkin|Humanoid) = archetype + a Breath card.
  - **Augmented** (Humanoid|Mechanical) = archetype + bolt-on modules.
  - **Ghoul** (Humanoid|Undead) = archetype + an affliction/undying signature.
- **Two non-humanoids → blend the two native systems.** Primary biology's bulk pool +
  secondary's signature cluster.
  - **Cybeast** (Beast|Mechanical) = beast anatomy pool + a few modules.
  - **Felbeast** (Beast|Demon) = beast arsenal + a curse/sacrifice signature.
  - **Behemoth** (Beast|Giant) = beast arsenal scaled toward giant mass.

**Primacy question (OPEN):** when neither base is Humanoid, which is primary — listed
order, the "more physical" one, or player/generator choice? Default proposal: **the first
base in the stored pair is primary** (deterministic), secondary grafts ~3–5 signature
cards.

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

## 7. Open questions for the morning

1. **Axis-2 model: Option A (nullable Class) or B (biology-conditional axis-2)?** (I
   recommend B.)
2. **Beast:** confirm Family = behaviour-themer + signatures, Anatomy tags = pool bulk?
   First family list + first anatomy-tag list?
3. **Counts:** how many families/types per biology to start (proposing 4–6)?
4. **Hybrid primacy** when neither base is Humanoid (proposing: first listed base = primary).
5. Which biology to **flesh out + build first** after Humanoid? (Beast is the natural pick
   — it's the one you described and the most "arsenal-driven," so it proves the framework.)
