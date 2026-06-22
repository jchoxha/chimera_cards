// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/App — the unified shell. A main menu routes between the  ║
// ║ Card Editor (Forge) and the playtest Combat screen (Proving Pit),    ║
// ║ which fights a chosen deck against a configurable Target Dummy.      ║
// ║ Reuses CardEditor + CombatScreen unchanged (props for menu/restart). ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { useCombat } from '../store/combatStore.js';
import { useRun } from '../store/runStore.js';
import { starterDeck } from '../engine/run/state.js';
import { CardEditor } from '../editor/CardEditor.jsx';
import CombatScreen from '../ui/combat/CombatScreen.jsx';
import RunScreen from '../ui/run/RunScreen.jsx';
import DeckBuilder from '../ui/deck/DeckBuilder.jsx';
import { loadDraft } from '../editor/persistence.js';
import { ATTUNEMENT_BASES, BIOLOGY_BASES, legalAttunements } from '../data/synthesis.js';
import './app.css';

// Bundled card files (the editor saves drafts on top of these in localStorage).
const BUNDLE = import.meta.glob('../data/cards/*.json', { eager: true });
const FILES = Object.fromEntries(
  Object.entries(BUNDLE).map(([p, m]) => [p.split('/').pop(), (m.default ?? m)]),
);
const FILE_NAMES = Object.keys(FILES);

