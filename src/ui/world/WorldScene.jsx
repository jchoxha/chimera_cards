// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/world/WorldScene — OPEN-WORLD exploration on the same billboard    ║
// ║ scene tech as combat (SceneEnv), viewed from the SAME default battlefield     ║
// ║ camera. The world is a PROCEDURAL grid of stitched CHUNKS, each a BIOME tile  ║
// ║ (forest/plains/desert/snow/marsh) with CONTENT (empty · wild · town · event · ║
// ║ dungeon). The party (a portrait billboard) walks chunk-to-chunk (WASD/arrows/ ║
// ║ D-pad, eased follow-camera). Wild/dungeon chunks hand off to a battle fought   ║
// ║ on that chunk's biome; towns/events pop a modal. A DOM minimap + legend track  ║
// ║ the grid.                                                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../store/worldStore.js';
import { skyTexture, groundTexture, biomeOf, PROP_TEX, PROP_SIZE, shadowTexture } from '../battle/SceneEnv.jsx';
import { sizedPortrait } from '../../data/sizeArt.js';
import { creatureArt } from '../../data/artPool.js';
import { enterLandscapeFullscreen, wantsLandscape } from '../mobile.js';
import './world.css';

const CHUNK = 9;
const cellToWorld = (x, y) => [x * CHUNK, y * CHUNK];
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function portraitUrl(c) {
  if (!c) return null;
  return sizedPortrait(c.portrait, c.form)
    || (c.axes?.biology ? creatureArt({ id: c.id, biology: c.axes.biology, family: c.axes.family, subtypes: c.axes.subtypes }) : null);
}

// ── content-marker textures (town hut · dungeon portal · event signpost) ──
function bake(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const _mk = {};
function houseTexture() {
  if (_mk.town) return _mk.town;
  _mk.town = bake(160, 160, (ctx) => {
    ctx.strokeStyle = '#3a2415'; ctx.lineWidth = 4;
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(38, 78, 84, 66); ctx.strokeRect(38, 78, 84, 66);        // wall
    ctx.fillStyle = '#b0432f'; ctx.beginPath(); ctx.moveTo(28, 80); ctx.lineTo(80, 34); ctx.lineTo(132, 80); ctx.closePath(); ctx.fill(); ctx.stroke();  // roof
    ctx.fillStyle = '#3a2415'; ctx.fillRect(70, 108, 22, 36);                                        // door
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(48, 92, 16, 16); ctx.fillRect(98, 92, 16, 16);           // windows
  });
  return _mk.town;
}
function portalTexture() {
  if (_mk.dungeon) return _mk.dungeon;
  _mk.dungeon = bake(150, 170, (ctx) => {
    ctx.fillStyle = '#4a4650'; ctx.strokeStyle = '#26232c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(24, 165); ctx.lineTo(24, 74); ctx.arc(75, 74, 51, Math.PI, 0); ctx.lineTo(126, 165); ctx.stroke();   // arch stones
    const g = ctx.createLinearGradient(0, 40, 0, 165); g.addColorStop(0, '#6a3aa0'); g.addColorStop(1, '#1a0f2a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(34, 165); ctx.lineTo(34, 78); ctx.arc(75, 78, 41, Math.PI, 0); ctx.lineTo(116, 165); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(180,130,255,0.5)'; ctx.beginPath(); ctx.ellipse(75, 96, 22, 30, 0, 0, 6.28); ctx.fill();
  });
  return _mk.dungeon;
}
function eventTexture() {
  if (_mk.event) return _mk.event;
  _mk.event = bake(140, 160, (ctx) => {
    ctx.fillStyle = '#6a4a28'; ctx.fillRect(64, 70, 12, 82);                                          // post
    ctx.fillStyle = '#caa34e'; ctx.strokeStyle = '#3a2a12'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(30, 30, 80, 54, 10) : ctx.rect(30, 30, 80, 54); ctx.fill(); ctx.stroke();  // sign board
    ctx.fillStyle = '#3a2a12'; ctx.font = 'bold 46px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 70, 58);
  });
  return _mk.event;
}
const MARKER = {
  wild: { ring: '#ff5a3c', color: '#c0492f', tex: null, w: 2.4, h: 3.0 },
  dungeon: { ring: '#b060e0', color: '#5a3a80', tex: portalTexture, w: 2.6, h: 3.0 },
  town: { ring: '#4aa0ff', color: '#8a5a34', tex: houseTexture, w: 2.8, h: 2.8 },
  event: { ring: '#40d0c0', color: '#caa34e', tex: eventTexture, w: 2.2, h: 2.6 },
};

// camera-facing billboard with a ground shadow, ring, and optional texture (else a color slab).
function Billboard3D({ tex, color = '#c9a66b', x, z, w = 2.2, h = 2.9, bob = 0.12, ring = null }) {
  const grp = useRef();
  const wp = useRef(new THREE.Vector3());
  const ph = useRef(Math.random() * 6.28);
  useFrame(({ camera, clock }) => {
    const g = grp.current; if (!g) return;
    g.getWorldPosition(wp.current);
    g.rotation.y = Math.atan2(camera.position.x - wp.current.x, camera.position.z - wp.current.z);
    g.position.y = h / 2 + Math.sin(clock.elapsedTime * 2 + ph.current) * bob;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><planeGeometry args={[w * 0.9, w * 0.5]} /><meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} /></mesh>
      {ring && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}><ringGeometry args={[w * 0.62, w * 0.84, 32]} /><meshBasicMaterial color={ring} transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>}
      <group ref={grp} position={[0, h / 2, 0]}>
        <mesh><planeGeometry args={[w * 0.72, h * 0.9]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false} /></mesh>
        {tex && <mesh position={[0, 0, 0.02]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      </group>
    </group>
  );
}

// scenery scattered inside one chunk (deterministic per seed), using the chunk's BIOME flora.
function ChunkDecor({ x, y, seed, flora, skip }) {
  const items = useMemo(() => {
    if (skip) return [];
    const rng = mulberry32((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791));
    const [wx, wz] = cellToWorld(x, y);
    const out = [];
    const n = 2 + ((seed + x + y) % 3);
    for (let i = 0; i < n; i++) {
      const ang = rng() * 6.28, rad = 3.7 + rng() * 1.6;
      out.push({ id: i, kind: flora[(rng() * flora.length) | 0], x: wx + Math.cos(ang) * rad, z: wz + Math.sin(ang) * rad, s: 0.7 + rng() * 0.5 });
    }
    return out;
  }, [x, y, seed, flora, skip]);
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

// one biome-tinted ground tile per chunk (regions read as distinct biomes).
function ChunkTile({ x, y, biome }) {
  const g = useMemo(() => groundTexture(), []);
  const [wx, wz] = cellToWorld(x, y);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wx, -0.02, wz]}>
      <planeGeometry args={[CHUNK * 1.02, CHUNK * 1.02]} />
      <meshStandardMaterial map={g} color={biomeOf(biome).ground} roughness={1} />
    </mesh>
  );
}

function SkyDome({ tint }) {
  return <mesh><sphereGeometry args={[110, 32, 20]} /><meshBasicMaterial map={skyTexture()} color={tint} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} /></mesh>;
}

