// Probe: Ironhide (giant armored brawler) as a 3D primitive model — tests a
// BIPEDAL humanoid build + HELD EQUIPMENT (a maul on the shoulder, a shield).
//   node scripts/gen_ironhide3d.mjs  → /tmp/ironhide3d-sheet.png + -hero.png
import { writeFileSync } from 'fs';
import { sphere, capsule, quad, render } from './sprite3d.mjs';
import { encodePNG } from './png.mjs';

const ARMOR = '#566044', ARMOR_D = '#3b4531', METAL = '#727a68', TRIM = '#8c6a38', STONE = '#8a8a95', HAFT = '#6a4a2a', DARK = '#26291f', EYE = '#ff4a2e';

// model space: x right, y up, +z forward. hulking biped, hammer on right shoulder.
function ironhide() {
  const m = [];
  // ── LEGS (thick, armored) ──
  for (const sx of [-1, 1]) {
    m.push(...capsule([0.36 * sx, 1.55, 0.05], [0.42 * sx, 0.9, 0.08], 0.31, 0.27, ARMOR, 6));
    m.push(...capsule([0.42 * sx, 0.9, 0.08], [0.44 * sx, 0.24, 0.12], 0.26, 0.24, ARMOR_D, 5));
    m.push(sphere([0.44 * sx, 0.16, 0.3], 0.32, ARMOR_D));        // boot
    m.push(sphere([0.42 * sx, 0.92, 0.28], 0.15, TRIM));          // knee guard
  }
  // ── PELVIS / TORSO ──
  m.push(sphere([0, 1.62, 0], 0.54, ARMOR));                      // pelvis
  m.push(sphere([0, 1.56, 0.32], 0.2, TRIM));                     // belt buckle
  m.push(sphere([0, 2.32, 0], 0.76, ARMOR));                      // chest
  m.push(sphere([0, 2.64, 0.06], 0.52, ARMOR));                   // upper chest/collar
  m.push(sphere([0, 1.98, 0.44], 0.42, METAL));                   // ab plate
  m.push(sphere([-0.22, 2.46, 0.52], 0.12, TRIM)); m.push(sphere([0.22, 2.46, 0.52], 0.12, TRIM)); // chest studs
  // ── PAULDRONS (big) ──
  for (const sx of [-1, 1]) { m.push(sphere([0.84 * sx, 2.74, 0], 0.46, ARMOR)); m.push(sphere([0.94 * sx, 2.9, 0.04], 0.18, TRIM)); }
  // ── NECK + HELMET ──
  m.push(...capsule([0, 2.78, 0.05], [0, 2.98, 0.05], 0.27, 0.25, ARMOR_D, 3));
  m.push(sphere([0, 3.14, 0.06], 0.42, ARMOR));                   // helm
  m.push(sphere([0, 3.1, 0.44], 0.27, DARK));                     // dark visor face
  m.push(...capsule([0, 3.5, 0.0], [0, 3.82, -0.14], 0.11, 0.03, TRIM, 4)); // helm crest
  m.push(sphere([-0.42, 3.16, 0.1], 0.1, TRIM)); m.push(sphere([0.42, 3.16, 0.1], 0.1, TRIM)); // helm horns/bolts
  // ── LEFT ARM + SHIELD (forward) ──
  m.push(...capsule([-0.8, 2.58, 0], [-0.68, 1.98, 0.2], 0.25, 0.22, ARMOR, 4));
  m.push(...capsule([-0.68, 1.98, 0.2], [-0.56, 1.52, 0.55], 0.21, 0.19, ARMOR_D, 4));
  m.push(sphere([-0.54, 1.48, 0.64], 0.22, ARMOR_D));             // fist
  m.push(quad([[-0.98, 2.46, 0.72], [-0.06, 2.42, 0.72], [-0.06, 1.36, 0.72], [-0.98, 1.4, 0.72]], METAL)); // shield face
  m.push(quad([[-0.9, 2.36, 0.66], [-0.14, 2.33, 0.66], [-0.14, 1.44, 0.66], [-0.9, 1.47, 0.66]], TRIM, 0.02)); // shield rim (behind, bigger)
  m.push(sphere([-0.52, 1.9, 0.8], 0.16, TRIM));                  // boss
  // ── RIGHT ARM (raised, gripping haft) ──
  m.push(...capsule([0.8, 2.58, 0], [0.72, 2.34, 0.36], 0.25, 0.22, ARMOR, 4));
  m.push(...capsule([0.72, 2.34, 0.36], [0.62, 2.62, 0.52], 0.2, 0.18, ARMOR_D, 4));
  m.push(sphere([0.6, 2.66, 0.56], 0.2, ARMOR_D));               // gripping fist
  // ── HAMMER (haft up-and-back over the shoulder, big stone head) ──
  m.push(...capsule([0.6, 2.66, 0.56], [0.55, 3.7, -0.85], 0.1, 0.08, HAFT, 9));
  // T-head: a bar of stone crosswise at the haft top
  m.push(...capsule([0.55, 4.02, -0.6], [0.55, 3.38, -1.12], 0.34, 0.34, STONE, 4));
  m.push(sphere([0.55, 3.7, -0.86], 0.4, STONE));                // core
  m.push(sphere([0.55, 4.0, -0.62], 0.2, METAL)); m.push(sphere([0.55, 3.4, -1.1], 0.2, METAL)); // striking faces
  m.push(sphere([0.55, 3.7, -0.5], 0.14, TRIM));                 // band
  // ── EYES (glowing) — spheres, brightened after projection ──
  m.push(sphere([-0.15, 3.12, 0.48], 0.07, EYE));
  m.push(sphere([0.15, 3.12, 0.48], 0.07, EYE));
  return m;
}

const model = ironhide();
const eyes = [[-0.15, 3.12, 0.6], [0.15, 3.12, 0.6]];
const CELL = 96, COLS = 4, ROWS = 2, SCALE = 13;

function frame(theta) {
  const img = render(model, { size: CELL, theta, tilt: 0.4, scale: SCALE, cy: 0.1 });
  for (const e of eyes) {
    const [px, py, pz] = img.project(e); if (pz < 0) continue;
    const X = Math.round(px), Y = Math.round(py);
    const i = (Y * CELL + X) * 4; if (Y < 0 || X < 0 || X >= CELL || Y >= CELL || img.data[i + 3] < 200) continue;
    img.data[i] = 255; img.data[i + 1] = 150; img.data[i + 2] = 90;
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
writeFileSync('/tmp/ironhide3d-sheet.png', encodePNG(sheet));

const hero = frame(-0.6);
const Z = 4, HW = CELL * Z, big = { width: HW, height: HW, data: new Uint8ClampedArray(HW * HW * 4) };
for (let y = 0; y < HW; y++) for (let x = 0; x < HW; x++) {
  const sx = (x / Z) | 0, sy = (y / Z) | 0, a = hero.data[(sy * CELL + sx) * 4 + 3] / 255, di = (y * HW + x) * 4;
  for (let k = 0; k < 3; k++) big.data[di + k] = hero.data[(sy * CELL + sx) * 4 + k] * a + 34 * (1 - a);
  big.data[di + 3] = 255;
}
writeFileSync('/tmp/ironhide3d-hero.png', encodePNG(big));
console.log('→ /tmp/ironhide3d-sheet.png + /tmp/ironhide3d-hero.png');
