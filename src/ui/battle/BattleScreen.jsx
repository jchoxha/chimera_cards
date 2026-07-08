// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/BattleScreen — the COMBAT-V2 board (first slice).      ║
// ║ Top = enemy squads, bottom = friendly. Every creature is a full CardFace ║
// ║ card. Select one of your squads → its hand shows; DRAG a card onto any    ║
// ║ creature card to queue it (spends that squad's energy); Resolve runs one  ║
// ║ simultaneous round. Reads ONLY the store snapshot. Semi-3D/carousel/      ║
// ║ animation polish + real decks come next.                                   ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useBattle } from '../../store/battleStore.js';
import { CardFace } from '../combat/creatureVisuals.jsx';
import './battle.css';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;

/** A creature card in the board (front = full, support = smaller). */
function UnitCard({ u, side, onDropRef }) {
  return (
    <div className={`bUnit${u.isFront ? ' front' : ' support'}${u.dead ? ' dead' : ''}`} data-drop-id={u.id}
      ref={(el) => onDropRef && onDropRef(u.id, el)}>
      <CardFace f={u} side={side === 'e' ? 'enemy' : 'ally'} dataId={u.id} />
    </div>
  );
}

function Squad({ sq, side, selected, onSelect, onDropRef }) {
  const front = sq.units.filter((u) => u.isFront);
  const support = sq.units.filter((u) => !u.isFront);
  return (
    <div className={`bSquad${selected ? ' selected' : ''}${side === 'p' ? ' clickable' : ''}`}
      onClick={side === 'p' && onSelect ? () => onSelect(sq.id) : undefined}>
      <div className="bSquadRow">
        {support.map((u) => <UnitCard key={u.id} u={u} side={side} onDropRef={onDropRef} />)}
        {front.map((u) => <UnitCard key={u.id} u={u} side={side} onDropRef={onDropRef} />)}
      </div>
      {side === 'p' && (
        <div className="bEnergy" title="Squad energy">
          {Array.from({ length: sq.maxEnergy }).map((_, i) => (
            <span key={i} className={`bPip${i < sq.energyLeft ? ' on' : ''}`} />
          ))}
          <em>{sq.energyLeft}/{sq.maxEnergy}</em>
        </div>
      )}
      {sq.plan?.length > 0 && (
        <div className="bPlan">{sq.plan.map((a, i) => <span key={i} className="bPlanChip">{a.card.name}</span>)}</div>
      )}
    </div>
  );
}

export default function BattleScreen() {
  const snap = useBattle((s) => s.snapshot);
  const startBattle = useBattle((s) => s.startBattle);
  const selectSquad = useBattle((s) => s.selectSquad);
  const queueCard = useBattle((s) => s.queueCard);
  const undoQueue = useBattle((s) => s.undoQueue);
  const resolve = useBattle((s) => s.resolve);

  const dropEls = useRef(new Map());
  const setDropRef = (id, el) => { if (el) dropEls.current.set(id, el); else dropEls.current.delete(id); };
  const drag = useRef(null);
  const [d, setD] = useState(null);   // { iid, card, x, y, over }

  useEffect(() => {
    if (!d) return undefined;
    const onMove = (e) => {
      const g = drag.current; if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      g.over = el?.closest('[data-drop-id]')?.getAttribute('data-drop-id') || null;
      setD({ ...g });
    };
    const onUp = () => {
      const g = drag.current; drag.current = null;
      if (g && g.over) queueCard(g.iid, g.over);
      setD(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [d?.iid, queueCard]);

  if (!snap) {
    return <div className="battleScreen empty"><button className="uiBtn go big" onClick={startBattle ? undefined : undefined}>Loading…</button></div>;
  }

  const selected = snap.player.find((sq) => sq.id === snap.selectedSquadId);
  const startDrag = (e, card) => { drag.current = { iid: card.iid, card, x: e.clientX, y: e.clientY, over: null }; setD({ ...drag.current }); };

  return (
    <div className={`battleScreen${d ? ' dragging' : ''}`}>
      {/* TOP — enemy */}
      <section className="bZone enemy">
        {snap.enemy.map((sq) => <Squad key={sq.id} sq={sq} side="e" onDropRef={setDropRef} />)}
      </section>

      {/* MIDDLE — resolve + outcome */}
      <div className="bMid">
        {snap.outcome
          ? <div className={`bOutcome ${snap.outcome === 'p' ? 'win' : 'lose'}`}>{snap.outcome === 'p' ? 'Victory' : snap.outcome === 'e' ? 'Defeat' : 'Draw'}</div>
          : <button className="uiBtn go big bResolve" onClick={resolve}><Icon icon="game-icons:crossed-swords" /> Resolve Round</button>}
      </div>

      {/* BOTTOM — friendly */}
      <section className="bZone player">
        {snap.player.map((sq) => (
          <Squad key={sq.id} sq={sq} side="p" selected={sq.id === snap.selectedSquadId} onSelect={selectSquad} onDropRef={setDropRef} />
        ))}
      </section>

      {/* HAND — selected squad */}
      <div className="bHandBar">
        <div className="bHandLbl">{selected ? `Squad ${snap.player.indexOf(selected) + 1} hand` : 'Select a squad'}
          {selected?.plan?.length > 0 && <button className="uiBtn ghost sm" onClick={() => undoQueue(selected.id)}>↶ Undo</button>}
        </div>
        <div className="bHand">
          {(selected?.hand || []).map((card) => (
            <div key={card.iid} className={`bCard${d?.iid === card.iid ? ' dragSrc' : ''}`}
              onPointerDown={(e) => startDrag(e, card)}>
              <div className="bCardTop"><span className="bCardName">{card.name}</span><span className="bCardCost">{card.cost}</span></div>
              <div className="bCardText">{card.text}</div>
            </div>
          ))}
          {selected && (selected.hand || []).length === 0 && <div className="bHandEmpty">No cards in hand.</div>}
        </div>
      </div>

      {d && (
        <div className="bDragGhost" style={{ left: d.x, top: d.y }}>
          <div className="bCard"><div className="bCardTop"><span className="bCardName">{d.card.name}</span><span className="bCardCost">{d.card.cost}</span></div><div className="bCardText">{d.card.text}</div></div>
        </div>
      )}
    </div>
  );
}
