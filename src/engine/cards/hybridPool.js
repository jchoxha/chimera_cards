// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/hybridPool — HYBRID signature cards. When a creature ║
// ║ spans TWO values on an axis (two body types, two subtypes, two elements)  ║
// ║ it unlocks bespoke cards that reward the pairing — beyond the union of the ║
// ║ two kits. Data in src/data/hybridKit.json (keys = the pair sorted+'+').    ║
// ║ Body/subtype pairs join the BASE pool (basePoolFor); attunement pairs join ║
// ║ the POTENTIAL pool raw (kept dual-element). docs/hybrid-design.md.         ║
// ╚══════════════════════════════════════════════════════════════════╝
import HYBRID_KIT from '../../data/hybridKit.json';

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v != null ? [v] : []);
const pairKey = (a, b) => [a, b].sort().join('+');

/** Every unordered pair key from a list of axis values. */
function pairKeys(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push(pairKey(list[i], list[j]));
  return out;
}

/** Signature cards unlocked by a creature's hybrid pairings (deduped, fresh copies).
 *  Pass any subset of axes; each matching pair contributes its cards.
 *  @param {{biology?:string|string[], subtypes?:string|string[], attunement?:string|string[]}} axes */
export function hybridCards({ biology, subtypes, attunement } = {}) {
  const out = []; const seen = new Set();
  const add = (cards) => { for (const c of cards || []) if (!seen.has(c.id)) { seen.add(c.id); out.push({ ...c }); } };
  for (const k of pairKeys(arr(biology))) add(HYBRID_KIT.bodyPairs?.[k]);
  for (const k of pairKeys(arr(subtypes))) add(HYBRID_KIT.subtypePairs?.[k]);
  for (const k of pairKeys(arr(attunement))) add(HYBRID_KIT.attunementPairs?.[k]);
  return out;
}

/** Just the body+subtype pair cards (for the BASE pool, pre-attunement-reskin). */
export const hybridBaseCards = (biology, subtypes) => hybridCards({ biology, subtypes });
/** Just the attunement-pair cards (for the POTENTIAL pool, kept dual-element). */
export const hybridAttunementCards = (attunement) => hybridCards({ attunement });
