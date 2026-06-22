// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/types — the shared type vocabulary for the engine    ║
// ║ UPDATE WHEN: any core data shape changes (Monster/Card/CombatState).║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Phase 1 keeps the existing JS stack, so the spec's "TypeScript interfaces"
// are expressed as JSDoc @typedefs. They give full editor type-checking today
// and convert 1:1 to real `.ts` interfaces when we add the Phaser view layer.
//
// These are pure descriptions — no runtime code except the small frozen enums
// at the bottom, which are the single source of truth the engine imports.

/**
 * The 16 canonical elements (kept identical to the existing game data so the
 * current monster/move content drops straight in). A monster's "typing" in the
 * new 3-type matrix is drawn from this set.
 * @typedef {'pyre'|'frost'|'hydro'|'charge'|'aero'|'stone'|'metal'|'crystal'
 *   |'toxin'|'flora'|'beast'|'lumen'|'aether'|'umbra'|'void'|'blood'} ElementType
 */

/**
 * A single weighted typing flag. A monster carries EXACTLY 1–2 of these (never
 * 0, never 3+ — the locked "absolute typing cap", combat-engine-spec §1.1) and
 * their weights MUST sum to 1. The weights drive the card-pool draft
 * distribution (the "66% Fire / 33% Flying" rule from the spec).
 * @typedef {Object} TypeAffinity
 * @property {ElementType} type
 * @property {number} weight  Normalized 0..1; the set sums to 1.
 */

/**
 * The locked targeting-scope vocabulary (combat-engine-spec §3 / §7.6). Every
 * card/consumable declares one of these; the scope decides which side, zone,
 * and unit(s) an effect resolves onto. Pure vocabulary here — the structural
 * side/zone classification lives in `combat/scopes.js` (no behavior yet).
 *
 * - `friendlyActiveTarget` / `enemyActiveTarget` — that side's Vanguard.
 * - `flexFriendlyTarget` / `flexEnemyTarget`     — any single unit on that side.
 * - `anyActiveTarget`                            — either side's Vanguard.
 * - `anyTarget`                                  — any single unit in play.
 * - `friendlyBenchOnlyTarget` / `enemyBenchOnlyTarget` — one benched unit.
 * - `selfOnlyTarget`                             — the casting monster only.
 * - `piercingFriendlyTarget` / `piercingEnemyTarget` — bench unit, bypassing the
 *                                                  Vanguard frontline.
 * - `wholeField`                                 — every unit in play (both sides,
 *                                                  all zones; inherently friendly-fire).
 * - `wholeFriendlySide` / `wholeEnemySide`       — all units on that side.
 * - `wholeFriendlyBench` / `wholeEnemyBench`     — all benched units on that side.
 * - `otherFriendlySide` / `otherFriendlyBench`   — friendly side/bench EXCLUDING
 *                                                  the caster.
 *
 * NOTE: The fortify slot (`Side.fortifySlot`) is NOT addressed through TargetScope.
 * Cards that generate slot auras use `CardEffects.fortify` (spec §3.1 / §3.2).
 * @typedef {'friendlyActiveTarget'|'enemyActiveTarget'|'flexFriendlyTarget'
 *   |'flexEnemyTarget'|'anyActiveTarget'|'anyTarget'|'friendlyBenchOnlyTarget'
 *   |'enemyBenchOnlyTarget'|'selfOnlyTarget'|'piercingFriendlyTarget'
 *   |'piercingEnemyTarget'|'wholeField'|'wholeFriendlySide'|'wholeEnemySide'
 *   |'wholeFriendlyBench'|'wholeEnemyBench'|'otherFriendlySide'
 *   |'otherFriendlyBench'} TargetScope
 */

/** @typedef {'attack'|'skill'|'power'|'status'|'curse'} CardType */
/**
 * Card rarity — UNIFIED onto the 7-tier monster ladder (synthesis-matrix-spec
 * §14.7) plus `basic` (starter cards: free, never appear in loot).
 * @typedef {'basic'|'common'|'uncommon'|'rare'|'epic'|'mythic'|'legendary'|'godly'} CardRarity
 */

