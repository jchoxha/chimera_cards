# Card Pool Composition — the deckbuilding core

*Started 2026-07-15 (Jeton: "how all our matrices impact card-pool composition / deck builds — the
fundamental core value of the game").* Companion to `synthesis-matrix-spec.md` (the axis source data)
and `biology-kits.md` (the kit systems). This doc plans **how a creature's typing turns into a deck**,
and how combining typings produces emergent archetypes. Numbers are `REVIEW` — the *structure* is what
we're locking.

## 0. The thesis

The value proposition of Chimera is: **you capture creatures, and each creature's typing determines the
cards it brings to your shared squad hand.** Deckbuilding therefore happens at *two* levels:

1. **Within a creature** — its axes compose a personal card pool (this doc).
2. **Across a squad** — you choose *which* creatures to group, blending their pools into one hand
   (formations, `formations-design.md`).

So every axis must be a meaningful *slider* on the deck, and combinations must produce recognizable
archetypes with real synergies. That emergent-combination space is the game.

## 1. The axes → what each contributes to a deck

| Axis | Values | Contributes to the deck | Also governs |
|---|---|---|---|
| **Attunement** | 13 (1–2) | element re-skin of every card + a signature sub-pool (~3–5 cards) + a signature STATUS | **matchups** (offense + defense), reactions |
| **Body Type** | Humanoid / Beast / Aberration (1–2) | *nothing directly* — it **selects the kit + factor axis** and gates hybrids | which kit system applies |
| **Kit** (per body type) | Archetype ×8 / Family ×7 / Manifestation ×6 | **the bulk of the pool + the core mechanical THEME** (the "class") | the **stat shape** |
| **Factor** (per body type) | Weapons ×12 / Anatomy ×13 / Features ×9 (hold 2–3) | **modular card CLUSTERS** — the "equipment slots" that customize inside a kit | a **stat nudge** each |
| **Subtype** | 11 (0+) | a **signature wild-card PASSIVE** + a small package that plays into it | — (no stats, no matchup) |
| **Size** | baby…boss | HP scale (+ a gentle power/cost curve) | art scale, evolution gates |

### Rough pool budget (a creature's ~12–16-card potential pool)

- **Kit** ≈ 50% — the class core: its signature mechanic cards + Strike/Defend bases (re-skinned).
- **Factors** ≈ 25% — 2–3 clusters of ~2–3 cards each (Shield→guard cards, Venom→poison cards…).
- **Attunement** ≈ 15% — the signature element sub-pool + variant re-skins.
- **Subtype** ≈ 10% — the package that supports its passive.

The point of the budget: a deck has **one clear primary identity (the kit)** with **modular
customization (factors / attunement / subtype)**. You always read a creature as "a *Fire Warrior with a
Hammer*," not a soup.

## 2. The composition pipeline (already partly built — `app/pools.js`)

```
kit base pool            (Archetype+Weapons | Family+Anatomy | Manifestation+Features)   ← body type picks this
  × attunement re-skin   (recolor kit attacks to the creature's element; imbue its status)
  + attunement sub-pool  (the element's own signature cards)
  + subtype package      (cards that feed the subtype's wild-card passive)
  + hybrid signatures    (body-pair / subtype-pair / attunement-pair bespoke cards)
  = POTENTIAL POOL   → starterDeck() carves a playable ~10-card starter → rewards/shop grow it
```

`potentialPool()` and `basePoolFor()` in `app/pools.js` already implement most of this; `kitDeckFor()`
(combat-v2) adapts the result into playable v2 cards. What's **under-built** is the *content density* per
axis and the *subtype packages* (subtypes only carry a passive today, not a card cluster).

## 3. The four synergy planes

Where the cross-axis magic lives (extends `synthesis-matrix-spec.md` §14):

1. **Stat affinity** = Kit × Factor. The kit sets the shape; factors nudge it. A Rogue+Dagger is faster
   than a Rogue+Hammer.
2. **Card content** = Kit × Attunement. The kit says *what a card does*; the attunement says *what
   element it deals + what status it imbues*. A Warrior's Cleave is Physical→Bleed; a Fire Warrior's
   Cleave is Fire→Burn.
3. **Wild-card** = Subtype × everything. The subtype passive re-contextualizes the whole deck (a Swarm
   deck wants multi-hit; a Giant deck wants big splashy hits it can afford).
4. **Reaction/status** = Attunement × Attunement. Statuses one card lays, another detonates
   (`mechanics.md` reactions) — the strongest cross-*creature* synergy in a squad.

## 4. Kit catalog — theme · stat lean · signature mechanic

Stat lean on the 7-stat line (**HP · ATK · DEF · FOC · RES · EVA · SPD**); ↑ up, ↓ down.

### Archetypes (Humanoid) — from `archetype-design.md`
| Archetype | Theme / signature | Stat lean |
|---|---|---|
| **Warrior** | Stance spectrum + Brace; sustained bruiser-tank | ↑DEF ↑HP ↑ATK ↓FOC |
| **Rogue** | Stealth + Combo; chain cheap hits into a payoff | ↑ATK ↑SPD ↑EVA ↓HP ↓DEF |
| **Mage** | Overload + Channel + Conjure; burst spellcaster | ↑FOC ↑ATK ↓HP ↓DEF |
| **Warlock** | Sacrifice + Summon + Curse; pay HP for power | ↑FOC ↑HP ↓DEF |
| **Priest** | Faith + Prayer + Smite; heal the line, punish evil | ↑RES ↑FOC ↑HP ↓ATK |
| **Shaman** | Totem + Spread + Soak; board-control + priming | ↑FOC ↑RES (even) |
| **Ranger** | Mark + Trap + Companion; precise ranged control | ↑ATK ↑SPD ↑ACC ↓HP |
| **Engineer** | Construct + Gadget; build an unbreakable wall | ↑DEF ↑HP ↓SPD |

### Families (Beast)
| Family | Theme | Stat lean |
|---|---|---|
| **Mammalian** | Pursuit/pack tempo — draw + pressure | ↑ATK ↑SPD |
| **Reptilian** | Armored ambush — soak, ramp, big bite | ↑DEF ↑HP ↓SPD |
| **Avian** | Aerial skirmish — evasion + card flow | ↑SPD ↑EVA ↓HP ↓DEF |
| **Piscine** | Soak controller — prime then devastate | ↑FOC ↑HP |
| **Insectoid** | Fragile swarm — many small hits + venom | ↑SPD ↓HP ↓DEF |
| **Amphibian** | Versatile survivor — regen + toxin | ↑RES ↑FOC (even) |
| **Draconic** | Breath + scales + hoard — bulk powerhouse | ↑HP ↑ATK ↑DEF ↓SPD |

### Manifestations (Aberration)
| Manifestation | Theme | Stat lean |
|---|---|---|
| **Eldritch** | Madness/fear — attack the mind | ↑FOC ↓DEF |
| **Construct** | Relentless geometric wall/turret | ↑DEF ↑HP ↓SPD |
| **Ooze** | Engulf/dissolve/absorb attrition | ↑HP ↑RES ↓ATK ↓SPD |
| **Flora** | Toxin + regen + entangle | ↑HP ↑FOC |
| **Crystalline** | Hard/reflective/sharp | ↑DEF ↑RES ↓HP |
| **Formless** | Immaterial/evasive/pervasive | ↑EVA ↑SPD ↓DEF |

**Hybrids** (Humanoid/Beast or Humanoid/Aberration) **average their two kits' stat leans AND merge both
pools** — a Warrior/Mammalian carries stance cards *and* pursuit cards, and reads as a balanced bruiser.

## 5. Factor catalog — the "equipment slots" (card cluster + stat nudge)

A creature holds **2–3 factors**; each adds a small card cluster and a stat nudge. This is the primary
*intra-kit* customization.

### Weapons (Humanoid)
Sword `+ATK`·balanced · Axe `+ATK`·Bleed/Cleave · Dagger `+SPD +EVA`·Combo · Bow `+ACC +ATK`·ranged/Mark
· Crossbow `+ATK`·Pierce · Spear `+ATK`·reach · Mace `+ATK`·armor-break/Stun · Hammer `+ATK↑ +break`·big
slow · Staff `+FOC`·spell reach · Wand `+FOC`·cheap spells · Shield `+DEF +HP`·Block/guard · Fist
`+SPD`·flurry.

### Anatomy (Beast)
Claws `+ATK`·Bleed · Teeth `+ATK`·execute · Beak `+ACC`·Pierce · Horns `+ATK`·charge · Tail `+EVA`·sweep ·
Hooves `+SPD`·trample · Wings `+EVA +SPD`·reposition · Quills `+DEF`·thorns · Venom `+FOC`·Poison · Hide
`+DEF +HP` · Shell `+DEF`·Block · Roar `+FOC`·Weak/fear · Breath `+FOC`·AoE element (chroma = attunement).

### Features (Aberration)
Tentacle `+ATK`·reach/grab · Eye `+ACC`·gaze/Mark · Maw `+ATK`·devour/execute · Pseudopod `+EVA`·engulf ·
Spore `+FOC`·Poison/spread · Shard `+ATK`·Pierce/reflect · Miasma `+FOC`·AoE debuff cloud · Roots
`+DEF`·root/entangle · Mandible `+ATK`·crush.

> Note the overlaps (Venom/Spore→Poison, Shield/Shell/Shard→Block/reflect) — these are the seams where a
> Beast and an Aberration can feel similar, which is fine: the *kit* keeps them distinct.

## 6. Subtype wild-card catalog (the collectible weirdness)

Each subtype = a **signature passive** + a small **package** that rewards building around it. `[built]` =
a v1 trait to port/expand; `[new]` = to design. These are deliberately *build-defining*, not tuning
knobs.

| Subtype | Wild-card passive | Package |
|---|---|---|
| **Mechanical** `[built]` | **Plating** — +2 Block at turn start; immune to Poison/Bleed | Overclock, turret-deploy |
| **Elemental** `[built]` | **Volatile Core** — at end of turn, imbue its attunement's status on the front foe; immune to that status | Overload, detonate |
| **Giant** `[built]` | **Immovable** — starts braced (big Block); can't be repositioned; its single-target hits SPLASH the squad but cost +1 | Slam, Quake, throw-a-support |
| **Demonic** `[built]` | **Dread** — foes that strike it gain Weak; Sacrifice cards (pay HP → power) | Soul-drain, Pact |
| **Undead** `[new]` | **Undying** — heals a little when struck; Poison/Bleed-immune; once per combat survives a lethal hit at 1 HP | Raise, Reassemble |
| **Hallowed** `[new]` | **Sanctified** — squad gains a Regen aura; +damage vs Shadow/Undead/Demonic | Consecrate, Ward |
| **Feral** `[new]` | **Frenzy** — +ATK as HP drops; immune to Confuse; but **cannot gain Block** (no discipline) | Rampage, Reckless |
| **Ancient** `[new]` | **Timeworn** — +1 Might & +1 Guard *permanently* each round; keeps one buff between fights | Slow-scaling powers |
| **Swarm** `[new]` | **Legion** — a live "count"; multi-hit cards scale with it; on death a smaller copy replaces it (once); takes +50% from field/AoE | Split, Spread |
| **Cursed** `[new]` | **Hex** — its hits lay a worsening Curse; when it dies it curses the killer; some cards cost HP | Hex, Blood-pact |
| **Spectral** `[new]` | **Phase** — ignores the first hit each round; strikes/only-struck past the front row (reach); Bleed-immune | Haunt, Fear |

Design guardrails: a subtype passive should (a) be readable in one line, (b) change *what cards you want*
(so it interacts with the pool), and (c) be double-edged where it's strong (Feral trades Block for rage;
Swarm trades AoE-safety for count-scaling). Some of these will not survive playtest — that's expected.

