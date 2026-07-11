// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/HandDock3D — the card SECTION as a 3D foreground plane.  ║
// ║ A CAMERA-ATTACHED shelf (its own tilted plane, distinct from the board     ║
// ║ table) holding the selected squad's DECK · fanned HAND · DISCARD · EXHAUST  ║
// ║ as real meshes. Because it rides the camera and the camera fov is constant, ║
// ║ it stays fixed at the bottom of the view as the board camera navigates —    ║
// ║ i.e. it reads like a 2D hand but is a genuine 3D object. Card faces are     ║
// ║ baked to a CanvasTexture (art + cost + name + scope). Raycast-picked: TAP a ║
// ║ card to select it (tap again → detail); then tap a board creature to play.  ║
// ║ Piles tap → the DOM inspect overlay. Pure view; state lives in the store.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import { cardArt } from '../../data/artPool.js';
import { drawActionFace, cardBackTexture } from './cardArt3d.js';

const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const SCOPE_WORD = { front: 'Vanguard', targeted: 'Targeted', squad: 'Squad', field: 'Field', self: 'Self' };
const scopeOf = (c) => c.scope || (c.reachesBack ? 'targeted' : 'front');
const isOffensive = (c) => (c?.effects || []).some((e) => e.op === 'damage' || e.op === 'debuff');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const FACE_W = 384, FACE_H = 540;

/** Bake an Action Card face through the SHARED TCG frame (matches the creature cards). */
function drawFace(ctx, card, img) {
  const scopeWord = SCOPE_WORD[scopeOf(card)] || 'Vanguard';
  const typeWord = cap(card.type) || (isOffensive(card) ? 'Attack' : (scopeOf(card) === 'self' ? 'Skill' : 'Buff'));
  drawActionFace(ctx, card, img, { W: FACE_W, H: FACE_H, scopeWord, typeWord });
}

export function useActionCardTexture(card) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = FACE_W; canvas.height = FACE_H;
    const ctx = canvas.getContext('2d');
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    let alive = true;
    const redraw = (img) => { if (!alive) return; drawFace(ctx, card, img); t.needsUpdate = true; setTex(t); };
    redraw(null);
    const url = cardArt({ ...card, attunement: card.element });
    if (url) { const img = new Image(); img.onload = () => redraw(img); img.src = url; }
    return () => { alive = false; t.dispose(); };
  }, [card.iid]);
  return tex;
}

export const HAND_CARD_W = 0.74, HAND_CARD_H = 1.03;
const CARD_W = HAND_CARD_W, CARD_H = HAND_CARD_H;

// soft radial glow (for the rounded, glowing hand-card selection halo)
let _hglow = null;
function handGlowTexture() {
  if (_hglow) return _hglow;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,224,120,0.5)'); g.addColorStop(0.6, 'rgba(240,200,74,0.28)'); g.addColorStop(1, 'rgba(240,200,74,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  _hglow = new THREE.CanvasTexture(c); _hglow.colorSpace = THREE.SRGBColorSpace;
  return _hglow;
}


/** One fanned hand card (a mesh). Pointer-down starts a press the shell resolves
 *  into a TAP (select / detail) or a DRAG-to-play (raycast onto a board creature). */
