// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/world/WorldScene — OPEN-WORLD exploration, built on the same 3D   ║
// ║ billboard scene tech as combat (SceneEnv). The world is a GRID of stitched   ║
// ║ CHUNKS on a grass plane: the party (a portrait billboard) walks chunk-to-    ║
// ║ chunk with WASD / arrows / the on-screen D-pad, the camera eases to follow,  ║
// ║ and each battleground chunk shows an enemy billboard + a red ring. Stepping  ║
// ║ onto an uncleared battleground hands off to combat (worldStore.move →        ║
// ║ enterBattle). Cleared chunks turn to a calm campfire marker. A DOM minimap   ║
// ║ tracks the grid. This is the first cut of the roguelike overworld — chunks   ║
// ║ are the seam where exploration and battle share one scene language.          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../store/worldStore.js';
import { skyTexture, grassTexture, PROP_TEX, PROP_SIZE, shadowTexture } from '../battle/SceneEnv.jsx';
import { sizedPortrait } from '../../data/sizeArt.js';
import { creatureArt } from '../../data/artPool.js';
import './world.css';

const CHUNK = 9;                             // world units per chunk
const cellToWorld = (x, y) => [x * CHUNK, y * CHUNK];

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// portrait for a creature → a texture URL (generated portrait → pixel art → null)
function portraitUrl(c) {
  if (!c) return null;
  return sizedPortrait(c.portrait, c.form)
    || (c.axes?.biology ? creatureArt({ id: c.id, biology: c.axes.biology, family: c.axes.family, subtypes: c.axes.subtypes }) : null);
}

