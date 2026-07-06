// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/HandFan — the combat hand as a SPRING-PHYSICS fan.      ║
// ║ Built on @react-spring/web + @use-gesture/react (the pmndrs card-fan      ║
// ║ stack) because a TCG hand is a gestural/physics interaction, not a list.  ║
// ║ Each card is its OWN component keyed by IDENTITY (its own spring), so a   ║
// ║ play/reorder never index-swaps content — cards physically glide instead.  ║
// ║ • drag a card → it follows the finger (springs on release);              ║
// ║ • the others re-fan smoothly and CLOSE the gap when it leaves the hand,   ║
// ║   RE-OPEN a slot at the insertion point when it returns;                  ║
// ║ • release over a valid unit → play; over the hand → reorder; else it      ║
// ║   springs back to its correct slot;                                       ║
// ║ • a tap (no drag) opens the card's info.                                  ║
// ║ Targeting uses elementFromPoint on the units' `data-drop-id` (the lifted  ║
// ║ card is pointer-events:none mid-drag so it never blocks the hit-test).    ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSpring, animated, config as springConfig } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { frameStyle } from './frames.js';
import { cardText } from '../../engine/cards/cardText.js';
import { cardArt } from '../../data/artPool.js';
import { cardIcon as axisCardIcon } from '../../data/axisIcons.js';

const RIcon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;
const unitIdOf = (id) => (typeof id === 'string' && id.startsWith('m:') ? id.slice(2) : id);

function cardKind(c) {
  const e = Array.isArray(c?.effects) ? c.effects : [];
  if (e.some((o) => o.op === 'damage')) return 'atk';
  if (e.some((o) => o.op === 'block')) return 'def';
  return 'util';
}
function MoveArt({ c }) {
  const art = cardArt(c);
  return art ? <img className="artImg" src={art} alt="" /> : <RIcon icon={axisCardIcon(c)} />;
}

const ANGLE = 4.5;   // degrees between neighbouring cards
const ARC = 6;       // px each card rides lower toward the edges

/** One hand card: owns a spring that DECLARATIVELY chases its `target` (react-spring
 *  object form → reactive, no in-render side effects). The lifted card follows the
 *  finger (immediate x/y); the rest glide. Mount plays a staggered deal-in from the
 *  deck (mount-only `from`/`delay`). */
