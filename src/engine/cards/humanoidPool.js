// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/humanoidPool — the Humanoid WEAPONS kit loader      ║
// ║ (docs/biology-kits.md §3.1). Humanoids draw their pool from their         ║
// ║ Archetype (warrior.json etc.); WEAPONS are the Humanoid analogue of Beast ║
// ║ anatomy — each adds a small card cluster and shows as a special factor.   ║
// ║ Each archetype is proficient with a subset (plausibility gate). Parallels ║
// ║ engine/cards/beastPool.js. Cards re-skin to the creature's attunement.    ║
// ║ Data in src/data/humanoidKit.json.                                       ║
// ╚══════════════════════════════════════════════════════════════════╝
import HUMANOID_KIT from '../../data/humanoidKit.json';

/** All weapon noun-tags, in display order. */
export const WEAPONS = Object.freeze(Object.keys(HUMANOID_KIT.weapons));

const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const clone = (c) => ({ ...c });

/** Weapon metadata { theme, cards[] } (or null for an unknown weapon). */
export function weaponInfo(weapon) {
  return HUMANOID_KIT.weapons[weapon] || null;
}

/** The weapons an archetype is proficient with (its plausibility gate). */
export function weaponsForArchetype(klass) {
  return HUMANOID_KIT.proficiency[klass] ?? [];
}

/** One weapon's card cluster (fresh copies). */
export function weaponCards(weapon) {
  return (HUMANOID_KIT.weapons[weapon]?.cards ?? []).map(clone);
}

/**
 * The card clusters for a set of weapons, flattened + de-duped by id. Unknown
 * weapons resolve to nothing. (Proficiency filtering, if wanted, is the caller's
 * job — pass only the archetype-legal weapons.)
 * @param {string|string[]} weapons
 * @returns {Object[]} CardSpec cards (Physical; re-skinned by the generator)
 */
export function humanoidWeaponPool(weapons) {
  const out = [];
  const seen = new Set();
  for (const w of arr(weapons)) {
    for (const c of weaponCards(w)) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
  }
  return out;
}

/** A sensible default weapon loadout for an archetype (its first 2 proficient weapons). */
export function defaultWeapons(klass) {
  return weaponsForArchetype(klass).slice(0, 2);
}
