// Probe: model the fire drake as a tiny 3D PRIMITIVE model and render 8 facings
// from one pose (rotate the model 45°/frame). Proves the "render a sprite from a
// 3D model" method (ball shading, z-sort, iso camera, outline, drop shadow).
//   node scripts/gen_creature3d.mjs  → /tmp/drake3d-sheet.png + /tmp/drake3d-hero.png
import { writeFileSync } from 'fs';
import { sphere, capsule, quad, render } from './sprite3d.mjs';
import { encodePNG } from './png.mjs';

const BODY = '#cc5530', BELLY = '#e0a860', HORN = '#ece0be', EYE = '#ffce4a';

// model space: x right, y up, z toward camera at theta=0. origin between the feet.
function drake() {
  const m = [];
  // tail — curls back and down, then a fin tip (quad)
  m.push(...capsule([0, 0.95, -0.55], [0, 0.35, -2.1], 0.42, 0.12, BODY, 10));
  m.push(quad([[-0.02, 0.55, -2.1], [-0.02, 1.15, -2.5], [0.02, 0.75, -2.9], [0.02, 0.2, -2.4]], '#d0632f'));
  // legs (four) — sphere-chain capsules, feet slightly fatter
  for (const [lx, lz] of [[-0.52, 0.42], [0.52, 0.42], [-0.56, -0.34], [0.56, -0.34]]) {
    m.push(...capsule([lx, 0.9, lz], [lx * 1.05, 0.12, lz], 0.3, 0.34, BODY, 6));
    m.push(sphere([lx * 1.05, 0.1, lz + 0.14], 0.34, BODY));           // foot
    for (const t of [-0.16, 0, 0.16]) m.push(sphere([lx * 1.05 + t, 0.06, lz + 0.32], 0.09, HORN)); // claws
  }
  // torso — two stacked spheres + a lighter belly in front
  m.push(sphere([0, 1.0, 0], 0.98, BODY));
  m.push(sphere([0, 1.62, 0.08], 0.78, BODY));
  m.push(sphere([0, 1.15, 0.62], 0.6, BELLY));
  m.push(sphere([0, 1.7, 0.55], 0.44, BELLY));
  // back ridge — small warm cones (spheres) along the spine
  for (let i = 0; i < 5; i++) { const yy = 1.9 - i * 0.28, zz = -0.1 - i * 0.34; m.push(sphere([0, yy + 0.1, zz], 0.14, '#f0a24a')); }
  // folded wings (quads) off the shoulders
  m.push(quad([[-0.4, 1.9, -0.1], [-1.5, 2.3, -0.5], [-1.4, 1.5, -0.4], [-0.5, 1.3, -0.1]], '#b8481f'));
  m.push(quad([[0.4, 1.9, -0.1], [1.5, 2.3, -0.5], [1.4, 1.5, -0.4], [0.5, 1.3, -0.1]], '#b8481f'));
  // neck + head
  m.push(...capsule([0, 1.9, 0.2], [0, 2.4, 0.35], 0.42, 0.5, BODY, 4));
  m.push(sphere([0, 2.55, 0.25], 0.6, BODY));                          // cranium
  m.push(sphere([0, 2.32, 0.72], 0.42, BODY));                         // muzzle
  m.push(sphere([0, 2.22, 1.02], 0.28, BODY));                         // snout tip
  m.push(sphere([0, 2.12, 0.72], 0.34, BELLY));                        // jaw
  // horns — sphere chains swept up-and-back
  m.push(...capsule([-0.32, 2.9, 0.05], [-0.62, 3.5, -0.7], 0.16, 0.05, HORN, 6));
  m.push(...capsule([0.32, 2.9, 0.05], [0.62, 3.5, -0.7], 0.16, 0.05, HORN, 6));
  // eyes (whites/iris spheres; pupils stamped after projection)
  m.push(sphere([-0.34, 2.5, 0.72], 0.16, EYE));
  m.push(sphere([0.34, 2.5, 0.72], 0.16, EYE));
  return m;
}

const model = drake();
const eyes = [[-0.34, 2.5, 0.86], [0.34, 2.5, 0.86]];  // pupil anchor points (front of eye)
const CELL = 72, COLS = 4, ROWS = 2;

function frame(theta) {
  const img = render(model, { size: CELL, theta, tilt: 0.42, scale: 17 });
  // stamp pupils + catchlight when the eye faces the camera
  for (const e of eyes) {
    const [px, py, pz] = img.project(e);
    if (pz < 0) continue;                              // eye is on the far side
    const X = Math.round(px), Y = Math.round(py);
    for (const [dx, dy, col] of [[0, 0, [28, 16, 24]], [-1, 0, [28, 16, 24]], [-1, -1, [255, 250, 235]]]) {
      const XX = X + dx, YY = Y + dy; if (XX < 0 || YY < 0 || XX >= CELL || YY >= CELL) continue;
      const i = (YY * CELL + XX) * 4; if (img.data[i + 3] < 200) continue;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
    }
  }
  return img;
}

// contact sheet of 8 facings on a checkerboard
const sheet = { width: COLS * CELL, height: ROWS * CELL };
sheet.data = new Uint8ClampedArray(sheet.width * sheet.height * 4);
for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) { const chk = ((x >> 3) + (y >> 3)) & 1 ? 52 : 40, i = (y * sheet.width + x) * 4; sheet.data[i] = sheet.data[i + 1] = sheet.data[i + 2] = chk; sheet.data[i + 3] = 255; }
for (let f = 0; f < 8; f++) {
  const img = frame((f / 8) * Math.PI * 2);
  const ox = (f % COLS) * CELL, oy = Math.floor(f / COLS) * CELL;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const a = img.data[(y * CELL + x) * 4 + 3]; if (!a) continue;
    const j = ((oy + y) * sheet.width + (ox + x)) * 4, si = (y * CELL + x) * 4, w = a / 255;
    for (let k = 0; k < 3; k++) sheet.data[j + k] = img.data[si + k] * w + sheet.data[j + k] * (1 - w);
  }
}
writeFileSync('/tmp/drake3d-sheet.png', encodePNG(sheet));

// a big hero frame (front-3/4) upscaled x4 nearest-neighbour on a dark card
const hero = frame(0.0);
const Z = 4, HW = CELL * Z, big = { width: HW, height: HW, data: new Uint8ClampedArray(HW * HW * 4) };
for (let y = 0; y < HW; y++) for (let x = 0; x < HW; x++) {
  const sx = (x / Z) | 0, sy = (y / Z) | 0, a = hero.data[(sy * CELL + sx) * 4 + 3] / 255, di = (y * HW + x) * 4;
  for (let k = 0; k < 3; k++) big.data[di + k] = hero.data[(sy * CELL + sx) * 4 + k] * a + 34 * (1 - a);
  big.data[di + 3] = 255;
}
writeFileSync('/tmp/drake3d-hero.png', encodePNG(big));
console.log('→ /tmp/drake3d-sheet.png + /tmp/drake3d-hero.png');
