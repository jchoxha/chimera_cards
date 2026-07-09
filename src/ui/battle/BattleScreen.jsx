// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/BattleScreen — the COMBAT-V2 shell. The BOARD is a real  ║
// ║ WebGL 3D scene (Board3D / react-three-fiber): creatures are textured card  ║
// ║ MESHES on a receding table, picked by RAYCAST (works on rotated meshes, so ║
// ║ tilted 3D cards stay exactly tappable on touch/mouse — what CSS rotateX    ║
// ║ could not do). This file owns the DOM chrome layered over the canvas: the  ║
// ║ hand/dock, the horizon turn/log bar, squad-nav arrows, and all overlays    ║
// ║ (card detail, pile inspect, combat log, fight confirm). The DOM hand-drag  ║
// ║ finds a 3D drop target via Board3D's raycast picker (pickRef).             ║
// ║ Top = enemy, bottom = friendly. Each creature is a compact BATTLE TOKEN   ║
// ║ (full-bleed art background + name + HP), NOT the full card. Front Vanguard ║
// ║ is CENTERED between its two rear Support. Selecting a squad is required    ║
// ║ before a token click opens the creature's FULL info card (the CardFace,   ║
// ║ enlarged). ACTION CARDS: tap to select, then click a target OR drag onto    ║
// ║ one to queue; double-tap (or tap a selected card) opens the enlarged card.  ║
// ║ Cards show cost·name, a corner attunement badge, art, a "(Scope) (Type)"    ║
// ║ line, and a priority pip; the fanned hand bumps apart on hover. A toggle     ║
// ║ SHOWS/HIDES the dock (hidden → the battlefield scales up). Fight CONFIRMS    ║
// ║ if any squad still has energy. The middle bar shows the TURN number and,    ║
// ║ during resolution, a combat-log ticker — click it for the full log.         ║
// ║ Fight plays the round back (auto-focus on the acting unit + HP tweens +     ║
// ║ floating numbers). Each side's field scrolls with EDGE buttons that focus   ║
// ║ the next squad, wrapping around. The card DOCK spans EVERY squad (yours      ║
// ║ interactive, the enemy's read-only: hand face-DOWN, piles inspectable,      ║
// ║ deck '?' until cards are seen).                                             ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useBattle } from '../../store/battleStore.js';
import Board3D from './Board3D.jsx';
import { CardFace, elementBadge } from '../combat/creatureVisuals.jsx';
import { ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import { cardArt } from '../../data/artPool.js';
import '../combat/combat.css';   // CardFace styling for the enlarged info card
import './battle.css';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The type line is "(Target Scope) (Attack/Skill/Power)". The attunement lives in the
// corner badge (same as creature cards), not in this line.
const SCOPE_WORD = { front: 'Vanguard', targeted: 'Targeted', squad: 'Squad', field: 'Field', self: 'Self' };
const scopeOf = (card) => card.scope || (card.reachesBack ? 'targeted' : 'front');
const isOffensiveCard = (card) => (card?.effects || []).some((e) => e.op === 'damage' || e.op === 'debuff');
function typeLine(card) {
  const word = SCOPE_WORD[scopeOf(card)] || 'Vanguard';
  return `${word} ${cap(card.type || 'Card')}`;
}
const SCOPE_ICON = { front: 'game-icons:spearhead', targeted: 'game-icons:convergence-target', squad: 'game-icons:group', field: 'game-icons:wide-arrow-dunk', self: 'game-icons:round-shield' };

/** An Action Card (hand · drag ghost · inspection · enlarged detail). */
function ActionCard({ card, dragSrc, selected, big, onPointerDown, onDoubleClick }) {
  const art = cardArt({ ...card, attunement: card.element });
  const scope = scopeOf(card);
  return (
    <div className={`bCard${dragSrc ? ' dragSrc' : ''}${selected ? ' selected' : ''}${big ? ' big' : ''}`} style={{ '--el': elColor(card.element) }}
      onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      <div className="bCardHead"><span className="bCardCost">{card.cost}</span><span className="bCardName">{card.name}</span></div>
      {elementBadge(card.element)}
      <div className="bCardArt">
        {art ? <img src={art} alt="" /> : <span className="bCardArtIcon"><Icon icon={SCOPE_ICON[scope] || 'game-icons:crossed-swords'} /></span>}
        {card.priority ? <span className="bCardPrio" title={`Priority ${card.priority}`}><Icon icon="game-icons:sprint" />P{card.priority}</span> : null}
      </div>
      <div className={`bCardType ${scope}`}><Icon icon={SCOPE_ICON[scope] || 'game-icons:crossed-swords'} />{typeLine(card)}</div>
      <div className="bCardText">{card.text}</div>
    </div>
  );
}

export default function BattleScreen() {
  const snap = useBattle((s) => s.snapshot);
  const selectSquad = useBattle((s) => s.selectSquad);
  const queueCard = useBattle((s) => s.queueCard);
  const undoLast = useBattle((s) => s.undoLast);
  const resetPlans = useBattle((s) => s.resetPlans);
  const resolve = useBattle((s) => s.resolve);

  const dropEls = useRef(new Map());   // (reserved for in-scene FX anchoring)
  const pickRef = useRef(null);        // Board3D raycast picker: (clientX,clientY) → unitId | null
  const drag = useRef(null);
  const [d, setD] = useState(null);          // active hand-card DRAG (only once moved past threshold)
  const [zoom, setZoom] = useState(null);    // { u, side } full creature info card
  const [cardZoom, setCardZoom] = useState(null);    // enlarged Action Card detail
  const [selId2, setSelId2] = useState(null);        // selected hand-card iid (click-to-target)
  const [anim, setAnim] = useState(null);    // resolution playback
  const [fx, setFx] = useState([]);
  const [armedId, setArmedId] = useState(null);   // squad tapped once (arm) → tap again opens info
  const [inspect, setInspect] = useState(null);   // pile-inspection overlay { title, cards, note? }
  const [ticker, setTicker] = useState(null);     // latest combat-log line (middle bar)
  const [logOpen, setLogOpen] = useState(false);  // full combat log overlay
  const [confirmFight, setConfirmFight] = useState(false);   // "energy left" confirmation
  const [dockHidden, setDockHidden] = useState(false);       // Action Cards shown/hidden
  const fxSeq = useRef(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Hand card press → TAP (select / detail) vs DRAG-to-play. Listeners are bound ONCE
  // on mount and gate on the drag.current ref — binding lazily on a `pressing` state
  // would miss the pointer-up of a fast tap (the effect re-binds after the up fires).
  useEffect(() => {
    const onMove = (e) => {
      const g = drag.current; if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) g.moved = true;
      if (g.moved) { g.over = (pickRef.current && pickRef.current(e.clientX, e.clientY)) || null; setD({ ...g }); }
    };
    const onUp = () => {
      const g = drag.current; if (!g) return; drag.current = null; setD(null);
      if (g.moved) { if (g.over) { queueCard(g.iid, g.over); setSelId2(null); } }
      else if (g.tapSel) setCardZoom(g.card);   // tap a selected card → detail
      else setSelId2(g.iid);                     // tap → select
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [queueCard]);

  // auto-focus: pan to the acting unit during resolution
  useEffect(() => {
    if (anim?.acting) dropEls.current.get(anim.acting)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [anim?.acting]);

  // board carousel: pan to the focused squad (either side)
  const selId = snap?.selectedSquadId;
  const focusId = armedId || selId;
  useEffect(() => {
    if (focusId) document.querySelector(`.bSquad[data-sqid="${focusId}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focusId]);

  if (!snap) return <div className="battleScreen empty">Loading…</div>;

  const allSquads = [...snap.enemy, ...snap.player];
  // the card DOCK spans every squad (your squads first, then the enemy's — read-only)
  const dockList = [...snap.player, ...snap.enemy];
  const dockIdx = Math.max(0, dockList.findIndex((sq) => sq.id === focusId));
  const dockSquad = dockList[dockIdx];
  const squadOfUnit = (uid) => allSquads.find((sq) => sq.units.some((u) => u.id === uid));
  const totalQueued = snap.player.reduce((n, sq) => n + (sq.plan?.length || 0), 0);
  const hasUnspent = snap.player.some((sq) => sq.energyLeft > 0);
  const selectedSquad = snap.player.find((sq) => sq.id === selId);
  const selectedCard = selId2 ? (selectedSquad?.hand || []).find((c) => c.iid === selId2) : null;
  // press a 3D hand card (native pointer event): a tap selects it (or opens detail if
  // already selected); a drag past the threshold raycasts onto a board creature to PLAY.
  // Handled by the window pressing-effect above; the drag ghost follows the cursor.
  const startHandDrag = (card, ne) => {
    if (anim) return;
    drag.current = { iid: card.iid, card, x0: ne.clientX, y0: ne.clientY, x: ne.clientX, y: ne.clientY, moved: false, over: null, tapSel: selId2 === card.iid };

  };

  const disp = (u) => (anim ? { ...u, hp: anim.hp[u.id] ?? u.hp, block: anim.block[u.id] ?? u.block, dead: (anim.hp[u.id] ?? u.hp) <= 0 } : u);

  // focus a squad: arm it (for info-open) + make it the planning squad if it's yours
  const focusSquad = (sqId, side) => { if (sqId !== selId) setSelId2(null); setArmedId(sqId); if (side === 'p') selectSquad(sqId); };
  const cycleSquad = (dir) => {
    if (dockList.length < 2) return;
    const i = (((dockIdx + dir) % dockList.length) + dockList.length) % dockList.length;
    focusSquad(dockList[i].id, dockList[i].side);
  };
  // board field carousel: focus the next/prev squad ON THAT SIDE, wrapping around
  // (infinite loop back to the other end of the field).
  const cycleSide = (side, dir) => {
    const list = side === 'e' ? snap.enemy : snap.player;
    if (list.length < 2) return;
    const cur = list.findIndex((sq) => sq.id === focusId);
    const from = cur >= 0 ? cur : (dir > 0 ? -1 : 0);
    const i = (((from + dir) % list.length) + list.length) % list.length;
    focusSquad(list[i].id, side);
  };
  // click a token: (1) if a card is SELECTED, the click plays it at this target;
  // (2) else its squad must be FOCUSED first; (3) a second tap opens the info card.
  const onTok = (u, side) => {
    if (anim) return;
    const sq = squadOfUnit(u.id); if (!sq) return;
    if (selectedCard) {
      // offensive cards must target the ENEMY side; friendly cards your OWN side
      const wantSide = isOffensiveCard(selectedCard) ? 'e' : 'p';
      if (side === wantSide) { queueCard(selectedCard.iid, u.id); setSelId2(null); }
      return;
    }
    if (armedId === sq.id) setZoom({ u: disp(u), side });
    else focusSquad(sq.id, side);
  };

  // in-SCENE FX: push a floating label anchored to a unit's 3D card (Board3D renders it)
  const FX_COLOR = { dmg: '#ff5a4a', blocked: '#cbd5e1', block: '#f0c84a', heal: '#4ade80', miss: '#cbd5e1', death: '#ff7b7b' };
  const spawnFx = (unitId, kind, text) => {
    if (!unitId) return;
    const key = ++fxSeq.current;
    setFx((f) => [...f, { key, unitId, text, color: FX_COLOR[kind] || '#fff' }]);
    timers.current.push(setTimeout(() => setFx((f) => f.filter((x) => x.key !== key)), 1200));
  };

  // Fight: confirm first if any squad still has energy to spend, else resolve.
  const requestFight = () => {
    if (anim || snap.outcome) return;
    if (hasUnspent) { setConfirmFight(true); return; }
    doFight();
  };
  const doFight = () => {
    if (anim || snap.outcome) return;
    setConfirmFight(false); setSelId2(null);
    const pre = { hp: {}, block: {} };
    allSquads.forEach((sq) => sq.units.forEach((u) => { pre.hp[u.id] = u.hp; pre.block[u.id] = u.block; }));
    setAnim({ hp: { ...pre.hp }, block: { ...pre.block }, acting: null });
    const { log, entries } = resolve();
    const lines = entries || [];
    let entryIdx = 0;
    const steps = (log || []).filter((e) => ['play', 'damage', 'block', 'heal', 'regen', 'miss', 'death'].includes(e.type));
    let i = 0;
    const run = () => {
      if (i >= steps.length) { setAnim(null); return; }
      const e = steps[i++];
      if (e.type === 'play' && lines[entryIdx]) setTicker(lines[entryIdx++]);
      setAnim((a) => { if (!a) return a; const n = { hp: { ...a.hp }, block: { ...a.block }, acting: a.acting };
        if (e.type === 'play') n.acting = e.ownerId;
        else if (e.type === 'damage') { n.hp[e.targetId] = e.hp; if (e.blocked) n.block[e.targetId] = Math.max(0, (n.block[e.targetId] || 0) - e.blocked); }
        else if (e.type === 'block') n.block[e.unitId] = e.total;
        else if (e.type === 'heal' || e.type === 'regen') n.hp[e.targetId ?? e.unitId] = e.hp;
        return n; });
      if (e.type === 'damage') { const net = e.amount - (e.blocked || 0); spawnFx(e.targetId, net > 0 ? 'dmg' : 'blocked', net > 0 ? `-${net}` : '🛡'); }
      else if (e.type === 'block') spawnFx(e.unitId, 'block', `+${e.amount}`);
      else if (e.type === 'heal' || e.type === 'regen') spawnFx(e.targetId ?? e.unitId, 'heal', `+${e.amount ?? ''}`);
      else if (e.type === 'miss') spawnFx(e.targetId, 'miss', 'MISS');
      else if (e.type === 'death') spawnFx(e.unitId, 'death', '💀');
      timers.current.push(setTimeout(run, e.type === 'play' ? 190 : 350));
    };
    run();
  };

  return (
    <div className={`battleScreen${d ? ' dragging' : ''}${anim ? ' resolving' : ''}${dockHidden ? ' dockHidden' : ''}${selectedCard ? ' picking' : ''}`}>
      {/* REAL 3D BOARD (react-three-fiber): creatures are card meshes on a table,
          raycast-picked so tilted 3D cards stay tappable. Hand/HUD stay DOM below. */}
      <div className="bArena3d">
        <Board3D
          enemy={snap.enemy.map((sq) => ({ ...sq, units: sq.units.map(disp) }))}
          player={snap.player.map((sq) => ({ ...sq, units: sq.units.map(disp) }))}
          focusId={focusId} actingId={anim?.acting} onPick={onTok} pickRef={pickRef} fx={fx}
          hand={dockHidden || anim ? null : {
            station: snap.player.find((sq) => sq.id === selId) || snap.player[0],
            selectedIid: selId2, dealKey: snap.dealKey,
            onCardPointerDown: startHandDrag, onInspect: setInspect,
          }} />

        {/* squad carousels + horizon log bar overlay the canvas */}
        {snap.enemy.length > 1 && <button className="bEdge left far" title="Previous enemy squad" onClick={() => cycleSide('e', -1)}><Icon icon="tabler:chevron-left" /></button>}
        {snap.enemy.length > 1 && <button className="bEdge right far" title="Next enemy squad" onClick={() => cycleSide('e', 1)}><Icon icon="tabler:chevron-right" /></button>}
        {snap.player.length > 1 && <button className="bEdge left near" title="Previous squad" onClick={() => cycleSide('p', -1)}><Icon icon="tabler:chevron-left" /></button>}
        {snap.player.length > 1 && <button className="bEdge right near" title="Next squad" onClick={() => cycleSide('p', 1)}><Icon icon="tabler:chevron-right" /></button>}

        <button type="button" className={`bMid overlay${(snap.logHistory?.length || ticker) ? ' log' : ''}`}
          title={snap.logHistory?.length ? 'View full combat log' : undefined}
          onClick={() => snap.logHistory?.length && setLogOpen(true)}>
          {snap.outcome
            ? <span className={`bOutcome ${snap.outcome === 'p' ? 'win' : 'lose'}`}>
                {snap.outcome === 'p' ? 'Victory' : snap.outcome === 'e' ? 'Defeat' : 'Draw'}
                <span className="bNew" onClick={(e) => { e.stopPropagation(); window.location.reload(); }} title="New battle"><Icon icon="tabler:refresh" /></span>
              </span>
            : anim && ticker
              ? <span className={`bTick ${ticker.side === 'e' ? 'foe' : 'ally'}`}>{ticker.text}</span>
              : <span className="bVs"><b>Turn {snap.turn}</b>{snap.logHistory?.length ? <em><Icon icon="game-icons:scroll-quill" /> Combat Log</em> : ' · Plan your squads, then Fight'}</span>}
        </button>
      </div>

      {/* DOCK — every squad's Deck · Hand · Discard · Exhaust (yours first, enemy read-only), a rotating carousel */}
      <div className={`bDock${dockSquad?.side === 'e' ? ' enemyDock' : ''}${dockHidden ? ' hidden' : ''}`}>
        <div className="bDockTop">
          <button className="bCtl sm toggle" title={dockHidden ? 'Show Action Cards' : 'Hide Action Cards'} onClick={() => setDockHidden((v) => !v)}>
            <Icon icon={dockHidden ? 'tabler:cards' : 'tabler:chevron-down'} />
          </button>
          <div className="bSquadNav">
            <button className="bCtl sm" title="Previous squad" disabled={dockList.length < 2} onClick={() => cycleSquad(-1)}><Icon icon="tabler:chevron-left" /></button>
            <span className="bSquadNavLbl">
              {dockSquad?.side === 'e' ? <><Icon icon="game-icons:despair" /> Enemy Squad</> : <>Squad {dockIdx + 1}</>}
              <em> / {dockList.length}</em>
              {dockSquad?.side === 'p' && <span className="bEnergyMini">⚡ {dockSquad.energyLeft}/{dockSquad.maxEnergy}</span>}
            </span>
            <button className="bCtl sm" title="Next squad" disabled={dockList.length < 2} onClick={() => cycleSquad(1)}><Icon icon="tabler:chevron-right" /></button>
          </div>
          <div className="bControls">
            <button className="bCtl" title="Undo last move" disabled={!totalQueued || !!anim} onClick={undoLast}><Icon icon="tabler:arrow-back-up" /></button>
            <button className="bCtl" title="Reset all moves this turn" disabled={!totalQueued || !!anim} onClick={resetPlans}><Icon icon="tabler:refresh" /></button>
            <button className="bCtl fight" title="Fight — resolve the round" disabled={!!anim || !!snap.outcome} onClick={requestFight}><Icon icon="game-icons:crossed-swords" /></button>
          </div>
        </div>
      </div>

      {d && <div className="bDragGhost" style={{ left: d.x, top: d.y }}><ActionCard card={d.card} /></div>}


      {zoom && (
        <div className="bZoom" onClick={() => setZoom(null)}>
          <div className="bZoomCard" onClick={(e) => e.stopPropagation()}><CardFace f={zoom.u} side={zoom.side === 'e' ? 'enemy' : 'ally'} /></div>
          <button className="bZoomClose" onClick={() => setZoom(null)}><Icon icon="tabler:x" /></button>
        </div>
      )}

      {inspect && (
        <div className="bInspect" onClick={() => setInspect(null)}>
          <div className="bInspectPanel" onClick={(e) => e.stopPropagation()}>
            <div className="bInspectHead"><span>{inspect.title} <em>· {inspect.cards.length}</em></span>
              {inspect.note && <small>{inspect.note}</small>}
              <button className="bZoomClose sm" onClick={() => setInspect(null)}><Icon icon="tabler:x" /></button>
            </div>
            <div className="bInspectGrid">
              {inspect.cards.map((card, i) => (card.known === false
                ? <div key={i} className="bCardBack big" title="Unknown card"><Icon icon="game-icons:card-random" /><span>?</span></div>
                : <ActionCard key={card.iid || i} card={card} onDoubleClick={() => setCardZoom(card)} />))}
            </div>
          </div>
        </div>
      )}

      {/* enlarged Action Card detail (like the creature card, but for a card) */}
      {cardZoom && (
        <div className="bZoom" onClick={() => setCardZoom(null)}>
          <div className="bZoomCard action" onClick={(e) => e.stopPropagation()}><ActionCard card={cardZoom} big /></div>
          <button className="bZoomClose" onClick={() => setCardZoom(null)}><Icon icon="tabler:x" /></button>
        </div>
      )}

      {/* Fight confirmation — energy still unspent in a squad */}
      {confirmFight && (
        <div className="bInspect" onClick={() => setConfirmFight(false)}>
          <div className="bConfirm" onClick={(e) => e.stopPropagation()}>
            <h3><Icon icon="game-icons:crossed-swords" /> Fight now?</h3>
            <p>One or more of your squads still has <b>energy to spend</b>. Resolve the round anyway?</p>
            <div className="bConfirmBtns">
              <button className="bCtl wide" onClick={() => setConfirmFight(false)}>Keep planning</button>
              <button className="bCtl fight wide" onClick={doFight}>Fight</button>
            </div>
          </div>
        </div>
      )}

      {/* full combat log */}
      {logOpen && (
        <div className="bInspect" onClick={() => setLogOpen(false)}>
          <div className="bInspectPanel log" onClick={(e) => e.stopPropagation()}>
            <div className="bInspectHead"><span><Icon icon="game-icons:scroll-quill" /> Combat Log</span>
              <button className="bZoomClose sm" onClick={() => setLogOpen(false)}><Icon icon="tabler:x" /></button>
            </div>
            <div className="bLogList">
              {(snap.logHistory || []).length === 0 && <div className="bHandEmpty">No actions yet.</div>}
              {(snap.logHistory || []).slice().reverse().map((en, i) => (
                <div key={i} className={`bLogRow ${en.side === 'e' ? 'foe' : 'ally'}`}>{en.text}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
