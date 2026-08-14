// Bespoke WHOLE-creature probe — the Reddit/Pillow approach ported to our toolkit.
// NOT assembled from generic parts: this is one specific creature (a fire drake),
// hand-drawn as a coherent whole with deliberate silhouette, layered forms, and
// placed detail — the way an LLM writes bespoke sprite code for ONE subject.
//   node scripts/gen_bespoke_probe.mjs  → /tmp/bespoke.png (+ x4 preview)
import { writeFileSync } from 'fs';
import { canvas, px, disc, ellipse, poly, line, ramp, formShade, rim, outline } from './pixelart.mjs';
import { encodePNG, resizeRGBA } from './png.mjs';

const S = 104;
const c = canvas(S);

// palette
const BODY = '#cc5530';        // fire-red hide
const BELLY = [224, 168, 96];  // warm tan underside
const HORN = [236, 224, 190];  // bone
const CLAW = [244, 236, 214];
const EYE = [255, 206, 74];
const PUPIL = [30, 18, 26];
const R = ramp(BODY);

// ── silhouette, back-to-front so nearer forms overlap farther ones ─────────────
// tail: a tapering curl sweeping out to the lower-right, behind the body
for (let t = 0; t <= 46; t++) {
  const px_ = 62 + t * 0.8, py = 66 + Math.sin(t / 18) * 2 + t * 0.45;
  disc(c, px_, py, Math.max(2, 8 - t / 6), R.base);
}
poly(c, [[100, 92], [92, 84], [98, 80]], R.base);           // tail spade tip

// far hind + fore legs (drawn first = read as behind)
ellipse(c, 40, 84, 8, 11, R.shadow); ellipse(c, 40, 92, 9, 5, R.shadow);
ellipse(c, 66, 84, 8, 11, R.shadow); ellipse(c, 66, 92, 9, 5, R.shadow);

// folded wing behind the shoulder
poly(c, [[58, 40], [86, 26], [80, 44], [90, 40], [74, 56], [60, 52]], R.shadow);

// main body — a pear/egg torso, belly heavier than back
poly(c, [
  [50, 34], [66, 38], [74, 52], [74, 70], [64, 84],
  [40, 84], [30, 70], [30, 52], [38, 40],
], R.base);
ellipse(c, 52, 62, 22, 24, R.base);                         // round it out

// near legs (in front of body)
ellipse(c, 36, 82, 9, 12, R.base); ellipse(c, 36, 92, 10, 5, R.base);
ellipse(c, 62, 82, 9, 12, R.base); ellipse(c, 62, 92, 10, 5, R.base);

// neck + head raised, facing 3/4 left
poly(c, [[42, 40], [58, 38], [58, 24], [44, 26]], R.base);  // neck
ellipse(c, 46, 22, 17, 15, R.base);                         // cranium
poly(c, [[30, 22], [46, 16], [48, 30], [32, 30]], R.base);  // snout/muzzle
poly(c, [[30, 24], [22, 26], [31, 30]], R.base);            // snout tip

// ── belly / chest lighter cluster (a distinct material patch) ──────────────────
poly(c, [[44, 46], [60, 50], [62, 70], [50, 82], [40, 74], [40, 54]], BELLY);
ellipse(c, 50, 66, 12, 15, BELLY);

// horns (bone) — swept back off the crown, behind is drawn as shadow tone
for (let t = 0; t <= 22; t++) { disc(c, 52 + t * 0.7, 12 - t * 0.15 + Math.sin(t / 10) * 1, Math.max(1.4, 4 - t / 7), HORN); }
for (let t = 0; t <= 16; t++) { disc(c, 44 + t * 0.5, 9 - t * 0.1, Math.max(1.2, 3 - t / 7), HORN); }

// ── SHADE the whole creature as one lit volume, then place crisp detail ─────────
formShade(c, { roundness: 0.5, blur: 7 });

// belly scale ridges (hand-placed lighter clusters, break the flat patch)
for (let i = 0; i < 4; i++) { const yy = 56 + i * 6; for (let x = 44; x < 60; x += 3) px(c, x, yy, [244, 210, 150]); }

// back ridge spines — a row of small warm triangles along the spine
for (let i = 0; i < 5; i++) {
  const bx = 40 + i * 7, by = 40 - Math.sin(i / 2) * 3;
  poly(c, [[bx, by], [bx + 3, by - 6], [bx + 6, by]], R.hi);
}

// face: big eye, nostril, mouth, fang
disc(c, 40, 20, 5, [40, 22, 20]);                           // eye socket shadow
disc(c, 40, 20, 4, EYE); disc(c, 41, 21, 2, [200, 120, 30]);// iris
px(c, 39, 18, [255, 250, 235]); px(c, 40, 18, [255, 250, 235]); // catchlight
px(c, 24, 26, [26, 14, 20]); px(c, 25, 26, [26, 14, 20]);   // nostril
for (let x = 24; x < 40; x++) px(c, x, 30, R.shadow);       // mouth line
poly(c, [[27, 30], [29, 36], [31, 30]], CLAW);              // fang
poly(c, [[33, 30], [35, 34], [37, 30]], CLAW);

// claw tips on the near feet
for (const fx of [30, 36, 42]) poly(c, [[fx, 94], [fx + 1, 98], [fx + 3, 94]], CLAW);
for (const fx of [56, 62, 68]) poly(c, [[fx, 94], [fx + 1, 98], [fx + 3, 94]], CLAW);

// rim light + selective outline
rim(c, R.hi);
outline(c);

writeFileSync('/tmp/bespoke.png', encodePNG(c));
const big = resizeRGBA(c, S * 4, S * 4);
// nearest-neighbour upscale for a crisp preview (resizeRGBA box-averages; redo hard)
const hard = { width: S * 4, height: S * 4, data: new Uint8ClampedArray(S * 4 * S * 4 * 4) };
for (let y = 0; y < hard.height; y++) for (let x = 0; x < hard.width; x++) {
  const sx = (x / 4) | 0, sy = (y / 4) | 0, si = (sy * S + sx) * 4, di = (y * hard.width + x) * 4;
  for (let k = 0; k < 4; k++) hard.data[di + k] = c.data[si + k];
}
void big;
// composite the x4 onto a dark card so transparency reads
const card = { width: hard.width, height: hard.height, data: new Uint8ClampedArray(hard.data.length) };
for (let i = 0; i < card.width * card.height; i++) {
  const a = hard.data[i * 4 + 3] / 255;
  for (let k = 0; k < 3; k++) card.data[i * 4 + k] = hard.data[i * 4 + k] * a + 34 * (1 - a);
  card.data[i * 4 + 3] = 255;
}
writeFileSync('/tmp/bespoke-x4.png', encodePNG(card));
console.log('→ /tmp/bespoke.png + /tmp/bespoke-x4.png');
