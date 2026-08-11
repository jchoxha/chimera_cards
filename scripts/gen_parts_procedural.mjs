// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/gen_parts_procedural.mjs — draw creature parts as PIXEL ART in code ║
// ║ (raster, not SVG), à la the Pillow/Fable approach: limited palette, base +  ║
// ║ shadow + highlight ramp, hard 1px outline, a touch of dither. Immune to the ║
// ║ AI failure modes (a beak is exactly the pixels drawn — never a whole bird,  ║
// ║ never mis-cropped), free, offline, instant, and coherent across the set.    ║
// ║                                                                            ║
// ║ PROBE build: a representative slice (organic bodies/heads + the parts the AI ║
// ║ got wrong + a geometric weapon/crystal) rendered to /tmp for review, plus   ║
// ║ one rig-accurate composed creature (placement via composeCreature).         ║
// ║   node scripts/gen_parts_procedural.mjs                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { writeFileSync } from 'fs';
import { canvas, px, disc, ellipse, rect, line, poly, ramp, dither, outline, shade } from './pixelart.mjs';
import { encodePNG } from './png.mjs';
import { composeCreature } from '../src/render/composeCreature.js';

const S = 96;                       // native pixel-art canvas
const P = { Physical: '#c9c4b0', Fire: '#e0663a', Energy: '#e6c34a', Void: '#6b57a6', Nature: '#6ab24a' };

// ── part draw functions (id → (canvas, ramp) => void) ───────────────────────
// Each draws INSIDE its own S×S box, centered with margin, in the rig's fixed
// orientation (head faces left, wing points right, etc.). shade()+outline() run
// after, so functions mostly plot the BASE colour and a few detail pixels.

