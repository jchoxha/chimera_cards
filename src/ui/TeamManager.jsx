// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/TeamManager — view + reorder the team (Active Vanguard +     ║
// ║ bench) as a row of CARDS, dragged-to-reorder with the SAME ghost-follow  ║
// ║ system as the combat hand (a floating copy tracks the cursor; the order  ║
// ║ commits on drop, so there's no live-reflow glitch). Tap a card = details ║
// ║ (onSelect). The FIRST member is the Vanguard; reordering returns the new  ║
// ║ id order via onReorder. Mouse + touch via pointer events.                ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { creatureIcon, creatureColor } from '../data/axisIcons.js';
import { sizedPortrait } from '../data/sizeArt.js';
import { useFlip } from './useFlip.js';
import './teamManager.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;
const DRAG_THRESHOLD = 6; // px before a tap becomes a drag

/** The inner visual of a team card — reused by the real card AND the drag ghost. */
function CardBody({ m, i, color }) {
  const portrait = sizedPortrait(m.meta?.portrait || m.portrait, m.meta?.form ?? m.form ?? m.size);
  return (
    <>
      <span className="tmcPos">{i === 0 ? <Icon icon="game-icons:star-formation" /> : i + 1}</span>
      <div className="tmcArt" style={{ '--gl': color }}>
        {portrait
          ? <img src={portrait} alt="" draggable={false} />
          : <Icon icon={creatureIcon(m)} style={{ color }} />}
      </div>
      <div className="tmcName">{m.name}</div>
      <div className="tmcRole">{i === 0 ? '★ Vanguard' : 'Bench'}</div>
      {m.hp != null && m.maxHp != null && (
        <div className="tmcHp"><i style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%` }} /><em>{m.hp}/{m.maxHp}</em></div>
      )}
    </>
  );
}

export default function TeamManager({ members = [], onReorder, onRemove, onSelect, title = 'Your Team', vertical = false, hint = true }) {
  const ids = members.map((m) => m.id);
  const listRef = useRef(null);
  const drag = useRef(null);                 // { id, x, y, startX, startY, moved, lastReorderAt }
  const [d, setD] = useState(null);          // render mirror of drag.current
  const cardEls = useRef(new Map());         // id → card element (for FLIP)
  const membersRef = useRef(members);        // always-current members (window handlers read this)
  membersRef.current = members;
  useFlip(ids.join(','), cardEls);           // slide cards to new slots when the order changes

  const reorderToIndex = (movingId, to) => {
    const cur = membersRef.current.map((m) => m.id);
    const from = cur.indexOf(movingId);
    if (from < 0 || to === from) return false;
    cur.splice(from, 1);
    cur.splice(Math.max(0, Math.min(to, cur.length)), 0, movingId);
    onReorder && onReorder(cur);
    return true;
  };

  /** Where the dragged card WANTS to sit: count the other cards whose center
   *  precedes the cursor in reading order (row above, or same row and left of it).
   *  Index-based (not element-under-cursor), so ANY slot — including the vanguard
   *  slot — can be taken, and dragging back and forth re-reorders freely. */
  const desiredIndex = (movingId, x, y) => {
    let idx = 0;
    for (const m of membersRef.current) {
      if (m.id === movingId) continue;
      const el = cardEls.current.get(m.id);
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const cy = r.top + r.height / 2;
      const before = (cy < y - r.height / 2) || (Math.abs(cy - y) <= r.height / 2 && r.left + r.width / 2 < x);
      if (before) idx += 1;
    }
    return idx;
  };

  // A drag is tracked at the WINDOW level (not via pointer capture on the card),
  // so the ghost follows the cursor ANYWHERE on the page and the drag survives the
  // live-reorder re-render (capture on the moved card node would be lost). Rebinds
  // only when a NEW drag begins (keyed on the dragged id).
  useEffect(() => {
    if (!d) return undefined;
    const onMove = (e) => {
      const g = drag.current;
      if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > DRAG_THRESHOLD) g.moved = true;
      if (g.moved) {
        // Only reorder while the cursor is near the team row; drag it into empty
        // space and the card just floats, then snaps back to its slot on release.
        const rect = listRef.current?.getBoundingClientRect();
        const near = rect && e.clientY > rect.top - 90 && e.clientY < rect.bottom + 90;
        if (near) {
          const now = performance.now();
          if (!g.lastReorderAt || now - g.lastReorderAt > 190) {
            const to = desiredIndex(g.id, e.clientX, e.clientY);
            if (reorderToIndex(g.id, to)) g.lastReorderAt = now;
          }
        }
      }
      setD({ ...g });
    };
    const onUp = () => {
      const g = drag.current;
      drag.current = null;
      setD(null);
      if (g && !g.moved) { const m = membersRef.current.find((x) => x.id === g.id); if (m && onSelect) onSelect(m); }
      // order already committed live during the drag; a far/empty release just snaps back
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [d?.id]);

  function onPointerDown(e, id) {
    if (e.target.closest('.tmRm')) return;   // let the remove button work
    e.preventDefault();
    drag.current = { id, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, lastReorderAt: 0 };
    setD({ ...drag.current });               // arms the window-level tracking effect
  }

  if (!members.length) return <div className="tmEmpty">No creatures yet.</div>;

  const dragging = !!d && d.moved;
  const dragMember = dragging ? members.find((m) => m.id === d.id) : null;
  const dragIdx = dragging ? ids.indexOf(d.id) : -1;

  return (
    <div className="teamMgr">
      {title && <div className="tmTitle">{title}</div>}
      <div className={`tmCards${vertical ? ' vertical' : ''}`} ref={listRef}>
        {members.map((m, i) => {
          const color = creatureColor(m);
          const dead = m.hp != null && m.hp <= 0;
          return (
            <div key={m.id} data-tmid={m.id} draggable={false} onDragStart={(e) => e.preventDefault()}
              ref={(el) => { if (el) cardEls.current.set(m.id, el); else cardEls.current.delete(m.id); }}
              className={`tmCard${i === 0 ? ' vanguard' : ''}${dead ? ' dead' : ''}${d?.id === m.id && dragging ? ' dragging' : ''}`}
              style={{ '--gl': color }}
              onPointerDown={(e) => onPointerDown(e, m.id)}
              title={onSelect ? `${m.name} — tap for details, drag to reorder` : m.name}>
              <CardBody m={m} i={i} color={color} />
              {onRemove && <button className="tmRm" title="Remove from team" onClick={() => onRemove(m.id)}>✕</button>}
            </div>
          );
        })}
      </div>
      {hint && <p className="tmHint"><Icon icon="game-icons:move" /> Drag a card to reorder — the ★ slot is your Active Vanguard. Tap for details.</p>}

      {/* the floating ghost — a faithful card copy that follows the cursor */}
      {dragging && dragMember && (
        <div className="tmGhost" style={{ left: d.x, top: d.y, '--gl': creatureColor(dragMember) }}>
          <div className="tmCard ghost" style={{ '--gl': creatureColor(dragMember) }}>
            <CardBody m={dragMember} i={dragIdx} color={creatureColor(dragMember)} />
          </div>
        </div>
      )}
    </div>
  );
}
