// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/deck/budget — the rarity-weighted DECK BUDGET (pure,   ║
// ║ framework-agnostic). The foundation for the playtest DeckBuilder AND   ║
// ║ the open-world / pre-dungeon drafting builders (synthesis-matrix-spec  ║
// ║ §14.6). Decks are authored as a COUNTS map { baseCardId: copies }; the  ║
// ║ pool is an index { baseCardId: CardSpec }. Cost = Σ rarity points.     ║
// ║ UPDATE WHEN: budget costs, caps, or per-tier budgets change.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { RARITY_POINTS } from '../types.js';

/** Default build constraints (REVIEW/tunable — §14.6). */
export const PER_CARD_CAP = 4;     // max copies of any one card
export const DEFAULT_BUDGET = 24;  // playtest default points cap
export const DEFAULT_MIN_SIZE = 5; // combat draws a 5-card hand; need at least this
export const DEFAULT_MAX_SIZE = 40;

/** Points one card costs, by rarity. `basic` is free; unknown → common cost. */
export function cardCost(card) {
  return RARITY_POINTS[card?.rarity] ?? RARITY_POINTS.common;
}

/** Total card count of a counts map. */
export function deckSize(counts) {
  return Object.values(counts).reduce((a, n) => a + n, 0);
}

/** Total budget points of a counts map, given a pool index { id: card }. */
export function deckCost(counts, poolIndex) {
  let sum = 0;
  for (const [id, n] of Object.entries(counts)) sum += cardCost(poolIndex[id]) * n;
  return sum;
}

/**
 * Suggested budget for an open-world creature by its monster-rarity tier (§14.6;
 * REVIEW). Higher-tier creatures field bigger/better decks. Used by the open-world
 * + drafting builders later; the playtest builder lets you set the cap directly.
 */
export function budgetForTier(rarity = 'common') {
  const base = { common: 14, uncommon: 18, rare: 24, epic: 30, mythic: 36, legendary: 44, godly: 52 };
  return base[rarity] ?? DEFAULT_BUDGET;
}

/**
 * Can one more copy of `card` be added to `counts` under these constraints?
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canAdd(counts, card, poolIndex, opts = {}) {
  const { budget = DEFAULT_BUDGET, perCardCap = PER_CARD_CAP, maxSize = DEFAULT_MAX_SIZE, sandbox = false } = opts;
  if (sandbox) return { ok: true };
  if ((counts[card.id] ?? 0) >= perCardCap) return { ok: false, reason: `max ${perCardCap} copies` };
  if (deckSize(counts) >= maxSize) return { ok: false, reason: `deck full (${maxSize} max)` };
  if (deckCost(counts, poolIndex) + cardCost(card) > budget) return { ok: false, reason: 'over budget' };
  return { ok: true };
}

/**
 * Validate a finished build. minSize is enforced even in sandbox (combat needs a
 * drawable deck); budget / per-card cap / maxSize are skipped in sandbox.
 * @returns {{ ok: boolean, cost: number, size: number, errors: string[] }}
 */
export function validateDeck(counts, poolIndex, opts = {}) {
  const { budget = DEFAULT_BUDGET, perCardCap = PER_CARD_CAP,
    minSize = DEFAULT_MIN_SIZE, maxSize = DEFAULT_MAX_SIZE, sandbox = false } = opts;
  const cost = deckCost(counts, poolIndex);
  const size = deckSize(counts);
  const errors = [];
  if (size < minSize) errors.push(`need at least ${minSize} cards (have ${size})`);
  if (!sandbox) {
    if (cost > budget) errors.push(`over budget by ${cost - budget} (${cost}/${budget})`);
    if (size > maxSize) errors.push(`deck too large (${size}/${maxSize})`);
    for (const [id, n] of Object.entries(counts)) {
      if (n > perCardCap) errors.push(`${poolIndex[id]?.name || id}: ${n} copies (max ${perCardCap})`);
    }
  }
  return { ok: errors.length === 0, cost, size, errors };
}

/** Build a { id: card } index from a pool array. */
export function indexPool(pool) {
  return Object.fromEntries((pool || []).map((c) => [c.id, c]));
}

/**
 * Expand a counts map → a concrete CardSpec[] deck with UNIQUE instance ids
 * (`baseId#n`) so combat/UI can track copies individually (matches starterDeck()).
 */
export function expandDeck(counts, poolIndex) {
  const out = [];
  for (const [id, n] of Object.entries(counts)) {
    const card = poolIndex[id];
    if (!card) continue;
    for (let i = 0; i < n; i++) out.push({ ...card, id: `${id}#${i}` });
  }
  return out;
}

/** Collapse a CardSpec[] deck (possibly with `baseId#n` ids) → a counts map. */
export function deckToCounts(deck) {
  const counts = {};
  for (const c of deck || []) {
    const base = String(c.id).split('#')[0];
    counts[base] = (counts[base] ?? 0) + 1;
  }
  return counts;
}
