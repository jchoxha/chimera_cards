// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/subtypePool — descriptive-SUBTYPE card packages.    ║
// ║ A subtype (Mechanical/Elemental/Giant/Demonic) overlays a small card     ║
// ║ PACKAGE onto a creature's body-type kit (docs/biology-kits.md §9.2). Any ║
// ║ body type, any combination. Cards re-skin to the creature's attunement.  ║
// ║ Data in src/data/subtypeKit.json.                                        ║
// ╚══════════════════════════════════════════════════════════════════╝
import SUBTYPE_KIT from '../../data/subtypeKit.json';

export const SUBTYPE_KITS = Object.freeze(Object.keys(SUBTYPE_KIT.subtypes));

const clone = (c) => ({ ...c });

/** One subtype's card package (fresh copies). */
export function subtypePackage(subtype) {
  return (SUBTYPE_KIT.subtypes[subtype]?.cards ?? []).map(clone);
}

/**
 * Flatten the card packages for a creature's subtypes into a fresh CardSpec[].
 * Unknown subtypes resolve to nothing; de-duped by id.
 * @param {string|string[]} [subtypes]
 * @returns {Object[]}
 */
export function subtypeCards(subtypes = []) {
  const list = Array.isArray(subtypes) ? subtypes : subtypes != null ? [subtypes] : [];
  const out = [];
  const seen = new Set();
  for (const s of list) {
    for (const c of subtypePackage(s)) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
  }
  return out;
}
