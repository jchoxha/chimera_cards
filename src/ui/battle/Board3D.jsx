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
import { ATTUNEMENT_COLOR, creatureColor } from '../../data/axisIcons.js';
import { creatureArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';

const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const CARD_W = 1.12, CARD_H = 1.54;

// Shared squad layout (used by the board AND the camera rig so focusing lines up).
const LAYOUT = { spacing: 3.5, frontZ: { e: -2.6, p: 2.3 }, backZ: { e: -3.4, p: 3.1 } };
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

/** One creature: a standing, camera-tilted card mesh with name + HP bar. Raycast-picked. */
function Card3D({ u, side, x, frontZ, backZ, selected, acting, hovered, onPick, onOver, onCam, registerMesh }) {
  const art = useMemo(() => cardArtOf(u), [u.id, u.portrait, u.form]);
  const tex = useImageTexture(art.url, art.pixel);
  const grp = useRef();
  const meshRef = useRef();
  const scaleBase = u.isFront ? 1 : 0.82;
  const z = u.isFront ? frontZ : backZ;
  const baseY = (CARD_H * scaleBase) / 2;

  useEffect(() => { if (meshRef.current) registerMesh(u.id, meshRef.current); return () => registerMesh(u.id, null); }, [u.id]);

  useFrame(() => {
    const g = grp.current; if (!g) return;
    const lift = (selected ? 0.22 : 0) + (acting ? 0.5 : 0) + (hovered ? 0.12 : 0);
    g.position.y = THREE.MathUtils.lerp(g.position.y, baseY + lift, 0.16);
    const s = scaleBase * (acting ? 1.14 : 1);
    const cur = g.scale.x + (s - g.scale.x) * 0.16;
    g.scale.setScalar(cur);
  });

  const hpFrac = Math.max(0, Math.min(1, u.hp / u.maxHp));
  const frameColor = selected ? '#f0c84a' : (acting ? '#ffd873' : elColor(u.element));
  const dim = u.dead ? 0.4 : 1;

  return (
    <group ref={grp} position={[x, baseY, z]} rotation={[-0.15, 0, 0]}>
      {/* frame / border behind the face */}
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[CARD_W + 0.08, CARD_H + 0.08, 0.06]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.3} emissive={frameColor} emissiveIntensity={selected || acting ? 0.5 : 0.08} />
      </mesh>
      {/* the face (art or solid color) — the pick target. UNLIT so art shows true colors. */}
      <mesh ref={meshRef} userData={{ unitId: u.id, side }}
        onPointerDown={(e) => { e.stopPropagation(); onPick(u, side); onCam && onCam(); }}
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

/** The wooden table + a receding grid. */
function Table() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -0.5]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#2a1d10" roughness={1} />
      </mesh>
      <gridHelper args={[60, 60, '#5a4327', '#3a2a18']} position={[0, 0, -0.5]} />
    </group>
  );
}

/** Navigable camera: eases toward an overview by default, or toward a FOCUS
 *  point {x,z} (a squad, or the acting creature during resolution). Auto-widens
 *  on narrow/portrait viewports so the spread of squads stays in frame. */
function CameraRig({ focus }) {
  const { camera, size } = useThree();
  const pos = useRef(new THREE.Vector3(0, 4.6, 8.1));
  const tgt = useRef(new THREE.Vector3(0, 0.2, -0.8));
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height);
    let dp, dt, fov;
    if (focus) {
      dp = new THREE.Vector3(focus.x * 0.9, 4.0, focus.z > 0 ? focus.z + 5.4 : 6.4);
      dt = new THREE.Vector3(focus.x, 0.45, focus.z);
      fov = aspect < 1 ? 54 : 43;
    } else {
      dp = new THREE.Vector3(0, 4.6, aspect < 1 ? 9.6 : 8.1);
      dt = new THREE.Vector3(0, 0.2, -0.8);
      fov = aspect < 1 ? 60 : 46;
    }
    pos.current.lerp(dp, 0.09);
    tgt.current.lerp(dt, 0.09);
    camera.position.copy(pos.current);
    camera.lookAt(tgt.current);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.09; camera.updateProjectionMatrix(); }
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

/** Squads laid out on the table: enemy far, you near; Vanguard centered/forward, Support flanking/back. */
function Side({ squads, side, focusId, actingId, hoverId, onPick, onOver, onCam, registerMesh }) {
  const frontZ = LAYOUT.frontZ[side];
  const backZ = LAYOUT.backZ[side];
  return squads.map((sq, i) => {
    const cx = squadX(i, squads.length);
    const center = squadCenter(side, i, squads.length);
    const front = sq.units.find((u) => u.isFront);
    const supp = sq.units.filter((u) => !u.isFront);
    const ordered = front ? [supp[0], front, supp[1]].filter(Boolean) : sq.units;
    return (
      <group key={sq.id}>
        {ordered.map((u, ui) => {
          const slot = ordered.length === 1 ? 0 : ui - (ordered.length - 1) / 2;
          return (
            <Card3D key={u.id} u={u} side={side} x={cx + slot * 1.2} frontZ={frontZ} backZ={backZ}
              selected={sq.id === focusId} acting={actingId === u.id} hovered={hoverId === u.id}
              onPick={onPick} onOver={onOver} onCam={() => onCam(center)} registerMesh={registerMesh} />
          );
        })}
      </group>
    );
  });
}

export default function Board3D({ enemy, player, focusId, actingId, onPick, pickRef }) {
  const [hoverId, setHoverId] = useState(null);
  const [camFocus, setCamFocus] = useState(null);   // manual camera focus (a squad center) | null = overview
  const meshes = useRef(new Map());
  const registerMesh = (id, m) => { if (m) meshes.current.set(id, m); else meshes.current.delete(id); };

  // unit → its squad center, so the camera can auto-follow the ACTING creature during resolution
  const unitCenter = useMemo(() => {
    const m = new Map();
    [[enemy, 'e'], [player, 'p']].forEach(([arr, side]) =>
      arr.forEach((sq, i) => sq.units.forEach((u) => m.set(u.id, squadCenter(side, i, arr.length)))));
    return m;
  }, [enemy, player]);
  const focus = actingId ? (unitCenter.get(actingId) || camFocus) : camFocus;

  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 4.6, 8.1], fov: 46, near: 0.1, far: 100 }}
      onPointerMissed={() => { setHoverId(null); setCamFocus(null); }}>
      <color attach="background" args={['#0c0805']} />
      <fog attach="fog" args={['#0c0805', 12, 26]} />
      <CameraRig focus={focus} />
      <Picker pickRef={pickRef} meshes={meshes} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 9, 7]} intensity={1.15} />
      <directionalLight position={[-5, 4, 2]} intensity={0.35} color="#8fb4ff" />
      <Table />
      <Side squads={enemy} side="e" focusId={focusId} actingId={actingId} hoverId={hoverId} onPick={onPick} onOver={setHoverId} onCam={setCamFocus} registerMesh={registerMesh} />
      <Side squads={player} side="p" focusId={focusId} actingId={actingId} hoverId={hoverId} onPick={onPick} onOver={setHoverId} onCam={setCamFocus} registerMesh={registerMesh} />
    </Canvas>
  );
}
