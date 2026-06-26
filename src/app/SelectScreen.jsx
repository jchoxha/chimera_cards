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
import { CardFace } from '../ui/combat/creatureVisuals.jsx';
import DeckDropdown from '../ui/combat/DeckDropdown.jsx';
import MonsterPage from '../ui/MonsterPage.jsx';
import TeamManager from '../ui/TeamManager.jsx';
import { AXIS_INFO, EFFECT_INFO, ATTUNEMENT_SIGNATURE } from '../data/codex.js';
import { REACTIONS } from '../engine/cards/reactions.js';
import '../ui/combat/combat.css';
import './select.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

/** Map a roster creature to the shape CardFace expects (a static, full-HP "fighter"). */
function toFace(c) {
  return {
    id: c.id, name: c.name, hp: c.maxHp, maxHp: c.maxHp, block: 0, statuses: [], powers: [],
    axes: { class: c.class, biology: c.biology, attunement: c.attunement },
    element: c.attunement?.[0] || null,
    types: (c.attunement || []).map((a) => ({ type: a, weight: 1 })),
    stats: c.stats, portrait: c.meta?.portrait ?? c.portrait ?? null,
    form: c.meta?.form ?? c.size ?? 'regular', rarity: 'common',
  };
}

const MAX = 3;
const STAT_LABEL = { might: 'MGT', guard: 'GRD', focus: 'FOC', resolve: 'RSV', speed: 'SPD' };

function Axis({ icon, label, color }) {
  return <span className="selAxis" title={label} style={color ? { color } : undefined}>
    <iconify-icon icon={icon}></iconify-icon> {label}
  </span>;
}

