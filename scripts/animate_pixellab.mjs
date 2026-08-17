// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/animate_pixellab.mjs — turn a baked creature sprite into a WALKING,   ║
// ║ ALL-DIRECTIONS animated sprite sheet via PixelLab's /animate-with-text.       ║
// ║ For each facing (4 cardinal by default) it sends the base portrait as the     ║
// ║ reference_image + an action ("walk") + that direction, and gets back N frames.║
// ║ Frames are tiled into ONE sheet (row per direction, column per frame) plus a  ║
// ║ manifest the game can drive a sprite animator from.                           ║
// ║                                                                              ║
// ║ Same key handling as the baker (PIXELLAB_API_KEY env / .env; never committed).║
// ║ Runs from YOUR machine or CI (this dev container's proxy blocks pixellab.ai). ║
// ║                                                                              ║
// ║ USAGE:                                                                        ║
// ║   node scripts/animate_pixellab.mjs voltfang                    # 4-dir walk   ║
// ║   node scripts/animate_pixellab.mjs voltfang --dirs=8 --frames=6              ║
// ║   node scripts/animate_pixellab.mjs voltfang --action=run --view=side        ║
// ║   node scripts/animate_pixellab.mjs voltfang --dry             # plan, no net  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { decodePNG, resizeRGBA, encodePNG } from './png.mjs';

try { process.loadEnvFile('.env'); } catch { /* env vars may still be set */ }

const KEY = process.env.PIXELLAB_API_KEY || process.env.PIXELLAB_SECRET || '';
const BASE = (process.env.PIXELLAB_API_BASE_URL || 'https://api.pixellab.ai/v1').replace(/\/$/, '');

// ── CLI (same parser as the baker: --k=v, --k v, bare --flag) ──────────────────
const BOOL = new Set(['dry']);
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
const SIZE = Math.max(16, Math.min(64, Math.round(+(flags.size || 64)) || 64)); // /animate-with-text caps image_size at 64
const ACTION = norm(flags.action) || 'walk';
const VIEW = norm(flags.view) || 'low top-down';      // overworld-ish; 'side' for platformer
const FRAMES = Math.max(1, Math.min(20, Math.round(+(flags.frames || 4)) || 4));
const NDIRS = +(flags.dirs || 4) === 8 ? 8 : 4;
const SRC = (flags.src || 'public/art/gen').replace(/\/$/, '');
const OUT = (flags.out || 'public/art/anim').replace(/\/$/, '');
const DRY = !!flags.dry;
const DELAY_MS = +(flags.delay || 1200);

// PixelLab Direction enum. 4-dir = cardinal (down/right/up/left).
const DIR8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const DIRS = NDIRS === 8 ? DIR8 : ['south', 'east', 'north', 'west'];

const list = idArgs.length ? idArgs : ['voltfang'];

// /animate-with-text requires a `description` of the subject (identity comes from
// the reference_image; this tells it WHAT it's animating). Neutral, pose-free.
const DESCS = {
  voltfang: 'a feral lightning wolf with shaggy grey-blue fur and crackling cyan electricity, glowing electric-blue eyes, bared fangs',
  ironhide: 'a towering armored golem brawler in weathered olive-green and bronze plate armor, a horned helmet and glowing red eyes, carrying a warhammer',
  emberdrake: 'a young red-orange fire dragon with small curved horns and leathery wings, glowing amber eyes',
  nightveil: 'a hooded shadow assassin in a dark violet cloak wielding twin curved daggers',
  emberwisp: 'a small living-flame elemental, a wisp of orange-yellow fire with a single glowing eye',
  frostmind: 'a frost-mage in pale blue frost-rimed robes holding an icy crystal staff',
  grimsoul: 'an undead warlock in tattered dark robes with a gaunt skull face and a bone staff',
  dawnkeeper: 'a holy paladin in gleaming golden-and-white plate armor with a mace and shield',
  thornroot: 'a mossy green reptilian spirit-beast wrapped in thorny vines, glowing amber eyes',
  tidecaller: 'a water-shaman in flowing blue-green robes holding a coral staff',
  wildeye: 'a fierce raptor-bird with brown-and-green plumage, a hooked beak and taloned claws',
  cogwright: 'a boxy bronze-and-steel mechanical construct with glowing gauge eyes',
  maw: 'an eldritch void horror of dark writhing tentacles around a fanged maw with many glowing eyes',
  grizzlord: 'a massive brown grizzly bear-warrior in berserker armor wielding a battle-axe',
  felhound: 'a sleek black demonic hound etched with glowing red runes and burning red eyes',
};
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483647; };
const extractB64 = (img) => { if (!img) return null; const s = typeof img === 'string' ? img : (img.base64 || img.data || img.b64_json || ''); return s.replace(/^data:image\/\w+;base64,/, ''); };
const refB64 = (path) => { const raw = decodePNG(readFileSync(path)); const fit = raw.width === SIZE && raw.height === SIZE ? raw : resizeRGBA(raw, SIZE, SIZE); return Buffer.from(encodePNG(fit)).toString('base64'); };

if (!DRY && !KEY) { console.error('✗ No API key. Set PIXELLAB_API_KEY (env or a gitignored .env).'); process.exit(1); }
if (!DRY) mkdirSync(OUT, { recursive: true });

let total = 0;

