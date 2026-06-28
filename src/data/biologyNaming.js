// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/biologyNaming — the creature's display "biology" name. EASY  ║
// ║ TO EXTEND: a name is built from (body type[s] + Beast/Aberration FAMILY +  ║
// ║ descriptive SUBTYPES) via two tiny data tables you can edit by hand:       ║
// ║   • FAMILY_NOUN  — the noun a family contributes (Draconic → "Dragon").    ║
// ║   • FUSIONS      — "<Noun>|<Subtype>" → a fused name (Dragon+Giant →        ║
// ║                    "Leviathan"), consuming that subtype.                    ║
// ║ Anything not fused falls back to ordered subtype PREFIXES + the noun, e.g. ║
// ║ a Giant + Undead Draconic Beast → "Undead Leviathan". Add a line to either ║
// ║ table to coin a new convention. (docs/biology-kits.md §9.5.)               ║
// ╚══════════════════════════════════════════════════════════════════╝
import { BODY_TYPES, synthName, orderSubtypes } from './synthesis.js';

const listOf = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);

/** A Beast/Aberration FAMILY → the noun it lends the name (defaults to the family
 *  name; override here for flavor). Humanoids contribute no family noun (their
 *  Archetype lives in the card corner, not the name). */
export const FAMILY_NOUN = Object.freeze({
  // Beast families
  Mammalian: 'Beast', Reptilian: 'Reptile', Avian: 'Bird', Piscine: 'Fish',
  Insectoid: 'Insect', Amphibian: 'Amphibian', Draconic: 'Dragon',
  // Aberration families (kit TBD; nouns ready)
  Eldritch: 'Horror', Construct: 'Construct', Ooze: 'Ooze', Flora: 'Flora',
  Crystalline: 'Crystal', Formless: 'Wisp',
});

/** "<core noun>|<subtype>" → a fused name that REPLACES the noun and consumes the
 *  subtype. Authored from the synthesis matrix; add lines freely. Fusions chain
 *  (the fused name can fuse again with another subtype). */
export const FUSIONS = Object.freeze({
  // Dragon (Draconic Beast) fusions
  'Dragon|Giant': 'Leviathan',
  'Dragon|Undead': 'Scourgewyrm',
  'Dragon|Mechanical': 'Geargon',
  'Dragon|Demonic': 'Hellwing',
  // generic Beast fusions
  'Beast|Giant': 'Behemoth',
  'Beast|Mechanical': 'Cybeast',
  'Beast|Demonic': 'Felbeast',
  'Beast|Undead': 'Stitched',
  // Humanoid fusions (cyborgs/giants stay "Mechanical/Giant Humanoid"; only the
  // fully-transformed read as their own noun)
  'Humanoid|Demonic': 'Fiend',
  'Humanoid|Undead': 'Ghoul',
});

/**
 * The full display name of a creature's biology.
 * @param {string|string[]} bodyTypes   1–2 of Humanoid/Beast/Aberration
 * @param {string|string[]} families    the Beast/Aberration family (single-body only)
 * @param {string[]} subtypes           descriptive subtypes (Mechanical/Giant/…)
 * @returns {string} e.g. "Undead Leviathan", "Elemental Aberration", "Giant Demonic Mechanical Chimera"
 */
export function biologyDisplayName(bodyTypes = [], families = [], subtypes = []) {
  const bts = listOf(bodyTypes).filter(Boolean);
  let subs = orderSubtypes(subtypes);

  // 1. Base noun: a hybrid uses the body-type synthesis name (Chimera/Anomalous/
  //    Warped); a single body uses its family noun, else the body-type name.
  let core;
  if (bts.length >= 2) {
    core = synthName('biology', bts[0], bts[1]);
  } else {
    const fam = listOf(families)[0];
    core = (fam && FAMILY_NOUN[fam]) || fam || bts[0] || '';
  }

  // 2. Fuse subtypes into the noun where a FUSIONS entry exists (chains).
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of subs) {
      const fused = FUSIONS[`${core}|${s}`];
      if (fused) { core = fused; subs = subs.filter((x) => x !== s); changed = true; break; }
    }
  }

  // 3. Leftover subtypes become ordered prefixes.
  return [...subs, core].filter(Boolean).join(' ');
}

// re-export so callers have one import for everything naming-related
export { BODY_TYPES };
