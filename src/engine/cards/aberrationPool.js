// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/aberrationPool — the Aberration biology kit loader  ║
// ║ (docs/biology-kits.md §9.1). Aberration is the catch-all FORM; its kit   ║
// ║ mirrors Beast's {family, anatomy[]} — WIDE families (Eldritch/Construct/  ║
// ║ Ooze/Flora/Crystalline/Formless) + aberrant-feature 'anatomy' tags        ║
// ║ (Tentacle/Eye/Maw/…). Data in src/data/aberrationKit.json. Cards re-skin   ║
// ║ to the creature's attunement, exactly like beastPool.                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import ABERRATION_KIT from '../../data/aberrationKit.json';

export const ABERRATION_FAMILIES = Object.freeze(Object.keys(ABERRATION_KIT.families));
export const ABERRATION_ANATOMY = Object.freeze(Object.keys(ABERRATION_KIT.anatomy));

const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const clone = (c) => ({ ...c });

export function aberrationFamilyInfo(family) { return ABERRATION_KIT.families[family] || null; }
export function anatomyForAberrationFamily(family) { return ABERRATION_KIT.families[family]?.anatomy ?? []; }
export function aberrationFamilySignatures(family) { return (ABERRATION_KIT.families[family]?.signatures ?? []).map(clone); }
export function aberrationAnatomyCards(tag) { return (ABERRATION_KIT.anatomy[tag]?.cards ?? []).map(clone); }
export function aberrationAnatomyInfo(tag) { return ABERRATION_KIT.anatomy[tag] || null; }

/** Build an aberration's pool: family signatures ∪ each allowed anatomy tag's cluster. */
export function aberrationPool({ family, anatomy } = {}) {
  const allowed = new Set(anatomyForAberrationFamily(family));
  const tags = arr(anatomy).filter((t) => allowed.has(t));
  const out = [];
  const seen = new Set();
  const push = (cards) => { for (const c of cards) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } };
  push(aberrationFamilySignatures(family));
  // Feature cards carry their tag as `factor` (see beastPool) for starter coverage.
  for (const t of tags) push(aberrationAnatomyCards(t).map((c) => ({ ...c, factor: t })));
  return out;
}

/** A sensible default aberrant-feature loadout for a family (its first 3 allowed tags). */
export function defaultAberrationAnatomy(family) { return anatomyForAberrationFamily(family).slice(0, 3); }
