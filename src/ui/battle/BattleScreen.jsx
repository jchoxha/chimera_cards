// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/BattleScreen — the COMBAT-V2 board.                    ║
// ║ Top = enemy squads, bottom = friendly; every creature is a scaled-down    ║
// ║ CardFace (front Vanguard CENTERED between its two rear Support). Select a  ║
// ║ squad, DRAG a hand card onto any creature to queue it; the hand's         ║
// ║ top-right icon controls are Undo · Reset · Fight. Fight plays the round    ║
// ║ back as a timed sequence (acting highlight + HP tweens + floating         ║
// ║ damage/block/heal numbers). Click any creature = an enlarged card view.   ║
// ║ Reads the store snapshot. Semi-3D/carousel still to come.                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useBattle } from '../../store/battleStore.js';
import { CardFace } from '../combat/creatureVisuals.jsx';
import { ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import '../combat/combat.css';   // CardFace styling (frame/art/badges)
import './battle.css';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';

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

/** One creature card on the board. */
function UnitCard({ u, side, acting, onDropRef, onZoom }) {
  return (
    <div className={`bUnit${u.isFront ? ' front' : ' support'}${u.dead ? ' dead' : ''}${acting ? ' acting' : ''}`}
      data-drop-id={u.id} ref={(el) => onDropRef && onDropRef(u.id, el)}
      onClick={() => onZoom && onZoom(u, side)}>
      <CardFace f={u} side={side === 'e' ? 'enemy' : 'ally'} dataId={u.id} />
    </div>
  );
}

/** A squad: Support · Vanguard(centre) · Support. */
function Squad({ sq, side, units, selected, acting, onSelect, onDropRef, onZoom }) {
  const front = units.find((u) => u.isFront);
  const supp = units.filter((u) => !u.isFront);
  const ordered = front ? [supp[0], front, supp[1]].filter(Boolean) : units;
  return (
    <div className={`bSquad${selected ? ' selected' : ''}${side === 'p' ? ' clickable' : ''}`}
      onClick={side === 'p' && onSelect ? () => onSelect(sq.id) : undefined}>
      <div className="bSquadRow">
        {ordered.map((u) => <UnitCard key={u.id} u={u} side={side} acting={acting === u.id} onDropRef={onDropRef} onZoom={onZoom} />)}
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
  const startBattle = useBattle((s) => s.startBattle);
  const selectSquad = useBattle((s) => s.selectSquad);
  const queueCard = useBattle((s) => s.queueCard);
  const undoLast = useBattle((s) => s.undoLast);
  const resetPlans = useBattle((s) => s.resetPlans);
  const resolve = useBattle((s) => s.resolve);

  const dropEls = useRef(new Map());
  const setDropRef = (id, el) => { if (el) dropEls.current.set(id, el); else dropEls.current.delete(id); };
  const drag = useRef(null);
  const [d, setD] = useState(null);          // hand-card drag
  const [zoom, setZoom] = useState(null);    // { u, side } enlarged card view
  const [anim, setAnim] = useState(null);    // { hp:{}, block:{}, acting } during resolution
  const [fx, setFx] = useState([]);          // floating numbers
  const fxSeq = useRef(0);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // hand-card drag → drop on a creature to queue
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

  if (!snap) return <div className="battleScreen empty">Loading…</div>;

  const selected = snap.player.find((sq) => sq.id === snap.selectedSquadId);
  const totalQueued = snap.player.reduce((n, sq) => n + (sq.plan?.length || 0), 0);
  const startDrag = (e, card) => { if (anim) return; drag.current = { iid: card.iid, card, x: e.clientX, y: e.clientY, over: null }; setD({ ...drag.current }); };

  // overlay the animated hp/block during resolution playback
  const disp = (u) => (anim ? { ...u, hp: anim.hp[u.id] ?? u.hp, block: anim.block[u.id] ?? u.block, dead: (anim.hp[u.id] ?? u.hp) <= 0 } : u);

  const spawnFx = (unitId, kind, text) => {
    const el = dropEls.current.get(unitId); if (!el) return;
    const r = el.getBoundingClientRect(); const key = ++fxSeq.current;
    setFx((f) => [...f, { key, kind, text, x: r.left + r.width / 2, y: r.top + r.height * 0.34 }]);
    timers.current.push(setTimeout(() => setFx((f) => f.filter((x) => x.key !== key)), 1000));
  };

  const onFight = () => {
    if (anim || snap.outcome) return;
    const pre = { hp: {}, block: {} };
    [...snap.enemy, ...snap.player].forEach((sq) => sq.units.forEach((u) => { pre.hp[u.id] = u.hp; pre.block[u.id] = u.block; }));
    setAnim({ hp: { ...pre.hp }, block: { ...pre.block }, acting: null });
    const { log } = resolve();   // store jumps to final; anim override shows the playback
    const steps = (log || []).filter((e) => ['play', 'damage', 'block', 'heal', 'regen', 'miss', 'death'].includes(e.type));
    let i = 0;
    const run = () => {
      if (i >= steps.length) { setAnim(null); return; }
      const e = steps[i++];
      setAnim((a) => {
        if (!a) return a; const n = { hp: { ...a.hp }, block: { ...a.block }, acting: a.acting };
        if (e.type === 'play') n.acting = e.ownerId;
        else if (e.type === 'damage') { n.hp[e.targetId] = e.hp; if (e.blocked) n.block[e.targetId] = Math.max(0, (n.block[e.targetId] || 0) - e.blocked); }
        else if (e.type === 'block') n.block[e.unitId] = e.total;
        else if (e.type === 'heal' || e.type === 'regen') n.hp[e.targetId ?? e.unitId] = e.hp;
        return n;
      });
      if (e.type === 'damage') { const net = e.amount - (e.blocked || 0); spawnFx(e.targetId, net > 0 ? 'dmg' : 'blocked', net > 0 ? `-${net}` : '🛡'); }
      else if (e.type === 'block') spawnFx(e.unitId, 'block', `+${e.amount}`);
      else if (e.type === 'heal' || e.type === 'regen') spawnFx(e.targetId ?? e.unitId, 'heal', `+${e.amount ?? ''}`);
      else if (e.type === 'miss') spawnFx(e.targetId, 'miss', 'MISS');
      else if (e.type === 'death') spawnFx(e.unitId, 'death', '💀');
      timers.current.push(setTimeout(run, e.type === 'play' ? 190 : 350));
    };
    run();
  };

  const openZoom = (u, side) => { if (side === 'p') selectSquad(u.squadId ?? (snap.player.find((sq) => sq.units.some((x) => x.id === u.id))?.id)); setZoom({ u: disp(u), side }); };

  return (
    <div className={`battleScreen${d ? ' dragging' : ''}${anim ? ' resolving' : ''}`}>
      {/* TOP — enemy */}
      <section className="bZone enemy">
        {snap.enemy.map((sq) => <Squad key={sq.id} sq={sq} side="e" units={sq.units.map(disp)} acting={anim?.acting} onDropRef={setDropRef} onZoom={openZoom} />)}
      </section>

      {/* MIDDLE — outcome / round divider */}
      <div className="bMid">
        {snap.outcome
          ? <div className={`bOutcome ${snap.outcome === 'p' ? 'win' : 'lose'}`}>
              {snap.outcome === 'p' ? 'Victory' : snap.outcome === 'e' ? 'Defeat' : 'Draw'}
              <button className="bNew" onClick={() => window.location.reload()} title="New battle"><Icon icon="tabler:refresh" /></button>
            </div>
          : <div className="bVs">{anim ? 'Resolving…' : 'Plan your squads, then Fight'}</div>}
      </div>

      {/* BOTTOM — friendly */}
      <section className="bZone player">
        {snap.player.map((sq) => (
          <Squad key={sq.id} sq={sq} side="p" units={sq.units.map(disp)} acting={anim?.acting}
            selected={sq.id === snap.selectedSquadId} onSelect={selectSquad} onDropRef={setDropRef} onZoom={openZoom} />
        ))}
      </section>

      {/* HAND + controls */}
      <div className="bHandBar">
        <div className="bHandTop">
          <div className="bHandLbl">{selected ? `Squad ${snap.player.indexOf(selected) + 1}` : 'Select a squad'}
            {selected && <span className="bEnergyMini">⚡ {selected.energyLeft}/{selected.maxEnergy}</span>}
          </div>
          <div className="bControls">
            <button className="bCtl" title="Undo last move" disabled={!totalQueued || !!anim} onClick={undoLast}><Icon icon="tabler:arrow-back-up" /></button>
            <button className="bCtl" title="Reset all moves this turn" disabled={!totalQueued || !!anim} onClick={resetPlans}><Icon icon="tabler:refresh" /></button>
            <button className="bCtl fight" title="Fight — resolve the round" disabled={!!anim || !!snap.outcome} onClick={onFight}><Icon icon="game-icons:crossed-swords" /></button>
          </div>
        </div>
        <div className="bHand">
          {(selected?.hand || []).map((card) => <MoveCard key={card.iid} card={card} dragSrc={d?.iid === card.iid} onPointerDown={(e) => startDrag(e, card)} />)}
          {selected && (selected.hand || []).length === 0 && <div className="bHandEmpty">No cards in hand.</div>}
        </div>
      </div>

      {/* drag ghost */}
      {d && <div className="bDragGhost" style={{ left: d.x, top: d.y }}><MoveCard card={d.card} /></div>}

      {/* floating combat numbers */}
      {fx.map((f) => <div key={f.key} className={`bFx ${f.kind}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}

      {/* enlarged card view (not the info modal — just the card, bigger) */}
      {zoom && (
        <div className="bZoom" onClick={() => setZoom(null)}>
          <div className="bZoomCard" onClick={(e) => e.stopPropagation()}><CardFace f={zoom.u} side={zoom.side === 'e' ? 'enemy' : 'ally'} /></div>
          <button className="bZoomClose" onClick={() => setZoom(null)}><Icon icon="tabler:x" /></button>
        </div>
      )}

      {!snap && startBattle && null}
    </div>
  );
}
