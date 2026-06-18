# Combat Engine Spec — Active Vanguard / "Peek" Action Economy

**Status: LOCKED 2026-06-17** (Jeton + Gemini executive sign-off). This is the
authoritative design for the `CombatManager` rebuild. It **supersedes** the
Phase 1 turn-cycle described in `src/engine/README.md` and the 1-v-1 prototype
combat in `App.jsx`/`fighter.js`. Code boilerplate (the `CombatState` typedefs)
is pending sign-off — see the bottom of this doc.

> Scope of this milestone: port the prototype's *playable* mechanics into the
> clean engine under the new action-economy model. Elemental **Reactions are
> frozen** (re-architected later); the **Reaction matrix is out of scope** here.

---

## 0. The shift in one paragraph

Combat moves from "one shared player deck + a single active monster that soaks
damage" to a **symmetrical Vanguard/Bench model**: each side fields one **active
Vanguard** backed by a **bench**, every monster carries **its own deck**, and
both sides run an **energy-based action economy**. The enemy plans a full
multi-action turn in advance (including mid-turn swaps); the player scouts that
plan with limited **Peek** charges.

---

## 1. Core State & System Constraints

### 1.1 Absolute typing cap — **exactly 1 or 2 types**
Every monster has **exactly 1 or 2 elemental types — never 0, never 3+.**
- **Engine change:** `MAX_TYPES` drops `3 → 2` in `MonsterParty.js`; the
  `Monster.types` typedef in `types.js` becomes "1–2 entries, weights sum to 1";
  all "≤3 weighted types" language in `README.md` is superseded.
- Weights still drive the combined-typing draft pools (`rarity.js` unchanged in
  principle; just fed 1–2 affinities per monster).

### 1.2 Symmetrical deck engine — enemies carry decks too
Both sides are modeled identically (`Fighter` + `Side`). Each monster owns its
own deck of `Card`s.
- **Elite/Boss** fights may use **uniquely scripted cards.** If such a monster
  is **captured**, its special cards **transfer into the player's collection**
  with it (provenance tracked in `Monster.meta`).
- Retires the old `MonsterParty.buildCombatDeck()` "merge all signatures into one
  shared pile" model: decks are **per-fighter**, not per-party.

### 1.3 Vanguard energy & action economy — symmetrical
- **Both sides energy / turn = `max(3, benchedCount)`** — 1 Energy per monster
  *resting on the bench* (excludes the active Vanguard), hard floor **3**. The
  player and enemy use the **exact same formula** (symmetrical energy scaling).
  `COMBAT_DEFAULTS.energyPerTurn` is the floor constant (3); no separate player
  baseline config is needed.

### 1.4 Full visibility
All monsters on both sides are inspectable: stats, typing, current HP are always
visible. (Future stealth/invisible statuses are the only planned exception.)
**Peek (§2) only hides the enemy's planned *actions*, never its roster/stats.**

---

## 2. Advanced "Peek" System

- **On-demand scouting:** the player spends a **Peek charge** to reveal a
  grayed-out **intent silhouette** at *any* point during their turn.
- **Default charges:** **3 per combat** (`peekCharges` in `CombatState`). Charges
  reset **per combat encounter only** — never per room.
- **Macro silhouettes:** at round start the enemy Vanguard's upcoming action
  string is telegraphed as abstract grayed shapes, e.g. `[Attack]➔[Swap]➔[Buff]`
  — rhythm visible, numbers/targets hidden.
- **Multi-Vanguard prediction:** the forecast covers the **entire upcoming enemy
  turn**, including the planned moves of **post-swap incoming Vanguards** within
  that same turn block.
- **Turn-wide intel:** tapping a silhouette reveals that slot's exact numbers /
  statuses / incoming-monster identity (`revealed: true` on that `PlannedAction`).
  **The revealed slot stays fully visible for the player's entire current turn** —
  it re-fogs only when a brand-new enemy turn plan is rolled (next round start, or
  after a forced mid-turn re-plan wipes the queue).
- **No refunds on disruption:** if a forced displacement mid-turn discards and
  re-rolls the intent queue, **no Peek charge is refunded**. The replacement queue
  arrives fully obscured; the player must spend fresh charges to scout it.
- **AI dependency:** the enemy AI must plan a *coherent multi-step turn ahead*
  (cards + mid-turn swaps + the follow-up moves of the incoming creature).

---

## 3. Targeting Scopes & Status Model

### 3.1 Scopes are per-card, not fixed
Individual card logic (and consumables, §3.3) declares each application's scope.
The **locked 18-token vocabulary** (single source of truth: `TARGET_SCOPES` in
`types.js`; structural `{side, zone, selection}` classification in
`combat/scopes.js`):

