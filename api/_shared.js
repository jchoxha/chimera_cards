// ╔══════════════════════════════════════════════════════════════════╗
// ║ Serverless shared helpers: known-tag vocabulary, validation, and a  ║
// ║ provider call. Used by api/forge, api/fuse, api/art.                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// These run on a serverless backend (Vercel / Cloud Functions), NOT in the
// browser and NOT on GitHub Pages (Pages is static — see api/README.md). The
// generative-AI key lives ONLY here, read from an env var. The client never
// sees it.
//
// Flavor↔Mechanics boundary: the LLM may only MAP prompt text onto these
// pre-existing tags. Anything off-vocabulary is dropped. Stats/budget are
// computed by the engine (src/engine/ai/AIPipeline.budgetFor), never here.

export const ELEMENTS = [
  'pyre', 'frost', 'hydro', 'charge', 'aero', 'stone', 'metal', 'crystal',
  'toxin', 'flora', 'beast', 'lumen', 'aether', 'umbra', 'void', 'blood',
];

export const ARCHETYPES = ['bruiser', 'tank', 'rogue', 'caster', 'support', 'summoner', 'trickster'];

export const STATUSES = ['burn', 'poison', 'chill', 'soak', 'shock', 'vulnerable', 'weak', 'decay', 'regen', 'shield'];

/** Keep only known values from a list (case-insensitive), capped. */
export function whitelist(values, allowed, cap = Infinity) {
  const set = new Set(allowed);
  const out = [];
  for (const v of Array.isArray(values) ? values : []) {
    const k = String(v).toLowerCase().trim();
    if (set.has(k) && !out.includes(k)) out.push(k);
    if (out.length >= cap) break;
  }
  return out;
}

/** Validate/coerce a raw LLM tag object into the strict ExtractedTags shape. */
export function sanitizeTags(raw) {
  const elements = whitelist(raw?.elements, ELEMENTS, 3);
  return {
    elements: elements.length ? elements : ['beast'], // safe default
    archetype: whitelist([raw?.archetype], ARCHETYPES, 1)[0] ?? 'bruiser',
    statuses: whitelist(raw?.statuses, STATUSES, 3),
  };
}

/** Pull the first balanced {...} object out of model text. */
export function extractJson(text) {
  const t = String(text).replace(/```json/gi, '').replace(/```/g, '');
  const start = t.indexOf('{');
  if (start === -1) throw new Error('no JSON in model output');
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === '{') depth++;
    else if (t[i] === '}' && --depth === 0) return JSON.parse(t.slice(start, i + 1));
  }
  throw new Error('unbalanced JSON in model output');
}

/**
 * Call Anthropic Messages API (key from env). Returns concatenated text.
 * @param {string} prompt @param {number} [maxTokens]
 */
export async function callAnthropic(prompt, maxTokens = 400) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured on the server');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

/** Tiny body reader + JSON-method guard for Vercel/Node handlers. */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function methodGuard(req, res, method = 'POST') {
  if (req.method !== method) { res.status(405).json({ error: 'method not allowed' }); return false; }
  return true;
}
