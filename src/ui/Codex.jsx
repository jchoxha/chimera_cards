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
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, SUBTYPE_ICON, creatureColor } from '../data/axisIcons.js';
import { CLASS_BASES, BODY_TYPES, SUBTYPES, ATTUNEMENT_BASES } from '../data/synthesis.js';
import { buildRoster, buildRosterCreature, ROSTER as ROSTER_ENTRIES } from '../data/roster.js';
import { POOLS, rosterPool } from '../app/pools.js';
import { discoveredForms } from '../app/collection.js';
import { FORM_ORDER, FORMS } from '../data/forms.js';
import { CardFace, creatureToFace } from './combat/creatureVisuals.jsx';
import { describeCard } from '../engine/cards/cardText.js';
import { attunementCards } from '../engine/cards/attunementPool.js';
import MonsterPage from './MonsterPage.jsx';
import MoveCard from './combat/MoveCard.jsx';
import './combat/combat.css';
import './codex.css';

// The SHARED biology-aware pools (app/pools) → the generator → the playable
// roster, so the Bestiary shows the same kits/decks the game actually deals.
const ROSTER = buildRoster(POOLS, POOLS.Warrior || [], rosterPool);

// Every card the player can encounter, grouped: one group per archetype + an
// "Elemental" group for the attunement signature cards (§14.3).
const CARD_GROUPS = [
  ...Object.entries(POOLS).map(([klass, cards]) => ({ key: klass, label: klass, cards })),
  { key: 'Elemental', label: 'Elemental', cards: attunementCards(ATTUNEMENT_BASES) },
];

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
        <div className="cxChips">{BODY_TYPES.map((b) => <AxisRow key={b} icon={BIOLOGY_ICON[b] || 'game-icons:dna2'} name={b} />)}</div>
        <p className="cxSub"><b>Descriptive subtypes</b> layer onto any body type (in any combination), adding
          their own cards and elemental constitutions — a mechanical giant beast-man reads
          “Giant Mechanical Chimera”:</p>
        <div className="cxChips">{SUBTYPES.map((s) => <AxisRow key={s} icon={SUBTYPE_ICON[s] || 'game-icons:dna2'} name={s} />)}</div>
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