| Token | Reaches |
|---|---|
| `friendlyActiveTarget` / `enemyActiveTarget` | that side's Vanguard |
| `flexFriendlyTarget` / `flexEnemyTarget` | any single unit on that side |
| `anyActiveTarget` | either side's Vanguard |
| `anyTarget` | any single unit in play |
| `friendlyBenchOnlyTarget` / `enemyBenchOnlyTarget` | one benched unit |
| `selfOnlyTarget` | the casting monster only |
| `piercingFriendlyTarget` / `piercingEnemyTarget` | a bench unit, bypassing the Vanguard frontline |
| `wholeField` | every unit in play (both sides, all zones — inherently friendly-fire) |
| `wholeFriendlySide` / `wholeEnemySide` | all units on that side |
| `wholeFriendlyBench` / `wholeEnemyBench` | all benched units on that side |
| `otherFriendlySide` / `otherFriendlyBench` | that side/bench **excluding the caster** |

→ Statuses live in **two buckets**: **creature-bound** (on the `Fighter`) and
**slot-bound auras** (on `Side.fortifySlot`). The fortify slot is a **positional
spatial aura** — it is NOT addressed through `TargetScope`. Cards that generate
fortify-slot effects use a distinct `CardEffects.fortify` descriptor (block amount
+ duration defined by the card), keeping scope resolution and slot auras cleanly
separated.

### 3.2 Status rules
- **`Heal` is its own distinct keyword/effect** — *not* folded into Block or
  Regen.
- **Team Shield is eliminated.** No shared damage pool. **Block** is applied to
  specific targeting scopes (no global team shield layer). Damage absorption is
  now simply: **target's Block → target's HP.**
- **Block lifecycle (LOCKED):** Block is **creature-bound** and **preserved
  across mid-turn swaps** — a monster that retreats to the bench mid-turn **keeps
  its Block** (and the incoming Vanguard brings its own). Block does **not** clear
  on swap. Instead, **a side's creature Block decays to 0 at the start of that
  side's own turn** (StS-style, per-side) — every fighter on that side (vanguard
  *and* bench) resets together. Block made during your turn therefore **persists
  through the opponent's turn to defend**, then clears when your next turn begins;
  symmetrically, enemy Block defends against your following turn. **`fortifySlot`
  Block is the sole exception**: as a positional spatial aura it **escapes** the
  per-side decay entirely and persists on the slot for the card-defined duration.
- **Benched ticking:** creature-bound DoTs (**Burn, Poison, Decay**) and **Regen**
  continue to tick/process **regardless of bench position**, unless a card
  explicitly states a positional removal rule.
- **Tick timing (LOCKED):** **DoTs (Burn/Poison/Decay) resolve at the end of the
  *opponent's* turn** — i.e. a DoT you applied to the enemy burns at *your*
  turn-end; a DoT applied to you burns at the *enemy's* turn-end. **Regen resolves
  at the end of the *carrier's own* turn** (you heal up after acting). DoTs and
  Regen therefore tick at different moments.
- **Reactions FROZEN:** the prototype's elemental reaction matrix (Shatter,
  Combust, Conduct, …) is **out of scope** for this milestone; do not port it.

### 3.3 Flexible consumable scoping (potions & materials)
**Consumables — potions and materials — use the same flexible per-item
`TargetScope` system as cards.** Each consumable declares its own scope from the
locked 18-token vocabulary rather than a fixed application target; the same
scope-resolution path that cards use resolves a consumable's effect onto the
chosen unit(s). Consumables do NOT auto-lock to the active Vanguard — they can
target benched allies or affect entire rows depending on their declared scope.

---

## 4. Swap Mechanics & Hand Economics

- **Escalating manual swap cost:** within a single turn, the 1st manual swap
  costs **1 Energy**, the 2nd **2**, the 3rd **3**, … (`manualSwapsThisTurn`
  counter; next cost = counter + 1; resets each turn).
- **Hand symmetrical discard:** swapping **out** discards the outgoing Vanguard's
  hand; swapping **in** draws a **fresh hand from the incoming monster's own
  deck.**
- **Enemy AI** may **preview its benched monsters' hands** to make intelligent
  swap choices.
- **Opening placements are free** and resolve **before** the player has any
  context on the fight.
- **Boon triggers:** any **"when swapped in"** effect fires **every single time**
  that unit enters the Vanguard slot (not once per combat).
- **Benched inertia:** benched monsters take **no active actions**, but **can**
  be hit by bench-scoped card effects / statuses.

---

## 5. Displacement & Forced Swapping

- **Instant disruption & re-planning:** a move that forces an enemy swap
  mid-turn executes **immediately**; the enemy's **remaining planned actions are
  discarded and re-rolled** on the spot from the new Vanguard's hand/capabilities.
- **Empty-bench fizzle:** a forced displacement against a side with **no available
  bench** does nothing (the displacement fizzles), though other auxiliary text on
  the same card still resolves normally.
