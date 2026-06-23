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
import { elementMultiplier, ELEMENT_COLOR, FORMS } from '../../systems/elements.jsx';
import { frameStyle } from './frames.js';
import { creatureIcon, creatureColor, cardIcon as axisCardIcon, ATTUNEMENT_ICON, ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import { cardArt, creatureArt } from '../../data/artPool.js';
import { cardText, linkifySegments, KEYWORD_GLOSSARY } from '../../engine/cards/cardText.js';
import './combat.css';

const ELEMENT_ICON = {
  pyre: 'game-icons:flame', frost: 'game-icons:snowflake-1', hydro: 'game-icons:water-drop',
  charge: 'game-icons:lightning-arc', aero: 'game-icons:wind-slap', stone: 'game-icons:stone-block',
  metal: 'game-icons:metal-bar', crystal: 'game-icons:crystal-cluster', toxin: 'game-icons:poison-bottle',
  flora: 'game-icons:high-grass', beast: 'game-icons:paw-print', lumen: 'game-icons:sun',
  aether: 'game-icons:sparkles', umbra: 'game-icons:moon-bats', void: 'game-icons:vortex',
  blood: 'game-icons:drop',
};

const INTENT_ICON = {
  attack: 'game-icons:crossed-swords',
  block: 'game-icons:checked-shield',
  buff: 'game-icons:upgrade',
  debuff: 'game-icons:broken-shield',
  swap: 'game-icons:cycle',
  unknown: 'game-icons:help',
};

const STANCE_ICON = {
  Rampage: 'game-icons:enrage', Offensive: 'game-icons:sword-brandish', Balanced: 'game-icons:balance',
  Defensive: 'game-icons:shield', 'Full Guard': 'game-icons:fortress',
};
const powerLabel = (id) => id.replace(/^[a-z]+_/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Stance + registered powers, rendered as their own persistent pips (they ARE statuses). */
function extraPips(f) {
  if (!f) return [];
  const out = [];
  const isWarrior = (f.axes?.class || f.class || []).includes?.('Warrior');
  if (f.stance && (f.stance !== 'Balanced' || isWarrior)) {
    out.push({ key: 'stance', cls: 'stance', icon: STANCE_ICON[f.stance] || 'game-icons:sword-brandish', label: `Stance: ${f.stance}`, text: f.stance });
  }
  for (const p of f.powers || []) {
    out.push({ key: `pw-${p.id}`, cls: 'power', icon: 'game-icons:fist', label: powerLabel(p.id) });
  }
  return out;
}

const STATUS_META = {
  strength: { cls: 'str', icon: 'game-icons:biceps' },
  dexterity: { cls: 'str', icon: 'game-icons:gloves' },
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
  bleed: { cls: 'pois', icon: 'game-icons:drop' },
  expose: { cls: 'vuln', icon: 'game-icons:cracked-shield' },
  confuse: { cls: 'weak', icon: 'game-icons:brain' },
  amplify: { cls: 'str', icon: 'game-icons:magic-swirl' },
};

const EFFECT_INFO = {
  block: { name: 'Block', icon: 'game-icons:checked-shield', desc: 'Absorbs incoming damage. Creature-bound — it rides swaps and decays to 0 at the start of its own side’s turn.' },
  strength: { name: 'Strength', icon: 'game-icons:biceps', desc: 'Adds its value to the damage of each hit this creature deals.' },
  dexterity: { name: 'Dexterity', icon: 'game-icons:gloves', desc: 'Adds its value to the Block gained by Block effects.' },
  weak: { name: 'Weak', icon: 'game-icons:broken-shield', desc: 'Deals 25% less attack damage. Counts down by 1 each turn.' },
  vulnerable: { name: 'Vulnerable', icon: 'game-icons:cracked-shield', desc: 'Takes 50% more attack damage. Counts down by 1 each turn.' },
  frail: { name: 'Frail', icon: 'game-icons:shield-bash', desc: 'Gains 25% less Block. Counts down by 1 each turn.' },
  burn: { name: 'Burn', icon: 'game-icons:flame', desc: 'Loses HP equal to its stacks at the end of the opponent’s turn, then decays by 1. Bypasses Block.' },
  poison: { name: 'Poison', icon: 'game-icons:poison-bottle', desc: 'Loses HP equal to its stacks at the end of the opponent’s turn, then decays by 1. Bypasses Block.' },
  regen: { name: 'Regen', icon: 'game-icons:health-normal', desc: 'Heals HP equal to its stacks at the end of the carrier’s own turn, then decays by 1.' },
  chill: { name: 'Chill', icon: 'game-icons:snowflake-1', desc: 'A frost affliction (not yet active this milestone).' },
  soak: { name: 'Soak', icon: 'game-icons:water-drop', desc: 'The next attack against this unit deals +25% per Soak stack, then Soak clears. Stack it up for a devastating blow.' },
  shock: { name: 'Shock', icon: 'game-icons:lightning-arc', desc: 'While this side has Shocked creatures, its Vanguard pays +1 energy per Shocked ally. Each turn it loses HP = stacks; with 2+ Shocked allies it spreads (grows) instead of fading.' },
  decay: { name: 'Decay', icon: 'game-icons:skull-crossed-bones', desc: 'At turn-end: loses HP AND Block equal to stacks, strips 1 stack of EVERY buff, and removes one active Power. Then decays 1.' },
  bleed: { name: 'Bleed', icon: 'game-icons:drop', desc: 'At turn-end loses HP = stacks × the number of times it was hit that turn; if it was not hit, Bleed falls off entirely. Otherwise decays 1.' },
  expose: { name: 'Expose', icon: 'game-icons:cracked-shield', desc: 'While Exposed, ALL hits against this unit ignore Block (not consumed; decays 1/turn). If Expose exceeds its HP, it is forced to the bench and cannot return until HP > Expose (unless it is the last unit).' },
  confuse: { name: 'Confuse', icon: 'game-icons:brain', desc: 'This unit’s next attack is unreliable — it may fizzle, or strike a random target. Consumed per attack.' },
  amplify: { name: 'Amplify', icon: 'game-icons:magic-swirl', desc: 'This unit’s next attack deals +50%, then Amplify clears.' },
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
  const color = ATTUNEMENT_COLOR[el] || ELEMENT_COLOR[el] || '#c9a66b';
  return (
    <div className="elem" style={{ background: `radial-gradient(circle at 38% 30%, #fff6, ${color} 55%, #0006)` }}>
      <Icon icon={ATTUNEMENT_ICON[el] || ELEMENT_ICON[el] || 'game-icons:rosa-shield'} />
      <em>{el}</em>
    </div>
  );
}

function StatChips({ f, onEffect }) {
  const statuses = f?.statuses ?? [];
  const extras = extraPips(f);
  if (!statuses.length && !extras.length) return null;
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
      {extras.map((x) => (
        <span key={x.key} className={`chip ${x.cls}`} title={x.label}><Icon icon={x.icon} /> {x.text || ''}</span>
      ))}
    </>
  );
}

function MiniStatus({ f }) {
  const block = f?.block ?? 0;
  const braced = f?.bracedBlock ?? 0;
  const statuses = f?.statuses ?? [];
  const extras = extraPips(f);
  if (!block && !braced && !statuses.length && !extras.length) return <div className="mfStats empty" />;
  return (
    <div className="mfStats">
      {block > 0 && <span className="pip blk" title={`Block ${block}`}><Icon icon="game-icons:checked-shield" /> {block}</span>}
      {braced > 0 && <span className="pip blk" title={`Braced Block ${braced} (persists)`}><Icon icon="game-icons:fortress" /> {braced}</span>}
      {statuses.map((s) => {
        const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
        return <span key={s.id} className={`pip ${m.cls}`} title={`${s.id} ${s.amount}`}><Icon icon={m.icon} /> {s.amount}</span>;
      })}
      {extras.map((x) => <span key={x.key} className={`pip ${x.cls}`} title={x.label}><Icon icon={x.icon} />{x.text ? ` ${x.text}` : ''}</span>)}
    </div>
  );
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

function actionShort(action) {
  if (action?.revealed) return planActionView(action).text;
  const a = actionAspects(action);
  return a.length > 1 ? 'Special' : (a[0] || '?');
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
const isSpec = (c) => Array.isArray(c?.effects);

/** Effective target scope of a card (both shapes). */
function cardScope(c) {
  if (isSpec(c)) {
    const op = c.effects.find((o) => o.scope) || c.effects.find((o) => o.op === 'damage' || o.op === 'debuff');
    return op?.scope || (op ? 'enemyActiveTarget' : 'selfOnlyTarget');
  }
  return c?.effects?.scope || '';
}

function cardKind(c) {
  if (isSpec(c)) {
    if (c.effects.some((o) => o.op === 'damage')) return 'atk';
    if (c.effects.some((o) => o.op === 'block')) return 'def';
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
  if (isSpec(c)) return c.effects.some((o) => o.op === 'damage' || o.op === 'debuff') ? 'enemy' : 'ally';
  if (c?.effects?.dmg || c?.effects?.applyStatus) return 'enemy';
  return 'ally';
}

function scopeHint(c) {
  const sc = cardScope(c);
  if (/enemyActive/i.test(sc)) return 'can only target the enemy vanguard';
  if (/friendlyActive|selfOnly/i.test(sc)) return 'can only target your active vanguard';
  if (/flexEnemy|enemyBench|piercingEnemy/i.test(sc)) return 'can target any foe';
  if (/flexFriendly|friendlyBench|piercingFriendly/i.test(sc)) return 'can target any ally';
  if (/anyActive/i.test(sc)) return 'can target either vanguard';
  if (/^any/i.test(sc)) return 'can target anyone';
  return cardTargetSide(c) === 'enemy' ? 'can only target the enemy vanguard' : 'can only target your vanguard';
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

// ── the reusable big monster card visual ────────────────────────────────────────

function CardFace({ f, side, matchup, onEffect, extraClass = '', dataId, dataSide }) {
  const isFoe = side === 'enemy';
  const fr = frameStyle({ types: f.types, element: f.element, rarity: f.rarity });
  const scale = { transform: `scale(${artScale(f.form)})` };
  return (
    <div
      data-drop-id={dataId}
      data-drop-side={dataSide}
      className={`frame combat ${fr.finish}${extraClass}`}
      style={{ background: fr.background }}>
      {fr.holo && <div className="holo" />}
      <SizeBadge form={f.form} />
      {elementBadge(f.element)}
      <span className={`sideTag ${isFoe ? 'foe' : 'you'}`}>{isFoe ? 'FOE' : 'YOU'}</span>
      {f.block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {f.block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          {(() => {
            if (f.portrait) return <img className="creature artImg gen" src={f.portrait} style={scale} alt="" />;
            const bio = f.axes?.biology;
            const art = bio ? creatureArt({ id: f.id, biology: bio }) : null;
            if (art) return <img className="creature artImg" src={art} style={scale} alt="" />;
            if (f.icon) return <Icon className="creature" icon={f.icon} style={scale} />;
            if (f.axes && (f.axes.biology || f.axes.attunement || f.axes.class)) {
              return <Icon className="creature" icon={creatureIcon({ biology: f.axes.biology, attunement: f.axes.attunement, class: f.axes.class, types: f.types })} style={{ ...scale, color: creatureColor({ attunement: f.axes.attunement, types: f.types }) }} />;
            }
            return <span className="creature" style={scale}>{f.sprite || (isFoe ? '👾' : '✶')}</span>;
          })()}
        </div>
        <div className="nameBan">{f.name}{f.hp <= 0 ? ' 💀' : ''}</div>
        <HpBar hp={f.hp} maxHp={f.maxHp} />
        {matchup && <div className={`match ${matchup.good ? 'good' : 'bad'}`}>
          <Icon icon={matchup.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {matchup.label}
        </div>}
        <div className="stats"><StatChips f={f} onEffect={onEffect} /></div>
      </div>
    </div>
  );
}

function AllyCard({ m, droppable, dropHover, dropInvalid, onEffect }) {
  const extra = `${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}${dropInvalid ? ' dropInvalid' : ''}`;
  return <CardFace f={m} side="ally" onEffect={onEffect} extraClass={extra} dataId={m.id} dataSide="ally" />;
}

function FoeCard({ e, matchup, droppable, dropHover, dropInvalid, onEffect }) {
  const extra = `${droppable ? ' droppable' : ''}${dropHover ? ' dropHover' : ''}${dropInvalid ? ' dropInvalid' : ''}`;
  return <CardFace f={e} side="enemy" matchup={matchup} onEffect={onEffect} extraClass={extra} dataId={e.id} dataSide="enemy" />;
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
          {f.name}
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
function FxLink({ id, onEntity }) {
  const nm = EFFECT_INFO[id]?.name ?? id;
  return <button className="logEnt fx" onClick={() => onEntity({ kind: 'effect', id })}>{nm}</button>;
}

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

const DRAG_THRESHOLD = 6; // px the pointer must move before a tap becomes a drag

export default function CombatScreen({ onMenu, onRestart, embedded } = {}) {
  const { snap, log, startCombat, play, swap, peekAll, endTurn, reward, rollReward } = useCombat();
  const [logOpen, setLogOpen] = useState(true);
  const [info, setInfo] = useState(null);
  const [kwTerm, setKwTerm] = useState(null);  // glossary keyword selected inside the card modal
  const [notice, setNotice] = useState(null);
  const [drag, setDrag] = useState(null);   // { card, side, validIds, x, y, overId, moved }
  const dragRef = useRef(null);
  const logBodyRef = useRef(null);

  // Auto-start only the standalone demo (no host shell driving setup like the app menu).
  useEffect(() => { if (!snap && !onMenu) startCombat(); }, [snap, startCombat, onMenu]);
  useEffect(() => { setKwTerm(null); }, [info]);  // reset keyword popup when the modal target changes
  useEffect(() => {
    if (logOpen && logBodyRef.current) logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
  }, [log, logOpen]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  if (!snap) return <div className="cmbt">Loading…</div>;

  const { player, enemy, enemyPlan, peekCharges } = snap;
  const activeMon = player.fighters[player.vanguardIndex];
  const activeEnemy = enemy.fighters[enemy.vanguardIndex];
  const allEnemies = enemy.fighters;
  const featured = activeEnemy;

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
  const playerIds = new Set(player.fighters.map((f) => f.id));
  const nameOf = (id) => fightersById.get(id)?.name ?? 'Someone';
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

  // ── drag-to-target (tap = info, drag = play; the card follows the cursor) ─────
  function onCardPointerDown(e, card, unplayable) {
    if (over) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const d = {
      card, unplayable, side: cardTargetSide(card), validIds: validTargetIds(card),
      x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, overId: null, moved: false,
    };
    dragRef.current = d;
    setDrag({ ...d });
  }
  function onCardPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) d.moved = true;
    if (d.moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dz = el && el.closest ? el.closest('[data-drop-id]') : null;
      d.overId = dz ? dz.getAttribute('data-drop-id') : null;
    }
    setDrag({ ...d });
  }
  function onCardPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) { openCard(d.card); return; }          // tap → card info
    if (d.unplayable) return;                              // can't play it
    if (d.overId && d.validIds.has(d.overId)) play(d.card.id, { targetId: d.overId });
    else if (d.overId) setNotice(`${d.card.name} ${scopeHint(d.card)}.`);
  }

  const validIds = drag?.validIds ?? null;
  const dragging = !!drag && drag.moved;
  const isDroppable = (id) => dragging && !drag.unplayable && !!validIds && validIds.has(id);
  const isHover = (id) => dragging && drag.overId === id;

  return (
    <div className="cmbt land">
      <div className="topbar">
        {onMenu && <button className="pill menuPill" onClick={onMenu} title="Back to menu"><Icon icon="game-icons:hamburger-menu" /> Menu</button>}
        <span className="pill"><Icon icon="game-icons:dungeon-gate" /> The Proving Pit</span>
        <span className="pill">{over ? (snap.phase === 'victory' ? 'Victory' : 'Defeat') : isPlayerTurn ? 'Your turn' : 'Enemy turn'}</span>
        <span className="pill">Turn {snap.turn}</span>
      </div>

      <div className="arena">
        {/* LEFT: foes (each shows its own forecast strip) */}
        <div className="sideCol foesCol">
          <div className="colHead"><Icon icon="game-icons:daemon-skull" /> Foes</div>
          <div className="miniList">
            {allEnemies.map((e) => (
              <MiniFighter
                key={e.id}
                f={e}
                side="enemy"
                vanguard={e.id === activeEnemy?.id}
                droppable={isDroppable(e.id)}
                dropHover={isHover(e.id) && isDroppable(e.id)}
                dropInvalid={isHover(e.id) && !isDroppable(e.id)}
                planActions={enemyPlan.filter((a) => a.actor === e.id)}
                onAction={openAction}
                onClick={() => setInfo({ kind: 'creature', id: e.id })}
              />
            ))}
          </div>
        </div>

        {/* CENTER: peek bar · cards (foe strip under vanguard) · hand */}
        <div className="centerCol">
          <div className="peekBar">
            <span className="peekLabel"><Icon icon="game-icons:eye-target" /> Enemy turn</span>
            <div className="planSlots">
              {enemyPlan.length === 0 && <span className="planEmpty">—</span>}
              {enemyPlan.map((action, i) => {
                const iv = planActionView(action);
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="planArrow">→</span>}
                    <span className={`planSlot${action.revealed ? ' revealed' : ''}`} onClick={() => openAction(action)}>
                      <Icon icon={iv.icon} />
                      <small>{actionShort(action)}</small>
                      <ActionTip action={action} targetName={planTargetName(action)} />
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

          <div className="cardsRow">
            <div className="foeSide">
              {featured && (
                <FoeCard
                  e={featured}
                  matchup={matchup}
                  droppable={isDroppable(featured.id)}
                  dropHover={isHover(featured.id) && isDroppable(featured.id)}
                  dropInvalid={isHover(featured.id) && !isDroppable(featured.id)}
                  onEffect={(id) => setInfo({ kind: 'effect', id })}
                />
              )}
              <ActionStrip actions={featuredPlan} targetNameOf={planTargetName} onAction={openAction} tip />
            </div>
            <div className="vsMark">VS</div>
            {activeMon && (
              <AllyCard
                m={activeMon}
                droppable={isDroppable(activeMon.id)}
                dropHover={isHover(activeMon.id) && isDroppable(activeMon.id)}
                dropInvalid={isHover(activeMon.id) && !isDroppable(activeMon.id)}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
              />
            )}
          </div>

          <div className="handWrap">
            <div className="hand">
              {hand.map((c, i) => {
                const unplayable = !isPlayerTurn || c.cost === -2 || (c.cost !== -1 && c.cost > player.energy);
                const n = hand.length;
                const rot = (i - (n - 1) / 2) * 6;
                const lift = Math.abs(i - (n - 1) / 2) * 4;
                const f = frameStyle({ element: c.element, rarity: c.rarity });
                const isDragging = dragging && drag?.card?.id === c.id;
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
                      <div className={`micon ${cardKind(c)}`}><MoveArt c={c} /></div>
                      <div className="mn">{c.name}</div>
                      <div className="mt">{describe(c)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="playHint">
            {isPlayerTurn
              ? <><Icon icon="game-icons:click" /> DRAG A CARD ONTO ITS TARGET · TAP A CARD FOR INFO</>
              : 'ENEMY TURN…'}
          </div>
        </div>

        {/* RIGHT: team · log · dock (dock pinned to bottom) */}
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
                  droppable={isDroppable(m.id)}
                  dropHover={isHover(m.id) && isDroppable(m.id)}
                  dropInvalid={isHover(m.id) && !isDroppable(m.id)}
                  onClick={() => setInfo({ kind: 'creature', id: m.id })}
                />
              );
            })}
          </div>

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

      {/* dragging ghost — only once it's an actual drag */}
      {dragging && (
        <div className="dragGhost" style={{ left: drag.x, top: drag.y }}>
          <div className={`frame move ${frameStyle({ element: drag.card.element, rarity: drag.card.rarity }).finish}`}
            style={{ background: frameStyle({ element: drag.card.element, rarity: drag.card.rarity }).background }}>
            <div className="cost">{drag.card.cost === -1 ? 'X' : drag.card.cost}</div>
            <div className="inner">
              <div className={`micon ${cardKind(drag.card)}`}><Icon icon={cardIcon(drag.card)} /></div>
              <div className="mn">{drag.card.name}</div>
            </div>
          </div>
          <div className={`dragHint${drag.overId && !validIds?.has(drag.overId) ? ' bad' : ''}`}>
            {drag.unplayable ? 'Not enough energy'
              : drag.overId
                ? (validIds?.has(drag.overId) ? 'Release to play' : 'Invalid target')
                : `Drag onto a ${drag.side === 'enemy' ? 'foe' : 'ally'}`}
          </div>
        </div>
      )}

      {notice && <div className="toast"><Icon icon="game-icons:cancel" /> {notice}</div>}

      {/* unified info popup */}
      {info && (
        <div className="miniModalWrap" onClick={() => setInfo(null)}>
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
                  <LinkedText text={describe(c)} onKeyword={setKwTerm} />
                  {kwTerm && <div className="kwDef"><b>{kwTerm}</b><span>{KEYWORD_GLOSSARY[kwTerm]}</span></div>}
                  <p className="cdHint">Tap a highlighted keyword for its meaning.</p>
                </div>
              );
            })()}

            {info.kind === 'creature' && (() => {
              const f = fightersById.get(info.id);
              if (!f) return null;
              const isAlly = playerIds.has(f.id);
              const idx = player.fighters.findIndex((x) => x.id === f.id);
              const active = isAlly && idx === player.vanguardIndex;
              const swapCost = player.manualSwapsThisTurn + 1;
              const canSwitch = isAlly && !active && f.hp > 0 && isPlayerTurn && player.energy >= swapCost;
              const cards = isAlly ? (f.deck ?? []) : observedMoves(log, f.id);
              return (
                <div className="infoCreature">
                  <div className="modalCardWrap">
                    <CardFace f={f} side={isAlly ? 'ally' : 'enemy'} onEffect={(id) => setInfo({ kind: 'effect', id })} />
                  </div>
                  <div className="deckLabel">
                    {isAlly ? <><Icon icon="game-icons:card-pickup" /> Deck ({cards.length})</>
                      : <><Icon icon="game-icons:spy" /> Observed moves ({cards.length})</>}
                  </div>
                  {cards.length === 0
                    ? <div className="infoRow dim">{isAlly ? 'No cards.' : 'No moves observed yet — they reveal as this foe plays them.'}</div>
                    : <div className="deckGrid">{cards.map((c, i) => <MiniCard key={`${c.id}-${i}`} c={c} onClick={openCard} />)}</div>}
                  {canSwitch && (
                    <button className="endBtn" style={{ margin: '12px auto 0' }}
                      onClick={() => { swap(idx); setInfo(null); }}>
                      <Icon icon="game-icons:cycle" /> SWITCH IN · {swapCost}⚡
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

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