function CreaturesTab({ collection }) {
  const [sel, setSel] = useState(null);
  const [selForm, setSelForm] = useState(null);
  // No collection passed (legacy/standalone) → everything counts as discovered at
  // its native size, so the tab still works outside the app shell.
  const formsOf = (c) => {
    if (!collection) return [c.meta?.form ?? 'regular'];
    return FORM_ORDER.filter((f) => discoveredForms(collection, c.id).includes(f));
  };

  if (sel) {
    const base = ROSTER.find((r) => r.id === sel);
    const entry = ROSTER_ENTRIES.find((r) => r.id === sel);
    if (!base) { setSel(null); return null; }
    const forms = formsOf(base);
    const nativeForm = base.meta?.form ?? 'regular';
    const form = selForm && forms.includes(selForm) ? selForm : (forms.includes(nativeForm) ? nativeForm : forms[0]);
    // Rebuild the creature AT the viewed size so HP/Might + the size word + the
    // per-size portrait (sizeArt) all reflect that form.
    const creature = (form === nativeForm || !entry) ? base : buildRosterCreature(entry, rosterPool(entry), form);
    return (
      <div className="cxBeast">
        <button className="cxBack cxBeastBack" onClick={() => { setSel(null); setSelForm(null); }}><Icon icon="game-icons:previous-button" /> All creatures</button>
        <div className="cxSizeBar">
          <span className="cxSizeLbl">Size</span>
          {FORM_ORDER.map((f) => {
            const known = forms.includes(f);
            return (
              <button key={f} disabled={!known}
                className={`cxSizeChip${form === f ? ' on' : ''}${known ? '' : ' locked'}`}
                title={known ? `View the ${FORMS[f].label} form` : 'Not yet discovered at this size'}
                onClick={() => known && setSelForm(f)}>
                {known ? `${FORMS[f].badge ? `${FORMS[f].badge} ` : ''}${FORMS[f].label}` : '?'}
              </button>
            );
          })}
        </div>
        <MonsterPage creature={creature} />
      </div>
    );
  }
  const discovered = ROSTER.filter((c) => formsOf(c).length > 0);
  const unknown = ROSTER.filter((c) => formsOf(c).length === 0);
  return (
    <>
      <p className="cxIntro">
        Every creature you’ve discovered, as its actual card. Tap one for its page — and toggle between the sizes you’ve encountered.
        {unknown.length > 0 && <> <b>{unknown.length}</b> remain undiscovered…</>}
      </p>
      <div className="cxCreatureGrid">
        {discovered.map((c) => {
          const forms = formsOf(c);
          const nativeForm = c.meta?.form ?? 'regular';
          const showForm = forms.includes(nativeForm) ? nativeForm : forms[0];
          const entry = ROSTER_ENTRIES.find((r) => r.id === c.id);
          const shown = (showForm === nativeForm || !entry) ? c : buildRosterCreature(entry, rosterPool(entry), showForm);
          return (
            <div key={c.id} role="button" tabIndex={0} className="cxCreatureWrap" style={{ '--gl': creatureColor(c) }}
              onClick={() => setSel(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(c.id); }}>
              <CardFace f={creatureToFace(shown)} side="ally" />
              {forms.length > 1 && <span className="cxSizeCount" title={`Discovered at ${forms.length} sizes`}>{forms.length} sizes</span>}
            </div>
          );
        })}
        {unknown.map((c) => (
          <div key={c.id} className="cxCreatureWrap cxUnknown" title="Not yet discovered">
            <div className="cxUnknownCard">
              <Icon icon="game-icons:perspective-dice-six-faces-random" />
              <span>?</span>
              <em>Undiscovered</em>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CardDetail({ card, onBack }) {
  const att = Array.isArray(card.attunement) ? card.attunement.join('/') : card.attunement;
  const text = describeCard(card) || card.text || '';
  const kws = (card.keywords || []);
  return (
    <div className="cxCardDetail">
      <button className="cxBack cxBeastBack" onClick={onBack}><Icon icon="game-icons:previous-button" /> All cards</button>
      <div className="cxCardDetailBody">
        <div className="cxCardBig"><MoveCard c={card} /></div>
        <div className="cxCardMeta">
          <h2>{card.name}</h2>
          <div className="cxCardTags">
            <span className="cxCardTag">{card.type || 'card'}</span>
            <span className="cxCardTag">{card.rarity || 'common'}</span>
            {att && <span className="cxCardTag" style={{ color: ATTUNEMENT_COLOR[Array.isArray(card.attunement) ? card.attunement[0] : card.attunement] }}>{att}</span>}
            <span className="cxCardTag">Cost {card.cost === -1 ? 'X' : card.cost}</span>
          </div>
          <p className="cxCardText">{text}</p>
          {card.imbue ? <p className="cxCardText"><b>Imbue</b> — also applies the caster’s attunement status.</p> : null}
          {kws.length > 0 && (
            <div className="cxCardKws">
              {kws.map((k) => KEYWORD_GLOSSARY[k] && (
                <div className="cxKw" key={k}><b>{k}</b><span>{KEYWORD_GLOSSARY[k]}</span></div>
              ))}
            </div>
          )}
          {card.upgrade && <p className="cxCardText cxDim">This card can be upgraded at a campfire.</p>}
        </div>
      </div>
    </div>
  );
}

function CardsTab() {
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  if (sel) return <CardDetail card={sel} onBack={() => setSel(null)} />;
  const ql = q.trim().toLowerCase();
  const groups = CARD_GROUPS
    .filter((g) => group === 'all' || g.key === group)
    .map((g) => ({ ...g, cards: g.cards.filter((c) => !ql || (c.name || '').toLowerCase().includes(ql) || (describeCard(c) || '').toLowerCase().includes(ql)) }))
    .filter((g) => g.cards.length);
  return (
    <>
      <p className="cxIntro">Every card in the game. Search or filter by archetype, and tap a card for its full rules + keywords.</p>
      <div className="cxCardBar">
        <input className="cxSearch" placeholder="Search cards…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cxGroupChips">
          <button className={`cxChipBtn${group === 'all' ? ' on' : ''}`} onClick={() => setGroup('all')}>All</button>
          {CARD_GROUPS.map((g) => (
            <button key={g.key} className={`cxChipBtn${group === g.key ? ' on' : ''}`} onClick={() => setGroup(g.key)}>{g.label}</button>
          ))}
        </div>
      </div>
      {groups.map((g) => (
        <div className="cxCardGroup" key={g.key}>
          <div className="cxCardGroupHead">{g.label} <span>({g.cards.length})</span></div>
          <div className="cxCardGrid">
            {g.cards.map((c, i) => <MoveCard key={`${c.id}-${i}`} c={c} onClick={() => setSel(c)} />)}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="cxIntro">No cards match.</p>}
    </>
  );
}

const TABS = [
  { id: 'creatures', label: 'Creatures', icon: 'game-icons:card-exchange', render: CreaturesTab },
  { id: 'cards', label: 'Cards', icon: 'game-icons:card-pickup', render: CardsTab },
  { id: 'systems', label: 'Combat', icon: 'game-icons:crossed-swords', render: SystemsTab },
  { id: 'statuses', label: 'Statuses', icon: 'game-icons:hazard-sign', render: StatusesTab },
  { id: 'reactions', label: 'Reactions', icon: 'game-icons:fire-ray', render: ReactionsTab },
  { id: 'axes', label: 'Axes', icon: 'game-icons:family-tree', render: AxesTab },
  { id: 'keywords', label: 'Keywords', icon: 'game-icons:book-cover', render: KeywordsTab },
];

export default function Codex({ onMenu, initialTab, backLabel = 'Menu', collection = null }) {
  const wanted = initialTab === 'bestiary' ? 'creatures' : initialTab;   // legacy tab id
  const [tab, setTab] = useState(wanted && TABS.some((t) => t.id === wanted) ? wanted : 'creatures');
  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).render;
  return (
    <div className="codex">
      <div className="cxBar">
        {onMenu && <button className="cxBack" onClick={onMenu}><Icon icon="game-icons:hamburger-menu" /> {backLabel}</button>}
        <h1><Icon icon="game-icons:book-cover" /> Codex</h1>
      </div>
      <div className="cxTabs">
        {TABS.map((t) => (
          <button key={t.id} className={`cxTab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            <Icon icon={t.icon} /> {t.label}
          </button>
        ))}
      </div>
      <div className="cxBody"><Active collection={collection} /></div>
    </div>
  );
}