- **Death swaps:** when a Vanguard dies, replacement is **forced, immediate, and
  free.** The AI must pick the **optimal** surviving bench counter. Any remaining
  queued actions from the dead Vanguard are **lost.** *(Death/forced swaps do NOT
  increment `manualSwapsThisTurn`.)*
- **Player displacement choice:** every displacement card must explicitly declare
  whether the target is **random**, **chosen by the caster**, or **chosen by the
  opponent.**

---

## 6. Run Context & Milestone Boundaries

- **Remove +1 shared-element synergy:** delete the prototype rule granting +1
  Strength per shared team element.
- **Progressive capture tracking:** the player may attempt to capture **any
  number** of monsters per encounter; capture checks **scale harder per success.**
  For now just track the integer **`monstersCapturedThisFight`** in combat state.
- **Retire `combat.html`:** the legacy standalone combat demo is **dropped from
  project requirements.** Validation for this milestone is via **`node`
  smoke-tests** (`npm run test:engine`, `src/engine/content/__smoke__.mjs`).

---

## 7. Design rulings — ✅ ALL RESOLVED 2026-06-18

All §7 items are fully resolved and absorbed into the relevant sections above.
No open rulings remain before turn-behavior implementation.

| Item | Resolution |
|---|---|
| Energy formula (both sides) | §1.3 — symmetrical `max(3, bench)` for player and enemy |
| Block scope semantics | §3.2 — creature-bound, preserved on swap, decays per-side at the start of that side's own turn (StS-style) |
| `fortifySlot` behavior | §3.2 — positional spatial aura, escapes per-side decay, card-defined duration |
| DoT vs Regen timing | §3.2 — DoTs tick at opponent's turn-end; Regen ticks at carrier's own turn-end |
| Heal keyword | §3.2 — instant `effects.heal`, never ticks, never occupies a status slot |
| `wholeField` scope | §3.1 table — inherently always-all (both sides, all zones, friendly-fire) |
| Peek persistence & charges | §2 — turn-wide intel; no refund on disruption; resets per combat |
| `TargetScope` token set | §3.1 — locked **18-token** vocabulary (slot tokens dropped; fortify uses `CardEffects.fortify`) |
| Consumable scoping | §3.3 — same 18-token system as cards; no auto-lock to Vanguard |

---

## 8. `CombatState` interface mapping — ✅ BOILERPLATE LOCKED 2026-06-18

**Implemented as structural shells (no turn behavior):** typedefs in `types.js`;
factories in `combat/state.js` (`createFighter`/`createSide`/`createPlannedAction`/
`createCombatState`, resource baselines, 1–2 type cap, symmetrical bench energy);
scope vocabulary in `combat/scopes.js` (**18-token** table); validated by
`node src/engine/combat/__smoke__.mjs` (`npm run test:combat`). The legacy `Enemy`
typedef is retained `@deprecated` so the Phase-1 `CombatManager` keeps
type-checking until turn behavior is migrated.

The old engine `CombatState` was **asymmetric** (player has hand/piles/party;
enemies a flat `Enemy[]` with one `Intent` each). The rebuild makes it
**symmetrical** around `Side` + `Fighter`, with a forecasted enemy plan.

```
CombatState
├── phase, turn, room, rarity, log        (unchanged in spirit)
├── peekCharges: number                   (player resource, default 3)
├── monstersCapturedThisFight: number     (§6 progressive capture)
├── player: Side
├── enemy:  Side
└── enemyPlan: PlannedAction[]            (forecasted turn; reveal flags per slot)

Side  (symmetrical; player & enemy both)
├── fighters: Fighter[]                   (everything this side brought)
├── vanguardIndex: number                 (index of the active Vanguard)
├── energy, energyPerTurn                 (enemy = max(3, benchedCount))
├── manualSwapsThisTurn: number           (§4 escalating cost = counter + 1)
└── fortifySlot: { statuses, block }      (§3.1 slot-bound AURA, inherited on swap)

Fighter  (replaces the Monster/Enemy split)
├── id, name, types (1–2), hp, maxHp
├── block: number                         (creature-bound; rides swaps, decays at start of own side's turn)
├── statuses: StatusEffect[]              (CREATURE-bound; travel + tick on bench)
├── deck: { drawPile, discardPile, exhaustPile }   (per-monster)
├── hand: Card[]                          (populated only while Vanguard)
└── meta                                  (capture/forge provenance; scripted cards)

PlannedAction  (one slot of the enemy's forecasted turn)
├── silhouette: IntentKind                ('attack'|'block'|'buff'|'debuff'|'swap')
├── revealed: boolean                     (Peek flips this true)
├── actor: fighterId                      (which Vanguard performs it)
└── detail: { cardId?, value?, hits?, targetScope?, incomingFighterId? }
```

