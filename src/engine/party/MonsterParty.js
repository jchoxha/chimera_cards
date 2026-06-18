// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/party/MonsterParty — the ≤3 monster team + 1–2 type  ║
// ║ matrix and combined-typing weighting.                               ║
// ║ UPDATE WHEN: party size, typing rules, or deck-assembly change.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { combinedTypeWeights } from '../cards/rarity.js';

/** @typedef {import('../types.js').Monster} Monster */
/** @typedef {import('../types.js').TypeAffinity} TypeAffinity */
/** @typedef {import('../types.js').Card} Card */
/** @typedef {import('../types.js').ElementType} ElementType */

export const MAX_PARTY = 3;
// Absolute typing cap: every monster has EXACTLY 1–2 types (combat-engine-spec
// §1.1). Was 3 in the Phase-1 "3-type matrix"; locked down to 2 in the rebuild.
export const MAX_TYPES = 2;

/**
 * Normalize a monster's typings so weights sum to 1. Accepts 1–2 entries (extras
 * trimmed to MAX_TYPES); if weights are omitted or don't sum to 1, they're
 * treated as equal/ renormalized.
 * @param {TypeAffinity[]} types
 * @returns {TypeAffinity[]}
 */
export function normalizeTypes(types) {
  const trimmed = types.slice(0, MAX_TYPES);
  const sum = trimmed.reduce((s, t) => s + (t.weight ?? 0), 0);
  if (sum <= 0) {
    const w = 1 / trimmed.length;
    return trimmed.map((t) => ({ type: t.type, weight: w }));
  }
  return trimmed.map((t) => ({ type: t.type, weight: (t.weight ?? 0) / sum }));
}

export class MonsterParty {
  /**
   * @param {Monster[]} monsters up to MAX_PARTY; extras are ignored.
   * The party TAKES OWNERSHIP of these instances (it mutates their hp/types as
   * the run progresses), so the caller should pass run-scoped clones of any
   * persistent collection monsters — not the collection objects themselves.
   */
  constructor(monsters = []) {
    /** @type {Monster[]} */
    this.members = monsters.slice(0, MAX_PARTY);
    for (const m of this.members) m.types = normalizeTypes(m.types); // normalize in place
    /** @type {number} index of the active (front) monster. */
    this.activeIndex = 0;
  }

  /** @returns {Monster[]} members with hp > 0. */
  get survivors() {
    return this.members.filter((m) => m.hp > 0);
  }

  /** @returns {Monster|null} the active monster, or null if the party is wiped. */
  get active() {
    const m = this.members[this.activeIndex];
    return m && m.hp > 0 ? m : (this.survivors[0] ?? null);
  }

  /** @returns {boolean} true when every member is at 0 HP. */
  get isWiped() {
    return this.survivors.length === 0;
  }

  /**
   * Switch the active monster to a living member by index.
   * @param {number} index @returns {boolean} success
   */
  setActive(index) {
    const m = this.members[index];
    if (!m || m.hp <= 0) return false;
    this.activeIndex = index;
    return true;
  }

  /**
   * The normalized combined typing distribution across SURVIVING members.
   * This is the input to the weighted draft pools (spec §2A).
   * @returns {Map<string, number>}
   */
  combinedTypeWeights() {
    return combinedTypeWeights(this.survivors.map((m) => m.types));
  }

  /**
   * Assemble the starting combat deck from every surviving member's signature
   * cards. (Reward/curse cards get added by the run layer, not here.)
   * @returns {Card[]}
   */
  buildCombatDeck() {
    /** @type {Card[]} */
    const deck = [];
    for (const m of this.survivors) {
      for (const c of m.signatureCards ?? []) deck.push({ ...c });
    }
    return deck;
  }
}
