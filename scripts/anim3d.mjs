// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/anim3d.mjs — the DEAD CELLS pipeline, in JS: pose a 3D primitive     ║
// ║ creature model over a walk cycle, render it tiny (ball-shaded, outlined) from ║
// ║ 8 rotated facings, and bake the frames into the SAME animation sheet + manifest║
// ║ the AI animator uses — so the existing viewer plays it. 100% offline, free,   ║
// ║ deterministic; one model re-posed = zero frame wobble, every facing correct.  ║
// ║   node scripts/anim3d.mjs   → public/art/anim/<id>3d-walk.png (+ index)        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { sphere, capsule, quad, render } from './sprite3d.mjs';
import { encodePNG } from './png.mjs';

const TAU = Math.PI * 2;
const OUT = 'public/art/anim';
const DIR8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const FRAMES = 6, SIZE = 64;
// model faces +z (toward camera) at theta 0 = "south"; step clockwise 45°/facing.
const thetaFor = (i) => i * (TAU / 8);

// ── Voltfang, as an animated quadruped rig (walk = diagonal leg pairs + body bob) ─
const FUR = '#6b7a92', BELLY = '#93a0b6', DARK = '#3a4254', CYAN = '#5fd0f4', TOOTH = '#efe9d8', PAW = '#59647c';
function voltfang(phase) {
  const m = [];
  const bob = Math.abs(Math.sin(TAU * phase)) * 0.06;  // body lifts twice per stride
  const Y = (y) => y + bob;
  const tsway = Math.sin(TAU * phase) * 0.13;
  // tail
  m.push(...capsule([0, Y(1.35), -1.05], [0.15 + tsway, Y(2.15), -1.75], 0.32, 0.16, FUR, 9));
  for (const s of [[0.1, 1.7, -1.35], [0.14, 1.95, -1.55], [0.05, 1.5, -1.2]]) m.push(sphere([s[0] + tsway * 0.5, Y(s[1]), s[2]], 0.28, FUR));
  // legs: [lx, lz, phaseOffset] — diagonal pairs in sync
  for (const [lx, lz, po] of [[-0.34, 1.02, 0], [0.34, 1.02, 0.5], [-0.4, -0.85, 0.5], [0.4, -0.85, 0]]) {
    const swing = Math.sin(TAU * (phase + po));
    const footZ = lz + swing * 0.3;
    const lift = Math.max(0, swing) * 0.24;              // lift while swinging forward
    m.push(...capsule([lx, Y(0.82), lz], [lx * 1.12, Y(0.12 + lift), footZ + 0.05], 0.19, 0.22, FUR, 6));
    m.push(sphere([lx * 1.12, Y(0.1 + lift), footZ + 0.16], 0.24, PAW));
  }
  // torso + belly
  m.push(...capsule([0, Y(1.18), 0.6], [0, Y(1.22), -0.95], 0.6, 0.58, FUR, 8));
  m.push(sphere([0, Y(1.12), 0.62], 0.66, FUR));
  m.push(sphere([0, Y(1.22), -0.95], 0.6, FUR));
  m.push(sphere([0, Y(0.8), 0.35], 0.5, BELLY));
  m.push(sphere([0, Y(0.85), -0.4], 0.46, BELLY));
  // neck ruff + electric sparks
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI - Math.PI / 2; m.push(sphere([Math.sin(a) * 0.6, Y(1.5 + Math.cos(a) * 0.35), 0.75], 0.2, i % 3 === 1 ? DARK : FUR)); }
  const spark = 0.06 + 0.05 * Math.sin(TAU * phase * 2);
  m.push(sphere([-0.55, Y(1.75), 0.5], 0.12 + spark, CYAN));
  m.push(sphere([0.5, Y(1.85), 0.4], 0.1 + spark, CYAN));
  m.push(quad([[-0.2, Y(2.0), -0.2], [0.3, Y(2.5), -0.5], [0.35, Y(2.4), -0.6], [-0.1, Y(1.9), -0.3]], CYAN));
  m.push(quad([[0.4, Y(1.9), 0.9], [0.9, Y(2.3), 0.7], [0.95, Y(2.2), 0.6], [0.5, Y(1.8), 0.85]], CYAN));
  // head (slight bob) + ears + muzzle + fangs + eyes
  const hb = Math.sin(TAU * phase) * 0.04;
  m.push(...capsule([0, Y(1.4), 0.75], [0, Y(1.72 + hb), 1.15], 0.42, 0.36, FUR, 4));
  m.push(sphere([0, Y(1.8 + hb), 1.28], 0.44, FUR));
  for (const sx of [-1, 1]) {
    m.push(quad([[0.4 * sx, Y(1.98 + hb), 1.02], [0.26 * sx, Y(2.72 + hb), 0.86], [0.1 * sx, Y(2.04 + hb), 1.1]], FUR));
    m.push(quad([[0.33 * sx, Y(2.04 + hb), 1.05], [0.26 * sx, Y(2.52 + hb), 0.93], [0.17 * sx, Y(2.08 + hb), 1.09]], DARK));
  }
  m.push(...capsule([0, Y(1.72 + hb), 1.4], [0, Y(1.66 + hb), 1.92], 0.3, 0.19, FUR, 5));
  m.push(sphere([0, Y(1.62 + hb), 2.0], 0.16, DARK));
  m.push(...capsule([0, Y(1.5 + hb), 1.5], [0, Y(1.4 + hb), 1.85], 0.22, 0.14, DARK, 4));
  for (const sx of [-1, 1]) {
    m.push(...capsule([0.12 * sx, Y(1.62 + hb), 1.68], [0.12 * sx, Y(1.4 + hb), 1.7], 0.06, 0.004, TOOTH, 3));
    m.push(...capsule([0.08 * sx, Y(1.6 + hb), 1.84], [0.08 * sx, Y(1.44 + hb), 1.85], 0.05, 0.004, TOOTH, 3));
  }
  m.push(sphere([-0.22, Y(1.9 + hb), 1.55], 0.13, CYAN));
  m.push(sphere([0.22, Y(1.9 + hb), 1.55], 0.13, CYAN));
  return m;
}