export default function SelectScreen({
  roster = [], initial = [], onConfirm, onCancel, onCreateCustom, onDeleteCustom,
  title = 'Assemble Your Team',
  intro = 'Choose up to 3 creatures — they fight as an Active Vanguard + a bench you swap between. This team is used for your runs and playtest fights.',
  confirmLabel = 'Save Team ✓', teamLabel = 'Your Team',
} = {}) {
  // Ordered list of ids; index 0 = vanguard. Seed from the saved team.
  const [picked, setPicked] = useState(() => initial.filter((id) => roster.some((c) => c.id === id)).slice(0, MAX));
  const [teamOpen, setTeamOpen] = useState(true);
  const [modalId, setModalId] = useState(null);   // creature whose modal is open
  const [bestiaryId, setBestiaryId] = useState(null); // creature whose codex page is open
  const [selInfo, setSelInfo] = useState(null);   // nested axis/status info popup
  const byId = (id) => roster.find((c) => c.id === id);
  const exportCreature = (c) => {
    const def = { id: c.id, name: c.name, class: c.class, biology: c.biology, attunement: c.attunement, lore: c.lore, description: c.description, blurb: c.blurb };
    const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${(c.name || 'creature').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.creature.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length < MAX ? [...p, id] : p));
  const remove = (id) => setPicked((p) => p.filter((x) => x !== id));
  const promote = (id) => setPicked((p) => [id, ...p.filter((x) => x !== id)]);

  const teamCreatures = picked.map(byId).filter(Boolean);
  const vanguard = teamCreatures[0] || null;
  const bench = teamCreatures.slice(1);

  return (
    <div className="selScreen">
      <header className="selHead">
        <h1>{title}</h1>
        <p>{intro}</p>

        {/* Current team, split vanguard vs bench — collapsible to free up grid room */}
        <button className="teamToggle" onClick={() => setTeamOpen((v) => !v)} aria-expanded={teamOpen}>
          <span className="teamToggleLbl">{teamLabel}</span>
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
            {teamCreatures.length === 0
              ? <div className="teamEmpty">Pick a creature below →</div>
              : <TeamManager members={teamCreatures} title="" onReorder={setPicked}
                  onRemove={(id) => remove(id)} onSelect={(m) => setModalId(m.id)} />}
          </div>
        )}

        <div className="selActions">
          <span className="selCount">{picked.length} / {MAX} chosen</span>
          {onCancel && <button className="selBtn ghost" onClick={onCancel}>Back</button>}
          <button className="selBtn go" disabled={picked.length === 0}
            onClick={() => onConfirm?.(teamCreatures)}>
            {confirmLabel}
          </button>
        </div>
      </header>

      <div className="selGrid">
        {onCreateCustom && (
          <button className="selCard selCreate" onClick={onCreateCustom}>
            <div className="selCreatePlus">＋</div>
            <div className="selName">Create Custom Creature</div>
            <div className="selBlurb">Pick its archetype, biology &amp; element, then auto-generate or hand-build its deck.</div>
          </button>
        )}
        {roster.map((c) => {
          const att = c.attunement?.[0];
          const order = picked.indexOf(c.id);
          const chosen = order >= 0;
          const color = creatureColor(c);
          return (
            <button key={c.id} className={`selCard${chosen ? ' chosen' : ''}`} onClick={() => setModalId(c.id)}
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

      {/* Creature modal — the same CardFace as combat, plus add/remove + a deck dropdown. */}
      {modalId && (() => {
        const c = byId(modalId); if (!c) return null;
        const inTeam = picked.includes(c.id);
        const isVan = picked[0] === c.id;
        return (
          <div className="selModalWrap" onClick={() => setModalId(null)}>
            <div className="selModal" onClick={(e) => e.stopPropagation()}>
              <button className="selModalClose" onClick={() => setModalId(null)}>✕</button>
              <div className="modalCardWrap">
                <CardFace f={toFace(c)} side="ally"
                  onInfo={(info) => { if (info.kind === 'axis') setSelInfo(info); else if (info.kind === 'effect') setSelInfo({ kind: 'effect', id: info.id }); }}
                  onName={() => setBestiaryId(c.id)} />
              </div>
              <DeckDropdown cards={c.deck || []} label="Deck" empty="Auto-generated from its typings." />
              <div className="selModalActions">
                {inTeam
                  ? <>
                      {!isVan && <button className="selBtn" onClick={() => { promote(c.id); }}>★ Make Vanguard</button>}
                      <button className="selBtn rm" onClick={() => { remove(c.id); setModalId(null); }}>Remove from Team</button>
                    </>
                  : <button className="selBtn go" disabled={picked.length >= MAX}
                      onClick={() => { toggle(c.id); setModalId(null); }}>
                      {picked.length >= MAX ? 'Team full (max 3)' : 'Add to Team'}
                    </button>}
              </div>
              <div className="selModalSub">
                <button className="selBtn ghost" onClick={() => setBestiaryId(c.id)}>📖 Bestiary page</button>
                <button className="selBtn ghost" onClick={() => exportCreature(c)}>⤓ Export</button>
                {c.custom && onDeleteCustom && (
                  <button className="selBtn rm" onClick={() => { if (confirm(`Delete custom creature "${c.name}"?`)) { onDeleteCustom(c.id); remove(c.id); setModalId(null); } }}>🗑 Delete</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Nested axis / status info popup (over the creature modal) */}
      {selInfo && (() => {
        if (selInfo.kind === 'effect') {
          const e = EFFECT_INFO[selInfo.id] || { name: selInfo.id, icon: 'game-icons:hazard-sign', desc: '' };
          return (
            <div className="selModalWrap" style={{ zIndex: 70 }} onClick={() => setSelInfo(null)}>
              <div className="selInfoBox" onClick={(ev) => ev.stopPropagation()}>
                <button className="selModalClose" onClick={() => setSelInfo(null)}>✕</button>
                <h3><Icon icon={e.icon} /> {e.name}</h3><p>{e.desc}</p>
              </div>
            </div>
          );
        }
        const vals = Array.isArray(selInfo.value) ? selInfo.value : [selInfo.value].filter(Boolean);
        const head = AXIS_INFO[selInfo.axis] || { name: selInfo.axis, desc: '' };
        return (
          <div className="selModalWrap" style={{ zIndex: 70 }} onClick={() => setSelInfo(null)}>
            <div className="selInfoBox" onClick={(ev) => ev.stopPropagation()}>
              <button className="selModalClose" onClick={() => setSelInfo(null)}>✕</button>
              <h3>{head.name}: {vals.join(' / ') || '—'}</h3>
              <p>{head.desc}</p>
              {selInfo.axis === 'attunement' && vals.map((v) => (
                <p key={v} className="selInfoSig">
                  <b>{v}</b> signature: {ATTUNEMENT_SIGNATURE[v] || '—'}
                  {REACTIONS[v] ? ` · triggers ${Object.values(REACTIONS[v]).map((cell) => cell.verb).join(', ')}` : ''}
                </p>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bestiary (codex) page for a creature — opens over the creature modal. */}
      {bestiaryId && (() => {
        const c = byId(bestiaryId); if (!c) return null;
        return (
          <div className="selModalWrap" style={{ zIndex: 60 }} onClick={() => setBestiaryId(null)}>
            <div className="selModal wide" onClick={(e) => e.stopPropagation()}>
              <button className="selModalClose" onClick={() => setBestiaryId(null)}>✕</button>
              <MonsterPage creature={c} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
