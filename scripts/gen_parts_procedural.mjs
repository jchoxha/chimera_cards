// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/gen_parts_procedural.mjs — draw creature parts as PIXEL ART in code ║
// ║ (raster, not SVG). Each part: (1) draw a clean SILHOUETTE in flat base      ║
// ║ colour (+ any distinct-material subshapes), (2) formShade() lights it as a  ║
// ║ rounded volume from one global sun, (3) crisp DETAIL on top (eyes, teeth,   ║
// ║ facets), (4) rim highlight, (5) dark outline. Immune to the AI failure      ║
// ║ modes, free, offline, coherent across the whole set.                        ║
// ║   node scripts/gen_parts_procedural.mjs   → previews in /tmp                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { writeFileSync } from 'fs';
import { canvas, px, disc, ellipse, rect, line, poly, ramp, formShade, rim, outline } from './pixelart.mjs';
import { encodePNG } from './png.mjs';
import { composeCreature } from '../src/render/composeCreature.js';

const S = 112;
const P = { Physical: '#b8b2a0', Fire: '#c85a34', Energy: '#d8b23e', Void: '#6b57a6', Nature: '#5ea63f', Steel: '#8f9bb0', Bone: '#e6ddc4', Wood: '#7a5330' };

// Each entry: { base, round, blur, draw(c,R), detail?(c,R) }
// R is the ramp for `base`. draw() lays the flat silhouette; detail() runs AFTER
// shading so eyes/teeth/facets stay crisp.
const PARTS = {
  'body-beast': {
    base: P.Fire, round: 0.08, blur: 12,
    draw(c, R) {
      ellipse(c, 56, 50, 32, 22, R.base);            // barrel
      ellipse(c, 32, 46, 17, 19, R.base);            // chest/shoulder
      ellipse(c, 82, 50, 18, 18, R.base);            // haunch
      poly(c, [[20, 40], [34, 30], [40, 46], [24, 50]], R.base);  // neck stub (head attaches here)
      for (const lx of [30, 46, 66, 82]) { rect(c, lx, 62, 8, 24, R.base); ellipse(c, lx + 4, 88, 6, 4, R.base); } // legs+paws
    },
    detail(c, R) { for (let x = 24; x < 88; x++) if ((x + 1) % 5 < 2) px(c, x, 30 + Math.round(Math.sin(x / 7) * 2), R.hi, 120); }, // spine glints
  },
  'body-humanoid': {
    base: P.Fire, round: 0.1, blur: 11,
    draw(c, R) {
      poly(c, [[44, 22], [68, 22], [72, 44], [66, 72], [70, 90], [42, 90], [46, 72], [40, 44]], R.base);
      rect(c, 26, 34, 9, 36, R.base); rect(c, 77, 34, 9, 36, R.base);   // arms
      ellipse(c, 56, 26, 16, 8, R.base);             // shoulders/neck stub
    },
  },
  'body-aberration': {
    base: P.Void, round: 0.06, blur: 13,
    draw(c, R) {
      ellipse(c, 56, 48, 32, 30, R.base);
      for (const tx of [34, 48, 64, 78]) for (let y = 0; y < 30; y++) disc(c, tx + Math.round(Math.sin(y / 4 + tx) * 3), 70 + y, Math.max(2, 5 - y / 8), R.base);
    },
    detail(c, R) { for (const [ex, ey] of [[46, 44], [64, 50], [56, 36]]) { disc(c, ex, ey, 4, R.hi); disc(c, ex, ey, 2, [235, 240, 245]); px(c, ex, ey, [20, 14, 30]); } },
  },
  'head-beast': {
    base: P.Fire, round: 0.09, blur: 8,
    draw(c, R) {
      poly(c, [[16, 52], [34, 30], [66, 28], [80, 46], [72, 62], [40, 66], [26, 58]], R.base);  // skull
      poly(c, [[16, 52], [30, 44], [28, 56]], R.base);          // snout tip
      poly(c, [[44, 30], [50, 12], [60, 30]], R.base);          // ear
      rect(c, 48, 60, 18, 16, R.base);                          // neck stub
    },
    detail(c, R) {
      disc(c, 44, 44, 3, [24, 16, 34]); px(c, 43, 43, [255, 240, 200]);   // eye + glint
      px(c, 20, 50, [30, 20, 34]);                                        // nostril
      for (let x = 20; x < 34; x++) px(c, x, 55, R.shadow);               // mouth line
      poly(c, [[22, 55], [25, 62], [28, 55]], [246, 240, 224]);           // fang
    },
  },
  'head-draconic': {
    base: P.Fire, round: 0.08, blur: 8,
    draw(c, R) {
      poly(c, [[12, 50], [40, 30], [72, 26], [82, 44], [70, 60], [34, 64], [22, 58]], R.base);  // long snout
      poly(c, [[60, 28], [70, 8], [76, 30]], P.Bone && R.base);   // brow horn (shaded as body)
      poly(c, [[48, 28], [55, 12], [60, 28]], R.base);
      rect(c, 48, 58, 18, 16, R.base);                            // neck stub
    },
    detail(c, R) {
      disc(c, 46, 42, 3, [240, 70, 40]); px(c, 45, 41, [255, 220, 160]);
      for (let x = 16; x < 30; x += 3) { poly(c, [[x, 52], [x + 1, 60], [x + 3, 52]], [246, 240, 224]); }  // teeth row
      for (let x = 24; x < 60; x++) if (x % 6 < 1) px(c, x, 34 + Math.round(Math.sin(x / 8) * 3), R.hi);   // scale glints
    },
  },
  'head-avian': {
    base: P.Physical, round: 0.09, blur: 8,
    draw(c, R) { disc(c, 56, 46, 24, R.base); rect(c, 50, 64, 16, 12, R.base); poly(c, [[34, 42], [8, 48], [34, 56]], [225, 165, 45]); },
    detail(c, R) { disc(c, 48, 42, 3, [24, 16, 34]); px(c, 47, 41, [255, 240, 200]); px(c, 18, 50, [140, 90, 20]); },
  },
  wings: {
    base: P.Physical, round: 0.11, blur: 7,
    draw(c, R) {
      poly(c, [[8, 54], [40, 22], [58, 30], [46, 40], [70, 34], [58, 50], [84, 46], [70, 62], [90, 62], [40, 74], [16, 66]], R.base);
    },
    detail(c, R) { for (let i = 0; i < 5; i++) line(c, 22, 58, 82 - i * 6, 34 + i * 9, R.shadow, 1, 150); },  // feather ribs
  },
  tail: {
    base: P.Fire, round: 0.12, blur: 6,
    draw(c, R) { for (let t = 0; t <= 64; t++) disc(c, 14 + t, 52 + Math.round(Math.sin(t / 15) * 22), Math.max(2, 11 - t / 7), R.base); },
    detail(c, R) { poly(c, [[74, 34], [90, 40], [74, 50]], R.hi); },   // tuft tip
  },
  horns: {
    base: P.Bone, round: 0.14, blur: 5,
    draw(c, R) { for (let t = 0; t <= 74; t++) disc(c, 50 + Math.round(Math.sin(t / 26) * 15), 90 - t, Math.max(1.5, 9 - t / 9), R.base); },
    detail(c, R) { for (let y = 34; y < 84; y += 7) line(c, 40, y, 60, y - 2, R.shadow, 1, 150); },  // ridges
  },
  teeth: {
    base: P.Bone, round: 0.16, blur: 3,
    draw(c) { poly(c, [[30, 22], [40, 78], [50, 22]], [246, 240, 224]); poly(c, [[56, 22], [66, 78], [76, 22]], [246, 240, 224]); },
  },
  claws: {
    base: P.Bone, round: 0.13, blur: 5,
    draw(c, R) { poly(c, [[42, 12], [60, 22], [55, 58], [47, 90], [42, 58], [34, 30]], R.base); },
    detail(c, R) { line(c, 47, 22, 49, 84, R.shadow, 1, 160); },
  },
  shard: {
    base: P.Energy, round: 0.17, blur: 4,
    draw(c, R) { poly(c, [[54, 8], [72, 48], [54, 96], [36, 48]], R.base); poly(c, [[54, 8], [72, 48], [54, 48]], R.shadow); },
    detail(c, R) { line(c, 54, 12, 54, 92, R.hi, 1); px(c, 46, 30, [255, 255, 245]); px(c, 45, 34, [255, 255, 245]); },  // facet ridge + sparkle
  },
  'w-sword': {
    base: P.Steel, round: 0.15, blur: 6,
    draw(c, R) {
      poly(c, [[46, 6], [58, 6], [56, 66], [46, 66]], R.base);   // blade
      rect(c, 34, 66, 34, 6, [110, 82, 42]);                     // guard
      rect(c, 47, 72, 10, 18, [110, 82, 42]);                    // grip
      disc(c, 52, 92, 5, [190, 158, 84]);                        // pommel
    },
    detail(c) { line(c, 52, 10, 52, 62, [250, 252, 255], 1); },  // fuller shine
  },
};

