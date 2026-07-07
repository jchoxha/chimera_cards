// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/SelectScreen — assemble your TEAM (up to 3 creatures). The   ║
// ║ chosen team is used for BOTH roguelike runs and the combat playtest.     ║
// ║ The top shows the current team split into the Active Vanguard (first     ║
// ║ pick) and the Bench; the grid below toggles membership. Pick order sets  ║
// ║ the vanguard; any bench member can be promoted. Returns the ORDERED      ║
// ║ creatures (index 0 = vanguard).                                          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState, useEffect, useRef } from 'react';
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
import { CreatureFilterBar, matchesFilter, emptyFilter, SORT_OPTIONS, sortCreatures } from './CreatureFilter.jsx';
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

const MAX = 6;
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
  roster = [], initial = [], onConfirm, onTeamChange, onReorderRoster, onCancel, onDeleteCustom, onRename,
  title = 'Collection',
  intro = 'Your captured creatures. Drag a creature onto your team (or tap to open it). Team = up to 6, fighting as an Active Vanguard + a bench you swap between.',
  confirmLabel = 'Save Team ✓', teamLabel = 'Your Team',
} = {}) {
  const [filter, setFilter] = useState(emptyFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState('custom');
  const facetFiltered = roster.filter((c) => matchesFilter(c, filter));
  const shown = sortCreatures(facetFiltered, sort);
  const activeFilterCount = Object.values(filter.sets || {}).reduce((n, s) => n + (s?.size || 0), 0);
  // Ordered list of ids; index 0 = vanguard. Seed from the saved team.
  const [picked, setPicked] = useState(() => initial.filter((id) => roster.some((c) => c.id === id)).slice(0, MAX));
  const [teamOpen, setTeamOpen] = useState(true);

  // ── Auto-save: whenever the team changes, persist it live (no Save button). ──
  const teamChangeRef = useRef(onTeamChange);
  teamChangeRef.current = onTeamChange;
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) { firstSync.current = false; return; }  // skip the seed
    teamChangeRef.current?.(picked.map((id) => roster.find((c) => c.id === id)).filter(Boolean));
  }, [picked]);
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
  const addToTeam = (id) => setPicked((p) => (p.includes(id) ? p : (p.length < MAX ? [...p, id] : p)));
  const remove = (id) => setPicked((p) => p.filter((x) => x !== id));
  const promote = (id) => setPicked((p) => [id, ...p.filter((x) => x !== id)]);

  // ── Drag a collection card → onto the team sidebar (add) or another card
  //    (reorder the collection, when sorted by "Collection order"). ──
  const drag = useRef(null);                    // { id, x, y, startX, startY, moved }
  const [dragState, setDragState] = useState(null);
  const DRAG_THRESHOLD = 6;
  const reorderCollection = (movingId, targetId) => {
    if (!onReorderRoster || movingId === targetId) return;
    const ids = roster.map((c) => c.id);
    const from = ids.indexOf(movingId); const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(ids.indexOf(targetId) + (to > from ? 1 : 0), 0, movingId);
    onReorderRoster(ids);
  };
  useEffect(() => {
    if (!dragState) return undefined;
    const onMove = (e) => {
      const g = drag.current; if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > DRAG_THRESHOLD) g.moved = true;
      let over = null;
      if (g.moved) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el?.closest('.teamSide')) over = 'team';
        else { const card = el?.closest('[data-cid]'); if (card && card.dataset.cid !== g.id) over = card.dataset.cid; }
      }
      g.over = over;                                  // persist on the ref so onUp sees it
      setDragState({ ...g, over });
    };
    const onUp = () => {
      const g = drag.current; drag.current = null;
      const over = g?.over;
      setDragState(null);
      if (!g) return;
      if (!g.moved) { setModalId(g.id); return; }         // a tap → open the creature
      if (over === 'team') addToTeam(g.id);
      else if (over && sort === 'custom') reorderCollection(g.id, over);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragState?.id, sort]);
  const onCardPointerDown = (e, id) => {
    if (e.button != null && e.button !== 0) return;
    drag.current = { id, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, over: null };
    setDragState({ ...drag.current });
  };

  const teamCreatures = picked.map(byId).filter(Boolean);
  const draggedCreature = dragState?.moved ? byId(dragState.id) : null;

  const dragging = !!draggedCreature;

  return (
    <div className={`selScreen${dragging ? ' dragging' : ''}`}>
      <header className="selHead compact">
        <div className="selHeadRow">
          <div className="selTitleWrap">
            <h1>{title}</h1>
            <p className="selIntro">{intro}</p>
          </div>
          <div className="selActions">
            <span className="selCount">{picked.length} / {MAX}</span>
            {onCancel && <button className="selBtn ghost" onClick={onCancel}>{onConfirm ? 'Back' : 'Done'}</button>}
            {onConfirm && (
              <button className="selBtn go" disabled={picked.length === 0}
                onClick={() => onConfirm(teamCreatures)}>
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="selMain">
        {/* ── LEFT TEAM SIDEBAR — vertical, completely hideable (also a drop target) ── */}
        <aside className={`teamSide${teamOpen ? '' : ' collapsed'}${dragging ? ' dropTarget' : ''}${dragState?.over === 'team' ? ' dropHot' : ''}`}>
          {teamOpen ? (
            <>
              <div className="teamSideHead">
                <span className="teamSideLbl">{teamLabel} <em>{picked.length}/{MAX}</em></span>
                <button className="teamSideBtn" title="Hide team" onClick={() => setTeamOpen(false)}>
                  <Icon icon="game-icons:contract-left-arrow" />
                </button>
              </div>
              <div className="teamSideBody">
                {teamCreatures.length === 0
                  ? <div className="teamEmpty">{dragging ? 'Drop here to add to your team' : 'No team yet. Drag creatures here (or tap one to add), then drag to set your Vanguard.'}</div>
                  : <TeamManager members={teamCreatures} title="" vertical onReorder={setPicked}
                      onRemove={(id) => remove(id)} onSelect={(m) => setModalId(m.id)} />}
              </div>
            </>
          ) : (
            <button className="teamSideOpen" title="Show your team" onClick={() => setTeamOpen(true)}>
              <Icon icon="game-icons:expand-right-arrow" />
              <span className="tsoLbl">{teamLabel}</span>
              <span className="tsoCount">{picked.length}</span>
            </button>
          )}
        </aside>

        {/* ── COLLECTION GRID — gets the bulk of the space ── */}
        <section className="selBody">
          <div className="selToolbar">
            <div className="selSearchWrap">
              <Icon icon="game-icons:magnifying-glass" className="selSearchIcon" />
              <input className="selSearch" placeholder="Search your collection…" value={filter.q || ''}
                onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
              {filter.q && <button className="selSearchX" title="Clear" onClick={() => setFilter((f) => ({ ...f, q: '' }))}>✕</button>}
            </div>
            {roster.length > 4 && (
              <button className={`selBtn ghost selToolBtn${filtersOpen ? ' on' : ''}`}
                onClick={() => { setFiltersOpen((v) => !v); setSortOpen(false); }}>
                <Icon icon="game-icons:filter" /> Filters
                {activeFilterCount > 0 && <span className="selToolN">{activeFilterCount}</span>}
              </button>
            )}
            <div className="selSortWrap">
              <button className={`selBtn ghost selToolBtn${sortOpen ? ' on' : ''}${sort !== 'custom' ? ' active' : ''}`}
                onClick={() => { setSortOpen((v) => !v); setFiltersOpen(false); }}>
                <Icon icon="game-icons:list-squares" /> Sort
              </button>
              {sortOpen && (
                <div className="selSortMenu uiPanel">
                  {SORT_OPTIONS.map((o) => (
                    <button key={o.key} className={`selSortItem${sort === o.key ? ' on' : ''}`}
                      onClick={() => { setSort(o.key); setSortOpen(false); }}>
                      {sort === o.key ? '● ' : ''}{o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="selShown">{shown.length} creature{shown.length === 1 ? '' : 's'}</span>
          </div>

          {filtersOpen && roster.length > 4 && (
            <div className="selFilter"><CreatureFilterBar creatures={roster} filter={filter} onChange={setFilter} hideSearch /></div>
          )}

          <div className="selGrid">
            {shown.length === 0 && <div className="selNoMatch uiHint">No creatures match your search.</div>}
            {shown.map((c) => {
              const order = picked.indexOf(c.id);
              const chosen = order >= 0;
              const color = creatureColor(c);
              // THE creature card — the same CardFace used in combat. Drag it onto the
              // team (add) or another card (reorder); tap opens its modal.
              return (
                <div key={c.id} data-cid={c.id} role="button" tabIndex={0}
                  className={`selCardWrap modalCardWrap${chosen ? ' chosen' : ''}${dragState?.id === c.id && dragging ? ' dragSrc' : ''}${dragState?.over === c.id ? ' dropOver' : ''}`}
                  style={{ '--gl': color, touchAction: 'none' }}
                  onPointerDown={(e) => onCardPointerDown(e, c.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalId(c.id); } }}>
                  <CardFace f={toFace(c)} side="ally" />
                  {chosen && <span className="selPick">{order === 0 ? '★' : order + 1}</span>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* the floating drag ghost — a faithful card copy tracking the cursor */}
      {dragging && draggedCreature && (
        <div className="selDragGhost" style={{ left: dragState.x, top: dragState.y, '--gl': creatureColor(draggedCreature) }}>
          <div className="selCardWrap modalCardWrap"><CardFace f={toFace(draggedCreature)} side="ally" /></div>
        </div>
      )}

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
                  {onRename && c.iid && (
                    <label className="selNick">
                      <span>Nickname</span>
                      <input value={c.nickname || ''} placeholder={c.speciesName || c.name}
                        maxLength={24}
                        onChange={(e) => onRename(c.iid, e.target.value)} />
                    </label>
                  )}
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
                          {picked.length >= MAX ? `Team full (max ${MAX})` : 'Add to Team'}
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