function HandCard3D({ card, index, count, dealKey, selected, faceDown, onCardPointerDown }) {
  const faceTex = useActionCardTexture(card);
  const tex = (faceDown && card.known !== true) ? cardBackTexture() : faceTex;
  const grp = useRef();
  const hov = useRef(false);
  // fan: centre the row, arc + tilt by offset from centre
  const off = index - (count - 1) / 2;
  const baseX = off * 0.6;
  const baseY = -Math.abs(off) * 0.05;
  const baseRot = -off * 0.1;
  const born = useRef(0);
  useEffect(() => { born.current = 0; }, [dealKey]);
  useFrame((_, dt) => {
    const g = grp.current; if (!g) return;
    born.current = Math.min(1, born.current + dt * 3.2);
    const lift = (selected ? 0.26 : 0) + (hov.current ? 0.12 : 0);
    const ease = born.current * born.current * (3 - 2 * born.current);
    g.position.x = THREE.MathUtils.lerp(g.position.x, baseX, 0.25);
    g.position.y = THREE.MathUtils.lerp(g.position.y, baseY + lift + (1 - ease) * -0.6, 0.25);
    g.position.z = THREE.MathUtils.lerp(g.position.z, (selected ? 0.14 : 0) + off * 0.001, 0.25);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, selected ? 0 : baseRot, 0.25);
    const s = (selected ? 1.16 : 1) * ease;
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, Math.max(0.001, s), 0.25));
  });
  // draw above the board (depthTest off) — a zoomed-in board must not poke over the hand
  const ro = 30 + index;
  return (
    <group ref={grp} position={[baseX, baseY - 0.6, 0]}>
      {/* subtle rounded GLOW halo — sits BEHIND the card (depthTest on, so the opaque card
          occludes it: only a soft rim shows around the edges, never over the art). */}
      {selected && (
        <mesh position={[0, 0, -0.03]} renderOrder={ro - 2}>
          <planeGeometry args={[CARD_W + 0.34, CARD_H + 0.34]} />
          <meshBasicMaterial map={handGlowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      {/* OPAQUE face — depthTest off (a zoomed board can't cover it) but depthWrite ON so
          nothing (ground tints / piles / auras in the transparent pass) blends over it. */}
      <mesh renderOrder={ro}
        onPointerDown={faceDown ? undefined : (e) => { e.stopPropagation(); onCardPointerDown(card, e.nativeEvent); }}
        onPointerOver={faceDown ? undefined : (e) => { e.stopPropagation(); hov.current = true; }}
        onPointerOut={faceDown ? undefined : () => { hov.current = false; }}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        {tex
          ? <meshBasicMaterial key="t" map={tex} transparent={false} depthTest={false} toneMapped={false} />
          : <meshBasicMaterial key="c" color={elColor(card.element)} transparent={false} depthTest={false} toneMapped={false} />}
      </mesh>
    </group>
  );
}

/** A physical card PILE: a stack of thin card meshes (height ∝ count) + a count/label
 *  plate. Tapping the stack opens the inspect overlay. */
function Pile3D({ x, color, count, label, onTap }) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 72;
    const ctx = c.getContext('2d'); ctx.font = 'bold 34px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(`${count}`, 80, 26); ctx.fillStyle = '#f6e7b0'; ctx.fillText(`${count}`, 80, 26);
    ctx.font = '16px Georgia'; ctx.fillStyle = '#c9a66b'; ctx.fillText(label, 80, 56);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; setTex(t);
    return () => t.dispose();
  }, [count, label]);
  const n = Math.max(1, Math.min(20, count));      // number of card layers to draw
  const pw = CARD_W * 0.9, ph = CARD_H * 0.9;
  const lift = 0.03;                               // per-card vertical rise → visible stack height
  const top = (n - 1) * lift;
  const back = cardBackTexture();
  // the pile lies almost FLAT (tilted right back toward horizontal) so it reads as a real
  // 3-D stack of cards seen from a shallow top angle — never a single upright card.
  return (
    <group position={[x, -0.02, 0.02]} rotation={[1.24, 0, 0]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[0, i * lift, 0]} renderOrder={22 + i}
          onPointerDown={i === n - 1 ? (e) => { e.stopPropagation(); if (count) onTap(); } : undefined}>
          <boxGeometry args={[pw, 0.02, ph]} />
          <meshStandardMaterial color={count ? '#3a2a18' : '#20160d'} roughness={0.7} metalness={0.15} transparent={!count} opacity={count ? 1 : 0.4} depthTest={false} />
        </mesh>
      ))}
      {/* the TOP card's face-down back (so the deck reads as a stack of real cards) */}
      <mesh position={[0, top + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={22 + n}>
        <planeGeometry args={[pw, ph]} />
        <meshBasicMaterial map={count ? back : null} color={count ? '#ffffff' : '#241a10'} transparent={false} depthTest={false} toneMapped={false} />
      </mesh>
      {/* count · label plate, stood back up to face the camera in front of the stack */}
      {tex && <mesh position={[0, 0.02, ph * 0.5 + 0.12]} rotation={[-1.24, 0, 0]} renderOrder={48}><planeGeometry args={[0.66, 0.3]} /><meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} /></mesh>}
    </group>
  );
}

