// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/SelectScreen — assemble your TEAM (up to 3 creatures). The   ║
// ║ chosen team is used for BOTH roguelike runs and the combat playtest.     ║
// ║ The top shows the current team split into the Active Vanguard (first     ║
// ║ pick) and the Bench; the grid below toggles membership. Pick order sets  ║
// ║ the vanguard; any bench member can be promoted. Returns the ORDERED      ║
// ║ creatures (index 0 = vanguard).                                          ║
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

/** A small team-slot portrait (vanguard or bench) with remove + promote. */
function TeamSlot({ c, role, onRemove, onPromote }) {
  const color = creatureColor(c);
  return (
    <div className={`teamSlot ${role}`} style={{ '--gl': color }}>
      <div className="tsArt">
        {c.meta?.portrait ? <img src={c.meta.portrait} alt="" />
          : <iconify-icon icon={creatureIcon(c)} style={{ color }}></iconify-icon>}
      </div>
      <div className="tsName">{c.name}</div>
      <div className="tsRole">{role === 'vanguard' ? '★ Vanguard' : 'Bench'}</div>
      <div className="tsBtns">
        {onPromote && <button className="tsBtn" title="Make Vanguard" onClick={onPromote}>★</button>}
        <button className="tsBtn rm" title="Remove" onClick={onRemove}>✕</button>
      </div>
    </div>
  );
}

export default function SelectScreen({ roster = [], initial = [], onConfirm, onCancel }) {
  // Ordered list of ids; index 0 = vanguard. Seed from the saved team.
  const [picked, setPicked] = useState(() => initial.filter((id) => roster.some((c) => c.id === id)).slice(0, MAX));
  const [teamOpen, setTeamOpen] = useState(true);
  const byId = (id) => roster.find((c) => c.id === id);
  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length < MAX ? [...p, id] : p));
  const remove = (id) => setPicked((p) => p.filter((x) => x !== id));
  const promote = (id) => setPicked((p) => [id, ...p.filter((x) => x !== id)]);

  const teamCreatures = picked.map(byId).filter(Boolean);
  const vanguard = teamCreatures[0] || null;
  const bench = teamCreatures.slice(1);

  return (
    <div className="selScreen">
      <header className="selHead">
        <h1>Assemble Your Team</h1>
        <p>Choose up to {MAX} creatures — they fight as an Active Vanguard + a bench you swap between. This team is used for your runs <b>and</b> playtest fights.</p>

        {/* Current team, split vanguard vs bench — collapsible to free up grid room */}
        <button className="teamToggle" onClick={() => setTeamOpen((v) => !v)} aria-expanded={teamOpen}>
          <span className="teamToggleLbl">Your Team</span>
          {!teamOpen && (
            <span className="teamMini">
              {vanguard ? <span className="tmTag van">★ {vanguard.name}</span> : <span className="tmTag none">empty</span>}
              {bench.map((c) => <span key={c.id} className="tmTag">{c.name}</span>)}
            </span>
          )}
          <span className="teamChevron">{teamOpen ? '▾' : '▸'}</span>
        </button>
        {teamOpen && (
          <div className="teamBar">
            <div className="teamGroup">
              <div className="teamLbl">Vanguard</div>
              {vanguard
                ? <TeamSlot c={vanguard} role="vanguard" onRemove={() => remove(vanguard.id)} />
                : <div className="teamEmpty">Pick a creature →</div>}
            </div>
            <div className="teamGroup grow">
              <div className="teamLbl">Bench ({bench.length}/{MAX - 1})</div>
              <div className="teamBench">
                {bench.length === 0 && <div className="teamEmpty">No bench yet.</div>}
                {bench.map((c) => (
                  <TeamSlot key={c.id} c={c} role="bench" onRemove={() => remove(c.id)} onPromote={() => promote(c.id)} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="selActions">
          <span className="selCount">{picked.length} / {MAX} chosen</span>
          {onCancel && <button className="selBtn ghost" onClick={onCancel}>Back</button>}
          <button className="selBtn go" disabled={picked.length === 0}
            onClick={() => onConfirm?.(teamCreatures)}>
            Save Team ✓
          </button>
        </div>
      </header>

      <div className="selGrid">
        {roster.map((c) => {
          const att = c.attunement?.[0];
          const order = picked.indexOf(c.id);
          const chosen = order >= 0;
          const color = creatureColor(c);
          return (
            <button key={c.id} className={`selCard${chosen ? ' chosen' : ''}`} onClick={() => toggle(c.id)}
              style={{ borderColor: chosen ? color : undefined }}>
              <div className="selArt" style={{ '--gl': color }}>
                {c.meta?.portrait
                  ? <img src={c.meta.portrait} alt="" />
                  : <iconify-icon class="selIcon" icon={creatureIcon(c)} style={{ color }}></iconify-icon>}
                {chosen && <span className="selPick">{order === 0 ? '★' : order + 1}</span>}
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
