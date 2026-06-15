// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/ai/AIPipeline — serverless connector for generative  ║
// ║ content (forge / fuse / art).                                       ║
// ║ UPDATE WHEN: backend endpoints, the tag schema, or the Flavor↔       ║
// ║ Mechanics boundary change.                                          ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// HARD RULES (spec §1, §3):
//   • The client NEVER holds a raw generative-AI key. Every call goes to our
//     own serverless backend (Vercel / Cloud Function), which holds the keys.
//   • FLAVOR is AI-generated (name, art, lore, tag extraction). MECHANICS are
//     engine-deterministic: the budget template below is computed locally and
//     is the authority. The LLM only MAPS prompt text onto pre-existing DB tags;
//     it never invents stats.
//
// This module is the typed seam. In Phase 1 the network calls are thin fetch
// wrappers against documented endpoints; swapping in the real backend later
// doesn't touch the engine.

/** @typedef {import('../types.js').ElementType} ElementType */
/** @typedef {import('../types.js').Monster} Monster */

/**
 * The strict, engine-owned budget a forged/fused entity must fit. Computed from
 * run progress / materials BEFORE any AI call, so the AI can only ever supply
 * flavor and tag selections — never power.
 * @typedef {Object} BudgetTemplate
 * @property {number} hp
 * @property {number} cardCount
 * @property {number} statBudget       Total points distributable across cards.
 * @property {import('../types.js').CardRarity} maxRarity
 * @property {number} maxTypes         ≤ 3.
 */

/**
 * The constrained, validated result of tag extraction. Every field MUST be a
 * known database tag; the backend rejects anything off-vocabulary.
 * @typedef {Object} ExtractedTags
 * @property {ElementType[]} elements    1–3 known elements.
 * @property {string} archetype          e.g. 'rogue', 'tank', 'bruiser'.
 * @property {string[]} statuses         Known status ids, e.g. ['poison'].
 */

const DEFAULT_ENDPOINTS = Object.freeze({
  forge: '/api/forge',   // text prompt → ExtractedTags
  fuse: '/api/fuse',     // two monsters → combined ExtractedTags
  art: '/api/art',       // prompt → { url } (cloud-hosted asset)
});

export class AIPipeline {
  /**
   * @param {Object} [args]
   * @param {string} [args.baseUrl]                   Backend origin ('' = same origin).
   * @param {Partial<typeof DEFAULT_ENDPOINTS>} [args.endpoints]
   * @param {typeof fetch} [args.fetchImpl]           Injectable for tests/SSR.
   */
  constructor({ baseUrl = '', endpoints, fetchImpl } = {}) {
    this.baseUrl = baseUrl;
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...endpoints };
    this.fetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  }

  /** @param {string} key @param {any} body @returns {Promise<any>} */
  async _post(key, body) {
    if (!this.fetch) throw new Error('AIPipeline: no fetch implementation available');
    const res = await this.fetch(`${this.baseUrl}${this.endpoints[key]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`AIPipeline ${key} failed: ${res.status}`);
    return res.json();
  }

  /**
   * Parse a player's text prompt into validated DB tags. The backend runs the
   * LLM with the known-tag vocabulary and returns only in-schema values.
   * @param {string} prompt @returns {Promise<ExtractedTags>}
   */
  forgeTags(prompt) {
    return this._post('forge', { prompt });
  }

  /**
   * Fusion inheritance (spec §3B): Dominant type from A, Secondary from B, plus
   * an AI-mutated tertiary trait. The backend enforces the inheritance rules;
   * the caller still applies a local BudgetTemplate to the result.
   * @param {Monster} a @param {Monster} b @returns {Promise<ExtractedTags>}
   */
  fuseTags(a, b) {
    return this._post('fuse', {
      a: { id: a.id, types: a.types },
      b: { id: b.id, types: b.types },
    });
  }

  /**
   * Request card art. Returns a cloud URL to lazy-load + Service-Worker cache;
   * the image bytes never pass through the client's key.
   * @param {string} prompt @param {{ aspect?: string }} [opts]
   * @returns {Promise<{ url: string }>}
   */
  generateArt(prompt, opts = {}) {
    return this._post('art', { prompt, ...opts });
  }
}

/**
 * Compute the deterministic budget locally (no AI involved). This is the
 * authority a forged/fused monster is built against.
 * @param {Object} args
 * @param {number} args.runDepth        How far into the expedition (0-based).
 * @param {import('../types.js').CardRarity} [args.materialTier]
 * @returns {BudgetTemplate}
 */
export function budgetFor({ runDepth, materialTier = 'common' }) {
  const rarityRank = { basic: 0, common: 1, uncommon: 2, rare: 3 };
  const tier = rarityRank[materialTier] ?? 1;
  return {
    hp: 24 + runDepth * 4 + tier * 8,
    cardCount: 3,
    statBudget: 18 + runDepth * 2 + tier * 6,
    maxRarity: materialTier,
    maxTypes: Math.min(3, 1 + tier),
  };
}
