// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/Codex — a central, browsable reference the player can read   ║
// ║ to learn the game: systems, statuses, reactions, the three axes, and    ║
// ║ keywords. Pulls from the single info sources (data/codex, cards/reactions ║
// ║ REACTION_INFO, cards/cardText KEYWORD_GLOSSARY, data/axisIcons,           ║
// ║ data/synthesis) so it never drifts from the combat tooltips.            ║
// ║ UPDATE WHEN: a new reference category is added.                          ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useState } from 'react';
import { EFFECT_INFO, AXIS_INFO, ATTUNEMENT_SIGNATURE, SYSTEM_INFO } from '../data/codex.js';
import { REACTIONS, REACTION_INFO } from '../engine/cards/reactions.js';
import { KEYWORD_GLOSSARY } from '../engine/cards/cardText.js';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../data/axisIcons.js';
import { CLASS_BASES, BIOLOGY_BASES, ATTUNEMENT_BASES } from '../data/synthesis.js';
import { buildRoster } from '../data/roster.js';
import { bestiaryEntry } from '../data/bestiary.js';
import MonsterPage from './MonsterPage.jsx';
import './codex.css';

// Bundled archetype pools → the generator → the playable roster (for the Bestiary).
const BUNDLE = import.meta.glob('../data/cards/*.json', { eager: true });
const FILES = Object.values(BUNDLE).map((m) => m.default ?? m);
const POOLS = Object.fromEntries(FILES.map((f) => [f.class, f.cards || []]));
const ROSTER = buildRoster(POOLS, POOLS.Warrior || []);

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

/** Flatten the reaction matrix into rows: one per (element, status) cell. */
function reactionRows() {
  const rows = [];
  for (const [element, cells] of Object.entries(REACTIONS)) {
    for (const [status, cell] of Object.entries(cells)) {
      rows.push({ element, status, verb: cell.verb, desc: REACTION_INFO[cell.verb] || '' });
    }
  }
  return rows;
}

function SystemsTab() {
  return (
    <div className="cxGrid">
      {SYSTEM_INFO.map((s) => (
        <div className="cxCard" key={s.name}>
          <div className="cxCardHead"><Icon icon={s.icon} /> {s.name}</div>
          <p>{s.desc}</p>
        </div>
      ))}
    </div>
  );
}

function StatusesTab() {
  return (
    <div className="cxGrid">
      {Object.entries(EFFECT_INFO).map(([id, e]) => (
        <div className="cxCard" key={id}>
          <div className="cxCardHead"><Icon icon={e.icon} /> {e.name}</div>
          <p>{e.desc}</p>
        </div>
      ))}
    </div>
  );
}

