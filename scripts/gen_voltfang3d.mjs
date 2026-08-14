// Probe: an EXISTING roster monster (Voltfang, the lightning wolf) rebuilt as a
// 3D primitive model, to compare the new art form against its baked AI portrait.
//   node scripts/gen_voltfang3d.mjs  → /tmp/voltfang3d-sheet.png + -hero.png
import { writeFileSync } from 'fs';
import { sphere, capsule, quad, render } from './sprite3d.mjs';
import { encodePNG } from './png.mjs';

const FUR = '#6b7a92', BELLY = '#93a0b6', DARK = '#3a4254', CYAN = '#5fd0f4', TOOTH = '#efe9d8', PAW = '#59647c';

// model space: x right, y up, +z = forward (nose). quadruped, prowling.
function voltfang() {
  const m = [];
  // TAIL — bushy, swept up and back (drawn first = behind)
  m.push(...capsule([0, 1.35, -1.05], [0.15, 2.15, -1.75], 0.32, 0.16, FUR, 9));
  for (const s of [[0.1, 1.7, -1.35], [0.14, 1.95, -1.55], [0.05, 1.5, -1.2]]) m.push(sphere(s, 0.28, FUR)); // fur puffs
  // LEGS — four, sphere-chain, paws fatter
  for (const [lx, lz, ly] of [[-0.34, 0.75, 1.02], [0.34, 0.75, 1.02], [-0.4, -0.85, 1.0], [0.4, -0.85, 1.0]]) {
    m.push(...capsule([lx, ly, lz], [lx * 1.12, 0.12, lz + 0.05], 0.19, 0.22, FUR, 6));
    m.push(sphere([lx * 1.12, 0.1, lz + 0.16], 0.24, PAW));
  }
  // TORSO — a horizontal barrel from chest to hindquarters, lighter belly under
  m.push(...capsule([0, 1.18, 0.6], [0, 1.22, -0.95], 0.6, 0.58, FUR, 8));
  m.push(sphere([0, 1.12, 0.62], 0.66, FUR));            // chest
  m.push(sphere([0, 1.22, -0.95], 0.6, FUR));            // haunch
  m.push(sphere([0, 0.8, 0.35], 0.5, BELLY));            // belly
  m.push(sphere([0, 0.85, -0.4], 0.46, BELLY));
  // NECK RUFF — spiky fur spheres around the shoulders + a few cyan sparks
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI - Math.PI / 2; m.push(sphere([Math.sin(a) * 0.6, 1.5 + Math.cos(a) * 0.35, 0.75], 0.2, i % 3 === 1 ? DARK : FUR)); }
  m.push(sphere([-0.55, 1.75, 0.5], 0.12, CYAN)); m.push(sphere([0.5, 1.85, 0.4], 0.1, CYAN));
  // electric arc off the back (thin bright quads)
  m.push(quad([[-0.2, 2.0, -0.2], [0.3, 2.5, -0.5], [0.35, 2.4, -0.6], [-0.1, 1.9, -0.3]], CYAN));
  m.push(quad([[0.4, 1.9, 0.9], [0.9, 2.3, 0.7], [0.95, 2.2, 0.6], [0.5, 1.8, 0.85]], CYAN));
  // NECK + HEAD (forward, head slightly lowered, prowling)
  m.push(...capsule([0, 1.4, 0.75], [0, 1.72, 1.15], 0.42, 0.36, FUR, 4));
  m.push(sphere([0, 1.8, 1.28], 0.44, FUR));             // skull
  // EARS — crisp pointed triangles (outer fur + dark inner), swept up
  for (const sx of [-1, 1]) {
    m.push(quad([[0.4 * sx, 1.98, 1.02], [0.26 * sx, 2.72, 0.86], [0.1 * sx, 2.04, 1.1]], FUR));
    m.push(quad([[0.33 * sx, 2.04, 1.05], [0.26 * sx, 2.52, 0.93], [0.17 * sx, 2.08, 1.09]], DARK));
  }
  // MUZZLE — snarling: upper snout + open lower jaw with sharp fangs
  m.push(...capsule([0, 1.72, 1.4], [0, 1.66, 1.92], 0.3, 0.19, FUR, 5));
  m.push(sphere([0, 1.62, 2.0], 0.16, DARK));            // nose
  m.push(...capsule([0, 1.5, 1.5], [0, 1.4, 1.85], 0.22, 0.14, DARK, 4)); // open lower jaw (dark maw)
  for (const sx of [-1, 1]) {
    m.push(...capsule([0.12 * sx, 1.62, 1.68], [0.12 * sx, 1.4, 1.7], 0.06, 0.004, TOOTH, 3));  // upper fang
    m.push(...capsule([0.08 * sx, 1.6, 1.84], [0.08 * sx, 1.44, 1.85], 0.05, 0.004, TOOTH, 3)); // upper fang 2
    m.push(...capsule([0.09 * sx, 1.44, 1.7], [0.09 * sx, 1.58, 1.72], 0.045, 0.004, TOOTH, 3));// lower fang
  }
  // EYES — glowing cyan, angry (set into the skull front)
  m.push(sphere([-0.22, 1.9, 1.55], 0.13, CYAN));
  m.push(sphere([0.22, 1.9, 1.55], 0.13, CYAN));
  return m;
}

const model = voltfang();
const eyes = [[-0.22, 1.9, 1.68], [0.22, 1.9, 1.68]];
const CELL = 84, COLS = 4, ROWS = 2, SCALE = 15;

function frame(theta) {
  const img = render(model, { size: CELL, theta, tilt: 0.44, scale: SCALE, cy: 0.3 });
  for (const e of eyes) {
    const [px, py, pz] = img.project(e); if (pz < 0) continue;
    const X = Math.round(px), Y = Math.round(py);
    for (const [dx, dy, col] of [[0, 0, [255, 255, 255]], [0, 1, [30, 90, 120]]]) {
      const XX = X + dx, YY = Y + dy; if (XX < 0 || YY < 0 || XX >= CELL || YY >= CELL) continue;
      const i = (YY * CELL + XX) * 4; if (img.data[i + 3] < 200) continue;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
    }
  }
  return img;
}

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
writeFileSync('/tmp/voltfang3d-sheet.png', encodePNG(sheet));

const hero = frame(-0.5);
const Z = 4, HW = CELL * Z, big = { width: HW, height: HW, data: new Uint8ClampedArray(HW * HW * 4) };
for (let y = 0; y < HW; y++) for (let x = 0; x < HW; x++) {
  const sx = (x / Z) | 0, sy = (y / Z) | 0, a = hero.data[(sy * CELL + sx) * 4 + 3] / 255, di = (y * HW + x) * 4;
  for (let k = 0; k < 3; k++) big.data[di + k] = hero.data[(sy * CELL + sx) * 4 + k] * a + 34 * (1 - a);
  big.data[di + 3] = 255;
}
writeFileSync('/tmp/voltfang3d-hero.png', encodePNG(big));
console.log('→ /tmp/voltfang3d-sheet.png + /tmp/voltfang3d-hero.png');
