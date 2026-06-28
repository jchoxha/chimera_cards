// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/beastPool — the Beast biology kit loader            ║
// ║ (docs/biology-kits.md §3.2). A beast is {family, anatomy[]}; its card     ║
// ║ pool = the family's signature cards ∪ each anatomy tag's card cluster.    ║
// ║ Parallels engine/cards/attunementPool.js. The pool is authored Physical;  ║
// ║ the generator re-skins it to the creature's attunement (like archetype    ║
// ║ cards). Data lives in src/data/beastKit.json.                            ║
// ║ UPDATE WHEN: a family/anatomy is added or a Beast card changes.          ║
// ╚══════════════════════════════════════════════════════════════════╝
import BEAST_KIT from '../../data/beastKit.json';

/** All scientific Beast families, in display order. */
export const BEAST_FAMILIES = Object.freeze(Object.keys(BEAST_KIT.families));
/** All anatomy noun-tags (the body parts that build pool bulk). */
export const BEAST_ANATOMY = Object.freeze(Object.keys(BEAST_KIT.anatomy));

const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const clone = (c) => ({ ...c });

/** Family metadata { theme, anatomy[], signatures[] } (or null for an unknown family). */
export function beastFamilyInfo(family) {
  return BEAST_KIT.families[family] || null;
}

/** The anatomy tags a family is allowed to draw cards from (plausibility gate). */
export function anatomyForFamily(family) {
  return BEAST_KIT.families[family]?.anatomy ?? [];
}

/** A family's signature cards (fresh copies). */
export function familySignatures(family) {
  return (BEAST_KIT.families[family]?.signatures ?? []).map(clone);
}

/** One anatomy tag's card cluster (fresh copies). */
export function anatomyCards(tag) {
  return (BEAST_KIT.anatomy[tag]?.cards ?? []).map(clone);
}

/**
 * Build a beast's potential pool: family signatures ∪ the card clusters of every
 * anatomy tag the creature has. Unknown/disallowed anatomy is filtered out (an
 * anatomy not legal for the family is ignored). De-duped by card id.
 * @param {{ family?: string, anatomy?: string|string[] }} beast
 * @returns {Object[]} CardSpec cards (Physical; re-skinned by the generator)
 */
export function beastPool({ family, anatomy } = {}) {
  const allowed = new Set(anatomyForFamily(family));
  const tags = arr(anatomy).filter((t) => allowed.has(t));
  const out = [];
  const seen = new Set();
  const push = (cards) => { for (const c of cards) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } };
  push(familySignatures(family));
  for (const t of tags) push(anatomyCards(t));
  return out;
}

/** A sensible default anatomy loadout for a family (its first 3 allowed tags) —
 *  used when a beast is generated without an explicit anatomy list. */
export function defaultAnatomy(family) {
  return anatomyForFamily(family).slice(0, 3);
}