## 7. Attunement catalog — element → status + role in the pool

Each attunement (1) **re-skins** the kit's attacks to its element, (2) **imbues** its signature status on
marked cards, (3) adds a **~3–5 card signature sub-pool**, (4) drives **matchups + reactions**.

| Attunement | Status | Signature flavor |
|---|---|---|
| Physical | Bleed | raw hits, execute |
| Fire | Burn | DoT + detonation |
| Frost | Chill (Weak) | slow/lock, tempo denial |
| Nature | Poison | stacking DoT attrition |
| Water | Soak | prime → payoff (Piscine/Shaman core) |
| Air | Expose | block-bypass, dispersal |
| Energy | Shock | energy tax, chain |
| Stone | Fortify | slot-bound Block aura (its identity is Block cards) |
| Arcane | Amplify | next-hit ×1.5, spell scaling |
| Shadow | Vulnerable | debuff + burst |
| Holy | Regen (self) | sustain + smite |
| Void | Decay | strip Block/buffs/powers |
| Mind | Confuse | fizzle/retarget control |

**Dual attunement** = both element sub-pools + the **hybrid name** (Steam, Kinetic, Frostfire…) + a
handful of pair-signature cards (`hybridPool.js`). Class→attunement legality (`synthesis.js`) constrains
which elements a Humanoid archetype can access (a Warrior is Physical + universals), so an archetype's
*reachable* builds are bounded — an important lever on the design space.

