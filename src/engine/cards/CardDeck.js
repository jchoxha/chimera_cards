// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/CardDeck — draw/discard/exhaust pile manager   ║
// ║ UPDATE WHEN: new pile zones or shuffle/draw rules are added.        ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Owns the four card zones during a fight: draw pile, hand, discard pile, and
// exhaust pile. Reshuffles the discard pile into the draw pile when the draw
// pile empties (standard StS behavior). RNG is injectable for deterministic
// tests and for server-authoritative multiplayer.

/** @typedef {import('../types.js').Card} Card */

/**
 * Fisher–Yates shuffle (pure; returns a new array).
 * @template T @param {T[]} arr @param {() => number} rng @returns {T[]}
 */
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class CardDeck {
  /**
   * @param {Card[]} cards   The combat deck (all of a fight's cards).
   * @param {() => number} [rng]
   */
  constructor(cards = [], rng = Math.random) {
    this.rng = rng;
    /** @type {Card[]} */ this.hand = [];
    /** @type {Card[]} */ this.drawPile = shuffle(cards, rng);
    /** @type {Card[]} */ this.discardPile = [];
    /** @type {Card[]} */ this.exhaustPile = [];
  }

  /** Move the discard pile back under the draw pile, shuffled. */
  reshuffle() {
    this.drawPile = shuffle([...this.drawPile, ...this.discardPile], this.rng);
    this.discardPile = [];
  }

  /**
   * Draw up to `n` cards into hand, reshuffling discard if needed.
   * @param {number} n @returns {Card[]} the cards actually drawn.
   */
  draw(n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break; // nothing left anywhere
        this.reshuffle();
      }
      const card = this.drawPile.pop();
      this.hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  /**
   * Honor StS draw priority: Innate cards come up in the opening hand.
   * Call this once at combat start instead of plain draw().
   * @param {number} handSize @returns {Card[]}
   */
  drawOpeningHand(handSize) {
    const innate = this.drawPile.filter((c) => c.keywords?.includes('innate'));
    this.drawPile = this.drawPile.filter((c) => !c.keywords?.includes('innate'));
    this.hand.push(...innate);
    // If innate count exceeds hand size, they all stay (effective free draw).
    const remaining = Math.max(0, handSize - innate.length);
    this.draw(remaining);
    return this.hand.slice();
  }

  /**
   * Remove a card from hand into the discard pile.
   * @param {Card} card @returns {boolean} true if it was in hand.
   */
  discard(card) {
    const i = this.hand.indexOf(card);
    if (i === -1) return false;
    this.hand.splice(i, 1);
    this.discardPile.push(card);
    return true;
  }

  /**
   * Discard the whole hand at end of turn, respecting Retain (kept) and
   * Ethereal (Exhausted instead of discarded).
   * @returns {{discarded: Card[], exhausted: Card[], retained: Card[]}}
   */
  discardHandEndOfTurn() {
    const discarded = [], exhausted = [], retained = [];
    const keep = [];
    for (const card of this.hand) {
      const kw = card.keywords ?? [];
      if (kw.includes('ethereal')) { this.exhaustPile.push(card); exhausted.push(card); }
      else if (kw.includes('retain')) { keep.push(card); retained.push(card); }
      else { this.discardPile.push(card); discarded.push(card); }
    }
    this.hand = keep;
    return { discarded, exhausted, retained };
  }

  /**
   * Send a card from hand to the exhaust pile (removed for the rest of combat).
   * @param {Card} card @returns {boolean}
   */
  exhaust(card) {
    const i = this.hand.indexOf(card);
    if (i === -1) return false;
    this.hand.splice(i, 1);
    this.exhaustPile.push(card);
    return true;
  }

  /** @returns {number} total cards across every zone. */
  get total() {
    return this.hand.length + this.drawPile.length
      + this.discardPile.length + this.exhaustPile.length;
  }
}
