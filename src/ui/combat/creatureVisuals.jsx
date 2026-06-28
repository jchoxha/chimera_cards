// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/creatureVisuals — the shared creature-card visual atoms ║
// ║ (CardFace + status/power pips + badges). Extracted from CombatScreen so   ║
// ║ the SAME card visual can be reused outside combat (the team assembler's    ║
// ║ creature modal). Styled by combat.css. Pure presentation.                  ║
// ║ UPDATE WHEN: the big creature-card markup or its pips change.              ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';
import { frameStyle } from './frames.js';
import { creatureIcon, creatureColor, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, submatrixIcons, specialFactors } from '../../data/axisIcons.js';
import { creatureBiologyName } from '../../data/synthesis.js';
import { creatureArt } from '../../data/artPool.js';
import { ELEMENT_COLOR, FORMS } from '../../systems/elements.jsx';

export function Icon({ icon, ...rest }) {
  return <iconify-icon icon={icon} {...rest}></iconify-icon>;
}

export const ELEMENT_ICON = {
  pyre: 'game-icons:flame', frost: 'game-icons:snowflake-1', hydro: 'game-icons:water-drop',
  charge: 'game-icons:lightning-arc', aero: 'game-icons:wind-slap', stone: 'game-icons:stone-block',
  metal: 'game-icons:metal-bar', crystal: 'game-icons:crystal-cluster', toxin: 'game-icons:poison-bottle',
  flora: 'game-icons:high-grass', beast: 'game-icons:paw-print', lumen: 'game-icons:sun',
  aether: 'game-icons:sparkles', umbra: 'game-icons:moon-bats', void: 'game-icons:vortex',
  blood: 'game-icons:drop',
};