## 8. Emergent archetypes — worked examples

The proof the model works: distinct, recognizable decks fall out of the combinations.

1. **Fire Warrior + Hammer + Giant** → a slow **immovable smash** deck: brace up, then Giant-splash
   Hammer hits that Burn the whole squad. Wants block + big AoE.
2. **Shadow Rogue + Dagger + Undead** → a **combo assassin** that heals off trades and survives a lethal
   swing — chain cheap Shadow hits into an execute, undying through the counterplay.
3. **Fire Mage + Staff + Elemental** → a **spell-slinging detonator**: Burn everything, and Volatile Core
   auto-detonates at turn end. Glass cannon.
4. **Nature Reptilian (Beast) + Venom/Shell + Swarm** → a **poison-attrition wall**: Shell-block, ramp,
   spread Poison that Legion-scales. Tanky DoT.
5. **Void Eldritch (Aberration) + Tentacle/Eye + Ancient** → a **growing control** deck: Confuse + Decay
   to disrupt, Timeworn to out-scale a long fight. Reach from the back row.
6. **Water Shaman + Staff + (any)** paired in a squad with a **Fire** creature → the **reaction combo**:
   Shaman Soaks, the Fire creature detonates Steam. The cross-creature payoff formations exist for.

## 9. Deck construction & growth