/**
 * Card keywords from StS2 we model in the turn cycle. Stored as a string set on
 * a card; the CombatManager reads them during draw/discard/play resolution.
 * @typedef {'exhaust'|'ethereal'|'innate'|'retain'|'replay'|'unplayable'} CardKeyword
 */

/**
 * The deterministic mechanical payload of a card. Flavor (name/art/text) is
 * AI-generated; everything here is engine-owned and budget-constrained.
 * @typedef {Object} CardEffects
 * @property {number} [dmg]        Damage dealt to the target.
 * @property {number} [hits]       Number of damage instances (default 1).
 * @property {number} [block]      Block granted to the target (creature-bound).
 * @property {number} [heal]       HP restored instantly (distinct from Regen; never ticks; spec §3.2).
 * @property {number} [draw]       Cards drawn.
 * @property {number} [energy]     Energy gained.
 * @property {number} [strength]   Strength (Intensity buff) granted.
 * @property {TargetScope} [scope] Targeting scope (18-token locked vocabulary; spec §3.1).
 * @property {Displacement} [displacement]  Forced-swap descriptor (spec §5).
 * @property {{ block: number, duration: number }} [fortify]  Fortify-slot aura: applies a
 *                                            slot-bound Block for `duration` turns. Escapes
 *                                            per-side creature-block decay (spec §3.2 / §3.1).
 * @property {Object<string, number>} [applyStatus]  Statuses applied to target, e.g. {burn:2}.
 * @property {Object<string, number>} [selfStatus]   Statuses applied to self.
 */

/**
 * A forced-swap (displacement) descriptor. `chooser` must be explicit on every
 * displacement card (spec §5). An empty target bench fizzles the displacement.
 * @typedef {Object} Displacement
 * @property {'random'|'caster'|'opponent'} chooser  Who selects the incoming unit.
 */

/**
 * @typedef {Object} Card
 * @property {string} id              Stable identifier (also the art manifest key).
 * @property {string} name
 * @property {CardType} cardType
 * @property {CardRarity} rarity
 * @property {number} cost            Energy cost. -1 = X-cost, -2 = unplayable.
 * @property {ElementType|null} element  Element for draft-pool weighting; null = colorless.
 * @property {CardEffects} effects
 * @property {CardEffects} [swapInBoon]  "When swapped in" effects; fire EVERY time
 *                                       the owner enters the Vanguard slot (spec §4).
 * @property {string} [text]          Display text (flavor/clarity).
 * @property {CardKeyword[]} [keywords]
 * @property {boolean} [upgraded]
 */

/**
 * A collectible/combatant creature. Carries EXACTLY 1–2 weighted typings.
 * @typedef {Object} Monster
 * @property {string} id
 * @property {string} name
 * @property {TypeAffinity[]} types   1–2 entries, weights sum to 1.
 * @property {number} hp              Current HP.
 * @property {number} maxHp
 * @property {Card[]} signatureCards  Cards this monster contributes to the deck.
 * @property {string} [artUrl]        Lazy-loaded, cloud-hosted (never bundled keys).
 * @property {Object} [meta]          Provenance: forged/fused/captured, creator id, etc.
 */

/**
 * Enemy intent shown during the explicit Intent Phase, before it resolves.
 * `swap` telegraphs a planned mid-turn Vanguard swap (spec §2).
 * @typedef {'attack'|'block'|'buff'|'debuff'|'swap'|'unknown'} IntentKind
 * @typedef {Object} Intent
 * @property {IntentKind} kind
 * @property {number} [value]   e.g. damage amount; for 'attack' shown as N (xHits).
 * @property {number} [hits]
 */

/**
 * @typedef {Object} StatusEffect
 * @property {string} id        e.g. 'burn', 'poison', 'weak', 'vulnerable', 'strength'.
 * @property {number} amount    Stacks (Intensity) or remaining turns (Duration).
 * @property {'intensity'|'duration'|'counter'} stacking
 */