// Party billboard + follow camera in ONE rig — matches the battle's DEFAULT field framing so
// exploring reads like standing on the battlefield.
function PartyRig({ url }) {
  const { camera } = useThree();
  const pos = useWorld((s) => s.pos);
  const grp = useRef();
  const avatar = useRef(new THREE.Vector3(cellToWorld(pos.x, pos.y)[0], 0, cellToWorld(pos.x, pos.y)[1]));
  const want = useRef(avatar.current.clone());
  const look = useRef(new THREE.Vector3(avatar.current.x, 0.4, avatar.current.z));
  useEffect(() => { const [x, z] = cellToWorld(pos.x, pos.y); want.current.set(x, 0, z); }, [pos.x, pos.y]);
  useFrame(() => {
    avatar.current.lerp(want.current, 0.12);
    const a = avatar.current;
    if (grp.current) grp.current.position.copy(a);
    // matches viewFor(field): target y≈0.2, pol≈0.72, dist≈14.2 → offset (0, ~10.8, ~9.4)
    camera.position.lerp(new THREE.Vector3(a.x, 10.8, a.z + 9.4), 0.1);
    look.current.lerp(new THREE.Vector3(a.x, 0.4, a.z), 0.14);
    camera.lookAt(look.current);
  });
  return (
    <group ref={grp} position={[avatar.current.x, 0, avatar.current.z]}>
      <Billboard3D tex={useMemo(() => (url ? new THREE.TextureLoader().load(url) : null), [url])} color="#e8c06a" x={0} z={0} w={2.6} h={3.4} ring="#ffe08a" />
    </group>
  );
}