function SpringCard({ card, target, dealFrom, dealDelay, dragged, bind, shockTax, unplayable, hint, forecast, badHint }) {
  const first = useRef(true);
  useEffect(() => { first.current = false; }, []);
  const style = useSpring({
    ...(first.current ? { from: { x: dealFrom.x, y: dealFrom.y, rot: -20, sc: 0.55 }, delay: dealDelay } : null),
    x: target.x, y: target.y, rot: target.rot, sc: target.sc,
    immediate: (key) => dragged && (key === 'x' || key === 'y'),
    config: dragged ? { tension: 1100, friction: 45 } : springConfig.gentle,
  });

  const f = frameStyle({ element: card.element, rarity: card.rarity });
  const effCost = (card.cost === -1 || card.cost === -2) ? card.cost : card.cost + shockTax;
  const taxed = shockTax > 0 && card.cost >= 0;
  return (
    <animated.div
      {...bind()}
      className={`frame move handCard ${f.finish}${unplayable ? ' unplayable' : ''}${!unplayable ? ' playable' : ''}${dragged ? ' lifted' : ''}`}
      style={{
        background: f.background,
        x: style.x, y: style.y, scale: style.sc,
        rotateZ: style.rot.to((r) => `${r}deg`),
        zIndex: dragged ? 100 : (10 + target.i),
        touchAction: 'none',
        pointerEvents: dragged ? 'none' : 'auto',
      }}
    >
      {f.holo && <div className="holo" />}
      <div className={`cost${taxed ? ' taxed' : ''}`} title={taxed ? `${card.cost} + ${shockTax} Shock tax` : undefined}>{card.cost === -1 ? 'X' : card.cost === -2 ? '—' : effCost}</div>
      <div className="inner">
        <div className={`micon ${cardKind(card)}`}><MoveArt c={card} /></div>
        <div className="mn">{card.name}</div>
        <div className="mt">{cardText(card)}</div>
      </div>
      {dragged && hint && (
        <div className="handHintWrap">
          <div className={`dragHint${badHint ? ' bad' : ''}`}>{hint}</div>
          {forecast && forecast.length > 0 && (
            <div className="dragReact">
              {forecast.map((r, k) => (
                <div className="rx" key={k}><b>{r.verb}</b>{r.bits ? <span> · {r.bits}</span> : null}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </animated.div>
  );
}

const CARD_W = 92;

export default function HandFan({
  cards = [], disabled = false, dealKey = 0, shockTax = 0,
  unplayableOf = () => false, validTargetIdsOf = () => new Set(),
  onPlay, onReorder, onTap, onDragState, reactionForecast,
}) {
  const ref = useRef(null);
  const [w, setW] = useState(720);
  const [drag, setDrag] = useState(null);   // { id, index, mx, my, overUnit, overHand, gapAt, valid, playable }

  useLayoutEffect(() => {
    const measure = () => { if (ref.current) setW(ref.current.clientWidth); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const N = cards.length;
  const spacing = N > 1 ? Math.max(28, Math.min(70, (w - CARD_W - 20) / (N - 1))) : 0;
  const slot = (pos, total) => {
    const m = (total - 1) / 2;
    return { x: (pos - m) * spacing, y: Math.abs(pos - m) * ARC, rot: (pos - m) * ANGLE };
  };

  // where card index i sits right now, given the current drag
  const targetFor = (i) => {
    if (!drag) return { ...slot(i, N), sc: 1, i };
    if (i === drag.index) {
      const base = slot(i, N);
      return { x: base.x + drag.mx, y: base.y + drag.my, rot: 0, sc: 1.14, i };
    }
    const others = [];
    for (let k = 0; k < N; k++) if (k !== drag.index) others.push(k);
    const op = others.indexOf(i);
    let pos; let total;
    if (drag.gapAt == null) { total = N - 1; pos = op; }        // away → close the gap
    else { total = N; pos = op >= drag.gapAt ? op + 1 : op; }    // over hand → reserve a slot
    return { ...slot(pos, total), sc: 1, i };
  };

  const insertionIndex = (px, dragIndex) => {
    const c = ref.current?.getBoundingClientRect();
    if (!c) return dragIndex;
    const cx = c.left + c.width / 2;
    let idx = 0;
    for (let k = 0; k < N; k++) {
      if (k === dragIndex) continue;
      if (cx + slot(k, N).x < px) idx += 1;   // rest-centre left of the cursor (stable, no feedback loop)
    }
    return idx;
  };

  const onDrag = (card, { down, movement: [mx, my], xy: [px, py], tap, last }) => {
    if (disabled) return;
    if (tap) { onTap && onTap(card); return; }
    const index = cards.findIndex((c) => c.id === card.id);
    if (index < 0) return;

    // Hit-test the pointer even on the release (`last`) event — there `down` is
    // already false but `xy` is the drop point, and the lifted card is still
    // pointer-events:none, so elementFromPoint sees the unit under it.
    let overUnit = null; let overHand = false; let gapAt = index;
    {
      const el = document.elementFromPoint(px, py);
      const dz = el && el.closest ? el.closest('[data-drop-id]') : null;
      overUnit = dz ? dz.getAttribute('data-drop-id') : null;
      const hr = ref.current?.getBoundingClientRect();
      overHand = !overUnit && !!hr && py > hr.top - 80 && py < hr.bottom + 150;
      if (overHand) gapAt = insertionIndex(px, index);
    }
    const uid = overUnit ? unitIdOf(overUnit) : null;
    const valid = uid ? validTargetIdsOf(card).has(uid) : false;
    const playable = !unplayableOf(card);

    if (last) {
      setDrag(null);
      onDragState && onDragState(null);
      if (uid && valid && playable) onPlay && onPlay(card.id, uid);
      else if (overHand) onReorder && onReorder(card.id, gapAt);
      // else: spring back to rest (drag=null → targetFor returns the rest slot)
      return;
    }
    setDrag({ id: card.id, index, mx, my, overUnit, overHand, gapAt: overHand ? gapAt : null, valid, playable });
    onDragState && onDragState({ dragId: card.id, overUnitId: uid, overHand, valid, playable });
  };

  const bindDrag = useDrag((state) => onDrag(state.args[0], state), { filterTaps: true, pointer: { touch: true } });

  const dealFrom = { x: -w * 0.42, y: 190 };
  const hintFor = (card) => {
    if (!drag || drag.id !== card.id) return null;
    if (drag.overUnit && drag.valid && drag.playable) return 'Release to play';
    if (drag.overHand) return 'Release to reorder';
    if (drag.overUnit && !drag.valid) return 'Invalid target';
    if (!drag.playable) return 'Not enough energy';
    return 'Drag onto a target';
  };

  return (
    <div className="handFan" ref={ref}>
      {cards.map((card, i) => {
        const dragged = drag?.id === card.id;
        const forecast = (dragged && drag.overUnit && drag.valid && reactionForecast) ? reactionForecast(card, unitIdOf(drag.overUnit)) : null;
        return (
          <SpringCard
            key={`${dealKey}-${card.id}`}
            card={card}
            target={targetFor(i)}
            dealFrom={dealFrom}
            dealDelay={i * 45}
            dragged={dragged}
            bind={() => bindDrag(card)}
            shockTax={shockTax}
            unplayable={unplayableOf(card)}
            hint={hintFor(card)}
            badHint={dragged && drag.overUnit && !drag.valid}
            forecast={forecast}
          />
        );
      })}
    </div>
  );
}
