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
import React, { useEffect, useMemo, useRef } from 'react';
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
export function skyTexture() {
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
export function grassTexture() {
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
// NEUTRAL ground noise, tinted per-biome via the material `color` (multiply). One bake
// serves every biome — forest green, desert sand, snow, etc. all come from the tint.
let _ground = null;
export function groundTexture() {
  if (_ground) return _ground;
  _ground = bake(256, 256, (ctx) => {
    ctx.fillStyle = '#8f8f8a'; ctx.fillRect(0, 0, 256, 256);
    const rng = mulberry32(11);
    for (let i = 0; i < 1100; i++) {
      const x = rng() * 256, y = rng() * 256, r = 2 + rng() * 7, sh = rng();
      ctx.fillStyle = sh < 0.5 ? 'rgba(105,105,100,0.5)' : (sh < 0.82 ? 'rgba(150,150,142,0.45)' : 'rgba(190,190,180,0.4)');
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, rng() * 3.14, 0, 6.28); ctx.fill();
    }
  });
  _ground.wrapS = _ground.wrapT = THREE.RepeatWrapping; _ground.repeat.set(26, 26);
  return _ground;
}

// ── BIOMES: a palette + flora set per biome, shared by the battle backdrop AND the overworld
// so a chunk and the battle fought on it look like the SAME place. ──
export const BIOMES = {
  forest: { name: 'Forest', ground: '#4f7a3f', fog: '#d3e0cf', sky: '#cfe0e8', flora: ['tree', 'tree', 'pine', 'bush', 'rock'], map: '#3f5a30' },
  plains: { name: 'Plains', ground: '#7f9642', fog: '#e2e6c8', sky: '#d6e8ee', flora: ['bush', 'bush', 'rock', 'tree'], map: '#6f8a3a' },
  desert: { name: 'Desert', ground: '#c9a35c', fog: '#ecdcb2', sky: '#efe0c4', flora: ['rock', 'rock', 'bush'], map: '#c9a35c' },
  snow: { name: 'Snowfield', ground: '#dbe6ee', fog: '#eaf2f8', sky: '#e4eef6', flora: ['pine', 'pine', 'rock'], map: '#cdd8e0' },
  swamp: { name: 'Marsh', ground: '#4a5836', fog: '#9fae94', sky: '#c0ccc0', flora: ['tree', 'bush', 'rock'], map: '#3a4a30' },
};
export const biomeOf = (k) => BIOMES[k] || BIOMES.forest;

// soft round ground shadow (dark → transparent) for grounding billboards
let _shadow = null;
export function shadowTexture() {
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
export const PROP_TEX = { tree: treeRoundTexture, pine: pineTexture, rock: rockTexture, bush: bushTexture };
export const PROP_SIZE = { tree: [3.0, 4.2], pine: [2.6, 4.4], rock: [1.7, 1.3], bush: [1.5, 1.05] };

// ── an upright CYLINDRICAL billboard (yaw-to-camera; stays standing on tilt) ──
export function Billboard({ kind, x, z, s = 1 }) {
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
function scatterProps(stage, kinds = ['tree', 'tree', 'pine', 'bush', 'rock']) {
  const rng = mulberry32(2026);
  const out = [];
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

export function SkyDome({ tint = '#ffffff', radius = 74 }) {
  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[radius, 32, 20]} />
      <meshBasicMaterial map={skyTexture()} color={tint} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
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

// A BIOME scene: tinted sky dome + tinted ground + scattered 2.5D billboard flora. The same
// palette themes the battle backdrop AND the matching overworld chunk (seamless-place). In
// `bare` mode (a stitched WorldTerrain provides the ground/flora/content) only the sky + lights
// render, plus a big invisible plane so table-drag orbit + tap-to-step-up still work.
function BiomeScene({ onOrbitStart, stage, biome, bare = false }) {
  const b = biomeOf(biome);
  const ground = useMemo(() => groundTexture(), []);
  const props = useMemo(() => (bare ? [] : scatterProps(stage, b.flora)), [stage, b.flora, bare]);
  return (
    <group>
      <ambientLight intensity={0.94} color="#eef3ea" />
      <directionalLight position={[6, 11, 5]} intensity={1.12} color="#fff2d6" />
      <directionalLight position={[-6, 5, -3]} intensity={0.4} color="#9fc6ff" />
      <hemisphereLight args={['#bfe0ff', b.ground, 0.5]} />
      <SkyDome tint={b.sky} />
      {/* BASE ground: the current biome, filling the whole view (no void at the world edge). In
          `bare` mode it sits just BELOW the stitched WorldTerrain tiles, which layer on top. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bare ? -0.06 : -0.02, -0.5]}
        onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onOrbitStart(e.nativeEvent); }}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial map={ground} color={b.ground} roughness={1} />
      </mesh>
      {props.map((p) => <Billboard key={p.id} kind={p.kind} x={p.x} z={p.z} s={p.s} />)}
    </group>
  );
}

/** Scene backdrop for the board. `scene` = a BIOME key (forest/plains/desert/snow/swamp) or 'grid'.
 *  `bare` (the stitched overworld) renders only sky+lights; WorldTerrain supplies the ground. */
export default function SceneEnv({ scene = 'forest', onOrbitStart, stage, bare = false }) {
  if (scene === 'grid') return <GridScene onOrbitStart={onOrbitStart} />;
  return <BiomeScene onOrbitStart={onOrbitStart} stage={stage} biome={scene} bare={bare} />;
}

// ── stitched overworld terrain: content-marker textures (town hut · dungeon portal · signpost) ──
const _mk = {};
function houseTexture() {
  if (_mk.town) return _mk.town;
  _mk.town = bake(160, 160, (ctx) => {
    ctx.strokeStyle = '#3a2415'; ctx.lineWidth = 4;
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(38, 78, 84, 66); ctx.strokeRect(38, 78, 84, 66);
    ctx.fillStyle = '#b0432f'; ctx.beginPath(); ctx.moveTo(28, 80); ctx.lineTo(80, 34); ctx.lineTo(132, 80); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2415'; ctx.fillRect(70, 108, 22, 36);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(48, 92, 16, 16); ctx.fillRect(98, 92, 16, 16);
  });
  return _mk.town;
}
function portalTexture() {
  if (_mk.dungeon) return _mk.dungeon;
  _mk.dungeon = bake(150, 170, (ctx) => {
    ctx.fillStyle = '#4a4650'; ctx.strokeStyle = '#26232c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(24, 165); ctx.lineTo(24, 74); ctx.arc(75, 74, 51, Math.PI, 0); ctx.lineTo(126, 165); ctx.stroke();
    const g = ctx.createLinearGradient(0, 40, 0, 165); g.addColorStop(0, '#6a3aa0'); g.addColorStop(1, '#1a0f2a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(34, 165); ctx.lineTo(34, 78); ctx.arc(75, 78, 41, Math.PI, 0); ctx.lineTo(116, 165); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(180,130,255,0.5)'; ctx.beginPath(); ctx.ellipse(75, 96, 22, 30, 0, 0, 6.28); ctx.fill();
  });
  return _mk.dungeon;
}
function signTexture() {
  if (_mk.event) return _mk.event;
  _mk.event = bake(140, 160, (ctx) => {
    ctx.fillStyle = '#6a4a28'; ctx.fillRect(64, 70, 12, 82);
    ctx.fillStyle = '#caa34e'; ctx.strokeStyle = '#3a2a12'; ctx.lineWidth = 4;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(30, 30, 80, 54, 10); else ctx.rect(30, 30, 80, 54); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a12'; ctx.font = 'bold 46px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 70, 58);
  });
  return _mk.event;
}
const MARKERS = {
  town: { tex: houseTexture, ring: '#4aa0ff', w: 3.0, h: 3.0 },
  dungeon: { tex: portalTexture, ring: '#b060e0', w: 3.0, h: 3.4 },
  event: { tex: signTexture, ring: '#40d0c0', w: 2.4, h: 2.7 },
};

const CHUNKW = 13;   // world units per chunk (a battlefield fits inside one; neighbours stay in view)
const _ZERO = new THREE.Vector3();

// a camera-facing content marker (house / portal / sign) with a ground ring + shadow.
function MarkerBillboard({ tex, ring, x, z, w, h }) {
  const grp = useRef();
  const wp = useRef(new THREE.Vector3());
  const ph = useRef(0);
  useFrame(({ camera, clock }) => {
    const g = grp.current; if (!g) return;
    g.getWorldPosition(wp.current);
    g.rotation.y = Math.atan2(camera.position.x - wp.current.x, camera.position.z - wp.current.z);
    g.position.y = h / 2 + Math.sin(clock.elapsedTime * 1.6 + ph.current) * 0.08;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><planeGeometry args={[w * 0.9, w * 0.5]} /><meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}><ringGeometry args={[w * 0.55, w * 0.72, 32]} /><meshBasicMaterial color={ring} transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>
      <group ref={grp} position={[0, h / 2, 0]}><mesh><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex()} transparent alphaTest={0.4} side={THREE.DoubleSide} toneMapped={false} /></mesh></group>
    </group>
  );
}

// flora scattered in a RING near a chunk's edges (leaves the centre clear for the battlefield /
// content prop). Deterministic per chunk.
function chunkFlora(ch, flora) {
  const rng = mulberry32((ch.x * 73856093) ^ (ch.y * 19349663) ^ 12345);
  const out = [];
  const n = 4 + ((ch.x + ch.y) % 4);
  for (let i = 0; i < n; i++) {
    const ang = rng() * 6.28, rad = 5.4 + rng() * 3.0;
    out.push({ id: i, kind: flora[(rng() * flora.length) | 0], lx: Math.cos(ang) * rad, lz: Math.sin(ang) * rad, s: 0.7 + rng() * 0.55 });
  }
  return out;
}

/** One stitched chunk: a biome-tinted ground tile + edge flora + an in-scene CONTENT prop
 *  (town/dungeon/event) toward the far edge (so it never overlaps the party at the centre). */
function ChunkTile3D({ ch, wx, wz }) {
  const b = biomeOf(ch.biome);
  const ground = useMemo(() => groundTexture(), []);
  const flora = useMemo(() => chunkFlora(ch, b.flora), [ch.x, ch.y, ch.biome]);
  const marker = (!ch.cleared && MARKERS[ch.kind]) ? MARKERS[ch.kind] : null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wx, -0.02, wz]}>
        <planeGeometry args={[CHUNKW * 1.02, CHUNKW * 1.02]} />
        <meshStandardMaterial map={ground} color={b.ground} roughness={1} />
      </mesh>
      {flora.map((f) => <Billboard key={f.id} kind={f.kind} x={wx + f.lx} z={wz + f.lz} s={f.s} />)}
      {marker && <MarkerBillboard tex={marker.tex} ring={marker.ring} x={wx} z={wz} w={marker.w} h={marker.h} />}
    </group>
  );
}

/** The stitched overworld ground around the current chunk: a radius of biome tiles that slide
 *  in from the travel direction each time `pos` changes (the party stays centred; the world
 *  scrolls under it). Content props ride the tiles, so towns/dungeons are visible in-scene. */
export function WorldTerrain({ grid, pos, radius = 2 }) {
  const groupRef = useRef();
  const slide = useRef(new THREE.Vector3());
  const last = useRef({ x: pos.x, y: pos.y });
  useEffect(() => {
    slide.current.x = (pos.x - last.current.x) * CHUNKW;   // new chunk eases in from the travel dir
    slide.current.z = (pos.y - last.current.y) * CHUNKW;
    last.current = { x: pos.x, y: pos.y };
  }, [pos.x, pos.y]);
  useFrame(() => { slide.current.lerp(_ZERO, 0.12); const g = groupRef.current; if (g) g.position.set(slide.current.x, 0, slide.current.z); });
  const tiles = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const ch = grid[`${pos.x + dx},${pos.y + dy}`]; if (!ch) continue;
    tiles.push({ ch, wx: dx * CHUNKW, wz: dy * CHUNKW });
  }
  return <group ref={groupRef}>{tiles.map((t) => <ChunkTile3D key={`${t.ch.x},${t.ch.y}`} ch={t.ch} wx={t.wx} wz={t.wz} />)}</group>;
}

// scene registry — bg + fog per scene (attached in Board3D), plus playmat theming. Every biome
// is a scene (the battle backdrop = the chunk's biome); 'grid' is the admin battlefield.
const bannerPlaymat = { ally: '#e8d79a', enemy: '#e6a488', slotFill: '#241c10', banner: true, fieldAlly: '#e8d79a', fieldEnemy: '#e6a488' };
const biomeScene = (key) => ({ name: BIOMES[key].name, bg: BIOMES[key].fog, fog: [BIOMES[key].fog, 26, 74], playmat: bannerPlaymat });
export const SCENES = {
  forest: biomeScene('forest'),
  plains: biomeScene('plains'),
  desert: biomeScene('desert'),
  snow: biomeScene('snow'),
  swamp: biomeScene('swamp'),
  grid: {
    name: 'Admin Grid', bg: '#0c0805', fog: ['#0c0805', 18, 52],
    playmat: { ally: '#e6c079', enemy: '#d68f74', slotFill: '#20160d', banner: false, fieldAlly: '#e6c079', fieldEnemy: '#d68f74' },
  },
};
