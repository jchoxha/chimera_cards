// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/CombatScreen — the playable combat view of the    ║
// ║ Vanguard/Peek engine, wearing the "TCG" skin (combat.css).          ║
// ║ LANDSCAPE, no-scroll 3-column arena. Cards are DRAGGED onto a VALID  ║
// ║ target (the card follows the cursor; invalid drops are rejected);    ║
// ║ a TAP on a card opens its info popup. The enemy forecast is shown    ║
// ║ as per-monster action strips (icons+arrows) under the vanguard card  ║
// ║ and on each foe's status bar — each monster shows only the actions   ║
// ║ IT performs. Clicking any unit opens a unified info modal (monster   ║
// ║ card + deck for allies / observed moves for foes). The log persists, ║
// ║ scrolls, minimizes; the dock stays pinned to the bottom.            ║
// ║ Reads ONLY the engine snapshot from combatStore.                    ║
// ║ UPDATE WHEN: combat UX changes. Not the final Phaser view.          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useCombat } from '../../store/combatStore.js';
import { ELEMENT_COLOR } from '../../systems/elements.jsx';
import { computeMatchup } from '../../engine/content/matchups.js';
import { frameStyle } from './frames.js';
import { creatureIcon, creatureColor, cardIcon as axisCardIcon, ATTUNEMENT_ICON, ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import { cardArt } from '../../data/artPool.js';
import { cardText, linkifySegments, KEYWORD_GLOSSARY } from '../../engine/cards/cardText.js';
import { APP_VERSION } from '../../version.js';
import { CHANGELOG } from '../../data/changelog.js';
import { REACTIONS, forecastReactions, REACTION_INFO } from '../../engine/cards/reactions.js';
import { EFFECT_INFO, AXIS_INFO, ATTUNEMENT_SIGNATURE } from '../../data/codex.js';
import { factorInfo } from '../../data/factorInfo.js';
import MonsterPage from '../MonsterPage.jsx';
import { CardFace, MiniStatus, ELEMENT_ICON, powerLabel, powerIcon, sizeWord } from './creatureVisuals.jsx';
import DeckDropdown from './DeckDropdown.jsx';
import HandFan from './HandFan.jsx';
import CombatFx from './CombatFx.jsx';
import './combat.css';

// ── imperative card reactions (WAAPI on the units' [data-drop-id] nodes) ──────────
// A hit KICKS the target back + flashes it; the attacker LUNGES; block/heal PULSE.
const anim = (el, frames, opts) => { try { el.animate(frames, opts); } catch { /* WAAPI unsupported */ } };
function kickEl(el, dir) {
  anim(el, [{ transform: 'translateX(0) rotate(0)' }, { transform: `translateX(${dir * 14}px) rotate(${dir * 2.5}deg)`, offset: 0.3 }, { transform: 'translateX(0) rotate(0)' }],
    { duration: 380, easing: 'cubic-bezier(.36,.07,.19,.97)' });
}
function lungeEl(el, dir) {
  anim(el, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dir * 18}px,-10px) scale(1.06)`, offset: 0.4 }, { transform: 'translate(0,0) scale(1)' }],
    { duration: 300, easing: 'ease-out' });
}
function flashEl(el) {
  anim(el, [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) contrast(1.15)', offset: 0.12 }, { filter: 'brightness(1)' }], { duration: 300, easing: 'ease-out' });
}
function pulseEl(el, color) {
  anim(el, [{ boxShadow: `0 0 0 ${color}00` }, { boxShadow: `0 0 22px ${color}`, offset: 0.3 }, { boxShadow: `0 0 0 ${color}00` }], { duration: 500, easing: 'ease-out' });
}

const INTENT_ICON = {
  attack: 'game-icons:crossed-swords',
  block: 'game-icons:checked-shield',
  buff: 'game-icons:upgrade',
  debuff: 'game-icons:broken-shield',
  swap: 'game-icons:cycle',
  unknown: 'game-icons:help',
};

function Icon({ icon, ...rest }) {
  return <iconify-icon icon={icon} {...rest}></iconify-icon>;
}

/** mm:ss (or h:mm:ss) elapsed playtime. */
function fmtElapsed(ms) {
  if (ms == null || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
/** Local wall-clock HH:MM:SS for a timestamp. */
function fmtClock(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}


// ── action labelling ────────────────────────────────────────────────────────────

const SIL_ASPECT = { attack: 'Attack', block: 'Block', buff: 'Buff', debuff: 'Debuff', swap: 'Swap' };

function effectAspects(fx) {
  if (!fx) return [];
  const out = [];
  if (fx.dmg) out.push('Attack');
  if (fx.block) out.push('Block');
  if (fx.fortify) out.push('Fortify');
  if (fx.applyStatus && Object.keys(fx.applyStatus).length) out.push('Debuff');
  if (fx.strength || fx.selfStatus) out.push('Buff');
  if (fx.heal) out.push('Heal');
  if (fx.draw) out.push('Draw');
  if (fx.energy) out.push('Energy');
  if (fx.displacement) out.push('Swap');
  return [...new Set(out)];
}

function actionAspects(action) {
  const a = effectAspects(action?.detail?.effects);
  if (a.length) return a;
  const s = SIL_ASPECT[action?.silhouette];
  return s ? [s] : [];
}

function actionTitle(action) {
  const a = actionAspects(action);
  const base = a.length === 0 ? 'Action' : a.length === 1 ? a[0] : 'Special';
  return (action?.revealed ? '' : 'Hidden ') + base;
}

function describeEffectsDetailed(fx) {
  if (!fx) return '—';
  const parts = [];
  if (fx.dmg) parts.push(`Deal ${fx.dmg}${fx.hits > 1 ? `×${fx.hits}` : ''}`);
  if (fx.block) parts.push(`Block ${fx.block}`);
  if (fx.fortify) parts.push(`Fortify ${fx.fortify.block} (${fx.fortify.duration}t)`);
  if (fx.strength) parts.push(`+${fx.strength} Strength`);
  for (const [k, v] of Object.entries(fx.applyStatus ?? {})) parts.push(`${v} ${EFFECT_INFO[k]?.name ?? k}`);
  for (const [k, v] of Object.entries(fx.selfStatus ?? {})) parts.push(`${v} ${EFFECT_INFO[k]?.name ?? k}`);
  if (fx.heal) parts.push(`Heal ${fx.heal}`);
  if (fx.draw) parts.push(`Draw ${fx.draw}`);
  if (fx.energy) parts.push(`+${fx.energy} Energy`);
  return parts.join(' · ') || '—';
}

/** When a power's trigger fires, in plain words. */
const TRIGGER_TIMING = {
  turnStart: 'At the start of each of its turns', turnEnd: 'At the end of each of its turns',
  onPlay: 'When played', onDamageTaken: 'When this creature is hit',
  combatStart: 'At the start of combat', onBlockGained: 'Whenever it gains Block',
};

/** Describe an op-LIST (a power's trigger effects) in readable text. */
function describeOps(ops) {
  if (!Array.isArray(ops) || !ops.length) return '';
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const parts = [];
  for (const o of ops) {
    switch (o.op) {
      case 'damage': parts.push(`Deal ${o.value ?? '?'}${o.hits > 1 ? `×${o.hits}` : ''} damage`); break;
      case 'block': parts.push(`Gain ${o.value ?? '?'} Block`); break;
      case 'heal': parts.push(`Heal ${o.value ?? '?'}`); break;
      case 'buff': parts.push(`+${o.value ?? '?'} ${cap(o.stat) || 'Strength'}`); break;
      case 'debuff': parts.push(`Apply ${o.value ?? ''} ${EFFECT_INFO[o.status]?.name ?? cap(o.status) ?? 'debuff'}`.replace('  ', ' ')); break;
      case 'applyStatus': parts.push(`Apply ${o.value ?? ''} ${EFFECT_INFO[o.status]?.name ?? cap(o.status)}`.replace('  ', ' ')); break;
      case 'draw': parts.push(`Draw ${o.value ?? 1}`); break;
      case 'energy': parts.push(`+${o.value ?? 1} Energy`); break;
      default: parts.push(cap(o.op));
    }
  }
  return parts.join(' · ');
}

function planActionView(action) {
  if (!action) return { icon: 'game-icons:help', text: '?' };
  const icon = INTENT_ICON[action.silhouette] ?? 'game-icons:help';
  if (!action.revealed) return { icon, text: '?' };
  const d = action.detail ?? {};
  switch (action.silhouette) {
    case 'attack': return { icon, text: `${d.value ?? '?'}${d.hits > 1 ? `×${d.hits}` : ''}` };
    case 'block': return { icon, text: `${d.value ?? '?'}` };
    case 'buff': return { icon, text: `+${d.value ?? '?'}` };
    case 'debuff': return { icon, text: 'Weak' };
    case 'swap': return { icon, text: 'SWAP' };
    default: return { icon, text: '?' };
  }
}

function ActionTip({ action, targetName }) {
  const aspects = actionAspects(action);
  return (
    <span className="ptip">
      <b>{actionTitle(action)}</b>
      {aspects.length > 1 && <span className="aspList"><Icon icon="game-icons:scroll-unfurled" /> Includes: {aspects.join(', ')}</span>}
      <span><Icon icon="game-icons:bullseye" /> {targetName}</span>
      {action?.revealed
        ? <em>{describeEffectsDetailed(action.detail?.effects)}</em>
        : <em>Peek to reveal exact numbers</em>}
    </span>
  );
}

/** A per-monster row of forecast icons (with arrows). `tip` enables hover tips. */
function ActionStrip({ actions, targetNameOf, onAction, size = '', tip = false }) {
  if (!actions?.length) return null;
  return (
    <div className={`actStrip ${size}`}>
      {actions.map((a, i) => {
        const iv = planActionView(a);
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="aArrow">→</span>}
            <span className="aIcon"
              onClick={onAction ? (e) => { e.stopPropagation(); onAction(a); } : undefined}>
              <Icon icon={iv.icon} />
              {a.revealed && iv.text !== '?' && <small>{iv.text}</small>}
              {tip && <ActionTip action={a} targetName={targetNameOf ? targetNameOf(a) : ''} />}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── card helpers ────────────────────────────────────────────────────────────────

// These helpers are tolerant of BOTH the legacy flat-effects shape and the
// data-driven CardSpec op-list (Array effects + type/text/attunement).
// data-driven CardSpec: an op-LIST in `effects` OR a power (trigger/passive only,
// no `effects` array). Must match the engine's isCardSpec, or power cards (totems,
// turrets, …) get routed to the legacy describer and render with NO text.
const isSpec = (c) => Array.isArray(c?.effects) || c?.type === 'power';

/** Effective target scope of a card (both shapes). */
function cardScope(c) {
  if (isSpec(c)) {
    const eff = c.effects || [];   // power cards have no `effects` array
    const op = eff.find((o) => o.scope) || eff.find((o) => o.op === 'damage' || o.op === 'debuff');
    return op?.scope || (op ? 'enemyActiveTarget' : 'selfOnlyTarget');
  }
  return c?.effects?.scope || '';
}

/** The card's damage element (its attunement) — what its reactions key on. */
function cardEl(c) {
  const a = c?.attunement;
  return (Array.isArray(a) ? a[0] : a) || c?.element || null;
}

function cardKind(c) {
  if (isSpec(c)) {
    const eff = c.effects || c.trigger?.effects || [];   // fall back to a power's trigger ops
    if (eff.some((o) => o.op === 'damage')) return 'atk';
    if (eff.some((o) => o.op === 'block')) return 'def';
    return 'util';
  }
  const fx = c.effects ?? {};
  if (fx.dmg) return 'atk';
  if (fx.block) return 'def';
  return 'util';
}
// Move art: a bundled pixel illustration (artPool) if available, else the icon.
function MoveArt({ c }) {
  const art = cardArt(c);
  return art ? <img className="artImg" src={art} alt="" /> : <Icon icon={cardIcon(c)} />;
}
function cardIcon(c) {
  if (c.attunement) return axisCardIcon(c);            // new taxonomy: element/effect-based art
  const kind = cardKind(c);
  if (kind === 'atk') return ELEMENT_ICON[c.element] || 'game-icons:sword-clash';
  if (kind === 'def') return 'game-icons:checked-shield';
  return 'game-icons:swap-bag';
}
// Card description: auto-generated from the op-list for CardSpec cards (cardText),
// else the legacy effect describer.
function describe(c) { return isSpec(c) ? cardText(c) : describeEffectsDetailed(c.effects); }

/** Render text with glossary keywords as clickable chips. */
function LinkedText({ text, onKeyword }) {
  return (
    <p className="linkedText">
      {linkifySegments(text).map((seg, i) => (seg.term
        ? <button key={i} className="kw" onClick={() => onKeyword(seg.term)}>{seg.text}</button>
        : <span key={i}>{seg.text}</span>))}
    </p>
  );
}

function cardTargetSide(c) {
  const sc = cardScope(c);
  if (/enemy/i.test(sc)) return 'enemy';
  if (/friendly|self/i.test(sc)) return 'ally';
  if (isSpec(c)) return (c.effects || []).some((o) => o.op === 'damage' || o.op === 'debuff') ? 'enemy' : 'ally';
  if (c?.effects?.dmg || c?.effects?.applyStatus) return 'enemy';
  return 'ally';
}

function MiniCard({ c, onClick }) {
  const f = frameStyle({ element: c.element, rarity: c.rarity });
  return (
    <div className={`frame move tiny ${f.finish}`} style={{ background: f.background }}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(c); } : undefined}>
      {f.holo && <div className="holo" />}
      <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
      <div className="inner">
        <div className={`micon ${cardKind(c)}`}><MoveArt c={c} /></div>
        <div className="mn">{c.name}</div>
        <div className="mt">{describe(c)}</div>
      </div>
    </div>
  );
}

function AllyCard({ m, droppable, dropHover, dropInvalid, onEffect, onInfo }) {
  const extra = `${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}${dropInvalid ? ' dropInvalid' : ''}`;
  return <CardFace f={m} side="ally" onEffect={onEffect} onInfo={onInfo} extraClass={extra} dataId={m.id} dataSide="ally" />;
}

function FoeCard({ e, matchup, droppable, dropHover, dropInvalid, onEffect, onInfo }) {
  const extra = `${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}${dropInvalid ? ' dropInvalid' : ''}`;
  return <CardFace f={e} side="enemy" matchup={matchup} onEffect={onEffect} onInfo={onInfo} extraClass={extra} dataId={e.id} dataSide="enemy" />;
}

// ── mini-fighter (side columns) ─────────────────────────────────────────────────

function MiniFighter({ f, side, vanguard, swapCost, swappable, droppable, dropHover, dropInvalid, planActions, onAction, onClick }) {
  const dead = f.hp <= 0;
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  return (
    <div
      data-drop-id={f.id}
      data-drop-side={side}
      className={`mf ${side}${vanguard ? ' vanguard' : ''}${dead ? ' dead' : ''}${swappable ? ' swappable' : ''}${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}${dropInvalid ? ' dropInvalid' : ''}`}
      onClick={onClick}
      title={`${f.name} — click for details`}
    >
      <div className="mfTop">
        <span className="mfName">
          {vanguard && <Icon icon="game-icons:star-formation" className="vgIcon" />}
          {sizeWord(f.form) ? `${sizeWord(f.form)} ` : ''}{f.name}
        </span>
        {(f.axes && (f.axes.attunement || f.axes.biology))
          ? <Icon className="mfEl" icon={creatureIcon({ biology: f.axes.biology, attunement: f.axes.attunement, types: f.types })} style={{ color: creatureColor({ attunement: f.axes.attunement, types: f.types }) }} />
          : (f.element && ELEMENT_ICON[f.element]) ? <Icon className="mfEl" icon={ELEMENT_ICON[f.element]} style={{ color: ELEMENT_COLOR[f.element] }} /> : null}
      </div>
      <div className="mfHp">
        <i className={pct <= 35 ? 'low' : ''} style={{ width: `${pct}%` }} />
        <em>{f.hp}/{f.maxHp}</em>
      </div>
      <MiniStatus f={f} />
      {planActions?.length > 0 && <ActionStrip actions={planActions} onAction={onAction} size="mini" />}
      {swappable && <span className="mfSwap"><Icon icon="game-icons:cycle" /> {swapCost}</span>}
    </div>
  );
}

// ── combat log ────────────────────────────────────────────────────────────────

function CrLink({ id, nameOf, onEntity }) {
  return <button className="logEnt cr" onClick={() => onEntity({ kind: 'creature', id })}>{nameOf(id)}</button>;
}
/** A small "(friendly)" / "(enemy)" side tag for log lines. */
function SideTag({ side }) {
  return <span className={`logSide ${side}`}>({side})</span>;
}
function FxLink({ id, onEntity }) {
  const nm = EFFECT_INFO[id]?.name ?? id;
  return <button className="logEnt fx" onClick={() => onEntity({ kind: 'effect', id })}>{nm}</button>;
}

function LogLine({ ev, nameOf, sideOf, onEntity }) {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case 'play': {
      if (!p.card) return null;
      const actorSide = p.side === 'player' ? 'friendly' : 'enemy';
      const move = <button className="logEnt mv" onClick={() => onEntity({ kind: 'card', card: p.card })}>{p.card.name}</button>;
      // "(enemy) Voltfang played Cleave against (friendly) Ironhide."
      return (
        <span>
          {p.actorId ? <><SideTag side={actorSide} /> <CrLink id={p.actorId} nameOf={nameOf} onEntity={onEntity} /> played {move}</> : <>{move} played</>}
          {p.targetId && p.targetId !== p.actorId
            ? <> against <SideTag side={sideOf(p.targetId)} /> <CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /></>
            : null}.
        </span>
      );
    }
    case 'damage': {
      const mNote = !p.dot && p.matchup > 1
        ? <button className="logEnt eff" onClick={() => onEntity({ kind: 'matchupNote', good: true })}> — super effective!</button>
        : !p.dot && p.matchup > 0 && p.matchup < 1
          ? <button className="logEnt res" onClick={() => onEntity({ kind: 'matchupNote', good: false })}> — resisted</button>
          : null;
      // Name the damage type (the attack's element), clickable to explain it.
      const elNote = p.element
        ? <> <button className="logEnt elt" onClick={() => onEntity({ kind: 'axis', axis: 'attunement', value: [p.element] })}>{p.element}</button></>
        : null;
      if (p.hpLoss > 0) return <span className="dmg"><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> takes {p.hpLoss}{elNote} damage{p.dot ? ' (over time)' : ''}{mNote}.</span>;
      if (p.absorbedCreature > 0 || p.absorbedFortify > 0) return <span><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> blocks the hit.</span>;
      return null;
    }
    case 'block':
      if (p.amount > 0) return <span><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> gains {p.amount} <FxLink id="block" onEntity={onEntity} />.</span>;
      return null;
    case 'status':
      return <span><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> gains {p.amount} <FxLink id={p.id} onEntity={onEntity} />.</span>;
    case 'heal':
      if (p.amount > 0) return <span className="rx"><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> heals {p.amount}.</span>;
      return null;
    case 'death':
      return <span className="rx"><CrLink id={p.fighterId} nameOf={nameOf} onEntity={onEntity} /> falls.</span>;
    case 'swap':
      return p.forced
        ? <span className="rx">{p.side === 'player' ? 'Your' : 'Enemy'} vanguard falls — forced swap.</span>
        : <span>{p.side === 'player' ? 'You swap in a new vanguard' : 'Enemy swaps vanguard'} (cost {p.cost}).</span>;
    case 'reaction':
      return <span className="rx"><button className="logEnt rxv" onClick={() => onEntity({ kind: 'reaction', verb: p.verb, element: p.element, status: p.status })}>{p.verb}!</button> {p.element} reacts with <FxLink id={p.status} onEntity={onEntity} /> on <CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} />.</span>;
    case 'decay':
      if (!p.buff) return <span className="rx"><FxLink id="decay" onEntity={onEntity} /> finds no buff to sap on <CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} />.</span>;
      return <span className="rx"><FxLink id="decay" onEntity={onEntity} /> saps {p.removed} <FxLink id={p.buff} onEntity={onEntity} /> from <CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} />{p.wiped ? ' — wiped out!' : '.'}</span>;
    case 'peek':
      return <span className="pk">You Peek the enemy’s plan.</span>;
    default:
      return null;
  }
}

/** Combat-log scroll container: auto-sticks to the bottom ONLY while the user is
 *  already near the bottom, so scrolling up to read history isn't yanked back down. */
function LogScroll({ children }) {
  const ref = useRef(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });
  const onScroll = (e) => {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };
  return <div className="logModalBody" ref={ref} onScroll={onScroll}>{children}</div>;
}

function observedMoves(log, fighterId) {
  const seen = new Map();
  for (const ev of log ?? []) {
    if (ev.type === 'play' && ev.payload?.actorId === fighterId && ev.payload?.card) {
      seen.set(ev.payload.card.id, ev.payload.card);
    }
  }
  return [...seen.values()];
}

// ── screen ────────────────────────────────────────────────────────────────────

// Which Codex tab an info-modal kind corresponds to (for the "Open in Codex" link).
const CODEX_TAB = {
  effect: 'statuses', axis: 'axes', reaction: 'reactions', card: 'cards',
  creature: 'bestiary', bestiary: 'bestiary', power: 'keywords',
  matchup: 'systems', matchupNote: 'systems',
};

export default function CombatScreen({ onMenu, onRestart, embedded, onCodex } = {}) {
  const { snap, log, startCombat, play, swap, peekAll, endTurn, endTurnAnimated, enemyActing, reorderHand, reward, rollReward, startedAt } = useCombat();
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Unified info modal is a STACK: opening a modal (or clicking a link inside one)
  // PUSHES on top; closing (X / click-out) POPS one level back to the modal beneath.
  const [infoStack, setInfoStack] = useState([]);
  const setInfo = (x) => setInfoStack((s) => (x ? [...s, x] : s.slice(0, -1)));
  const [kwTerm, setKwTerm] = useState(null);  // glossary keyword selected inside the card modal
  const [notice, setNotice] = useState(null);
  // Live hand-drag state reported by HandFan (react-spring/use-gesture) — only used
  // to HIGHLIGHT which unit the lifted card is hovering. The physics/reorder/play
  // all live inside HandFan; CombatScreen just reacts to the reported drag.
  const [handDrag, setHandDrag] = useState(null);   // { dragId, overUnitId, valid } | null
  const [fx, setFx] = useState([]);               // spring FX items (projectiles / bursts / numbers)
  const seenRef = useRef(0);                      // # of log events already turned into FX
  const [turnBanner, setTurnBanner] = useState(null);  // transient "YOUR TURN" / "ENEMY TURN" sweep
  const prevPhaseRef = useRef(null);
  const [dealKey, setDealKey] = useState(0);           // bumped when a fresh hand is dealt → replays the deal-in animation

  // Auto-start only the standalone demo (no host shell driving setup like the app menu).
  useEffect(() => { if (!snap && !onMenu) startCombat(); }, [snap, startCombat, onMenu]);

  // Live playtime clock (ticks once a second; stops at end of combat).
  const combatOver = snap?.phase === 'victory' || snap?.phase === 'defeat';
  useEffect(() => {
    if (!startedAt || combatOver) return undefined;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, combatOver]);

  // Turn NEW combat-log events into spring FX: a cast PROJECTILE flies attacker→
  // target, the target RECOILS + flashes, the attacker LUNGES, an impact BURST
  // rings out, and the damage/heal/block number POPS. Anchored to each unit's
  // on-screen card via its data-drop-id (the big featured card is preferred).
  useEffect(() => {
    const evs = log ?? [];
    if (seenRef.current > evs.length) seenRef.current = 0;   // combat restarted → log reset
    const fresh = evs.slice(seenRef.current);
    seenRef.current = evs.length;
    if (!fresh.length) return undefined;
    const timers = [];
    const raf = requestAnimationFrame(() => {
      const items = [];
      let lastActor = null;
      let n = 0;
      const key = () => `fx-${Date.now()}-${n++}`;
      const nodeOf = (id) => document.querySelector(`.combat[data-drop-id="${id}"]`) || document.querySelector(`[data-drop-id="${id}"]`);
      const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; };
      const colorFor = (elname) => ATTUNEMENT_COLOR[elname] || ELEMENT_COLOR[elname] || '#ffd34d';
      for (const ev of fresh) {
        const p = ev.payload ?? {};
        if (ev.type === 'play' && p.actorId) { lastActor = p.actorId; continue; }
        const tEl = p.targetId ? nodeOf(p.targetId) : null;
        if (!tEl) continue;
        const tc = centerOf(tEl);

        if (ev.type === 'damage' && p.hpLoss > 0) {
          const color = colorFor(p.element);
          const enemyTarget = !playerIds.has(p.targetId);
          const aEl = (!p.dot && lastActor) ? nodeOf(lastActor) : null;
          const impactDelay = aEl ? 190 : 0;                 // DoT ticks land instantly (no cast)
          if (aEl) {
            const ac = centerOf(aEl);
            items.push({ key: key(), type: 'proj', x0: ac.x - 13, y0: ac.y - 13, x1: tc.x - 13, y1: tc.y - 13, color });
            lungeEl(aEl, playerIds.has(lastActor) ? -1 : 1);   // attacker lunges toward the target
          }
          items.push({ key: key(), type: 'burst', x: tc.x, y: tc.y, color, delay: impactDelay });
          items.push({ key: key(), type: 'num', x: tc.x, y: tc.y, text: `-${p.hpLoss}`, kind: 'dmg', delay: impactDelay });
          timers.push(setTimeout(() => { kickEl(tEl, enemyTarget ? -1 : 1); flashEl(tEl); }, impactDelay));
        } else if (ev.type === 'heal' && p.amount > 0) {
          items.push({ key: key(), type: 'num', x: tc.x, y: tc.y, text: `+${p.amount}`, kind: 'heal' });
          pulseEl(tEl, '#8ef0a8');
        } else if (ev.type === 'block' && p.amount > 0) {
          items.push({ key: key(), type: 'num', x: tc.x, y: tc.y, text: `+${p.amount}`, kind: 'block' });
          pulseEl(tEl, '#bfe0ff');
        } else if (ev.type === 'reaction') {
          items.push({ key: key(), type: 'burst', x: tc.x, y: tc.y, color: colorFor(p.element) });
          items.push({ key: key(), type: 'num', x: tc.x, y: tc.y - 24, text: `${p.verb}!`, kind: 'react' });
        } else if (ev.type === 'decay') {
          const nm = EFFECT_INFO[p.buff]?.name || p.buff;
          const text = !p.buff ? 'Decay fizzles' : p.wiped ? `${nm} wiped!` : `−${p.removed} ${nm}`;
          items.push({ key: key(), type: 'num', x: tc.x, y: tc.y, text, kind: 'decay' });
        }
      }
      if (items.length) {
        setFx((cur) => [...cur, ...items]);
        timers.push(setTimeout(() => setFx((cur) => cur.filter((f) => !items.some((s) => s.key === f.key))), 1500));
      }
    });
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [log]);
  useEffect(() => { setKwTerm(null); }, [infoStack.length]);  // reset keyword popup when the modal stack changes
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  // Announce each turn handover with a transient banner.
  const phase = snap?.phase;
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (!phase || phase === prev) return undefined;
    if (phase === 'player') setDealKey((k) => k + 1);   // fresh hand → deal-in animation (incl. the opening hand)
    if (phase !== 'player' && phase !== 'enemy') return undefined;
    if (prev === null) return undefined;   // don't announce the initial mount
    setTurnBanner({ key: Date.now(), kind: phase });
    const t = setTimeout(() => setTurnBanner(null), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  if (!snap) return <div className="cmbt">Loading…</div>;

  const { player, enemy, enemyPlan, peekCharges } = snap;
  const activeMon = player.fighters[player.vanguardIndex];
  const activeEnemy = enemy.fighters[enemy.vanguardIndex];
  const allEnemies = enemy.fighters;
  const featured = activeEnemy;

  const isPlayerTurn = snap.phase === 'player';
  const over = snap.phase === 'victory' || snap.phase === 'defeat';

  let matchup = null;
  if (activeMon && featured) {
    // the SAME engine the damage op uses (attunement layer × constitution layer),
    // so the banner never disagrees with the numbers that actually land.
    const m = computeMatchup(activeMon, featured);
    if (m.total > 1) matchup = { good: true, label: 'SUPER EFFECTIVE', atk: m.best ?? activeMon.element, def: featured.element };
    else if (m.total < 1) matchup = { good: false, label: 'RESISTED', atk: m.best ?? activeMon.element, def: featured.element };
  }

  const allFighters = [...player.fighters, ...enemy.fighters];
  const fightersById = new Map(allFighters.map((f) => [f.id, f]));
  const playerIds = new Set(player.fighters.map((f) => f.id));
  const nameOf = (id) => fightersById.get(id)?.name ?? 'Someone';
  const sideOf = (id) => (playerIds.has(id) ? 'friendly' : 'enemy');
  const enemyById = new Map(enemy.fighters.map((f) => [f.id, f]));

  const hand = activeMon?.hand ?? [];
  const allRevealed = enemyPlan.length > 0 && enemyPlan.every((a) => a.revealed);
  const canPeek = isPlayerTurn && peekCharges > 0 && enemyPlan.length > 0 && !allRevealed;

  function planTargetName(action) {
    switch (action.silhouette) {
      case 'attack':
      case 'debuff': return activeMon ? `Your ${activeMon.name}` : 'Your Vanguard';
      case 'block':
      case 'buff': return enemyById.get(action.actor)?.name ?? 'Itself';
      case 'swap': return enemyById.get(action.detail?.incomingFighterId)?.name ?? 'a benched ally';
      default: return '—';
    }
  }
  const openAction = (action) => setInfo({ kind: 'action', action });
  const openCard = (card) => setInfo({ kind: 'card', card });

  function validTargetIds(card) {
    const sc = cardScope(card);
    const pV = player.fighters[player.vanguardIndex];
    const eV = enemy.fighters[enemy.vanguardIndex];
    const livingFoes = enemy.fighters.filter((f) => f.hp > 0);
    const livingAllies = player.fighters.filter((f) => f.hp > 0);
    const ids = new Set();
    const add = (f) => { if (f && f.hp > 0) ids.add(f.id); };
    if (/enemyActive/i.test(sc)) add(eV);
    else if (/friendlyActive|selfOnly/i.test(sc)) add(pV);
    else if (/anyActive/i.test(sc)) { add(eV); add(pV); }
    else if (/flexEnemy|enemyBench|piercingEnemy/i.test(sc)) livingFoes.forEach(add);
    else if (/flexFriendly|friendlyBench|piercingFriendly/i.test(sc)) livingAllies.forEach(add);
    else if (/^any/i.test(sc)) [...livingFoes, ...livingAllies].forEach(add);
    else if (cardTargetSide(card) === 'enemy') add(eV);
    else add(pV);
    return ids;
  }

  const cardUnplayable = (c) => {
    if (!c) return true;
    const shockTax = player.shockTax || 0;
    const effCost = (c.cost === -1 || c.cost === -2) ? c.cost : c.cost + shockTax;
    return !isPlayerTurn || c.cost === -2 || (c.cost !== -1 && effCost > player.energy);
  };
  // HandFan callbacks + drop-highlight state.
  const onPlayCard = (cardId, targetId) => play(cardId, { targetId });
  const onReorderCard = (cardId, toIndex) => reorderHand(cardId, toIndex);
  // Reaction forecast surfaced on the lifted card when it's over a valid target.
  const reactionForecast = (card, unitId) => {
    if (cardKind(card) !== 'atk') return [];
    const tgt = [...enemy.fighters, ...player.fighters].find((f) => f.id === unitId);
    const fx = tgt ? forecastReactions(tgt, cardEl(card)) : [];
    return fx.map((r) => {
      const bits = [];
      if (r.damage) bits.push(`${r.damage} dmg`);
      if (r.heal) bits.push(`heal ${r.heal}`);
      for (const a of r.applied) bits.push(`${EFFECT_INFO[a.id]?.name || a.id} +${a.amount}${a.spread ? ' (spread)' : ''}`);
      return { verb: r.verb, bits: bits.join(', ') };
    });
  };
  const draggingCardId = handDrag?.dragId ?? null;
  const overUnitId = handDrag?.overUnitId ?? null;
  const draggingCard = draggingCardId ? hand.find((c) => c.id === draggingCardId) : null;
  const dragValidIds = draggingCard ? validTargetIds(draggingCard) : null;
  const dropProps = (uid) => ({
    droppable: !!dragValidIds && dragValidIds.has(uid),   // all legal targets glow while dragging
    dropHover: overUnitId === uid && !!handDrag?.valid,
    dropInvalid: overUnitId === uid && !handDrag?.valid,
  });

  return (
    <div className="cmbt land">
      <div className="topbar">
        {onMenu && <button className="pill menuPill" onClick={onMenu} title="Back to menu"><Icon icon="game-icons:hamburger-menu" /> Menu</button>}
        <span className="pill"><Icon icon="game-icons:dungeon-gate" /> The Proving Pit</span>
        <span className="pill">{over ? (snap.phase === 'victory' ? 'Victory' : 'Defeat') : isPlayerTurn ? 'Your turn' : 'Enemy turn'}</span>
        <span className="pill">Turn {snap.turn}</span>
        <span className="pill"><Icon icon="game-icons:stopwatch" /> {fmtElapsed(nowTick - (startedAt ?? nowTick))}</span>
        <span className="pill ver clickable" onClick={() => setInfo({ kind: 'changelog' })} title="View changelog">{APP_VERSION}</span>
      </div>

      <div className="arena">
        {/* LEFT: foes · enemy-intent button (forecast lives in a modal now) */}
        <div className="sideCol foesCol">
          <div className="colHead"><Icon icon="game-icons:daemon-skull" /> Foes</div>
          <div className="miniList">
            {allEnemies.map((e) => (
              <MiniFighter
                key={e.id}
                f={e}
                side="enemy"
                vanguard={e.id === activeEnemy?.id}
                {...dropProps(e.id)}
                onClick={() => setInfo({ kind: 'creature', id: e.id })}
              />
            ))}
          </div>
          <button className={`benchBtn intentBtn${canPeek ? ' ready' : ''}`} onClick={() => setInfo({ kind: 'intent' })}>
            <Icon icon="game-icons:eye-target" /> Enemy Intent
            <span className="benchCount">{peekCharges}</span>
          </button>
        </div>

        {/* CENTER: peek bar · cards (foe strip under vanguard) · hand */}
        <div className="centerCol">
          <div className="cardsRow">
            {featured && (
              <FoeCard
                e={featured}
                matchup={matchup}
                {...dropProps(featured.id)}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
                onInfo={setInfo}
              />
            )}
            <div className="vsMark">VS</div>
            {activeMon && (
              <AllyCard
                m={activeMon}
                {...dropProps(activeMon.id)}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
                onInfo={setInfo}
              />
            )}
          </div>

          <div className="handWrap">
            <HandFan
              cards={hand}
              dealKey={dealKey}
              disabled={!isPlayerTurn || !!enemyActing}
              shockTax={player.shockTax || 0}
              unplayableOf={cardUnplayable}
              validTargetIdsOf={validTargetIds}
              onPlay={onPlayCard}
              onReorder={onReorderCard}
              onTap={openCard}
              onDragState={setHandDrag}
              reactionForecast={reactionForecast}
            />
          </div>
          <div className="playHint">
            {isPlayerTurn
              ? <><Icon icon="game-icons:click" /> DRAG ONTO A TARGET TO PLAY · DRAG WITHIN THE HAND TO REORDER · TAP FOR INFO</>
              : 'ENEMY TURN…'}
          </div>
        </div>

        {/* RIGHT: team · log button · dock (dock pinned to bottom) */}
        <div className="sideCol teamCol">
          <div className="colHead"><Icon icon="game-icons:rosa-shield" /> Your Team</div>
          <div className="miniList">
            {player.fighters.map((m, idx) => {
              const active = idx === player.vanguardIndex;
              const swapCost = player.manualSwapsThisTurn + 1;
              const swappable = !active && m.hp > 0 && isPlayerTurn && player.energy >= swapCost;
              return (
                <MiniFighter
                  key={m.id}
                  f={m}
                  side="ally"
                  vanguard={active}
                  swapCost={swapCost}
                  swappable={swappable}
                  {...dropProps(m.id)}
                  onClick={() => setInfo({ kind: 'creature', id: m.id })}
                />
              );
            })}
          </div>

          <button className="benchBtn" onClick={() => setInfo({ kind: 'log' })}>
            <Icon icon="game-icons:scroll-quill" /> Combat Log
          </button>

          <div className="dock">
            <div className={`orb${player.shockTax > 0 ? ' shocked' : ''}`} key={`orb-${player.energy}`}>
              <b>{player.energy}</b>
              <small>/{player.energyPerTurn}</small>
              <small>ENERGY</small>
              {player.shockTax > 0 && (
                <button className="orbShock" title={`Shock tax: your cards cost +${player.shockTax} energy (one per Shocked ally, capped). Tap for details.`}
                  onClick={() => setInfo({ kind: 'effect', id: 'shock' })}>
                  <Icon icon="game-icons:lightning-arc" /> +{player.shockTax}
                </button>
              )}
            </div>
            <button className="endBtn" disabled={!isPlayerTurn || !!enemyActing}
              onClick={() => (endTurnAnimated ? endTurnAnimated() : endTurn())}>
              END TURN <Icon icon="game-icons:fast-forward-button" />
            </button>
          </div>
        </div>
      </div>

      {notice && <div className="toast"><Icon icon="game-icons:cancel" /> {notice}</div>}

      {/* enemy action announcement — the staged enemy turn names each move as it resolves */}
      {enemyActing && (
        <div key={`ea-${enemyActing.step}`} className="enemyAnnounce">
          <Icon icon={INTENT_ICON[enemyActing.kind] || 'game-icons:crossed-swords'} />
          <span><b>{enemyActing.actor}</b> {enemyActing.label}</span>
        </div>
      )}

      {/* turn handover banner */}
      {turnBanner && (
        <div key={turnBanner.key} className={`turnBanner ${turnBanner.kind}`}>
          {turnBanner.kind === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}
        </div>
      )}

      {/* spring combat FX: cast projectiles, impact bursts, popping numbers */}
      <CombatFx items={fx} />

      {/* unified info popup — a STACK; each level renders OVER the one beneath it,
          and X / click-out pops just the top level back to the modal below. */}
      {infoStack.map((info, _depth) => (
        <div key={_depth} className="miniModalWrap" style={{ zIndex: 80 + _depth * 2 }} onClick={() => setInfo(null)}>
          <div className="miniModal" onClick={(e) => e.stopPropagation()}>
            <button className="modalClose" onClick={() => setInfo(null)}><Icon icon="game-icons:cancel" /></button>

            {info.kind === 'effect' && (() => {
              const e = EFFECT_INFO[info.id] || { name: info.id, icon: 'game-icons:hazard-sign', desc: 'No description.' };
              return <div><div className="infoHead"><Icon icon={e.icon} /> {e.name}</div><p>{e.desc}</p></div>;
            })()}

            {info.kind === 'action' && (() => {
              const a = info.action;
              const aspects = actionAspects(a);
              return (
                <div>
                  <div className="infoHead"><Icon icon={planActionView(a).icon} /> {actionTitle(a)}</div>
                  <div className="infoRow"><Icon icon="game-icons:bullseye" /> Target: {planTargetName(a)}</div>
                  {aspects.length > 1 && <div className="infoRow">Includes: {aspects.join(', ')}</div>}
                  <p>{a.revealed ? describeEffectsDetailed(a.detail?.effects) : 'Spend a Peek charge to reveal the exact numbers of this action.'}</p>
                </div>
              );
            })()}

            {info.kind === 'card' && (() => {
              const c = info.card;
              const att = isSpec(c) ? (Array.isArray(c.attunement) ? c.attunement.join('/') : c.attunement) : c.element;
              return (
                <div className="cardDetail">
                  <div className="cdHead">
                    <span className="cdCost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</span>
                    <span className="cdName">{c.name}</span>
                    <span className={`cdType ${cardKind(c)}`}>{c.type || ''}</span>
                  </div>
                  <div className="cdMeta">{c.rarity || 'common'} · {att || 'colorless'}{c.upgraded ? ' · upgraded' : ''}</div>
                  <div className={`cdArt ${cardKind(c)}`}><MoveArt c={c} /></div>
                  <LinkedText text={describe(c)} onKeyword={setKwTerm} />
                  {kwTerm && <div className="kwDef"><b>{kwTerm}</b><span>{KEYWORD_GLOSSARY[kwTerm]}</span></div>}
                  <p className="cdHint">Tap a highlighted keyword for its meaning.</p>
                </div>
              );
            })()}

            {info.kind === 'axis' && (() => {
              const vals = Array.isArray(info.value) ? info.value : [info.value].filter(Boolean);
              const head = AXIS_INFO[info.axis] || { name: info.axis, icon: 'game-icons:perspective-dice-six-faces-random', desc: '' };
              return (
                <div>
                  <div className="infoHead"><Icon icon={head.icon} /> {head.name}: {vals.join(' / ') || '—'}</div>
                  <p>{head.desc}</p>
                  {info.axis === 'attunement' && vals.map((v) => {
                    const rx = REACTIONS[v] ? Object.entries(REACTIONS[v]) : [];
                    return (
                      <div className="axAtt" key={v}>
                        <div className="infoRow">
                          <Icon icon={ATTUNEMENT_ICON[v] || 'game-icons:rosa-shield'} style={{ color: ATTUNEMENT_COLOR[v] }} />
                          {v}{ATTUNEMENT_SIGNATURE[v] ? ` — signature status: ${ATTUNEMENT_SIGNATURE[v]}` : ''}
                        </div>
                        {rx.length > 0 && (
                          <div className="axReacts">
                            <b>Reactions</b> (hit a status with {v}):
                            <ul>{rx.map(([st, cell]) => (
                              <li key={st}>
                                <button className="rxVerb logEnt" onClick={() => setInfo({ kind: 'reaction', verb: cell.verb, element: v, status: st })}>{cell.verb}</button>
                                {' '}— vs <FxLink id={st} onEntity={setInfo} />
                              </li>
                            ))}</ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {info.kind === 'factor' && (() => {
              const fi = factorInfo(info.tag);
              if (!fi) return <div><div className="infoHead">{info.tag}</div><p>No details for this trait yet.</p></div>;
              return (
                <div>
                  <div className="infoHead"><Icon icon={fi.icon} /> {fi.tag} <span className="clVer">{fi.kindLabel}</span></div>
                  <p>{fi.theme}</p>
                  <div className="rewardRow" style={{ flexWrap: 'wrap' }}>
                    {fi.cards.map((c) => <MiniCard key={c.id} c={c} onClick={openCard} />)}
                  </div>
                  <p className="cdHint">These moves join the creature’s card pool because of this {fi.kind === 'weapon' ? 'weapon' : 'trait'}.</p>
                </div>
              );
            })()}

            {info.kind === 'matchup' && (() => {
              const m = info.matchup;
              return (
                <div>
                  <div className="infoHead">
                    <Icon icon={m.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {m.label}
                  </div>
                  <div className="infoRow"><Icon icon="game-icons:crossed-swords" /> {info.atk || '?'} vs {m.def || '?'}</div>
                  <p>{m.good
                    ? `Your ${info.atk} damage is super effective against ${m.def} — it deals increased damage.`
                    : `Your ${info.atk} damage is resisted by ${m.def} — it deals reduced damage.`}</p>
                </div>
              );
            })()}

            {info.kind === 'reaction' && (
              <div>
                <div className="infoHead">
                  <Icon icon={ATTUNEMENT_ICON[info.element] || 'game-icons:fire'} style={{ color: ATTUNEMENT_COLOR[info.element] }} /> {info.verb}
                </div>
                <div className="infoRow"><Icon icon="game-icons:embrace-energy" /> {info.element} reacts with <FxLink id={info.status} onEntity={setInfo} /></div>
                <p>{REACTION_INFO[info.verb] || 'An elemental reaction — hitting a status with the right element triggers a payoff. Statuses still work on their own; reactions are pure upside.'}</p>
              </div>
            )}

            {info.kind === 'power' && (() => {
              const p = info.power || {};
              const timing = TRIGGER_TIMING[p.on] || (p.passive ? 'Passive — an ongoing rule' : 'While active');
              const eff = describeOps(p.effects);
              return (
                <div>
                  <div className="infoHead"><Icon icon={powerIcon(p.id)} /> {powerLabel(p.id)}</div>
                  <div className="infoRow"><Icon icon="game-icons:hourglass" /> {timing}</div>
                  {eff && <p>{eff}.</p>}
                  {p.passive && <p className="cdHint">Passive rule: {p.passive}.</p>}
                  {!eff && !p.passive && <p>An ongoing power on this creature.</p>}
                </div>
              );
            })()}

            {info.kind === 'bestiary' && (() => {
              const f = fightersById.get(info.id);
              if (!f) return null;
              return <MonsterPage creature={f} />;
            })()}

            {info.kind === 'matchupNote' && (
              <div>
                <div className="infoHead">
                  <Icon icon={info.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {info.good ? 'Super effective' : 'Resisted'}
                </div>
                <p>{info.good
                  ? 'The attack’s element is strong against the target (its attunement and/or biology), so it dealt INCREASED damage.'
                  : 'The attack’s element is weak against the target (its attunement and/or biology), so it dealt REDUCED damage.'}</p>
                <p className="cdHint">Damage matchups come from the attacking card’s element vs the target’s attunement and biology.</p>
              </div>
            )}

            {info.kind === 'changelog' && (
              <div>
                <div className="infoHead"><Icon icon="game-icons:scroll-unfurled" /> Changelog <span className="clVer">{APP_VERSION}</span></div>
                <div className="changelog">
                  {CHANGELOG.map((rel) => (
                    <div className="clRel" key={rel.version}>
                      <div className="clHead"><b>{rel.version}</b><span>{rel.date}</span></div>
                      <ul>{rel.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {info.kind === 'intent' && (() => (
              <div>
                <div className="infoHead"><Icon icon="game-icons:eye-target" /> Enemy Intent</div>
                <div className="intentList">
                  {enemyPlan.length === 0 && <div className="infoRow dim">No actions forecast.</div>}
                  {enemyPlan.map((action, i) => {
                    const iv = planActionView(action);
                    const actor = enemyById.get(action.actor);
                    return (
                      <React.Fragment key={i}>
                        {i > 0 && <div className="intentArrow" aria-hidden="true">↓</div>}
                        <button className={`intentRow${action.revealed ? ' revealed' : ''}`}
                          title={action.revealed ? 'Tap to see the full card' : 'Peek to reveal'}
                          onClick={() => (action.revealed && action.detail?.card ? openCard(action.detail.card) : openAction(action))}>
                          <span className="iStep">{i + 1}</span>
                          <Icon className="iIcon" icon={iv.icon} />
                          <span className="iName">{actor?.name || 'Foe'}</span>
                          <span className="iAct">{action.revealed ? (action.detail?.cardName || actionTitle(action)) : actionTitle(action)}</span>
                          <span className="iTgt"><Icon icon="game-icons:bullseye" /> {planTargetName(action)}</span>
                          {action.revealed && <span className="iNums">{describeEffectsDetailed(action.detail?.effects)}</span>}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
                <button className={`endBtn${canPeek ? '' : ' '}`} style={{ marginTop: 12 }} disabled={!canPeek} onClick={peekAll}>
                  <Icon icon="game-icons:magnifying-glass" /> PEEK — reveal the turn ({peekCharges})
                </button>
                {!canPeek && allRevealed && <p className="cdHint">This turn is already revealed.</p>}
                {!canPeek && !allRevealed && <p className="cdHint">No Peek charges left this combat.</p>}
              </div>
            ))()}

            {info.kind === 'log' && (
              <div>
                <div className="infoHead"><Icon icon="game-icons:scroll-quill" /> Combat Log</div>
                <LogScroll>
                  {(log ?? []).map((ev, i) => {
                    const content = LogLine({ ev, nameOf, sideOf, onEntity: setInfo });
                    if (!content) return null;
                    return (
                      <div key={i} className="logRow">
                        <span className="logTime" title={`local ${fmtClock(ev._ts)}`}>{fmtElapsed((ev._ts ?? startedAt) - startedAt)} · {fmtClock(ev._ts)}</span>
                        {content}
                      </div>
                    );
                  })}
                  {!(log ?? []).some((ev) => LogLine({ ev, nameOf, sideOf, onEntity: setInfo })) && <div className="infoRow dim">No events yet.</div>}
                </LogScroll>
              </div>
            )}

            {info.kind === 'creature' && (() => {
              const f = fightersById.get(info.id);
              if (!f) return null;
              const isAlly = playerIds.has(f.id);
              const idx = player.fighters.findIndex((x) => x.id === f.id);
              const active = isAlly && idx === player.vanguardIndex;
              const swapCost = player.manualSwapsThisTurn + 1;
              const benched = isAlly && !active && f.hp > 0;
              const canSwitch = benched && isPlayerTurn && player.energy >= swapCost;
              const switchWhy = !isPlayerTurn ? 'Only on your turn' : player.energy < swapCost ? `Need ${swapCost}⚡ (have ${player.energy})` : '';
              const cards = isAlly ? (f.deck ?? []) : observedMoves(log, f.id);
              return (
                <div className="infoCreature">
                  <div className="modalCardWrap">
                    <CardFace f={f} side={isAlly ? 'ally' : 'enemy'} onInfo={setInfo}
                      onName={() => setInfo({ kind: 'bestiary', id: f.id })}
                      onEffect={(id) => setInfo({ kind: 'effect', id })} />
                  </div>
                  <p className="cdHint" style={{ textAlign: 'center', margin: '2px 0 0' }}>Tap the name for its bestiary page · tap an axis or status for details.</p>
                  <DeckDropdown
                    cards={cards} onCard={openCard}
                    label={isAlly ? 'Deck' : 'Observed moves'}
                    icon={isAlly ? 'game-icons:card-pickup' : 'game-icons:spy'}
                    empty={isAlly ? 'No cards.' : 'No moves observed yet — they reveal as this foe plays them.'} />
                  {benched && (
                    <button className="endBtn" style={{ margin: '12px auto 0' }} disabled={!canSwitch}
                      title={switchWhy || undefined}
                      onClick={() => { if (canSwitch) { swap(idx); setInfo(null); } }}>
                      <Icon icon="game-icons:cycle" /> SWITCH IN · {swapCost}⚡{switchWhy ? ` (${switchWhy})` : ''}
                    </button>
                  )}
                </div>
              );
            })()}

            {onCodex && CODEX_TAB[info.kind] && (
              <button className="codexLink" onClick={() => onCodex(CODEX_TAB[info.kind])}>
                <Icon icon="game-icons:book-cover" /> Open in Codex
              </button>
            )}
          </div>
        </div>
      ))}

      {/* victory / defeat — suppressed when embedded (the run host owns end-of-fight) */}
      {over && !embedded && (
        <div className="overlay">
          <div className="panel">
            <h1 className={snap.phase === 'defeat' ? 'lose' : ''}>
              {snap.phase === 'victory' ? 'VICTORY' : 'DEFEAT'}
            </h1>
            {snap.phase === 'victory' && !reward && (
              <button className="endBtn" style={{ margin: '0 auto' }} onClick={() => rollReward(3)}>
                <Icon icon="game-icons:open-treasure-chest" /> OPEN REWARD
              </button>
            )}
            {reward && (
              <div className="rewardRow">
                {reward.map((c, i) => <MiniCard key={i} c={c} onClick={openCard} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
              <button className="endBtn" onClick={() => (onRestart ? onRestart() : startCombat())}>NEW FIGHT</button>
              {onMenu && <button className="endBtn" onClick={onMenu}>MENU</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
