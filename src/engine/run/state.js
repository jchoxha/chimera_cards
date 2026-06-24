// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/state — the serializable RUN state (the roguelike ║
// ║ meta layer wrapping combat). Plain JSON-able data only; mutated via   ║
// ║ run actions through the ActionManager. See docs/run-layer-gap.md.    ║
// ╚══════════════════════════════════════════════════════════════════╝

import { hashSeed, makeRng } from './rng.js';
import { generateAct } from './map.js';

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
export function createRunState({ party = [], seed = Date.now(), map = null, rewardPool = [], rewardPools = {} } = {}) {
  const seedInt = typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed);
  return {
    seed: seedInt,
    rngState: seedInt,
    // The party's combined potential pool (archetype + attunement cards) — what
    // the SHOP drafts from (engine/run/rewards.js). Set at run start.
    rewardPool: rewardPool.map((c) => ({ ...c })),
    // Per-member potential pools (memberId → card[]) — post-combat card rewards
    // draft a DISTINCT option set per character from these (each gets their own).
    rewardPools: Object.fromEntries(Object.entries(rewardPools).map(([id, pool]) => [id, (pool || []).map((c) => ({ ...c }))])),
    party: party.map((p) => ({
      id: p.id,
      name: p.name,
      class: p.class ?? null,
      biology: p.biology ?? null,
      attunement: p.attunement ?? ['Physical'],
      stats: p.stats ?? { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 },
      maxHp: p.maxHp ?? p.hp ?? 60,
      hp: p.hp ?? p.maxHp ?? 60,
      portrait: p.portrait ?? p.meta?.portrait ?? null,  // AI creature art, carried into combat
      deck: [...(p.deck ?? [])].map((c) => ({ ...c })),
    })),
    gold: 0,
    relics: [],
    potions: [],
    pendingReward: null, // cards offered after a victory, awaiting choose/skip
    map,
    position: map?.start ?? null,
    floor: 0,
    act: 1,
    status: 'active', // 'active' | 'won' | 'lost'
  };
}

/**
 * Create a full run with a generated act map (the normal entry point).
 * Advances rngState past the map generation so subsequent draws stay deterministic.
 * @param {{ party?: Object[], seed?: number|string, floors?: number }} [args]
 */
export function createRun({ party = [], seed = Date.now(), floors = 10, rewardPool = [], rewardPools = {} } = {}) {
  const seedInt = typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed);
  const rng = makeRng(seedInt);
  const map = generateAct(rng, { floors, act: 1 });
  const state = createRunState({ party, seed: seedInt, map, rewardPool, rewardPools });
  state.rngState = rng.state; // continue the sequence after map gen
  return state;
}

/**
 * Build a StS-style STARTER deck (≤ max) from a class's card pool: each `basic`
 * card duplicated, then filled with the first commons, capped. Duplicate copies
 * get unique instance ids (id#n) so combat/UI track them individually. More cards
 * come from rewards.
 * @param {import('../cards/cardSpec.js').CardSpec[]} cards  the class pool
 * @param {number} [max]
 */
export function starterDeck(cards, max = 10) {
  const basics = cards.filter((c) => c.rarity === 'basic');
  const commons = cards.filter((c) => c.rarity === 'common');
  const deck = [];
  let n = 0;
  const add = (c) => { if (deck.length < max) deck.push({ ...c, id: `${c.id}#${n++}` }); };
  for (const b of basics) for (let i = 0; i < 4; i++) add(b); // 4 copies of each basic
  for (const c of commons) add(c);                             // fill with commons
  return deck.slice(0, max);
}

/** Total living party members. */
export function livingParty(state) {
  return state.party.filter((p) => p.hp > 0);
}
export function isWiped(state) {
  return state.party.every((p) => p.hp <= 0);
}
