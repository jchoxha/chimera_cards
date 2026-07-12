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
// The camera-shelf overlay renders ABOVE every board element. Board FX peak at renderOrder
// ~82, so the overlay base sits well above that; the drag card (Board3D) goes higher still.
export const RO_OVERLAY = 90;

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
  // The board's labels / dashes / tints are in the TRANSPARENT pass, which always renders
  // AFTER the opaque pass regardless of renderOrder — so an OPAQUE hand card gets painted
  // over by them (the recurring "see-through" bug). Fix: the hand is transparent too, with a
  // renderOrder ABOVE every board element (RO_OVERLAY), so it draws LAST and fully occludes.
  const ro = RO_OVERLAY + index * 2;
  return (
    <group ref={grp} position={[baseX, baseY - 0.6, 0]}>
      {/* subtle rounded GLOW halo — sits BEHIND the card (lower renderOrder), so the opaque
          card texture paints over its centre and only a soft rim shows around the edges. */}
      {selected && (
        <mesh position={[0, 0, -0.03]} renderOrder={ro}>
          <planeGeometry args={[CARD_W + 0.34, CARD_H + 0.34]} />
          <meshBasicMaterial map={handGlowTexture()} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      {/* face — transparent pass, high renderOrder, depthTest+depthWrite off: draws last and
          over EVERYTHING (its baked texture is fully opaque, so it reads solid, not glassy). */}
      <mesh renderOrder={ro + 1}
        onPointerDown={faceDown ? undefined : (e) => { e.stopPropagation(); onCardPointerDown(card, e.nativeEvent); }}
        onPointerOver={faceDown ? undefined : (e) => { e.stopPropagation(); hov.current = true; }}
        onPointerOut={faceDown ? undefined : () => { hov.current = false; }}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        {tex
          ? <meshBasicMaterial key="t" map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          : <meshBasicMaterial key="c" color={elColor(card.element)} transparent depthTest={false} depthWrite={false} toneMapped={false} />}
      </mesh>
    </group>
  );
}

/** A physical card PILE: a stack of thin card meshes (height ∝ count) + a count/label
 *  plate. Tapping the stack opens the inspect overlay. */
/** A face-UP card baked onto the top of a pile (used by In Play to show the last card added). */
function PileTopFace({ card, pw, ph, y, ro }) {
  const tex = useActionCardTexture(card);
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={ro}>
      <planeGeometry args={[pw, ph]} />
      {tex
        ? <meshBasicMaterial key="t" map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        : <meshBasicMaterial key="c" color="#2a1d11" transparent depthTest={false} depthWrite={false} toneMapped={false} />}
    </mesh>
  );
}

