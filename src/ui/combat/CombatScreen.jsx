// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/CombatScreen — the playable combat view of the    ║
// ║ Vanguard/Peek engine, wearing the "TCG" skin (combat.css).          ║
// ║ LANDSCAPE, no-scroll: a 3-column arena —                            ║
// ║   left  = FOES (mini-fighters, status visible, tap to target)       ║
// ║   center= enemy-plan/Peek bar · featured FOE + active YOU cards ·    ║
// ║           DRAG-to-target hand                                        ║
// ║   right = YOUR TEAM (mini-fighters, tap to swap) · log · dock        ║
// ║ Cards are DRAGGED onto a target (highlighted on hover); swaps ask    ║
// ║ for confirmation; the log persists, scrolls, minimizes, and every    ║
// ║ creature/move/effect name opens an info popup.                       ║
// ║ Reads ONLY the engine snapshot from combatStore.                    ║
// ║ UPDATE WHEN: combat UX changes. Not the final Phaser view.          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useCombat } from '../../store/combatStore.js';
import { elementMultiplier, ELEMENT_COLOR, FORMS } from '../../systems/elements.jsx';
import { frameStyle } from './frames.js';
import './combat.css';

// element → game-icons id for the element badge + attack-card art.
const ELEMENT_ICON = {
  pyre: 'game-icons:flame', frost: 'game-icons:snowflake-1', hydro: 'game-icons:water-drop',
  charge: 'game-icons:lightning-arc', aero: 'game-icons:wind-slap', stone: 'game-icons:stone-block',
  metal: 'game-icons:metal-bar', crystal: 'game-icons:crystal-cluster', toxin: 'game-icons:poison-bottle',
  flora: 'game-icons:high-grass', beast: 'game-icons:paw-print', lumen: 'game-icons:sun',
  aether: 'game-icons:sparkles', umbra: 'game-icons:moon-bats', void: 'game-icons:vortex',
  blood: 'game-icons:drop',
};

// silhouette/intent kind → icon
const INTENT_ICON = {
  attack: 'game-icons:crossed-swords',
  block: 'game-icons:checked-shield',
  buff: 'game-icons:upgrade',
  debuff: 'game-icons:broken-shield',
  swap: 'game-icons:cycle',
  unknown: 'game-icons:help',
};

const STATUS_META = {
  strength: { cls: 'str', icon: 'game-icons:biceps' },
  weak: { cls: 'weak', icon: 'game-icons:broken-shield' },
  vulnerable: { cls: 'vuln', icon: 'game-icons:cracked-shield' },
  frail: { cls: 'frail', icon: 'game-icons:shield-bash' },
  burn: { cls: 'burn', icon: 'game-icons:flame' },
  poison: { cls: 'pois', icon: 'game-icons:poison-bottle' },
  regen: { cls: 'rgn', icon: 'game-icons:health-normal' },
  chill: { cls: 'weak', icon: 'game-icons:snowflake-1' },
  soak: { cls: '', icon: 'game-icons:water-drop' },
  shock: { cls: 'str', icon: 'game-icons:lightning-arc' },
  decay: { cls: 'pois', icon: 'game-icons:skull-crossed-bones' },
};

