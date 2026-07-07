// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/SelectScreen — assemble your TEAM (up to 3 creatures). The   ║
// ║ chosen team is used for BOTH roguelike runs and the combat playtest.     ║
// ║ The top shows the current team split into the Active Vanguard (first     ║
// ║ pick) and the Bench; the grid below toggles membership. Pick order sets  ║
// ║ the vanguard; any bench member can be promoted. Returns the ORDERED      ║
// ║ creatures (index 0 = vanguard).                                          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { creatureColor } from '../data/axisIcons.js';
import { CardFace, creatureToFace as toFace } from '../ui/combat/creatureVisuals.jsx';
import MoveCard from '../ui/combat/MoveCard.jsx';
import MonsterPage from '../ui/MonsterPage.jsx';
import TeamManager from '../ui/TeamManager.jsx';
import { AXIS_INFO, EFFECT_INFO, ATTUNEMENT_SIGNATURE } from '../data/codex.js';
import { REACTIONS } from '../engine/cards/reactions.js';
import { factorInfo } from '../data/factorInfo.js';
import { RARITY_POINTS } from '../engine/types.js';
import { potentialPool } from './pools.js';
import '../ui/combat/combat.css';
import './select.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

/** A creature's FULL potential card pool (kit + subtypes + attunement + variants),
 *  sorted up the rarity ladder so the browse reads basic → godly. */
function fullPool(c) {
  const pool = potentialPool(c);
  const seen = new Set();
  const uniq = pool.filter((card) => { if (seen.has(card.id)) return false; seen.add(card.id); return true; });
  return uniq.sort((a, b) => (RARITY_POINTS[a.rarity] ?? 1) - (RARITY_POINTS[b.rarity] ?? 1) || String(a.name).localeCompare(String(b.name)));
}

const MAX = 3;
const STAT_LABEL = { might: 'MGT', guard: 'GRD', focus: 'FOC', resolve: 'RSV', speed: 'SPD' };

/** Tabbed card browser (Starting Deck / Full Card Pool), grouped up the rarity ladder. */
function CardBrowser({ deck = [], pool = [] }) {
  const [tab, setTab] = useState('deck');
  const cards = tab === 'deck' ? deck : pool;
  const byRarity = new Map();
  for (const c of cards) { const r = c.rarity || 'common'; if (!byRarity.has(r)) byRarity.set(r, []); byRarity.get(r).push(c); }
  const groups = [...byRarity.entries()].sort((a, b) => (RARITY_POINTS[a[0]] ?? 1) - (RARITY_POINTS[b[0]] ?? 1));
  return (
    <div className="cardBrowser">
      <div className="cbTabs">
        <button className={`cbTab${tab === 'deck' ? ' on' : ''}`} onClick={() => setTab('deck')}>
          <iconify-icon icon="game-icons:card-pickup"></iconify-icon> Starting Deck <em>{deck.length}</em>
        </button>
        <button className={`cbTab${tab === 'pool' ? ' on' : ''}`} onClick={() => setTab('pool')}>
          <iconify-icon icon="game-icons:card-random"></iconify-icon> Full Card Pool <em>{pool.length}</em>
        </button>
      </div>
      <div className="cbBody">
        {cards.length === 0 && <div className="cbEmpty">{tab === 'deck' ? 'Auto-generated from its typings.' : 'No pool — this creature has no kit sources yet.'}</div>}
        {groups.map(([rarity, list]) => (
          <div className="cbGroup" key={rarity}>
            <div className="cbRarity"><span className={`cbDot r-${rarity}`} />{rarity} <em>{list.length}</em></div>
            <div className="cbGrid">
              {list.map((c, i) => <MoveCard key={`${c.id}-${i}`} c={c} />)}
            </div>
          </div>
        ))}
        {tab === 'pool' && cards.length > 0 && (
          <p className="cbHint">Everything this creature can learn — from its body, kit factors, subtypes and element. Rewards and shops draw from this pool.</p>
        )}
      </div>
    </div>
  );
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
          const order = picked.indexOf(c.id);
          const chosen = order >= 0;
          const color = creatureColor(c);
          // THE creature card — the same CardFace used in combat (no custom tile).
          return (
            <div key={c.id} role="button" tabIndex={0}
              className={`selCardWrap modalCardWrap${chosen ? ' chosen' : ''}`}
              style={{ '--gl': color }}
              onClick={() => setModalId(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setModalId(c.id); }}>
              <CardFace f={toFace(c)} side="ally" />
              {chosen && <span className="selPick">{order === 0 ? '★' : order + 1}</span>}
            </div>
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
            <div className="selModal big" onClick={(e) => e.stopPropagation()}>
              <button className="selModalClose" onClick={() => setModalId(null)}>✕</button>
              <div className="selModalCols">
                <div className="selModalLeft">
                  <div className="modalCardWrap">
                    <CardFace f={toFace(c)} side="ally"
                      onInfo={(info) => {
                        if (info.kind === 'axis') setSelInfo(info);
                        else if (info.kind === 'effect') setSelInfo({ kind: 'effect', id: info.id });
                        else if (info.kind === 'factor') setSelInfo(info);
                      }}
                      onName={() => setBestiaryId(c.id)} />
                  </div>
                  {c.blurb && <p className="selLore">{c.blurb}</p>}
                  <div className="selStats center">
                    <span className="selHp" title="Max HP">❤ {c.maxHp}</span>
                    {Object.entries(STAT_LABEL).map(([k, lbl]) => (
                      <span key={k} className="selStat" title={k}>{lbl} {c.stats?.[k] ?? (k === 'speed' ? 0 : 1)}</span>
                    ))}
                  </div>
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
                    <button className="selBtn ghost" onClick={() => setBestiaryId(c.id)}>📖 Bestiary</button>
                    <button className="selBtn ghost" onClick={() => exportCreature(c)}>⤓ Export</button>
                    {c.custom && onDeleteCustom && (
                      <button className="selBtn rm" onClick={() => { if (confirm(`Delete custom creature "${c.name}"?`)) { onDeleteCustom(c.id); remove(c.id); setModalId(null); } }}>🗑 Delete</button>
                    )}
                  </div>
                  <p className="selTapHint">Tap the name for its bestiary page · tap a kit icon for the moves it grants.</p>
                </div>
                <div className="selModalRight">
                  <CardBrowser deck={c.deck || []} pool={fullPool(c)} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Nested axis / status / factor info popup (over the creature modal) */}
      {selInfo && (() => {
        if (selInfo.kind === 'factor') {
          const fi = factorInfo(selInfo.tag);
          return (
            <div className="selModalWrap" style={{ zIndex: 70 }} onClick={() => setSelInfo(null)}>
              <div className="selInfoBox wide" onClick={(ev) => ev.stopPropagation()}>
                <button className="selModalClose" onClick={() => setSelInfo(null)}>✕</button>
                <h3><Icon icon={fi?.icon || 'game-icons:paw-print'} /> {selInfo.tag} <span className="selKind">{fi?.kindLabel || ''}</span></h3>
                <p>{fi?.theme || 'No details for this trait yet.'}</p>
                {fi?.cards?.length > 0 && (
                  <>
                    <div className="cbGrid">{fi.cards.map((cc) => <MoveCard key={cc.id} c={cc} />)}</div>
                    <p className="cbHint">These moves join the creature’s card pool because of this {fi.kind === 'weapon' ? 'weapon' : 'trait'}.</p>
                  </>
                )}
              </div>
            </div>
          );
        }
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