/** Ensures a group rides the camera (a fixed foreground shelf). `slideRef` carries a
 *  horizontal offset (set on squad switch) that eases back to 0 — the carousel slide. */
function CamShelf({ children, aspect, slideRef }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const ref = useRef();
  useEffect(() => {
    scene.add(camera);            // the default camera isn't in the graph by default; add it so its children render
    const node = ref.current; camera.add(node);
    return () => { camera.remove(node); };
  }, [camera, scene]);
  useFrame(() => {
    if (!ref.current || !slideRef) return;
    ref.current.position.x = slideRef.current;
    slideRef.current += (0 - slideRef.current) * 0.16;   // ease to centre
    if (Math.abs(slideRef.current) < 0.002) slideRef.current = 0;
  });
  const s = aspect < 1 ? 0.56 : 0.68;
  // face the camera FLAT (no slant); the hand plane is distinct from the board table.
  // Raised a touch so the bottom row clears the dock bar; sits close to the camera so a
  // zoomed-in board never pokes in front of it (its meshes also skip the depth test).
  return <group ref={ref} position={[0, -0.8, -3.5]} rotation={[0.08, 0, 0]} scale={s}>{children}</group>;
}

export default function HandDock3D({ station, selectedIid, dealKey, squadIndex = 0, draggingIid = null, faceDown = false, onCardPointerDown, onInspect }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  // carousel: on squad switch, start the shelf off-screen on the side we came FROM
  const slideRef = useRef(0);
  const prevIdx = useRef(squadIndex);
  if (squadIndex !== prevIdx.current) {
    slideRef.current = (squadIndex > prevIdx.current ? 1 : -1) * (aspect < 1 ? 6 : 9);
    prevIdx.current = squadIndex;
  }
  if (!station) return null;
  // enemy squads expose only a face-DOWN count (their cards are hidden) → render that many
  // backs; your own hand is the real face-up cards (minus whichever one is being dragged).
  const hand = faceDown
    ? Array.from({ length: station.handCount || 0 }, (_, i) => ({ iid: `back-${i}`, known: false }))
    : (station.hand || []).filter((c) => c.iid !== draggingIid);
  // piles flank the hand (hand in the MIDDLE): left = Deck · In Play, right = Discard ·
  // Exhaust. Pulled IN + lifted so the bottom-corner HUD buttons don't cut them off.
  const px = aspect < 1 ? 2.5 : 3.0, gap = 0.82;
  const inPlay = (station.plan || []).map((a) => a.card);
  return (
    <CamShelf aspect={aspect} slideRef={slideRef}>
      <group position={[0, 0.5, 0]}>
        <Pile3D x={-px} color="#33240f" count={station.deckCount || 0} label="Deck"
          onTap={() => onInspect({ title: 'Draw Pile', cards: station.deck, note: 'Contents known · order hidden' })} />
        <Pile3D x={-px + gap} color="#243a1a" count={inPlay.length} label="In Play"
          onTap={() => onInspect({ title: 'In Play — this turn', cards: inPlay })} />
        <Pile3D x={px - gap} color="#241528" count={station.discardCount || 0} label="Discard"
          onTap={() => onInspect({ title: 'Discard', cards: station.discard })} />
        <Pile3D x={px} color="#241228" count={station.exhaustCount || 0} label="Exhaust"
          onTap={() => onInspect({ title: 'Exhaust', cards: station.exhaust })} />
      </group>
      {/* hand (centre) */}
      <group position={[0, 0.1, 0.2]}>
        {hand.map((card, i) => (
          <HandCard3D key={`${dealKey}-${card.iid}`} card={card} index={i} count={hand.length} dealKey={dealKey}
            selected={!faceDown && selectedIid === card.iid} faceDown={faceDown} onCardPointerDown={onCardPointerDown} />
        ))}
      </group>
    </CamShelf>
  );
}
