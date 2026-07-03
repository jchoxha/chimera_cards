// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/CreatureCreator — build a CUSTOM creature for your team.     ║
// ║ Name it, give it lore + a physical description (for move/art generation),║
// ║ and either let an AI pick its synth typings (archetype / biology /       ║
// ║ attunement) from that text, or pick them by hand. The deck is ALWAYS     ║
// ║ auto-generated from the typings (per-monster custom decks live in the    ║
// ║ Editor, an admin tool — not this end-user screen). Presentational: App   ║
// ║ owns the pools + the create handler + the inference call.                ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { inferTypings } from '../data/inferTypings.js';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../data/axisIcons.js';
import './creator.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

export default function CreatureCreator({ classes = [], biologies = [], attunements = [], legalFor, onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [lore, setLore] = useState('');
  const [description, setDescription] = useState('');
  const [aiTypings, setAiTypings] = useState(true); // AI decides by default
  const [klass, setKlass] = useState(classes[0] || 'Warrior');
  const [biology, setBiology] = useState(biologies[0] || 'Humanoid');
  const [att1, setAtt1] = useState('Physical');
  const [att2, setAtt2] = useState('');
  const [busy, setBusy] = useState(false);

  const atts = [att1, att2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const legal = legalFor ? legalFor(klass) : attunements;
  const preview = { class: [klass], biology: [biology], attunement: atts.length ? atts : ['Physical'] };
  const color = aiTypings ? '#b98a3a' : creatureColor(preview);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    let typings;
    if (aiTypings) {
      typings = await inferTypings(name, lore, description);
    } else {
      typings = { class: [klass], biology: [biology], attunement: atts.length ? atts : ['Physical'], subtypes: [] };
    }
    onCreate({
      name: name.trim() || `${typings.attunement[0]} ${typings.class[0]}`,
      class: typings.class, biology: typings.biology, attunement: typings.attunement,
      subtypes: typings.subtypes || [],
      family: typings.family || null,
      anatomy: typings.anatomy || [],
      weapons: typings.weapons || [],
      lore: lore.trim() || null,
      description: description.trim() || null,
    });
  };

  return (
    <div className="creator">
      <header className="crHead">
        <h1>Create a Custom Creature</h1>
        <button className="selBtn ghost" onClick={onCancel}>Back</button>
      </header>

      <div className="crBody">
        <div className="crPreview" style={{ '--gl': color }}>
          <div className="crPortrait">
            <Icon icon={aiTypings ? 'game-icons:perspective-dice-six-faces-random' : creatureIcon(preview)} style={{ color }} />
          </div>
          <div className="crPvName">{name || 'Unnamed'}</div>
          {aiTypings ? (
            <div className="crPvAxes crPvAi"><Icon icon="game-icons:sparkles" /> AI picks the typings</div>
          ) : (
            <div className="crPvAxes">
              <span><Icon icon={ARCHETYPE_ICON[klass] || 'game-icons:gladius'} /> {klass}</span>
              <span><Icon icon={BIOLOGY_ICON[biology] || 'game-icons:dna2'} /> {biology}</span>
              <span style={{ color: ATTUNEMENT_COLOR[att1] }}><Icon icon={ATTUNEMENT_ICON[att1] || 'game-icons:embrace-energy'} /> {atts.join(' / ') || 'Physical'}</span>
            </div>
          )}
        </div>

        <div className="crForm">
          <label className="crFld"><span>Name</span>
            <input value={name} placeholder="e.g. Cinderfang" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="crFld"><span>Lore <em>(optional)</em></span>
            <textarea value={lore} rows={3} placeholder="Backstory, personality, origin…" onChange={(e) => setLore(e.target.value)} />
          </label>
          <label className="crFld"><span>Physical description <em>(optional)</em></span>
            <textarea value={description} rows={3} placeholder="What it looks like — used for move &amp; art generation." onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label className="crToggle">
            <input type="checkbox" checked={aiTypings} onChange={(e) => setAiTypings(e.target.checked)} />
            <span>Let an AI choose the matrix typings from the name, lore &amp; description</span>
          </label>

          {!aiTypings && (
            <div className="crAxes">
              <label className="crFld"><span>Archetype</span>
                <select value={klass} onChange={(e) => setKlass(e.target.value)}>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="crFld"><span>Biology</span>
                <select value={biology} onChange={(e) => setBiology(e.target.value)}>
                  {biologies.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="crFld"><span>Attunement</span>
                <select value={att1} onChange={(e) => setAtt1(e.target.value)}>
                  {legal.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="crFld"><span>+ 2nd attunement</span>
                <select value={att2} onChange={(e) => setAtt2(e.target.value)}>
                  <option value="">(none)</option>
                  {attunements.filter((a) => a !== att1).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>
          )}

          <p className="crHint">The deck is generated automatically from the typings. To hand-build a deck, use the Editor.</p>

          <button className="selBtn go crCreate" disabled={busy} onClick={create}>
            {busy ? 'Creating…' : 'Create & Add to Team ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
