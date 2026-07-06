// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/TeamManager — view + reorder the team (Active Vanguard +     ║
// ║ bench) as a row of CARDS, dragged-to-reorder with the SAME ghost-follow  ║
// ║ system as the combat hand (a floating copy tracks the cursor; the order  ║
// ║ commits on drop, so there's no live-reflow glitch). Tap a card = details ║
// ║ (onSelect). The FIRST member is the Vanguard; reordering returns the new  ║
// ║ id order via onReorder. Mouse + touch via pointer events.                ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useRef, useState } from 'react';
import { creatureIcon, creatureColor } from '../data/axisIcons.js';
import { useFlip } from './useFlip.js';
import './teamManager.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;
const DRAG_THRESHOLD = 6; // px before a tap becomes a drag

/** The inner visual of a team card — reused by the real card AND the drag ghost. */
function CardBody({ m, i, color }) {
  const portrait = m.meta?.portrait || m.portrait;
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

export default function TeamManager({ members = [], onReorder, onRemove, onSelect, title = 'Your Team' }) {
  const ids = members.map((m) => m.id);
  const listRef = useRef(null);
  const drag = useRef(null);                 // { id, x, y, startX, startY, overId, moved, lastOver }
  const [d, setD] = useState(null);          // render mirror of drag.current
  const cardEls = useRef(new Map());         // id → card element (for FLIP)
  useFlip(ids.join(','), cardEls);           // slide cards to new slots when the order changes

  const reorderToIndex = (movingId, to) => {
    const cur = ids.slice();
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
    for (const id of ids) {
      if (id === movingId) continue;
      const el = cardEls.current.get(id);
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const cy = r.top + r.height / 2;
      const before = (cy < y - r.height / 2) || (Math.abs(cy - y) <= r.height / 2 && r.left + r.width / 2 < x);
      if (before) idx += 1;
    }
    return idx;
  };

  function onPointerDown(e, id) {
    if (e.target.closest('.tmRm')) return;   // let the remove button work
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    drag.current = { id, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, overId: null, moved: false };
    setD({ ...drag.current });
  }
  function onPointerMove(e) {
    const g = drag.current;
    if (!g) return;
    g.x = e.clientX; g.y = e.clientY;
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > DRAG_THRESHOLD) g.moved = true;
    if (g.moved) {
      // LIVE reorder to the cursor's insertion index. A short cooldown lets the
      // FLIP slide (170ms) settle before re-measuring, so mid-animation rects
      // can't thrash the order back and forth.
      const now = performance.now();
      if (!g.lastReorderAt || now - g.lastReorderAt > 190) {
        const to = desiredIndex(g.id, e.clientX, e.clientY);
        if (reorderToIndex(g.id, to)) g.lastReorderAt = now;
      }
    }
    setD({ ...g });
  }
  function onPointerUp() {
    const g = drag.current;
    drag.current = null;
    setD(null);
    if (!g) return;
    if (!g.moved) { const m = members.find((x) => x.id === g.id); if (m && onSelect) onSelect(m); }
    // order already committed live during the drag
  }

  if (!members.length) return <div className="tmEmpty">No creatures yet.</div>;

  const dragging = !!d && d.moved;
  const dragMember = dragging ? members.find((m) => m.id === d.id) : null;
  const dragIdx = dragging ? ids.indexOf(d.id) : -1;

  return (
    <div className="teamMgr">
      {title && <div className="tmTitle">{title}</div>}
      <div className="tmCards" ref={listRef}>
        {members.map((m, i) => {
          const color = creatureColor(m);
          const dead = m.hp != null && m.hp <= 0;
          return (
            <div key={m.id} data-tmid={m.id} draggable={false} onDragStart={(e) => e.preventDefault()}
              ref={(el) => { if (el) cardEls.current.set(m.id, el); else cardEls.current.delete(m.id); }}
              className={`tmCard${i === 0 ? ' vanguard' : ''}${dead ? ' dead' : ''}${d?.id === m.id && dragging ? ' dragging' : ''}`}
              style={{ '--gl': color }}
              onPointerDown={(e) => onPointerDown(e, m.id)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
              title={onSelect ? `${m.name} — tap for details, drag to reorder` : m.name}>
              <CardBody m={m} i={i} color={color} />
              {onRemove && <button className="tmRm" title="Remove from team" onClick={() => onRemove(m.id)}>✕</button>}
            </div>
          );
        })}
      </div>
      <p className="tmHint"><Icon icon="game-icons:move" /> Drag a card to reorder — the ★ slot is your Active Vanguard. Tap for details.</p>

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
