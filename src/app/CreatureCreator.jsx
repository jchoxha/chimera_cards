// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/CreatureCreator — build a CUSTOM creature for your team.     ║
// ║ Pick its synth typings (archetype / biology / 1–2 attunements), name it, ║
// ║ and give it either the auto-generated deck for those typings OR a custom ║
// ║ deck built in the (reskinned) Card Forge deck builder. Presentational:   ║
// ║ App owns the pools + the create handler.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import DeckBuilder from '../ui/deck/DeckBuilder.jsx';
import { deckToCounts } from '../engine/deck/budget.js';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../data/axisIcons.js';
import './creator.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

export default function CreatureCreator({ classes = [], biologies = [], attunements = [], legalFor, buildPool, onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [klass, setKlass] = useState(classes[0] || 'Warrior');
  const [biology, setBiology] = useState(biologies[0] || 'Humanoid');
  const [att1, setAtt1] = useState('Physical');
  const [att2, setAtt2] = useState('');
  const [deckMode, setDeckMode] = useState('auto'); // 'auto' | 'custom'
  const [customDeck, setCustomDeck] = useState(null);
  const [building, setBuilding] = useState(false);

  const atts = [att1, att2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const legal = legalFor ? legalFor(klass) : attunements;
  const preview = { class: [klass], biology: [biology], attunement: atts.length ? atts : ['Physical'] };
  const color = creatureColor(preview);

  if (building) {
    return (
      <DeckBuilder
        pool={buildPool(klass, atts.length ? atts : ['Physical'])}
        title={`Build ${name || klass}'s deck`}
        subtitle={`${klass} · ${biology} · ${atts.join(' / ') || 'Physical'}`}
        initial={customDeck ? deckToCounts(customDeck) : {}}
        onConfirm={(deck) => { setCustomDeck(deck); setDeckMode('custom'); setBuilding(false); }}
        onCancel={() => setBuilding(false)}
      />
    );
  }

  return (
    <div className="creator">
      <header className="crHead">
        <h1>Create a Custom Creature</h1>
        <button className="selBtn ghost" onClick={onCancel}>Back</button>
      </header>

      <div className="crBody">
        <div className="crPreview" style={{ '--gl': color }}>
          <div className="crPortrait"><Icon icon={creatureIcon(preview)} style={{ color }} /></div>
          <div className="crPvName">{name || 'Unnamed'}</div>
          <div className="crPvAxes">
            <span><Icon icon={ARCHETYPE_ICON[klass] || 'game-icons:gladius'} /> {klass}</span>
            <span><Icon icon={BIOLOGY_ICON[biology] || 'game-icons:dna2'} /> {biology}</span>
            <span style={{ color: ATTUNEMENT_COLOR[att1] }}><Icon icon={ATTUNEMENT_ICON[att1] || 'game-icons:embrace-energy'} /> {atts.join(' / ') || 'Physical'}</span>
          </div>
        </div>

        <div className="crForm">
          <label className="crFld"><span>Name</span>
            <input value={name} placeholder="e.g. Cinderfang" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="crFld"><span>Archetype</span>
            <select value={klass} onChange={(e) => { setKlass(e.target.value); setCustomDeck(null); }}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="crFld"><span>Biology</span>
            <select value={biology} onChange={(e) => setBiology(e.target.value)}>
              {biologies.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="crFld"><span>Attunement</span>
            <select value={att1} onChange={(e) => { setAtt1(e.target.value); setCustomDeck(null); }}>
              {legal.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="crFld"><span>+ 2nd attunement</span>
            <select value={att2} onChange={(e) => { setAtt2(e.target.value); setCustomDeck(null); }}>
              <option value="">(none)</option>
              {attunements.filter((a) => a !== att1).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <div className="crDeck">
            <div className="crDeckHead">Deck</div>
            <label className="crRadio"><input type="radio" name="deckmode" checked={deckMode === 'auto'} onChange={() => setDeckMode('auto')} /> Auto — generated from its typings</label>
            <label className="crRadio"><input type="radio" name="deckmode" checked={deckMode === 'custom'} onChange={() => setDeckMode('custom')} /> Custom — build it yourself</label>
            {deckMode === 'custom' && (
              <div className="crDeckBuild">
                <button className="selBtn" onClick={() => setBuilding(true)}>
                  {customDeck ? `Edit deck (${customDeck.length} cards)` : 'Build a deck →'}
                </button>
                {customDeck && <span className="crDeckOk">✓ {customDeck.length}-card deck ready</span>}
              </div>
            )}
          </div>

          <button className="selBtn go crCreate"
            disabled={deckMode === 'custom' && !customDeck}
            onClick={() => onCreate({
              name: name.trim() || `${atts[0] || 'Physical'} ${klass}`,
              class: [klass], biology: [biology], attunement: atts.length ? atts : ['Physical'],
              customDeck: deckMode === 'custom' ? customDeck : null,
            })}>
            Create &amp; Add to Team ✓
          </button>
          {deckMode === 'custom' && !customDeck && <p className="crHint">Build a deck first, or switch to Auto.</p>}
        </div>
      </div>
    </div>
  );
}