function Pile3D({ x, color = '#3a2a18', count, label, onTap, topCard = null }) {
  const empty = count <= 0;
  const [tex, setTex] = useState(null);
  useEffect(() => {
    // ONE-LINE label ABOVE the pile as "Pile Name (n)". Empty piles → dim + grey text
    // (still marginally legible).
    const c = document.createElement('canvas'); c.width = 384; c.height = 64;
    const ctx = c.getContext('2d'); ctx.font = 'bold 30px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = empty ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.9)';
    const txt = `${label} (${count})`;
    ctx.strokeText(txt, 192, 34); ctx.fillStyle = empty ? 'rgba(150,140,120,0.6)' : '#f6e7b0'; ctx.fillText(txt, 192, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; setTex(t);
    return () => t.dispose();
  }, [count, label, empty]);
  const n = Math.max(1, Math.min(20, count));      // number of card layers to draw
  const pw = CARD_W * 0.9, ph = CARD_H * 0.9;
  const lift = 0.03;                               // per-card vertical rise → visible stack height
  const top = (n - 1) * lift;
  const back = cardBackTexture();
  const RO = RO_OVERLAY;
  const boxCol = empty ? '#20160d' : color;
  // the pile lies almost FLAT (tilted right back toward horizontal) so it reads as a real
  // 3-D stack of cards seen from a shallow top angle — never a single upright card. All meshes
  // are transparent + high renderOrder so the board's transparent labels never paint over them.
  return (
    <group position={[x, -0.02, 0.02]} rotation={[1.24, 0, 0]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[0, i * lift, 0]} renderOrder={RO + i}
          onPointerDown={i === n - 1 && !empty ? (e) => { e.stopPropagation(); onTap(); } : undefined}>
          <boxGeometry args={[pw, 0.02, ph]} />
          <meshStandardMaterial color={boxCol} roughness={0.7} metalness={0.15} transparent opacity={empty ? 0.32 : 1} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      {/* the TOP card: FACE-UP (last card) when a `topCard` is given (In Play), else the
          face-down back. KEY on `empty` — going null→map (0→1 cards) won't recompile the
          shader to use the map without a remount, so a pile that started empty would render white. */}
      {(!empty && topCard)
        ? <PileTopFace card={topCard} pw={pw} ph={ph} y={top + 0.012} ro={RO + n + 1} />
        : (
          <mesh position={[0, top + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={RO + n + 1}>
            <planeGeometry args={[pw, ph]} />
            <meshBasicMaterial key={empty ? 'e' : 'f'} map={empty ? null : back} color={empty ? '#241a10' : '#ffffff'} transparent opacity={empty ? 0.35 : 1} depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        )}
      {/* one-line label plate, stood up to face the camera ABOVE (behind) the stack */}
      {tex && <mesh position={[0, 0.02, -(ph * 0.5 + 0.22)]} rotation={[-1.24, 0, 0]} renderOrder={RO + n + 3}><planeGeometry args={[1.15, 0.19]} /><meshBasicMaterial map={tex} transparent opacity={empty ? 0.7 : 1} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>}
    </group>
  );
}

/** Ensures a group rides the camera (a fixed foreground shelf). `slideRef` carries a
 *  horizontal offset (set on squad switch) that eases back to 0 — the carousel slide.
 *  `riseRef` (0→1, set to 1 when the overlay appears / switches squad) eases back to 0 to
 *  play the ENTRANCE: the whole shelf flies UP from below + grows into place, so the piles
 *  and hand read as being lifted off the battlefield. */
function CamShelf({ children, aspect, slideRef, riseRef }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const ref = useRef();
  useEffect(() => {
    scene.add(camera);            // the default camera isn't in the graph by default; add it so its children render
    const node = ref.current; camera.add(node);
    if (riseRef) riseRef.current = 1;   // play the rise entrance on mount
    return () => { camera.remove(node); };
  }, [camera, scene, riseRef]);
  const baseY = -0.8, baseZ = -3.5, s = aspect < 1 ? 0.56 : 0.68;
  useFrame(() => {
    const node = ref.current; if (!node) return;
    if (slideRef) {
      node.position.x = slideRef.current;
      slideRef.current += (0 - slideRef.current) * 0.16;   // ease to centre
      if (Math.abs(slideRef.current) < 0.002) slideRef.current = 0;
    }
    // ENTRANCE: rise from ~2.4 below + up-and-back (toward the board) + scale up, easing in.
    const r = riseRef ? riseRef.current : 0;
    const e = r * r * (3 - 2 * r);          // smoothstep
    node.position.y = baseY - e * 2.4;
    node.position.z = baseZ - e * 0.8;
    node.scale.setScalar(s * (1 - e * 0.28));
    if (riseRef) { riseRef.current += (0 - riseRef.current) * 0.14; if (riseRef.current < 0.002) riseRef.current = 0; }
  });
  // face the camera FLAT (no slant); the hand plane is distinct from the board table.
  // Raised a touch so the bottom row clears the dock bar; sits close to the camera so a
  // zoomed-in board never pokes in front of it (its meshes also skip the depth test).
  return <group ref={ref} position={[0, baseY, baseZ]} rotation={[0.08, 0, 0]} scale={s}>{children}</group>;
}

export default function HandDock3D({ station, selectedIid, dealKey, squadIndex = 0, draggingIid = null, faceDown = false, onCardPointerDown, onInspect }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  // carousel: on squad switch, start the shelf off-screen on the side we came FROM
  const slideRef = useRef(0);
  const riseRef = useRef(1);   // entrance rise (see CamShelf); replays on squad switch
  const prevIdx = useRef(squadIndex);
  if (squadIndex !== prevIdx.current) {
    slideRef.current = (squadIndex > prevIdx.current ? 1 : -1) * (aspect < 1 ? 6 : 9);
    riseRef.current = 1;
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
    <CamShelf aspect={aspect} slideRef={slideRef} riseRef={riseRef}>
      {/* piles sit LOW (near the hand row) with their one-line label above each */}
      <group position={[0, -0.15, 0]}>
        <Pile3D x={-px} color="#33240f" count={station.deckCount || 0} label="Draw Pile"
          onTap={() => onInspect({ title: 'Draw Pile', cards: station.deck, note: 'Contents known · order hidden' })} />
        <Pile3D x={-px + gap} color="#243a1a" count={inPlay.length} label="In Play" topCard={inPlay[inPlay.length - 1] || null}
          onTap={() => onInspect({ title: 'In Play — this turn', cards: inPlay })} />
        <Pile3D x={px - gap} color="#241528" count={station.discardCount || 0} label="Discarded"
          onTap={() => onInspect({ title: 'Discarded', cards: station.discard })} />
        <Pile3D x={px} color="#241228" count={station.exhaustCount || 0} label="Banished"
          onTap={() => onInspect({ title: 'Banished', cards: station.exhaust })} />
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