// A camera-facing portrait billboard (party / enemy marker) with a ground shadow + bob.
function PortraitBillboard({ url, color = '#c9a66b', x, z, w = 2.2, h = 2.9, bob = 0.12, ring = null, y0 = 0 }) {
  const grp = useRef();
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!url) { setTex(null); return undefined; }
    let alive = true;
    const t = new THREE.TextureLoader().load(url, () => { if (alive) setTex(t); }, undefined, () => { if (alive) setTex(null); });
    t.colorSpace = THREE.SRGBColorSpace;
    return () => { alive = false; };
  }, [url]);
  const ph = useRef(Math.random() * 6.28);
  const wp = useRef(new THREE.Vector3());
  useFrame(({ camera, clock }) => {
    const g = grp.current; if (!g) return;
    g.getWorldPosition(wp.current);   // yaw-to-camera must use WORLD pos (the group is nested)
    g.rotation.y = Math.atan2(camera.position.x - wp.current.x, camera.position.z - wp.current.z);
    g.position.y = y0 + h / 2 + Math.sin(clock.elapsedTime * 2 + ph.current) * bob;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[w * 0.9, w * 0.5]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[w * 0.62, w * 0.82, 32]} />
          <meshBasicMaterial color={ring} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <group ref={grp} position={[0, y0 + h / 2, 0]}>
        {/* solid colored token backing — always visible even if the portrait is transparent */}
        <mesh><planeGeometry args={[w * 0.72, h * 0.9]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false} /></mesh>
        {tex && <mesh position={[0, 0, 0.02]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      </group>
    </group>
  );
}

// Scenery scattered inside one chunk (deterministic per chunk seed), kept off the centre.
function ChunkDecor({ x, y, seed }) {
  const items = useMemo(() => {
    const rng = mulberry32((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791));
    const kinds = ['tree', 'tree', 'pine', 'bush', 'rock'];
    const [wx, wz] = cellToWorld(x, y);
    const out = [];
    const n = 2 + ((seed + x + y) % 3);
    for (let i = 0; i < n; i++) {
      const ang = rng() * 6.28, rad = 3.7 + rng() * 1.6;   // ring near the chunk edge → centre stays clear for the party
      out.push({ id: i, kind: kinds[(rng() * kinds.length) | 0], x: wx + Math.cos(ang) * rad, z: wz + Math.sin(ang) * rad, s: 0.7 + rng() * 0.5 });
    }
    return out;
  }, [x, y, seed]);
  return items.map((it) => <ChunkProp key={it.id} {...it} />);
}
function ChunkProp({ kind, x, z, s }) {
  const ref = useRef();
  const tex = useMemo(() => PROP_TEX[kind](), [kind]);
  const [w, h] = PROP_SIZE[kind]; const W = w * s, H = h * s;
  useFrame(({ camera }) => { const m = ref.current; if (m) m.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><planeGeometry args={[W * 0.8, W * 0.42]} /><meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh ref={ref} position={[0, H / 2, 0]}><planeGeometry args={[W, H]} /><meshBasicMaterial map={tex} transparent alphaTest={0.5} toneMapped={false} /></mesh>
    </group>
  );
}

// faint chunk-boundary lattice so the "stitched chunks" read on the ground.
function ChunkGrid({ w, h }) {
  const geo = useMemo(() => {
    const pts = [];
    for (let x = 0; x <= w; x++) { pts.push(new THREE.Vector3(x * CHUNK - CHUNK / 2, 0.02, -CHUNK / 2), new THREE.Vector3(x * CHUNK - CHUNK / 2, 0.02, (h - 0.5) * CHUNK)); }
    for (let y = 0; y <= h; y++) { pts.push(new THREE.Vector3(-CHUNK / 2, 0.02, y * CHUNK - CHUNK / 2), new THREE.Vector3((w - 0.5) * CHUNK, 0.02, y * CHUNK - CHUNK / 2)); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [w, h]);
  return <lineSegments geometry={geo}><lineBasicMaterial color="#2c4a24" transparent opacity={0.5} /></lineSegments>;
}

function SkyDome() {
  return <mesh><sphereGeometry args={[90, 32, 20]} /><meshBasicMaterial map={skyTexture()} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} /></mesh>;
}

// The party billboard + follow camera in ONE rig (avoids a cross-component ref race): a
// single smoothed avatar position drives BOTH the party marker and the camera, easing toward
// the party's current chunk each frame.
function PartyRig({ url }) {
  const { camera } = useThree();
  const pos = useWorld((s) => s.pos);
  const grp = useRef();
  const avatar = useRef(new THREE.Vector3(cellToWorld(pos.x, pos.y)[0], 0, cellToWorld(pos.x, pos.y)[1]));
  const want = useRef(avatar.current.clone());
  const look = useRef(new THREE.Vector3(avatar.current.x, 1.4, avatar.current.z));
  useEffect(() => { const [x, z] = cellToWorld(pos.x, pos.y); want.current.set(x, 0, z); }, [pos.x, pos.y]);
  useFrame(() => {
    avatar.current.lerp(want.current, 0.12);
    const a = avatar.current;
    if (grp.current) grp.current.position.copy(a);
    camera.position.lerp(new THREE.Vector3(a.x, 10.5, a.z + 11), 0.1);
    look.current.lerp(new THREE.Vector3(a.x, 1.4, a.z), 0.14);
    camera.lookAt(look.current);
  });
  return (
    <group ref={grp} position={[avatar.current.x, 0, avatar.current.z]}>
      <PortraitBillboard url={url} color="#e8c06a" x={0} z={0} w={2.6} h={3.4} ring="#ffe08a" />
    </group>
  );
}

function Board() {
  const grid = useWorld((s) => s.grid);
  const gridW = useWorld((s) => s.gridW);
  const gridH = useWorld((s) => s.gridH);
  const party = useWorld((s) => s.party);
  const pos = useWorld((s) => s.pos);
  const grass = useMemo(() => { const t = grassTexture(); return t; }, []);
  const leadUrl = useMemo(() => portraitUrl(party?.[0]?.creatures?.[0]), [party]);
  const cells = Object.values(grid);
  return (
    <>
      <color attach="background" args={['#dfe7d2']} />
      <fog attach="fog" args={['#d3e0cf', 34, 96]} />
      <ambientLight intensity={0.95} color="#eaf1e6" />
      <directionalLight position={[8, 13, 6]} intensity={1.15} color="#fff2d6" />
      <hemisphereLight args={['#bfe0ff', '#3a5a2a', 0.5]} />
      <SkyDome />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(gridW - 1) * CHUNK / 2, -0.02, (gridH - 1) * CHUNK / 2]}>
        <planeGeometry args={[gridW * CHUNK + 60, gridH * CHUNK + 60]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      <ChunkGrid w={gridW} h={gridH} />
      {cells.filter((ch) => !(ch.x === pos.x && ch.y === pos.y)).map((ch) => <ChunkDecor key={`d${ch.x},${ch.y}`} x={ch.x} y={ch.y} seed={ch.seed} />)}
      {cells.filter((ch) => ch.kind === 'battle' && !ch.cleared).map((ch) => {
        const [x, z] = cellToWorld(ch.x, ch.y);
        return <PortraitBillboard key={`e${ch.x},${ch.y}`} url={null} color="#c0492f" x={x} z={z} w={2.4} h={3.0} ring="#ff5a3c" />;
      })}
      {cells.filter((ch) => ch.cleared).map((ch) => {
        const [x, z] = cellToWorld(ch.x, ch.y);
        return (
          <mesh key={`c${ch.x},${ch.y}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.05, z]}>
            <ringGeometry args={[0.6, 0.9, 20]} /><meshBasicMaterial color="#6ea24a" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        );
      })}
      <PartyRig url={leadUrl} />
    </>
  );
}

export default function WorldScene() {
  const move = useWorld((s) => s.move);
  const pos = useWorld((s) => s.pos);
  const grid = useWorld((s) => s.grid);
  const gridW = useWorld((s) => s.gridW);
  const gridH = useWorld((s) => s.gridH);

  // keyboard movement (one chunk per press; ignore auto-repeat)
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') { move(0, -1); e.preventDefault(); }
      else if (k === 's' || k === 'arrowdown') { move(0, 1); e.preventDefault(); }
      else if (k === 'a' || k === 'arrowleft') { move(-1, 0); e.preventDefault(); }
      else if (k === 'd' || k === 'arrowright') { move(1, 0); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  return (
    <div className="worldScreen">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 10, 14], fov: 52, near: 0.1, far: 240 }}>
        <Board />
      </Canvas>

      {/* HUD: title + hint */}
      <div className="wTop">
        <div className="wTitle"><iconify-icon icon="tabler:compass" /> Overworld</div>
        <div className="wHint">WASD / arrows to travel · walk into a <b>red</b> chunk to fight</div>
      </div>

      {/* minimap of the chunk grid */}
      <div className="wMap" style={{ gridTemplateColumns: `repeat(${gridW}, 1fr)` }}>
        {Array.from({ length: gridH }).map((_, y) => Array.from({ length: gridW }).map((_, x) => {
          const ch = grid[`${x},${y}`];
          const here = pos.x === x && pos.y === y;
          const cls = here ? 'here' : ch.cleared ? 'cleared' : ch.kind === 'battle' ? 'battle' : 'field';
          return <span key={`${x},${y}`} className={`wCell ${cls}`} />;
        }))}
      </div>

      {/* on-screen D-pad (touch) */}
      <div className="wPad">
        <button className="wUp" onClick={() => move(0, -1)}><iconify-icon icon="tabler:chevron-up" /></button>
        <button className="wLeft" onClick={() => move(-1, 0)}><iconify-icon icon="tabler:chevron-left" /></button>
        <button className="wRight" onClick={() => move(1, 0)}><iconify-icon icon="tabler:chevron-right" /></button>
        <button className="wDown" onClick={() => move(0, 1)}><iconify-icon icon="tabler:chevron-down" /></button>
      </div>
    </div>
  );
}
