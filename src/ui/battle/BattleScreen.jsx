// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/BattleScreen — the COMBAT-V2 board.                    ║
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
import { CardFace, STATUS_META, elementBadge } from '../combat/creatureVisuals.jsx';
import { ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../../data/axisIcons.js';
import { creatureArt, cardArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';
import '../combat/combat.css';   // CardFace styling for the enlarged info card
import './battle.css';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Resolve a token's background art: generated portrait → pixel art → icon. */
function tokenArt(u) {
  const p = sizedPortrait(u.portrait, u.form);
  if (p) return { img: p };
  const art = u.axes?.biology ? creatureArt({ id: u.id, biology: u.axes.biology, family: u.axes.family, subtypes: u.axes.subtypes }) : null;
  if (art) return { img: art, pixel: true };
  return { icon: creatureIcon({ biology: u.axes?.biology, attunement: u.axes?.attunement, class: u.axes?.class }), color: creatureColor({ attunement: u.axes?.attunement }) };
}

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

/** One squad's card station: Deck · Hand · Discard · Exhaust (a carousel slide). */
function Pile({ kind, icon, count, label, onInspect }) {
  return (
    <button type="button" className={`bPile ${kind}${onInspect ? ' inspectable' : ''}`} title={onInspect ? `Inspect ${label}` : label}
      disabled={!onInspect} onClick={onInspect}>
      <div className="bPileStack"><Icon icon={icon} /></div>
      <span className="bPileN">{count}</span>
      <label>{label}</label>
    </button>
  );
}
/** The player's own squad station — face-up FANNED hand (tap to select, drag or
 *  click-target to play, double-tap for detail) + inspectable piles. */
function Station({ sq, dealKey, onCardDown, onCardDetail, dragIid, selectedIid, onInspect }) {
  const hand = sq.hand || [];
  return (
    <div className="bStation">
      <Pile kind="deck" icon="game-icons:card-random" count={sq.deckCount} label="Deck"
        onInspect={sq.deckCount ? () => onInspect({ title: 'Draw Pile', cards: sq.deck, note: 'Contents known · draw order hidden' }) : null} />
      <div className={`bHand fan n${hand.length}`}>
        {hand.map((card, i) => (
          <div key={`${dealKey}-${card.iid}`} className="bDeal" style={{ animationDelay: `${i * 55}ms`, zIndex: i + 1 }}>
            <ActionCard card={card} dragSrc={dragIid === card.iid} selected={selectedIid === card.iid}
              onPointerDown={(e) => onCardDown(e, card)} onDoubleClick={() => onCardDetail(card)} />
          </div>
        ))}
        {hand.length === 0 && <div className="bHandEmpty">No cards in hand.</div>}
      </div>
      <div className="bDiscardPiles">
        <Pile kind="discard" icon="game-icons:card-pickup" count={sq.discardCount} label="Discard"
          onInspect={sq.discardCount ? () => onInspect({ title: 'Discard', cards: sq.discard }) : null} />
        <Pile kind="exhaust" icon="game-icons:card-burn" count={sq.exhaustCount} label="Exhaust"
          onInspect={sq.exhaustCount ? () => onInspect({ title: 'Exhaust', cards: sq.exhaust }) : null} />
      </div>
    </div>
  );
}
/** An enemy squad station — face-DOWN hand (hidden), inspectable discard/exhaust, and a
 *  deck that is '?' until cards have been seen played or discarded. */
function EnemyStation({ sq, onInspect }) {
  return (
    <div className="bStation enemy">
      <Pile kind="deck" icon="game-icons:card-random" count={sq.deckCount} label="Deck"
        onInspect={sq.deckCount ? () => onInspect({ title: 'Enemy Draw Pile', cards: sq.deck, note: 'Cards you have seen are revealed · order unknown' }) : null} />
      <div className="bHand facedown">
        {Array.from({ length: sq.handCount || 0 }).map((_, i) => (
          <div key={i} className="bCardBack" title="Hidden enemy card"><Icon icon="game-icons:card-random" /></div>
        ))}
        {!sq.handCount && <div className="bHandEmpty">Enemy hand empty.</div>}
      </div>
      <div className="bDiscardPiles">
        <Pile kind="discard" icon="game-icons:card-pickup" count={sq.discardCount} label="Discard"
          onInspect={sq.discardCount ? () => onInspect({ title: 'Enemy Discard', cards: sq.discard }) : null} />
        <Pile kind="exhaust" icon="game-icons:card-burn" count={sq.exhaustCount} label="Exhaust"
          onInspect={sq.exhaustCount ? () => onInspect({ title: 'Enemy Exhaust', cards: sq.exhaust }) : null} />
      </div>
    </div>
  );
}

/** The compact battle token: art background + name + HP (the board view). */
function BattleToken({ u, side, acting, willHit, hovered, onDropRef, onClick }) {
  const art = tokenArt(u);
  const pct = Math.max(0, (u.hp / u.maxHp) * 100);
  return (
    <div className={`bTok ${u.isFront ? 'front' : 'support'}${u.dead ? ' dead' : ''}${acting ? ' acting' : ''}${willHit ? ' willHit' : ''}${hovered ? ' hovered' : ''}`}
      data-drop-id={u.id} ref={(el) => onDropRef && onDropRef(u.id, el)} style={{ '--el': elColor(u.element) }}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(u, side); }}>
      <div className="bTokArt" style={art.img ? { backgroundImage: `url(${art.img})`, imageRendering: art.pixel ? 'pixelated' : 'auto' } : undefined}>
        {!art.img && <span className="bTokIcon" style={{ color: art.color }}><Icon icon={art.icon} /></span>}
      </div>
      <div className="bTokName">{u.name}</div>
      {(u.statuses?.length > 0) && (
        <div className="bTokStatus">
          {u.statuses.slice(0, 4).map((s) => { const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
            return <span key={s.id} className={`bTokPip ${m.cls}`} title={`${s.id} ${s.amount}`}><Icon icon={m.icon} />{s.amount}</span>; })}
        </div>
      )}
      <div className="bTokFoot">
        {u.block > 0 && <span className="bTokBlock" title={`Block ${u.block}`}><Icon icon="game-icons:checked-shield" />{u.block}</span>}
        <div className="bTokHp"><i className={pct <= 33 ? 'low' : ''} style={{ width: `${pct}%` }} /><em>{u.hp}</em></div>
      </div>
    </div>
  );
}

