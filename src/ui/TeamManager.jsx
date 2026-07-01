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

  const reorderTo = (movingId, targetId) => {
    if (!movingId || movingId === targetId) return;
    const cur = ids.slice();
    const from = cur.indexOf(movingId);
    const to = cur.indexOf(targetId);
    if (from < 0 || to < 0) return;
    cur.splice(from, 1);
    cur.splice(to, 0, movingId);
    onReorder && onReorder(cur);
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
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dz = el && el.closest ? el.closest('[data-tmid]') : null;
      g.overId = dz ? dz.getAttribute('data-tmid') : null;
      // LIVE reorder: as the ghost passes over another card, slot the dragged card
      // there so the row reflows (FLIP animates the slide). Guard against re-firing
      // on the same target each frame.
      if (g.overId && g.overId !== g.id && g.overId !== g.lastOver) {
        g.lastOver = g.overId;
        reorderTo(g.id, g.overId);
      } else if (!g.overId) {
        g.lastOver = null;
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