// ── render pipeline ──────────────────────────────────────────────────────────
const parts = {};
for (const [id, spec] of Object.entries(PARTS)) {
  const c = canvas(S);
  const R = ramp(spec.base);
  spec.draw(c, R);
  formShade(c, { roundness: spec.round, blur: spec.blur });
  spec.detail?.(c, R);
  rim(c, R.hi);
  outline(c, R.outline);
  parts[id] = c;
  writeFileSync(`/tmp/proc-${id}.png`, encodePNG(c));
}

// contact sheet on a checkerboard
const ids = Object.keys(PARTS), COLS = 5, CELL = S + 8, rows = Math.ceil(ids.length / COLS);
const sheet = { width: COLS * CELL, height: rows * CELL };
sheet.data = new Uint8ClampedArray(sheet.width * sheet.height * 4);
for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
  const chk = ((x >> 3) + (y >> 3)) & 1 ? 52 : 40, i = (y * sheet.width + x) * 4;
  sheet.data[i] = sheet.data[i + 1] = sheet.data[i + 2] = chk; sheet.data[i + 3] = 255;
}
ids.forEach((id, k) => {
  const ox = (k % COLS) * CELL + 4, oy = Math.floor(k / COLS) * CELL + 4, c = parts[id];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = c.data[(y * S + x) * 4 + 3]; if (!a) continue;
    const j = ((oy + y) * sheet.width + (ox + x)) * 4, si = (y * S + x) * 4;
    for (let ch = 0; ch < 3; ch++) sheet.data[j + ch] = c.data[si + ch]; sheet.data[j + 3] = 255;
  }
});
writeFileSync('/tmp/proc-sheet.png', encodePNG(sheet));

