# Engine core — Phase 1

> ⚠️ **Partly superseded.** The combat model is being rebuilt to the LOCKED
> **Active Vanguard / Peek action-economy** design — see
> [`docs/combat-engine-spec.md`](../../docs/combat-engine-spec.md). That spec
> overrides the turn-cycle and several constraints documented below: monsters
> now have **exactly 1–2 types** (not ≤3), each monster carries **its own deck**
> (no shared party deck), Team Shield is removed, the Reaction matrix is frozen,
> and combat is **symmetrical** (`Side`/`Fighter`, both sides run energy). Read
> the spec before editing `combat/`. The text below still describes the *current*
> Phase 1 code until the rebuild lands.

The framework-agnostic base mechanics for the creature deckbuilder. Pure game
logic: **no React, no renderer, no network coupling.** The React app today (and
the planned Phaser view + Zustand store + serverless backend) all sit *on top*
of this and read its state.

> Stack note: per the current decision we stay on the existing **Vite + JS**
> stack for now, so the spec's "TypeScript interfaces" are written as rigorous
> **JSDoc `@typedef`s** in `types.js`. They type-check in-editor today and map
> 1:1 to real `.ts` interfaces when we add Phaser. Renderer choice = **Phaser**
> (deferred — none of Phase 1 depends on it).

## File structure map

```
src/engine/
├── index.js              Barrel export.
├── types.js              Shared vocabulary: Monster (≤3 weighted types), Card,
│                         CombatState, Enemy, Intent, StatusEffect + frozen enums.
├── GameEngine.js         Run orchestrator: owns party, run-level pity state,
│                         RNG, AI handle; builds CombatManagers per room.
├── combat/
│   └── CombatManager.js  THE turn cycle (Draw→Player→Discard→Intent→Enemy),
│                         energy/hand/block, status system, reward generation.
├── cards/
│   ├── CardDeck.js       Draw/hand/discard/exhaust zones, shuffle, reshuffle,
│   │                     Innate/Retain/Ethereal handling.
│   └── rarity.js         Adaptive "Pity Offset" rarity engine + combined-typing
│                         weighted draft pools.
├── party/
│   └── MonsterParty.js   ≤3 monsters, the 3-type matrix, combined typing
│                         distribution, combat-deck assembly.
└── ai/
    └── AIPipeline.js     Serverless connector (forge/fuse/art). Keys NEVER
                          client-side; Flavor(AI) vs Mechanics(engine) split;
                          local deterministic BudgetTemplate.
```

## How the required modules map to the spec

| Spec ask | Where |
|---|---|
| `GameEngine`, `CombatManager`, `CardDeck`, `MonsterParty`, `AIPipeline` modules | the files above |
| Interface types `Monster` (≤3 types), `Card`, `CombatState` | `types.js` |
| StS turn cycle: Energy, hands, Draw/Player/Discard/Enemy-Intent phases | `combat/CombatManager.js` |
| Adaptive Pity Offset rarity engine (−5% start, +1%/miss, +0.5% on Asc7, +40% cap, reset on rare, boss always rare) | `cards/rarity.js` |
| 3-type matrix + card pool weighted by combined party typings | `MonsterParty.combinedTypeWeights()` → `rarity.draftCards()` |
| Flavor (AI) vs Mechanics (deterministic) separation; no client keys | `ai/AIPipeline.js` + `budgetFor()` |

## Turn cycle (CombatManager)

```
startCombat()  → opening hand (Innate first) + telegraph intents → startPlayerTurn()
startPlayerTurn()  [Draw]    refill energy, block→0, tick burn/poison, draw handSize
playCard(card,{enemyId})     spend energy (X-cost spends all), resolve effects,
                             exhaust|discard; auto-checks victory
endPlayerTurn()    [Discard] discard hand (Retain keeps, Ethereal exhausts),
                             tick end-of-turn (regen, duration debuffs)
   → _enemyTurn() [Intent→Enemy]  each living enemy, left→right: block→0, tick
                             DoT, resolve telegraphed intent; re-telegraph
   → loop to startPlayerTurn() until VICTORY or DEFEAT
```

Statuses modeled in Phase 1: `strength` (intensity, +attack dmg), `weak`
(−25% dealt), `vulnerable` (+50% taken), `burn`/`poison` (start-of-turn DoT,
decrement), `regen` (end-of-turn heal, decrement). Damage math lives in
`computeAttackDamage()`.

## Injection points (kept out of the engine on purpose)

- **`rng`** — every random source is injectable for deterministic tests and
  server-authoritative multiplayer.
- **`enemyAI(enemy, state, rng)`** — chooses/telegraphs intents.
- **`pickCard(rarity, type, rng)`** — resolves a concrete card from the database
  for rewards; keeps the engine independent of content.
- **`log(event)`** — CombatEvent sink for the view layer to animate.

## Not yet in Phase 1 (next phases)

Map/path graph & `Sanctuary` meta-progression, multiplayer ghost data &
Hologram clones, the Community DNA registry, Zustand store wiring, and the
Phaser render layer. Orbs/Stars/Summon and the full keyword set are stubs to be
filled as content needs them.
