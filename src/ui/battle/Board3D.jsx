// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/Board3D — the COMBAT-V2 board as a REAL WebGL 3D scene   ║
// ║ (react-three-fiber). Creatures are textured card MESHES standing on a      ║
// ║ receding table; the enemy racks sit far, yours near, the camera looks      ║
// ║ across the table. Picking is by RAYCAST (r3f pointer events) — which works ║
// ║ on arbitrarily-rotated meshes, so truly-tilted 3D cards stay exactly       ║
// ║ tappable on touch/mouse (the thing CSS rotateX could not do). The hand +   ║
// ║ HUD stay DOM overlays (BattleScreen); this canvas is the board only.       ║
// ║ Data comes from the store snapshot; all game logic stays in the engine.    ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import HandDock3D from './HandDock3D.jsx';
import { ATTUNEMENT_COLOR, creatureColor } from '../../data/axisIcons.js';
import { creatureArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';

const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const CARD_W = 1.12, CARD_H = 1.54;

// Shared squad layout (used by the board AND the camera rig so focusing lines up).
// Cards lie FLAT so the front/back rows need more Z separation (a card is CARD_H deep).
const LAYOUT = { spacing: 3.6, frontZ: { e: -1.9, p: 1.6 }, backZ: { e: -3.6, p: 3.3 } };
const squadX = (i, n) => (i - (n - 1) / 2) * LAYOUT.spacing;
const squadCenter = (side, i, n) => ({ x: squadX(i, n), z: (LAYOUT.frontZ[side] + LAYOUT.backZ[side]) / 2 });

/** A text label baked to a CanvasTexture (system fonts — no CDN/troika font fetch,
 *  which the sandboxed/offline env blocks). Rendered on a thin plane. */
function useLabelTexture(text, { color = '#f6e7b0', px = 44, weight = 700 } = {}) {
  return useMemo(() => {
    const W = 512, H = 128;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.font = `${weight} ${px}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(String(text), W / 2, H / 2);
    ctx.fillStyle = color; ctx.fillText(String(text), W / 2, H / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }, [text, color, px, weight]);
}
function Label({ text, position, width = 1, color, px, weight }) {
  const tex = useLabelTexture(text, { color, px, weight });
  return (
    <mesh position={position}>
      <planeGeometry args={[width, width * 0.25]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** A unit's card art: generated portrait → pixel art → null (color fallback). */
function cardArtOf(u) {
  const p = sizedPortrait(u.portrait, u.form);
  if (p) return { url: p };
  const art = u.axes?.biology ? creatureArt({ id: u.id, biology: u.axes.biology, family: u.axes.family, subtypes: u.axes.subtypes }) : null;
  if (art) return { url: art, pixel: true };
  return { url: null, color: creatureColor({ attunement: u.axes?.attunement }) || '#8a6d3f' };
}

/** Load an image URL into a THREE texture WITHOUT suspense — 404s fall back to null
 *  (→ a solid colored card) instead of throwing, so a missing portrait never blanks
 *  the whole scene. Uses a plain <img> (no crossOrigin) — THREE's TextureLoader sets
 *  crossOrigin='anonymous', which some same-origin dev/static servers reject. */
function useImageTexture(url, pixel) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!url) { setTex(null); return undefined; }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
      t.needsUpdate = true;
      setTex(t);
    };
    img.onerror = () => { if (alive) setTex(null); };
    img.src = url;
    return () => { alive = false; };
  }, [url, pixel]);
  return tex;
}

/** One creature: a FLAT card mesh with name + HP bar on a fixed slot. Raycast-picked. */
function Card3D({ u, side, x, z, selected, acting, hovered, onPick, onOver, registerMesh }) {
  const art = useMemo(() => cardArtOf(u), [u.id, u.portrait, u.form]);
  const tex = useImageTexture(art.url, art.pixel);
  const grp = useRef();
  const meshRef = useRef();
  const scaleBase = u.isFront ? 1 : 0.82;
  const baseY = 0.05;   // cards lie FLAT on the table; select/act lifts them off it

  useEffect(() => { if (meshRef.current) registerMesh(u.id, meshRef.current); return () => registerMesh(u.id, null); }, [u.id]);

  useFrame(() => {
    const g = grp.current; if (!g) return;
    const lift = (selected ? 0.16 : 0) + (acting ? 0.5 : 0) + (hovered ? 0.06 : 0);
    g.position.y = THREE.MathUtils.lerp(g.position.y, baseY + lift, 0.16);
    const s = scaleBase * (acting ? 1.12 : 1);
    const cur = g.scale.x + (s - g.scale.x) * 0.16;
    g.scale.setScalar(cur);
  });

  const hpFrac = Math.max(0, Math.min(1, u.hp / u.maxHp));
  const frameColor = selected ? '#f0c84a' : (acting ? '#ffd873' : elColor(u.element));
  const dim = u.dead ? 0.4 : 1;

  // fully FLAT on the table (face up)
  return (
    <group ref={grp} position={[x, baseY, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* frame / border behind the face */}
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[CARD_W + 0.08, CARD_H + 0.08, 0.06]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.3} emissive={frameColor} emissiveIntensity={selected || acting ? 0.5 : 0.08} />
      </mesh>
      {/* the face (art or solid color) — the pick target. UNLIT so art shows true colors. */}
      <mesh ref={meshRef} userData={{ unitId: u.id, side }}
        onPointerDown={(e) => { e.stopPropagation(); onPick(u, side); }}
        onPointerOver={(e) => { e.stopPropagation(); onOver(u.id); }}
        onPointerOut={() => onOver(null)}>
        <boxGeometry args={[CARD_W, CARD_H, 0.06]} />
        {/* keyed so the material REMOUNTS when the texture arrives (map null→tex needs a
            shader recompile that r3f won't do on a prop change alone) */}
        {tex
          ? <meshBasicMaterial key="img" map={tex} color={new THREE.Color(dim, dim, dim)} toneMapped={false} />
          : <meshBasicMaterial key="col" color={art.color || '#8a6d3f'} toneMapped={false} />}
      </mesh>
      {/* name plate (dark strip behind for legibility) */}
      <mesh position={[0, CARD_H / 2 - 0.14, 0.045]}>
        <planeGeometry args={[CARD_W, 0.3]} />
        <meshBasicMaterial color="#0b0705" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <Label text={u.name} position={[0, CARD_H / 2 - 0.14, 0.05]} width={CARD_W - 0.06} color="#f6e7b0" px={40} />
      {/* HP bar */}
      <group position={[0, -CARD_H / 2 + 0.12, 0.05]}>
        <mesh><planeGeometry args={[CARD_W - 0.16, 0.14]} /><meshBasicMaterial color="#120b08" /></mesh>
        <mesh position={[-((CARD_W - 0.16) / 2) * (1 - hpFrac), 0, 0.002]} scale={[Math.max(0.0001, hpFrac), 1, 1]}>
          <planeGeometry args={[CARD_W - 0.16, 0.1]} />
          <meshBasicMaterial color={hpFrac <= 0.33 ? '#e6603a' : '#3fa860'} />
        </mesh>
        <Label text={u.hp} position={[0, 0, 0.004]} width={0.7} color="#ffffff" px={40} />
      </group>
      {/* block pip */}
      {u.block > 0 && <Label text={`+${u.block}`} position={[CARD_W / 2 - 0.2, -CARD_H / 2 + 0.34, 0.05]} width={0.5} color="#bcd4ff" px={40} />}
      {/* target reticle when a card is selected & this is a valid target */}
      {hovered && <mesh position={[0, 0, 0.08]}><ringGeometry args={[0.55, 0.66, 32]} /><meshBasicMaterial color="#7CFF9B" transparent opacity={0.9} /></mesh>}
    </group>
  );
}

/** The wooden table + a receding grid. Dragging the table ORBITS the camera; a plain
 *  tap on it returns to the overview. */
function Table({ onOrbitStart }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -0.5]}
        onPointerDown={(e) => { e.stopPropagation(); onOrbitStart(e.nativeEvent); }}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#2a1d10" roughness={1} />
      </mesh>
      <gridHelper args={[80, 80, '#5a4327', '#3a2a18']} position={[0, 0, -0.5]} />
    </group>
  );
}

const PAN_BOUND = 7;   // how far WASD can roam from the focus point (both axes)

/** Click-drag ORBIT + WASD PAN state the user controls (rides on top of the auto
 *  camera). Drag the table to rotate, wheel to zoom, WASD to pan (CAMERA-RELATIVE —
 *  the actual panning uses the live camera basis in CameraRig). Returns a STABLE
 *  object so effects that depend on it don't re-fire every render. */
function useOrbit() {
  const az = useRef(0);           // yaw around the table
  const pol = useRef(0.64);       // tilt from vertical (small = top-down)
  const zoom = useRef(1);         // user zoom multiplier
  const pan = useRef({ x: 0, z: 0 });   // WASD offset applied to the look-at (world)
  const keys = useRef({});
  const drag = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      const d = drag.current; if (!d) return;
      az.current = d.az - (e.clientX - d.x) * 0.006;
      pol.current = Math.max(0.12, Math.min(1.15, d.pol - (e.clientY - d.y) * 0.005));
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
    };
    const onUp = () => { const d = drag.current; drag.current = null; if (d && !d.moved && d.onTap) d.onTap(); };
    const onWheel = (e) => { zoom.current = Math.max(0.55, Math.min(1.8, zoom.current + Math.sign(e.deltaY) * 0.08)); };
    const isText = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const onKey = (down) => (e) => {
      const k = e.key.toLowerCase();
      if (!'wasd'.includes(k) || isText(e.target)) return;
      keys.current[k] = down; if (down) e.preventDefault();
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);
  const start = (e, onTap) => { drag.current = { x: e.clientX, y: e.clientY, az: az.current, pol: pol.current, moved: false, onTap }; };
  return useMemo(() => ({ az, pol, zoom, pan, keys, start }), []);
}

/** Navigable camera: eases the LOOK-AT toward an overview, or a FOCUS point {x,z}
 *  (a squad, or the acting creature during resolution). The user's orbit angle + zoom
 *  are applied on top, so click-drag navigation and auto-movement coexist. */
function CameraRig({ focus, orbit }) {
  const { camera, size } = useThree();
  const tgt = useRef(new THREE.Vector3(0, 0.2, -0.4));
  const dist = useRef(11);
  const fwd = useRef(new THREE.Vector3());
  useFrame((_, delta) => {
    // WASD pan, CAMERA-RELATIVE: move along the camera's own ground forward/right.
    const k = orbit.keys.current;
    const f = (k.w ? 1 : 0) - (k.s ? 1 : 0);
    const rt = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (f || rt) {
      camera.getWorldDirection(fwd.current); fwd.current.y = 0;
      if (fwd.current.lengthSq() > 1e-4) fwd.current.normalize();
      const rx = -fwd.current.z, rz = fwd.current.x;       // right = fwd rotated -90° on the ground
      const sp = 9 * Math.min(0.05, delta);
      const p = orbit.pan.current;
      p.x = Math.max(-PAN_BOUND, Math.min(PAN_BOUND, p.x + (fwd.current.x * f + rx * rt) * sp));
      p.z = Math.max(-PAN_BOUND, Math.min(PAN_BOUND, p.z + (fwd.current.z * f + rz * rt) * sp));
    }
    const aspect = size.width / Math.max(1, size.height);
    const fov = aspect < 1 ? 60 : 46;   // CONSTANT per aspect so the hand shelf never resizes
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const dt = focus ? new THREE.Vector3(focus.x, 0.3, focus.z) : new THREE.Vector3(0, 0.2, -0.4);
    dt.x += orbit.pan.current.x; dt.z += orbit.pan.current.z;   // WASD roam
    const dd = (focus ? 8.2 : (aspect < 1 ? 12 : 10.6)) * orbit.zoom.current;
    tgt.current.lerp(dt, 0.1);
    dist.current += (dd - dist.current) * 0.1;
    const r = dist.current, pol = orbit.pol.current, az = orbit.az.current;
    camera.position.set(
      tgt.current.x + r * Math.sin(pol) * Math.sin(az),
      tgt.current.y + r * Math.cos(pol),
      tgt.current.z + r * Math.sin(pol) * Math.cos(az),
    );
    camera.lookAt(tgt.current);
  });
  return null;
}

/** Exposes a screen→creature raycast picker so the DOM hand-drag can find a drop
 *  target over the canvas (returns a unitId or null). */
function Picker({ pickRef, meshes }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!pickRef) return undefined;
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    pickRef.current = (cx, cy) => {
      const rect = gl.domElement.getBoundingClientRect();
      v.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      const hits = ray.intersectObjects([...meshes.current.values()], false);
      return hits[0]?.object?.userData?.unitId || null;
    };
    return () => { pickRef.current = null; };
  }, [camera, gl, pickRef, meshes]);
  return null;
}

/** In-scene FX: a floating combat number that rises + fades over the struck creature. */
function FxItem({ it, meshes }) {
  const { camera } = useThree();
  const grp = useRef();
  const t = useRef(0);
  const pos = useRef(null);
  const tex = useLabelTexture(it.text, { color: it.color, px: 72, weight: 900 });
  useFrame((_, dt) => {
    const g = grp.current; if (!g) return;
    if (!pos.current) { const m = meshes.current.get(it.unitId); pos.current = m ? m.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.5, 0); }
    t.current += dt;
    g.position.set(pos.current.x, pos.current.y + 0.4 + t.current * 1.3, pos.current.z);
    g.quaternion.copy(camera.quaternion);   // billboard toward camera
    const o = Math.max(0, 1 - t.current / 1.2);
    const s = 1 + Math.min(0.35, t.current * 1.2);
    g.scale.setScalar(s);
    if (g.children[0]) g.children[0].material.opacity = o;
  });
  return (
    <group ref={grp}>
      <mesh><planeGeometry args={[1.1, 0.44]} /><meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}
function FxLayer({ items, meshes }) {
  return (items || []).map((it) => <FxItem key={it.key} it={it} meshes={meshes} />);
}

// ── Playmat (Yu-Gi-Oh-style): labelled slot outlines under every squad + creature ──
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function bakeCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// the three fixed slots of a squad (matches where creatures are placed) → alignment
const SLOT_W = CARD_W + 0.36, SLOT_H = CARD_H + 0.36;
function squadSlots(side, i, n) {
  const cx = squadX(i, n);
  return {
    front: { x: cx, z: LAYOUT.frontZ[side] },
    supp0: { x: cx - 1.2, z: LAYOUT.backZ[side] },
    supp1: { x: cx + 1.2, z: LAYOUT.backZ[side] },
    cx,
  };
}
function useSlotTexture(color, label) {   // dashed border + role label, transparent (opaque fill is a separate plane)
  return useMemo(() => bakeCanvas(256, 356, (ctx) => {
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.setLineDash([16, 11]);
    roundRect(ctx, 10, 10, 236, 336, 20); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = 'bold 30px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9; ctx.fillText(label, 128, 330);
  }), [color, label]);
}
function useTextTexture(text, color) {
  return useMemo(() => bakeCanvas(512, 96, (ctx) => {
    ctx.font = 'bold 44px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, 256, 48);
    ctx.fillStyle = color; ctx.fillText(text, 256, 48);
  }), [text, color]);
}
function SquadPlaymat({ side, squads, sq, i, focusId }) {
  const on = sq.id === focusId;
  const col = side === 'e' ? '#d68f74' : '#e6c079';
  const vTex = useSlotTexture(col, 'Vanguard');
  const sTex = useSlotTexture(col, 'Support');
  const labelTex = useTextTexture(`${side === 'e' ? 'Enemy' : 'Ally'} Squad ${i + 1}`, on ? '#ffdf8a' : col);
  const s = squadSlots(side, i, squads.length);
  const slots = [{ ...s.front, tex: vTex }, { ...s.supp0, tex: sTex }, { ...s.supp1, tex: sTex }];
  const lblZ = side === 'e' ? LAYOUT.backZ[side] - 1.05 : LAYOUT.backZ[side] + 1.05;
  return (
    <group>
      {slots.map((sl, j) => (
        <group key={j}>
          {/* OPAQUE fill blocks the grid behind the slot */}
          <mesh position={[sl.x, 0.004, sl.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SLOT_W, SLOT_H]} /><meshBasicMaterial color={on ? '#2a1c11' : '#20160d'} />
          </mesh>
          {/* dashed border + role label ON TOP (above the aura) */}
          <mesh position={[sl.x, 0.016, sl.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SLOT_W, SLOT_H]} /><meshBasicMaterial map={sl.tex} transparent depthWrite={false} opacity={on ? 1 : 0.55} />
          </mesh>
        </group>
      ))}
      <mesh position={[s.cx, 0.016, lblZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 0.49]} /><meshBasicMaterial map={labelTex} transparent depthWrite={false} opacity={on ? 1 : 0.7} />
      </mesh>
    </group>
  );
}
function Playmat({ enemy, player, focusId }) {
  return (
    <group>
      {enemy.map((sq, i) => <SquadPlaymat key={sq.id} side="e" squads={enemy} sq={sq} i={i} focusId={focusId} />)}
      {player.map((sq, i) => <SquadPlaymat key={sq.id} side="p" squads={player} sq={sq} i={i} focusId={focusId} />)}
    </group>
  );
}

/** Squads laid out on the table on their FIXED slots; a ground AURA (below the slot
 *  labels) highlights the selected squad / hovered creature. */
function Side({ squads, side, focusId, actingId, hoverId, onPick, onOver, registerMesh }) {
  return squads.map((sq, i) => {
    const s = squadSlots(side, i, squads.length);
    const front = sq.units.find((u) => u.isFront);
    const supp = sq.units.filter((u) => !u.isFront);
    const placed = [];
    if (front) placed.push({ u: front, ...s.front });
    if (supp[0]) placed.push({ u: supp[0], ...s.supp0 });
    if (supp[1]) placed.push({ u: supp[1], ...s.supp1 });
    const on = sq.id === focusId;
    return (
      <group key={sq.id}>
        {placed.map(({ u, x, z }) => {
          const glow = on ? '#f0c84a' : (hoverId === u.id ? '#cfe0ff' : null);
          return (
            <group key={u.id}>
              {glow && (   // AURA on the ground, BELOW the slot labels (y 0.010 < label 0.016)
                <mesh position={[x, 0.010, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[SLOT_W + 0.7, SLOT_H + 0.7]} />
                  <meshBasicMaterial color={glow} transparent opacity={on ? 0.55 : 0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
              )}
              <Card3D u={u} side={side} x={x} z={z}
                selected={on} acting={actingId === u.id} hovered={hoverId === u.id}
                onPick={onPick} onOver={onOver} registerMesh={registerMesh} />
            </group>
          );
        })}
      </group>
    );
  });
}

export default function Board3D({ enemy, player, focusId, actingId, onPick, pickRef, hand, fx }) {
  const [hoverId, setHoverId] = useState(null);
  const orbit = useOrbit();
  const meshes = useRef(new Map());
  const registerMesh = (id, m) => { if (m) meshes.current.set(id, m); else meshes.current.delete(id); };

  // unit → its squad center (auto-follow the acting creature) + squadId → center
  const { unitCenter, squadCenterById } = useMemo(() => {
    const uc = new Map(); const sc = new Map();
    [[enemy, 'e'], [player, 'p']].forEach(([arr, side]) =>
      arr.forEach((sq, i) => { const c = squadCenter(side, i, arr.length); sc.set(sq.id, c); sq.units.forEach((u) => uc.set(u.id, c)); }));
    return { unitCenter: uc, squadCenterById: sc };
  }, [enemy, player]);
  // the camera FOLLOWS the selected squad (or the acting creature during resolution)
  const focus = actingId ? (unitCenter.get(actingId) || squadCenterById.get(focusId)) : (squadCenterById.get(focusId) || null);
  // recentre (clear WASD roam) whenever the focused squad changes
  useEffect(() => { orbit.pan.current.x = 0; orbit.pan.current.z = 0; }, [focusId, orbit]);

  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 8, 7], fov: 46, near: 0.1, far: 120 }}
      onPointerMissed={() => setHoverId(null)}>
      <color attach="background" args={['#0c0805']} />
      <fog attach="fog" args={['#0c0805', 18, 52]} />
      <CameraRig focus={focus} orbit={orbit} />
      <Picker pickRef={pickRef} meshes={meshes} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[4, 9, 7]} intensity={1.1} />
      <directionalLight position={[-5, 4, 2]} intensity={0.35} color="#8fb4ff" />
      <Table onOrbitStart={(ne) => orbit.start(ne)} />
      <Playmat enemy={enemy} player={player} focusId={focusId} />
      <Side squads={enemy} side="e" focusId={focusId} actingId={actingId} hoverId={hoverId} onPick={onPick} onOver={setHoverId} registerMesh={registerMesh} />
      <Side squads={player} side="p" focusId={focusId} actingId={actingId} hoverId={hoverId} onPick={onPick} onOver={setHoverId} registerMesh={registerMesh} />
      {hand && <HandDock3D {...hand} />}
      <FxLayer items={fx} meshes={meshes} />
    </Canvas>
  );
}