### 9.1 The squad deck structure (LOCKED — Jeton, 2026-07-15)
A squad's shared deck has **two tiers**:
- **Personal cards** — each creature carries **≤ 5** of its own *generated* move cards (from its potential
  pool, §2). These are the emergent, per-creature layer.
- **Squad cards** — the squad may hold **≤ 5** *authored* squad cards (§13), each satisfying a squad-level
  `require` (formation / size / member-trait).
- The **shared hand** draws from the union on shared energy (Option A). A fallen creature's **personal**
  cards go dead; **squad** cards persist while the squad still satisfies their gate (cast on squad energy;
  owner = any live member, or the vanguard — engine detail TBD).

Full trio = 15 personal + 5 squad = **up to 20**; duo = up to 15; solo = up to 10 (fewer squad cards — see
9.3). Energy stays ~constant per creature (`squadEnergyFor`, `formations-design.md`).

### 9.2 Growth
- **Starter** (`starterDeck`): ~3 Strike + 3 Defend (kit/element-reskinned) + 2–4 kit/factor signatures per
  creature, always playable.
- **Run growth:** rewards + shop draw from the creature's **potential pool** (rarity-weighted) → a run
  *specializes* a creature; **squad cards** are earned/discovered from the authored registry and assigned to
  eligible squads. Rewards can be assigned per-creature (`grantCard(ownerId)`).
- **Open world (later):** the budget deckbuilder — free construction against a rarity-point cap.

### 9.3 Balancing squads of < 3 creatures
Small squads structurally lose (a) most **squad cards** (they need multi-member traits / a formation) and
(b) **support auras + protection**; they gain **consistency** (thin deck), **board width / independence**,
and **focus**. Because the squad-card library is *authored + finite* (§13), balancing this is a **curation
task**, not an emergent-generation one. Levers:
1. **Scale squad-card slots to size** (~1.5/member → solo 1–2, duo 3, trio 5) — the 5 is the *trio* cap, so
   small squads aren't "missing" slots they can't fill.
2. **Author size-keyed squad cards** — `require:{size:1}` "Lone Hunter" etc., so every size has strong
   *knowns* available; solo becomes a distinct build, not a deprived trio.
3. **Lone-wolf self-aura** — a solo/duo creature gets a built-in self-buff ≈ the support auras it lacks
   (`applyFormationAuras` extension); one tunable knob.
4. **Harness tuning** — add squad-size as a `balance:formations` dimension; converge solo/duo/trio win-rates.

Net: a solo squad = a focused, self-reliant striker (thin consistent generated deck + its own solo-only
squad cards) — a *sidegrade* to the deep, protected, synergy-rich trio.

## 10. Card SPECIFICITY — the availability backbone (LOCKED direction)

Every card declares a **`require`** descriptor: *what a creature must BE to hold it.* This single rule
powers three things at once — a creature's **potential pool**, **reward eligibility** (which of your
creatures a reward can go to), and **deckbuilding legality**. It's the formal answer to "cross-creature
rewards."

### The dimensions a card can key on
A `require` is a set of clauses across these dimensions (a missing dimension = no constraint):

| Dimension | Matches a creature that… | Example card |
|---|---|---|
| *(none)* → **Universal** | any creature | Strike, Defend |
| **Attunement** | has that attunement | Fireball → any Fire creature |
| **Kit** (Archetype/Family/Manifestation) | is that kit | Shield Wall → any Warrior · Pursuit → any Mammalian |
| **Body type** | is that body type | (rare) a generic "Beast" instinct card |
| **Factor** (Weapon/Anatomy/Feature) | has that factor tag | Rend → any creature with **Claws** · Bulwark → any **Shield** |
| **Subtype** | has that subtype | Overclock → any **Mechanical** |
| **Species** | is exactly that species | Ironhide's bespoke signature |

