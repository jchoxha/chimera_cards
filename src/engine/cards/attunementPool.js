// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/attunementPool — the attunement-own card pools   ║
// ║ (synthesis-matrix-spec §14.3). A creature attuned to an element adds    ║
// ║ that element's standalone cards to its potential pool, ALONGSIDE its    ║
// ║ archetype cards. Data in src/data/attunementCards.json.                ║
// ║ UPDATE WHEN: the attunement card pools or merge rules change.         ║
// ╚══════════════════════════════════════════════════════════════════╝

import POOLS from '../../data/attunementCards.json';

/**
 * Flatten the card pools for a creature's attunement(s) into a fresh CardSpec[].
 * Unknown / the `_note` key resolve to nothing.
 * @param {string[]} [attunements]  1–2 base attunement names.
 * @returns {Object[]}
 */
export function attunementCards(attunements = []) {
  const out = [];
  for (const a of attunements || []) {
    const pool = POOLS[a];
    if (Array.isArray(pool)) for (const c of pool) out.push({ ...c, effects: c.effects?.map((o) => ({ ...o })) });
  }
  return out;
}

/** The attunements that actually have an authored pool (excludes the `_note` key). */
export function attunementsWithPools() {
  return Object.keys(POOLS).filter((k) => Array.isArray(POOLS[k]));
}
