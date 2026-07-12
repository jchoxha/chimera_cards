// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/SceneEnv — the BATTLEFIELD BACKDROP as a pluggable SCENE. ║
// ║ Board3D renders exactly ONE <SceneEnv scene=…> which supplies the sky,      ║
// ║ ground, environment props (billboard trees/rocks/bushes), and lighting for  ║
// ║ a named scene. The squads / cards / playmat / HUD are scene-agnostic and    ║
// ║ layer ON TOP. Two scenes today: `forest` (the new default — a 2.5D outdoor  ║
// ║ diorama built from procedural billboards + a gradient sky dome) and `grid`  ║
// ║ (the original wooden-table + receding-grid ADMIN/TESTING battlefield). This ║
// ║ is the seam the roguelike open-world will grow from: new biomes = new scene ║
// ║ entries, and combat can transition between them without touching game logic.║
// ║ ART IS PROCEDURAL PLACEHOLDER (canvas-baked) — swap in generated sprites    ║
// ║ later by replacing the texture bakers; the scatter/layout stays.            ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── deterministic RNG (stable scatter — no per-render jitter) ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bake(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ── cached textures (module-level so scene toggles don't re-bake) ──
let _sky = null;
function skyTexture() {
  if (_sky) return _sky;
  _sky = bake(8, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#5c93bd');   // zenith
    g.addColorStop(0.45, '#9dc3d4');
    g.addColorStop(0.72, '#cfe0d9');   // haze
    g.addColorStop(1.0, '#dfe7d2');    // horizon (matches fog)
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
  });
  return _sky;
}
let _grass = null;
function grassTexture() {
  if (_grass) return _grass;
  _grass = bake(256, 256, (ctx) => {
    ctx.fillStyle = '#3f6a33'; ctx.fillRect(0, 0, 256, 256);
    const rng = mulberry32(7);
    for (let i = 0; i < 900; i++) {
      const x = rng() * 256, y = rng() * 256, r = 2 + rng() * 6;
      const shade = rng();
      ctx.fillStyle = shade < 0.5 ? 'rgba(46,86,38,0.5)' : (shade < 0.82 ? 'rgba(86,120,52,0.5)' : 'rgba(120,150,70,0.4)');
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, rng() * 3.14, 0, 6.28); ctx.fill();
    }
  });
  _grass.wrapS = _grass.wrapT = THREE.RepeatWrapping; _grass.repeat.set(26, 26);
  return _grass;
}
// soft round ground shadow (dark → transparent) for grounding billboards
let _shadow = null;
function shadowTexture() {
  if (_shadow) return _shadow;
  _shadow = bake(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  return _shadow;
}

// leafy round-canopy tree, pine tree, boulder, bush — all transparent sprites baked once.
const _props = {};
function treeRoundTexture() {
  if (_props.tree) return _props.tree;
  _props.tree = bake(160, 224, (ctx) => {
    // trunk
    ctx.fillStyle = '#5a3d22'; ctx.strokeStyle = '#3c2815'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(72, 224); ctx.lineTo(78, 224); ctx.lineTo(88, 150); ctx.lineTo(66, 150); ctx.closePath(); ctx.fill(); ctx.stroke();
    // canopy — overlapping blobs, darker rim + lit top-left
    const blobs = [[80, 78, 62], [48, 108, 44], [112, 108, 44], [80, 128, 50]];
    ctx.strokeStyle = '#24401f'; ctx.lineWidth = 4;
    blobs.forEach(([x, y, r]) => { ctx.fillStyle = '#2f5a29'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.stroke(); });
    blobs.forEach(([x, y, r]) => { ctx.fillStyle = '#3f7233'; ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.28, r * 0.66, 0, 6.28); ctx.fill(); });
    ctx.fillStyle = 'rgba(150,190,90,0.5)'; ctx.beginPath(); ctx.arc(58, 60, 20, 0, 6.28); ctx.fill();
  });
  return _props.tree;
}
function pineTexture() {
  if (_props.pine) return _props.pine;
  _props.pine = bake(140, 236, (ctx) => {
    ctx.fillStyle = '#5a3d22'; ctx.fillRect(64, 190, 12, 46);
    const tiers = [[118, 132, 196], [104, 96, 150], [88, 64, 108]];   // [halfW, topY, baseY]
    ctx.strokeStyle = '#1f3a1c'; ctx.lineWidth = 4;
    tiers.forEach(([hw, ty, by]) => {
      ctx.fillStyle = '#2b5225'; ctx.beginPath(); ctx.moveTo(70, ty); ctx.lineTo(70 - hw, by); ctx.lineTo(70 + hw, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(90,140,60,0.4)'; ctx.beginPath(); ctx.moveTo(70, ty + 6); ctx.lineTo(70 - hw * 0.5, by - 6); ctx.lineTo(70, by - 6); ctx.closePath(); ctx.fill();
    });
  });
  return _props.pine;
}
function rockTexture() {
  if (_props.rock) return _props.rock;
  _props.rock = bake(128, 96, (ctx) => {
    ctx.fillStyle = '#6b6a66'; ctx.strokeStyle = '#403f3b'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(16, 92); ctx.lineTo(30, 44); ctx.lineTo(60, 26); ctx.lineTo(96, 40); ctx.lineTo(114, 92); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#88877f'; ctx.beginPath(); ctx.moveTo(30, 46); ctx.lineTo(60, 28); ctx.lineTo(74, 52); ctx.lineTo(46, 66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4f6b3a'; ctx.beginPath(); ctx.ellipse(60, 90, 46, 8, 0, 0, 6.28); ctx.fill();   // mossy base
  });
  return _props.rock;
}
function bushTexture() {
  if (_props.bush) return _props.bush;
  _props.bush = bake(128, 88, (ctx) => {
    ctx.strokeStyle = '#244020'; ctx.lineWidth = 4;
    [[38, 52, 30], [70, 44, 34], [98, 54, 26]].forEach(([x, y, r]) => { ctx.fillStyle = '#356b2d'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.stroke(); });
    [[38, 52, 30], [70, 44, 34], [98, 54, 26]].forEach(([x, y, r]) => { ctx.fillStyle = '#46864d'; ctx.beginPath(); ctx.arc(x - 6, y - 8, r * 0.6, 0, 6.28); ctx.fill(); });
  });
  return _props.bush;
}
const PROP_TEX = { tree: treeRoundTexture, pine: pineTexture, rock: rockTexture, bush: bushTexture };
const PROP_SIZE = { tree: [3.0, 4.2], pine: [2.6, 4.4], rock: [1.7, 1.3], bush: [1.5, 1.05] };

// ── an upright CYLINDRICAL billboard (yaw-to-camera; stays standing on tilt) ──
function Billboard({ kind, x, z, s = 1 }) {
  const ref = useRef();
  const tex = useMemo(() => PROP_TEX[kind](), [kind]);
  const [w, h] = PROP_SIZE[kind]; const W = w * s, H = h * s;
  useFrame(({ camera }) => { const m = ref.current; if (m) m.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[W * 0.8, W * 0.42]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ref} position={[0, H / 2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Scatter props in a RING outside the play area (never over the fields) + a far backdrop
// band, deterministic so they don't jump between renders. `stage` = the board bounds.
function scatterProps(stage) {
  const rng = mulberry32(2026);
  const out = [];
  const kinds = ['tree', 'tree', 'pine', 'bush', 'rock'];
  const clearX = stage.xMax + 2.2, clearZ0 = stage.zMin - 1.5, clearZ1 = stage.zMax + 1.5;
  const inClear = (x, z) => x > -clearX && x < clearX && z > clearZ0 && z < clearZ1;
  let guard = 0;
  while (out.length < 34 && guard++ < 600) {
    // rings: sides (|x| large), plus front/back bands, plus a far arc
    const band = rng();
    let x, z;
    if (band < 0.5) { x = (rng() < 0.5 ? -1 : 1) * (clearX + rng() * 7); z = clearZ0 - 1 + rng() * (clearZ1 - clearZ0 + 2); }
    else if (band < 0.78) { x = -clearX - 4 + rng() * (2 * clearX + 8); z = clearZ0 - 1 - rng() * 8; }   // far behind enemy
    else { x = -clearX - 4 + rng() * (2 * clearX + 8); z = clearZ1 + 0.5 + rng() * 7; }                  // behind player (near camera sides)
    if (inClear(x, z)) continue;
    const kind = kinds[(rng() * kinds.length) | 0];
    out.push({ id: out.length, kind, x, z, s: 0.8 + rng() * 0.7 });
  }
  return out;
}

function SkyDome() {
  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[74, 32, 20]} />
      <meshBasicMaterial map={skyTexture()} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// The GRID scene: the original wooden table + receding grid (admin/testing battlefield).
function GridScene({ onOrbitStart }) {
  return (
    <group>
      <ambientLight intensity={0.82} />
      <directionalLight position={[4, 9, 7]} intensity={1.1} />
      <directionalLight position={[-5, 4, 2]} intensity={0.35} color="#8fb4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -0.5]}
        onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onOrbitStart(e.nativeEvent); }}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#2a1d10" roughness={1} />
      </mesh>
      <gridHelper args={[80, 80, '#5a4327', '#3a2a18']} position={[0, 0, -0.5]} />
    </group>
  );
}

// The FOREST scene: gradient sky dome + grass ground + scattered 2.5D billboard flora.
function ForestScene({ onOrbitStart, stage }) {
  const grass = useMemo(() => grassTexture(), []);
  const props = useMemo(() => scatterProps(stage), [stage]);
  return (
    <group>
      <ambientLight intensity={0.92} color="#eaf1e6" />
      <directionalLight position={[6, 11, 5]} intensity={1.15} color="#fff2d6" />
      <directionalLight position={[-6, 5, -3]} intensity={0.4} color="#9fc6ff" />
      <hemisphereLight args={['#bfe0ff', '#3a5a2a', 0.5]} />
      <SkyDome />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -0.5]}
        onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onOrbitStart(e.nativeEvent); }}>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {props.map((p) => <Billboard key={p.id} kind={p.kind} x={p.x} z={p.z} s={p.s} />)}
    </group>
  );
}

/** Scene backdrop for the board. `scene` = 'forest' | 'grid'. */
export default function SceneEnv({ scene = 'forest', onOrbitStart, stage }) {
  if (scene === 'grid') return <GridScene onOrbitStart={onOrbitStart} />;
  return <ForestScene onOrbitStart={onOrbitStart} stage={stage} />;
}

// scene registry — bg + fog per scene (attached in Board3D), plus playmat theming.
export const SCENES = {
  forest: {
    name: 'Forest', bg: '#dfe7d2', fog: ['#d3e0cf', 26, 72],
    playmat: { ally: '#e8d79a', enemy: '#e6a488', slotFill: '#241c10', banner: true, fieldAlly: '#e8d79a', fieldEnemy: '#e6a488' },
  },
  grid: {
    name: 'Admin Grid', bg: '#0c0805', fog: ['#0c0805', 18, 52],
    playmat: { ally: '#e6c079', enemy: '#d68f74', slotFill: '#20160d', banner: false, fieldAlly: '#e6c079', fieldEnemy: '#d68f74' },
  },
};