**Matching rule:** OR *within* a dimension (an array — `kit:['Warrior','Rogue']` = has either),
AND *across* dimensions (`{attunement:['Fire'], factor:['Claws']}` = Fire **and** has Claws). A creature
is **eligible** iff it satisfies every constrained dimension.

**Squad-scoped dimensions** (for the authored squad cards, §13): `formation`, `size`, and cross-member
`trait` — evaluated against the **whole squad** (its members + current formation), not one creature. Same
OR-within/AND-across rule; a squad-scoped `eligible()` variant handles them.

### The specificity ladder (broad → narrow) couples to power/rarity
The narrower a card's availability, the more build-defining it's *allowed* to be — a natural rarity
gradient, and a reason to chase specific creatures:

1. **Universal** — the basics. Low power, always legal.
2. **Attunement / Kit / Body** — the big single-axis pools (the "element/class identity").
3. **Factor** — a specific equipment/anatomy cluster (narrower — only creatures with that tag).
4. **Subtype** — the wild-card package.
5. **Combination** (2+ dimensions) — hybrid signatures (Fire+Warrior "Spellsword" cards, Warrior+Shield,
   Giant+Mechanical). Build-defining.
6. **Species** — unique signatures. Rarest, strongest, uncopyable.

### How each system consumes it
- **Potential pool** = *every card the creature is eligible for* — one rule replaces the ad-hoc pool
  assembly in `pools.js` (attunement pool + kit pool + factor clusters + subtype package + hybrids all
  become "cards whose `require` this creature satisfies").
- **Reward draft:** draft cards from a tier-weighted pool; a reward card may be assigned to **any owned
  creature that's eligible** — the UI greys the rest. (Replaces today's "reward always goes to the
  vanguard.")
- **Deckbuilding / budget builder:** same eligibility gate.