// Human-readable effect glossary for the click-through info popup. Timings match
// the locked spec §3.2 (DoTs tick at the opponent's turn-end, Regen at the
// carrier's own turn-end; Block is creature-bound and decays each of your turns).
const EFFECT_INFO = {
  block: { name: 'Block', icon: 'game-icons:checked-shield', desc: 'Absorbs incoming damage. Creature-bound — it rides swaps and decays to 0 at the start of its own side’s turn.' },
  strength: { name: 'Strength', icon: 'game-icons:biceps', desc: 'Adds its value to the damage of each hit this creature deals.' },
  weak: { name: 'Weak', icon: 'game-icons:broken-shield', desc: 'Deals 25% less attack damage. Counts down by 1 each turn.' },
  vulnerable: { name: 'Vulnerable', icon: 'game-icons:cracked-shield', desc: 'Takes 50% more attack damage. Counts down by 1 each turn.' },
  frail: { name: 'Frail', icon: 'game-icons:shield-bash', desc: 'Gains 25% less Block. Counts down by 1 each turn.' },
  burn: { name: 'Burn', icon: 'game-icons:flame', desc: 'Loses HP equal to its stacks at the end of the opponent’s turn, then decays by 1. Bypasses Block.' },
  poison: { name: 'Poison', icon: 'game-icons:poison-bottle', desc: 'Loses HP equal to its stacks at the end of the opponent’s turn, then decays by 1. Bypasses Block.' },
  regen: { name: 'Regen', icon: 'game-icons:health-normal', desc: 'Heals HP equal to its stacks at the end of the carrier’s own turn, then decays by 1.' },
  chill: { name: 'Chill', icon: 'game-icons:snowflake-1', desc: 'A frost affliction (not yet active this milestone).' },
  soak: { name: 'Soak', icon: 'game-icons:water-drop', desc: 'A water affliction (not yet active this milestone).' },
  shock: { name: 'Shock', icon: 'game-icons:lightning-arc', desc: 'A charge affliction (not yet active this milestone).' },
  decay: { name: 'Decay', icon: 'game-icons:skull-crossed-bones', desc: 'A void affliction (not yet active this milestone).' },
};

function Icon({ icon, ...rest }) {
  return <iconify-icon icon={icon} {...rest}></iconify-icon>;
}

function SizeBadge({ form }) {
  const f = FORMS[form];
  if (!f || !f.label) return null;
  return <div className="size"><span className="bdg">{f.badge}</span>{f.label}</div>;
}
function artScale(form) { return FORMS[form]?.art ?? 1; }

function elementBadge(el) {
  if (!el) return null;
  const color = ELEMENT_COLOR[el] || '#c9a66b';
  return (
    <div className="elem" style={{ background: `radial-gradient(circle at 38% 30%, #fff6, ${color} 55%, #0006)` }}>
      <Icon icon={ELEMENT_ICON[el] || 'game-icons:rosa-shield'} />
      <em>{el}</em>
    </div>
  );
}

/** Full status chips (big featured cards). Clickable → effect info. */
function StatChips({ statuses, onEffect }) {
  if (!statuses?.length) return null;
  return (
    <>
      {statuses.map((s) => {
        const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
        return (
          <span key={s.id} className={`chip ${m.cls}`} title={s.id}
            onClick={onEffect ? (e) => { e.stopPropagation(); onEffect(s.id); } : undefined}>
            <Icon icon={m.icon} /> {s.amount}
          </span>
        );
      })}
    </>
  );
}

/** Compact block + status pips for the mini-fighter lists. */
function MiniStatus({ block, statuses }) {
  const has = block > 0 || statuses?.length;
  if (!has) return <div className="mfStats empty" />;
  return (
    <div className="mfStats">
      {block > 0 && (
        <span className="pip blk" title={`Block ${block}`}>
          <Icon icon="game-icons:checked-shield" /> {block}
        </span>
      )}
      {(statuses ?? []).map((s) => {
        const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
        return (
          <span key={s.id} className={`pip ${m.cls}`} title={`${s.id} ${s.amount}`}>
            <Icon icon={m.icon} /> {s.amount}
          </span>
        );
      })}
    </div>
  );
}

/** Derive a view label/icon from a PlannedAction (or null). */
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

/** Card visual category from its mechanical effects. */
function cardKind(c) {
  const fx = c.effects ?? {};
  if (fx.dmg) return 'atk';
  if (fx.block) return 'def';
  return 'util';
}
function cardIcon(c) {
  const kind = cardKind(c);
  if (kind === 'atk') return ELEMENT_ICON[c.element] || 'game-icons:sword-clash';
  if (kind === 'def') return 'game-icons:checked-shield';
  return 'game-icons:swap-bag';
}

