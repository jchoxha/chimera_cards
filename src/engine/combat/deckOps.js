// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/deckOps — per-Fighter draw/discard/exhaust    ║
// ║ ops over the plain Fighter shape (spec §1.2 per-monster decks).     ║
// ║ UPDATE WHEN: pile zones, shuffle/draw priority, or swap hand rules   ║
// ║ change (spec §4 hand economics).                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Each Fighter owns its own deck — there is no shared party pile. These helpers
// mutate the plain `{ deck:{drawPile,discardPile,exhaustPile}, hand }` shape
// (kept serializable for snapshots / server authority) rather than wrapping a
// CardDeck instance. RNG is injected for deterministic tests. No turn behavior
// here — just the card-movement primitives the manager composes.

import { shuffle } from '../cards/CardDeck.js';

/** @typedef {import('../types.js').Fighter} Fighter */
/** @typedef {import('../types.js').Card} Card */

/** Move discardPile back under drawPile, shuffled. @param {Fighter} f @param {()=>number} rng */
export function reshuffle(f, rng = Math.random) {
  f.deck.drawPile = shuffle([...f.deck.drawPile, ...f.deck.discardPile], rng);
  f.deck.discardPile = [];
}

/**
 * Draw up to `n` cards into the fighter's hand, reshuffling discard when the
 * draw pile empties (standard StS). Exhaust pile is never reshuffled in.
 * @param {Fighter} f @param {number} n @param {()=>number} rng @returns {Card[]} drawn
 */
export function drawCards(f, n, rng = Math.random) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (f.deck.drawPile.length === 0) {
      if (f.deck.discardPile.length === 0) break; // nothing left anywhere
      reshuffle(f, rng);
    }
    const card = f.deck.drawPile.pop();
    f.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

/**
 * Draw a fresh Vanguard hand, surfacing Innate cards first (StS opening-draw
 * priority). Used whenever a fighter becomes the Vanguard (spec §4: swap-in
 * draws a fresh hand from the incoming monster's own deck).
 * @param {Fighter} f @param {number} handSize @param {()=>number} rng @returns {Card[]} hand
 */
export function drawFreshHand(f, handSize, rng = Math.random) {
  const innate = f.deck.drawPile.filter((c) => c.keywords?.includes('innate'));
  f.deck.drawPile = f.deck.drawPile.filter((c) => !c.keywords?.includes('innate'));
  f.hand.push(...innate);
  drawCards(f, Math.max(0, handSize - innate.length), rng);
  return f.hand.slice();
}

/** Remove a card from hand to discard. @param {Fighter} f @param {Card} card @returns {boolean} */
export function discardCard(f, card) {
  const i = f.hand.indexOf(card);
  if (i === -1) return false;
  f.hand.splice(i, 1);
  f.deck.discardPile.push(card);
  return true;
}

/** Remove a card from hand to exhaust (gone for the fight). @param {Fighter} f @param {Card} card @returns {boolean} */
export function exhaustCard(f, card) {
  const i = f.hand.indexOf(card);
  if (i === -1) return false;
  f.hand.splice(i, 1);
  f.deck.exhaustPile.push(card);
  return true;
}

/**
 * End-of-turn hand cleanup for the active Vanguard: Ethereal → exhaust,
 * Retain → kept in hand, everything else → discard.
 * @param {Fighter} f @returns {{discarded:Card[],exhausted:Card[],retained:Card[]}}
 */
export function discardHandEndOfTurn(f) {
  const discarded = [], exhausted = [], retained = [], keep = [];
  for (const card of f.hand) {
    const kw = card.keywords ?? [];
    if (kw.includes('ethereal')) { f.deck.exhaustPile.push(card); exhausted.push(card); }
    else if (kw.includes('retain')) { keep.push(card); retained.push(card); }
    else { f.deck.discardPile.push(card); discarded.push(card); }
  }
  f.hand = keep;
  return { discarded, exhausted, retained };
}

/**
 * Swap-out cleanup: the outgoing Vanguard's ENTIRE hand is discarded
 * unconditionally (spec §4 — Retain does NOT save a card across a swap).
 * @param {Fighter} f @returns {Card[]} the discarded cards
 */
export function discardWholeHand(f) {
  const dumped = f.hand.slice();
  f.deck.discardPile.push(...dumped);
  f.hand = [];
  return dumped;
}

/** Total cards across every zone (incl. hand). @param {Fighter} f @returns {number} */
export function deckTotal(f) {
  return f.hand.length + f.deck.drawPile.length
    + f.deck.discardPile.length + f.deck.exhaustPile.length;
}
