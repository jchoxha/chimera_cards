// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/rarity — adaptive "Pity Offset" rarity engine  ║
// ║ + combined-typing weighted draft pools.                             ║
// ║ UPDATE WHEN: rarity tuning changes, or new RoomKinds are added.     ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Grounded in Slay the Spire 2 (see AI context/00_MASTER_CONTEXT.md §4):
//   • Base rare chance by room: combat 3%, elite 10%, shop 9%.
//   • Offset starts at -5%, +1% per non-rare roll (+0.5% on Ascension 7+),
//     hard cap +40%. A successful Rare resets the offset to -5%.
//   • Current rare chance = baseRoomChance + offset (clamped to ≥ 0).
//   • Boss card rewards are ALWAYS Rare.
//   • Non-rare split: Uncommon ≈ 38%, remainder Common.

/** @typedef {import('../types.js').CardRarity} CardRarity */
/** @typedef {import('../types.js').RarityState} RarityState */
/** @typedef {import('../types.js').RoomKind} RoomKind */
/** @typedef {import('../types.js').TypeAffinity} TypeAffinity */
/** @typedef {import('../types.js').Card} Card */

export const OFFSET_START = -0.05;
export const OFFSET_CAP = 0.40;
export const OFFSET_STEP = 0.01;
export const OFFSET_STEP_ASC7 = 0.005;

/** Base rare chance per room (Ascension 7+ roughly halves these). */
export const BASE_RARE_CHANCE = Object.freeze({
  combat: 0.03,
  elite: 0.10,
  shop: 0.09,
  boss: 1.0, // boss rewards are always rare
});

/** Of non-rare rolls, this share are Uncommon; the rest are Common. */
export const UNCOMMON_SHARE = 0.38;

/** @returns {RarityState} a fresh offset state. */
export function createRarityState(ascension7 = false) {
  return { offset: OFFSET_START, ascension7 };
}

/**
 * The current effective rare chance for a room, given the live offset.
 * @param {RarityState} state
 * @param {RoomKind} room
 * @returns {number} probability in [0, 1]
 */
export function currentRareChance(state, room) {
  if (room === 'boss') return 1;
  let base = BASE_RARE_CHANCE[room] ?? BASE_RARE_CHANCE.combat;
  if (state.ascension7) base *= 0.5;
  return Math.max(0, base + state.offset);
}

/**
 * Roll one card's rarity and ADVANCE the pity offset in place.
 *
 * This is the heart of the engine: it both returns the rarity and mutates
 * `state.offset` per the StS2 rules (reset on rare, increment on miss, capped).
 *
 * @param {RarityState} state               Mutated in place.
 * @param {RoomKind} room
 * @param {() => number} [rng]               Returns [0,1); injectable for tests.
 * @returns {CardRarity}
 */
export function rollRarity(state, room, rng = Math.random) {
  const rareChance = currentRareChance(state, room);

  if (rng() < rareChance) {
    state.offset = OFFSET_START; // success → full reset
    return 'rare';
  }

  // Miss: bump the offset toward the cap, then split common/uncommon.
  const step = state.ascension7 ? OFFSET_STEP_ASC7 : OFFSET_STEP;
  state.offset = Math.min(OFFSET_CAP, state.offset + step);

  return rng() < UNCOMMON_SHARE ? 'uncommon' : 'common';
}

// ── Combined-typing weighted draft pools ───────────────────────────────────
//
// The active card pool is weighted by the COMBINED typings of the surviving
// party (spec §2A). Each monster contributes its TypeAffinity weights; we sum
// them across the team and normalize to a probability distribution over types.

/**
 * Merge the party's typings into one normalized {type: probability} map.
 * @param {TypeAffinity[][]} partyTypings  One TypeAffinity[] per surviving monster.
 * @returns {Map<string, number>} normalized weights summing to 1 (empty if no party).
 */
export function combinedTypeWeights(partyTypings) {
  /** @type {Map<string, number>} */
  const totals = new Map();
  let sum = 0;
  for (const typings of partyTypings) {
    for (const { type, weight } of typings) {
      totals.set(type, (totals.get(type) ?? 0) + weight);
      sum += weight;
    }
  }
  if (sum > 0) for (const [k, v] of totals) totals.set(k, v / sum);
  return totals;
}

/**
 * Pick a type from the combined distribution (weighted random).
 * @param {Map<string, number>} weights  Normalized type→probability.
 * @param {() => number} [rng]
 * @returns {string|null}
 */
export function pickWeightedType(weights, rng = Math.random) {
  let r = rng();
  for (const [type, p] of weights) {
    if ((r -= p) <= 0) return type;
  }
  // Fallback for FP drift: return the last key, or null if empty.
  let last = null;
  for (const k of weights.keys()) last = k;
  return last;
}

/**
 * Draft a set of N candidate cards: roll each card's rarity through the pity
 * engine, then draw a card of that rarity + a party-weighted type from `pool`.
 *
 * @param {Object} args
 * @param {RarityState} args.state                 Pity state (mutated).
 * @param {RoomKind} args.room
 * @param {number} args.count                      How many cards to offer.
 * @param {Map<string, number>} args.typeWeights   From combinedTypeWeights().
 * @param {(rarity: CardRarity, type: string|null, rng: () => number) => Card} args.pickCard
 *        Project-supplied resolver that returns a concrete Card for the rolled
 *        (rarity, type). Keeps this module independent of the card database.
 * @param {() => number} [args.rng]
 * @returns {Card[]}
 */
export function draftCards({ state, room, count, typeWeights, pickCard, rng = Math.random }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(state, room, rng);
    const type = pickWeightedType(typeWeights, rng);
    out.push(pickCard(rarity, type, rng));
  }
  return out;
}