function describe(c) {
  const fx = c.effects ?? {};
  const parts = [];
  if (fx.dmg) parts.push(`Deal ${fx.dmg}${fx.hits > 1 ? `×${fx.hits}` : ''}`);
  if (fx.block) parts.push(`Block ${fx.block}`);
  if (fx.draw) parts.push(`Draw ${fx.draw}`);
  if (fx.energy) parts.push(`+${fx.energy} Energy`);
  if (fx.strength) parts.push(`+${fx.strength} Strength`);
  for (const [k, v] of Object.entries(fx.applyStatus ?? {})) parts.push(`${v} ${k}`);
  for (const [k, v] of Object.entries(fx.selfStatus ?? {})) parts.push(`${v} ${k}`);
  return parts.join(', ') || '—';
}

/** Which side a card targets when dragged (content is front/self only). */
function cardTargetSide(c) {
  const sc = c?.effects?.scope || '';
  if (/enemy/i.test(sc)) return 'enemy';
  if (/friendly|self/i.test(sc)) return 'ally';
  if (c?.effects?.dmg || c?.effects?.applyStatus) return 'enemy';
  return 'ally';
}

function HpBar({ hp, maxHp }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  return (
    <div className="hpWrap">
      <div className={`hpFill${pct <= 35 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
      <div className="hpTxt">{hp} / {maxHp}</div>
    </div>
  );
}

// ── mini-fighter (side columns) ─────────────────────────────────────────────────

function MiniFighter({ f, side, selected, vanguard, swapCost, swappable, droppable, dropHover, onClick }) {
  const dead = f.hp <= 0;
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  return (
    <div
      data-drop-id={droppable ? f.id : undefined}
      data-drop-side={droppable ? side : undefined}
      className={`mf ${side}${selected ? ' sel' : ''}${vanguard ? ' vanguard' : ''}${dead ? ' dead' : ''}${swappable ? ' swappable' : ''}${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}`}
      onClick={onClick}
      title={f.name}
    >
      <div className="mfTop">
        <span className="mfName">
          {vanguard && <Icon icon="game-icons:star-formation" className="vgIcon" />}
          {f.name}
        </span>
        {f.element && <Icon className="mfEl" icon={ELEMENT_ICON[f.element]} style={{ color: ELEMENT_COLOR[f.element] }} />}
      </div>
      <div className="mfHp">
        <i className={pct <= 35 ? 'low' : ''} style={{ width: `${pct}%` }} />
        <em>{f.hp}/{f.maxHp}</em>
      </div>
      <MiniStatus block={f.block} statuses={f.statuses} />
      {swappable && <span className="mfSwap"><Icon icon="game-icons:cycle" /> {swapCost}</span>}
    </div>
  );
}

// ── big combatant cards (center) ────────────────────────────────────────────────

function AllyCard({ m, droppable, dropHover, onEffect }) {
  const f = frameStyle({ types: m.types, element: m.element, rarity: m.rarity });
  return (
    <div
      data-drop-id={droppable ? m.id : undefined}
      data-drop-side={droppable ? 'ally' : undefined}
      className={`frame combat ${f.finish}${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}`}
      style={{ background: f.background }}>
      {f.holo && <div className="holo" />}
      <SizeBadge form={m.form} />
      {elementBadge(m.element)}
      <span className="sideTag you">YOU</span>
      {m.block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {m.block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          <span className="creature" style={{ transform: `scale(${artScale(m.form)})` }}>{m.sprite || '✶'}</span>
        </div>
        <div className="nameBan">{m.name}{m.hp <= 0 ? ' 💀' : ''}</div>
        <HpBar hp={m.hp} maxHp={m.maxHp} />
        <div className="stats"><StatChips statuses={m.statuses} onEffect={onEffect} /></div>
      </div>
    </div>
  );
}

function FoeCard({ e, matchup, planActions, droppable, dropHover, onEffect }) {
  const iv = planActionView(planActions?.[0] ?? null);
  const f = frameStyle({ element: e.element, rarity: e.rarity });
  const scale = { transform: `scale(${artScale(e.form)})` };
  return (
    <div
      data-drop-id={droppable ? e.id : undefined}
      data-drop-side={droppable ? 'enemy' : undefined}
      className={`frame combat ${f.finish}${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}`}
      style={{ background: f.background }}>
      {f.holo && <div className="holo" />}
      <SizeBadge form={e.form} />
      {elementBadge(e.element)}
      <span className="sideTag foe">FOE</span>
      {e.hp > 0 && planActions?.length > 0 && (
        <span className="intent"><Icon icon={iv.icon} /> {iv.text}</span>
      )}
      {e.block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {e.block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          {e.icon ? <Icon className="creature" icon={e.icon} style={scale} /> : <span className="creature" style={scale}>👾</span>}
        </div>
        <div className="nameBan">{e.name}{e.hp <= 0 ? ' 💀' : ''}</div>
        <HpBar hp={e.hp} maxHp={e.maxHp} />
        {matchup && <div className={`match ${matchup.good ? 'good' : 'bad'}`}>
          <Icon icon={matchup.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {matchup.label}
        </div>}
        <div className="stats"><StatChips statuses={e.statuses} onEffect={onEffect} /></div>
      </div>
    </div>
  );
}

// ── combat log ────────────────────────────────────────────────────────────────

/** A clickable creature name in the log. */
function CrLink({ id, nameOf, onEntity }) {
  return (
    <button className="logEnt cr" onClick={() => onEntity({ kind: 'creature', id })}>{nameOf(id)}</button>
  );
}
/** A clickable effect name in the log. */
function FxLink({ id, onEntity }) {
  const nm = EFFECT_INFO[id]?.name ?? id;
  return <button className="logEnt fx" onClick={() => onEntity({ kind: 'effect', id })}>{nm}</button>;
}

/** Render one engine CombatEvent as a log line (or null to skip). */
function LogLine({ ev, nameOf, onEntity }) {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case 'play':
      return p.card
        ? <span><button className="logEnt mv" onClick={() => onEntity({ kind: 'card', card: p.card })}>{p.card.name}</button> played.</span>
        : null;
    case 'damage':
      if (p.hpLoss > 0) return <span className="dmg"><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> takes {p.hpLoss} damage{p.dot ? ' (over time)' : ''}.</span>;
      if (p.absorbedCreature > 0 || p.absorbedFortify > 0) return <span><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> blocks the hit.</span>;
      return null;
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
    case 'peek':
      return <span className="pk">You Peek the enemy’s plan.</span>;
    default:
      return null;
  }
}

// ── info popup (creature / card / effect) ───────────────────────────────────────

function InfoModal({ info, fightersById, onClose }) {
  if (!info) return null;
  let body = null;
  if (info.kind === 'effect') {
    const e = EFFECT_INFO[info.id] || { name: info.id, icon: 'game-icons:hazard-sign', desc: 'No description.' };
    body = (
      <div className="infoEffect">
        <div className="infoHead"><Icon icon={e.icon} /> {e.name}</div>
        <p>{e.desc}</p>
      </div>
    );
  } else if (info.kind === 'creature') {
    const f = fightersById.get(info.id);
    if (f) body = (
      <div className="infoCreature">
        <div className="infoHead">
          {f.element && <Icon icon={ELEMENT_ICON[f.element]} style={{ color: ELEMENT_COLOR[f.element] }} />} {f.name}
        </div>
        <div className="infoRow">HP {f.hp} / {f.maxHp}{f.block > 0 ? ` · Block ${f.block}` : ''}</div>
        <div className="infoRow">Type: {f.types.map((t) => t.type).join(' / ') || '—'}</div>
        {f.statuses?.length > 0 && (
          <div className="infoChips">{f.statuses.map((s) => {
            const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
            return <span key={s.id} className={`chip ${m.cls}`}><Icon icon={m.icon} /> {EFFECT_INFO[s.id]?.name ?? s.id} {s.amount}</span>;
          })}</div>
        )}
      </div>
    );
  } else if (info.kind === 'card') {
    const c = info.card;
    const f = frameStyle({ element: c.element, rarity: c.rarity });
    body = (
      <div className="infoCard">
        <div className={`frame move ${f.finish}`} style={{ background: f.background, width: 130 }}>
          {f.holo && <div className="holo" />}
          <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
          <div className="inner">
            <div className={`micon ${cardKind(c)}`}><Icon icon={cardIcon(c)} /></div>
            <div className="mn">{c.name}</div>
            <div className="mt">{c.text ?? describe(c)}</div>
          </div>
        </div>
        <div className="infoRow" style={{ marginTop: 8 }}>{c.rarity} · {c.element || 'colorless'}</div>
      </div>
    );
  }
  return (
    <div className="miniModalWrap" onClick={onClose}>
      <div className="miniModal" onClick={(e) => e.stopPropagation()}>
        <button className="modalClose" onClick={onClose}><Icon icon="game-icons:cancel" /></button>
        {body}
      </div>
    </div>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function CombatScreen() {
  const { snap, log, startCombat, play, swap, peekAll, endTurn, reward, rollReward } = useCombat();
  const [target, setTarget] = useState(null);
  const [logOpen, setLogOpen] = useState(true);
  const [info, setInfo] = useState(null);
  const [pendingSwap, setPendingSwap] = useState(null);
  const [drag, setDrag] = useState(null);   // { card, side, x, y, overId }
  const dragRef = useRef(null);
  const logBodyRef = useRef(null);

  useEffect(() => { if (!snap) startCombat(); }, [snap, startCombat]);
  // keep the log pinned to the newest entry
  useEffect(() => {
    if (logOpen && logBodyRef.current) logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
  }, [log, logOpen]);

  if (!snap) return <div className="cmbt">Loading…</div>;

  const { player, enemy, enemyPlan, peekCharges } = snap;
  const activeMon = player.fighters[player.vanguardIndex];
  const activeEnemy = enemy.fighters[enemy.vanguardIndex];
  const allEnemies = enemy.fighters;

  const living = allEnemies.filter((e) => e.hp > 0);
  const targetId = (target && living.some((e) => e.id === target))
    ? target
    : (activeEnemy?.hp > 0 ? activeEnemy.id : living[0]?.id);
  const featured = allEnemies.find((e) => e.id === targetId) || activeEnemy;

  const isPlayerTurn = snap.phase === 'player';
  const over = snap.phase === 'victory' || snap.phase === 'defeat';

  const featuredPlan = featured ? enemyPlan.filter((a) => a.actor === featured.id) : [];

  let matchup = null;
  if (activeMon?.element && featured?.element) {
    const mult = elementMultiplier(activeMon.element, featured.element);
    if (mult > 1) matchup = { good: true, label: 'SUPER EFFECTIVE' };
    else if (mult < 1) matchup = { good: false, label: 'RESISTED' };
  }

  const allFighters = [...player.fighters, ...enemy.fighters];
  const fightersById = new Map(allFighters.map((f) => [f.id, f]));
  const nameOf = (id) => fightersById.get(id)?.name ?? 'Someone';
  const enemyById = new Map(enemy.fighters.map((f) => [f.id, f]));

  const hand = activeMon?.hand ?? [];
  const allRevealed = enemyPlan.length > 0 && enemyPlan.every((a) => a.revealed);
  const canPeek = isPlayerTurn && peekCharges > 0 && enemyPlan.length > 0 && !allRevealed;

  // What does a forecast slot target? (works whether or not it's revealed)
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

  // ── drag-to-target (pointer based; works for mouse + touch) ───────────────────
  function onCardPointerDown(e, card, unplayable) {
    if (!isPlayerTurn || unplayable || over) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const d = { card, side: cardTargetSide(card), x: e.clientX, y: e.clientY, overId: null };
    dragRef.current = d;
    setDrag(d);
  }
  function onCardPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const dz = el && el.closest ? el.closest('[data-drop-id]') : null;
    let overId = null;
    if (dz && dz.getAttribute('data-drop-side') === d.side) overId = dz.getAttribute('data-drop-id');
    d.overId = overId;
    setDrag({ ...d });
  }
  function onCardPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (d && d.overId) play(d.card.id, { targetId: d.overId });
  }

  const dragSide = drag?.side ?? null;

  return (
    <div className="cmbt land">
      {/* topbar */}
      <div className="topbar">
        <span className="pill"><Icon icon="game-icons:dungeon-gate" /> The Proving Pit</span>
        <span className="pill">{over ? (snap.phase === 'victory' ? 'Victory' : 'Defeat') : isPlayerTurn ? 'Your turn' : 'Enemy turn'}</span>
        <span className="pill">Turn {snap.turn}</span>
      </div>

      <div className="arena">
        {/* LEFT: foes */}
        <div className="sideCol foesCol">
          <div className="colHead"><Icon icon="game-icons:daemon-skull" /> Foes</div>
          <div className="miniList">
            {allEnemies.map((e) => (
              <MiniFighter
                key={e.id}
                f={e}
                side="enemy"
                selected={e.id === targetId && e.hp > 0}
                vanguard={e.id === activeEnemy?.id}
                droppable={dragSide === 'enemy' && e.hp > 0}
                dropHover={drag?.overId === e.id}
                onClick={() => e.hp > 0 && setTarget(e.id)}
              />
            ))}
          </div>
        </div>

        {/* CENTER: plan/peek · cards · hand */}
        <div className="centerCol">
          {/* enemy plan + single whole-turn Peek */}
          <div className="peekBar">
            <span className="peekLabel"><Icon icon="game-icons:eye-target" /> Enemy plan</span>
            <div className="planSlots">
              {enemyPlan.length === 0 && <span className="planEmpty">—</span>}
              {enemyPlan.map((action, i) => {
                const iv = planActionView(action);
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="planArrow">→</span>}
                    <span className={`planSlot${action.revealed ? ' revealed' : ''}`}>
                      <Icon icon={iv.icon} />
                      <small>{action.revealed ? iv.text : '???'}</small>
                      <span className="ptip">
                        <b>{action.revealed ? `${action.silhouette}${iv.text && iv.text !== '?' ? ` · ${iv.text}` : ''}` : 'Hidden action'}</b>
                        <span><Icon icon="game-icons:bullseye" /> {planTargetName(action)}</span>
                        {!action.revealed && <em>Peek to reveal numbers</em>}
                      </span>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            <button className="peekBtn" disabled={!canPeek} onClick={peekAll}
              title="Spend 1 Peek charge to reveal the enemy's entire turn">
              <Icon icon="game-icons:magnifying-glass" /> PEEK
              <span className="peekCount">{peekCharges}</span>
            </button>
          </div>

          {/* the two featured cards */}
          <div className="cardsRow">
            {featured && (
              <FoeCard
                e={featured}
                matchup={featured.id === targetId ? matchup : null}
                planActions={featuredPlan}
                droppable={dragSide === 'enemy' && featured.hp > 0}
                dropHover={drag?.overId === featured.id}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
              />
            )}
            <div className="vsMark">VS</div>
            {activeMon && (
              <AllyCard
                m={activeMon}
                droppable={dragSide === 'ally'}
                dropHover={drag?.overId === activeMon.id}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
              />
            )}
          </div>

          {/* drag-to-target hand */}
          <div className="handWrap">
            <div className="hand">
              {hand.map((c, i) => {
                const unplayable = !isPlayerTurn || c.cost === -2 || (c.cost !== -1 && c.cost > player.energy);
                const n = hand.length;
                const rot = (i - (n - 1) / 2) * 6;
                const lift = Math.abs(i - (n - 1) / 2) * 4;
                const f = frameStyle({ element: c.element, rarity: c.rarity });
                const isDragging = drag?.card?.id === c.id;
                return (
                  <div key={`${c.id}-${i}`}
                    className={`frame move ${f.finish}${unplayable ? ' unplayable' : ''}${isDragging ? ' dragging' : ''}`}
                    style={{ background: f.background, transform: `translateY(${lift}px) rotate(${rot}deg)` }}
                    draggable={false}
                    onPointerDown={(e) => onCardPointerDown(e, c, unplayable)}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={onCardPointerUp}>
                    {f.holo && <div className="holo" />}
                    <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
                    <div className="inner">
                      <div className={`micon ${cardKind(c)}`}><Icon icon={cardIcon(c)} /></div>
                      <div className="mn">{c.name}</div>
                      <div className="mt">{c.text ?? describe(c)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="playHint">
            {isPlayerTurn
              ? <><Icon icon="game-icons:click" /> DRAG A CARD ONTO ITS TARGET</>
              : 'ENEMY TURN…'}
          </div>
        </div>

        {/* RIGHT: team · log · dock */}
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
                  onClick={() => swappable && setPendingSwap({ index: idx, cost: swapCost, name: m.name })}
                />
              );
            })}
          </div>

          {/* combat log: persists, scrolls, minimizes; entities clickable */}
          <div className={`logPanel${logOpen ? '' : ' closed'}`}>
            <div className="logHead" onClick={() => setLogOpen((v) => !v)}>
              <span><Icon icon="game-icons:scroll-quill" /> Combat Log</span>
              <Icon icon={logOpen ? 'mdi:chevron-down' : 'mdi:chevron-up'} />
            </div>
            {logOpen && (
              <div className="logBody" ref={logBodyRef}>
                {(log ?? []).map((ev, i) => {
                  const content = LogLine({ ev, nameOf, onEntity: setInfo });
                  return content ? <div key={i} className="logRow">{content}</div> : null;
                })}
              </div>
            )}
          </div>

          <div className="dock">
            <div className="orb">
              <b>{player.energy}</b>
              <small>/{player.energyPerTurn}</small>
              <small>ENERGY</small>
            </div>
            <button className="endBtn" disabled={!isPlayerTurn} onClick={endTurn}>
              END TURN <Icon icon="game-icons:fast-forward-button" />
            </button>
          </div>
        </div>
      </div>

      {/* dragging ghost */}
      {drag && (
        <div className="dragGhost" style={{ left: drag.x, top: drag.y }}>
          <div className={`frame move ${frameStyle({ element: drag.card.element, rarity: drag.card.rarity }).finish}`}
            style={{ background: frameStyle({ element: drag.card.element, rarity: drag.card.rarity }).background }}>
            <div className="cost">{drag.card.cost === -1 ? 'X' : drag.card.cost}</div>
            <div className="inner">
              <div className={`micon ${cardKind(drag.card)}`}><Icon icon={cardIcon(drag.card)} /></div>
              <div className="mn">{drag.card.name}</div>
            </div>
          </div>
          <div className="dragHint">{drag.overId ? 'Release to play' : `Drag onto a ${drag.side === 'enemy' ? 'foe' : 'ally'}`}</div>
        </div>
      )}

      {/* swap confirmation */}
      {pendingSwap && (
        <div className="miniModalWrap" onClick={() => setPendingSwap(null)}>
          <div className="miniModal confirm" onClick={(e) => e.stopPropagation()}>
            <div className="infoHead"><Icon icon="game-icons:cycle" /> Switch Vanguard?</div>
            <p>Bring in <b>{pendingSwap.name}</b> for <b>{pendingSwap.cost}</b> energy? Your current vanguard’s hand is discarded.</p>
            <div className="confirmRow">
              <button className="btnGhost" onClick={() => setPendingSwap(null)}>Cancel</button>
              <button className="endBtn" onClick={() => { swap(pendingSwap.index); setPendingSwap(null); }}>Switch</button>
            </div>
          </div>
        </div>
      )}

      {/* entity info popup */}
      <InfoModal info={info} fightersById={fightersById} onClose={() => setInfo(null)} />

      {/* victory / defeat */}
      {over && (
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
                {reward.map((c, i) => {
                  const f = frameStyle({ element: c.element, rarity: c.rarity });
                  return (
                    <div key={i} className={`frame move ${f.finish}`} style={{ background: f.background }}>
                      {f.holo && <div className="holo" />}
                      <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
                      <div className="inner">
                        <div className={`micon ${cardKind(c)}`}><Icon icon={cardIcon(c)} /></div>
                        <div className="mn">{c.name}</div>
                        <div className="mt">{c.text ?? describe(c)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div><button className="endBtn" style={{ margin: '14px auto 0' }} onClick={() => startCombat()}>NEW FIGHT</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
