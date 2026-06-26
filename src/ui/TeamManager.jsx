// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/TeamManager — view + reorder the team (Active Vanguard +     ║
// ║ bench). Shared by the team assembler AND the run (between combats), so   ║
// ║ players arrange positions the same way everywhere. The FIRST member is   ║
// ║ the Vanguard; reordering returns the new id order via onReorder.         ║
// ║ Optional onRemove / onSelect for the assembler.                          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';
import { creatureIcon, creatureColor } from '../data/axisIcons.js';
import './teamManager.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

export default function TeamManager({ members = [], onReorder, onRemove, onSelect, title = 'Your Team' }) {
  const ids = members.map((m) => m.id);
  const reorder = (next) => onReorder && onReorder(next);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  };
  const toVanguard = (i) => { if (i <= 0) return; const id = ids[i]; reorder([id, ...ids.filter((x) => x !== id)]); };

  if (!members.length) return <div className="tmEmpty">No creatures yet.</div>;

  return (
    <div className="teamMgr">
      {title && <div className="tmTitle">{title}</div>}
      <div className="tmList">
        {members.map((m, i) => {
          const color = creatureColor(m);
          const dead = m.hp != null && m.hp <= 0;
          const pct = m.maxHp ? Math.max(0, (m.hp / m.maxHp) * 100) : 100;
          return (
            <div key={m.id} className={`tmRow${i === 0 ? ' vanguard' : ''}${dead ? ' dead' : ''}`} style={{ '--gl': color }}>
              <span className="tmPos">{i === 0 ? <Icon icon="game-icons:star-formation" /> : i + 1}</span>
              <button className="tmCrest" onClick={onSelect ? () => onSelect(m) : undefined} title={onSelect ? `${m.name} — details` : m.name}>
                {m.meta?.portrait || m.portrait
                  ? <img src={m.meta?.portrait || m.portrait} alt="" />
                  : <Icon icon={creatureIcon(m)} style={{ color }} />}
              </button>
              <div className="tmInfo">
                <b>{m.name}</b>
                <span className="tmRole">{i === 0 ? 'Active Vanguard' : 'Bench'}</span>
                {m.hp != null && m.maxHp != null && (
                  <div className="tmHp"><i style={{ width: `${pct}%` }} /><em>{m.hp}/{m.maxHp}</em></div>
                )}
              </div>
              <div className="tmBtns">
                {i > 0 && <button className="tmBtn" title="Make Vanguard" onClick={() => toVanguard(i)}>★</button>}
                <button className="tmBtn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="tmBtn" title="Move down" disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
                {onRemove && <button className="tmBtn rm" title="Remove" onClick={() => onRemove(m.id)}>✕</button>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="tmHint">The ★ Vanguard fights first; the bench swaps in during combat.</p>
    </div>
  );
}
