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
/** @typedef {import('../types.js').Fighter} Fighter */
/** @typedef {import('../types.js').CombatState} CombatState */

import { createFighter } from '../combat/state.js';

/**
 * @typedef {Object} EnemyArchetype
 * @property {string} name
 * @property {number} hp
 * @property {import('../types.js').ElementType} element  Dominant element (badge + matchup).
 * @property {string} icon          game-icons id for the creature art (e.g. 'game-icons:slime').
 * @property {string} rarity        Drives the frame finish (common…legendary).
 * @property {string} form          Body size: baby|small|regular|large|elite|boss.
 * @property {Intent[]} moves       Cyclic intent pattern.
 */

/** @type {Record<string, EnemyArchetype>} */
export const ENEMY_ARCHETYPES = {
  slime: {
    name: 'Cinder Slime', hp: 28, element: 'pyre', icon: 'game-icons:slime', rarity: 'common', form: 'regular',
    moves: [
      { kind: 'attack', value: 7 },
      { kind: 'attack', value: 5, hits: 2 },
      { kind: 'block', value: 6 },
    ],
  },
  brute: {
    name: 'Ash Brute', hp: 46, element: 'stone', icon: 'game-icons:troll', rarity: 'uncommon', form: 'large',
    moves: [
      { kind: 'buff', value: 2 },          // gains Strength
      { kind: 'attack', value: 11 },
      { kind: 'attack', value: 11 },
    ],
  },
  hexer: {
    name: 'Gloom Hexer', hp: 34, element: 'umbra', icon: 'game-icons:pointy-hat', rarity: 'common', form: 'regular',
    moves: [
      { kind: 'debuff', value: 1 },        // applies Weak to the player
      { kind: 'attack', value: 8 },
      { kind: 'block', value: 8 },
    ],
  },
  boss: {
    name: 'Magmaw Tyrant', hp: 120, element: 'pyre', icon: 'game-icons:dragon-head', rarity: 'legendary', form: 'boss',
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
    element: a.element,
    icon: a.icon,
    rarity: a.rarity,
    form: a.form,
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

// ── Vanguard-model enemy factory ──────────────────────────────────────────────

/** Convert an archetype Intent move to a Fighter Card. */
function intentToCard(intent, archetype, idx) {
  const base = {
    id: `${archetype.name.toLowerCase().replace(/\s+/g, '-')}-m${idx}`,
    name: intent.kind,
    cardType: 'attack',
    rarity: 'basic',
    element: archetype.element,
    keywords: [],
    text: null,
  };
  switch (intent.kind) {
    case 'attack':
      return { ...base, cardType: 'attack', cost: 1,
        effects: { dmg: intent.value, ...(intent.hits ? { hits: intent.hits } : {}), scope: 'enemyActiveTarget' },
        text: `Deal ${intent.value}${intent.hits > 1 ? `×${intent.hits}` : ''}.` };
    case 'block':
      return { ...base, cardType: 'skill', cost: 1,
        effects: { block: intent.value, scope: 'selfOnlyTarget' },
        text: `Gain ${intent.value} Block.` };
    case 'buff':
      return { ...base, cardType: 'power', cost: 1,
        effects: { strength: intent.value, scope: 'selfOnlyTarget' },
        text: `Gain ${intent.value} Strength.` };
    case 'debuff':
      return { ...base, cardType: 'skill', cost: 1,
        effects: { applyStatus: { weak: intent.value * 2 }, scope: 'enemyActiveTarget' },
        text: `Apply ${intent.value * 2} Weak.` };
    default:
      return { ...base, cost: 1, effects: { dmg: 5, scope: 'enemyActiveTarget' }, text: 'Deal 5.' };
  }
}

/**
 * Build a Fighter from an enemy archetype for use with VanguardManager.
 * Converts the cyclic move-set into a card deck the AI planner can reason about.
 * @param {keyof typeof ENEMY_ARCHETYPES} key
 * @returns {Fighter}
 */
export function makeEnemyFighter(key) {
  const a = ENEMY_ARCHETYPES[key];
  if (!a) throw new Error(`unknown enemy archetype: ${key}`);
  const f = createFighter({
    id: `${key}-${_uid++}`,
    name: a.name,
    types: [{ type: a.element, weight: 1 }],
    hp: a.hp,
    maxHp: a.hp,
    meta: { element: a.element, icon: a.icon, rarity: a.rarity, form: a.form, source: 'archetype' },
  });
  f.deck.drawPile = a.moves.map((intent, i) => intentToCard(intent, a, i));
  return f;
}
