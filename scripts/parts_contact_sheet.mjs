// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/parts_contact_sheet.mjs — review a whole part bake in ONE image.    ║
// ║                                                                            ║
// ║   node scripts/parts_contact_sheet.mjs [out.png]                            ║
// ║                                                                            ║
// ║ A 46-part bake is too many files to open one by one, and the failures that  ║
// ║ matter are the ones you only notice side by side: a part whose palette      ║
// ║ drifted off the house style, a leftover backdrop halo, or the framed-icon   ║
// ║ artifact. Sprites are drawn over a CHECKERBOARD so transparency is visible  ║
// ║ rather than assumed.                                                       ║
// ║                                                                            ║
// ║ It also prints the two automatic quality gates per part (the same ones      ║
// ║ bake_parts_local.mjs rerolls on) so a suspect part can be re-baked by name. ║
// ║ Neither gate catches a WRONG SUBJECT — a beak rendered as a whole bird is   ║
// ║ geometrically perfect — which is exactly why the visual sheet exists.       ║
// ║ Zero dependencies, same as the bake script.                                ║
// ║ UPDATE WHEN: the quality gates change.                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { decodePNG, encodePNG, resizeRGBA } from './png.mjs';
import { borderRing } from './bake_parts_local.mjs';
import { assessCut } from '../src/lab/cutout.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'public', 'art', 'parts');
const MAX_RING = 0.45;

const rigSrc = readFileSync(join(ROOT, 'src', 'data', 'partsRig.js'), 'utf8');
const ids = [...new Set([...rigSrc.matchAll(/\{ id: '([\w-]+)'/g)].map((m) => m[1]))]
  .filter((id) => existsSync(join(OUT_DIR, `${id}.png`)));

if (!ids.length) {
  console.error('No baked parts in public/art/parts — run bake_parts_local.mjs first.');
  process.exit(1);
}

const CELL = 128, COLS = 8;
const W = COLS * CELL, H = Math.ceil(ids.length / COLS) * CELL;
const sheet = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const v = ((x >> 3) + (y >> 3)) % 2 ? 210 : 170;
    const d = (y * W + x) * 4;
    sheet.data[d] = sheet.data[d + 1] = sheet.data[d + 2] = v;
    sheet.data[d + 3] = 255;
  }
}

const suspect = [];
ids.forEach((id, i) => {
  const img = decodePNG(readFileSync(join(OUT_DIR, `${id}.png`)));
  const q = assessCut(img.data, img.width, img.height);
  const ring = borderRing(img);
  if (q.touchesEdge || ring > MAX_RING) suspect.push({ id, ring, edge: q.touchesEdge });

  const s = Math.min((CELL - 6) / img.width, (CELL - 6) / img.height);
  const sm = resizeRGBA(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
  const ox = (i % COLS) * CELL + ((CELL - sm.width) >> 1);
  const oy = Math.floor(i / COLS) * CELL + ((CELL - sm.height) >> 1);
  for (let y = 0; y < sm.height; y++) {
    for (let x = 0; x < sm.width; x++) {
      const si = (y * sm.width + x) * 4;
      const a = sm.data[si + 3] / 255;
      if (a <= 0.004) continue;
      const d = ((oy + y) * W + ox + x) * 4;
      for (let c = 0; c < 3; c++) sheet.data[d + c] = sm.data[si + c] * a + sheet.data[d + c] * (1 - a);
    }
  }
});

const out = process.argv[2] ?? join(ROOT, 'parts-contact-sheet.png');
writeFileSync(out, encodePNG(sheet));

console.log(`${ids.length} parts · ${COLS}×${Math.ceil(ids.length / COLS)} grid, reading order:`);
ids.forEach((id, i) => {
  if (i % COLS === 0) process.stdout.write('\n  ');
  process.stdout.write(id.padEnd(16));
});
console.log(`\n\nwrote ${out}`);
console.log(suspect.length
  ? `\nFlagged by the quality gates — re-bake by name:\n${suspect.map((s) => `  ${s.id.padEnd(16)} ring=${s.ring.toFixed(2)}${s.edge ? ' TOUCHES-EDGE' : ''}`).join('\n')}`
  : '\nQuality gates: all clear. Still eyeball the sheet for wrong subjects.');
