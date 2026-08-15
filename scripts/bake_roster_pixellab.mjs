// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/bake_roster_pixellab.mjs — bake the roster's creature portraits via   ║
// ║ the PixelLab API (https://pixellab.ai). Text → pixel-art sprite per creature, ║
// ║ transparent background, saved to public/art/gen/<id>.png — the SAME output    ║
// ║ contract as the retired RD/agy bakers, so it's a drop-in art source.          ║
// ║                                                                              ║
// ║ The API KEY is read from env (PIXELLAB_API_KEY) or a gitignored .env — NEVER  ║
// ║ hard-coded (this repo + its Pages site are public). Nothing here is committed ║
// ║ but the code + prompts; the key stays on your machine.                        ║
// ║                                                                              ║
// ║ Endpoint: POST {base}/generate-image-pixflux  (synchronous; returns base64).  ║
// ║   Auth: Authorization: Bearer <key>                                           ║
// ║   Body: { description, image_size:{width,height}, no_background, outline,      ║
// ║          shading, detail, text_guidance_scale, seed, [view], [direction] }     ║
// ║   Resp: { image:<base64>, usage:{ type:'usd', usd:<n> } }                      ║
// ║                                                                              ║
// ║ USAGE (run from YOUR machine — this dev container's proxy blocks pixellab.ai): ║
// ║   PIXELLAB_API_KEY=sk-... node scripts/bake_roster_pixellab.mjs            # all║
// ║   node scripts/bake_roster_pixellab.mjs voltfang ironhide emberdrake  # subset ║
// ║   node scripts/bake_roster_pixellab.mjs --dry            # print prompts, no net║
// ║   flags: --size=128 --out=public/art/gen --view=side --shading='detailed shading'║
// ╚══════════════════════════════════════════════════════════════════╝

import { writeFileSync, readFileSync, mkdirSync } from 'fs';

try { process.loadEnvFile('.env'); } catch { /* no .env — env vars may still be set */ }

const KEY = process.env.PIXELLAB_API_KEY || process.env.PIXELLAB_SECRET || '';
const BASE = (process.env.PIXELLAB_API_BASE_URL || 'https://api.pixellab.ai/v1').replace(/\/$/, '');

// ── CLI ──────────────────────────────────────────────────────────────────────
// Accepts BOTH `--key=value` and `--key value`; bare `--flag` is a boolean.
// Multi-word values can use underscores (`medium_shading`) so they survive the CI
// workflow's word-splitting — underscores are turned back into spaces below.
const BOOL = new Set(['dry', 'sample', 'no-manifest']);
const flags = {}; const idArgs = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq >= 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else { const key = a.slice(2); flags[key] = (!BOOL.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
  } else idArgs.push(a);
}
const norm = (v) => (typeof v === 'string' ? v.replace(/_/g, ' ') : v);
const SIZE = Math.max(16, Math.min(400, Math.round(+(flags.size || 128)) || 128)); // API accepts 16..400
const OUT = (flags.out || 'public/art/gen').replace(/\/$/, '');
const DRY = !!flags.dry;
const OUTLINE = norm(flags.outline) || 'single color black outline';
const SHADING = norm(flags.shading) || 'detailed shading';
const DETAIL = norm(flags.detail) || 'highly detailed';
const VIEW = norm(flags.view) || null;        // 'side' | 'low top-down' | 'high top-down'
const DIRECTION = norm(flags.direction) || null; // 'south' faces the viewer, etc.
const DELAY_MS = +(flags.delay || 800);

// Shared style clause — keeps the whole set cohesive (PixelLab already draws pixel
// art, so this describes SUBJECT + composition, not the medium).
const STYLE = ', full body, single character, centered, clean readable silhouette, cohesive fantasy monster-collector creature design, vibrant colors, dynamic pose';