// one rig-accurate composed creature
const beast = { id: 'pv', name: 'Probe', biology: ['Beast'], family: 'Draconic', attunement: ['Fire'], anatomy: ['Wings', 'Tail', 'Horns', 'Teeth'] };
const baked = Object.fromEntries(ids.map((id) => [id, id]));
const { layers } = composeCreature(beast, { baked });
const W = 320, comp = { width: W, height: W, data: new Uint8ClampedArray(W * W * 4) };
for (let i = 0; i < W * W; i++) { comp.data[i * 4] = 28; comp.data[i * 4 + 1] = 22; comp.data[i * 4 + 2] = 18; comp.data[i * 4 + 3] = 255; }
for (const l of layers) {
  const src = parts[l.partId]; if (!src) continue;
  const bx = l.x * W, by = l.y * W, bw = l.w * W, bh = l.h * W;
  for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
    const sx = ((l.flip ? bw - 1 - dx : dx) / bw * S) | 0, sy = (dy / bh * S) | 0;
    const a = src.data[(sy * S + sx) * 4 + 3]; if (a < 40) continue;
    const si = (sy * S + sx) * 4, di = (((by + dy) | 0) * W + ((bx + dx) | 0)) * 4;
    for (let ch = 0; ch < 3; ch++) comp.data[di + ch] = src.data[si + ch]; comp.data[di + 3] = 255;
  }
}
writeFileSync('/tmp/proc-creature.png', encodePNG(comp));
console.log(`Rendered ${ids.length} parts → /tmp/proc-sheet.png + /tmp/proc-creature.png`);
