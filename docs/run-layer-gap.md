# StS Framework Gap Analysis — what we need to "make the game whole"

> Benchmark: **Slay the Web** (oskarrough/slaytheweb) — a clean, documented JS StS
> engine (state-manager + action queue/undo, dungeon graph, rooms, powers, intents,
> card upgrades, rewards). Goal: identify every core StS-roguelike system the **new
> Chimera engine** is missing, then build the foundation so we can layer StS content on top.

## TL;DR

Our **combat** is actually deeper than Slay the Web's (Vanguard+Bench, per-monster decks,
stances, the full mod-#69 effect vocabulary, 3-axis matchups, Peek). What we're missing is
the **entire RUN / META layer** — combat is currently a standalone sandbox. The legacy
*prototype* (`index.html`) has a run layer (map/save/artifacts) but it's bolted to the OLD
combat; the **new engine has none of it**.

## System-by-system status (new engine)

| StS / Slay-the-Web system | Chimera (new engine) | Gap |
|---|---|---|
| Turn-based combat, HP, Block, energy | ✅ `VanguardManager` (richer: Vanguard/Bench, stances) | — |
| Card piles (draw/hand/discard/exhaust) | ✅ `deckOps` per fighter | — |
| Powers / buffs / debuffs (decay per turn) | ✅ statuses (burn/poison/weak/vulnerable/strength/regen/dexterity…) | — |
| Monster intents | ✅ + **Peek** (forecast) | — |
| Card defs (type/cost/target/effects/upgrade) | ✅ CardSpec + registry (triggers/conditions/scaling) | **upgrade fn ✗** |
| **Card upgrades** | ✗ (`upgraded` flag in typedef, no logic) | **MISSING** |
| **Potions / consumables** | ✗ (`useConsumable` stubbed → false) | **MISSING** |
| **Relics / artifacts** (run-long passives) | ✗ in engine (prototype has `data/artifacts.js`) | **MISSING** |
| **Card rewards → added to a deck** | ✗ rewards are display-only (`generateReward`) | **MISSING** |
| **Persistent deck across fights** | ✗ each combat builds a fresh deck | **MISSING** |
| **Run state** (HP carry, gold, relics, potions, deck, position) | ✗ | **MISSING (core)** |
| **Map / Act graph** + node navigation | ✗ in engine (prototype `systems/map.js`) | **MISSING (core)** |
| **Room types** beyond combat (rest/campfire, shop, event, treasure, elite, boss) | ✗ (only a `room` *label* on combat state) | **MISSING (core)** |
| **Gold** economy | ✗ | **MISSING** |
| **Save / load a run** | ✗ engine (prototype `systems/save.js`); combat state is serializable | **MISSING** |
| **Seed / deterministic RNG** | ⚠️ `rng` is injectable but not run-seeded | partial |
| **Win/lose run + act progression** | ✗ (combat has victory/defeat only) | **MISSING** |
| Ascension / difficulty modifiers | ✗ (`rarity.ascension7` flag unused) | later |

## Architecture note

Slay the Web uses an **action-descriptor queue** (`{type:'dealDamage',…}` objects applied
by a manager, with past/future for **undo/replay**). Ours **mutates `CombatState` in place**
via `VanguardManager` (no undo/replay). For a single-player roguelike that's fine, but the
descriptor pattern would help later for **replays + multiplayer sync** (our long-term goal).
Decision below.

## Proposed build order — the "make whole" foundation

A **Run layer** wrapping the existing combat engine. Each piece is a tested module like
the combat work.

1. **Run state + RunManager** (`src/engine/run/`): persistent `{ deck, fighters/party, hp,
   gold, relics, potions, map, position, seed, rng }`; seeded RNG for the whole run; combat
   results flow back (HP carry, rewards). The spine everything hangs off.
2. **Map / Act graph** (port/adapt `systems/map.js`): node graph with paths + room types
   (start, combat, elite, boss, event, shop, rest, treasure); navigation = pick a reachable node.
3. **Card reward → deck** : victory offers 3 cards (already drafted) → chosen card added to
   the run deck; "skip" allowed. Makes deckbuilding real.
4. **Card upgrades**: an `upgrade` transform per CardSpec (number bumps / cost / keyword);
   used by rest sites + rewards. (Editor can author the upgraded variant.)
5. **Non-combat rooms**: **Rest** (heal / upgrade a card), **Treasure** (relic), **Shop**
   (spend gold on cards/relics/potions), **Event** (data-driven choice → outcomes).
6. **Relics + Potions** in the engine: relics = run-long passives (reuse the trigger/passive
   system!); potions = one-shot consumables (wire `useConsumable` to the effect interpreter).
7. **Gold** economy (combat/elite/event rewards → shop sink).
8. **Save / load run** (serialize run state) + **win/lose run** (boss → act clear → next act;
   party wipe → run over).
9. *(Later)* Ascension modifiers; the action-queue/undo refactor if we adopt it.

## Reusable assets already in the repo (legacy prototype)
- `src/systems/map.js` (dungeon + overworld graph) — adapt for the engine run layer.
- `src/systems/save.js` (save/load) — pattern to reuse.
- `src/data/artifacts.js` (relics), `items.js` (potions/consumables), `quests.js` (events),
  `forge.js` (rarity rolls) — content to port into engine shapes.

## Forks to decide
- **A — Architecture:** keep in-place mutation (faster now) vs adopt the action-descriptor
  queue + undo (more work, but replay/multiplayer-friendly). *(Rec: keep in-place now; the
  combat event stream already gives us a replay log; revisit for multiplayer.)*
- **B — First milestone:** the **Run skeleton** (run state + a linear/branching map + combat
  rooms + card-reward-to-deck + HP carry) end-to-end before relics/shops/events — i.e. a
  minimal but *complete loop* you can play from start to a boss. *(Rec: yes.)*
- **C — Map shape:** full StS branching act (6–15 floors, multiple paths, elite/boss/?) vs a
  short linear act first. *(Rec: short branching act now, expand later.)*