const DRAW = {
  'body-beast': (c, r) => {
    // four-legged torso, side view facing left. Chunky haunches + legs.
    ellipse(c, 50, 46, 34, 22, r.base);          // barrel
    ellipse(c, 26, 44, 16, 18, r.base);          // shoulder
    ellipse(c, 72, 46, 18, 18, r.base);          // haunch
    for (const lx of [30, 44, 62, 78]) rect(c, lx, 60, 7, 26, r.base);  // legs
    for (const lx of [30, 44, 62, 78]) rect(c, lx - 1, 84, 9, 5, r.shadow); // paws
    shade(c, r, 40, 30);
    // belly shadow + spine highlight
    for (let x = 22; x < 82; x++) { px(c, x, 66, r.shadow); if (x % 2) px(c, x, 24 + Math.round(Math.sin(x / 6) * 2), r.hi); }
    dither(c, 60, 34, 26, 22, r.shadow, 0.35);   // flank texture
  },
  'body-humanoid': (c, r) => {
    poly(c, [[42, 18], [58, 18], [64, 40], [60, 70], [64, 88], [36, 88], [40, 70], [36, 40]], r.base); // torso
    rect(c, 24, 30, 8, 34, r.base); rect(c, 68, 30, 8, 34, r.base);   // arms
    shade(c, r, 42, 24);
    rect(c, 46, 30, 8, 40, r.shadow);            // centre seam
    dither(c, 40, 22, 20, 14, r.hi, 0.4);        // chest light
  },
  'body-aberration': (c, r) => {
    // bulbous mass + drooping tendrils
    ellipse(c, 50, 44, 32, 30, r.base);
    for (const tx of [30, 44, 58, 72]) { for (let y = 0; y < 30; y++) px(c, tx + Math.round(Math.sin(y / 4 + tx) * 3), 66 + y, r.base); }
    shade(c, r, 40, 28);
    dither(c, 30, 26, 40, 30, r.shadow, 0.3);
    for (const [ex, ey] of [[42, 40], [58, 46]]) { disc(c, ex, ey, 4, r.hi); disc(c, ex, ey, 2, [20, 14, 30]); }
  },
  'head-beast': (c, r) => {
    // snouted head in profile facing LEFT, neck stump at bottom.
    poly(c, [[18, 46], [40, 30], [70, 30], [78, 48], [64, 64], [30, 62]], r.base);   // skull+snout
    poly(c, [[18, 46], [30, 40], [30, 52]], r.base);   // nose
    rect(c, 44, 60, 16, 14, r.base);             // neck stump
    poly(c, [[44, 30], [52, 14], [58, 30]], r.base);   // ear
    shade(c, r, 34, 26);
    disc(c, 40, 42, 3, [20, 14, 30]);            // eye
    for (let x = 22; x < 34; x++) px(c, x, 50, r.shadow);  // mouth
    px(c, 24, 46, [255, 250, 235]); px(c, 27, 46, [255, 250, 235]); // teeth glint
  },
  'head-draconic': (c, r) => {
    poly(c, [[14, 44], [38, 28], [72, 26], [80, 44], [66, 62], [34, 60]], r.base);  // long snout
    poly(c, [[60, 28], [72, 10], [78, 30]], r.base);    // back horn
    poly(c, [[48, 28], [56, 12], [60, 28]], r.base);    // horn 2
    rect(c, 44, 58, 16, 14, r.base);             // neck stump
    shade(c, r, 30, 22);
    disc(c, 42, 40, 3, [230, 60, 40]);           // fiery eye
    for (let x = 18; x < 30; x++) px(c, x, 48, r.shadow);
    for (let x = 20; x < 30; x += 3) { px(c, x, 44, [255, 250, 235]); px(c, x, 50, [255, 250, 235]); } // teeth
  },
  'head-avian': (c, r) => {
    disc(c, 52, 44, 24, r.base);                 // head
    poly(c, [[30, 40], [8, 48], [30, 54]], [230, 170, 40]); // beak (own colour)
    rect(c, 46, 62, 14, 12, r.base);             // neck stump
    shade(c, r, 40, 26);
    disc(c, 46, 40, 3, [20, 14, 30]);            // eye
  },
  wings: (c, r) => {
    // one wing, pointing RIGHT (rig mirrors it). Feathered fan.
    poly(c, [[10, 50], [86, 20], [90, 40], [70, 48], [88, 60], [64, 66], [80, 80], [20, 66]], r.base);
    shade(c, r, 20, 30);
    for (let i = 0; i < 5; i++) line(c, 20, 54, 84 - i * 4, 26 + i * 12, r.shadow, 1);  // feather ribs
  },
  tail: (c, r) => {
    for (let t = 0; t <= 60; t++) {              // tapering curl
      const x = 12 + t, y = 50 + Math.round(Math.sin(t / 14) * 22), w = Math.max(2, 10 - t / 8);
      disc(c, x, y, w, r.base);
    }
    shade(c, r, 20, 30);
  },
  horns: (c, r) => {                              // ONE curved horn, pointing UP
    for (let t = 0; t <= 70; t++) {
      const x = 50 + Math.round(Math.sin(t / 22) * 14), y = 88 - t, w = Math.max(1.5, 8 - t / 10);
      disc(c, x, y, w, r.base);
    }
    shade(c, r, 42, 20);
    for (let y = 30; y < 80; y += 6) line(c, 40, y, 60, y, r.shadow, 1);  // ridges
  },
  teeth: (c, r) => {                              // a PAIR of fangs (not a face!)
    poly(c, [[30, 20], [40, 74], [50, 20]], [245, 240, 225]);
    poly(c, [[54, 20], [64, 74], [74, 20]], [245, 240, 225]);
    outline(c, r.outline);
  },
  claws: (c, r) => {                              // ONE curved talon, pointing DOWN
    poly(c, [[40, 12], [58, 20], [54, 60], [46, 88], [42, 60], [34, 30]], r.base);
    shade(c, r, 40, 20);
    line(c, 46, 20, 48, 80, r.shadow, 1);
  },
  shard: (c, r) => {                              // crystal, pointing UP
    poly(c, [[50, 8], [66, 46], [50, 92], [34, 46]], r.base);
    shade(c, r, 40, 24);
    line(c, 50, 10, 50, 90, r.hi, 1);            // facet ridge
    poly(c, [[50, 8], [66, 46], [50, 46]], r.shadow, 90); // dark facet
  },
  'w-sword': (c, r) => {
    poly(c, [[44, 6], [56, 6], [54, 66], [46, 66]], [200, 208, 220]);  // blade
    line(c, 50, 8, 50, 64, [245, 248, 255], 1);  // fuller shine
    rect(c, 34, 66, 32, 6, [120, 88, 46]);       // guard
    rect(c, 46, 72, 8, 18, [120, 88, 46]);       // grip
    disc(c, 50, 92, 4, [180, 150, 80]);          // pommel
    outline(c, r.outline);
  },
};

