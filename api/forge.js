// POST /api/forge  { prompt: string }  →  ExtractedTags
// Maps a player's free-text monster idea onto strict DB tags. Flavor only —
// the engine assigns the stat/card budget separately (deterministic).
import { ELEMENTS, ARCHETYPES, STATUSES, sanitizeTags, extractJson, callAnthropic, readJsonBody, methodGuard } from './_shared.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const { prompt } = await readJsonBody(req);
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

    const instruction = [
      'You map a creature description onto a fixed game vocabulary. Reply ONLY with JSON:',
      '{ "elements": string[1-3], "archetype": string, "statuses": string[0-3] }',
      `elements MUST be from: ${ELEMENTS.join(', ')}.`,
      `archetype MUST be one of: ${ARCHETYPES.join(', ')}.`,
      `statuses MUST be from: ${STATUSES.join(', ')}.`,
      'Pick the closest matches. Do not invent values. No prose.',
      `Description: """${prompt.slice(0, 500)}"""`,
    ].join('\n');

    const text = await callAnthropic(instruction, 200);
    const tags = sanitizeTags(extractJson(text)); // double layer: prompt + server validation
    res.status(200).json(tags);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
