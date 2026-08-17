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
// ║   node scripts/bake_roster_pixellab.mjs --style=55  # BitForge: match the       ║
// ║        original illustration in art-refs/<id>.png (palette/shading/mood)         ║
// ║   flags: --size=128 --out=public/art/gen --view=side --shading=detailed_shading  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { decodePNG, resizeRGBA, encodePNG } from './png.mjs';

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
const SHADING = norm(flags.shading) || 'highly detailed shading';
const DETAIL = norm(flags.detail) || 'highly detailed';
const VIEW = norm(flags.view) || null;        // 'side' | 'low top-down' | 'high top-down'
const DIRECTION = norm(flags.direction) || null; // 'south' faces the viewer, etc.
const DELAY_MS = +(flags.delay || 800);
const REROLL = Math.round(+(flags.reroll || 0)) || 0;   // offset seeds to reroll a bad result

// ── STYLE-MATCH (BitForge) — pass --style=N (0..100) to render each creature via
// the BitForge model using its ORIGINAL illustration (art-refs/<id>.png) as the
// style anchor, so the pixel art inherits the original's palette/shading/mood.
// Without --style it uses PixFlux (text-only). Creatures with no own ref borrow a
// thematically-close sibling's.
const STYLE_STRENGTH = flags.style !== undefined ? Math.max(0, Math.min(100, +flags.style || 0)) : null;
const STYLE_GUIDE = Math.max(0, Math.min(20, +(flags.styleguide || 6)));   // extra_guidance_scale
const TEXT_GUIDE = +(flags.textguide || (STYLE_STRENGTH !== null ? 4 : 8)); // text_guidance_scale
const REF_DIR = (flags.refs || 'art-refs').replace(/\/$/, '');
const REF_FALLBACK = { emberdrake: 'emberwisp', grizzlord: 'voltfang', felhound: 'nightveil' };
const refFor = (id) => [id, REF_FALLBACK[id]].filter(Boolean).map((c) => `${REF_DIR}/${c}.png`).find((p) => existsSync(p)) || null;
// BitForge requires style_image to match the requested output size — downscale the ref.
const styleImageB64 = (refPath, size) => {
  const raw = decodePNG(readFileSync(refPath));
  const fit = raw.width === size && raw.height === size ? raw : resizeRGBA(raw, size, size);
  return Buffer.from(encodePNG(fit)).toString('base64');
};

// Shared style clause — keeps the whole set cohesive AND steers PixFlux toward the
// original illustrations' DNA (bold outlines, dramatic light, saturated, moody),
// since BitForge style-transfer from those painterly refs just produced mud.
const STYLE_SUFFIX = ', full body, single character, centered, clean readable silhouette, bold black outline, dramatic rim lighting, richly shaded, deep saturated colors, epic dark-fantasy monster-collector creature art, dynamic heroic pose';

// Per-creature art prompts — the durable asset. Vivid, subject-first descriptions.
const PROMPTS = {
  ironhide: 'a towering armored golem brawler in weathered olive-green and bronze plate armor, glowing red eyes behind a horned helmet, swinging a massive two-handed stone warhammer overhead mid-swing in a wide battle stance, a round shield on the off arm, hulking and furious, motion and impact',
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
  emberdrake: 'a fierce young fire dragon, red-orange scaled, rearing up with leathery wings spread wide, breathing a burst of flame, small curved horns, raking clawed talons, glowing amber eyes, menacing and dynamic',
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
    description: PROMPTS[id] + STYLE_SUFFIX,
    image_size: { width: SIZE, height: SIZE },
    no_background: true,
    outline: OUTLINE, shading: SHADING, detail: DETAIL,
    text_guidance_scale: TEXT_GUIDE,
    seed: (seedOf(id) + REROLL) % 2147483647,
    ...(VIEW ? { view: VIEW } : {}),
    ...(DIRECTION ? { direction: DIRECTION } : {}),
  };
  // BitForge (style-matched) when --style is set AND a reference exists; else PixFlux.
  const ref = STYLE_STRENGTH !== null ? refFor(id) : null;
  let styleB64 = null;
  if (ref && !DRY) {
    try { styleB64 = styleImageB64(ref, SIZE); }
    catch (e) { console.warn(`  (couldn't read style ref ${ref}: ${e.message} — using PixFlux)`); }
  }
  const useBitforge = ref && (DRY || styleB64);
  const endpoint = useBitforge ? 'generate-image-bitforge' : 'generate-image-pixflux';
  if (useBitforge && styleB64) {
    body.style_image = { type: 'base64', base64: styleB64, format: 'png' };
    body.style_strength = STYLE_STRENGTH;
    body.extra_guidance_scale = STYLE_GUIDE;
  } else if (STYLE_STRENGTH !== null && !ref) {
    console.warn(`  (no style ref for ${id} in ${REF_DIR}/ — using PixFlux)`);
  }
  if (DRY) { console.log(`\n[${id}] (${useBitforge ? `BitForge · style ${STYLE_STRENGTH} · ref ${ref} → ${SIZE}²` : 'PixFlux'})\n${body.description}`); return true; }
  const res = await fetch(`${BASE}/${endpoint}`, {
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
console.log(`${DRY ? 'DRY-RUN — ' : ''}PixelLab bake · ${list.length} creature(s) · ${SIZE}² · ${STYLE_STRENGTH !== null ? `BitForge (style-match ${STYLE_STRENGTH}, refs ${REF_DIR}/)` : 'PixFlux (text)'} · ${BASE}`);
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
