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
  Parasitic: 'Parasite', Abyssal: 'Leviathan', Fungal: 'Fungus',
});

/** "<core noun>|<subtype>" → a fused name that REPLACES the noun and consumes the
 *  subtype. Reuses the synthesis matrix (`BIOLOGY_SYNTHESIS`) wherever the old
 *  9-biology pair maps onto a (form/family, subtype) combo; new names coined where
 *  the matrix had none. Fusions CHAIN (the fused name can fuse again with another
 *  subtype). Anything without a fusion falls back to ordered subtype prefixes, so
 *  this table is "comprehensive enough" — add a line to coin any new convention.
 *  (docs/biology-kits.md §9.6 has the generated reference list.) */
export const FUSIONS = Object.freeze({
  // ── Beast (Mammalian noun "Beast") — from the Beast|X matrix rows ──
  'Beast|Mechanical': 'Cybeast',     // Beast|Mechanical
  'Beast|Giant': 'Behemoth',         // Beast|Giant
  'Beast|Demonic': 'Felbeast',       // Beast|Demon
  'Beast|Elemental': 'Primal',       // Beast|Elemental
  'Beast|Undead': 'Stitched',        // Beast|Undead
  // ── Dragon (Draconic Beast) — from the Dragonkin|X matrix rows ──
  'Dragon|Mechanical': 'Geargon',    // Dragonkin|Mechanical
  'Dragon|Giant': 'Leviathan',       // Dragonkin|Giant
  'Dragon|Demonic': 'Hellwing',      // Dragonkin|Demon
  'Dragon|Elemental': 'Aspect',      // Dragonkin|Elemental
  'Dragon|Undead': 'Scourgewyrm',    // Dragonkin|Undead
  // ── Humanoid — from the Humanoid|X matrix rows ──
  'Humanoid|Mechanical': 'Augmented',// Humanoid|Mechanical
  'Humanoid|Giant': 'Half-Giant',    // Giant|Humanoid
  'Humanoid|Demonic': 'Fiend',       // Demon|Humanoid
  'Humanoid|Elemental': 'Attuned',   // Elemental|Humanoid
  'Humanoid|Undead': 'Ghoul',        // Humanoid|Undead
  // ── Aberration families — flagship fusions where the matrix name reads well;
  //    the rest stay readable prefix-form ("Mechanical Horror", "Giant Ooze"…) ──
  'Construct|Mechanical': 'Golem',   // a mechanical construct (cf. Elemental|Mechanical=Golem)
  'Horror|Demonic': 'Eldritch',      // Aberration|Demon=Eldritch
  'Wisp|Elemental': 'Elemental',     // a Formless elemental reads simply as "Elemental"
  // ── second-order fusions (a fused noun + another subtype) for iconic combos ──
  'Behemoth|Undead': 'Abomination',  // Giant+Undead Beast (cf. Giant|Undead=Abomination)
  'Fiend|Giant': 'Pitlord',          // Demon|Giant=Pitlord
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
