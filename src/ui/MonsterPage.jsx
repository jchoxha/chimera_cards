// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/MonsterPage — a creature's codex page (lore + gameplay +     ║
// ║ axes/stats). Shared by the Codex "Bestiary" tab AND the in-combat       ║
// ║ "tap the name" modal, so it self-imports its CSS (combat doesn't load    ║
// ║ codex.css). Takes a creature OR a combat Fighter snapshot + its          ║
// ║ bestiary entry (falls back to an axis-derived page when none).           ║
// ╚══════════════════════════════════════════════════════════════════╝

import React from 'react';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor, specialFactors } from '../data/axisIcons.js';
import { biologyDisplayName } from '../data/biologyNaming.js';
import { AXIS_INFO, ATTUNEMENT_SIGNATURE } from '../data/codex.js';
import { bestiaryEntry } from '../data/bestiary.js';
import './MonsterPage.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;
const STAT = [
  ['might', 'MGT', 'Might — multiplies the damage this creature deals'],
  ['guard', 'GRD', 'Guard — multiplies the Block it gains'],
  ['focus', 'FOC', 'Focus — strengthens statuses/buffs it applies to others'],
  ['resolve', 'RSV', 'Resolve — strengthens its own buffs/heals + resists debuffs'],
  ['speed', 'SPD', 'Speed — tempo: extra cards drawn per turn'],
];
const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);

/** Normalise a roster creature OR a combat Fighter snapshot into one shape. */
function normalize(c) {
  const axes = c.axes || {};
  return {
    id: c.id,
    name: c.name,
    klass: arr(axes.class ?? c.class),
    biology: arr(axes.biology ?? c.biology),
    attunement: arr(axes.attunement ?? c.attunement),
    family: axes.family ?? c.family ?? null,
    anatomy: arr(axes.anatomy ?? c.anatomy),
    weapons: arr(axes.weapons ?? c.weapons),
    subtypes: arr(axes.subtypes ?? c.subtypes),
    stats: c.stats || null,
    maxHp: c.maxHp ?? c.hp ?? null,
    portrait: c.portrait ?? c.meta?.portrait ?? null,
    blurb: c.blurb || null,
  };
}

export default function MonsterPage({ creature, entry }) {
  if (!creature) return null;
  const m = normalize(creature);
  const e = entry || bestiaryEntry(m.id, m.name);
  const color = creatureColor({ attunement: m.attunement, class: m.klass, biology: m.biology });
  const icon = creatureIcon({ biology: m.biology, attunement: m.attunement, class: m.klass });
  const att = m.attunement[0];

  const Axis = ({ axis, val, ic, col, extra }) => val ? (
    <div className="mpAxis" title={AXIS_INFO[axis]?.desc}>
      <Icon icon={ic} style={col ? { color: col } : undefined} />
      <span className="mpAxLbl">{AXIS_INFO[axis]?.name || axis}</span>
      <b>{val}</b>{extra ? <span className="mpAxExtra">{extra}</span> : null}
    </div>
  ) : null;

  return (
    <div className="mp">
      <div className="mpHero">
        <div className="mpPortrait" style={{ '--gl': color }}>
          {m.portrait ? <img src={m.portrait} alt="" /> : <Icon className="mpIcon" icon={icon} style={{ color }} />}
        </div>
        <div className="mpHead">
          <h2>{m.name}</h2>
          {e?.title && <div className="mpTitle">{e.title}</div>}
          {(e?.role || m.blurb) && <p className="mpRole">{e?.role || m.blurb}</p>}
        </div>
      </div>

      <div className="mpAxes">
        {m.klass[0]
          ? <Axis axis="class" val={m.klass[0]} ic={ARCHETYPE_ICON[m.klass[0]] || 'game-icons:gladius'} />
          : <Axis axis="class" val="Instinctive" ic={m.biology.includes('Aberration') ? 'game-icons:eyestalk' : 'game-icons:beast-eye'}
              extra="No trained archetype — its moves come from its biology" />}
        <Axis axis="biology" val={biologyDisplayName(m.biology, m.family ? [m.family] : [], m.subtypes) || m.biology[0]}
          ic={BIOLOGY_ICON[m.biology[0]] || 'game-icons:dna2'}
          extra={(() => { const sf = specialFactors(m); return sf.length ? sf.map((f) => f.label).join(' · ') : null; })()} />
        <Axis axis="attunement" val={att} ic={ATTUNEMENT_ICON[att] || 'game-icons:embrace-energy'} col={ATTUNEMENT_COLOR[att]} extra={att && ATTUNEMENT_SIGNATURE[att] ? `→ ${ATTUNEMENT_SIGNATURE[att]}` : null} />
      </div>

      {(m.maxHp || m.stats) && (
        <div className="mpStats">
          {m.maxHp != null && <span className="mpStat hp" title="Max HP">❤ {m.maxHp}</span>}
          {m.stats && STAT.map(([k, lbl, tip]) => (
            <span key={k} className="mpStat" title={tip}>{lbl} {m.stats[k] ?? (k === 'speed' ? 0 : 1)}</span>
          ))}
        </div>
      )}

      {e ? (
        <>
          <div className="mpSection">
            <div className="mpSecHead"><Icon icon="game-icons:open-book" /> Lore</div>
            {e.lore.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="mpSection">
            <div className="mpSecHead"><Icon icon="game-icons:crossed-swords" /> In Battle</div>
            {e.gameplay.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {e.tips?.length > 0 && (
            <div className="mpSection">
              <div className="mpSecHead"><Icon icon="game-icons:light-bulb" /> Tips</div>
              <ul className="mpTips">{e.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </>
      ) : (
        <div className="mpSection">
          <div className="mpSecHead"><Icon icon="game-icons:scroll-quill" /> Field Notes</div>
          <p>
            {m.klass[0] ? `A ${m.klass[0]}` : 'An instinct-driven creature'} of {m.biology[0] || 'unknown'} stock, attuned to {att || 'no element'}.
            Its {att || 'elemental'} attacks inflict <b>{(att && ATTUNEMENT_SIGNATURE[att]) || 'no signature status'}</b>.
            {m.blurb ? ` ${m.blurb}` : ''}
          </p>
          <p className="mpDim">No detailed bestiary entry recorded for this creature yet.</p>
        </div>
      )}
    </div>
  );
}
