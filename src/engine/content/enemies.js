// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/enemies — enemy roster + basic intent AI.    ║
// ║ UPDATE WHEN: enemy archetypes or AI patterns change.                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Phase 2 enemies are deliberately simple: an HP pool plus a cyclic "move set"
// of intents. The CombatManager calls enemyAI() each round to telegraph the
// NEXT intent (shown during the Intent Phase before it resolves).

/** @typedef {import('../types.js').Enemy} Enemy */
/** @typedef {import('../types.js').Intent} Intent */
/** @typedef {import('../types.js').CombatState} CombatState */

/**
 * @typedef {Object} EnemyArchetype
 * @property {string} name
 * @property {number} hp
 * @property {Intent[]} moves   Cyclic intent pattern.
 */

/** @type {Record<string, EnemyArchetype>} */
export const ENEMY_ARCHETYPES = {
  slime: {
    name: 'Cinder Slime', hp: 28,
    moves: [
      { kind: 'attack', value: 7 },
      { kind: 'attack', value: 5, hits: 2 },
      { kind: 'block', value: 6 },
    ],
  },
  brute: {
    name: 'Ash Brute', hp: 46,
    moves: [
      { kind: 'buff', value: 2 },          // gains Strength
      { kind: 'attack', value: 11 },
      { kind: 'attack', value: 11 },
    ],
  },
  hexer: {
    name: 'Gloom Hexer', hp: 34,
    moves: [
      { kind: 'debuff', value: 1 },        // applies Weak to the player
      { kind: 'attack', value: 8 },
      { kind: 'block', value: 8 },
    ],
  },
  boss: {
    name: 'Magmaw Tyrant', hp: 120,
    moves: [
      { kind: 'attack', value: 9, hits: 2 },
      { kind: 'buff', value: 3 },
      { kind: 'attack', value: 18 },
      { kind: 'block', value: 14 },
    ],
  },
};

let _uid = 0;

/**
 * Instantiate an enemy from an archetype.
 * @param {keyof typeof ENEMY_ARCHETYPES} key
 * @returns {Enemy & { _moves: Intent[], _step: number }}
 */
export function makeEnemy(key) {
  const a = ENEMY_ARCHETYPES[key];
  if (!a) throw new Error(`unknown enemy archetype: ${key}`);
  return {
    id: `${key}-${_uid++}`,
    name: a.name,
    hp: a.hp, maxHp: a.hp,
    block: 0,
    statuses: [],
    intent: a.moves[0],
    _moves: a.moves,
    _step: 0,
  };
}

/**
 * Basic intent AI: advance the enemy's cyclic move set and telegraph the next.
 * Signature matches CombatManager's `enemyAI(enemy, state, rng)`.
 * @param {Enemy & { _moves?: Intent[], _step?: number }} enemy
 * @param {CombatState} _state
 * @param {() => number} [_rng]
 * @returns {Intent}
 */
export function basicEnemyAI(enemy, _state, _rng) {
  const moves = enemy._moves;
  if (!moves || !moves.length) return { kind: 'attack', value: 5 };
  enemy._step = ((enemy._step ?? 0) + 1) % moves.length;
  return moves[enemy._step];
}
