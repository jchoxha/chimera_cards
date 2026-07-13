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
import HandDock3D, { useActionCardTexture, HAND_CARD_W, HAND_CARD_H, RO_OVERLAY } from './HandDock3D.jsx';
import SceneEnv, { SCENES, WorldTerrain, shadowTexture } from './SceneEnv.jsx';
import { creatureColor } from '../../data/axisIcons.js';
import { creatureArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';
import { drawCreatureFace, makeFaceTexture, cardBackTexture } from './cardArt3d.js';

const CARD_W = 1.12, CARD_H = 1.54;

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

  const blk = Math.max(0, u.block || 0);
  const dim = u.dead ? 0.4 : 1;
  const hpW = CARD_W - 0.26;          // HP bar width (over the reserved plate baked in the face)
  const hpY = -CARD_H / 2 + 0.18;     // sits on the bottom stat plate
  // green HP fills by hp/maxHp (leaves room for missing health); the BLOCK is a fixed-width
  // blue segment (icon + number, NOT to scale) placed just to the RIGHT of the green.
  const hpFrac = Math.max(0, Math.min(1, u.hp / u.maxHp));
  const greenW = hpFrac * hpW;
  const BLK_W = 0.42;
  const blkX = -hpW / 2 + Math.min(greenW, hpW - BLK_W) + BLK_W / 2;

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
        onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onPick(u, side); }}
        onPointerOver={(e) => { e.stopPropagation(); onOver(u.id); }}
        onPointerOut={() => onOver(null)}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        {tex
          ? <meshBasicMaterial key="img" map={tex} color={new THREE.Color(dim, dim, dim)} toneMapped={false} />
          : <meshBasicMaterial key="col" color={art.color || '#8a6d3f'} toneMapped={false} />}
      </mesh>
      {/* LIVE HP bar: green health (leaves room for missing HP) + a fixed-width BLUE block
          segment just to its right, showing a shield icon + the block amount. */}
      <group position={[0, hpY, 0.02]}>
        <mesh><planeGeometry args={[hpW, 0.16]} /><meshBasicMaterial color="#0a0605" /></mesh>
        <mesh position={[-hpW / 2 + greenW / 2, 0, 0.002]}>
          <planeGeometry args={[Math.max(0.001, greenW), 0.12]} />
          <meshBasicMaterial color={hpFrac <= 0.33 ? '#e6603a' : '#3fa860'} />
        </mesh>
        <Label text={`${u.hp}/${u.maxHp}`} position={[-hpW / 2 + 0.27, 0, 0.006]} width={0.52} color="#ffffff" px={34} />
        {blk > 0 && (
          <group position={[blkX, 0, 0.004]}>
            <mesh><planeGeometry args={[BLK_W, 0.14]} /><meshBasicMaterial color="#3f7fbf" /></mesh>
            <Label text={`🛡${blk}`} position={[0, 0, 0.003]} width={BLK_W + 0.08} color="#eaf4ff" px={38} />
          </group>
        )}
      </group>
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
  const edge = useRef({ f: 0, r: 0 });  // edge-pan while dragging a card (camera-relative, -1..1)
  const drag = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      const d = drag.current; if (!d) return;
      az.current = azT.current = d.az - (e.clientX - d.x) * 0.006;                                   // drag is instant
      pol.current = polT.current = Math.max(0.12, Math.min(1.2, d.pol - (e.clientY - d.y) * 0.005));
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
    };
    // button-aware release: only end the drag when ITS button is lifted (so a card-drag's
    // left-release doesn't cancel a simultaneous right-button orbit, and vice-versa).
    const onUp = (e) => { const d = drag.current; if (!d) return; if (d.button != null && e && e.button !== d.button) return; drag.current = null; if (!d.moved && d.onTap) d.onTap(); };
    // RIGHT mouse button anywhere on the board starts an orbit — even while a card is being
    // dragged with the left button held — so the player can re-angle the camera mid-drag.
    const onDown = (e) => { if (e.button === 2 && e.target?.tagName === 'CANVAS') drag.current = { x: e.clientX, y: e.clientY, az: az.current, pol: pol.current, moved: false, onTap: null, button: 2 }; };
    // don't zoom the camera when the wheel is scrolling an open DOM modal / popup overlay
    const overModal = (e) => (e.target?.closest?.('.bInspect, .bZoom, .bPlanPop, .bFieldPop, .bRotateGate'));
    const onWheel = (e) => { if (overModal(e)) return; zoomT.current = Math.max(0.5, Math.min(1.8, zoomT.current + Math.sign(e.deltaY) * 0.08)); };
    const isText = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const onKey = (down) => (e) => {
      const k = e.key.toLowerCase();
      if (!'wasd'.includes(k) || isText(e.target)) return;
      keys.current[k] = down; if (down) e.preventDefault();
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);
  // left-drag on the table orbits (+ tap = step-up); right-drag (button 2) orbits with no tap
  const start = (e, onTap) => { drag.current = { x: e.clientX, y: e.clientY, az: az.current, pol: pol.current, moved: false, button: e.button, onTap: e.button === 2 ? null : onTap }; };
  // selection reframing: ease the angle + zoom toward a nicer framing (drag still overrides)
  const frameTo = ({ az: a, pol: p, zoom: z }) => { if (a != null) azT.current = a; if (p != null) polT.current = p; if (z != null) zoomT.current = z; };
  return useMemo(() => ({ az, pol, zoom, azT, polT, zoomT, pan, keys, edge, start, frameTo }), []);
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
    // WASD pan + EDGE-pan (dragging a card to a screen edge), CAMERA-RELATIVE: move along the
    // camera's own ground forward/right. Edge-pan is deliberately slow (× ~0.55).
    const k = orbit.keys.current, eg = orbit.edge.current;
    const f = (k.w ? 1 : 0) - (k.s ? 1 : 0) + (eg.f || 0) * 0.55;
    const rt = (k.d ? 1 : 0) - (k.a ? 1 : 0) + (eg.r || 0) * 0.55;
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
function Picker({ pickRef, validRef, zoneRef, meshes, unitMeta, fieldBoundsOf, squadListOf }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const setRay = (cx, cy) => {
      const rect = gl.domElement.getBoundingClientRect();
      v.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(v, camera);
    };
    if (pickRef) pickRef.current = (cx, cy) => {
      setRay(cx, cy);
      const hits = ray.intersectObjects([...meshes.current.values()], false);
      return hits[0]?.object?.userData?.unitId || null;
    };
    // is (cx,cy) over a VALID drop for wantSide? — over a creature of that side, OR the
    // ground within that side's field bounds. (Used to reject drops in empty space.)
    if (validRef) validRef.current = (cx, cy, wantSide) => {
      setRay(cx, cy);
      const hits = ray.intersectObjects([...meshes.current.values()], false);
      const uid = hits[0]?.object?.userData?.unitId;
      if (uid) return unitMeta.get(uid)?.side === wantSide;
      const pt = new THREE.Vector3();
      if (!ray.ray.intersectPlane(groundPlane, pt)) return false;
      const b = fieldBoundsOf(wantSide);
      return pt.x >= b.xMin && pt.x <= b.xMax && pt.z >= b.zMin && pt.z <= b.zMax;
    };
    // The ZONE under (cx,cy) — mirrors what a CLICK would select, so a drag resolves its target
    // identically: a creature → that unit; else a squad's ground area → that squad; else the
    // field → that side. Lets a card dropped on empty squad/field space target correctly
    // (instead of defaulting to squad 1's vanguard).
    if (zoneRef) zoneRef.current = (cx, cy) => {
      setRay(cx, cy);
      const hits = ray.intersectObjects([...meshes.current.values()], false);
      const uid = hits[0]?.object?.userData?.unitId;
      if (uid) { const m = unitMeta.get(uid); return m ? { level: 'unit', side: m.side, squadId: m.squadId, unitId: uid } : null; }
      const pt = new THREE.Vector3();
      if (!ray.ray.intersectPlane(groundPlane, pt)) return null;
      for (const side of ['e', 'p']) {
        const b = fieldBoundsOf(side);
        if (pt.x < b.xMin || pt.x > b.xMax || pt.z < b.zMin || pt.z > b.zMax) continue;
        // nearest squad by x, if the pointer is within half a squad-spacing of its centre
        let best = null, bd = Infinity;
        for (const s of squadListOf(side)) { const d = Math.abs(s.cx - pt.x); if (d < bd) { bd = d; best = s; } }
        return best && bd <= LAYOUT.spacing / 2 ? { level: 'squad', side, squadId: best.squadId } : { level: 'side', side };
      }
      return null;
    };
    return () => { if (pickRef) pickRef.current = null; if (validRef) validRef.current = null; if (zoneRef) zoneRef.current = null; };
  }, [camera, gl, pickRef, validRef, zoneRef, meshes, unitMeta, fieldBoundsOf, squadListOf]);
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
// convex hull (Andrew's monotone chain) of {x,y} points
function convexHull(points) {
  const p = points.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
// The squad ZONE shape (local XY, rotated flat later): the rounded convex HULL of the
// squad's OCCUPIED slots (+padding). A 1-creature squad is a small rounded rect; a full
// squad is the wide vanguard→supports hull — so the shape reflects its actual members.
function squadZoneShapeFor(side, occ) {
  const cz = (LAYOUT.frontZ[side] + LAYOUT.backZ[side]) / 2;
  const fY = cz - LAYOUT.frontZ[side], bY = cz - LAYOUT.backZ[side];   // local +y = world -z
  const px = SLOT_W / 2 + 0.26, py = SLOT_H / 2 + 0.22;
  const centers = [];
  if (occ.front) centers.push([0, fY]);
  if (occ.supp0) centers.push([-SUPP_DX, bY]);
  if (occ.supp1) centers.push([SUPP_DX, bY]);
  if (!centers.length) centers.push([0, fY]);
  const pts = [];
  centers.forEach(([x, y]) => { pts.push({ x: x - px, y: y - py }, { x: x + px, y: y - py }, { x: x + px, y: y + py }, { x: x - px, y: y + py }); });
  return roundedPolyShape(convexHull(pts), 0.4);
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
// a "worn banner" plate baked once — a dark rounded strip with a gold rim, so scene labels
// read as banners staked in the ground (diegetic forest look) rather than floating text.
let _bannerTex = null;
function bannerTexture() {
  if (_bannerTex) return _bannerTex;
  _bannerTex = bakeCanvas(384, 128, (ctx) => {
    ctx.fillStyle = 'rgba(18,12,7,0.86)'; roundRect(ctx, 10, 28, 364, 72, 30); ctx.fill();
    ctx.strokeStyle = 'rgba(201,166,107,0.55)'; ctx.lineWidth = 5; ctx.stroke();
  });
  return _bannerTex;
}
/** A flat text plane laid on the table (role / squad labels). depthTest is ON so a creature
 *  card standing between the camera and a label OCCLUDES it (labels must not bleed THROUGH
 *  cards); depthWrite stays off so the flat labels don't fight the slot tints beneath them.
 *  `banner` draws a worn-banner plate behind the text (diegetic scenes). */
function GroundLabel({ text, x, z, w, color, px, opacity = 1, banner = false }) {
  const tex = useTextTexture(text, color, px);
  const th = w * (128 / 512);
  return (
    <group>
      {banner && (
        <mesh position={[x, 0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * 1.1, th * 1.7]} />
          <meshBasicMaterial map={bannerTexture()} transparent depthWrite={false} opacity={0.85 * opacity} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[x, 0.021, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, th]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={opacity} toneMapped={false} />
      </mesh>
    </group>
  );
}
function SquadPlaymat({ side, squads, sq, i, on, theme }) {
  const col = side === 'e' ? theme.enemy : theme.ally;
  const banner = !!theme.banner;
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
  const zoneShape = useMemo(() => squadZoneShapeFor(side, { front: !!front, supp0: !!supp[0], supp1: !!supp[1] }), [side, front, supp]);
  const cz = (LAYOUT.frontZ[side] + LAYOUT.backZ[side]) / 2;
  return (
    <group>
      {/* dashed SQUAD outline (matches the creature-slot dashes) */}
      <DashedOutline shape={zoneShape} cx={s.cx} cz={cz} color={col} opacity={on ? 0.75 : 0.32} />
      {occupied.map((sl, j) => (
        <group key={j}>
          <mesh position={[sl.x, 0.004, sl.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SLOT_W, SLOT_H]} /><meshBasicMaterial color={theme.slotFill} transparent opacity={on ? 0.82 : 0.6} depthWrite={false} />
          </mesh>
          <mesh position={[sl.x, 0.016, sl.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SLOT_W, SLOT_H]} /><meshBasicMaterial map={border} transparent depthWrite={false} opacity={on ? 1 : 0.5} />
          </mesh>
          <GroundLabel text={sl.role} x={sl.x} z={sl.z0} w={sl.role === 'Vanguard' ? 1.9 : 1.6} color={lblCol} px={sl.role === 'Vanguard' ? 46 : 42} opacity={on ? 1 : 0.72} banner={banner} />
        </group>
      ))}
      <GroundLabel text={`${side === 'e' ? 'Enemy' : 'Ally'} Squad ${i + 1}`} x={s.cx} z={squadZ} w={2.5} color={on ? '#ffdf8a' : col} px={48} opacity={on ? 1 : 0.75} banner={banner} />
    </group>
  );
}
function Playmat({ enemy, player, sel, theme }) {
  const t = theme || SCENES.forest.playmat;
  return (
    <group>
      {[['e', enemy], ['p', player]].map(([side, squads]) => {
        const fe = fieldExtent(side, squads.length);
        const on = sel.level === 'side' && sel.side === side;
        return <DashedOutline key={`f${side}`} shape={fieldShapeOf(side, squads.length)} cx={0} cz={fe.cz} color={side === 'e' ? t.fieldEnemy : t.fieldAlly} opacity={on ? 0.6 : 0.2} />;
      })}
      {enemy.map((sq, i) => <SquadPlaymat key={sq.id} side="e" squads={enemy} sq={sq} i={i} on={squadIsOn(sel, 'e', sq.id)} theme={t} />)}
      {player.map((sq, i) => <SquadPlaymat key={sq.id} side="p" squads={player} sq={sq} i={i} on={squadIsOn(sel, 'p', sq.id)} theme={t} />)}
    </group>
  );
}

// A small flat card STACK lying on the table (deck/discard/exhaust) with a count label.
// depthTest off + a renderOrder above the ground labels/dashes so the on-field cards always
// sit OVER the section labels + outlines (they must never be hidden behind them). Clickable
// (onTap) → the same inspect overlay the hand-overlay piles open. `hot` → white stack.
const RO_FIELDPILE = 12;
function MiniStack({ x, z, count, color, top, label, dir, onTap }) {
  const empty = count <= 0;
  const n = Math.max(1, Math.min(14, count));
  const w = 0.5, h = 0.68;
  const boxCol = empty ? '#20160d' : color;
  return (
    <group position={[x, 0.04, z]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[0, i * 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={RO_FIELDPILE + i}
          onPointerDown={i === n - 1 && !empty && onTap ? (e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onTap(); } : undefined}>
          <boxGeometry args={[w, h, 0.012]} />
          <meshStandardMaterial color={boxCol} roughness={0.7} metalness={0.12} transparent opacity={empty ? 0.4 : 1} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      {top && count > 0 && <mesh position={[0, n * 0.013 + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={RO_FIELDPILE + n + 1}><planeGeometry args={[w, h]} /><meshBasicMaterial map={top} transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>}
      {/* label is LOCAL to this group (already translated to [x,·,z]) — using x/z here would
          double the offset and fling the label to the field's edge. */}
      <GroundLabel text={`${label} (${count})`} x={0} z={dir * 0.62} w={1.2} color={empty ? '#7a6b4f' : '#c9a66b'} px={32} opacity={empty ? 0.6 : 0.9} />
    </group>
  );
}
/** Each squad's DRAW · IN-PLAY · HAND · DISCARDED · BANISHED rendered PHYSICALLY on the field,
 *  directly behind the squad. Shown for every squad EXCEPT the one whose cards are currently
 *  lifted into the hand overlay (skipId). Enemy squads have NO In Play pile. Every pile/hand
 *  is clickable → the same inspect overlay the hand-overlay piles open (onInspect). */
function FieldPiles({ enemy, player, skipId, onInspect, onSelectSquad }) {
  const back = cardBackTexture();
  return [['e', enemy], ['p', player]].map(([side, squads]) => {
    const n = squads.length;
    const dir = side === 'p' ? 1 : -1;                 // "behind" = away from the field centre
    const bz = LAYOUT.backZ[side] + dir * 2.5;         // well behind the back row (clears the squad label)
    const isP = side === 'p';
    return squads.map((sq, i) => {
      if (sq.id === skipId) return null;
      const cx = squadX(i, n);
      const handN = isP ? (sq.hand?.length || 0) : (sq.handCount || 0);
      // laid out like the hand overlay: Draw pile on the left, HAND in the middle, Discarded ·
      // Banished on the right. (In Play lives ONLY in the hand overlay, not on the battlefield.)
      return (
        <group key={sq.id}>
          <MiniStack x={cx - 1.4} z={bz} count={sq.deckCount || 0} color="#33240f" top={back} label="Draw" dir={dir}
            onTap={() => onInspect?.({ title: 'Draw Pile', cards: sq.deck || [], note: 'Contents known · order hidden' })} />
          {/* HAND fan in the middle — clicking it OPENS that squad's hand overlay (selects it) */}
          <group onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onSelectSquad?.(side, sq.id); }}>
            {Array.from({ length: Math.min(6, handN) }).map((_, k) => {
              const m = Math.min(6, handN); const off = k - (m - 1) / 2;
              return (
                <mesh key={k} position={[cx + off * 0.16, 0.05 + k * 0.004, bz]} rotation={[-Math.PI / 2, 0, off * 0.14]} renderOrder={RO_FIELDPILE + k}>
                  <planeGeometry args={[0.42, 0.58]} /><meshBasicMaterial map={back} transparent depthTest={false} depthWrite={false} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
          <GroundLabel text={`Hand (${handN})`} x={cx} z={bz + dir * 0.6} w={1.2} color="#c9a66b" px={32} opacity={0.9} />
          <MiniStack x={cx + 1.1} z={bz} count={sq.discardCount || 0} color="#241528" top={sq.discardCount ? back : null} label="Discarded" dir={dir}
            onTap={() => onInspect?.({ title: 'Discarded', cards: sq.discard || [] })} />
          <MiniStack x={cx + 1.7} z={bz} count={sq.exhaustCount || 0} color="#241228" top={sq.exhaustCount ? back : null} label="Banished" dir={dir}
            onTap={() => onInspect?.({ title: 'Banished', cards: sq.exhaust || [] })} />
        </group>
      );
    });
  });
}

// The field must strictly CONTAIN every squad zone (a lower-level border must never poke
// outside a higher-level one). Squad zones pad each slot by (pxSq,pySq) around the hull, so
// the field is that same padding + an extra margin bigger than the rounded-corner pull-in.
const SQ_PX = SLOT_W / 2 + 0.26, SQ_PY = SLOT_H / 2 + 0.22;   // squad-zone slot padding (see squadZoneShapeFor)
const FIELD_MARGIN = 0.55;
const fieldExtent = (side, n) => {
  const halfX = squadX(n - 1, n) + SUPP_DX + SQ_PX + FIELD_MARGIN;   // widest squad hull + margin
  const z0 = LAYOUT.frontZ[side], z1 = LAYOUT.backZ[side];
  const halfZ = Math.abs(z1 - z0) / 2 + SQ_PY + FIELD_MARGIN;        // front/back slot padding + margin
  return { halfX, cz: (z0 + z1) / 2, dz: halfZ * 2 };
};
/** Invisible ground ZONES you click to DIRECTLY select a whole field or a squad (no
 *  drill-down). A subtle tint shows the selected field; a brighter CYAN tint shows the
 *  hovered sub-section (a squad within the selected field, or a hovered field). Creatures
 *  sit above these planes so a creature click/hover wins (nearest-first + stopPropagation). */
const _sqGeo = {};
function occupancyOf(sq) {
  const front = sq.units.some((u) => u.isFront);
  const supp = sq.units.filter((u) => !u.isFront);
  return { front, supp0: !!supp[0], supp1: !!supp[1] };
}
function squadZoneGeo(side, occ) {
  const key = `${side}${occ.front ? 1 : 0}${occ.supp0 ? 1 : 0}${occ.supp1 ? 1 : 0}`;
  if (!_sqGeo[key]) _sqGeo[key] = new THREE.ShapeGeometry(squadZoneShapeFor(side, occ));
  return _sqGeo[key];
}
const _fieldGeo = {};
function fieldTintGeo(side, n) {
  const k = `${side}${n}`;
  if (!_fieldGeo[k]) { const fe = fieldExtent(side, n); const hx = fe.halfX, hz = fe.dz / 2;
    _fieldGeo[k] = new THREE.ShapeGeometry(roundedPolyShape([{ x: -hx, y: -hz }, { x: hx, y: -hz }, { x: hx, y: hz }, { x: -hx, y: hz }], 0.9)); }
  return _fieldGeo[k];
}
/** A dashed outline of a THREE.Shape laid flat on the table (for squad + field borders,
 *  matching the creature-slot dashes). Shape local (x,y) → world (cx+x, y, cz - y). */
function DashedOutline({ shape, cx, cz, color, opacity = 0.5 }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const pts = shape.getPoints(80).map((p) => new THREE.Vector3(p.x, 0, -p.y));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [shape]);
  useEffect(() => { ref.current?.computeLineDistances(); }, [geo]);
  return (
    <lineLoop ref={ref} geometry={geo} position={[cx, 0.02, cz]}>
      <lineDashedMaterial color={color} dashSize={0.16} gapSize={0.12} transparent opacity={opacity} depthWrite={false} />
    </lineLoop>
  );
}
const _fieldShape = {};
function fieldShapeOf(side, n) {
  const k = `${side}${n}`;
  if (!_fieldShape[k]) { const fe = fieldExtent(side, n); const hx = fe.halfX, hz = fe.dz / 2;
    _fieldShape[k] = roundedPolyShape([{ x: -hx, y: -hz }, { x: hx, y: -hz }, { x: hx, y: hz }, { x: -hx, y: hz }], 0.9); }
  return _fieldShape[k];
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
          onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onZone({ level: 'side', side }); }}
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
            <mesh key={sq.id} position={[cx, 0.009, cz]} rotation={[-Math.PI / 2, 0, 0]} geometry={squadZoneGeo(side, occupancyOf(sq))}
              onPointerDown={(e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onZone({ level: 'squad', side, squadId: sq.id }); }}
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

/** Is `u` a valid TARGET for the active card's scope (target highlighting)? */
function isCardTarget(targetHint, side, u) {
  if (!targetHint || side !== targetHint.side) return false;
  const s = targetHint.scope;
  if (s === 'front' || s === 'self') return u.isFront;   // vanguard-only scopes
  return true;                                           // targeted / squad / field → any creature
}
/** Squads laid out on the table on their FIXED slots; a ground AURA (below the slot
 *  labels) highlights the SELECTED squad/creature, a hovered creature, or — when a card is
 *  armed — every valid TARGET for that card (red = offensive, green = friendly). A whole
 *  SIDE selection no longer lights its creatures (only the field outline shows). */
function Side({ squads, side, effSel, hover, actingId, targetHint, onPick, onOver, registerMesh }) {
  const hoverUnit = hover?.level === 'unit' ? hover.unitId : null;
  return squads.map((sq, i) => {
    const placed = squadPlacements(sq, side, i, squads.length);
    // selection-driven creature glow only at SQUAD/UNIT level — never for a whole side/field
    const on = squadIsOn(effSel, side, sq.id) && effSel.level !== 'side';
    return (
      <group key={sq.id}>
        {placed.map(({ u, x, z }) => {
          const unitSel = effSel.level === 'unit' && effSel.unitId === u.id;
          const isHov = hoverUnit === u.id;
          const isTarget = isCardTarget(targetHint, side, u);
          // SELECTED = gold; a hovered sub-section = distinct CYAN (drawn even over a
          // gold-selected squad so the hovered creature stands out).
          const gold = unitSel ? '#ffd873' : (on ? '#f0c84a' : null);
          const strength = unitSel ? 0.85 : 0.55;
          return (
            <group key={u.id}>
              {/* TARGET highlight (card armed) — sits UNDER selection/hover glows */}
              {isTarget && !unitSel && (
                <mesh position={[x, 0.009, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[SLOT_W + 0.8, SLOT_H + 0.8]} />
                  <meshBasicMaterial map={glowTexture()} color={targetHint.offensive ? '#ff6a5a' : '#6ee7a0'} transparent opacity={0.62} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
              )}
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
                selected={on || unitSel} acting={actingId === u.id} hovered={isHov || isTarget}
                onPick={onPick} onOver={onOver} registerMesh={registerMesh} />
            </group>
          );
        })}
      </group>
    );
  });
}

// ── PLAYED / QUEUED action cards on the battlefield, placed by SCOPE ──
const scopeOfCard = (c) => c.scope || (c.reachesBack ? 'targeted' : 'front');
/** Where a queued card is LEFT on the field, by its scope: at the creature (targeted/front/
 *  self), at the squad centre, at the field centre, or at the board centre (battleground). */
function landingAnchor(card, targetId, maps) {
  const scope = scopeOfCard(card);
  if (scope === 'board') return { key: 'board', x: 0, z: 0 };
  const meta = maps.unitMeta.get(targetId);
  if (!meta) return null;
  if (scope === 'field') return { key: `field-${meta.side}`, x: 0, z: SIDE_Z[meta.side] };
  if (scope === 'squad') { const c = maps.squadCenterById.get(meta.squadId); return c ? { key: `sq-${meta.squadId}`, x: c.x, z: c.z } : null; }
  const p = maps.unitPos.get(targetId); if (!p) return null;
  return { key: `u-${targetId}`, x: p.x, z: p.z };
}
// the resting spot sits on ~the creature's OWN plane, nudged toward that side's OUTER edge
// (ally → toward the bottom/viewer, enemy → toward the top) so it peeks out just past the
// creature card, raised a hair in Y so it reads as sitting just above the table.
const CARD3D_BASE_Y = 0.05;
const landingRest = (anc) => { const toward = anc.z >= 0 ? 1 : -1; return { x: anc.x, z: anc.z + toward * 0.62, y: CARD3D_BASE_Y + 0.07 }; };
// a queued card raises WITH its target creature when that creature's squad/unit is selected
// (matches Card3D's +0.16 select lift), so cards stay attached to a lifted creature.
function planLift(anc, effSel, maps) {
  if (!anc.key.startsWith('u-') && !anc.key.startsWith('sq-')) return 0;
  const meta = anc.targetId ? maps.unitMeta.get(anc.targetId) : null;
  const sqSel = (effSel.level === 'squad' || effSel.level === 'unit') && meta && effSel.squadId === meta.squadId;
  return sqSel ? 0.16 : 0;
}
const PL_W = 0.66, PL_H = PL_W * (HAND_CARD_H / HAND_CARD_W);

/** One queued card, face-up, laid FLAT on the field (just above the plane), clickable. */
function PlannedChip({ card, x, y, z, onTap }) {
  const tex = useActionCardTexture(card);
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={RO_FIELDPILE + 6}
      onPointerDown={onTap ? (e) => { if ((e.nativeEvent?.button ?? 0) !== 0) return; e.stopPropagation(); onTap(); } : undefined}>
      <planeGeometry args={[PL_W, PL_H]} />
      {tex
        ? <meshBasicMaterial key="t" map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        : <meshBasicMaterial key="c" color="#2a1d11" transparent depthTest={false} depthWrite={false} toneMapped={false} />}
    </mesh>
  );
}
/** All of the PLAYER's queued cards, laid on the field at their scope anchors (fanned when
 *  several share an anchor). Raise with a selected/lifted target. Clickable → inspect. */
function PlannedCards({ player, maps, effSel, onInspect }) {
  const groups = new Map();
  player.forEach((sq) => (sq.plan || []).forEach((a) => {
    const anc = landingAnchor(a.card, a.targetId, maps); if (!anc) return;
    anc.targetId = a.targetId;
    const g = groups.get(anc.key) || { anc, plays: [] }; g.plays.push(a); groups.set(anc.key, g);
  }));
  const out = [];
  groups.forEach((g, key) => {
    const rest = landingRest(g.anc);
    const lift = planLift(g.anc, effSel, maps);
    const tap = () => onInspect?.({ title: 'Queued here', plays: g.plays });
    g.plays.forEach((a, i) => {
      const off = (i - (g.plays.length - 1) / 2) * 0.3;
      out.push(<PlannedChip key={`${key}-${i}`} card={a.card} x={rest.x + off} y={rest.y + lift + i * 0.012} z={rest.z + i * 0.05} onTap={tap} />);
    });
  });
  return out;
}

/** A card FLYING from where it was played (drag-release point, or the hand for a tap-select)
 *  to its scope landing spot. Drag = a quick flat slide; select = a higher arced toss. */
function FlyingCard({ fly, maps, onDone }) {
  const { camera, gl } = useThree();
  const grp = useRef();
  const tex = useActionCardTexture(fly.card);
  const t = useRef(0);
  const from = useRef(null); const to = useRef(null);
  const DUR = fly.kind === 'select' ? 0.5 : 0.4;
  useFrame((_, dt) => {
    const g = grp.current; if (!g) return;
    if (!from.current) {
      const rect = gl.domElement.getBoundingClientRect();
      const v = new THREE.Vector2(((fly.x - rect.left) / rect.width) * 2 - 1, -((fly.y - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(v, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
      const hit = new THREE.Vector3(); ray.ray.intersectPlane(plane, hit);
      from.current = hit.clone();
      const anc = landingAnchor(fly.card, fly.targetId, maps);
      const rest = anc ? landingRest(anc) : { x: hit.x, z: hit.z, y: 0.5 };
      to.current = new THREE.Vector3(rest.x, rest.y, rest.z);
    }
    t.current += dt;
    const k = Math.min(1, t.current / DUR);
    const e = k * k * (3 - 2 * k);
    g.position.lerpVectors(from.current, to.current, e);
    g.position.y += Math.sin(e * Math.PI) * (fly.kind === 'select' ? 1.5 : 0.6);
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(1 - e * 0.4);
    if (k >= 1) onDone();
  });
  return (
    <group ref={grp} renderOrder={70}>
      <mesh renderOrder={70}>
        <planeGeometry args={[HAND_CARD_W * 1.2, HAND_CARD_H * 1.2]} />
        {tex
          ? <meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          : <meshBasicMaterial color="#c9a66b" depthTest={false} depthWrite={false} toneMapped={false} />}
      </mesh>
    </group>
  );
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
  // green tint on the card itself when over a valid target (no separate border plate)
  const tint = over ? new THREE.Color(0.62, 1, 0.74) : new THREE.Color(1, 1, 1);
  const RO = RO_OVERLAY + 40;   // the lifted drag card floats above even the hand shelf
  return (
    <group ref={grp} renderOrder={RO}>
      <mesh renderOrder={RO}>
        <planeGeometry args={[HAND_CARD_W * 1.5, HAND_CARD_H * 1.5]} />
        {tex
          ? <meshBasicMaterial map={tex} color={tint} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          : <meshBasicMaterial color={over ? '#7CFF9B' : '#c9a66b'} depthTest={false} depthWrite={false} toneMapped={false} />}
      </mesh>
    </group>
  );
}

// per-LEVEL camera framing (position derived from selection; distance + tilt per level).
// az stays 0 at every level — the angle differences come from tilt (pol) + distance +
// where the camera is looking, never a yaw (that yaw was the "leans right" bug).
const FIELD_POL = 0.72, SIDE_POL = 0.62, SQUAD_POL = 0.58, UNIT_POL = 0.7;
function viewFor(sel, maps, focusId, handV) {
  // when the hand is visible, a focused squad/creature is pushed a little further + toward
  // the camera so it sits ABOVE the hand shelf (the group's bottom clears the top card).
  const hz = handV ? 2.6 : 0, hd = handV ? 1.4 : 0;
  if (focusId) { const p = maps.unitPos.get(focusId); if (p) return { x: p.x, y: 0.3, z: p.z, dist: 5.4, pol: 0.62 }; }
  if (sel.level === 'unit') { const p = maps.unitPos.get(sel.unitId); if (p) return { x: p.x, y: 0.55, z: p.z + 0.35 + hz, dist: 3.9 + hd, pol: UNIT_POL }; }
  if (sel.level === 'squad') { const c = maps.squadCenterById.get(sel.squadId); if (c) return { x: c.x, y: 0.3, z: c.z + hz, dist: 7.2 + hd, pol: SQUAD_POL }; }
  if (sel.level === 'side' && sel.side) return { x: 0, y: 0.3, z: SIDE_Z[sel.side] + hz * 0.9, dist: 10.4 + hd, pol: SIDE_POL };
  // whole field: bias toward the FRIENDLY side + pull back so the near (friendly) card
  // piles/hands behind the player squads aren't cut off the bottom of the view.
  return { x: 0, y: 0.2, z: 1.7, dist: 14.2, pol: FIELD_POL };
}

/** EXPLORE avatar: a single camera-facing billboard of the party leader (replaces the whole
 *  squad formation while walking the overworld). Stands at the chunk centre. */
function PartyAvatar({ unit }) {
  const grp = useRef();
  const art = useMemo(() => (unit ? cardArtOf(unit) : null), [unit?.id]);
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!art?.url) { setTex(null); return undefined; }
    let alive = true;
    const t = new THREE.TextureLoader().load(art.url, () => { if (alive) setTex(t); }, undefined, () => { if (alive) setTex(null); });
    t.colorSpace = THREE.SRGBColorSpace;
    return () => { alive = false; };
  }, [art?.url]);
  const wp = useRef(new THREE.Vector3());
  useFrame(({ camera, clock }) => {
    const g = grp.current; if (!g) return;
    g.getWorldPosition(wp.current);
    g.rotation.y = Math.atan2(camera.position.x - wp.current.x, camera.position.z - wp.current.z);
    g.position.y = 2.0 + Math.sin(clock.elapsedTime * 2) * 0.1;
  });
  const W = 2.8, H = 3.8;
  return (
    <group position={[0, 0, 0.4]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}><planeGeometry args={[W * 0.72, W * 0.42]} /><meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}><ringGeometry args={[W * 0.48, W * 0.64, 32]} /><meshBasicMaterial color="#ffe08a" transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>
      <group ref={grp} position={[0, 2.0, 0]}>
        <mesh><planeGeometry args={[W * 0.7, H * 0.9]} /><meshBasicMaterial color="#e8c06a" side={THREE.DoubleSide} toneMapped={false} /></mesh>
        {tex && <mesh position={[0, 0, 0.02]}><planeGeometry args={[W, H]} /><meshBasicMaterial map={tex} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      </group>
    </group>
  );
}

export default function Board3D({ enemy, player, sel, actingId, focusId, targetHint, onPick, onZone, onStepUp, pickRef, validRef, zoneRef, hand, fx, drag, handVisible, handSquadId, cardFocusSide, autoCam = true, scene = 'forest', exploring = false, world = null, worldFacing = 0, worldTurns = 0, onInspect, onSelectSquad, camRef, fly, onFlyDone }) {
  const sc = SCENES[scene] || SCENES.forest;
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
  const fieldBoundsOf = (side) => {
    const n = side === 'e' ? enemy.length : player.length; const fe = fieldExtent(side, n);
    return { xMin: -fe.halfX - 0.6, xMax: fe.halfX + 0.6, zMin: fe.cz - fe.dz / 2 - 0.6, zMax: fe.cz + fe.dz / 2 + 0.6 };
  };
  // per-side squad centres (x) — lets the zone picker map a ground point to a squad.
  const squadListOf = (side) => {
    const arr = side === 'e' ? enemy : player; const n = arr.length;
    return arr.map((sq, i) => ({ squadId: sq.id, cx: squadX(i, n) }));
  };

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
  // AIMING = a lifted card while auto-camera is on → the camera frames the relative field and
  // the scope highlight follows drag.hi. A card still down in the hand (or autoCam off) leaves
  // the camera on the current selection so the hand can be reorganised undisturbed.
  // STICKY: once a drag has lifted (aimed) at least once, the camera stays framed on the target
  // field for the REST of the drag — even if the card dips back into the hand to reorder — and
  // only returns to the selection view on release. (autoCam-on only.)
  const aiming = dragging && !!drag.everLifted && autoCam;
  const camSel = aiming
    ? (drag.scopeLevel === 'board' ? { level: 'field' } : { level: 'side', side: drag.wantSide || 'e' })
    : (cardFocusSide ? { level: 'side', side: cardFocusSide } : sel);   // selecting a card frames the target field
  const effSel = (dragging && drag.everLifted) ? (drag.hi || { level: 'side', side: drag.wantSide || 'e' }) : sel;
  // camera focus during playback follows the FX (actor→target) — but ONLY when autoCam is on.
  const liveView = viewFor(camSel, maps, autoCam ? (focusId ?? actingId) : null, handVisible && !aiming);
  // AUTO-CAMERA OFF → freeze the look-at at wherever it was, so NOTHING (selection, drag
  // release, playback…) moves it automatically; only the manual controls do.
  const frozenView = useRef(liveView);
  if (autoCam) frozenView.current = liveView;
  const view = autoCam ? liveView : frozenView.current;
  // on camera-selection change: recentre WASD roam + reframe (tilt + zoom reset). az → 0.
  // Skipped entirely while autoCam is off (no automatic reframing at all).
  const selKey = `${camSel.level}:${camSel.side || ''}:${camSel.squadId || ''}:${camSel.unitId || ''}`;
  // exploring: the camera AZIMUTH follows the party FACING (turn buttons orbit it); combat
  // resets to the head-on battle framing (az 0).
  // CUMULATIVE turns (not facing % 4) → a CONTINUOUS azimuth, so turning past a wrap keeps
  // rotating the SAME direction instead of snapping the short way back.
  const facingAz = exploring ? -worldTurns * (Math.PI / 2) : 0;
  useEffect(() => {
    if (!autoCam) return;
    orbit.pan.current.x = 0; orbit.pan.current.z = 0;
    orbit.frameTo({ az: exploring ? undefined : 0, pol: view.pol, zoom: 1 });   // az handled below in explore
  }, [selKey, orbit, view.pol, autoCam, exploring]);
  useEffect(() => { orbit.frameTo({ az: facingAz }); }, [facingAz, orbit]);

  // expose imperative camera controls (DOM buttons in BattleScreen) — cross-platform, so
  // touch users get rotate/tilt/zoom/recenter without a keyboard. WASD panning still works.
  const viewPolRef = useRef(view.pol); viewPolRef.current = view.pol;
  useEffect(() => {
    if (!camRef) return undefined;
    camRef.current = {
      yaw: (d) => { orbit.azT.current += d; },
      tilt: (d) => { orbit.polT.current = clamp(orbit.polT.current + d, 0.12, 1.2); },
      zoom: (d) => { orbit.zoomT.current = clamp(orbit.zoomT.current + d, 0.5, 1.8); },
      reset: () => { orbit.pan.current.x = 0; orbit.pan.current.z = 0; orbit.frameTo({ az: 0, pol: viewPolRef.current, zoom: 1 }); },
      // edge-pan while dragging a card (f/r in -1..1); resetDragCam undoes any drag movement
      setEdge: (f, r) => { orbit.edge.current.f = f; orbit.edge.current.r = r; },
      resetDragCam: () => { orbit.edge.current.f = 0; orbit.edge.current.r = 0; orbit.pan.current.x = 0; orbit.pan.current.z = 0; },
    };
    return () => { if (camRef) camRef.current = null; };
  }, [camRef, orbit]);

  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 8, 7], fov: 46, near: 0.1, far: 120 }}
      onPointerMissed={() => setHover(null)}>{/* ground tap (onStepUp) handles stepping up */}
      <color attach="background" args={[sc.bg]} />
      <fog attach="fog" args={[sc.fog[0], sc.fog[1], sc.fog[2]]} />
      <CameraRig view={view} orbit={orbit} stage={stage} />
      <Picker pickRef={pickRef} validRef={validRef} zoneRef={zoneRef} meshes={meshes} unitMeta={maps.unitMeta} fieldBoundsOf={fieldBoundsOf} squadListOf={squadListOf} />
      <SceneEnv scene={scene} stage={stage} bare={!!world && scene !== 'grid'} onOrbitStart={(ne) => orbit.start(ne, onStepUp)} />
      {world && scene !== 'grid' && <WorldTerrain grid={world.grid} pos={world.pos} exploring={exploring} />}
      {/* EXPLORE = a single avatar walking the world (no formation); COMBAT = the full squads. */}
      {exploring ? (
        <PartyAvatar unit={player[0]?.units.find((u) => u.isFront) || player[0]?.units[0]} />
      ) : (
        <>
          <Playmat enemy={enemy} player={player} sel={effSel} theme={sc.playmat} />
          <FieldPiles enemy={enemy} player={player} skipId={handVisible ? handSquadId : null} onInspect={onInspect} onSelectSquad={onSelectSquad} />
          <Zones enemy={enemy} player={player} effSel={effSel} hover={hover} onZone={onZone} onHover={setHover} />
          <Side squads={enemy} side="e" effSel={effSel} hover={hover} actingId={actingId} targetHint={targetHint} onPick={onPick} onOver={onOverUnit} registerMesh={registerMesh} />
          <Side squads={player} side="p" effSel={effSel} hover={hover} actingId={actingId} targetHint={targetHint} onPick={onPick} onOver={onOverUnit} registerMesh={registerMesh} />
          {!dragging && !actingId && <PlannedCards player={player} maps={maps} effSel={effSel} onInspect={onInspect} />}
        </>
      )}
      {fly && <FlyingCard key={fly.key} fly={fly} maps={maps} onDone={onFlyDone} />}
      {hand && <HandDock3D {...hand} draggingIid={drag?.iid || null} />}
      {drag?.card && <DragCard3D card={drag.card} sx={drag.x} sy={drag.y} over={!!drag.valid} />}
      <FxLayer items={fx} meshes={meshes} />
    </Canvas>
  );
}