/**
 * @deprecated Legacy Phase-1 enemy shape (asymmetric model). The Vanguard/Peek
 * rebuild unifies player & enemy units under `Fighter` (below). Retained only so
 * the legacy `CombatManager` keeps type-checking until turn behavior is migrated.
 * @typedef {Object} Enemy
 * @property {string} id
 * @property {string} name
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} block
 * @property {StatusEffect[]} statuses
 * @property {Intent} intent           Current telegraphed intent.
 */

/** @typedef {'draw'|'player'|'discard'|'enemyIntent'|'enemy'|'victory'|'defeat'} CombatPhase */

/** @typedef {'combat'|'elite'|'shop'|'boss'} RoomKind */

/**
 * Adaptive "Pity Offset" rarity state (StS2-grounded). See cards/rarity.js.
 * @typedef {Object} RarityState
 * @property {number} offset      Current additive offset, starts -0.05, caps +0.40.
 * @property {boolean} ascension7 If true, increment is +0.5% and base chances ~halve.
 */

// ── Vanguard/Peek symmetrical combat shapes (combat-engine-spec §8) ──────────

/**
 * A monster's own card zones. Each Fighter owns its deck (per-monster decks, not
 * a shared party pile). Only the Vanguard has a populated `hand`.
 * @typedef {Object} FighterDeck
 * @property {Card[]} drawPile
 * @property {Card[]} discardPile
 * @property {Card[]} exhaustPile
 */

/**
 * A unit in combat — the unified replacement for the old Monster/Enemy split.
 * Used identically on both sides.
 * @typedef {Object} Fighter
 * @property {string} id
 * @property {string} name
 * @property {TypeAffinity[]} types   EXACTLY 1–2 (the absolute typing cap, §1.1).
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} block           Creature-bound; rides mid-turn swaps, decays
 *                                    at the start of its own side's turn (per-side,
 *                                    StS-style; spec §3.2). Not slot-bound.
 * @property {StatusEffect[]} statuses Creature-bound; travel with the unit to the
 *                                    bench and keep ticking there. DoTs resolve at the
 *                                    opponent's turn-end, Regen at the carrier's own
 *                                    turn-end (spec §3.2).
 * @property {FighterDeck} deck        This unit's own draw/discard/exhaust piles.
 * @property {Card[]} hand             Populated only while this unit is the Vanguard.
 * @property {Object} [meta]           Provenance: captured/forged/scripted-cards, etc.
 */

/**
 * The slot-bound Fortify aura zone. Stays on the Vanguard SLOT and is inherited
 * by whoever swaps into it (spec §3.1 `vanguardFriendly/EnemySlotTarget`).
 * @typedef {Object} FortifySlot
 * @property {StatusEffect[]} statuses  Slot auras inherited on swap.
 * @property {number} block             Slot-scoped Block (distinct from creature Block).
 */

/**
 * One combatant side. Player and enemy are modeled IDENTICALLY (symmetrical).
 * @typedef {Object} Side
 * @property {Fighter[]} fighters         Everything this side brought to the fight.
 * @property {number} vanguardIndex       Index into `fighters` of the active Vanguard.
 * @property {number} energy              Current energy this turn.
 * @property {number} energyPerTurn       Baseline; enemy uses max(3, benchedCount) (§1.3).
 * @property {number} handSize            Cards drawn when a unit becomes Vanguard.
 * @property {number} manualSwapsThisTurn Escalating-cost counter; next swap = counter+1 (§4).
 * @property {FortifySlot} fortifySlot    Slot-bound aura zone (inherited on swap).
 */

/**
 * One slot of the enemy's forecasted turn (the Peek intent queue, §2). Shown as a
 * grayed silhouette until a Peek charge flips `revealed` true.
 * @typedef {Object} PlannedAction
 * @property {IntentKind} silhouette   Abstract shape shown while hidden.
 * @property {boolean} revealed        Peek reveals exact `detail`.
 * @property {string} actor            Fighter id performing the action.
 * @property {Object} [detail]         { cardId?, value?, hits?, scope?, incomingFighterId? }
 */