function ReactionsTab() {
  const rows = reactionRows();
  return (
    <>
      <p className="cxIntro">Hitting a status with the right element triggers a reaction — a bonus payoff. Statuses still work fully on their own; reactions are pure upside.</p>
      <div className="cxTable">
        {rows.map((r, i) => (
          <div className="cxRow" key={i}>
            <span className="cxEl" style={{ color: ATTUNEMENT_COLOR[r.element] }}>
              <Icon icon={ATTUNEMENT_ICON[r.element] || 'game-icons:fire'} /> {r.element}
            </span>
            <span className="cxPlus">+</span>
            <span className="cxStatus">{EFFECT_INFO[r.status]?.name || r.status}</span>
            <span className="cxArrow">→</span>
            <b className="cxVerb">{r.verb}</b>
            <span className="cxDesc">{r.desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function AxisRow({ icon, color, name, extra }) {
  return (
    <div className="cxChip">
      <Icon icon={icon} style={color ? { color } : undefined} /> <b>{name}</b>
      {extra ? <span className="cxChipExtra">{extra}</span> : null}
    </div>
  );
}

function AxesTab() {
  return (
    <div className="cxAxes">
      <div className="cxAxisBlock">
        <div className="cxCardHead"><Icon icon={AXIS_INFO.class.icon} /> {AXIS_INFO.class.name}</div>
        <p>{AXIS_INFO.class.desc}</p>
        <div className="cxChips">{CLASS_BASES.map((c) => <AxisRow key={c} icon={ARCHETYPE_ICON[c] || 'game-icons:gladius'} name={c} />)}</div>
      </div>
      <div className="cxAxisBlock">
        <div className="cxCardHead"><Icon icon={AXIS_INFO.biology.icon} /> {AXIS_INFO.biology.name}</div>
        <p>{AXIS_INFO.biology.desc}</p>
        <div className="cxChips">{BIOLOGY_BASES.map((b) => <AxisRow key={b} icon={BIOLOGY_ICON[b] || 'game-icons:dna2'} name={b} />)}</div>
      </div>
      <div className="cxAxisBlock">
        <div className="cxCardHead"><Icon icon={AXIS_INFO.attunement.icon} /> {AXIS_INFO.attunement.name}</div>
        <p>{AXIS_INFO.attunement.desc} Each element has a <b>signature status</b> its imbued strikes inflict:</p>
        <div className="cxChips">
          {ATTUNEMENT_BASES.map((a) => (
            <AxisRow key={a} icon={ATTUNEMENT_ICON[a] || 'game-icons:embrace-energy'} color={ATTUNEMENT_COLOR[a]} name={a} extra={ATTUNEMENT_SIGNATURE[a]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KeywordsTab() {
  return (
    <div className="cxGrid">
      {Object.entries(KEYWORD_GLOSSARY).map(([k, desc]) => (
        <div className="cxCard" key={k}>
          <div className="cxCardHead">{k}</div>
          <p>{desc}</p>
        </div>
      ))}
    </div>
  );
}

function BestiaryTab() {
  const [sel, setSel] = useState(null);
  if (sel) {
    const c = ROSTER.find((r) => r.id === sel);
    return (
      <div className="cxBeast">
        <button className="cxBack cxBeastBack" onClick={() => setSel(null)}><Icon icon="game-icons:previous-button" /> All creatures</button>
        <MonsterPage creature={c} />
      </div>
    );
  }
  return (
    <>
      <p className="cxIntro">Every creature in the roster — its lore, its role, and how to play it. Tap one to read its page.</p>
      <div className="cxBeastGrid">
        {ROSTER.map((c) => {
          const att = c.attunement?.[0];
          const color = creatureColor(c);
          const e = bestiaryEntry(c.id, c.name);
          return (
            <button key={c.id} className="cxBeastCard" onClick={() => setSel(c.id)} style={{ '--gl': color }}>
              <span className="cxBeastArt">
                {c.meta?.portrait ? <img src={c.meta.portrait} alt="" />
                  : <Icon icon={creatureIcon(c)} style={{ color }} />}
              </span>
              <span className="cxBeastName">{c.name}</span>
              {e?.title && <span className="cxBeastTitle">{e.title}</span>}
              <span className="cxBeastAxes">
                <Icon icon={ARCHETYPE_ICON[c.class?.[0]] || 'game-icons:gladius'} />
                <Icon icon={BIOLOGY_ICON[c.biology?.[0]] || 'game-icons:dna2'} />
                <Icon icon={ATTUNEMENT_ICON[att] || 'game-icons:embrace-energy'} style={{ color: ATTUNEMENT_COLOR[att] }} />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const TABS = [
  { id: 'bestiary', label: 'Bestiary', icon: 'game-icons:bestial-fangs', render: BestiaryTab },
  { id: 'systems', label: 'Combat', icon: 'game-icons:crossed-swords', render: SystemsTab },
  { id: 'statuses', label: 'Statuses', icon: 'game-icons:hazard-sign', render: StatusesTab },
  { id: 'reactions', label: 'Reactions', icon: 'game-icons:fire-ray', render: ReactionsTab },
  { id: 'axes', label: 'Axes', icon: 'game-icons:family-tree', render: AxesTab },
  { id: 'keywords', label: 'Keywords', icon: 'game-icons:book-cover', render: KeywordsTab },
];

export default function Codex({ onMenu }) {
  const [tab, setTab] = useState('bestiary');
  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).render;
  return (
    <div className="codex">
      <div className="cxBar">
        {onMenu && <button className="cxBack" onClick={onMenu}><Icon icon="game-icons:hamburger-menu" /> Menu</button>}
        <h1><Icon icon="game-icons:book-cover" /> Codex</h1>
      </div>
      <div className="cxTabs">
        {TABS.map((t) => (
          <button key={t.id} className={`cxTab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            <Icon icon={t.icon} /> {t.label}
          </button>
        ))}
      </div>
      <div className="cxBody"><Active /></div>
    </div>
  );
}
