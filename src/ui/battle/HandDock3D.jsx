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

const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const SCOPE_WORD = { front: 'Vanguard', targeted: 'Targeted', squad: 'Squad', field: 'Field', self: 'Self' };
const scopeOf = (c) => c.scope || (c.reachesBack ? 'targeted' : 'front');
const isOffensive = (c) => (c?.effects || []).some((e) => e.op === 'damage' || e.op === 'debuff');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const FACE_W = 384, FACE_H = 540;

/** Bake an Action Card face (header · art · scope strip) to a canvas → CanvasTexture. */
function drawFace(ctx, card, img) {
  const el = elColor(card.element);
  ctx.clearRect(0, 0, FACE_W, FACE_H);
  ctx.fillStyle = '#1a120b'; ctx.fillRect(0, 0, FACE_W, FACE_H);
  // header
  ctx.fillStyle = el; ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, FACE_W, 78); ctx.globalAlpha = 1;
  ctx.fillStyle = '#120b08'; ctx.beginPath(); ctx.arc(44, 39, 27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(card.cost ?? ''), 44, 40);
  ctx.textAlign = 'left'; ctx.fillStyle = '#f6e7b0'; ctx.font = 'bold 30px Georgia';
  let name = card.name || ''; while (ctx.measureText(name).width > FACE_W - 92 && name.length > 4) name = name.slice(0, -2);
  ctx.fillText(name === card.name ? name : name + '…', 84, 40);
  // art
  const ax = 16, ay = 92, aw = FACE_W - 32, ah = 322;
  ctx.fillStyle = '#0d0805'; ctx.fillRect(ax, ay, aw, ah);
  if (img) { try { ctx.drawImage(img, ax, ay, aw, ah); } catch { /* ignore */ } }
  // scope strip
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(ax, ay + ah - 46, aw, 46);
  ctx.fillStyle = '#f6e7b0'; ctx.font = 'bold 24px Georgia'; ctx.textAlign = 'center';
  const noun = isOffensive(card) ? 'Attack' : (scopeOf(card) === 'self' ? 'Skill' : 'Buff');
  ctx.fillText(`${SCOPE_WORD[scopeOf(card)] || 'Vanguard'} ${cap(card.type) || noun}`, FACE_W / 2, ay + ah - 22);
  // rules text (wrapped, small)
  ctx.fillStyle = '#cbb996'; ctx.font = '22px Georgia'; ctx.textAlign = 'left';
  const words = String(card.text || '').split(' '); let line = '', yy = ay + ah + 34;
  for (const w of words) {
    if (ctx.measureText(line + w).width > FACE_W - 32) { ctx.fillText(line, 16, yy); line = w + ' '; yy += 28; if (yy > FACE_H - 12) break; }
    else line += w + ' ';
  }
  if (yy <= FACE_H - 12) ctx.fillText(line, 16, yy);
}

function useActionCardTexture(card) {
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

const CARD_W = 0.74, CARD_H = 1.03;

/** One fanned hand card (a mesh). Tap = select; tap-when-selected = detail. */
function HandCard3D({ card, index, count, dealKey, selected, onSelect, onDetail }) {
  const tex = useActionCardTexture(card);
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
  return (
    <group ref={grp} position={[baseX, baseY - 0.6, 0]}>
      <mesh
        onPointerDown={(e) => { e.stopPropagation(); selected ? onDetail(card) : onSelect(card.iid); }}
        onPointerOver={(e) => { e.stopPropagation(); hov.current = true; }}
        onPointerOut={() => { hov.current = false; }}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        {tex
          ? <meshBasicMaterial key="t" map={tex} toneMapped={false} />
          : <meshBasicMaterial key="c" color={elColor(card.element)} toneMapped={false} />}
      </mesh>
      {selected && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[CARD_W + 0.06, CARD_H + 0.06]} />
          <meshBasicMaterial color="#f0c84a" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** A face-up little card stack with a count label (deck / discard / exhaust). */
function Pile3D({ x, color, count, label, onTap }) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const ctx = c.getContext('2d'); ctx.font = 'bold 30px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; ctx.lineWidth = 6; ctx.strokeStyle = '#000';
    ctx.strokeText(`${count}`, 64, 24); ctx.fillStyle = '#f6e7b0'; ctx.fillText(`${count}`, 64, 24);
    ctx.font = '15px Georgia'; ctx.fillStyle = '#c9a66b'; ctx.fillText(label, 64, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; setTex(t);
    return () => t.dispose();
  }, [count, label]);
  const depth = Math.min(0.16, 0.02 + count * 0.008);
  return (
    <group position={[x, 0, 0]}>
      <mesh onPointerDown={(e) => { e.stopPropagation(); if (count) onTap(); }}>
        <boxGeometry args={[CARD_W * 0.8, CARD_H * 0.8, Math.max(0.02, depth)]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
      {tex && <mesh position={[0, -CARD_H * 0.5, depth / 2 + 0.01]}><planeGeometry args={[0.5, 0.25]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>}
    </group>
  );
}

/** Ensures a group rides the camera (a fixed foreground shelf). */
function CamShelf({ children, aspect }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const ref = useRef();
  useEffect(() => {
    scene.add(camera);            // the default camera isn't in the graph by default; add it so its children render
    const node = ref.current; camera.add(node);
    return () => { camera.remove(node); };
  }, [camera, scene]);
  // sit low + in front, tilted up toward the viewer; scale down a touch on portrait
  const s = aspect < 1 ? 0.8 : 1;
  return <group ref={ref} position={[0, -0.86 * s, -3.05]} rotation={[0.46, 0, 0]} scale={s}>{children}</group>;
}

export default function HandDock3D({ station, selectedIid, dealKey, onSelectCard, onCardDetail, onInspect }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  if (!station) return null;
  const hand = station.hand || [];
  return (
    <CamShelf aspect={aspect}>
      {/* deck (left) */}
      <Pile3D x={-2.15} color="#33240f" count={station.deckCount || 0} label="Deck"
        onTap={() => onInspect({ title: 'Draw Pile', cards: station.deck, note: 'Contents known · order hidden' })} />
      {/* hand (centre) */}
      <group position={[0, 0.1, 0.2]}>
        {hand.map((card, i) => (
          <HandCard3D key={`${dealKey}-${card.iid}`} card={card} index={i} count={hand.length} dealKey={dealKey}
            selected={selectedIid === card.iid} onSelect={onSelectCard} onDetail={onCardDetail} />
        ))}
      </group>
      {/* discard + exhaust (right) */}
      <Pile3D x={1.75} color="#241528" count={station.discardCount || 0} label="Discard"
        onTap={() => onInspect({ title: 'Discard', cards: station.discard })} />
      <Pile3D x={2.4} color="#241228" count={station.exhaustCount || 0} label="Exhaust"
        onTap={() => onInspect({ title: 'Exhaust', cards: station.exhaust })} />
    </CamShelf>
  );
}
