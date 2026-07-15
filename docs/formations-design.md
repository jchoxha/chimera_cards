# Formations & Squads — design + balance (combat-v2)

*Started 2026-07-14 (Jeton: "flesh out combat — formations & squads; why single squad vs separate;
start balancing so it's actually fun").*

## The problem this solves

Before this pass, formations were a **non-choice**: every squad got a flat 3 energy and only the
Vanguard cast, so Support creatures were dead weight and **more squads = strictly more energy, cards,
and actions** with no downside. The balance harness confirmed it — WIDE (6 solo squads) beat TALL
(2 trios) **100%** of the time. There was nothing to decide and nothing to balance.

## The model (LOCKED first cut)

A side fields 1–6 squads; a squad is 1 Vanguard (front) + up to 2 Support (back). Three levers make
wide-vs-tall a real, legible choice:

1. **Energy is ~constant per creature, not per squad.** `squadEnergyFor = max(2, liveMembers × 2)`
   → solo 2 · duo 4 · trio 6. Six creatures always yield ~12 total energy **regardless of formation**,
   so splitting no longer buys more actions. (`engine/battle/battle.js` `ENERGY_PER_MEMBER`/`ENERGY_MIN`.)
2. **Protection + resilience (the point of TALL).** Only the Vanguard is targetable by normal attacks;
   Support is reachable only by `reachesBack` cards. A squad dies only when *all* members do — lose the
   Vanguard and a Support auto-promotes, so tall **degrades gracefully** while wide **shatters** (killing
   one solo squad deletes its whole energy share).
3. **Support contributes two ways (HYBRID).**
   - **Passive aura** — each living Support empowers its Vanguard by its build: a defensive support
     hardens the front (`+AURA_DEFENSE`), an offensive one sharpens it (`+AURA_ATTACK`). Recomputed each
     round in `applyFormationAuras` (base stats → effective `stats`); surfaced to the UI as a pip.
   - **Active casting** — the player can choose which live squad member casts a queued card (the caster
     picker); a Support casts the squad's shared cards using **its own** stats, from the safety of the
     back row. (`battleStore.casters` / `setCaster`; owner = chosen caster.)

### The tradeoff (6 creatures, ~12 energy either way)

| Formation | Fronts exposed | Backline | Character |
|---|---|---|---|
| **Wide** (6 solos) | 6 (all fragile) | none | Spreads enemy focus, most hands/flexibility, brittle |
| **Duos** (3×2) | 3 | 3 protected | The balanced middle |
| **Tall** (2 trios) | 2 (hardened) | 4 protected | Durable, concentrated, protected casters, fewer angles |

## Balance harness (`npm run balance:formations`)

An abstract-but-faithful sim isolating the formation economy from deck RNG: both sides identical
creatures, greedy focus-fire, only fronts targetable, auto-promote. Mirrors calibrate to ~50/50.
After the per-creature-energy fix + auras (6/5):

```
WIDE vs TALL   P 70% · E 30%      DUOS vs TALL   ~52/48
DUOS vs WIDE   ~30/70             mirrors        ~50/50
```

Wide is still favored **in the crude focus-fire sim**, but this is a **lower bound for tall** — the bot
doesn't value tall's real advantages (protected backline casters surviving to out-value, resilience,
performance vs single-target enemies/AoE). The formation is now a genuine choice, not a dominant
strategy. Numbers are tunable: `ENERGY_PER_MEMBER`, `AURA_DEFENSE`, `AURA_ATTACK`.

## Update — Option A shipped (owned cards, shared hand; v3.158.0)

Cards are now **owned by a creature** (`inst(id, ownerId)`); a squad's deck is each member's
`personalDeck` combined and drawn into ONE shared hand on shared squad energy. A card is **cast by
its owner** (`queueCard`/`enemyPlan`/`autoPlan` resolve owner → its stats apply, so a Support casts
from the protected back row); a **dead owner's cards are unplayable**. UI: each hand card gets an
owner-colour tab + greys out when its creature falls; the old manual "Cast with" picker is gone
(casting is automatic by owner) and the bottom strip now shows the squad roster (members · vanguard
aura · fallen). `PERSONAL_DECK` is still a generic starter — the seam for real kit decks below.

## Update — real KIT decks shipped (v3.159.0)

`personalDeck(unit)` now builds from the creature's real biology/typing KIT: `engine/battle/kitDeck.js`
`kitDeckFor(creature)` runs the v1 generator (`pools.potentialPool` → `run.starterDeck`, reskinned to
the creature's attunement) and ADAPTS each v1 CardSpec into a v2 card the round resolver understands
(keeps damage/block/heal/debuff/buff; drops unsupported ops like draw/energy; infers scope/priority;
falls back to a generic element-flavoured starter if a creature has no kit). Verified: Nightveil (Rogue/
Shadow) draws Shiv/Dagger/Backstab/Dodge, Ironhide (Warrior/Physical) Cleave/Guard/Pommel Strike,
Voltfang (Beast/Physical+Energy) Pursuit/Bite — and a full round resolves. So "which creatures do I
group?" is now a genuine deckbuilding decision.

## Next steps

- **Reward/creature-level card assignment** — `grantCard` accepts an `ownerId`; wire the reward
  overlay to pick which creature in the squad receives the card (defaults to the Vanguard today).
- **Bring more kit ops to life in the v2 engine** — `draw`/`energy` (and inert statuses like
  weak/strength/vulnerable) are currently dropped; implementing them would let kit cards land at full
  fidelity instead of adapted-down.
- **Formation-synergy cards** + smarter enemy AI, then re-tune the balance harness with varied stats.
- **Formation-specific cards/synergies** (shared-element squad bonus, "phalanx" cards that scale with
  Support count, back-row-only cards).
- **Smarter enemy AI** that also uses support-casting + formations, then re-run the harness with varied
  stats (not just identical creatures) to tune enemy encounters for the run.
- Consider a modest solo-energy floor bump if playtest says 2 energy feels stingy (trades a little
  wide-favoring for feel).
