// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/TeamManager — view + reorder the team (Active Vanguard +     ║
// ║ bench) by DRAG-AND-DROP. Shared by the team assembler AND the run        ║
// ║ (between combats). The FIRST member is the Vanguard; reordering returns  ║
// ║ the new id order via onReorder. Optional onRemove / onSelect.            ║
// ║ Pointer-based drag so it works with mouse AND touch.                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useRef, useState } from 'react';
import { creatureIcon, creatureColor } from '../data/axisIcons.js';
import './teamManager.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

export default function TeamManager({ members = [], onReorder, onRemove, onSelect, title = 'Your Team' }) {
  const ids = members.map((m) => m.id);
  const listRef = useRef(null);
  const drag = useRef(null);                 // { id, fromY }
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const reorderTo = (movingId, targetId) => {
    if (!movingId || movingId === targetId) return;
    const cur = ids.slice();
    const from = cur.indexOf(movingId);
    let to = targetId ? cur.indexOf(targetId) : cur.length - 1;
    if (from < 0 || to < 0) return;
    cur.splice(from, 1);
    cur.splice(to, 0, movingId);
    onReorder && onReorder(cur);
  };

  const rowIdAt = (clientY) => {
    const el = listRef.current; if (!el) return null;
    for (const row of el.querySelectorAll('[data-tmid]')) {
      const r = row.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return row.getAttribute('data-tmid');
    }
    // above the first / below the last
    const rows = [...el.querySelectorAll('[data-tmid]')];
    if (!rows.length) return null;
    if (clientY < rows[0].getBoundingClientRect().top) return rows[0].getAttribute('data-tmid');
    return rows[rows.length - 1].getAttribute('data-tmid');
  };

  function onPointerDown(e, id) {
    if (e.target.closest('.tmBtn, .tmCrest')) return;     // let buttons/crest work
    drag.current = { id };
    setDragId(id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    const target = rowIdAt(e.clientY);
    setOverId(target);
    if (target && target !== drag.current.id) { reorderTo(drag.current.id, target); }
  }
  function onPointerUp() { drag.current = null; setDragId(null); setOverId(null); }

  if (!members.length) return <div className="tmEmpty">No creatures yet.</div>;

  return (
    <div className="teamMgr">
      {title && <div className="tmTitle">{title}</div>}
      <div className="tmList" ref={listRef}>
        {members.map((m, i) => {
          const color = creatureColor(m);
          const dead = m.hp != null && m.hp <= 0;
          const pct = m.maxHp ? Math.max(0, (m.hp / m.maxHp) * 100) : 100;
          return (
            <div key={m.id} data-tmid={m.id} draggable={false} onDragStart={(e) => e.preventDefault()}
              className={`tmRow${i === 0 ? ' vanguard' : ''}${dead ? ' dead' : ''}${dragId === m.id ? ' dragging' : ''}${overId === m.id && dragId && dragId !== m.id ? ' over' : ''}`}
              style={{ '--gl': color }}
              onPointerDown={(e) => onPointerDown(e, m.id)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
              <span className="tmGrip" title="Drag to reorder"><Icon icon="game-icons:move" /></span>
              <span className="tmPos">{i === 0 ? <Icon icon="game-icons:star-formation" /> : i + 1}</span>
              <button className="tmCrest" onClick={onSelect ? () => onSelect(m) : undefined} title={onSelect ? `${m.name} — details` : m.name}>
                {m.meta?.portrait || m.portrait
                  ? <img src={m.meta?.portrait || m.portrait} alt="" draggable={false} />
                  : <Icon icon={creatureIcon(m)} style={{ color }} />}
              </button>
              <div className="tmInfo">
                <b>{m.name}</b>
                <span className="tmRole">{i === 0 ? 'Active Vanguard' : 'Bench'}</span>
                {m.hp != null && m.maxHp != null && (
                  <div className="tmHp"><i style={{ width: `${pct}%` }} /><em>{m.hp}/{m.maxHp}</em></div>
                )}
              </div>
              {onRemove && <button className="tmBtn rm" title="Remove" onClick={() => onRemove(m.id)}>✕</button>}
            </div>
          );
        })}
      </div>
      <p className="tmHint"><Icon icon="game-icons:move" /> Drag a creature to reorder — the top slot is the Active Vanguard.</p>
    </div>
  );
}