export const STANCE_ICON = {
  Rampage: 'game-icons:enrage', Offensive: 'game-icons:sword-brandish', Balanced: 'game-icons:balance',
  Defensive: 'game-icons:shield', 'Full Guard': 'game-icons:fortress',
};
export const powerLabel = (id) => (id || 'Power').replace(/^[a-z]+_/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Pick a fitting icon for a power from its id keywords (totem/turret/trap/…). */
export function powerIcon(id) {
  const s = String(id || '').toLowerCase();
  if (s.includes('totem')) return 'game-icons:totem';
  if (s.includes('turret') || s.includes('sentry')) return 'game-icons:auto-repair';
  if (s.includes('drone')) return 'game-icons:delivery-drone';
  if (s.includes('trap') || s.includes('mine')) return 'game-icons:wolf-trap';
  if (s.includes('summon') || s.includes('imp') || s.includes('skeleton')) return 'game-icons:summon';
  if (s.includes('construct') || s.includes('golem') || s.includes('wall')) return 'game-icons:stone-tower';
  if (s.includes('companion') || s.includes('hawk') || s.includes('wolf')) return 'game-icons:wolf-head';
  if (s.includes('bloodlust') || s.includes('rage') || s.includes('rampart') || s.includes('juggernaut')) return 'game-icons:enrage';
  if (s.includes('regen') || s.includes('prayer') || s.includes('faith')) return 'game-icons:prayer';
  if (s.includes('channel') || s.includes('overload') || s.includes('arcane')) return 'game-icons:magic-swirl';
  return 'game-icons:embedded-lightning-rune';
}

/** Stance + registered powers, rendered as their own persistent pips (they ARE statuses). */
export function extraPips(f) {
  if (!f) return [];
  const out = [];
  if (f.stance && f.stance !== 'Balanced') {
    out.push({ key: 'stance', cls: 'stance', icon: STANCE_ICON[f.stance] || 'game-icons:sword-brandish', label: `Stance: ${f.stance}`, text: f.stance });
  }
  for (const p of f.powers || []) {
    const pid = p.source ?? p.id;
    out.push({ key: `pw-${pid}`, cls: 'power', icon: powerIcon(pid), label: powerLabel(pid), power: { ...p, id: pid } });
  }
  return out;
}

export const STATUS_META = {
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

export function SizeBadge({ form }) {
  const f = FORMS[form];
  if (!f || !f.label) return null;
  return <div className="size"><span className="bdg">{f.badge}</span>{f.label}</div>;
}
export function artScale(form) { return FORMS[form]?.art ?? 1; }

/** The size word prefixed onto a creature's name ("Large Ironhide"); '' for Regular. */
export function sizeWord(form) { return FORMS[form]?.label || ''; }

/** Top-left "major submatrix" badge: ONE kit icon per biology base (Archetype for
 *  Humanoid, Family for Beast), so a hybrid shows both. `axes` = the card's axes
 *  object; `onClick` opens its info. */
export function SubmatrixBadge({ axes, onClick }) {
  if (!axes) return null;
  const icons = submatrixIcons(axes);
  if (!icons.length) return null;
  return (
    <div className={`submatrix${icons.length > 1 ? ' multi' : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}>
      {icons.map((it) => (
        <span key={it.key} className="smIcon" title={it.label || undefined}><Icon icon={it.icon} /></span>
      ))}
    </div>
  );
}

export function elementBadge(el, onClick) {
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

export function StatChips({ f, onEffect, onPower }) {
  const statuses = f?.statuses ?? [];
  const extras = extraPips(f);
  if (!statuses.length && !extras.length) return null;
  return (
    <>
      {statuses.map((s) => {
        const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
        return (
          <span key={s.id} className={`chip ${m.cls}${onEffect ? ' clickable' : ''}`} title={s.id}
            onClick={onEffect ? (e) => { e.stopPropagation(); onEffect(s.id); } : undefined}>
            <Icon icon={m.icon} /> {s.amount}
          </span>
        );
      })}
      {extras.map((x) => {
        const click = x.power && onPower ? (e) => { e.stopPropagation(); onPower(x.power); } : undefined;
        return (
          <span key={x.key} className={`chip ${x.cls}${click ? ' clickable' : ''}`} title={x.label}
            onClick={click}><Icon icon={x.icon} /> {x.text || ''}</span>
        );
      })}
    </>
  );
}

export function MiniStatus({ f }) {
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

export function HpBar({ hp, maxHp }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  return (
    <div className="hpWrap">
      <div className={`hpFill${pct <= 35 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
      <div className="hpTxt">{hp} / {maxHp}</div>
    </div>
  );
}

/**
 * The big creature card. `onInfo({kind,…})` makes axes/statuses/element/matchup
 * tappable; `onName` overrides the name click (e.g. → bestiary). Used by combat
 * (featured cards + creature modal) AND the team assembler's creature modal.
 */
export function CardFace({ f, side, matchup, onEffect, onInfo, onName, extraClass = '', dataId, dataSide }) {
  const isFoe = side === 'enemy';
  const fr = frameStyle({ types: f.types, element: f.element, rarity: f.rarity });
  const scale = { transform: `scale(${artScale(f.form)})` };
  const seeCreature = onInfo ? (e) => { e.stopPropagation(); onInfo({ kind: 'creature', id: f.id }); } : undefined;
  const nameClick = onName ? (e) => { e.stopPropagation(); onName(); } : seeCreature;
  const axisInfo = (axis) => onInfo && onInfo({ kind: 'axis', axis, value: f.axes?.[axis] });
  const onPower = onInfo ? (p) => onInfo({ kind: 'power', power: p }) : undefined;
  const badgeEl = f.element || f.axes?.attunement?.[0] || null;
  return (
    <div
      data-drop-id={dataId}
      data-drop-side={dataSide}
      className={`frame combat ${fr.finish}${extraClass}`}
      style={{ background: fr.background }}>
      {fr.holo && <div className="holo" />}
      <SubmatrixBadge axes={f.axes} onClick={onInfo && f.axes ? () => onInfo({ kind: 'axis', axis: 'biology', value: f.axes.biology }) : undefined} />
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
        <div className={`nameBan${nameClick ? ' clickable' : ''}`} onClick={nameClick}
          title={onName ? `${f.name} — open bestiary page` : (seeCreature ? `${f.name} — tap for details` : undefined)}>
          {sizeWord(f.form) ? <span className="sizeWord">{sizeWord(f.form)} </span> : null}{f.name}{f.hp <= 0 ? ' 💀' : ''}</div>
        {f.axes && (f.axes.biology || (() => { const sf = specialFactors(f.axes); return sf.length; })()) && (() => {
          const factors = specialFactors(f.axes);
          const bios = Array.isArray(f.axes.biology) ? f.axes.biology : (f.axes.biology ? [f.axes.biology] : []);
          const subs = Array.isArray(f.axes.subtypes) ? f.axes.subtypes : (f.axes.subtypes ? [f.axes.subtypes] : []);
          const bioName = creatureBiologyName(bios, subs);
          return (
            <div className="axesLine">
              {bioName
                ? <button className="bioTok" onClick={onInfo ? (e) => { e.stopPropagation(); axisInfo('biology'); } : undefined}
                    title={bios.length > 1 ? bios.join(' + ') : undefined}>{bioName}</button>
                : <span />}
              <span className="factorRow">
                {factors.map((fac) => (
                  <span key={fac.key} className="factorIcon" title={fac.label}><Icon icon={fac.icon} /></span>
                ))}
              </span>
            </div>
          );
        })()}
        <div className={onInfo ? 'hpClick' : undefined} onClick={seeCreature}><HpBar hp={f.hp} maxHp={f.maxHp} /></div>
        {matchup && <div className={`match ${matchup.good ? 'good' : 'bad'}${onInfo ? ' clickable' : ''}`}
          onClick={onInfo ? (e) => { e.stopPropagation(); onInfo({ kind: 'matchup', matchup, atk: badgeEl, def: matchup.def }); } : undefined}>
          <Icon icon={matchup.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {matchup.label}
        </div>}
        <div className="stats"><StatChips f={f} onEffect={onEffect} onPower={onPower} /></div>
      </div>
    </div>
  );
}
