// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/fixtures — hand-authored monsters/cards for   ║
// ║ engine validation (spec §9: fixtures, not real content, this        ║
// ║ milestone). UPDATE WHEN: new effect fields need test coverage.       ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Tiny, deterministic content used only by the turn-behavior smoke tests. These
// are NOT the real 108-monster / 339-card pool (wiring that through
// content/adapt.js is a separate follow-up); they exist to exercise the engine
// in isolation.

import { createFighter } from './state.js';

/** Build a Card with sane defaults. @param {Partial<import('../types.js').Card>} c */
export function makeCard(c) {
  return {
    cardType: 'attack', rarity: 'basic', cost: 1, element: null,
    effects: {}, keywords: [], ...c,
  };
}

/**
 * Build a Fighter shell and load its deck (drawPile) with `cards`.
 * @param {Object} args id/name/types/hp + a `cards` array for the deck.
 */
export function makeFighter({ id, name, types = [{ type: 'beast', weight: 1 }], hp = 30, cards = [], meta }) {
  const f = createFighter({ id, name, types, hp, maxHp: hp, meta });
  f.deck.drawPile = cards.map((c) => ({ ...c }));
  return f;
}

// ── Sample cards (one per representative scope/effect) ─────────────────────────
export const CARDS = {
  strike:    makeCard({ id: 'strike', name: 'Strike', cost: 1, effects: { dmg: 6, scope: 'enemyActiveTarget' } }),
  doubleJab: makeCard({ id: 'doubleJab', name: 'Double Jab', cost: 1, effects: { dmg: 3, hits: 2, scope: 'enemyActiveTarget' } }),
  guard:     makeCard({ id: 'guard', name: 'Guard', cardType: 'skill', cost: 1, effects: { block: 5, scope: 'selfOnlyTarget' } }),
  mend:      makeCard({ id: 'mend', name: 'Mend', cardType: 'skill', cost: 1, effects: { heal: 8, scope: 'flexFriendlyTarget' } }),
  expose:    makeCard({ id: 'expose', name: 'Expose', cardType: 'skill', cost: 1, effects: { applyStatus: { vulnerable: 2 }, dmg: 4, scope: 'enemyActiveTarget' } }),
  quake:     makeCard({ id: 'quake', name: 'Quake', cost: 2, effects: { dmg: 4, scope: 'wholeEnemySide' } }),
  rally:     makeCard({ id: 'rally', name: 'Rally', cardType: 'power', cost: 1, effects: { strength: 2, scope: 'selfOnlyTarget' } }),
  bulwark:   makeCard({ id: 'bulwark', name: 'Bulwark', cardType: 'skill', cost: 2, effects: { fortify: { block: 6, duration: 2 }, scope: 'selfOnlyTarget' } }),
};

/**
 * A 2-v-2 fixture state: player [hero, medic] vs enemy [grunt, brute].
 * @param {Object} createCombatState  the factory (passed in to avoid a cycle)
 */
export function sampleFighters() {
  return {
    player: [
      makeFighter({ id: 'hero',  name: 'Hero',  hp: 30, cards: [CARDS.strike, CARDS.guard, CARDS.expose, CARDS.quake, CARDS.rally, CARDS.bulwark] }),
      makeFighter({ id: 'medic', name: 'Medic', hp: 24, cards: [CARDS.mend, CARDS.guard, CARDS.strike] }),
    ],
    enemy: [
      makeFighter({ id: 'grunt', name: 'Grunt', hp: 20, cards: [CARDS.strike, CARDS.guard] }),
      makeFighter({ id: 'brute', name: 'Brute', hp: 28, cards: [CARDS.doubleJab, CARDS.guard] }),
    ],
  };
}
