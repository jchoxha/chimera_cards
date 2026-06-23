// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/rewards — draft card rewards from the PARTY's own    ║
// ║ potential pool (archetype + attunement cards), on the unified rarity     ║
// ║ ladder. Replaces the legacy roster-pool reward drafter. Pure (rng        ║
// ║ injected). The combined pool is built/stored at run start (app layer).   ║
// ║ UPDATE WHEN: reward rarity weighting or the pool shape changes.         ║
// ╚══════════════════════════════════════════════════════════════════╝

// Reward rarity weights (basic cards never appear in rewards). REVIEW/tunable.
const RARITY_WEIGHT = Object.freeze({
  common: 5, uncommon: 3, rare: 2, epic: 1, mythic: 0.6, legendary: 0.4, godly: 0.2,
});

/** Dedupe a combined pool by base card id (creatures may share cards). */
export function dedupePool(pool) {
  const seen = new Set();
  const out = [];
  for (const c of pool || []) {
    const base = String(c.id).split('#')[0];
    if (seen.has(base)) continue;
    seen.add(base);
    out.push({ ...c, id: base });
  }
  return out;
}

/**
 * Draft `count` distinct reward cards from a pool, weighted toward lower rarities.
 * @param {Object[]} pool   the party's combined potential pool (deduped or not)
 * @param {number} [count]
 * @param {() => number} [rng]
 * @returns {Object[]} fresh card copies
 */
export function draftRunReward(pool, count = 3, rng = Math.random) {
  const candidates = dedupePool(pool).filter((c) => c.rarity !== 'basic');
  const out = [];
  const used = new Set();
  while (out.length < count && used.size < candidates.length) {
    const avail = candidates.filter((c) => !used.has(c.id));
    const total = avail.reduce((s, c) => s + (RARITY_WEIGHT[c.rarity] ?? 1), 0);
    if (total <= 0) break;
    let r = rng() * total;
    let pick = avail[avail.length - 1];
    for (const c of avail) { if ((r -= (RARITY_WEIGHT[c.rarity] ?? 1)) <= 0) { pick = c; break; } }
    used.add(pick.id);
    out.push({ ...pick, effects: Array.isArray(pick.effects) ? pick.effects.map((o) => ({ ...o })) : pick.effects });
  }
  return out;
}