### Re-skin interaction
**Universal** and **attunement-generic** attack cards are re-skinned to the *receiving* creature's
attunement (a Universal Strike becomes Fire on a Fire creature; a Nature creature's on a Nature one).
Kit/factor/species cards keep their authored element unless flagged generic. (Consistent with the current
`reskin.js` model.)

### Data-model note
The current loaders already stamp partial tags (`card.class`, `card.attunement`, `card.factor`); the
specificity system **unifies these into one `require` descriptor** + an `eligible(card, creature)`
predicate. Implementing it makes the pool builders, the reward flow, and (later) the budget builder all
read from the same source of truth.

## 11. The GENERATION CONTRACT — how autonomy stays balanced/coherent/compelling

The whole point is a system that can **autonomously mint unique creatures + cards** that are *balanced,
interesting, coherent, and compelling.* Each of those four words maps to a concrete mechanism we must
build — this is the acceptance criteria for the generator.

| Goal | The mechanism that guarantees it |
|---|---|
| **Balanced** | A bidirectional **power-budget model**: every card's effects sum to a *value*, and value ↔ (energy cost × rarity budget). No card ships (authored *or* generated) without passing it. A **generation harness** then sims N creatures and flags any outside the power band. |
| **Coherent** | **Composition from validated axis primitives** + **axis→effect mapping tables**: a creature is assembled from its kit/factor/attunement/subtype pools (each card already `require`-tagged to fit), so output *can't* be off-identity. A Fire Warrior only rolls Fire/Warrior/its-factor cards. |
| **Interesting** | A rich, fully-implemented **effect vocabulary** with **synergy hooks** — statuses that reactions detonate, count/HP/scaling/delayed/conditional mechanics — so generated cards can *do* things, not just "deal N." (Today the v2 engine runs only ~5 ops; this is the gap to close.) |
| **Compelling** | A **clear archetype bias** (the kit is ~50% of the pool, so every creature reads as one build) + the **AI forge** layer for bespoke name/lore/signature flavor on top of the validated skeleton. |

### The two-layer generation model (confirm)

1. **Procedural composition = the balanced backbone.** `makeCreature(typing)` composes stats (kit+factor)
   + pool (`require`-eligible cards) + a starter deck, deterministically and testably. This is what
   scales to a big, safe bestiary.
2. **AI forge = the flavor/novelty layer.** `forgeCreature(concept)` writes name/lore/art + 2–3 bespoke
   **signature** CardSpecs, each pushed through the SAME power-budget + legality validators
   (`sanitizeForgedCard`) so novelty can't break balance. Species-tier `require`.

Everything a human authors and everything either generator produces flows through **one costing model +
one validator + one `require` system** — that single pipeline is what makes "autonomous & balanced"
possible instead of aspirational.

### What this adds to the build

- A **card power-budget module** (`value(effects)` ↔ `cost/rarity`) — the balance backbone. Effects each
  carry a point value (damage/point, block/point, status/point, draw, energy, scaling multipliers…).
- **Expand the v2 effect vocabulary** to the intended set (multi-hit, draw, energy, scaling, delayed,
  conditional + all 13 attunement statuses live) — otherwise generated cards are bland.
- **Axis→effect mapping tables** (the "generative ruleset", `synthesis-matrix-spec.md` §7): each
  attunement/kit/factor/subtype → the effect motifs + number ranges it may roll.
- A **generation validation harness** (`balance:generation`): mint N creatures across the axis space,
  assert every card passes the budget, decks fall in a win-rate band, and identities read coherent.

## 11b. Open questions / decisions

- ✅ **Factors are SPECIES-FIXED** (set at generation, not player-swappable). This is a deliberate
  *diversity* lever: two otherwise-identical creatures (both Fire Mammalian beasts) can feel like
  distinct species purely because one has **Claws** and the other **Teeth** — different factor clusters,
  different play. Factors are part of the species definition, and the generator/forge assigns them.
- ✅ **Cross-creature rewards use the SPECIFICITY system** (§10): a reward card is offered to whichever
  owned creatures satisfy its `require`. Universal cards → anyone; narrower cards → only eligible
  creatures. This preserves identity *and* allows flexibility, tiered by how specific the card is.
- ✅ **Subtypes are BESPOKE** — hand-tuned, near-one-off modifiers layered onto species generation, not a
  systematic formula. Each subtype's passive (§6) + any package is authored individually for feel; some
  will stay passive-only. Treat the §6 catalog as a *starting* set to iterate by hand.
- **Size → cards:** does size touch the pool (bigger = fewer/heavier cards?) or only HP? (Lean: HP +
  a gentle cost curve only.)
- **Pool density targets:** how many authored cards per kit / factor / attunement to hit the §1 budget
  without bloat. Needs an authoring pass + `test:*` coverage.
- **Card VARIANCE (base × modifier layer):** now specced in **§12** — a card = `base + modifiers[]`, each a
  budgeted, `require`-gated delta. Recommendation is **Option B** (typing-intrinsic variance replaces the
  ad-hoc re-skin now; rolled reward augments layer on once budget + reward-targeting land; player crafting
  deferred). Open sub-decision for Jeton: **which adoption tier (A/B/C)** and how aggressive the rolled-augment
  rate should be.

## 12. Card VARIANCE — the base × modifier layer (a design direction to consider)

*Prompted by the same-named StS mod "Chimera Cards" (`research-sts-catalog.md §6`). Jeton: take the mod's
**described concept**, not its repo — "a card variance system … which we could consider."* This section
develops it as a real option for us, because it dovetails with everything above.

### 12.1 The idea
A card is not a fixed object — it's a **base card + a variance layer** (0–N *modifiers*). "Cleave" isn't one
card; it's a family: a **Searing Cleave** (adds Fire + Burn), a **Bludgeoning Cleave** (costs more, hits
proportionally harder), a **Rending Cleave** (adds Bleed). One base × its eligible modifiers = many
*distinct-feeling* cards. This is a **content multiplier**, a **cost↔power lever**, and a **collection/chase
dimension** — all on top of the base card set.

We already do a *slice* of this: attunement **re-skin** recolors a kit card to the creature's element
(`reskin.js`). Variance is the **generalization** of that one hard-coded transform into a first-class,
budgeted, taggable axis.

### 12.2 Where variance comes from — two sources
1. **Typing-intrinsic (deterministic — the same base card feels different per creature).**
   - **Attunement → element prefix** (Searing/Frostfire/Venomous…) — recolor + imbue status. *(= today's
     re-skin, now explicit + budgeted.)*
   - **Factor → a rider suffix** — Cleave on a **Claws** creature is *Rending* (+Bleed); on a **Shield**
     creature it gains a small block rider. Factors already imply a cluster (§5); variance lets them also
     *tint an existing base card*, not only add their own cards.
   These are **not rolled** — they're how one base card reads differently on a Fire Warrior vs a Nature
   Beast. Coherent by construction.
2. **Rolled augments (stochastic — the chase/variety layer).** A **reward or shop card can arrive
   pre-modified**: not just "Bite" but "**Searing Bite**" or "**Heavy Bite**." This is the variety/chase
   dimension — and a natural fit for the reward flow we already have.

