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
import HandDock3D, { useActionCardTexture, HAND_CARD_W, HAND_CARD_H } from './HandDock3D.jsx';
import { creatureColor, ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import { creatureArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';
import { drawCreatureFace, makeFaceTexture } from './cardArt3d.js';

const CARD_W = 1.12, CARD_H = 1.54;
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';

// Shared squad layout (used by the board AND the camera rig so focusing lines up).
// Cards lie FLAT so the front/back rows need generous Z separation (a card is CARD_H
// deep) AND squads need generous X spacing — otherwise the slot outlines overlap.
const SUPP_DX = 1.35;   // support slot horizontal offset from the squad centre
const LAYOUT = { spacing: 4.4, frontZ: { e: -1.8, p: 1.6 }, backZ: { e: -4.0, p: 3.8 } };
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

/** Bake a creature card face through the SHARED TCG frame (a plain <img> loads the
 *  portrait — no crossOrigin, which some same-origin dev servers reject — then the face
 *  is re-baked with the art). HP is drawn LIVE as a separate mesh, so it never re-bakes. */
function useCreatureFace(u) {
  const [tex, setTex] = useState(null);
  const art = useMemo(() => cardArtOf(u), [u.id, u.portrait, u.form]);
  useEffect(() => {
    const { texture, canvas } = makeFaceTexture(384, 528, () => {});
    const ctx = canvas.getContext('2d');
    let alive = true;
    const redraw = (img) => { if (!alive) return; drawCreatureFace(ctx, u, img); texture.needsUpdate = true; setTex(texture); };
    redraw(null);
    if (art.url) { const img = new Image(); img.onload = () => redraw(img); img.onerror = () => {}; img.src = art.url; }
    return () => { alive = false; texture.dispose(); };
    // deps are the BAKED fields only (HP is live/overlaid) so a new `u` object each render
    // doesn't re-bake; `u` inside redraw is fine because these fields are stable per creature.
  }, [u.id, u.name, u.element, u.sizeWord, art.url, u.axes?.biology, u.axes?.attunement]);
  return { tex, art };
}

/** One creature: a FLAT TCG card mesh (baked face) with a LIVE HP bar. Raycast-picked. */
function Card3D({ u, side, x, z, selected, acting, hovered, onPick, onOver, registerMesh }) {
  const { tex, art } = useCreatureFace(u);
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
  const dim = u.dead ? 0.4 : 1;
  const hpW = CARD_W - 0.26;          // HP bar width (over the reserved plate baked in the face)
  const hpY = -CARD_H / 2 + 0.18;     // sits on the bottom stat plate

  // fully FLAT on the table (face up) — the whole card is one BAKED TCG face; HP is live.
  return (
    <group ref={grp} position={[x, baseY, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* selection / acting glow edge behind the card */}
      {(selected || acting) && (
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[CARD_W + 0.14, CARD_H + 0.14]} />
          <meshBasicMaterial color={acting ? '#ffd873' : '#f0c84a'} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}
      {/* the baked TCG face — the pick target. UNLIT so art shows true colors. */}
      <mesh ref={meshRef} userData={{ unitId: u.id, side }}
        onPointerDown={(e) => { e.stopPropagation(); onPick(u, side); }}
        onPointerOver={(e) => { e.stopPropagation(); onOver(u.id); }}
        onPointerOut={() => onOver(null)}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        {tex
          ? <meshBasicMaterial key="img" map={tex} color={new THREE.Color(dim, dim, dim)} toneMapped={false} />
          : <meshBasicMaterial key="col" color={art.color || '#8a6d3f'} toneMapped={false} />}
      </mesh>
      {/* LIVE HP bar over the baked stat plate */}
      <group position={[0, hpY, 0.02]}>
        <mesh><planeGeometry args={[hpW, 0.16]} /><meshBasicMaterial color="#0a0605" /></mesh>
        <mesh position={[-(hpW / 2) * (1 - hpFrac), 0, 0.002]} scale={[Math.max(0.0001, hpFrac), 1, 1]}>
          <planeGeometry args={[hpW, 0.12]} />
          <meshBasicMaterial color={hpFrac <= 0.33 ? '#e6603a' : '#3fa860'} />
        </mesh>
        <Label text={`${u.hp}/${u.maxHp}`} position={[0, 0, 0.004]} width={0.85} color="#ffffff" px={38} />
      </group>
      {/* block pip */}
      {u.block > 0 && <Label text={`+${u.block}`} position={[CARD_W / 2 - 0.22, hpY + 0.26, 0.05]} width={0.5} color="#bcd4ff" px={40} />}
      {/* DEFEATED: the card stays on the field but is greyed with a red wash + skull mark */}
      {u.dead && (
        <group>
          <mesh position={[0, 0, 0.06]}><planeGeometry args={[CARD_W, CARD_H]} /><meshBasicMaterial color="#1a0606" transparent opacity={0.62} depthWrite={false} /></mesh>
          <Label text="☠" position={[0, 0.1, 0.08]} width={0.9} color="#ff6a5a" px={150} />
          <Label text="DEFEATED" position={[0, -0.35, 0.08]} width={1.0} color="#ff8a7a" px={44} />
        </group>
      )}
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Click-drag ORBIT + WASD PAN state the user controls (rides on top of the auto
 *  camera). Drag the table to rotate, wheel to zoom, WASD to pan (CAMERA-RELATIVE —
 *  the actual panning uses the live camera basis in CameraRig). Returns a STABLE
 *  object so effects that depend on it don't re-fire every render. */
function useOrbit() {
  const az = useRef(0), azT = useRef(0);       // yaw around the table (live + eased target)
  const pol = useRef(0.64), polT = useRef(0.64);   // tilt from vertical (small = top-down)
  const zoom = useRef(1), zoomT = useRef(1);   // zoom multiplier (bigger = further out)
  const pan = useRef({ x: 0, z: 0 });   // WASD offset applied to the look-at (world)
  const keys = useRef({});
  const drag = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      const d = drag.current; if (!d) return;
      az.current = azT.current = d.az - (e.clientX - d.x) * 0.006;                                   // drag is instant
      pol.current = polT.current = Math.max(0.12, Math.min(1.2, d.pol - (e.clientY - d.y) * 0.005));
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
    };
    const onUp = () => { const d = drag.current; drag.current = null; if (d && !d.moved && d.onTap) d.onTap(); };
    const onWheel = (e) => { zoomT.current = Math.max(0.72, Math.min(1.8, zoomT.current + Math.sign(e.deltaY) * 0.08)); };
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
  // selection reframing: ease the angle + zoom toward a nicer framing (drag still overrides)
  const frameTo = ({ az: a, pol: p, zoom: z }) => { if (a != null) azT.current = a; if (p != null) polT.current = p; if (z != null) zoomT.current = z; };
  return useMemo(() => ({ az, pol, zoom, azT, polT, zoomT, pan, keys, start, frameTo }), []);
}

/** Navigable camera: eases the LOOK-AT toward an overview, or a FOCUS point {x,z}
 *  (a squad, or the acting creature during resolution). The user's orbit angle + zoom
 *  are applied on top, so click-drag navigation and auto-movement coexist. */
function CameraRig({ view, orbit, stage }) {
  const { camera, size } = useThree();
  const tgt = useRef(new THREE.Vector3(0, 0.2, -0.4));
  const dist = useRef(11);
  const fwd = useRef(new THREE.Vector3());
  useFrame((_, delta) => {
    // ease the orbit ANGLE + ZOOM toward their targets (selection reframes; drag snaps).
    const e = Math.min(1, delta * 6);
    orbit.az.current += (orbit.azT.current - orbit.az.current) * e;
    orbit.pol.current += (orbit.polT.current - orbit.pol.current) * e;
    orbit.zoom.current += (orbit.zoomT.current - orbit.zoom.current) * e;
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
      p.x += (fwd.current.x * f + rx * rt) * sp;
      p.z += (fwd.current.z * f + rz * rt) * sp;
    }
    const aspect = size.width / Math.max(1, size.height);
    const fov = aspect < 1 ? 60 : 46;   // CONSTANT per aspect so the hand shelf never resizes
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // the look-at = level focus + WASD roam, CLAMPED to ABSOLUTE stage bounds (not relative
    // to the selection), then the pan is written back so it can't accumulate past the wall.
    const p = orbit.pan.current;
    const tx = clamp(view.x + p.x, stage.xMin, stage.xMax);
    const tz = clamp(view.z + p.z, stage.zMin, stage.zMax);
    p.x = tx - view.x; p.z = tz - view.z;
    const dt = new THREE.Vector3(tx, view.y ?? 0.3, tz);
    const dd = view.dist * (aspect < 1 ? 1.2 : 1) * orbit.zoom.current;
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
const FX_TRAVEL = 0.36;   // projectile flight time (s)
function FxItem({ it, meshes }) {
  const { camera } = useThree();
  const grp = useRef();      // number billboard
  const proj = useRef();     // projectile / burst
  const t = useRef(0);
  const pos = useRef(null);  // target world pos
  const src = useRef(null);  // actor world pos
  const tmp = useRef(new THREE.Vector3());
  const tex = useLabelTexture(it.text, { color: it.color, px: 72, weight: 900 });
  const travel = it.from ? FX_TRAVEL : 0;
  useFrame((_, dt) => {
    if (!pos.current) {
      const m = meshes.current.get(it.unitId); pos.current = m ? m.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.5, 0);
      const mf = it.from && meshes.current.get(it.from); src.current = mf ? mf.getWorldPosition(new THREE.Vector3()) : pos.current.clone();
    }
    t.current += dt;
    // 1) projectile flies actor → target, then a small impact flare at the target
    if (proj.current) {
      if (t.current < travel) {
        const k = t.current / travel;
        proj.current.visible = true;
        proj.current.position.lerpVectors(src.current, pos.current, k);
        proj.current.position.y += Math.sin(k * Math.PI) * 0.5 + 0.35;
        proj.current.scale.setScalar(1);
      } else {
        const b = Math.min(1, (t.current - travel) / 0.28);
        proj.current.visible = b < 1;
        proj.current.position.copy(pos.current); proj.current.position.y += 0.35;
        proj.current.scale.setScalar(1 + b * 3.2);
        proj.current.material.opacity = 0.9 * (1 - b);
      }
    }
    // 2) the number rises + fades AFTER the projectile lands
    const nt = Math.max(0, t.current - travel);
    const g = grp.current; if (g) {
      g.visible = t.current >= travel;
      tmp.current.set(pos.current.x, pos.current.y + 0.4 + nt * 1.3, pos.current.z);
      g.position.copy(tmp.current);
      g.quaternion.copy(camera.quaternion);
      const s = 1 + Math.min(0.35, nt * 1.2); g.scale.setScalar(s);
      if (g.children[0]) g.children[0].material.opacity = Math.max(0, 1 - nt / 1.15);
    }
  });
  return (
    <group>
      {it.from && (
        <mesh ref={proj} visible={false} renderOrder={80}>
          <sphereGeometry args={[0.16, 14, 14]} />
          <meshBasicMaterial color={it.color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <group ref={grp} visible={!it.from}>
        <mesh renderOrder={82}><planeGeometry args={[1.1, 0.44]} /><meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}
function FxLayer({ items, meshes }) {
  return (items || []).map((it) => <FxItem key={it.key} it={it} meshes={meshes} />);
}

// A rounded polygon → THREE.Shape (each corner filleted by radius r). Used for the squad
// selection ZONE (a padded, rounded TRAPEZOID hugging the slots — never a sharp rectangle)
// and rounded highlight tints, so no selection aura has sharp right angles.
function roundedPolyShape(pts, r) {
  const shape = new THREE.Shape();
  const n = pts.length;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const len = (a) => Math.hypot(a.x, a.y) || 1;
  for (let i = 0; i < n; i++) {
    const cur = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    const v1 = sub(prev, cur), v2 = sub(next, cur);
    const r1 = Math.min(r, len(v1) / 2), r2 = Math.min(r, len(v2) / 2);
    const p1 = { x: cur.x + (v1.x / len(v1)) * r1, y: cur.y + (v1.y / len(v1)) * r1 };
    const p2 = { x: cur.x + (v2.x / len(v2)) * r2, y: cur.y + (v2.y / len(v2)) * r2 };
    if (i === 0) shape.moveTo(p1.x, p1.y); else shape.lineTo(p1.x, p1.y);
    shape.quadraticCurveTo(cur.x, cur.y, p2.x, p2.y);
  }
  shape.closePath();
  return shape;
}
// the squad ZONE shape (local XY, rotated flat later): a rounded trapezoid — NARROW across
// the front Vanguard row, WIDE across the back Support row — so the field between the front
// vanguards stays clickable (you're not stuck selecting a squad everywhere).
function squadZoneShape(side) {
  const cz = (LAYOUT.frontZ[side] + LAYOUT.backZ[side]) / 2;
  const narrowY = cz - LAYOUT.frontZ[side];   // local +y = world -z; front row
  const wideY = cz - LAYOUT.backZ[side];
  const pad = SLOT_H / 2 + 0.12;
  const nY = narrowY + Math.sign(narrowY) * pad, wY = wideY + Math.sign(wideY) * pad;
  const nH = SLOT_W / 2 + 0.28, wH = SUPP_DX + SLOT_W / 2 + 0.28;
  return roundedPolyShape([{ x: -nH, y: nY }, { x: nH, y: nY }, { x: wH, y: wY }, { x: -wH, y: wY }], 0.4);
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
const SLOT_W = CARD_W + 0.34, SLOT_H = CARD_H + 0.34;
function squadSlots(side, i, n) {
  const cx = squadX(i, n);
  return {
    front: { x: cx, z: LAYOUT.frontZ[side] },
    supp0: { x: cx - SUPP_DX, z: LAYOUT.backZ[side] },
    supp1: { x: cx + SUPP_DX, z: LAYOUT.backZ[side] },
    cx,
  };
}
// where a squad's units actually sit (front on the Vanguard slot, supports behind) —
// shared by the renderer AND the camera so unit-level focus lines up with the card.
function squadPlacements(sq, side, i, n) {
  const s = squadSlots(side, i, n);
  const front = sq.units.find((u) => u.isFront);
  const supp = sq.units.filter((u) => !u.isFront);
  const out = [];
  if (front) out.push({ u: front, ...s.front });
  if (supp[0]) out.push({ u: supp[0], ...s.supp0 });
  if (supp[1]) out.push({ u: supp[1], ...s.supp1 });
  return out;
}
// centre z of a whole side (used by the SIDE-level camera framing)
const SIDE_Z = { e: (LAYOUT.frontZ.e + LAYOUT.backZ.e) / 2, p: (LAYOUT.frontZ.p + LAYOUT.backZ.p) / 2 };
// a squad is highlighted when its side / itself / one of its units is the selection
function squadIsOn(sel, side, sqId) {
  return (sel.level === 'side' && sel.side === side)
    || ((sel.level === 'squad' || sel.level === 'unit') && sel.squadId === sqId);
}
// A soft ROUND radial glow (white → transparent) — tinted per material. Rounded, not
// rectangular, and its alpha fades to ~0 before it reaches the role labels in the gap.
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}
function useSlotBorder(color) {   // dashed rounded border only — role labels are SEPARATE planes outside the slot
  return useMemo(() => bakeCanvas(248, 320, (ctx) => {
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.setLineDash([16, 11]);
    roundRect(ctx, 9, 9, 230, 302, 24); ctx.stroke();
  }), [color]);
}
function useTextTexture(text, color, px = 44) {
  return useMemo(() => bakeCanvas(512, 128, (ctx) => {
    ctx.font = `bold ${px}px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.strokeText(text, 256, 64);
    ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  }), [text, color, px]);
}
/** A flat text plane laid on the table (role / squad labels). */
function GroundLabel({ text, x, z, w, color, px, opacity = 1 }) {
  const tex = useTextTexture(text, color, px);
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, w * (128 / 512)]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} depthTest={false} opacity={opacity} toneMapped={false} />
    </mesh>
  );
}
function SquadPlaymat({ side, squads, sq, i, on }) {
  const col = side === 'e' ? '#d68f74' : '#e6c079';
  const border = useSlotBorder(col);
  const s = squadSlots(side, i, squads.length);
  // ONLY render slots that hold a creature (no empty slots / labels)
  const front = sq.units.find((u) => u.isFront);
  const supp = sq.units.filter((u) => !u.isFront);
  const dir = side === 'e' ? -1 : 1;                 // front → back direction along z
  const lblCol = on ? '#ffffff' : col;
  const vanZ = LAYOUT.frontZ[side] + dir * 1.12;
  const supZ = LAYOUT.backZ[side] - dir * 1.12;
  const squadZ = side === 'e' ? LAYOUT.backZ[side] - 1.25 : LAYOUT.frontZ[side] - 1.3;
  const occupied = [];
  if (front) occupied.push({ ...s.front, role: 'Vanguard', z0: vanZ });
  if (supp[0]) occupied.push({ ...s.supp0, role: 'Support', z0: supZ });
  if (supp[1]) occupied.push({ ...s.supp1, role: 'Support', z0: supZ });
  return (
    <group>
      {occupied.map((sl, j) => (
        <group key={j}>
          <mesh position={[sl.x, 0.004, sl.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SLOT_W, SLOT_H]} /><meshBasicMaterial color={on ? '#2a1c11' : '#20160d'} />
          </mesh>
          <mesh position={[sl.x, 0.016, sl.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SLOT_W, SLOT_H]} /><meshBasicMaterial map={border} transparent depthWrite={false} opacity={on ? 1 : 0.5} />
          </mesh>
          <GroundLabel text={sl.role} x={sl.x} z={sl.z0} w={sl.role === 'Vanguard' ? 1.9 : 1.6} color={lblCol} px={sl.role === 'Vanguard' ? 46 : 42} opacity={on ? 1 : 0.72} />
        </group>
      ))}
      <GroundLabel text={`${side === 'e' ? 'Enemy' : 'Ally'} Squad ${i + 1}`} x={s.cx} z={squadZ} w={2.5} color={on ? '#ffdf8a' : col} px={48} opacity={on ? 1 : 0.75} />
    </group>
  );
}
function Playmat({ enemy, player, sel }) {
  return (
    <group>
      {enemy.map((sq, i) => <SquadPlaymat key={sq.id} side="e" squads={enemy} sq={sq} i={i} on={squadIsOn(sel, 'e', sq.id)} />)}
      {player.map((sq, i) => <SquadPlaymat key={sq.id} side="p" squads={player} sq={sq} i={i} on={squadIsOn(sel, 'p', sq.id)} />)}
    </group>
  );
}

const fieldExtent = (side, n) => {
  const halfX = squadX(n - 1, n) + SUPP_DX + SLOT_W * 0.6;
  const z0 = LAYOUT.frontZ[side], z1 = LAYOUT.backZ[side];
  return { halfX, cz: (z0 + z1) / 2, dz: Math.abs(z1 - z0) + SLOT_H + 0.9 };
};
/** Invisible ground ZONES you click to DIRECTLY select a whole field or a squad (no
 *  drill-down). A subtle tint shows the selected field; a brighter CYAN tint shows the
 *  hovered sub-section (a squad within the selected field, or a hovered field). Creatures
 *  sit above these planes so a creature click/hover wins (nearest-first + stopPropagation). */
const _sqGeo = {};
function squadZoneGeo(side) { if (!_sqGeo[side]) _sqGeo[side] = new THREE.ShapeGeometry(squadZoneShape(side)); return _sqGeo[side]; }
const _fieldGeo = {};
function fieldTintGeo(side, n) {
  const k = `${side}${n}`;
  if (!_fieldGeo[k]) { const fe = fieldExtent(side, n); const hx = fe.halfX, hz = fe.dz / 2;
    _fieldGeo[k] = new THREE.ShapeGeometry(roundedPolyShape([{ x: -hx, y: -hz }, { x: hx, y: -hz }, { x: hx, y: hz }, { x: -hx, y: hz }], 0.9)); }
  return _fieldGeo[k];
}
function Zones({ enemy, player, effSel, hover, onZone, onHover }) {
  return [['e', enemy], ['p', player]].map(([side, squads]) => {
    const n = squads.length; const fe = fieldExtent(side, n);
    const cz = (LAYOUT.frontZ[side] + LAYOUT.backZ[side]) / 2;
    const fieldSel = effSel.level === 'side' && effSel.side === side;
    const fieldHov = hover?.level === 'side' && hover.side === side;
    return (
      <group key={side}>
        {/* big invisible field CLICK plane (fills the gaps the squad zones don't cover) */}
        <mesh position={[0, 0.005, fe.cz]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => { e.stopPropagation(); onZone({ level: 'side', side }); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover({ level: 'side', side }); }}
          onPointerOut={() => onHover(null)}>
          <planeGeometry args={[fe.halfX * 2, fe.dz]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* ROUNDED field tint (selected / hovered) — no sharp corners */}
        {(fieldSel || fieldHov) && (
          <mesh position={[0, 0.007, fe.cz]} rotation={[-Math.PI / 2, 0, 0]} geometry={fieldTintGeo(side, n)}>
            <meshBasicMaterial color={fieldHov ? '#7fe3ff' : '#f0c84a'} transparent opacity={fieldHov ? 0.09 : 0.05} depthWrite={false} />
          </mesh>
        )}
        {/* squad zones: rounded TRAPEZOIDS hugging the slots (padded, non-rectangular) */}
        {squads.map((sq, i) => {
          const cx = squadX(i, n);
          const sqHov = hover?.level === 'squad' && hover.squadId === sq.id;
          return (
            <mesh key={sq.id} position={[cx, 0.009, cz]} rotation={[-Math.PI / 2, 0, 0]} geometry={squadZoneGeo(side)}
              onPointerDown={(e) => { e.stopPropagation(); onZone({ level: 'squad', side, squadId: sq.id }); }}
              onPointerOver={(e) => { e.stopPropagation(); onHover({ level: 'squad', side, squadId: sq.id }); }}
              onPointerOut={() => onHover(null)}>
              <meshBasicMaterial color="#7fe3ff" transparent opacity={sqHov ? 0.13 : 0} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    );
  });
}

/** Squads laid out on the table on their FIXED slots; a ground AURA (below the slot
 *  labels) highlights the selected squad / hovered creature. */
function Side({ squads, side, effSel, hover, actingId, onPick, onOver, registerMesh }) {
  const hoverUnit = hover?.level === 'unit' ? hover.unitId : null;
  return squads.map((sq, i) => {
    const placed = squadPlacements(sq, side, i, squads.length);
    const on = squadIsOn(effSel, side, sq.id);
    return (
      <group key={sq.id}>
        {placed.map(({ u, x, z }) => {
          const unitSel = effSel.level === 'unit' && effSel.unitId === u.id;
          const isHov = hoverUnit === u.id;
          // SELECTED = gold; a hovered sub-section = distinct CYAN (drawn even over a
          // gold-selected squad so the hovered creature stands out).
          const gold = unitSel ? '#ffd873' : (on ? '#f0c84a' : null);
          const strength = unitSel ? 0.85 : 0.55;
          return (
            <group key={u.id}>
              {gold && (
                <mesh position={[x, 0.010, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[SLOT_W + (unitSel ? 1.1 : 0.9), SLOT_H + (unitSel ? 1.1 : 0.9)]} />
                  <meshBasicMaterial map={glowTexture()} color={gold} transparent opacity={strength} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
              )}
              {isHov && (   // hovered creature — cyan, distinct from the gold selection
                <mesh position={[x, 0.011, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[SLOT_W + 0.7, SLOT_H + 0.7]} />
                  <meshBasicMaterial map={glowTexture()} color="#7fe3ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
              )}
              <Card3D u={u} side={side} x={x} z={z}
                selected={on || unitSel} acting={actingId === u.id} hovered={isHov}
                onPick={onPick} onOver={onOver} registerMesh={registerMesh} />
            </group>
          );
        })}
      </group>
    );
  });
}

/** Queued PLAYS shown on their targets: a fanned row of small element-tinted chips (one
 *  per card played, with its cost) laid just beyond each targeted creature's card, so you
 *  can see at a glance what has been committed and on whom. */
function PlayedMarkers({ plays, unitPos }) {
  const byTarget = new Map();
  (plays || []).forEach((pl) => { const a = byTarget.get(pl.targetId) || []; a.push(pl); byTarget.set(pl.targetId, a); });
  const out = [];
  byTarget.forEach((cards, tid) => {
    const pos = unitPos.get(tid); if (!pos) return;
    out.push(
      <group key={tid} position={[pos.x, 0.06, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
        {cards.map((c, i) => {
          const off = i - (cards.length - 1) / 2;
          return (
            <group key={i} position={[off * 0.4, -(CARD_H * 0.5 + 0.32), 0.02]}>
              <mesh renderOrder={5}><planeGeometry args={[0.5, 0.36]} /><meshBasicMaterial color="#0c0805" transparent opacity={0.9} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
              <mesh position={[0, 0, 0.001]} renderOrder={6}><planeGeometry args={[0.5, 0.11]} /><meshBasicMaterial color={elColor(c.element)} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
              <mesh position={[0, 0, 0.0005]} renderOrder={6}><planeGeometry args={[0.5, 0.36]} /><meshBasicMaterial color={elColor(c.element)} transparent opacity={0.18} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
              <Label text={`${c.cost}`} position={[0, -0.05, 0.004]} width={0.28} color="#ffffff" px={40} />
            </group>
          );
        })}
      </group>,
    );
  });
  return out;
}

/** The lifted 3D Action Card during a hand drag: a real world-space card mesh that
 *  follows the pointer THROUGH the scene (unprojected onto a plane above the table),
 *  faces the camera, and draws over everything. Green-tinted while over a valid target. */
function DragCard3D({ card, sx, sy, over }) {
  const { camera, gl } = useThree();
  const grp = useRef();
  const tex = useActionCardTexture(card);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.15));   // hover height above the table
  const ray = useRef(new THREE.Raycaster());
  const v = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());
  const started = useRef(false);
  useFrame(() => {
    const g = grp.current; if (!g) return;
    const rect = gl.domElement.getBoundingClientRect();
    v.current.set(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    ray.current.setFromCamera(v.current, camera);
    if (ray.current.ray.intersectPlane(plane.current, hit.current)) {
      if (!started.current) { g.position.copy(hit.current); started.current = true; }
      else g.position.lerp(hit.current, 0.4);
    }
    g.quaternion.copy(camera.quaternion);   // billboard toward the camera
  });
  const tint = over ? new THREE.Color(0.6, 1, 0.72) : new THREE.Color(1, 1, 1);
  return (
    <group ref={grp} renderOrder={60}>
      <mesh position={[0, 0, -0.01]} renderOrder={59}>
        <planeGeometry args={[HAND_CARD_W * 1.62, HAND_CARD_H * 1.62]} />
        <meshBasicMaterial color={over ? '#7CFF9B' : '#f0c84a'} transparent opacity={0.9} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh renderOrder={60}>
        <planeGeometry args={[HAND_CARD_W * 1.5, HAND_CARD_H * 1.5]} />
        {tex
          ? <meshBasicMaterial map={tex} color={tint} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          : <meshBasicMaterial color="#c9a66b" depthTest={false} depthWrite={false} toneMapped={false} />}
      </mesh>
    </group>
  );
}

// per-LEVEL camera framing (position derived from selection; distance + tilt per level).
// az stays 0 at every level — the angle differences come from tilt (pol) + distance +
// where the camera is looking, never a yaw (that yaw was the "leans right" bug).
const FIELD_POL = 0.66, SIDE_POL = 0.62, SQUAD_POL = 0.58, UNIT_POL = 0.7;
function viewFor(sel, maps, actingId, handV) {
  // when the hand is visible, a focused squad/creature is pushed a little further + toward
  // the camera so it sits ABOVE the hand shelf (the group's bottom clears the top card).
  const hz = handV ? 2.6 : 0, hd = handV ? 1.4 : 0;
  if (actingId) { const p = maps.unitPos.get(actingId); if (p) return { x: p.x, y: 0.3, z: p.z, dist: 5.4, pol: 0.62 }; }
  if (sel.level === 'unit') { const p = maps.unitPos.get(sel.unitId); if (p) return { x: p.x, y: 0.55, z: p.z + 0.35 + hz, dist: 3.9 + hd, pol: UNIT_POL }; }
  if (sel.level === 'squad') { const c = maps.squadCenterById.get(sel.squadId); if (c) return { x: c.x, y: 0.3, z: c.z + hz, dist: 7.2 + hd, pol: SQUAD_POL }; }
  if (sel.level === 'side' && sel.side) return { x: 0, y: 0.3, z: SIDE_Z[sel.side], dist: 10.4, pol: SIDE_POL };
  return { x: 0, y: 0.2, z: -0.2, dist: 12.4, pol: FIELD_POL };   // whole field
}

export default function Board3D({ enemy, player, sel, actingId, onPick, onZone, onStepUp, pickRef, hand, fx, drag, plays, handVisible }) {
  const [hover, setHover] = useState(null);   // { level, side, squadId?, unitId? } under the pointer
  const orbit = useOrbit();
  const meshes = useRef(new Map());
  const registerMesh = (id, m) => { if (m) meshes.current.set(id, m); else meshes.current.delete(id); };

  // squadId → centre/side, unitId → its card position + owning squad/side
  const maps = useMemo(() => {
    const sc = new Map(); const ss = new Map(); const up = new Map(); const um = new Map();
    [[enemy, 'e'], [player, 'p']].forEach(([arr, side]) =>
      arr.forEach((sq, i) => {
        sc.set(sq.id, squadCenter(side, i, arr.length)); ss.set(sq.id, side);
        squadPlacements(sq, side, i, arr.length).forEach(({ u, x, z }) => { up.set(u.id, { x, z }); um.set(u.id, { side, squadId: sq.id }); });
      }));
    return { squadCenterById: sc, squadSideById: ss, unitPos: up, unitMeta: um };
  }, [enemy, player]);
  const onOverUnit = (id) => setHover(id ? { level: 'unit', ...maps.unitMeta.get(id), unitId: id } : null);

  // ABSOLUTE stage bounds (derived from the board, NOT the current selection) — the
  // camera look-at is clamped to these so panning can never leave the combat stage.
  const stage = useMemo(() => {
    const maxN = Math.max(enemy.length, player.length, 1);
    const halfX = squadX(maxN - 1, maxN) + SUPP_DX + SLOT_W * 0.4;
    return { xMin: -halfX, xMax: halfX, zMin: LAYOUT.backZ.e - 1.6, zMax: LAYOUT.backZ.p + 1.6 };
  }, [enemy.length, player.length]);

  // During a card DRAG the camera focuses ONLY the relative field (or the whole
  // battleground for a field/battleground-scoped card) — it does NOT zoom to squads or
  // creatures. The HIGHLIGHT (gold) follows the card's scope level under the pointer
  // (drag.hi), and the drop resolves from that (BattleScreen.resolveDropTarget).
  const dragging = !!drag?.card;
  // camera during drag = the whole relative FIELD (or whole board for a battleground card);
  // it does NOT zoom to squads/creatures. The gold highlight follows the scope (drag.hi).
  const camSel = dragging
    ? (drag.scopeLevel === 'board' ? { level: 'field' } : { level: 'side', side: drag.wantSide || 'e' })
    : sel;
  const effSel = dragging ? (drag.hi || { level: 'side', side: drag.wantSide || 'e' }) : sel;
  const view = viewFor(camSel, maps, actingId, handVisible && !dragging);
  // on camera-selection change: recentre WASD roam + reframe (tilt + zoom reset). az → 0.
  const selKey = `${camSel.level}:${camSel.side || ''}:${camSel.squadId || ''}:${camSel.unitId || ''}`;
  useEffect(() => {
    orbit.pan.current.x = 0; orbit.pan.current.z = 0;
    orbit.frameTo({ az: 0, pol: view.pol, zoom: 1 });
  }, [selKey, orbit, view.pol]);

  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 8, 7], fov: 46, near: 0.1, far: 120 }}
      onPointerMissed={() => setHover(null)}>{/* table tap (onStepUp) handles stepping up */}
      <color attach="background" args={['#0c0805']} />
      <fog attach="fog" args={['#0c0805', 18, 52]} />
      <CameraRig view={view} orbit={orbit} stage={stage} />
      <Picker pickRef={pickRef} meshes={meshes} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[4, 9, 7]} intensity={1.1} />
      <directionalLight position={[-5, 4, 2]} intensity={0.35} color="#8fb4ff" />
      <Table onOrbitStart={(ne) => orbit.start(ne, onStepUp)} />
      <Playmat enemy={enemy} player={player} sel={effSel} />
      <Zones enemy={enemy} player={player} effSel={effSel} hover={hover} onZone={onZone} onHover={setHover} />
      <Side squads={enemy} side="e" effSel={effSel} hover={hover} actingId={actingId} onPick={onPick} onOver={onOverUnit} registerMesh={registerMesh} />
      <Side squads={player} side="p" effSel={effSel} hover={hover} actingId={actingId} onPick={onPick} onOver={onOverUnit} registerMesh={registerMesh} />
      {!dragging && <PlayedMarkers plays={plays} unitPos={maps.unitPos} />}
      {hand && <HandDock3D {...hand} draggingIid={drag?.iid || null} />}
      {drag?.card && <DragCard3D card={drag.card} sx={drag.x} sy={drag.y} over={!!drag.over} />}
      <FxLayer items={fx} meshes={meshes} />
    </Canvas>
  );
}