// Per-creature art prompts — the durable asset. Vivid, subject-first descriptions.
const PROMPTS = {
  ironhide: 'a towering armored golem brawler in weathered olive-green and bronze plate armor, glowing red eyes behind a horned helmet, hefting a massive stone maul over one shoulder, a round shield on the other arm, hulking and immovable',
  voltfang: 'a feral lightning wolf with shaggy grey-blue fur, crackling cyan electricity arcing across its back, glowing electric-blue eyes and bared fangs, prowling on all fours',
  nightveil: 'a hooded shadow-assassin, slender in a dark violet cloak, wielding twin curved daggers, face hidden in shadow with faint glowing eyes, wisps of darkness trailing behind',
  emberwisp: 'a small living-flame elemental, a floating wisp of translucent orange-yellow fire with a single glowing eye at its molten core, trailing embers',
  frostmind: 'a robed frost-mage in pale blue robes rimed with frost, holding an icy crystal staff, cold glowing eyes, snowflakes drifting around, calm and controlled',
  grimsoul: 'an undead warlock in tattered dark robes, a gaunt skull-like face with hollow glowing purple eyes, gripping a bone staff wreathed in necrotic shadow',
  dawnkeeper: 'a holy paladin protector in gleaming golden-and-white plate armor, a radiant mace and shield, a soft halo of warm light, benevolent and steadfast',
  thornroot: 'a reptilian spirit-beast, a mossy green scaled lizard wrapped in thorny vines and leaves, venom dripping from its fangs, a long tail, glowing amber eyes',
  tidecaller: 'a water-shaman wreathed in flowing blue-green robes like living water, holding a coral staff, a translucent watery form, serene, droplets orbiting',
  wildeye: 'a fierce hunter raptor-bird with brown-and-green plumage, a sharp hooked beak, spread wings, taloned claws, piercing alert eyes',
  cogwright: 'a mechanical engineer construct with a boxy bronze-and-steel riveted body, glowing gauge eyes, a wrench-arm and a bolted shield, steampunk',
  maw: 'an eldritch void horror, a dark writhing mass of tentacles around a huge fanged maw, many glowing eyes, purple-black and otherworldly',
  emberdrake: 'a young fire dragon, a chunky red-orange scaled drake with small horns, leathery wings, a fanged snout breathing embers, clawed feet, glowing amber eyes',
  grizzlord: 'a bear-warrior chimera, a massive brown grizzly standing upright in berserker armor, swinging a battle-axe, roaring with claws and teeth bared',
  felhound: 'a demonic hound, a sleek black-furred beast etched with glowing red cursed runes, burning red eyes, bared fangs, wisps of hellfire, sinister',
};

const seedOf = (id) => { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483647; };
const extractB64 = (img) => {
  if (!img) return null;
  const s = typeof img === 'string' ? img : (img.base64 || img.data || img.b64_json || img.image || '');
  return s.replace(/^data:image\/\w+;base64,/, '');
};

const list = (idArgs.length ? idArgs : Object.keys(PROMPTS)).filter((id) => {
  if (PROMPTS[id]) return true; console.warn(`⚠ unknown creature id: ${id}`); return false;
});

if (!DRY && !KEY) {
  console.error('✗ No API key. Set PIXELLAB_API_KEY (env or a gitignored .env file) — never commit it.\n' +
    '  Example:  PIXELLAB_API_KEY=sk-xxxx node scripts/bake_roster_pixellab.mjs\n' +
    '  Or dry-run the prompts with:  node scripts/bake_roster_pixellab.mjs --dry');
  process.exit(1);
}
if (!DRY) mkdirSync(OUT, { recursive: true });

async function bake(id) {
  const body = {
    description: PROMPTS[id] + STYLE,
    image_size: { width: SIZE, height: SIZE },
    no_background: true,
    outline: OUTLINE, shading: SHADING, detail: DETAIL,
    text_guidance_scale: 8,
    seed: seedOf(id),
    ...(VIEW ? { view: VIEW } : {}),
    ...(DIRECTION ? { direction: DIRECTION } : {}),
  };
  if (DRY) { console.log(`\n[${id}]\n${body.description}`); return true; }
  const res = await fetch(`${BASE}/generate-image-pixflux`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`✗ ${id}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`); return false; }
  const json = await res.json();
  const b64 = extractB64(json.image);
  if (!b64) { console.error(`✗ ${id}: no image in response (${Object.keys(json).join(', ')})`); return false; }
  writeFileSync(`${OUT}/${id}.png`, Buffer.from(b64, 'base64'));
  const cost = json.usage?.usd ?? 0; total += cost;
  console.log(`✓ ${id} → ${OUT}/${id}.png  (${SIZE}²${cost ? `, $${cost.toFixed(4)}` : ''})`);
  return true;
}

let total = 0;
const baked = [];
console.log(`${DRY ? 'DRY-RUN — ' : ''}PixelLab bake · ${list.length} creature(s) · ${SIZE}² · ${BASE}`);
for (const id of list) {
  if (await bake(id)) baked.push(id);
  if (!DRY && DELAY_MS && id !== list[list.length - 1]) await new Promise((r) => setTimeout(r, DELAY_MS));
}

// Keep the art manifest in sync so baked portraits actually render in-game.
if (!DRY && !flags['no-manifest'] && baked.length && OUT.endsWith('art/gen')) {
  try {
    const MAN = 'src/data/creatureArt.json';
    const cur = JSON.parse(readFileSync(MAN, 'utf8'));
    const merged = [...new Set([...cur, ...baked])];
    if (merged.length !== cur.length) { writeFileSync(MAN, JSON.stringify(merged) + '\n'); console.log(`+ ${MAN}: +${merged.length - cur.length} id(s)`); }
  } catch (e) { console.warn(`⚠ could not update creatureArt.json: ${e.message}`); }
}
if (!DRY) console.log(`\nDone — ${baked.length}/${list.length} baked${total ? `, total ≈ $${total.toFixed(4)}` : ''}. Review public/art/gen/, then commit.`);