### 12.3 The modifier vocabulary (each = a power-budget delta)
Every modifier is a **signed value delta** the §8 budget model already knows how to cost — so a variant's
`base + Σmodifiers` must still match its `cost × rarity`. Families:

| Modifier family | Example | Effect | Budget sign |
|---|---|---|---|
| **Element prefix** | Searing / Frostfire / Venomous | set element + imbue that status | ~neutral (side-grade) |
| **Magnitude suffix** | Bludgeoning (+cost +dmg) / Honed (+dmg −rider) / Swift (−cost −dmg) | slide the cost↔power curve | net-neutral by design |
| **Rider augment** | Rending (+Bleed) / Guarding (+Block) / Draining (lifesteal) | bolt a small Category-1/3 effect | + (premium) |
| **Scaling augment** | Growing (scaleBy a counter) / Echoing (replay) | add a Category-2 payoff | + (premium, rarer) |
| **Scope augment** | Sweeping (splash) / Piercing (ignore-block/reach) | widen targeting | + (scope premium) |
| **Keyword augment** | Fleeting / Persisting / Volatile / Innate | attach a §2 keyword | ± (up or downside) |

**Naming** = `[Prefix] Base [of Suffix]`, **max ~2 tags** so it stays readable ("Searing Bite", not a soup).

### 12.4 Eligibility — what can roll on what (TWO axes)
A modifier declares a `require` on **both**:
- **Card-shape** (new — the CardAugments `validCard` idea): only on attacks · only on damaging cards · not on
  already-Exhaust cards · single-target only. Keeps modifiers sensible (no "Rending" on a pure block card).
- **Holder typing** (our existing §10 `require`): Searing only on Fire-capable creatures · Rending only on
  **Claws** creatures. Keeps variance **coherent with the creature** — a Fire Warrior can roll Searing, never
  Frostfire.

So variance reuses the **same `require`/`eligible()` backbone** as §10 — just adds a card-shape clause
alongside the typing clause.

### 12.5 How it plugs into the four pillars
- **Balanced** — every modifier is a budget delta; the validator gates `base + modifiers`. Variance can't
  open a balance hole. (Magnitude suffixes are net-neutral cost↔power slides; riders raise rarity.)
- **Coherent** — source ① is deterministic; source ② is double-gated (card-shape ∧ typing). A creature's
  variants always fit its identity.
- **Interesting** — one base card yields many distinct plays; the cost↔power lever + riders create micro-build
  decisions ("do I want the Heavy or the Swift Bite?").
- **Compelling** — variants are **collectible** ("a Searing *and* a Venomous Bite") — a Pokémon-flavored chase
  dimension layered onto deckbuilding, and cheap content the generator mints for free.

### 12.6 Adoption options (the decision)
- **Option A — Typing-intrinsic only (minimal).** Formalize what we have: attunement prefix + factor suffix as
  the *only* variance, deterministic, no rolls. Lowest risk, no new UI. (Basically the current plan, just
  data-modeled as base+modifiers.)
- **Option B — + Rolled reward augments (moderate, RECOMMENDED).** Add source ②: reward/shop cards may arrive
  with a rolled modifier (rarity-weighted, double-gated). Adds the chase/variety without a crafting UI. Reuses
  the reward flow + budget + `require` we're already building.
- **Option C — Full augment system + player crafting (maximal).** Players apply/reroll modifiers at a bench
  (gem-socket-like, cf. Guardian Gems). Biggest scope; a late "Forge/anvil" feature.

**Recommendation:** data-model a card as **`base + modifiers[]`** now (each modifier a budgeted, `require`-
gated delta), power **typing-intrinsic variance (A)** with it first — this cleanly *replaces* the ad-hoc
`reskin.js` — then layer **rolled reward augments (B)** once the power-budget + reward targeting land. Defer
player crafting (C) to a later forge pass. Same pipeline (budget + `require`) the rest of the plan is built
on, so variance is nearly free once those exist.

### 12.7 Guardrails
- **≤2 modifiers/card** (readability + budget sanity).
- **Never break base identity** — a Bite stays a Bite; modifiers tint, they don't replace.
- **Budget validator is mandatory** on the composed card (base + mods), same as any authored card.
- **Collection groups variants under their base** so the codex/collection doesn't explode into hundreds of
  near-duplicates — show "Bite ×3 variants," expandable.
- **Build order:** slots into step ② (the base+modifier data model + typing-intrinsic variance rides the
  op-registry + budget work) and step ⑦ (rolled reward augments ride the reward-targeting surfacing).

## 13. Two card ORIGINS — generated movesets vs authored squad cards (LOCKED — Jeton, 2026-07-15)