const CREATURES = { voltfang3d: { model: voltfang, scale: 12, tilt: 0.44, cy: 0.3 } };

function bakeSheet(id) {
  const { model, scale, tilt, cy } = CREATURES[id];
  const W = FRAMES * SIZE, H = DIR8.length * SIZE;
  const sheet = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  DIR8.forEach((dir, r) => {
    for (let f = 0; f < FRAMES; f++) {
      const img = render(model(f / FRAMES), { size: SIZE, theta: thetaFor(r), tilt, scale, cy });
      const ox = f * SIZE, oy = r * SIZE;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const s = (y * SIZE + x) * 4, d = ((oy + y) * W + (ox + x)) * 4;
        for (let k = 0; k < 4; k++) sheet.data[d + k] = img.data[s + k];
      }
    }
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${id}-walk.png`, encodePNG(sheet));
  writeFileSync(`${OUT}/${id}-walk.json`, JSON.stringify({
    id, action: 'walk', view: '3d low top-down', size: SIZE, frames: FRAMES,
    directions: DIR8, layout: 'row per direction, column per frame', sheet: `${id}-walk.png`,
  }, null, 2) + '\n');
  console.log(`→ ${OUT}/${id}-walk.png (${W}×${H}, ${DIR8.length} dirs × ${FRAMES} frames)`);
}

function rebuildIndex() {
  const entries = readdirSync(OUT).filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => { const m = JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')); return { id: m.id, action: m.action, sheet: m.sheet, size: m.size, frames: m.frames, directions: m.directions }; })
    .sort((a, b) => (a.id + a.action).localeCompare(b.id + b.action));
  writeFileSync(`${OUT}/index.json`, JSON.stringify(entries, null, 2) + '\n');
  console.log(`+ index.json (${entries.length})`);
}

for (const id of (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CREATURES))) bakeSheet(id);
rebuildIndex();
