// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/state — the serializable RUN state (the roguelike ║
// ║ meta layer wrapping combat). Plain JSON-able data only; mutated via   ║
// ║ run actions through the ActionManager. See docs/run-layer-gap.md.    ║
// ╚══════════════════════════════════════════════════════════════════╝

import { hashSeed } from './rng.js';

/**
 * @typedef {Object} RunPartyMember
 * @property {string} id
 * @property {string} name
 * @property {string[]} [class] @property {string[]} [biology] @property {string[]} [attunement]
 * @property {Object} [stats]
 * @property {number} hp @property {number} maxHp
 * @property {import('../cards/cardSpec.js').CardSpec[]} deck  this monster's run deck
 */

/**
 * Build a fresh run state.
 * @param {Object} args
 * @param {RunPartyMember[]} [args.party]
 * @param {number|string} [args.seed]
 * @param {Object} [args.map]
 * @returns {Object} serializable run state
 */
export function createRunState({ party = [], seed = Date.now(), map = null } = {}) {
  const seedInt = typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed);
  return {
    seed: seedInt,
    rngState: seedInt,
    party: party.map((p) => ({
      id: p.id,
      name: p.name,
      class: p.class ?? null,
      biology: p.biology ?? null,
      attunement: p.attunement ?? ['Physical'],
      stats: p.stats ?? { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 },
      maxHp: p.maxHp ?? p.hp ?? 60,
      hp: p.hp ?? p.maxHp ?? 60,
      deck: [...(p.deck ?? [])].map((c) => ({ ...c })),
    })),
    gold: 0,
    relics: [],
    potions: [],
    map,
    position: map?.start ?? null,
    floor: 0,
    act: 1,
    status: 'active', // 'active' | 'won' | 'lost'
  };
}

/** Total living party members. */
export function livingParty(state) {
  return state.party.filter((p) => p.hp > 0);
}
export function isWiped(state) {
  return state.party.every((p) => p.hp <= 0);
}