Every card in the game comes from one of **two fundamentally different origins**. This is a load-bearing
distinction — it decides what's generated vs authored, what's balanced by formula vs by hand, and what the
player *learns* vs *discovers emergently*.

### 13.1 Move cards — GENERATED (the bulk)
A creature's moveset is the **emergent result of its unique feature combination** (kit + factors +
attunement + subtype), composed through the pool pipeline (§2) and the variance layer (§12). Effectively
infinite, per-creature, procedurally **balanced by the power-budget** (§11). No two feature-combos need the
same cards. This is the generative churn — breadth, per-creature identity, and the variance chase.

### 13.2 Squad cards — AUTHORED "KNOWNS" (a finite, curated library)
A **fixed, hand-designed catalog** — like the relic/artifact library, but expressed as cards. Properties:
- **Finite & authored** — a known set the designer curates and hand-balances (still costed by the power
  budget, but *chosen*, not rolled). Players *learn* them, chase them, and build teams around them.
- **Squad-gated `require`** — each keys on a **formation**, a **squad size**, or **member traits**
  (cross-member), evaluated against the **squad**, not one creature (extends the §10 dimensions).
- **Collectible & assignable** — discovered/earned, then slotted into any squad that satisfies the gate
  (≤5, scaled by size — §9.3).
- **Build-defining team payoffs** — the reason to assemble a *specific* squad; the stable meta-vocabulary
  sitting on top of the generative movesets.

### 13.3 Why the split
| | Generated movesets | Authored squad cards |
|---|---|---|
| Origin | composed from typing + variance | a finite hand-designed registry |
| Count | effectively infinite | a known, curated set |
| Balance | power-budget formula + harness | hand-tuned (still budget-checked) |
| Player relationship | emergent per-creature identity | *learned* knowns, chased & collected |
| Gate (`require`) | creature typing/factor/subtype | squad formation / size / member-trait |

This mirrors StS's own split — generative-ish per-character card pools **+** a finite iconic **relic**
library. Our squad cards are that iconic finite layer, as cards, over the generative churn. It gives *us* a
curated lever for team-composition payoffs (which are risky to leave to generation) while keeping the
per-creature content generative and effectively unlimited.

### 13.4 Data-model note
A single authored **squad-card registry** (like `data/artifacts` / relics): each entry = `{ id, name,
effects[] (budgeted op-list), require (squad-level), rarity/discovery }`. The `eligible()` predicate (§10)
gains a **squad-scoped** variant that evaluates a `require` against the *whole squad* (members' traits +
current formation + size). Generated move cards keep the **creature-scoped** eligibility. Both flow through
the one power-budget validator.

## Build order (proposed)

1. **Matchups → attunement-only** (retire Layer-2 constitution) + **stats → kit+factor** (retire
   `BODY_PROFILE`). Mechanical, self-contained; unlocks the identity model above.
2. **Effect vocabulary + power-budget model** (§11) — expand the v2 engine's op set to the intended
   vocabulary AND build `value(effects) ↔ cost/rarity`. The balance backbone; do it before mass content.
   **→ Now specced in `effect-vocabulary.md`** (the deep StS + mods research: 6 effect categories, ~30
   statuses incl. the delayed-detonation family, ~25 hooks, ~50 scaling axes across 13 families, the
   resource-system layer, the modifier-manager + can-negate architecture, and a first-pass power-budget
   point table). **Also model a card as `base + modifiers[]` here (§12)** so typing-intrinsic variance
   replaces the ad-hoc `reskin.js` and rolled reward augments become a later add.
3. **Card SPECIFICITY backbone** (§10) — `require` descriptor + `eligible(card, creature)` **+ a
   squad-scoped `eligible(card, squad)`** (formation/size/member-trait, §13); migrate the `pools.js`
   builders and the reward flow to consume it. Load-bearing for pools/rewards/deckbuilding.
   Stand up the **authored squad-card registry** (§13.4) here as a data file (author content later).
4. **Axis→effect mapping tables** (the generative ruleset) + **subtype wild-card engine** — passive
   hooks in `round.js` + author the 11 signatures (bespoke). Enables procedural card generation.
5. **Content density pass** — flesh each kit/factor/attunement sub-pool to the §1 budget; `test:*`
   coverage of specificity tiers, pool sizes, and the power-budget.
6. **Generation validation harness** (`balance:generation`) — mint N creatures across the axis space,
   assert power bands + coherent identities; the proof autonomy stays balanced.
7. **Deck-build surfacing** — potential pool grouped by tier; per-creature reward targeting; budget
   builder. **+ rolled reward augments (§12 Option B)** ride the reward-targeting surface; collection groups
   variants under their base.