function Board() {
  const grid = useWorld((s) => s.grid);
  const party = useWorld((s) => s.party);
  const pos = useWorld((s) => s.pos);
  const leadUrl = useMemo(() => portraitUrl(party?.[0]?.creatures?.[0]), [party]);
  const cells = Object.values(grid);
  const hereBiome = grid[`${pos.x},${pos.y}`]?.biome || 'forest';
  return (
    <>
      <color attach="background" args={[biomeOf(hereBiome).fog]} />
      <fog attach="fog" args={[biomeOf(hereBiome).fog, 34, 104]} />
      <ambientLight intensity={0.96} color="#eef3ea" />
      <directionalLight position={[8, 13, 6]} intensity={1.12} color="#fff2d6" />
      <hemisphereLight args={['#bfe0ff', '#3a5a2a', 0.5]} />
      <SkyDome tint={biomeOf(hereBiome).sky} />
      {cells.map((ch) => <ChunkTile key={`t${ch.x},${ch.y}`} x={ch.x} y={ch.y} biome={ch.biome} />)}
      {cells.filter((ch) => !(ch.x === pos.x && ch.y === pos.y)).map((ch) => (
        <ChunkDecor key={`d${ch.x},${ch.y}`} x={ch.x} y={ch.y} seed={ch.seed} flora={biomeOf(ch.biome).flora} />
      ))}
      {cells.map((ch) => {
        if (ch.cleared || ch.kind === 'empty') return null;
        const m = MARKER[ch.kind]; if (!m) return null;
        const [x, z] = cellToWorld(ch.x, ch.y);
        return <Billboard3D key={`m${ch.x},${ch.y}`} tex={m.tex ? m.tex() : null} color={m.color} x={x} z={z} w={m.w} h={m.h} ring={m.ring} />;
      })}
      {cells.filter((ch) => ch.cleared).map((ch) => { const [x, z] = cellToWorld(ch.x, ch.y); return (
        <mesh key={`c${ch.x},${ch.y}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.05, z]}><ringGeometry args={[0.55, 0.85, 20]} /><meshBasicMaterial color="#7bbf5a" transparent opacity={0.5} depthWrite={false} /></mesh>
      ); })}
      <PartyRig url={leadUrl} />
    </>
  );
}

const LEGEND = [
  { cls: 'wild', label: 'Wild' }, { cls: 'dungeon', label: 'Dungeon' },
  { cls: 'town', label: 'Town' }, { cls: 'event', label: 'Event' },
];

export default function WorldScene() {
  const move = useWorld((s) => s.move);
  const pos = useWorld((s) => s.pos);
  const grid = useWorld((s) => s.grid);
  const gridW = useWorld((s) => s.gridW);
  const gridH = useWorld((s) => s.gridH);
  const event = useWorld((s) => s.event);
  const closeEvent = useWorld((s) => s.closeEvent);

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

  useEffect(() => {
    if (!wantsLandscape()) return undefined;
    const go = () => { enterLandscapeFullscreen(); window.removeEventListener('pointerdown', go); };
    window.addEventListener('pointerdown', go, { once: true });
    return () => window.removeEventListener('pointerdown', go);
  }, []);

  const hereBiome = biomeOf(grid[`${pos.x},${pos.y}`]?.biome);

  return (
    <div className="worldScreen">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 11, 15], fov: 46, near: 0.1, far: 260 }}>
        <Board />
      </Canvas>

      <div className="wTop">
        <div className="wTitle"><iconify-icon icon="tabler:compass" /> {hereBiome.name}</div>
        <div className="wHint">WASD / arrows to travel · <b>red</b>=fight · <span className="wTownTxt">blue</span>=town · <span className="wEvtTxt">?</span>=event · <span className="wDunTxt">portal</span>=dungeon</div>
      </div>

      <div className="wMapWrap">
        <div className="wMap" style={{ gridTemplateColumns: `repeat(${gridW}, 1fr)` }}>
          {Array.from({ length: gridH }).map((_, y) => Array.from({ length: gridW }).map((_, x) => {
            const ch = grid[`${x},${y}`];
            const here = pos.x === x && pos.y === y;
            const cls = here ? 'here' : ch.cleared ? 'cleared' : (ch.kind !== 'empty' ? ch.kind : 'field');
            const style = (cls === 'field') ? { background: biomeOf(ch.biome).map } : undefined;
            return <span key={`${x},${y}`} className={`wCell ${cls}`} style={style} />;
          }))}
        </div>
        <div className="wLegend">{LEGEND.map((l) => <span key={l.cls} className="wLegItem"><span className={`wCell ${l.cls}`} />{l.label}</span>)}</div>
      </div>

      <div className="wPad">
        <button className="wUp" onClick={() => move(0, -1)}><iconify-icon icon="tabler:chevron-up" /></button>
        <button className="wLeft" onClick={() => move(-1, 0)}><iconify-icon icon="tabler:chevron-left" /></button>
        <button className="wRight" onClick={() => move(1, 0)}><iconify-icon icon="tabler:chevron-right" /></button>
        <button className="wDown" onClick={() => move(0, 1)}><iconify-icon icon="tabler:chevron-down" /></button>
      </div>

      {/* town / event popup */}
      {event && (
        <div className="wEventWrap" onClick={closeEvent}>
          <div className={`wEvent ${event.kind}`} onClick={(e) => e.stopPropagation()}>
            <div className="wEventIcon"><iconify-icon icon={event.icon} /></div>
            <h3>{event.title}</h3>
            <p>{event.text}</p>
            <button className="wEventBtn" onClick={closeEvent}>Continue</button>
          </div>
        </div>
      )}

      {/* mobile portrait gate (battle.css owns .bRotateGate, always loaded in this shell) */}
      <div className="bRotateGate">
        <iconify-icon icon="tabler:device-mobile-rotated" />
        <p>This game plays in <b>landscape</b>.</p>
        <button className="bRotateBtn" onClick={enterLandscapeFullscreen}>
          <iconify-icon icon="tabler:maximize" /> Enter fullscreen &amp; rotate
        </button>
        <small>If your device doesn't rotate on its own, turn it sideways.</small>
      </div>
    </div>
  );
}
