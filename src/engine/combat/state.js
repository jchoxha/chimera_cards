// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/state — symmetrical Vanguard/Peek state       ║
// ║ shells (combat-engine-spec §8). Pure STRUCTURAL factories.          ║
// ║ UPDATE WHEN: the Fighter / Side / PlannedAction / CombatState shape  ║
// ║ or the initial resource baselines change.                           ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Phase 1 boilerplate: these factories build empty, VALID containers and seed
// the initial resource baselines (energy, peek charges, counters). They contain
// NO turn behavior — no drawing, no swapping, no damage. The CombatManager will
// drive transitions over these shells in a later phase.

import { PHASES } from '../types.js';
import { MAX_TYPES } from '../party/MonsterParty.js';

/** @typedef {import('../types.js').Fighter} Fighter */
/** @typedef {import('../types.js').FighterDeck} FighterDeck */
/** @typedef {import('../types.js').FortifySlot} FortifySlot */
/** @typedef {import('../types.js').Side} Side */
/** @typedef {import('../types.js').PlannedAction} PlannedAction */
/** @typedef {import('../types.js').CombatState} CombatState */
/** @typedef {import('../types.js').TypeAffinity} TypeAffinity */

/** Initial resource baselines (combat-engine-spec §1.3, §2). */
export const COMBAT_DEFAULTS = Object.freeze({
  energyPerTurn: 3,   // floor used by max(3, bench) for both sides (symmetrical).
  handSize: 5,
  peekCharges: 3,
  enemyEnergyFloor: 3,
});

/** @returns {FighterDeck} empty draw/discard/exhaust zones. */
export function createFighterDeck() {
  return { drawPile: [], discardPile: [], exhaustPile: [] };
}

/** @returns {FortifySlot} empty slot-bound aura zone. */
export function createFortifySlot() {
  return { statuses: [], block: 0 };
}

/**
 * Build a Fighter shell. Types are STRICTLY capped at MAX_TYPES (1–2, §1.1):
 * extras beyond the cap are dropped here at the source.
 * @param {Object} args
 * @param {string} args.id
 * @param {string} args.name
 * @param {TypeAffinity[]} [args.types]
 * @param {number} [args.hp]
 * @param {number} [args.maxHp]
 * @param {Object} [args.meta]
 * @param {Object} [args.stats]   Topic-1 stat line (multipliers); defaults to neutral.
 * @param {string} [args.stance]  Warrior stance state; defaults to 'Balanced'.
 * @returns {Fighter}
 */
export function createFighter({ id, name, types = [], hp = 0, maxHp = hp, meta = {}, stats, stance }) {
  return {
    id,
    name,
    types: types.slice(0, MAX_TYPES), // absolute typing cap (never 3+)
    hp,
    maxHp,
    block: 0,
    bracedBlock: 0,   // Block that persists across turns (Brace); decays only when spent
    statuses: [],
    deck: createFighterDeck(),
    hand: [],
    // Topic-1 stat line (multipliers centered on 1.0; speed flat 0). Neutral default.
    stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0, ...(stats || {}) },
    stance: stance ?? 'Balanced',
    powers: [],
    meta,
  };
}

/**
 * Compute a side's per-turn energy baseline.
 * Both sides use `'bench'` by default (symmetrical energy scaling, §1.3):
 * `max(floor, benchedCount)` where bench excludes the active Vanguard.
 * `'flat'` is retained as a utility option for custom scenarios / testing.
 * @param {Fighter[]} fighters
 * @param {'flat'|'bench'} rule
 * @param {{ energyPerTurn:number, enemyEnergyFloor:number }} cfg
 * @returns {number}
 */
export function computeEnergyPerTurn(fighters, rule, cfg) {
  if (rule === 'bench') {
    const benched = Math.max(0, fighters.length - 1);
    return Math.max(cfg.enemyEnergyFloor, benched);
  }
  return cfg.energyPerTurn;
}

/**
 * Build a Side shell. Both sides use `energyRule:'bench'` by default (§1.3
 * symmetrical energy). `'flat'` is available for custom/test scenarios only.
 * @param {Object} [args]
 * @param {Fighter[]} [args.fighters]
 * @param {'flat'|'bench'} [args.energyRule]  Default 'bench' (both sides symmetrical).
 * @param {Object} [args.config]              Overrides over COMBAT_DEFAULTS.
 * @returns {Side}
 */
export function createSide({ fighters = [], energyRule = 'bench', config } = {}) {
  const cfg = { ...COMBAT_DEFAULTS, ...config };
  const energyPerTurn = computeEnergyPerTurn(fighters, energyRule, cfg);
  return {
    fighters,
    vanguardIndex: 0,
    energy: energyPerTurn,        // booted baseline (resources populated)
    energyPerTurn,
    handSize: cfg.handSize,
    manualSwapsThisTurn: 0,
    fortifySlot: createFortifySlot(),
    // Event-history counters for conditional / scaling effects (per turn + per combat).
    counters: { turn: {}, combat: {} },
  };
}

/**
 * Build a PlannedAction shell (one hidden silhouette slot in the Peek queue).
 * @param {Object} args
 * @param {import('../types.js').IntentKind} args.silhouette
 * @param {string} args.actor
 * @param {Object} [args.detail]
 * @returns {PlannedAction}
 */
export function createPlannedAction({ silhouette, actor, detail = {} }) {
  return { silhouette, revealed: false, actor, detail };
}

/**
 * Build a complete, valid, EMPTY- but-bootable CombatState. No behavior runs;
 * this is the structural snapshot the manager will later mutate.
 * @param {Object} [args]
 * @param {Fighter[]} [args.playerFighters]
 * @param {Fighter[]} [args.enemyFighters]
 * @param {import('../types.js').RoomKind} [args.room]
 * @param {import('../types.js').RarityState} [args.rarity]
 * @param {(e:any)=>void} [args.log]
 * @param {Object} [args.config]
 * @returns {CombatState}
 */
export function createCombatState({
  playerFighters = [],
  enemyFighters = [],
  room = 'combat',
  rarity = { offset: -0.05, ascension7: false },
  log,
  config,
} = {}) {
  const cfg = { ...COMBAT_DEFAULTS, ...config };
  return {
    phase: PHASES.DRAW,
    turn: 0,
    player: createSide({ fighters: playerFighters, energyRule: 'bench', config: cfg }),
    enemy: createSide({ fighters: enemyFighters, energyRule: 'bench', config: cfg }),
    enemyPlan: [],
    peekCharges: cfg.peekCharges,
    peekedThisTurn: false,
    monstersCapturedThisFight: 0,
    room,
    rarity,
    log,
  };
}
