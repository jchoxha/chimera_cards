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
import { loadDraft } from '../editor/persistence.js';
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

  function launchCombat() {
    // Prefer the editor's unsaved draft so you playtest exactly what you're tuning.
    const file = loadDraft(deckFile) || FILES[deckFile] || { cards: [] };
    const cards = (file.cards || []).filter((c) => c.type !== 'curse' && c.type !== 'status');
    const attunement = [cards.find((c) => c.attunement)?.attunement || 'Physical'];
    useCombat.getState().startPlaytest({
      playerCards: cards,
      playerName: file.class || 'Hero',
      klass: file.class ? [file.class] : undefined,
      attunement,
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
  if (view === 'combat') return <CombatScreen onMenu={() => setView('menu')} onRestart={launchCombat} />;
  if (view === 'run') return <RunScreen onMenu={() => setView('menu')} />;

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
          <label>Target Dummy HP
            <input type="number" min="1" value={enemyHp} onChange={(e) => setEnemyHp(e.target.value)} />
          </label>
          <button className="menuBtn" onClick={launchCombat} disabled={!FILE_NAMES.length}>
            Enter the Proving Pit
          </button>
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
          Forge cards (autosaves as you go), then playtest that exact deck against a no-axis Target Dummy.
        </p>
      </div>
    </div>
  );
}
