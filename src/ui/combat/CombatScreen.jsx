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
import { APP_VERSION } from '../../version.js';
import { CHANGELOG } from '../../data/changelog.js';
import { REACTIONS, forecastReactions, REACTION_INFO } from '../../engine/cards/reactions.js';
import { EFFECT_INFO, AXIS_INFO, ATTUNEMENT_SIGNATURE } from '../../data/codex.js';
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
  // Balanced is the neutral/default stance — never show it as a status pip.
  if (f.stance && f.stance !== 'Balanced') {
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

function SizeBadge({ form }) {
  const f = FORMS[form];
  if (!f || !f.label) return null;
  return <div className="size"><span className="bdg">{f.badge}</span>{f.label}</div>;
}
function artScale(form) { return FORMS[form]?.art ?? 1; }

function elementBadge(el, onClick) {
  if (!el) return null;
  const color = ATTUNEMENT_COLOR[el] || ELEMENT_COLOR[el] || '#c9a66b';
  return (
    <div className={`elem${onClick ? ' clickable' : ''}`} style={{ background: `radial-gradient(circle at 38% 30%, #fff6, ${color} 55%, #0006)` }}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={onClick ? `${el} — tap for details` : undefined}>
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

/** The card's damage element (its attunement) — what its reactions key on. */
function cardEl(c) {
  const a = c?.attunement;
  return (Array.isArray(a) ? a[0] : a) || c?.element || null;
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

function CardFace({ f, side, matchup, onEffect, onInfo, extraClass = '', dataId, dataSide }) {
  const isFoe = side === 'enemy';
  const fr = frameStyle({ types: f.types, element: f.element, rarity: f.rarity });
  const scale = { transform: `scale(${artScale(f.form)})` };
  const seeCreature = onInfo ? (e) => { e.stopPropagation(); onInfo({ kind: 'creature', id: f.id }); } : undefined;
  const axisInfo = (axis) => onInfo && onInfo({ kind: 'axis', axis, value: f.axes?.[axis] });
  // The attunement element (badge) for a generated creature is its primary attunement.
  const badgeEl = f.element || f.axes?.attunement?.[0] || null;
  return (
    <div
      data-drop-id={dataId}
      data-drop-side={dataSide}
      className={`frame combat ${fr.finish}${extraClass}`}
      style={{ background: fr.background }}>
      {fr.holo && <div className="holo" />}
      <SizeBadge form={f.form} />
      {elementBadge(badgeEl, onInfo ? () => onInfo({ kind: 'axis', axis: 'attunement', value: f.axes?.attunement ?? [badgeEl] }) : undefined)}
      <span className={`sideTag ${isFoe ? 'foe' : 'you'}`}>{isFoe ? 'FOE' : 'YOU'}</span>
      {f.block > 0 && (
        <span className={`blockBadge${onEffect ? ' clickable' : ''}`}
          onClick={onEffect ? (e) => { e.stopPropagation(); onEffect('block'); } : undefined}
          title="Block — tap for details">
          <Icon icon="game-icons:checked-shield" /> {f.block}
        </span>
      )}
      <div className="inner">
        <div className="art" onClick={seeCreature} title={seeCreature ? `${f.name} — tap for details` : undefined}>
          {(() => {
            // Image portraits fill the frame (object-fit handles sizing) — do NOT apply the
            // emoji/icon transform-scale, and do NOT render the moon/mountain backdrop behind
            // them (its cream glow would show through any gap → the "white background" bug).
            if (f.portrait) return <img className="creature artImg gen" src={f.portrait} alt="" />;
            const bio = f.axes?.biology;
            const art = bio ? creatureArt({ id: f.id, biology: bio }) : null;
            if (art) return <img className="creature artImg" src={art} alt="" />;
            return <>
              <div className="moon" /><div className="mtn" />
              {f.icon
                ? <Icon className="creature" icon={f.icon} style={scale} />
                : (f.axes && (f.axes.biology || f.axes.attunement || f.axes.class))
                  ? <Icon className="creature" icon={creatureIcon({ biology: f.axes.biology, attunement: f.axes.attunement, class: f.axes.class, types: f.types })} style={{ ...scale, color: creatureColor({ attunement: f.axes.attunement, types: f.types }) }} />
                  : <span className="creature" style={scale}>{f.sprite || (isFoe ? '👾' : '✶')}</span>}
            </>;
          })()}
        </div>
        <div className={`nameBan${seeCreature ? ' clickable' : ''}`} onClick={seeCreature}>{f.name}{f.hp <= 0 ? ' 💀' : ''}</div>
        {f.axes && (f.axes.class || f.axes.biology || f.axes.attunement) && (
          <div className="axesLine">
            {[['class', f.axes.class?.[0]], ['biology', f.axes.biology?.[0]], ['attunement', f.axes.attunement?.[0]]]
              .filter(([, v]) => v)
              .map(([axis, v], i) => (
                <React.Fragment key={axis}>
                  {i > 0 && <span className="axDot"> · </span>}
                  <button className="axTok" onClick={onInfo ? (e) => { e.stopPropagation(); axisInfo(axis); } : undefined}>{v}</button>
                </React.Fragment>
              ))}
          </div>
        )}
        <div className={onInfo ? 'hpClick' : undefined} onClick={seeCreature}><HpBar hp={f.hp} maxHp={f.maxHp} /></div>
        {matchup && <div className={`match ${matchup.good ? 'good' : 'bad'}${onInfo ? ' clickable' : ''}`}
          onClick={onInfo ? (e) => { e.stopPropagation(); onInfo({ kind: 'matchup', matchup, atk: badgeEl, def: matchup.def }); } : undefined}>
          <Icon icon={matchup.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {matchup.label}
        </div>}
        <div className="stats"><StatChips f={f} onEffect={onEffect} /></div>
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
    case 'damage': {
      const mNote = !p.dot && p.matchup > 1
        ? <button className="logEnt eff" onClick={() => onEntity({ kind: 'matchupNote', good: true })}> — super effective!</button>
        : !p.dot && p.matchup > 0 && p.matchup < 1
          ? <button className="logEnt res" onClick={() => onEntity({ kind: 'matchupNote', good: false })}> — resisted</button>
          : null;
      if (p.hpLoss > 0) return <span className="dmg"><CrLink id={p.targetId} nameOf={nameOf} onEntity={onEntity} /> takes {p.hpLoss} damage{p.dot ? ' (over time)' : ''}{mNote}.</span>;
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

const DRAG_THRESHOLD = 6; // px the pointer must move before a tap becomes a drag

export default function CombatScreen({ onMenu, onRestart, embedded } = {}) {
  const { snap, log, startCombat, play, swap, peekAll, endTurn, reward, rollReward, startedAt } = useCombat();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [info, setInfo] = useState(null);   // unified modal: effect/action/card/creature/axis/matchup/intent/log
  const [kwTerm, setKwTerm] = useState(null);  // glossary keyword selected inside the card modal
  const [notice, setNotice] = useState(null);
  const [drag, setDrag] = useState(null);   // { card, side, validIds, x, y, overId, moved }
  const dragRef = useRef(null);
  const [floaters, setFloaters] = useState([]);  // transient floating damage/heal/block numbers
  const seenRef = useRef(0);                      // # of log events already turned into floaters
  const [turnBanner, setTurnBanner] = useState(null);  // transient "YOUR TURN" / "ENEMY TURN" sweep
  const prevPhaseRef = useRef(null);

  // Auto-start only the standalone demo (no host shell driving setup like the app menu).
  useEffect(() => { if (!snap && !onMenu) startCombat(); }, [snap, startCombat, onMenu]);

  // Live playtime clock (ticks once a second; stops at end of combat).
  const combatOver = snap?.phase === 'victory' || snap?.phase === 'defeat';
  useEffect(() => {
    if (!startedAt || combatOver) return undefined;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, combatOver]);

  // Spawn floating numbers + a hit-shake from NEW combat events (anchored to the
  // target's on-screen card via its data-drop-id). Prefers the big featured card.
  useEffect(() => {
    const evs = log ?? [];
    if (seenRef.current > evs.length) seenRef.current = 0;   // combat restarted → log reset
    const fresh = evs.slice(seenRef.current);
    seenRef.current = evs.length;
    if (!fresh.length) return undefined;
    const timers = [];
    const raf = requestAnimationFrame(() => {
      const spawned = [];
      for (const ev of fresh) {
        const p = ev.payload ?? {};
        let text = null; let kind = null;
        if (ev.type === 'damage' && p.hpLoss > 0) { text = `-${p.hpLoss}`; kind = 'dmg'; }
        else if (ev.type === 'heal' && p.amount > 0) { text = `+${p.amount}`; kind = 'heal'; }
        else if (ev.type === 'block' && p.amount > 0) { text = `+${p.amount}`; kind = 'block'; }
        else if (ev.type === 'reaction') { text = `${p.verb}!`; kind = 'react'; }
        else continue;
        const id = p.targetId;
        if (!id) continue;
        const el = document.querySelector(`.combat[data-drop-id="${id}"]`) || document.querySelector(`[data-drop-id="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const key = `${Date.now()}-${spawned.length}-${Math.random().toString(36).slice(2, 6)}`;
        spawned.push({ key, x: r.left + r.width / 2, y: r.top + r.height * 0.34, text, kind });
        if (kind === 'dmg') { el.classList.add('hitShake'); timers.push(setTimeout(() => el.classList.remove('hitShake'), 420)); }
      }
      if (spawned.length) {
        setFloaters((cur) => [...cur, ...spawned]);
        timers.push(setTimeout(() => setFloaters((cur) => cur.filter((f) => !spawned.some((s) => s.key === f.key))), 1000));
      }
    });
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [log]);
  useEffect(() => { setKwTerm(null); }, [info]);  // reset keyword popup when the modal target changes
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
  if (activeMon?.element && featured?.element) {
    const mult = elementMultiplier(activeMon.element, featured.element);
    if (mult > 1) matchup = { good: true, label: 'SUPER EFFECTIVE', atk: activeMon.element, def: featured.element };
    else if (mult < 1) matchup = { good: false, label: 'RESISTED', atk: activeMon.element, def: featured.element };
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
                droppable={isDroppable(e.id)}
                dropHover={isHover(e.id) && isDroppable(e.id)}
                dropInvalid={isHover(e.id) && !isDroppable(e.id)}
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
                droppable={isDroppable(featured.id)}
                dropHover={isHover(featured.id) && isDroppable(featured.id)}
                dropInvalid={isHover(featured.id) && !isDroppable(featured.id)}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
                onInfo={setInfo}
              />
            )}
            <div className="vsMark">VS</div>
            {activeMon && (
              <AllyCard
                m={activeMon}
                droppable={isDroppable(activeMon.id)}
                dropHover={isHover(activeMon.id) && isDroppable(activeMon.id)}
                dropInvalid={isHover(activeMon.id) && !isDroppable(activeMon.id)}
                onEffect={(id) => setInfo({ kind: 'effect', id })}
                onInfo={setInfo}
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
                const isPressed = !dragging && drag?.card?.id === c.id;
                return (
                  <div key={`${c.id}-${i}`}
                    className={`frame move ${f.finish}${unplayable ? ' unplayable' : ''}${isDragging ? ' dragging' : ''}${isPressed ? ' pressed' : ''}${!unplayable ? ' playable' : ''}`}
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
                  droppable={isDroppable(m.id)}
                  dropHover={isHover(m.id) && isDroppable(m.id)}
                  dropInvalid={isHover(m.id) && !isDroppable(m.id)}
                  onClick={() => setInfo({ kind: 'creature', id: m.id })}
                />
              );
            })}
          </div>

          <button className="benchBtn" onClick={() => setInfo({ kind: 'log' })}>
            <Icon icon="game-icons:scroll-quill" /> Combat Log
          </button>

          <div className="dock">
            <div className="orb" key={`orb-${player.energy}`}>
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
              <div className={`micon ${cardKind(drag.card)}`}><MoveArt c={drag.card} /></div>
              <div className="mn">{drag.card.name}</div>
              <div className="mt">{describe(drag.card)}</div>
            </div>
          </div>
          <div className={`dragHint${drag.overId && !validIds?.has(drag.overId) ? ' bad' : ''}`}>
            {drag.unplayable ? 'Not enough energy'
              : drag.overId
                ? (validIds?.has(drag.overId) ? 'Release to play' : 'Invalid target')
                : `Drag onto a ${drag.side === 'enemy' ? 'foe' : 'ally'}`}
          </div>
          {(() => {
            // Reaction forecast: if this damaging card's element would react with a
            // status the hovered target carries, show what fires (verb + magnitude).
            if (!drag.overId || !validIds?.has(drag.overId) || cardKind(drag.card) !== 'atk') return null;
            const tgt = [...enemy.fighters, ...player.fighters].find((f) => f.id === drag.overId);
            const fx = tgt ? forecastReactions(tgt, cardEl(drag.card)) : [];
            if (!fx.length) return null;
            return (
              <div className="dragReact">
                {fx.map((r, i) => {
                  const bits = [];
                  if (r.damage) bits.push(`${r.damage} dmg`);
                  if (r.heal) bits.push(`heal ${r.heal}`);
                  for (const a of r.applied) bits.push(`${EFFECT_INFO[a.id]?.name || a.id} +${a.amount}${a.spread ? ' (spread)' : ''}`);
                  return (
                    <div className="rx" key={i}>
                      <Icon icon={ATTUNEMENT_ICON[r.element] || 'game-icons:fire'} style={{ color: ATTUNEMENT_COLOR[r.element] }} />
                      <b>{r.verb}</b>{bits.length ? <span> · {bits.join(', ')}</span> : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {notice && <div className="toast"><Icon icon="game-icons:cancel" /> {notice}</div>}

      {/* turn handover banner */}
      {turnBanner && (
        <div key={turnBanner.key} className={`turnBanner ${turnBanner.kind}`}>
          {turnBanner.kind === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}
        </div>
      )}

      {/* transient floating numbers (damage / heal / block) anchored to targets */}
      {floaters.length > 0 && (
        <div className="floaters">
          {floaters.map((fl) => (
            <span key={fl.key} className={`floatNum ${fl.kind}`} style={{ left: fl.x, top: fl.y }}>{fl.text}</span>
          ))}
        </div>
      )}

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
                              <li key={st}><span className="rxVerb">{cell.verb}</span> — vs <FxLink id={st} onEntity={setInfo} /></li>
                            ))}</ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                        <button className={`intentRow${action.revealed ? ' revealed' : ''}`} onClick={() => openAction(action)}>
                          <span className="iStep">{i + 1}</span>
                          <Icon className="iIcon" icon={iv.icon} />
                          <span className="iName">{actor?.name || 'Foe'}</span>
                          <span className="iAct">{actionTitle(action)}</span>
                          <span className="iTgt"><Icon icon="game-icons:bullseye" /> {planTargetName(action)}{action.revealed && iv.text !== '?' ? ` · ${iv.text}` : ''}</span>
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
                    const content = LogLine({ ev, nameOf, onEntity: setInfo });
                    if (!content) return null;
                    return (
                      <div key={i} className="logRow">
                        <span className="logTime" title={`local ${fmtClock(ev._ts)}`}>{fmtElapsed((ev._ts ?? startedAt) - startedAt)} · {fmtClock(ev._ts)}</span>
                        {content}
                      </div>
                    );
                  })}
                  {!(log ?? []).some((ev) => LogLine({ ev, nameOf, onEntity: setInfo })) && <div className="infoRow dim">No events yet.</div>}
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
