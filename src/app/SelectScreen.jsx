// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/SelectScreen — pick up to 3 creatures from the roster to    ║
// ║ start a run. Shows each creature's archetype/biology/attunement + its    ║
// ║ stat line + flavor. Art = the creature's AI portrait (meta.portrait)     ║
// ║ when present, else the biology/attunement icon placeholder.              ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../data/axisIcons.js';
import './select.css';

const MAX = 3;
const STAT_LABEL = { might: 'MGT', guard: 'GRD', focus: 'FOC', resolve: 'RSV', speed: 'SPD' };

function Axis({ icon, label, color }) {
  return <span className="selAxis" title={label} style={color ? { color } : undefined}>
    <iconify-icon icon={icon}></iconify-icon> {label}
  </span>;
}

export default function SelectScreen({ roster = [], onConfirm, onCancel }) {
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length < MAX ? [...p, id] : p));

  return (
    <div className="sel">
      <header className="selHead">
        <h1>Assemble Your Team</h1>
        <p>Choose up to {MAX} creatures — they fight as an Active Vanguard + bench you can swap between.</p>
        <div className="selActions">
          <span className="selCount">{picked.length} / {MAX} chosen</span>
          {onCancel && <button className="selBtn ghost" onClick={onCancel}>Back</button>}
          <button className="selBtn go" disabled={picked.length === 0}
            onClick={() => onConfirm?.(roster.filter((c) => picked.includes(c.id)))}>
            Begin the Descent →
          </button>
        </div>
      </header>

      <div className="selGrid">
        {roster.map((c) => {
          const att = c.attunement?.[0];
          const chosen = picked.includes(c.id);
          const color = creatureColor(c);
          return (
            <button key={c.id} className={`selCard${chosen ? ' chosen' : ''}`} onClick={() => toggle(c.id)}
              style={{ borderColor: chosen ? color : undefined }}>
              <div className="selArt" style={{ '--gl': color }}>
                {c.meta?.portrait
                  ? <img src={c.meta.portrait} alt="" />
                  : <iconify-icon class="selIcon" icon={creatureIcon(c)} style={{ color }}></iconify-icon>}
                {chosen && <span className="selPick">✓</span>}
              </div>
              <div className="selName">{c.name}</div>
              <div className="selAxes">
                <Axis icon={ARCHETYPE_ICON[c.class?.[0]] || 'game-icons:rosa-shield'} label={c.class?.[0]} />
                <Axis icon={BIOLOGY_ICON[c.biology?.[0]] || 'game-icons:paw-print'} label={c.biology?.[0]} />
                <Axis icon={ATTUNEMENT_ICON[att] || 'game-icons:sparkles'} label={att} color={ATTUNEMENT_COLOR[att]} />
              </div>
              <div className="selBlurb">{c.blurb}</div>
              <div className="selStats">
                <span className="selHp" title="Max HP">❤ {c.maxHp}</span>
                {Object.entries(STAT_LABEL).map(([k, lbl]) => (
                  <span key={k} className="selStat" title={k}>{lbl} {c.stats?.[k] ?? (k === 'speed' ? 0 : 1)}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
