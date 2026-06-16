// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/cardPool — reward card database + resolver.  ║
// ║ UPDATE WHEN: card sources or the reward-draft fallback logic change.║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Builds a searchable pool of reward cards from the roster's signature cards
// plus the element TYPE_MOVES, then exposes a `pickCard(rarity, type, rng)`
// resolver of the exact shape rarity.draftCards() expects. The pity engine
// decides the RARITY; the party's combined typing decides the TYPE; this module
// turns that (rarity, type) request into a concrete Card.

import { adaptCard, mapRarity } from './adapt.js';

/** @typedef {import('../types.js').Card} Card */
/** @typedef {import('../types.js').CardRarity} CardRarity */

/**
 * @typedef {Object} CardPool
 * @property {Card[]} all
 * @property {(rarity: CardRarity, type: string|null, rng?: () => number) => Card} pick
 */

/**
 * @param {Object} args
 * @param {Object[]} args.rawMonsters         DEFAULT_MONSTERS (legacy shape).
 * @param {Object[]} [args.typeMoves]         TYPE_MOVES (legacy shape, with .element).
 * @returns {CardPool}
 */
export function buildCardPool({ rawMonsters, typeMoves = [] }) {
  /** @type {Card[]} */
  const all = [];

  // De-dup by id so shared/evolved cards don't flood the pool.
  const seen = new Set();
  const add = (card) => { if (!seen.has(card.id)) { seen.add(card.id); all.push(card); } };

  for (const m of rawMonsters) {
    const dominant = (m.elements?.[0] ?? m.element);
    for (const c of m.cards ?? []) add(adaptCard(c, { element: dominant, rarity: m.rarity }));
  }
  // Type moves are reliable common-rarity, element-typed filler.
  for (const mv of typeMoves) add(adaptCard(mv, { element: mv.element, rarity: 'common' }));

  // Index by `${type}|${rarity}` and by rarity alone for fallback.
  /** @type {Map<string, Card[]>} */
  const byTypeRarity = new Map();
  /** @type {Map<string, Card[]>} */
  const byRarity = new Map();
  for (const c of all) {
    const tr = `${c.element}|${c.rarity}`;
    (byTypeRarity.get(tr) ?? byTypeRarity.set(tr, []).get(tr)).push(c);
    (byRarity.get(c.rarity) ?? byRarity.set(c.rarity, []).get(c.rarity)).push(c);
  }

  /**
   * Resolve a concrete card for a (rarity, type) request. Fallback ladder:
   * exact type+rarity → any card of that rarity → any card at all.
   * @param {CardRarity} rarity @param {string|null} type @param {() => number} [rng]
   * @returns {Card}
   */
  function pick(rarity, type, rng = Math.random) {
    const r = mapRarity(rarity);
    const exact = type ? byTypeRarity.get(`${type}|${r}`) : null;
    const bucket = (exact && exact.length) ? exact
      : (byRarity.get(r)?.length ? byRarity.get(r)
        : all);
    const chosen = bucket[Math.floor(rng() * bucket.length)];
    // Return a fresh copy so reward instances never alias pool templates.
    return { ...chosen, effects: { ...chosen.effects } };
  }

  return { all, pick };
}