async function animateDir(id, refImage, direction) {
  // Payload mirrors the official client's defaults so we don't trip a 422 on a
  // missing field, and exposes the guidance knobs (lower image guidance = less
  // "just copy the reference", more actual motion).
  const body = {
    image_size: { width: SIZE, height: SIZE },
    description: norm(flags.desc) || DESCS[id] || `a ${id} fantasy creature`,
    action: ACTION,
    reference_image: { type: 'base64', base64: refImage, format: 'png' },
    view: VIEW,
    direction,
    negative_description: '',
    text_guidance_scale: +(flags.textguide || 7.5),
    image_guidance_scale: +(flags.imgguide || 1.4),
    n_frames: FRAMES,
    start_frame_index: 0,
    init_image_strength: 300,
    seed: seedOf(id + direction),
  };
  const res = await fetch(`${BASE}/animate-with-text`, {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`  ✗ ${direction}: HTTP ${res.status} — ${(await res.text()).slice(0, 400)}`); return null; }
  const json = await res.json();
  total += json.usage?.usd ?? 0;
  const raw = json.images || json.frames || [];
  const frames = raw.map((im) => decodePNG(Buffer.from(extractB64(im), 'base64')));
  if (!frames.length) { console.error(`  ✗ ${direction}: 200 OK but no frames (response keys: ${Object.keys(json).join(', ')})`); return null; }
  return frames;
}

const blankCell = () => ({ width: SIZE, height: SIZE, data: new Uint8ClampedArray(SIZE * SIZE * 4) });
// tile rows[{dir,frames|null}] into one sheet, row per direction (blank if failed).
function buildSheet(rows) {
  const W = FRAMES * SIZE, H = rows.length * SIZE;
  const data = new Uint8ClampedArray(W * H * 4);
  rows.forEach((row, r) => {
    for (let f = 0; f < FRAMES; f++) {
      const cell = row.frames ? row.frames[Math.min(f, row.frames.length - 1)] : blankCell();
      const ox = f * SIZE, oy = r * SIZE;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const s = (y * cell.width + x) * 4, d = ((oy + y) * W + (ox + x)) * 4;
        data[d] = cell.data[s]; data[d + 1] = cell.data[s + 1]; data[d + 2] = cell.data[s + 2]; data[d + 3] = cell.data[s + 3];
      }
    }
  });
  return { width: W, height: H, data };
}

async function animate(id) {
  const src = `${SRC}/${id}.png`;
  if (!existsSync(src)) { console.error(`✗ ${id}: no base sprite at ${src} — bake it first.`); return; }
  console.log(`\n${id}: ${ACTION} · ${NDIRS} dirs · ${FRAMES} frames · ${VIEW} · ${SIZE}²`);
  if (DRY) { console.log(`  would POST /animate-with-text ×${DIRS.length} (${DIRS.join(', ')})`); return; }
  const ref = refB64(src);
  const rows = []; let ok = 0;
  mkdirSync(`${OUT}/${id}`, { recursive: true });
  for (const dir of DIRS) {
    const frames = await animateDir(id, ref, dir);
    if (frames) { ok++; frames.forEach((fr, fi) => writeFileSync(`${OUT}/${id}/${ACTION}-${dir}-${fi}.png`, encodePNG(fr))); }
    rows.push({ dir, frames });
    console.log(`  ${frames ? '✓' : '·'} ${dir} (${(frames || []).length} frames)`);
    if (dir !== DIRS[DIRS.length - 1]) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  if (!ok) { console.error(`✗ ${id}: all ${DIRS.length} directions FAILED (see errors above). No sheet written — nothing to disguise.`); return; }
  const sheet = buildSheet(rows);
  writeFileSync(`${OUT}/${id}-${ACTION}.png`, encodePNG(sheet));
  writeFileSync(`${OUT}/${id}-${ACTION}.json`, JSON.stringify({
    id, action: ACTION, view: VIEW, size: SIZE, frames: FRAMES,
    directions: DIRS, layout: 'row per direction, column per frame',
    sheet: `${id}-${ACTION}.png`,
  }, null, 2) + '\n');
  console.log(`  → ${OUT}/${id}-${ACTION}.png  (${sheet.width}×${sheet.height}) · ${ok}/${DIRS.length} dirs ok · individual frames in ${OUT}/${id}/`);
}

// Rebuild art/anim/index.json from every committed manifest so the persistent
// viewer (public/anim-preview.html) auto-lists all animations.
function rebuildIndex() {
  try {
    const entries = readdirSync(OUT)
      .filter((f) => f.endsWith('.json') && f !== 'index.json')
      .map((f) => { const m = JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')); return { id: m.id, action: m.action, sheet: m.sheet, size: m.size, frames: m.frames, directions: m.directions }; })
      .sort((a, b) => (a.id + a.action).localeCompare(b.id + b.action));
    writeFileSync(`${OUT}/index.json`, JSON.stringify(entries, null, 2) + '\n');
    console.log(`+ ${OUT}/index.json (${entries.length} animation(s))`);
  } catch (e) { console.warn(`⚠ could not rebuild index.json: ${e.message}`); }
}

console.log(`${DRY ? 'DRY-RUN — ' : ''}PixelLab animate · ${list.length} creature(s) · ${BASE}`);
for (const id of list) await animate(id);
if (!DRY) { rebuildIndex(); console.log(`\nDone${total ? `, total ≈ $${total.toFixed(4)}` : ''}. Review ${OUT}/ + the viewer at /anim-preview.html, then commit.`); }