/**
 * The full snapshot of an in-progress fight (symmetrical Vanguard/Peek model).
 * The CombatManager mutates this. Replaces the asymmetric Phase-1 snapshot.
 * @typedef {Object} CombatState
 * @property {CombatPhase} phase
 * @property {number} turn                     1-based player turn counter.
 * @property {Side} player                     Player side.
 * @property {Side} enemy                       Enemy side.
 * @property {PlannedAction[]} enemyPlan        Forecasted enemy turn (with reveal flags).
 * @property {number} peekCharges               Remaining Peek charges (default 3, §2).
 * @property {number} monstersCapturedThisFight Progressive-capture counter (§6).
 * @property {RoomKind} room
 * @property {RarityState} rarity
 * @property {(e: CombatEvent) => void} [log]   Optional event sink for UI/animation.
 */

/**
 * @typedef {Object} CombatEvent
 * @property {string} type   e.g. 'phase', 'damage', 'block', 'status', 'draw', 'death'.
 * @property {any} [payload]
 */

// ── Frozen enums: the only runtime exports; single source of truth ──────────

/** @type {ReadonlyArray<ElementType>} */
export const ELEMENTS = Object.freeze([
  'pyre', 'frost', 'hydro', 'charge', 'aero', 'stone', 'metal', 'crystal',
  'toxin', 'flora', 'beast', 'lumen', 'aether', 'umbra', 'void', 'blood',
]);

/**
 * The full card-rarity ladder (synthesis-matrix-spec §14.7), unified with the
 * prototype's monster ladder. `basic` = starter cards (free, non-loot).
 * @type {ReadonlyArray<CardRarity>}
 */
export const RARITIES = Object.freeze([
  'basic', 'common', 'uncommon', 'rare', 'epic', 'mythic', 'legendary', 'godly',
]);

/** The loot tiers only (the monster ladder, ascending) — `basic` excluded. */
export const LOOT_RARITIES = Object.freeze([
  'common', 'uncommon', 'rare', 'epic', 'mythic', 'legendary', 'godly',
]);

/**
 * Deck-point cost per rarity for the open-world rarity-weighted deck budget
 * (synthesis-matrix-spec §14.6 — costs are REVIEW/tunable). `basic` is free.
 * @type {Readonly<Record<CardRarity, number>>}
 */
export const RARITY_POINTS = Object.freeze({
  basic: 0, common: 1, uncommon: 2, rare: 3, epic: 4, mythic: 5, legendary: 6, godly: 7,
});

/**
 * The locked targeting-scope vocabulary — single source of truth for the
 * `TargetScope` union above (combat-engine-spec §3 / §7.6). `combat/scopes.js`
 * classifies each into a structural {side, zone} descriptor.
 * @type {ReadonlyArray<TargetScope>}
 */
export const TARGET_SCOPES = Object.freeze([
  'friendlyActiveTarget', 'enemyActiveTarget',
  'flexFriendlyTarget', 'flexEnemyTarget',
  'anyActiveTarget', 'anyTarget',
  'friendlyBenchOnlyTarget', 'enemyBenchOnlyTarget',
  'selfOnlyTarget',
  'piercingFriendlyTarget', 'piercingEnemyTarget',
  'wholeField',
  'wholeFriendlySide', 'wholeEnemySide',
  'wholeFriendlyBench', 'wholeEnemyBench',
  'otherFriendlySide', 'otherFriendlyBench',
  // 18 tokens total. Fortify-slot effects use CardEffects.fortify, not a scope token.
]);

export const PHASES = Object.freeze({
  DRAW: 'draw',
  PLAYER: 'player',
  DISCARD: 'discard',
  ENEMY_INTENT: 'enemyIntent',
  ENEMY: 'enemy',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});
