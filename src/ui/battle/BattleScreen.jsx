// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/BattleScreen — the COMBAT-V2 board.                    ║
// ║ Top = enemy, bottom = friendly. Each creature is a compact BATTLE TOKEN   ║
// ║ (full-bleed art background + name + HP), NOT the full card. Front Vanguard ║
// ║ is CENTERED between its two rear Support. Selecting a squad is required    ║
// ║ before a token click opens the creature's FULL info card (the CardFace,   ║
// ║ enlarged). Drag a hand card onto any token to queue; Undo · Reset · Fight  ║
// ║ icons sit top-right of the hand. Fight plays the round back (auto-focus on ║
// ║ the acting unit + HP tweens + floating numbers). Selected squad pops       ║
// ║ forward (semi-3D depth); others recede.                                    ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useBattle } from '../../store/battleStore.js';
import { CardFace, STATUS_META } from '../combat/creatureVisuals.jsx';
import { ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../../data/axisIcons.js';
import { creatureArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';
import '../combat/combat.css';   // CardFace styling for the enlarged info card
import './battle.css';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';

/** Resolve a token's background art: generated portrait → pixel art → icon. */
function tokenArt(u) {
  const p = sizedPortrait(u.portrait, u.form);
  if (p) return { img: p };
  const art = u.axes?.biology ? creatureArt({ id: u.id, biology: u.axes.biology, family: u.axes.family, subtypes: u.axes.subtypes }) : null;
  if (art) return { img: art, pixel: true };
  return { icon: creatureIcon({ biology: u.axes?.biology, attunement: u.axes?.attunement, class: u.axes?.class }), color: creatureColor({ attunement: u.axes?.attunement }) };
}

/** A move card (hand or drag ghost). */
function MoveCard({ card, dragSrc, onPointerDown }) {
  return (
    <div className={`bCard${dragSrc ? ' dragSrc' : ''}`} style={{ '--el': elColor(card.element) }} onPointerDown={onPointerDown}>
      <div className="bCardHead"><span className="bCardCost">{card.cost}</span><span className="bCardName">{card.name}</span></div>
      <div className="bCardType">{card.element || ''} {card.type || 'card'}{card.priority ? ` · P${card.priority}` : ''}</div>
      <div className="bCardText">{card.text}</div>
    </div>
  );
}

/** One squad's card station: Deck · Hand · Discard · Exhaust (a carousel slide). */
function Pile({ kind, icon, count, label }) {
  return (
    <div className={`bPile ${kind}`} title={label}>
      <div className="bPileStack"><Icon icon={icon} /></div>
      <span className="bPileN">{count}</span>
      <label>{label}</label>
    </div>
  );
}
function Station({ sq, dealKey, onDrag, dragIid }) {
  return (
    <div className="bStation">
      <Pile kind="deck" icon="game-icons:card-random" count={sq.deckCount} label="Deck" />
      <div className="bHand">
        {(sq.hand || []).map((card, i) => (
          <div key={`${dealKey}-${card.iid}`} className="bDeal" style={{ animationDelay: `${i * 55}ms` }}>
            <MoveCard card={card} dragSrc={dragIid === card.iid} onPointerDown={(e) => onDrag(e, card)} />
          </div>
        ))}
        {(sq.hand || []).length === 0 && <div className="bHandEmpty">No cards in hand.</div>}
      </div>
      <div className="bDiscardPiles">
        <Pile kind="discard" icon="game-icons:card-pickup" count={sq.discardCount} label="Discard" />
        <Pile kind="exhaust" icon="game-icons:card-burn" count={sq.exhaustCount} label="Exhaust" />
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
function Squad({ sq, side, units, selected, acting, willHitId, hoveredId, onSelect, onDropRef, onTok }) {
  const front = units.find((u) => u.isFront);
  const supp = units.filter((u) => !u.isFront);
  const ordered = front ? [supp[0], front, supp[1]].filter(Boolean) : units;
  return (
    <div className={`bSquad${selected ? ' selected' : ''} ${side}`} data-sqid={sq.id}
      onClick={onSelect ? () => onSelect(sq.id) : undefined}>
      <div className="bSquadRow">
        {ordered.map((u) => (
          <BattleToken key={u.id} u={u} side={side} acting={acting === u.id} willHit={willHitId === u.id} hovered={hoveredId === u.id}
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
  const [d, setD] = useState(null);          // hand-card drag
  const [zoom, setZoom] = useState(null);    // { u, side } full info card
  const [anim, setAnim] = useState(null);    // resolution playback
  const [fx, setFx] = useState([]);
  const [armedId, setArmedId] = useState(null);   // squad tapped once (arm) → tap again opens info
  const [dockIdx, setDockIdx] = useState(0);       // which player squad the card carousel shows
  const fxSeq = useRef(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // hand-card drag → drop on a token to queue
  useEffect(() => {
    if (!d) return undefined;
    const onMove = (e) => {
      const g = drag.current; if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      g.over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop-id]')?.getAttribute('data-drop-id') || null;
      setD({ ...g });
    };
    const onUp = () => { const g = drag.current; drag.current = null; if (g && g.over) queueCard(g.iid, g.over); setD(null); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [d?.iid, queueCard]);

  // auto-focus: pan to the acting unit during resolution
  useEffect(() => {
    if (anim?.acting) dropEls.current.get(anim.acting)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [anim?.acting]);

  // dock carousel follows the selected player squad
  const selId = snap?.selectedSquadId;
  useEffect(() => {
    const i = snap?.player?.findIndex((sq) => sq.id === selId);
    if (i != null && i >= 0) setDockIdx(i);
  }, [selId, snap?.player?.length]);
  // board carousel: pan to the focused squad
  const focusId = armedId || selId;
  useEffect(() => {
    if (focusId) document.querySelector(`.bSquad[data-sqid="${focusId}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focusId]);

  if (!snap) return <div className="battleScreen empty">Loading…</div>;

  const allSquads = [...snap.enemy, ...snap.player];
  const squadOfUnit = (uid) => allSquads.find((sq) => sq.units.some((u) => u.id === uid));
  const selectedPlayer = snap.player.find((sq) => sq.id === snap.selectedSquadId);
  const totalQueued = snap.player.reduce((n, sq) => n + (sq.plan?.length || 0), 0);
  const startDrag = (e, card) => { if (anim) return; drag.current = { iid: card.iid, card, x: e.clientX, y: e.clientY, over: null }; setD({ ...drag.current }); };

  const disp = (u) => (anim ? { ...u, hp: anim.hp[u.id] ?? u.hp, block: anim.block[u.id] ?? u.block, dead: (anim.hp[u.id] ?? u.hp) <= 0 } : u);

  // drop affordance: which token the pending card would hit (squad front, or the
  // specific token for reachesBack cards)
  const overSquad = d?.over ? squadOfUnit(d.over) : null;
  const willHitId = overSquad ? (d.card?.reachesBack ? d.over : overSquad.frontId) : null;

  // focus a squad: arm it (for info-open) + make it the planning squad if it's yours
  const focusSquad = (sqId, side) => { setArmedId(sqId); if (side === 'p') selectSquad(sqId); };
  const cycleSquad = (dir) => {
    if (snap.player.length < 2) return;
    const i = (((dockIdx + dir) % snap.player.length) + snap.player.length) % snap.player.length;
    focusSquad(snap.player[i].id, 'p');
  };
  // click a token: its squad must be FOCUSED first; a second tap opens the full info card
  const onTok = (u, side) => {
    if (anim) return;
    const sq = squadOfUnit(u.id); if (!sq) return;
    if (armedId === sq.id) setZoom({ u: disp(u), side });
    else focusSquad(sq.id, side);
  };

  const spawnFx = (unitId, kind, text) => {
    const el = dropEls.current.get(unitId); if (!el) return;
    const r = el.getBoundingClientRect(); const key = ++fxSeq.current;
    setFx((f) => [...f, { key, kind, text, x: r.left + r.width / 2, y: r.top + r.height * 0.34 }]);
    timers.current.push(setTimeout(() => setFx((f) => f.filter((x) => x.key !== key)), 1000));
  };

  const onFight = () => {
    if (anim || snap.outcome) return;
    const pre = { hp: {}, block: {} };
    allSquads.forEach((sq) => sq.units.forEach((u) => { pre.hp[u.id] = u.hp; pre.block[u.id] = u.block; }));
    setAnim({ hp: { ...pre.hp }, block: { ...pre.block }, acting: null });
    const { log } = resolve();
    const steps = (log || []).filter((e) => ['play', 'damage', 'block', 'heal', 'regen', 'miss', 'death'].includes(e.type));
    let i = 0;
    const run = () => {
      if (i >= steps.length) { setAnim(null); return; }
      const e = steps[i++];
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
    <div className={`battleScreen${d ? ' dragging' : ''}${anim ? ' resolving' : ''}`}>
      <section className="bZone enemy">
        {snap.enemy.map((sq) => (
          <Squad key={sq.id} sq={sq} side="e" units={sq.units.map(disp)} acting={anim?.acting}
            willHitId={willHitId} hoveredId={d?.over} selected={sq.id === focusId}
            onSelect={(id) => focusSquad(id, 'e')} onDropRef={setDropRef} onTok={onTok} />
        ))}
      </section>

      <div className="bMid">
        {snap.outcome
          ? <div className={`bOutcome ${snap.outcome === 'p' ? 'win' : 'lose'}`}>
              {snap.outcome === 'p' ? 'Victory' : snap.outcome === 'e' ? 'Defeat' : 'Draw'}
              <button className="bNew" onClick={() => window.location.reload()} title="New battle"><Icon icon="tabler:refresh" /></button>
            </div>
          : <div className="bVs">{anim ? 'Resolving…' : 'Plan your squads, then Fight'}</div>}
      </div>

      <section className="bZone player">
        {snap.player.map((sq) => (
          <Squad key={sq.id} sq={sq} side="p" units={sq.units.map(disp)} acting={anim?.acting}
            willHitId={willHitId} hoveredId={d?.over} selected={sq.id === focusId}
            onSelect={(id) => focusSquad(id, 'p')} onDropRef={setDropRef} onTok={onTok} />
        ))}
      </section>

      {/* DOCK — each squad's Deck · Hand · Discard · Exhaust, as a rotating carousel */}
      <div className="bDock">
        <div className="bDockTop">
          <div className="bSquadNav">
            <button className="bCtl sm" title="Previous squad" disabled={snap.player.length < 2} onClick={() => cycleSquad(-1)}><Icon icon="tabler:chevron-left" /></button>
            <span className="bSquadNavLbl">Squad {dockIdx + 1}<em> / {snap.player.length}</em>
              {selectedPlayer && <span className="bEnergyMini">⚡ {selectedPlayer.energyLeft}/{selectedPlayer.maxEnergy}</span>}
            </span>
            <button className="bCtl sm" title="Next squad" disabled={snap.player.length < 2} onClick={() => cycleSquad(1)}><Icon icon="tabler:chevron-right" /></button>
          </div>
          <div className="bControls">
            <button className="bCtl" title="Undo last move" disabled={!totalQueued || !!anim} onClick={undoLast}><Icon icon="tabler:arrow-back-up" /></button>
            <button className="bCtl" title="Reset all moves this turn" disabled={!totalQueued || !!anim} onClick={resetPlans}><Icon icon="tabler:refresh" /></button>
            <button className="bCtl fight" title="Fight — resolve the round" disabled={!!anim || !!snap.outcome} onClick={onFight}><Icon icon="game-icons:crossed-swords" /></button>
          </div>
        </div>
        <div className="bStations">
          <div className="bTrack" style={{ transform: `translateX(${-dockIdx * 100}%)` }}>
            {snap.player.map((sq) => <Station key={sq.id} sq={sq} dealKey={snap.dealKey} onDrag={startDrag} dragIid={d?.iid} />)}
          </div>
        </div>
      </div>

      {d && <div className="bDragGhost" style={{ left: d.x, top: d.y }}><MoveCard card={d.card} /></div>}

      {fx.map((f) => <div key={f.key} className={`bFx ${f.kind}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}

      {zoom && (
        <div className="bZoom" onClick={() => setZoom(null)}>
          <div className="bZoomCard" onClick={(e) => e.stopPropagation()}><CardFace f={zoom.u} side={zoom.side === 'e' ? 'enemy' : 'ally'} /></div>
          <button className="bZoomClose" onClick={() => setZoom(null)}><Icon icon="tabler:x" /></button>
        </div>
      )}
    </div>
  );
}
