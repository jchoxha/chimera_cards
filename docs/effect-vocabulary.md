# Effect Vocabulary & Scaling Axes — the generation palette

*Started 2026-07-15 (Jeton: "deep research on Slay the Spire concepts + StS mods to formulate a very
deep collection of possible build attributes… the scaling axes need to go far deeper").* This is the
**mechanical dictionary** the procedural + AI generators draw from. It answers three questions the rest
of the design has been deferring:

1. **What can a card DO?** — the effect *category structure* + the op/keyword vocabulary.
2. **What can a build SCALE ON?** — the deep scaling-axis catalog (the heart of "builds on steroids").
3. **Where does each mechanic LIVE?** — every axis/effect is owned by a typing (kit/factor/attunement/
   subtype), so generation stays coherent (§ maps to `card-pool-composition.md`).

Grounded in a research sweep of **StS1 base game** (all 4 characters, ~178 relics, the full status/keyword
set) and the **modding scene** (StSLib shared keywords + power hooks; Downfall's 9 villain characters;
custom-character mods: Necromancer, Runesmith, Tirion, Margaret, custom-orb packs). v1's engine is a
*reference only* — this catalog is built from the source material, not ported from v1. Numbers are
`REVIEW`; the **structure + coverage** is what we're locking. Companion to
`card-pool-composition.md` (the pool budget) and `combat-v2-spec.md` (the engine).

---

## 0. How this is consumed

The generation contract (`card-pool-composition.md §11`) needs a *finite, valued, tagged* palette:

- **Coherent** ← every effect/axis here is tagged to an owning typing → a Fire Warrior only rolls from
  Fire + Warrior + its factors' slice of this catalog.
- **Balanced** ← every op & keyword here carries a **power-budget point value** (§8) → `value(card)` is
  computable, and `value ↔ energy × rarity` gates every card (authored, procedural, or AI-forged).
- **Interesting** ← the vocabulary is *deep* (six effect categories, ~30 statuses, ~25 hooks, ~30 scaling
  axes, the resource-system layer) so a generated card can *do* things, not just "deal N."
- **Compelling** ← the axes cluster into recognizable *build identities* (§5), and each kit biases toward
  a couple of them, so every creature reads as one build.

---

## 1. The effect CATEGORY structure

Every card is a list of **effects**. Each effect belongs to one of six categories. This is the schema the
op-registry, the editor, the power-budget, and the generator all key on.

| # | Category | What it is | StS analogues | Engine status (v2) |
|---|---|---|---|---|
| **1** | **Static / immediate** | A flat one-shot: deal N, block N, heal N, apply N status, draw N, +N energy. | Strike, Defend, Bash | ✅ damage/block/heal/debuff/buff live |
| **2** | **Scaling (`scaleBy`)** | Value = base + k × (a *counter* or *stat* or *resource*). The card's number grows with the run of play. | Heavy Blade (×Str), Finisher (×Attacks), Body Slam (×Block), Eviscerate (−cost/discard) | ⚠ counters exist in v1; not in v2 |
| **3** | **Powers / triggers** | A persistent effect that subscribes to a **hook** (§4) and fires later — "at turn start…", "when struck…", "every 3rd attack…". | Demon Form, Juggernaut, Thorns, Noxious Fumes | ⚠ v1 has `trigger`; v2 minimal |
| **4** | **Resources** | Reads/writes a *pool*: energy, a second-resource meter, summons, orbs/fields, or a stance. | Energy, Mantra, Orbs, Stances, (mod) Holy Power | ⚠ energy only in v2 |
| **5** | **Conditional** | Gated on a **predicate**: HP threshold, target-has-status, Nth-card-this-turn, in-stance, has-summon. Effect (or a bonus) applies only if true. | Execute (<HP%), Combo payoffs, Perfected Strike | ⚠ v1 has `condition`; v2 partial |
| **6** | **Keywords** | Card-*intrinsic* properties that change *how it lives in the deck/hand*, not what it resolves to. | Exhaust, Ethereal, Innate, Retain, Fleeting… (§2) | ⚠ Banish/Exhaust only in v2 |

The generator composes a card as **{ category-1 core } + optional { category-2/3/5 rider } + optional
{ keyword }**, then costs the whole thing against the budget. Categories 4 & 6 are mostly *kit/subtype
signatures*, not random riders.

---

## 2. KEYWORD vocabulary (card-intrinsic properties)

Merged from StS base + StSLib (the community-standard set). Each is tagged to the typing that *owns* it as
a motif. `[v2]` = already in engine; `[port]` = in v1/StSLib, bring over; `[new]` = design.

| Keyword | Mechanic | Owner typing (motif) | Budget sign |
|---|---|---|---|
| **Exhaust / Banish** `[v2]` | Removed from deck for the combat when played (fuels exhaust payoffs). | Demonic, Warlock, Mage (one-shot powers) | downside → discount |
| **Ethereal** `[port]` | If still in hand at end of round, it's Banished instead of returned. | Spectral, Formless, Arcane | downside → discount |
| **Innate** `[port]` | Guaranteed in the opening hand each combat. | Ancient (Timeworn setup), Engineer | upside → premium |
| **Retain** `[port]` | Not returned to deck at end of round; held into the next. | Ranger (Trap/aim), Watcher-like Priest | upside → premium |
| **Fleeting** `[new]` | Purges itself (leaves the deck for the run-fight) on use — a true one-shot. | Cursed, Elemental (volatile) | strong downside |
| **Grave** `[new]` | Starts each combat already in the discard pile (delayed availability). | Undead, Ancient | neutral/situational |
| **Persist(N)** `[new]` | Only leaves hand after N plays this round (a sticky card). | Mechanical (durable), Construct | upside → premium |
| **Exhaustive(N)** `[new]` | Has N charges across the combat, then Banishes (a limited-use signature). | Species signatures, Giant (big slow hits) | balances a strong effect |
| **Refund(N)** `[new]` | Returns up to N energy spent (a cheap tempo card). | Rogue, Avian (card flow) | upside → premium |
| **Unplayable / Status-card** `[new]` | Cannot be cast; clutters the hand; may have a passive tick (Burn) or drain. | inflicted BY Void/Mind/Cursed; generated by some subtypes as a cost | it's a *cost*, not a card |
| **Volatile** `[new]` | Auto-casts itself when drawn (StSLib Autoplay) — no choice, no energy. | Elemental, Formless, Feral (uncontrolled) | double-edged |
| **Soulbound** `[new]` | Cannot be removed from a creature's deck (a permanent species trait card). | Species / Curse effects | flavor gate |
| **Reach** `[v2-ish]` | Can target past the front row (back-row units). | Ranger, Avian, Spectral, Tentacle/Eye factors, Giant | upside → premium |
| **Lock-on** `[v2]` | Ignores Evasion (can't miss). | Bow/Beak/Eye factors, Ranger, Construct | upside → premium |
| **Splash** `[v2-ish]` | Single-target hit also spills to the target's squad. | Giant (subtype), Breath/Miasma factors, AoE cards | scope premium |

> **Squad-model note:** StS "hand-position" (Hermit) and much of the discard economy are de-emphasized —
> our combat-v2 is a *shared-hand, simultaneous blind-commit* squad game, not a solo discard engine. Keep
> **Retain/Innate/Grave/Persist/Refund** (they read cleanly on a shared hand); shelve pure discard-synergy.

### 2.1 Novel keyword families from the modding scene (payoff-flippers & card-mutation)
The mods invent keywords that *flip a downside into a payload* or *mutate cards mid-run*. These are the
richest source of subtype/species signatures (all bespoke, `§11b`):

| Keyword | Mechanic | Source | Owner idea |
|---|---|---|---|
| **Afterlife** | Ethereal cards trigger their effect **when Exhausted/Banished** (downside → payload). | Downfall (Awakened One) | Spectral, Undead |
| **Static** | Stacks an *extra* effect each time it's replayed **in the same round** (replay-within-turn). | The Seeker | Arcane, Mechanical |
| **Encode → Compile** | Flag N cards; after casting N Encodes, **fuse them into one new card** added to hand. | Downfall (Automaton) | Mechanical (subtype signature) |
| **Socket / Gem** | 0-cost Gem cards permanently **slot into another card** (out of combat), grafting their effect on. | Downfall / Guardian | Mechanical, Ancient (card-crafting) |
| **Unidentified → Identify** | A card **re-rolls into a random eligible card between fights**; Identify locks its current form. | Downfall (Snecko) | Cursed, a "wild" species |
| **Switches** | Card toggles between two alternate forms while in hand. | Replay the Spire | Formless, Mind |
| **Cycle** | Card transforms into another on play (chained morphs). | Replay / Construct | Ooze, Construct |
| **Overflow** | A unique end-of-round effect *while the card is still in hand* (rewards hoarding). | The Juggernaut | Ancient, Giant |

> These are **card-mutation / deck-crafting** mechanics — a whole design space base StS lacks. They fit
> our *bespoke subtype* tier and marquee-species signatures, not random generation.

---

## 3. STATUS / POWER vocabulary

The buff/debuff dictionary. Three structural families the engine must distinguish (this is load-bearing for
ticking + the budget):

- **Intensity** — a magnitude that *holds* its value each round until removed (Strength/Empower, Fortify,
  Focus, Plated). Multi-hit multiplies per-hit intensity buffs.
- **Duration** — measured in rounds; loses 1 stack at end of the afflicted unit's round (Weak, Vulnerable,
  Frail, Intangible).
- **DoT / tick** — deals its value *and* changes each round (Poison ticks value then −1; Burn flat/turns;
  Regen heals then −1). These are the reaction primers.

Our 13 attunements already own a signature status (`card-pool-composition.md §7`). This table is the
*full* palette they + kits + subtypes draw from — many map onto the StS originals with our names.

### 3.1 Offensive buffs (self)
| Status | Behavior | Family | Owner |
|---|---|---|---|
| **Empower** (=Strength) | +N damage per hit to attacks. | Intensity | Physical, Warrior, Beast, Demonic |
| **Amplify** (=next-hit ×) `[v2]` | Next attack ×1.5; consumed. | Duration/charge | Arcane |
| **Momentum** (=Rage) `[new]` | +N Block each time you attack this round. | Duration | Warrior, Mammalian |
| **Overload** (=Demon Form) `[new]` | +N Empower at the *start of each round* (compounding). | Intensity+trigger | Mage, Draconic, Ancient |
| **Vigor** `[new]` | Next attack +N flat; consumed (Champ-mod). | Charge | Warrior stance, Feral |
| **Double-Strike** (=Double Tap) `[new]` | Next N attacks resolve twice. | Charge | Rogue, Arcane, Mechanical (compile) |
| **Execute-mark** `[new]` | Bonus damage / auto-kill vs targets below X% HP. | Conditional tag | Teeth/Maw factors, Shadow |

### 3.2 Defensive buffs (self / squad)
| Status | Behavior | Family | Owner |
|---|---|---|---|
| **Fortify** (=Dexterity) `[v2 name]` | +N Block gained from cards / a slot-bound Block aura. | Intensity | Stone, Engineer, Shield/Shell |
| **Plating** (=Metallicize/Plated) `[built]` | +N Block at end of round (Plated: knocked −1 by unblocked hits). | Intensity+trigger | Mechanical (subtype), Construct, Reptilian |
| **Thorns** `[new]` | When struck, deal N back to attacker (per hit). | Intensity+trigger | Quills anatomy, Crystalline, Shard feature |
| **Barricade** `[new]` | Block no longer decays at round start (accumulate → Body-Slam). | Intensity | Engineer, Construct, Giant |
| **Regen** (self) `[v2]` | Heal N at end of round, −1/round. | DoT(heal) | Holy, Amphibian, Flora |
| **Undying** `[new]` | Once per combat, survive lethal at 1 HP (StSLib onPlayerDeath). | Trigger | Undead (subtype) |
| **Buffer** `[new]` | Negate the next N instances of HP loss. | Charge | Mechanical, Crystalline |
| **Intangible** `[new]` | Reduce ALL incoming damage/loss to 1 for N rounds (rare, premium). | Duration | Spectral (subtype), Formless |
| **Ward / Cleanse** `[new]` | Negate the next debuff applied (StSLib onReceivePower). | Charge | Hallowed, Priest |

### 3.3 Debuffs (on foes)
| Status | Behavior | Family | Owner |
|---|---|---|---|
| **Vulnerable** `[v2]` | Target takes +50% attack damage. | Duration | Shadow, Mark (Ranger), Bruise-style |
| **Weak / Chill** `[v2]` | Target deals −25% attack damage. | Duration | Frost |
| **Frail** `[new]` | Target gains −25% Block from cards. | Duration | Void, Frost |
| **Poison** `[v2]` | DoT = stacks at round start, then −1; ignores Block. | DoT | Nature, Venom/Spore factors, Flora, Insectoid |
| **Burn** `[v2]` | Flat DoT for N rounds. | DoT | Fire |
| **Bleed** `[v2]` | DoT that *grows* with hits taken (multi-hit ramp). | DoT | Physical, Claws |
| **Soak** `[v2]` | Primer: next attack vs target +25%/stack, then clears (reaction fuel). | Charge | Water |
| **Shock** `[v2]` | Energy tax + DoT that grows when spread to more foes. | DoT+tax | Energy |
| **Expose** `[v2]` | Window where hits ignore Block; lockout when Expose>HP. | Duration | Air |
| **Decay** `[v2]` | DoT that also strips Block + buffs + a power. | DoT+strip | Void |
| **Confuse** `[v2]` | Per attack: chance to fizzle or retarget. | Charge | Mind |
| **Dread** `[built]` | Foes that strike it gain Weak (aura). | Trigger-aura | Demonic (subtype) |
| **Constrict / Root** `[new]` | Flat end-of-round DoT that does NOT decay (Roots feature). | DoT(persistent) | Roots feature, Flora |
| **Slow** `[new]` | Target takes +10% damage per card you cast this round. | Per-play | Frost, Time-motif |
| **Curse-lay** `[new]` | Hits apply a worsening Curse; on death curse the killer. | Trigger | Cursed (subtype), Hex |

### 3.4 Delayed & conditional debuffs (a novel family base StS lacks)
The mods invented a whole family beyond "ticks every turn": **accrue-silently-then-detonate** and
**persist-only-if-a-condition-holds.** These give the generator a *third* DoT flavor (charge-burst) and a
*maintenance* mechanic — both strong subtype/kit signatures.

| Status | Behavior | Source | Owner idea |
|---|---|---|---|
| **Soulburn** (delayed burst) | Accrues inert; after N rounds (or when *ignited*), the whole stack detonates as one HP-loss, then clears. Contrast Poison (ticks + decays). | Downfall (Hexaghost) | Fire, Void, Cursed — a "fuse" attunement flavor |
| **Doom** (conditional-persist) | Drains HP = stacks at round start, **then vanishes UNLESS the target is "Afflicted"** (holds both Weak+Vulnerable). Rewarding a maintained debuff-state. | Downfall (Collector) | Shadow+Frost combo, a control kit |
| **Hex** (consume-all amp) | Target takes +20%/stack from the *next* attack, then all Hex clears at once (one big amplified hit). | Downfall (Awakened One) | Arcane, Shadow — burst setup |
| **Bruise** (flat target-amp) | Target takes flat +N attack damage (additive, vs Vulnerable's %). Wears off end of round. | Downfall (Hermit) | Physical, Mark (Ranger) |
| **Rugged / Invincible** (damage floor/cap) | Reduce the next instance (Rugged) or *all this round's* HP loss (Invincible) to a hard cap. | Downfall (Hermit) | Mechanical, Crystalline, Giant |
| **Languid** (decaying-Weak) | −N damage dealt, N decreasing by 1 each round (a self-fading Weak-by-amount). | Replay the Spire | Frost, a fading-slow |
| **Reflection** (full-block riposte) | When you *completely* block an attack, reflect that damage back (Thorns keyed on full-block, not on being hit). | Replay the Spire | Crystalline, Stone, Shield |
| **Cripple** (Weak-lock) | Target can no longer lose Weak, and loses HP = its Weak at round end. | Downfall (Gremlins) | Frost + Nature control |
| **Venom-synergy** | Target loses HP whenever you apply *any other* debuff to it. | Downfall (Snecko) | a debuff-stacking control kit |

---

## 4. TRIGGER / HOOK vocabulary (the "when")

The event surface a Category-3 power subscribes to. Combat-v2's `round.js` must expose these hooks for
the subtype engine + generated powers. Grouped by phase; each is a subscription point.

**Round-boundary**
- `combatStart` (=StSLib Startup) · `roundStart` · `roundEnd` · `everyNthRound(N)`

**Cast / play**
- `onCast(any)` · `onCastAttack` · `onCastSkill` · `onCastPower` · `onNthCastThisRound(N)` ·
  `onCast0Cost` · `onFirstCastEachRound`

**Combat events**
- `onDealUnblockedDamage` · `onHitLanded` (per hit — multi-hit hook) · `onStruck` (this unit hit) ·
  `onKill` (enemy dies to you) · `onAllyDown` / `onOwnDeath` (StSLib onPlayerDeath — revive/undying)

**Defense / HP**
- `onGainBlock` (=Juggernaut/Mental Fortress) · `onLoseBlock` · `onBlockBroken` (StSLib) ·
  `onLoseHP` (=Rupture/Runic Cube) · `onHPThreshold(<X%)` (=Feral frenzy, enrage)

**Status / resource**
- `onStatusApplied(to self)` (StSLib onReceivePower — cleanse/ward) · `onStatusTick` ·
  `atResourceStacks(res,N)` (=Mantra→Divinity threshold) · `onSummonCount(N)` (Swarm/Warlock) ·
  `onStanceChange` / `onEnterStance(X)` · `onOrbChannel` / `onOrbEvoke` / `onFieldTick`

**Squad / formation (our own)**
- `onFormationChange` · `onVanguardFall` (auto-promote) · `onSupportCast` · `onSquadReaction` (a
  status this creature laid gets detonated by a squadmate — the cross-creature payoff hook)

**Modifier hooks (transform a value in flight — StSLib DamageMod/BlockMod)**
- `modifyOutgoingDamage` · `modifyIncomingDamage` · `modifyBlockGained` — how Empower, Vulnerable,
  matchup multipliers, Giant-splash, etc. compose. Centralizing these is what keeps the budget honest.

---

## 5. SCALING-AXIS catalog (the deep version)

**This is the section Jeton asked to "go far deeper" on.** A *scaling axis* = a measurable quantity a
build grows so its cards' output climbs over a fight. Each axis has: a **counter/source**, a **payoff
pattern**, the **owning typings**, and a **StS root** (provenance). This is the taxonomy the generator's
Category-2 (scaleBy) and Category-3 (per-turn powers) effects roll against, and the backbone of "one clear
build identity per creature." Organized into families.

### A. Stat-buff scaling (a status magnitude climbs)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **A1 Empower/Strength** | +Empower stacks → every hit (×hit-count) | Physical, Warrior, Beast, Demonic, Draconic | Demon Form / Limit Break / Heavy Blade |
| **A2 Fortify/Dexterity** | +Fortify → all Block gained; feeds Barricade→Body-Slam | Stone, Engineer, Construct, Shield | Dexterity / Footwork |
| **A3 Focus** | +Focus → all field/orb/aura magnitudes | Elemental subtype, Mage, Shaman | Defect Focus |
| **A4 Per-round compounding** | a power that adds value *each round* (Overload, Plating, Timeworn) | Ancient, Draconic, Mechanical, Mage | Demon Form / Metallicize |

### B. Tempo / play-count scaling (how MANY cards, not how big)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **B1 Cards cast this round** | count → AoE nuke / debuff-all (Panache, Choke) | Rogue, Mammalian, Arcane | Panache / Choke |
| **B2 Attacks landed** | attacks → +Empower/+Block/+Fortify per N (Shuriken/Kunai) | Rogue, Insectoid, Fist/Dagger | Shuriken / Kunai / Finisher |
| **B3 Multi-hit / hit-count** | hits in one card → re-applies per-hit statuses (Empower, Poison-on-hit, Bleed-grow) | Insectoid, Swarm, Rogue, Claws/Fist | Whirlwind / Pummel / shivs |
| **B4 0-cost / free spam** | cheap cards → fuel B1/B2 + Refund loops | Rogue, Avian, Formless | Shivs / Claw / After Image |
| **B5 Skills/Powers cast** | non-attack count → payoffs (Letter Opener; power-spam) | Mage, Engineer, Shaman | Machine Learning / Letter Opener |

### C. Attrition / DoT scaling (damage that ticks, ignores Block)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **C1 Poison stacks** | applied faster than decay → melts; burst via Catalyst-double | Nature, Venom/Spore, Flora, Insectoid | Silent Poison |
| **C2 Burn duration** | Fire everywhere + detonation | Fire, Breath | (mod) Burn synergies |
| **C3 Bleed ramp** | Bleed grows with hits taken → multi-hit amplifies | Physical, Claws | our Bleed |
| **C4 Spread / Legion** | count of afflicted foes → DoT grows (Shock/Swarm) | Energy, Swarm, Miasma/Spore | Noxious Fumes / Corpse Explosion |

### D. Prime → detonate (charge a target, then pop)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **D1 Soak stacks** | prime a target, next hit scales +25%/stack | Water, Piscine, Shaman | our Soak |
| **D2 Reaction chains** | a laid status + a matching element → a reaction (`mechanics.md`) | any Attunement × Attunement | (novel) |
| **D3 Amplify charge** | next-attack multiplier banked, then spent on a nuke | Arcane, Mage | Watcher Wrath/Divinity |

### E. Resource-meter scaling (a second pool builds → a payoff, §6)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **E1 Threshold burst** | fill a meter to N → spend for a huge effect (Mantra→Divinity) | Arcane, Priest, Hallowed | Watcher Mantra |
| **E2 Ignition/sequence** | light K fires by casting the right types in order | Elemental, Hexaghost-motif subtype | (mod) Ghostflame |
| **E3 Holy/dark charge** | build & expend a class resource for card bonuses | Priest (Faith), Warlock (souls) | (mod) Holy Power |

### F. Summon / entity scaling (a board of helpers)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **F1 Summon count** | living summons → per-summon damage/block; count-scaling cards | Warlock, Engineer (Construct), Swarm (Legion) | (mod) Necromancer / Defect orbs |
| **F2 Field/orb passives** | persistent entities tick each round (turret, totem, orb) | Shaman (Totem), Construct, Elemental | Defect Orbs / (mod) runes |
| **F3 Split-on-death** | on death, spawn a smaller copy (once) → attrition | Swarm, Ooze | Slime Boss |

### G. Cost / sacrifice scaling (pay a price for power)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **G1 HP spent** | pay HP → Empower/energy/draw; Rupture (+Empower on HP loss) | Demonic, Warlock, Feral | Rupture / Brutality / Offering |
| **G2 Low-HP frenzy** | +ATK as HP drops (Feral); enrage thresholds | Feral, Draconic | (enemy Enrage) |
| **G3 Energy spent (X-cost)** | dump all energy → effect scales per point | Mage, Arcane | Whirlwind / X-costs |
| **G4 Banish/Exhaust fuel** | cards removed → payoffs (Block/draw/damage per banish) | Demonic, Warlock, Mage | Corruption / Dead Branch / Feel No Pain |

### H. Persistence / long-game scaling (win the marathon)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **H1 Turns elapsed** | per-round powers compound (see A4) | Ancient, Draconic, Construct | Demon Form / Metallicize |
| **H2 Kills** | on-kill perms: +max-HP, upgrade, spread (Feed/Ritual/Corpse) | Shadow, Teeth/Maw, Warlock | Feed / Ritual Dagger / Lesson Learned |
| **H3 Block accumulation** | Barricade-hoard → Body-Slam / big release | Engineer, Giant, Construct | Barricade / Body Slam |
| **H4 Carry-over** | keep a buff/summon between fights (Timeworn) | Ancient | (novel) |

### I. Control / denial scaling (shut the enemy down)
| Axis | Counter → payoff | Owners | StS root |
|---|---|---|---|
| **I1 Debuff stacks on target** | Vulnerable/Weak/Frail amplify your whole squad | Shadow, Frost, Ranger (Mark) | Vulnerable amplifiers |
| **I2 Energy/tempo denial** | Shock tax + Confuse + Expose lock the foe's turn | Energy, Mind, Air | (our statuses) |
| **I3 Block-strip** | Decay/Expose remove enemy defenses → your DoT lands | Void, Air | our Decay/Expose |

### J. Sequence / geometry scaling (ORDER of play matters — novel from mods)
| Axis | Counter → payoff | Owners | Mod root |
|---|---|---|---|
| **J1 Ordered sequence** | play card *types* in a required order → complete a "melody"/ignite a wheel → free payoff | Elemental (ignition), Mage, a "song" subtype | Bard Melody / Hexaghost Ghostflame Wheel |
| **J2 Cyclic meter** | a rotating N-slot track; the *active* slot pays off when you meet its (type-gated) condition, then advances | Elemental, Mechanical | Ghostflame Wheel |
| **J3 Positional-in-hand** | a card is stronger while in a hand *position* (center) — manipulate hand order | Mind, Formless (a niche "trickster" species) | Hermit Dead On |
| **J4 Replay-within-round** | stacks an extra effect each time replayed the *same* round (rewards cheap/free replays) | Arcane, Rogue | Seeker Static |

### K. Board-gating & entity scaling (build a field, then spend it)
| Axis | Counter → payoff | Owners | Mod root |
|---|---|---|---|
| **K1 Summon→Tribute gate** | must hold ≥N summons/entities to play your *bombs* (a two-tier deck) | Warlock, Engineer, Swarm | Duelist Summon/Tribute |
| **K2 Potency (entity-Focus)** | one stat scales *all* your summons/fields at once | Shaman, Warlock, Swarm | Slime Boss Potency |
| **K3 Slot-recycle** | auto-consume the oldest entity for a permanent buff when slots fill | Swarm, Ooze | Slime Boss Split/Absorb |
| **K4 Collect-on-kill** | defeating a foe adds a card/entity to a growing side-deck (draw +1 from it/round) | Warlock, Shadow, a "collector" species | Collector Essence |

### L. Charge / bank / greed scaling (store now, dump later)
| Axis | Counter → payoff | Owners | Mod root |
|---|---|---|---|
| **L1 Exponential charge** | build a multiplier (8→×2, 16→×4…), depleted on attack — build-and-dump greed | Arcane, Mage, Draconic | Marisa Charge |
| **L2 Banked energy** | unspent energy/resource **carries between rounds** → a huge burst turn | Ancient, Mechanical (a "capacitor" species) | Conductor Snowballs / Collector Reserve |
| **L3 Stasis / cost-park** | park a card off-board a few rounds → it returns **cost 0**; accelerate it out | Mechanical, Ancient | Guardian Stasis |
| **L4 Overflow (big-hand)** | payoffs trigger when hand > N cards (rewards hoarding/retain) | Ancient, Ranger | Snecko Overflow |

### M. Cost/mutation & meta scaling
| Axis | Counter → payoff | Owners | Mod root |
|---|---|---|---|
| **M1 Cost-reduction ramp** | playing type-X permanently cheapens/boosts type-Y cards this fight | Mage, Arcane | Shadowverse Spellboost |
| **M2 Overspend (Amplify)** | pay *extra* energy → a much bigger effect (free-form X-cost) | Mage, Arcane, Draconic | Marisa/Shadowverse Amplify |
| **M3 Card-fusion** | play N flagged cards → fuse into one cheap combined card | Mechanical (subtype signature) | Automaton Encode/Compile |
| **M4 Temp→permanent** | convert temporary stats/buffs into permanent ones (mid-fight snowball) | Ancient (Timeworn), Draconic | Guardian Gems / Clockwork |
| **M5 Second HP-track (Posture)** | a guard-break bar; break it → cheap execute (Sekiro-style) | Warrior, Teeth/Maw, Mind | Vagabond Posture |

**~50 axes across 13 families.** The generator picks a creature's **1–2 primary axes from its kit**, a
**secondary from its factors/attunement**, and a **wild-card from its subtype** — that's the recipe for a
readable build. Families A–I are the *bread-and-butter* (every creature rolls here); **J–M are the
"on-steroids" / marquee axes** — bespoke, mostly subtype- or signature-species-owned, at most one per
creature so it stays readable. §9 maps every typing → its axes.

---

## 6. RESOURCE-SYSTEM layer (the "on steroids" part)

Base StS has energy + (per class) orbs/stances/mantra. The *modding scene* is where second-resource
systems explode — this is our richest source of "depth beyond StS." These are **subtype/kit signatures**,
authored bespoke (`§11b` decision), not random rolls. Catalog of system *archetypes* we can instantiate:

| System | How it works | StS/mod root | Fits our |
|---|---|---|---|
| **Meter → burst** | fill a counter (per cast / per kill / per round) → spend at threshold for a big payoff. | Mantra→Divinity; Holy Power | Arcane, Priest (Faith), Hallowed |
| **Ignition sequence** | K latent "fires"; casting the right card *types* lights them → escalating bonus. | Hexaghost Ghostflame | Elemental subtype, Fire |
| **Summon board** | spend cards to place entities; they act/scale each round; count-scaling payoffs. | Necromancer; Defect orbs | Warlock, Engineer, Swarm |
| **Field / orb passives** | persistent tokens with a per-round tick + an evoke-on-eject. | Defect orbs; Runesmith runes | Shaman (Totem), Construct, Elemental |
| **Stance dance** | mutually-exclusive modes with strong on/off effects + change triggers. | Watcher; Champ; Margaret | Warrior (built), Feral, Demonic |
| **Card-modification** | slot gems / enhance / fuse cards mid-combat to upgrade them. | Guardian Gem; Runesmith Enhance; Automaton Compile | Mechanical (overclock), Ancient |
| **Cost-park (Stasis)** | remove a card from play a few rounds to cheapen/boost it. | Guardian Stasis | Mechanical, Ancient |
| **Temp-HP pool** | a second, decaying health layer distinct from Block. | StSLib TempHP | Undead, Ooze, Giant |
| **Self-clog cost** | generate unplayable Status cards as the *price* of a strong effect. | Automaton | Cursed, Void-inflicted |

| **Banked energy** | unspent energy carries between rounds as a currency → burst turn. | Conductor Snowballs; Collector Reserve | Ancient, Mechanical |
| **Multi-body party** | pilot several small units, one "leading", each with a distinct passive; swap-timing is the game. | Downfall Gremlins | Swarm (subtype), *and our squad model itself* |
| **Exhaust-as-cost (Pyre)** | a card costs "exhaust another card in hand" *on top of* energy. | Collector Pyre | Demonic, Warlock (sacrifice) |
| **Phase transformation** | crossing a resource/power-count threshold flips the creature to an empowered 2nd form. | Awakened One; Slime Boss | Ancient, Draconic, evolution gates |

Guardrail: **at most one resource-system per creature** (usually from its subtype or kit), or it stops
reading as one build. Most creatures have *none* — they're kit+factor+attunement. Resource systems are the
*spice* that makes marquee species memorable.

### 6b. Architecture patterns worth adopting (from StSLib / BaseMod)
The library research surfaced two *engine-architecture* patterns that make a deep vocabulary tractable —
worth building into combat-v2 rather than special-casing ops:

1. **Modifier managers** (StSLib DamageModifier / BlockModifier). Instead of hard-coding multi-hit,
   ignore-block, matchup ×, Giant-splash, imbue, etc. as bespoke ops, a **hit carries a list of
   modifiers** that each hook `modifyOutgoingDamage` / `ignoresBlock` / `onUnblockedDamage`. Block is
   likewise a *typed* resource (some decays differently, some triggers on-consume — maps to our
   Block-as-temp-HP + Barricade + Shielding). Centralizing this (the §4 modifier hooks) is what keeps the
   **power-budget honest** — every multiplier composes in one place. **This should shape the op-registry
   refactor (build-order step ①).**
2. **"Can-negate" interception hooks** (StSLib `OnReceivePower`, `OnPlayerDeath`, `BetterOnApplyPower`).
   A power can *veto or alter* an incoming event: negate the next debuff (Ward/Cleanse), prevent lethal
   (Undying), halve an applied stack. This is exactly the shape the **subtype wild-card engine** needs —
   Undead's Undying, Hallowed's Ward, Mechanical's Poison-immunity are all "intercept + negate" passives
   on the §4 hooks. Build the hook dispatch to allow a subscriber to return a modified/vetoed event.

---

## 7. Cross-creature & formation scaling (uniquely ours)

StS is solo; we're squads. The axes above mostly scale *within* a creature, but our headline layer scales
*across* the squad — this is where "on steroids" becomes structural, not just bigger numbers:

- **Reaction payoff (D2)** — creature A lays a status (Soak/Poison/Bleed), squadmate B's element detonates
  it (`mechanics.md`). The strongest cross-creature axis; `onSquadReaction` hook.
- **Formation auras** — support units buff the vanguard (`applyFormationAuras`, built). Scaling: more/
  better support → bigger aura.
- **Owner-cast synergy (Option A)** — a card is cast by its owner's stats, so a fragile-but-high-FOC
  support can cast a status-applier from the protected back row while a bruiser fronts.
- **Element diversity** — a squad spanning attunements unlocks more reaction pairs; a mono-element squad
  hits harder into a matchup but is one-dimensional. A real deckbuilding tension at the *squad* layer.

These are engine features (mostly built), but the *generator* should be aware: a species' reaction-primer
statuses and its aura tags are part of what makes it valuable *in a squad*, beyond its solo deck.

---

## 8. The power-budget model (costing the palette)

Every op/keyword/status/axis above needs a **point value** so `value(card) ↔ energy × rarity` gates
everything. First-pass table (`REVIEW`; the sim harness self-tunes these — `§10`):

**Base op values** (per point of effect, at cost 1 ≈ 10 budget points):
- damage: **1.0 / pt** · block: **1.0 / pt** · heal: **1.2 / pt** (off-turn value) ·
- apply Vulnerable: **~2.2 / stack** · Weak: **~2.0** · Poison: **~2.0 / stack** (lifetime DoT) ·
  Burn: **~1.5 / stack·turn** · Empower(self): **~2.5 / stack** (multiplied by hits) ·
  Fortify: **~1.5 / stack** · draw: **~5 / card** · +energy: **~8 / point**.

**Multipliers / modifiers**:
- **Scope**: front ×1 · targeted ×1.1 · squad/AoE ×1.6 · field ×1.8.
- **Reach / Lock-on / Splash**: ×1.15 each.
- **Keyword downsides** (Exhaust/Ethereal/Fleeting): ×0.6–0.85 discount. **Upsides** (Innate/Retain/
  Persist/Refund): ×1.15–1.3 premium.
- **Category-2 scaling**: value = *expected* counter value over an average fight (sim-calibrated), not the
  theoretical max — this is why the sim loop matters (a Poison-double is worth its realistic, not infinite,
  payoff).
- **Category-3 powers**: value = per-fire value × expected fires over a fight (turns × trigger rate).
- **Conditional (Cat-5)**: value × P(condition true) — an Execute below-30%-HP bonus is discounted by how
  often it's live.

**The closed loop (Jeton's "automated balancing"):** the analytic budget gives a *fast estimate*; the
**simulation harness** (`balance:generation`) is *ground truth*. Mint N creatures, autoplay M fights,
measure per-card win-rate contribution + per-axis dominance, and **regress the point weights** so the
analytic budget predicts the sim. Cards/axes that over/under-perform get their weights nudged until the two
agree. That's how a *rich* vocabulary stays *balanced* without hand-costing every card.

---

## 9. Coverage map — every typing → its axes + signature effects

The generator's lookup table (condensed; the full number ranges live in the axis→effect mapping tables,
`synthesis-matrix-spec.md §7`, to be authored). Primary axis **bold**.

### Kits — Archetypes (Humanoid)
| Kit | Axes | Signature effects / system |
|---|---|---|
| Warrior | **A1 Empower**, H3 Block, stance-dance | Momentum, Plating, stance modes |
| Rogue | **B1/B2 tempo**, B4 0-cost | Double-Strike, Refund, combo payoffs |
| Mage | **A3/A4 + G3 X-cost**, D3 Amplify | Overload, ignition, X-cost nukes |
| Warlock | **G1 HP-cost + F1 summon**, H2 kills | Sacrifice, souls meter, summons |
| Priest | **E1 meter-burst**, Regen aura | Faith meter, Ward/Cleanse, smite |
| Shaman | **F2 field/totem**, D1 Soak | Totems tick, prime→spread |
| Ranger | **I1 Mark + B2**, Reach/Lock-on | Traps (delayed), Companion (F1) |
| Engineer | **H3 Barricade + F1 Construct**, A2 Fortify | Turrets, Buffer, Body-Slam |

### Kits — Families (Beast)
| Family | Axes | Signature |
|---|---|---|
| Mammalian | **B1/B2 tempo**, A1 | pursuit pressure |
| Reptilian | **H1/H3 ramp**, C1 | Plating, armored bite |
| Avian | **B4 + Reach**, tempo | evasive card flow |
| Piscine | **D1 Soak**, control | prime→devastate |
| Insectoid | **B3 multi-hit + C1 Poison** | fragile swarm |
| Amphibian | **Regen + C1**, versatile | sustain toxin |
| Draconic | **A4 + A1 + H1**, bulk | Breath (F2/AoE), Overload |

### Kits — Manifestations (Aberration)
| Manifestation | Axes | Signature |
|---|---|---|
| Eldritch | **I2 control (Confuse/fear)**, A3 | attack the mind |
| Construct | **H3 Barricade + F2 turret** | relentless wall |
| Ooze | **C1 + F3 split**, Temp-HP | engulf attrition |
| Flora | **C1 Poison + Regen**, Root | toxin + entangle |
| Crystalline | **A2 Fortify + Thorns** | reflective wall |
| Formless | **B4 + Ethereal + EVA** | immaterial spam |

### Attunements (13) — each owns its status + a slice of a DoT/prime/control axis
Physical→Bleed (C3) · Fire→Burn (C2) · Frost→Weak/Slow (I1) · Nature→Poison (C1) · Water→Soak (D1) ·
Air→Expose (I3) · Energy→Shock (C4/I2) · Stone→Fortify (A2) · Arcane→Amplify (D3/E1) · Shadow→Vulnerable
(I1/H2) · Holy→Regen (sustain) · Void→Decay (I3/G4) · Mind→Confuse (I2).

### Subtypes (11) — each owns a wild-card (mostly a resource-system or a double-edged axis)
Mechanical→Plating+card-mod · Elemental→ignition (E2) · Giant→Barricade/Splash (H3) · Demonic→Dread+HP-cost
(G1) · Undead→Undying+Temp-HP · Hallowed→Ward aura · Feral→low-HP frenzy (G2, can't Block) · Ancient→per-
round compound + carry-over (A4/H4) · Swarm→Legion count (F1/F3/B3) · Cursed→Curse-lay + self-clog ·
Spectral→Intangible/Ethereal/Reach.

### Factors — each is a small cluster nudging ONE axis (the intra-kit customization)
Claws→Bleed/B3 · Teeth/Maw→Execute/H2 · Venom/Spore→Poison/C1 · Shield/Shell→Block/A2 · Quills/Shard→Thorns
· Wings→EVA/Reach · Bow/Beak/Eye→Lock-on/Mark · Hammer→big/Splash · Dagger/Fist→tempo/B2 · Staff/Wand→FOC/
spells · Roots→Constrict · Breath/Miasma→AoE field.

---

## 10. Build order — what to implement from this

Feeds `card-pool-composition.md` build order (this doc = the content of its step ②). Sequencing:

1. **Effect category schema + op-registry expansion** — encode the six categories; bring the v2 op set up
   from ~5 ops to the full vocabulary (scaleBy counters, per-round powers on the §4 hooks, conditional
   predicates, the keyword set). The engine gap that makes generated cards bland.
2. **Status/hook engine** — implement the §3 statuses (intensity/duration/DoT families) + the §4 hook
   dispatch in `round.js`. Load-bearing for subtypes + powers.
3. **Power-budget module** — `value(effects)` from the §8 table; `value ↔ cost×rarity` validator every
   card passes. Wire into the editor (live budget meter) + `sanitizeForgedCard`.
4. **Axis→effect mapping tables** — the §9 coverage map as data: each typing → its axes → the effect
   motifs + number ranges it may roll. The generative ruleset (`synthesis-matrix-spec.md §7`).
5. **Resource-system engine (§6)** — the subtype/kit signature systems, authored bespoke (meter, ignition,
   summon, field, stance, card-mod). One per marquee species.
6. **Generation validation harness** (`balance:generation`) — mint across the axis space, autoplay, measure
   per-axis dominance + per-card win contribution, **regress the §8 weights** (the closed loop). Headless +
   a GUI "Forge Lab".

Do **1–3 before mass content** (the balance backbone), then **4–6** to turn the palette autonomous.

---

*Research provenance (five deep sweeps, 2026-07-15):*
- **StS1 base game** — all keywords, ~30 statuses (intensity/duration/DoT families), 21 build identities
  across the 4 characters, ~178 relics categorized by build-lever, the full trigger surface.
- **StSLib + BaseMod + ModTheSpire** — the shared modding stack: 11 keywords (Autoplay/Exhaustive/Fleeting/
  Grave/Persist/Purge/Refund/Retain/Snecko/Soulbound/Startup), the **DamageModifier/BlockModifier manager**
  architecture, the **can-negate** power/relic hooks (OnReceivePower/OnPlayerDeath/BetterOnApply), custom
  actions (Stun/Fetch/TempHP), BaseMod's subscriber event-bus, custom targeting.
- **Downfall's 9 villains + Hermit** — verbatim keyword text: Doom (conditional-persist), Soulburn (delayed
  burst), Goop/Consume/Potency/Split (Slime), 4-stance Skill-Bonus/Finisher (Champ), Encode/Compile
  (Automaton), Muddle/Overflow (Snecko), the Ghostflame Wheel + Intensity (Hexaghost), Reserve/Essence/Pyre
  (Collector), Conjure/Chant/Hex/Manaburn (Awakened), Gremlin multi-body swap, Guardian Mode/Stasis/Gems.
- **~40 custom-character mods** — novel resources: Snowballs (banked energy), TSP/Time-Stop (Servant),
  Notes/Melody (Bard), Summon/Tribute (Duelist), Remember/Clarity (Wanderer), Charge (Marisa), Poker-hand
  (Gambler), Packmaster's randomized-archetype draft, Posture (Vagabond), Spellboost/Enhance/Necromancy
  (Shadowverse), and the HP-as-resource / curse-fuel / dice families.
- **Novel-status & scaling-axis sweep** — the delayed-detonation debuff family, cyclic action-gated meters,
  positional-in-hand scaling, exponential build-and-dump, temp→permanent conversion, orb-system extensions.

Full raw reports archived in the session scratchpad. v1's engine was treated as a *reference*, not a port
source — this catalog is built from the source material above.*