Locked `types.js` vocabulary (all boilerplate landed):
- `TargetScope` — **18-token** union (see §3.1 table). Fortify-slot effects use
  `CardEffects.fortify` (not a scope). Consumables reuse the same 18-token union.
- `CardEffects` — `dmg`, `hits`, `block`, `heal` (instant, §3.2), `draw`, `energy`,
  `strength`, `scope: TargetScope`, `displacement`, `applyStatus`, `selfStatus`,
  `fortify?: { block, duration }` (slot aura, escapes per-side block decay).
- `IntentKind` includes `'swap'`.
- `Card` includes `swapInBoon` (fires every Vanguard entry).
- `MAX_TYPES = 2`; `Monster.types` = 1–2 entries.
- Both sides use `energyRule: 'bench'` in `createSide` / `createCombatState`.

---

## 9. Turn execution model — ✅ LOCKED 2026-06-18

The turn-behavior implementation built over the §8 shells. Decisions below are
final; build target is the **engine validated by `node` smoke-tests** with
hand-authored fixtures (real-content wiring is a separate follow-up).

### 9.1 Canonical round loop (plan-before-draw)
1. **ROUND START / planning** — enemy AI computes its **entire turn as a resolved
   script** (`enemyPlan`) and stores it; shown as fogged silhouettes. Block decay
   is per-side (below), not here.
2. **PLAYER DRAW** — player Vanguard's Block decays to 0 (start of *its* side's
   turn); draw to hand size from the Vanguard's own deck.
3. **PLAYER** — play cards / spend Peek / swap (escalating cost) / use consumables.
4. **PLAYER END** — discard non-Retain hand → **enemy DoTs tick** + **player Regen
   ticks** → resolve deaths (forced free swap).
5. **ENEMY** — enemy Vanguard's Block decays to 0 (start of *its* turn); execute
   the planned script action-by-action. A player-forced displacement during step 3
   already re-rolled the remainder (§5).
6. **ENEMY END** — **player DoTs tick** + **enemy Regen ticks** → resolve deaths →
   loop to 1.

> `PHASES` values are reused as-is: the round simply *orders* them planning(reuse
> `ENEMY_INTENT`)→`DRAW`→`PLAYER`→`ENEMY`. No enum value change (keeps the legacy
> `CombatManager` intact); only usage order differs.

### 9.2 Enemy AI — version B (full multi-Vanguard lookahead)
The plan is a **fully-resolved script** generated at round start with the injected
RNG fixed, so **execution is deterministic replay**. The planner:
- Is **rule-based** with a hook for **named scripted sequences** (elites/bosses
  override the rules).
- May **preview benched hands** (§4) and, when it elects a swap, **simulates the
  incoming Vanguard's drawn hand and plans its follow-up actions** within the same
  turn block (the post-swap lookahead that distinguishes B from a shallow planner).
- Default v1 rule priority: lethal/burst that kills → swap if a benched monster has
  a type advantage on the player Vanguard → Block/Fortify if HP < ~40% → else
  highest-value attack.
- **Mid-turn re-plan:** a player-forced displacement discards the remaining script
  and re-runs the planner from the new Vanguard's state on the spot (§5). No Peek
  refund; the new slots arrive fogged (§2).

### 9.3 Effect resolution & scope
- **Scopes resolve to Fighters only.** `combat/scopes.js` `SCOPE_TABLE` has no
  `slot`-zone entries (the two slot tokens were dropped); `CardEffects.fortify`
  applies to the **caster's side's `fortifySlot`** directly, outside scope
  resolution.
- Single-selection scopes take a caller-supplied `targetId` (UI for the player,
  the planner's recorded choice for the enemy); `all`-selection scopes hit every
  living matching Fighter. Dead fighters (hp ≤ 0) are never valid targets.
- **Damage math (StS-grounded, per hit):** `(base + Strength)`, ×0.75 if attacker
  Weak, ×1.5 if target Vulnerable, floored, min 0 — applied **once per hit**.
  Absorption is **target Block → target HP** (no shared pool).
- **Live status set:** `burn`, `poison`, `weak`, `vulnerable`, `strength`, `regen`
  (timing per §3.2). Others are defined-but-inert this milestone.

### 9.4 Public manager API (player actions)
`play(cardId, { targetId })`, `swap(benchIndex)`, `peek(planIndex)`,
`useConsumable(itemId, { targetId })`, `endTurn()`. Consumables reuse the same
scope-resolution path as cards (§3.3). X-cost (`cost === -1`) spends all remaining
energy and scales the effect.

### 9.5 Scope boundaries this milestone
- **Capture:** track the `monstersCapturedThisFight` integer only — no capture
  mechanic, rewards, or run layer yet (§6).
- **RNG:** injected (seedable) for deterministic tests + future server authority.
- **Reactions:** still frozen (§3.2); not implemented.