/** A squad: Support · Vanguard(centre) · Support. */
function Squad({ sq, side, units, selected, acting, willHitIds, hoveredId, onSelect, onDropRef, onTok }) {
  const front = units.find((u) => u.isFront);
  const supp = units.filter((u) => !u.isFront);
  const ordered = front ? [supp[0], front, supp[1]].filter(Boolean) : units;
  return (
    <div className={`bSquad${selected ? ' selected' : ''} ${side}`} data-sqid={sq.id}
      onClick={onSelect ? () => onSelect(sq.id) : undefined}>
      <div className="bSquadRow">
        {ordered.map((u) => (
          <BattleToken key={u.id} u={u} side={side} acting={acting === u.id} willHit={!!willHitIds?.has(u.id)} hovered={hoveredId === u.id}
            onDropRef={onDropRef} onClick={onTok} />
        ))}
      </div>
      {side === 'p' && (
        <div className="bEnergy" title="Squad energy">
          {Array.from({ length: sq.maxEnergy }).map((_, i) => <span key={i} className={`bPip${i < sq.energyLeft ? ' on' : ''}`} />)}
          <em>{sq.energyLeft}/{sq.maxEnergy}</em>
        </div>
      )}
      {sq.plan?.length > 0 && <div className="bPlan">{sq.plan.map((a, i) => <span key={i} className="bPlanChip">{a.card.name}</span>)}</div>}
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

  const dropEls = useRef(new Map());
  const setDropRef = (id, el) => { if (el) dropEls.current.set(id, el); else dropEls.current.delete(id); };
  const drag = useRef(null);
  const [d, setD] = useState(null);          // active hand-card DRAG (only once moved past threshold)
  const [pressing, setPressing] = useState(false);   // a card is pressed (may become a drag or a tap)
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

  // press → tap (select / detail) vs drag (past a small threshold), tracked on the window
  useEffect(() => {
    if (!pressing) return undefined;
    const onMove = (e) => {
      const g = drag.current; if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) g.moved = true;
      if (g.moved) { g.over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop-id]')?.getAttribute('data-drop-id') || null; setD({ ...g }); }
    };
    const onUp = () => {
      const g = drag.current; drag.current = null; setPressing(false); setD(null);
      if (!g) return;
      if (g.moved) { if (g.over) { queueCard(g.iid, g.over); setSelId2(null); } }
      else {   // a TAP: select, or open detail if already selected
        if (g.tapSel) setCardZoom(g.card); else setSelId2(g.iid);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [pressing, queueCard]);

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
  // press a card: a tap selects it (or opens detail if already selected); a drag past
  // the threshold begins a drag-ghost (handled by the window effect above).
  const onCardDown = (e, card) => { if (anim) return; e.preventDefault(); drag.current = { iid: card.iid, card, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, over: null, tapSel: selId2 === card.iid }; setPressing(true); };

  const disp = (u) => (anim ? { ...u, hp: anim.hp[u.id] ?? u.hp, block: anim.block[u.id] ?? u.block, dead: (anim.hp[u.id] ?? u.hp) <= 0 } : u);

  // which token(s) a card would hit, honoring scope — field = whole enemy side,
  // squad = every member, targeted = the exact token, front = the target's live front.
  const hitSetFor = (card, overId) => {
    const set = new Set(); const sq = overId ? squadOfUnit(overId) : null;
    if (!sq || !card) return set;
    const scope = card.scope || (card.reachesBack ? 'targeted' : 'front');
    if (scope === 'field') sq.side === 'p' ? snap.player.forEach((s) => s.units.forEach((u) => !u.dead && set.add(u.id))) : snap.enemy.forEach((s) => s.units.forEach((u) => !u.dead && set.add(u.id)));
    else if (scope === 'squad') sq.units.forEach((u) => !u.dead && set.add(u.id));
    else if (scope === 'targeted') set.add(overId);
    else if (sq.frontId) set.add(sq.frontId);
    return set;
  };
  // drop affordance: the dragged card's targets, else the selected card hovering a token
  const willHit = d?.over ? hitSetFor(d.card, d.over) : new Set();

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

  const spawnFx = (unitId, kind, text) => {
    const el = dropEls.current.get(unitId); if (!el) return;
    const r = el.getBoundingClientRect(); const key = ++fxSeq.current;
    setFx((f) => [...f, { key, kind, text, x: r.left + r.width / 2, y: r.top + r.height * 0.34 }]);
    timers.current.push(setTimeout(() => setFx((f) => f.filter((x) => x.key !== key)), 1000));
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
      <div className="bField enemy">
        {snap.enemy.length > 1 && <button className="bEdge left" title="Previous enemy squad" onClick={() => cycleSide('e', -1)}><Icon icon="tabler:chevron-left" /></button>}
        <section className="bZone enemy">
          {snap.enemy.map((sq) => (
            <Squad key={sq.id} sq={sq} side="e" units={sq.units.map(disp)} acting={anim?.acting}
              willHitIds={willHit} hoveredId={d?.over} selected={sq.id === focusId}
              onSelect={(id) => focusSquad(id, 'e')} onDropRef={setDropRef} onTok={onTok} />
          ))}
        </section>
        {snap.enemy.length > 1 && <button className="bEdge right" title="Next enemy squad" onClick={() => cycleSide('e', 1)}><Icon icon="tabler:chevron-right" /></button>}
      </div>

      <button type="button" className={`bMid${(snap.logHistory?.length || ticker) ? ' log' : ''}`}
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

      <div className="bField player">
        {snap.player.length > 1 && <button className="bEdge left" title="Previous squad" onClick={() => cycleSide('p', -1)}><Icon icon="tabler:chevron-left" /></button>}
        <section className="bZone player">
          {snap.player.map((sq) => (
            <Squad key={sq.id} sq={sq} side="p" units={sq.units.map(disp)} acting={anim?.acting}
              willHitIds={willHit} hoveredId={d?.over} selected={sq.id === focusId}
              onSelect={(id) => focusSquad(id, 'p')} onDropRef={setDropRef} onTok={onTok} />
          ))}
        </section>
        {snap.player.length > 1 && <button className="bEdge right" title="Next squad" onClick={() => cycleSide('p', 1)}><Icon icon="tabler:chevron-right" /></button>}
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
        {!dockHidden && (
          <div className="bStations">
            <div className="bTrack" style={{ transform: `translateX(${-dockIdx * 100}%)` }}>
              {dockList.map((sq) => (sq.side === 'p'
                ? <Station key={sq.id} sq={sq} dealKey={snap.dealKey} onCardDown={onCardDown} onCardDetail={setCardZoom}
                    dragIid={d?.iid} selectedIid={selId2} onInspect={setInspect} />
                : <EnemyStation key={sq.id} sq={sq} onInspect={setInspect} />))}
            </div>
          </div>
        )}
      </div>

      {d && <div className="bDragGhost" style={{ left: d.x, top: d.y }}><ActionCard card={d.card} /></div>}

      {fx.map((f) => <div key={f.key} className={`bFx ${f.kind}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}

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