// ── render ───────────────────────────────────────────────────────────────────
const PROBE = Object.keys(DRAW);
const RMP = ramp(P.Physical);
const parts = {};
for (const id of PROBE) {
  const c = canvas(S);
  const tint = id.startsWith('body') ? ramp(P.Fire) : id === 'head-draconic' ? ramp(P.Fire) : id === 'shard' ? ramp(P.Energy) : RMP;
  DRAW[id](c, tint);
  outline(c, tint.outline);
  parts[id] = c;
  writeFileSync(`/tmp/proc-${id}.png`, encodePNG(c));
}

// contact sheet (checkerboard so transparency shows)
const COLS = 5, CELL = S + 8, rows = Math.ceil(PROBE.length / COLS);
const sheet = canvas(1); sheet.width = COLS * CELL; sheet.height = rows * CELL;
sheet.data = new Uint8ClampedArray(sheet.width * sheet.height * 4);
for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
  const chk = ((x >> 3) + (y >> 3)) & 1 ? 52 : 40;
  const i = (y * sheet.width + x) * 4; sheet.data[i] = sheet.data[i + 1] = sheet.data[i + 2] = chk; sheet.data[i + 3] = 255;
}
PROBE.forEach((id, k) => {
  const ox = (k % COLS) * CELL + 4, oy = Math.floor(k / COLS) * CELL + 4, c = parts[id];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = c.data[(y * S + x) * 4 + 3]; if (!a) continue;
    const i = (y * S + x) * 4, j = ((oy + y) * sheet.width + (ox + x)) * 4;
    for (let ch = 0; ch < 3; ch++) sheet.data[j + ch] = c.data[i + ch]; sheet.data[j + 3] = 255;
  }
});
writeFileSync('/tmp/proc-sheet.png', encodePNG(sheet));

// ── one rig-accurate composed creature ──────────────────────────────────────
const beast = { id: 'pv', name: 'Probe', biology: ['Beast'], family: 'Draconic', attunement: ['Fire'], anatomy: ['Wings', 'Tail', 'Horns', 'Teeth'] };
const baked = Object.fromEntries(PROBE.map((id) => [id, id]));   // mark present so composeCreature emits file layers
const { layers } = composeCreature(beast, { baked });
const W = 320, comp = canvas(1); comp.width = W; comp.height = W; comp.data = new Uint8ClampedArray(W * W * 4);
for (let i = 0; i < W * W; i++) { comp.data[i * 4] = 30; comp.data[i * 4 + 1] = 24; comp.data[i * 4 + 2] = 18; comp.data[i * 4 + 3] = 255; }
for (const l of layers) {
  const src = parts[l.partId]; if (!src) continue;   // skip parts not in the probe (fall through)
  const bx = l.x * W, by = l.y * W, bw = l.w * W, bh = l.h * W;
  for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
    const sxRaw = (l.flip ? (bw - 1 - dx) : dx) / bw * S, sy = dy / bh * S;
    const a = src.data[((sy | 0) * S + (sxRaw | 0)) * 4 + 3]; if (a < 40) continue;
    const si = ((sy | 0) * S + (sxRaw | 0)) * 4, di = (((by + dy) | 0) * W + ((bx + dx) | 0)) * 4;
    for (let ch = 0; ch < 3; ch++) comp.data[di + ch] = src.data[si + ch]; comp.data[di + 3] = 255;
  }
}
writeFileSync('/tmp/proc-creature.png', encodePNG(comp));

console.log(`Rendered ${PROBE.length} procedural pixel-art parts.`);
console.log('  /tmp/proc-sheet.png     — all parts on a checkerboard');
console.log('  /tmp/proc-creature.png  — a rig-composed beast using them');
console.log('  parts composed:', layers.filter((l) => parts[l.partId]).map((l) => l.partId).join(', '));
