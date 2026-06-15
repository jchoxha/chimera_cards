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
 * A single weighted typing flag. A monster carries 1–3 of these and their
 * weights MUST sum to 1. The weights drive the card-pool draft distribution
 * (the "66% Fire / 33% Flying" rule from the spec).
 * @typedef {Object} TypeAffinity
 * @property {ElementType} type
 * @property {number} weight  Normalized 0..1; the set sums to 1.
 */

/** @typedef {'attack'|'skill'|'power'|'status'|'curse'} CardType */
/** @typedef {'basic'|'common'|'uncommon'|'rare'} CardRarity */

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
 * @property {number} [block]      Block granted to the user.
 * @property {number} [draw]       Cards drawn.
 * @property {number} [energy]     Energy gained.
 * @property {number} [strength]   Strength (Intensity buff) granted.
 * @property {Object<string, number>} [applyStatus]  Statuses applied to target, e.g. {burn:2}.
 * @property {Object<string, number>} [selfStatus]   Statuses applied to self.
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
 * @property {string} [text]          Display text (flavor/clarity).
 * @property {CardKeyword[]} [keywords]
 * @property {boolean} [upgraded]
 */

/**
 * A collectible/combatant creature. Supports up to 3 weighted typings.
 * @typedef {Object} Monster
 * @property {string} id
 * @property {string} name
 * @property {TypeAffinity[]} types   1–3 entries, weights sum to 1.
 * @property {number} hp              Current HP.
 * @property {number} maxHp
 * @property {Card[]} signatureCards  Cards this monster contributes to the deck.
 * @property {string} [artUrl]        Lazy-loaded, cloud-hosted (never bundled keys).
 * @property {Object} [meta]          Provenance: forged/fused/captured, creator id, etc.
 */

/**
 * Enemy intent shown during the explicit Intent Phase, before it resolves.
 * @typedef {'attack'|'block'|'buff'|'debuff'|'unknown'} IntentKind
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

/**
 * The full snapshot of an in-progress fight. The CombatManager mutates this.
 * @typedef {Object} CombatState
 * @property {CombatPhase} phase
 * @property {number} turn               1-based player turn counter.
 * @property {number} energy             Current energy this turn.
 * @property {number} energyPerTurn      Baseline energy gained each Draw Phase.
 * @property {number} handSize           Cards drawn each Draw Phase.
 * @property {Card[]} hand
 * @property {Card[]} drawPile
 * @property {Card[]} discardPile
 * @property {Card[]} exhaustPile
 * @property {Monster[]} party           Player's surviving team (≤3).
 * @property {number} activeIndex        Index of the front/active party monster.
 * @property {number} block              Player Block (resets each turn unless retained).
 * @property {StatusEffect[]} statuses   Player statuses.
 * @property {Enemy[]} enemies           Act left-to-right.
 * @property {RoomKind} room
 * @property {RarityState} rarity
 * @property {(e: CombatEvent) => void} [log]  Optional event sink for UI/animation.
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

/** @type {ReadonlyArray<CardRarity>} */
export const RARITIES = Object.freeze(['basic', 'common', 'uncommon', 'rare']);

export const PHASES = Object.freeze({
  DRAW: 'draw',
  PLAYER: 'player',
  DISCARD: 'discard',
  ENEMY_INTENT: 'enemyIntent',
  ENEMY: 'enemy',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});