export default function App() {
  const [view, setView] = useState('menu');
  const [deckFile, setDeckFile] = useState(FILE_NAMES[0] || 'warrior.json');
  const [enemyHp, setEnemyHp] = useState(200);
  // Attunement playtest controls: your creature's attunement (drives imbue) + the
  // dummy's attunement/biology (drives the matchup layer). See v3.19.0 attunements.
  const [att1, setAtt1] = useState('Physical');
  const [att2, setAtt2] = useState('');
  const [dummyAtt, setDummyAtt] = useState('');
  const [dummyBio, setDummyBio] = useState('');
  const [lastDeck, setLastDeck] = useState(null); // remembered deck → "Restart" replays it

  // The class of the selected deck → which primary attunements are legal (a combo is
  // legal if its FIRST base is legal; the 2nd may be anything — synthesis.js A4).
  const currentFile = loadDraft(deckFile) || FILES[deckFile] || {};
  const deckClass = currentFile.class;
  const legalPrimary = deckClass ? legalAttunements([deckClass]) : ATTUNEMENT_BASES;

  function heroAttunement() {
    const a = [att1, att2].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
    return a.length ? a : ['Physical'];
  }

  /** The selected file's playable cards = the DeckBuilder's pool. */
  function poolForFile() {
    const file = loadDraft(deckFile) || FILES[deckFile] || { cards: [] };
    return (file.cards || []).filter((c) => c.type !== 'curse' && c.type !== 'status');
  }

  /** Launch a playtest. `deck` = a built CardSpec[]; omitted → the full pool (quick fight). */
  function launchCombat(deck) {
    const file = loadDraft(deckFile) || FILES[deckFile] || { cards: [] };
    const cards = (deck && deck.length) ? deck : poolForFile();
    setLastDeck(cards);
    useCombat.getState().startPlaytest({
      playerCards: cards,
      playerName: file.class || 'Hero',
      klass: file.class ? [file.class] : undefined,
      attunement: heroAttunement(),
      enemyAttunement: dummyAtt ? [dummyAtt] : undefined,
      enemyBiology: dummyBio ? [dummyBio] : undefined,
      enemyHp: Number(enemyHp) || 200,
    });
    setView('combat');
  }

  function deckFromFile() {
    const file = loadDraft(deckFile) || FILES[deckFile] || { cards: [] };
    const cards = (file.cards || []).filter((c) => c.type !== 'curse' && c.type !== 'status');
    const attunement = [cards.find((c) => c.attunement)?.attunement || 'Physical'];
    return { file, cards, attunement };
  }
  function launchRun() {
    const { file, cards, attunement } = deckFromFile();
    const party = [{
      id: 'hero', name: file.class || 'Hero', class: file.class ? [file.class] : undefined,
      attunement, stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 }, maxHp: 60,
      deck: starterDeck(cards, 10), // ≤10-card starter; more from rewards
    }];
    useRun.getState().startRun({ party, seed: Date.now() });
    setView('run');
  }
  function continueRun() { if (useRun.getState().loadSaved()) setView('run'); }

  if (view === 'editor') return <CardEditor onMenu={() => setView('menu')} />;
  if (view === 'combat') return <CombatScreen onMenu={() => setView('menu')} onRestart={() => launchCombat(lastDeck)} />;
  if (view === 'run') return <RunScreen onMenu={() => setView('menu')} />;
  if (view === 'deckbuild') return (
    <DeckBuilder
      pool={poolForFile()}
      title={`Build a ${deckClass || 'Hero'} deck`}
      subtitle={`${heroAttunement().join(' / ')}  ·  vs ${dummyAtt || dummyBio ? [dummyAtt, dummyBio].filter(Boolean).join(' ') : 'no-axis'} dummy (${Number(enemyHp) || 200} HP)`}
      onConfirm={(deck) => launchCombat(deck)}
      onCancel={() => setView('menu')}
    />
  );

  return (
    <div className="menu">
      <div className="menuCard">
        <h1 className="menuTitle">CHIMERA</h1>
        <p className="menuSub">Card Forge &amp; Proving Pit</p>

        <button className="menuBtn big" onClick={() => setView('editor')}>
          🃏 Open the Card Forge
        </button>

        <div className="menuSetup">
          <h3>⚔ Playtest Combat</h3>
          <label>Deck
            <select value={deckFile} onChange={(e) => setDeckFile(e.target.value)}>
              {FILE_NAMES.map((f) => <option key={f} value={f}>{f.replace('.json', '')}</option>)}
            </select>
          </label>
          <label>Your attunement
            <select value={att1} onChange={(e) => setAtt1(e.target.value)}>
              {legalPrimary.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>+ 2nd (optional)
            <select value={att2} onChange={(e) => setAtt2(e.target.value)}>
              <option value="">(none)</option>
              {ATTUNEMENT_BASES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>Dummy attunement
            <select value={dummyAtt} onChange={(e) => setDummyAtt(e.target.value)}>
              <option value="">(none)</option>
              {ATTUNEMENT_BASES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>Dummy biology
            <select value={dummyBio} onChange={(e) => setDummyBio(e.target.value)}>
              <option value="">(none)</option>
              {BIOLOGY_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label>Target Dummy HP
            <input type="number" min="1" value={enemyHp} onChange={(e) => setEnemyHp(e.target.value)} />
          </label>
          <div className="menuRow">
            <button className="menuBtn big" onClick={() => setView('deckbuild')} disabled={!FILE_NAMES.length}>
              🛠 Build a Deck
            </button>
            <button className="menuBtn" onClick={() => launchCombat()} disabled={!FILE_NAMES.length}
              title="Skip the builder and fight with the whole card pool">
              Quick Fight (full pool)
            </button>
          </div>
        </div>

        <div className="menuSetup">
          <h3>🗺 Roguelike Run</h3>
          <button className="menuBtn big" onClick={launchRun} disabled={!FILE_NAMES.length}>
            Begin a Run — {deckFile.replace('.json', '')}
          </button>
          {useRun.getState().hasSave() && (
            <button className="menuBtn" onClick={continueRun}>Continue Saved Run</button>
          )}
        </div>

        <p className="menuHint">
          Forge cards (autosaves as you go), then <b>Build a Deck</b> (rarity-weighted budget) or
          Quick Fight the full pool. Set your attunement (a 2nd one drives Imbue, e.g. Fire→Burn) and
          give the dummy an attunement/biology to see matchups.
        </p>
      </div>
    </div>
  );
}
