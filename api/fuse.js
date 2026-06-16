// POST /api/fuse  { a: {types}, b: {types} }  →  ExtractedTags
// Fusion inheritance (spec §3B): Dominant type from A, Secondary from B, plus an
// AI-mutated tertiary element. Mechanics/budget stay engine-side.
import { ELEMENTS, sanitizeTags, extractJson, callAnthropic, whitelist, readJsonBody, methodGuard } from './_shared.js';

/** @param {{types?: {type:string,weight:number}[]}} m */
function dominantType(m) {
  const types = (m?.types || []).slice().sort((x, y) => (y.weight || 0) - (x.weight || 0));
  return types[0]?.type;
}

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const { a, b } = await readJsonBody(req);
    const dominant = whitelist([dominantType(a)], ELEMENTS, 1)[0];
    const secondary = whitelist([dominantType(b)], ELEMENTS, 1)[0];
    if (!dominant || !secondary) return res.status(400).json({ error: 'both monsters need a valid dominant type' });

    const instruction = [
      'Two creatures fuse. Choose ONE tertiary element that thematically bridges them.',
      `Reply ONLY JSON: { "tertiary": string }. It MUST be from: ${ELEMENTS.join(', ')},`,
      `and different from "${dominant}" and "${secondary}". No prose.`,
      `Creature A dominant: ${dominant}. Creature B dominant: ${secondary}.`,
    ].join('\n');

    let tertiary;
    try { tertiary = whitelist([extractJson(await callAnthropic(instruction, 60)).tertiary], ELEMENTS, 1)[0]; }
    catch { tertiary = undefined; } // tertiary mutation is best-effort

    const elements = [dominant, secondary, tertiary].filter((e, i, arr) => e && arr.indexOf(e) === i).slice(0, 3);
    res.status(200).json(sanitizeTags({ elements, archetype: 'bruiser', statuses: [] }));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
