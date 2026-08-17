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

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
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
const SIZE = Math.max(16, Math.min(400, Math.round(+(flags.size || 128)) || 128));
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
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483647; };
const extractB64 = (img) => { if (!img) return null; const s = typeof img === 'string' ? img : (img.base64 || img.data || img.b64_json || ''); return s.replace(/^data:image\/\w+;base64,/, ''); };
const refB64 = (path) => { const raw = decodePNG(readFileSync(path)); const fit = raw.width === SIZE && raw.height === SIZE ? raw : resizeRGBA(raw, SIZE, SIZE); return Buffer.from(encodePNG(fit)).toString('base64'); };

if (!DRY && !KEY) { console.error('✗ No API key. Set PIXELLAB_API_KEY (env or a gitignored .env).'); process.exit(1); }
if (!DRY) mkdirSync(OUT, { recursive: true });

let total = 0;

async function animateDir(id, refImage, direction) {
  const body = {
    image_size: { width: SIZE, height: SIZE },
    action: ACTION,
    reference_image: { type: 'base64', base64: refImage, format: 'png' },
    view: VIEW,
    direction,
    n_frames: FRAMES,
    seed: seedOf(id + direction),
  };
  const res = await fetch(`${BASE}/animate-with-text`, {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`  ✗ ${id} ${direction}: HTTP ${res.status} ${(await res.text()).slice(0, 240)}`); return null; }
  const json = await res.json();
  total += json.usage?.usd ?? 0;
  const frames = (json.images || []).map((im) => decodePNG(Buffer.from(extractB64(im), 'base64')));
  if (!frames.length) { console.error(`  ✗ ${id} ${direction}: no frames returned`); return null; }
  return frames;
}

// tile [dir][frame] RGBA cells into one sheet, row per direction.
function buildSheet(rows) {
  const W = FRAMES * SIZE, H = rows.length * SIZE;
  const data = new Uint8ClampedArray(W * H * 4);
  rows.forEach((frames, r) => {
    for (let f = 0; f < FRAMES; f++) {
      const cell = frames[Math.min(f, frames.length - 1)];
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
  const rows = [];
  for (const dir of DIRS) {
    const frames = await animateDir(id, ref, dir);
    rows.push(frames || Array(FRAMES).fill(decodePNG(readFileSync(src))));   // fallback: static base
    console.log(`  ${frames ? '✓' : '·'} ${dir} (${(frames || []).length} frames)`);
    if (dir !== DIRS[DIRS.length - 1]) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  const sheet = buildSheet(rows);
  writeFileSync(`${OUT}/${id}-${ACTION}.png`, encodePNG(sheet));
  writeFileSync(`${OUT}/${id}-${ACTION}.json`, JSON.stringify({
    id, action: ACTION, view: VIEW, size: SIZE, frames: FRAMES,
    directions: DIRS, layout: 'row per direction, column per frame',
    sheet: `${id}-${ACTION}.png`,
  }, null, 2) + '\n');
  console.log(`  → ${OUT}/${id}-${ACTION}.png  (${sheet.width}×${sheet.height})`);
}

console.log(`${DRY ? 'DRY-RUN — ' : ''}PixelLab animate · ${list.length} creature(s) · ${BASE}`);
for (const id of list) await animate(id);
if (!DRY) console.log(`\nDone${total ? `, total ≈ $${total.toFixed(4)}` : ''}. Review ${OUT}/, then commit.`);
