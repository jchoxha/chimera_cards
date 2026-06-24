// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/App — the unified shell. A main menu routes between the  ║
// ║ Card Editor (Forge) and the playtest Combat screen (Proving Pit),    ║
// ║ which fights a chosen deck against a configurable Target Dummy.      ║
// ║ Reuses CardEditor + CombatScreen unchanged (props for menu/restart). ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { useCombat } from '../store/combatStore.js';
import { useRun } from '../store/runStore.js';
import { CardEditor } from '../editor/CardEditor.jsx';
import CombatScreen from '../ui/combat/CombatScreen.jsx';
import RunScreen from '../ui/run/RunScreen.jsx';
import DeckBuilder from '../ui/deck/DeckBuilder.jsx';
import SelectScreen from './SelectScreen.jsx';
import { loadDraft } from '../editor/persistence.js';
import { ATTUNEMENT_BASES, BIOLOGY_BASES, legalAttunements } from '../data/synthesis.js';
import { attunementCards } from '../engine/cards/attunementPool.js';
import { reskinDeck, attunementVariants } from '../engine/cards/reskin.js';
import { buildRoster } from '../data/roster.js';
import { APP_VERSION } from '../version.js';
import { CHANGELOG } from '../data/changelog.js';
import './app.css';

// Bundled card files (the editor saves drafts on top of these in localStorage).
const BUNDLE = import.meta.glob('../data/cards/*.json', { eager: true });
const FILES = Object.fromEntries(
  Object.entries(BUNDLE).map(([p, m]) => [p.split('/').pop(), (m.default ?? m)]),
);
const FILE_NAMES = Object.keys(FILES);
// Archetype card pools keyed by class name, for the generator + reward pools.
const POOLS = Object.fromEntries(Object.values(FILES).map((f) => [f.class, f.cards || []]));
const ROSTER = buildRoster(POOLS, POOLS.Warrior || []);

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
  const [showPlaytest, setShowPlaytest] = useState(false); // advanced playtest knobs (collapsed)
  const [showChangelog, setShowChangelog] = useState(false);

  // The class of the selected deck → which primary attunements are legal (a combo is
  // legal if its FIRST base is legal; the 2nd may be anything — synthesis.js A4).
  const currentFile = loadDraft(deckFile) || FILES[deckFile] || {};
  const deckClass = currentFile.class;
  const legalPrimary = deckClass ? legalAttunements([deckClass]) : ATTUNEMENT_BASES;

  function heroAttunement() {
    const a = [att1, att2].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
    return a.length ? a : ['Physical'];
  }

  /** The selected file's playable cards + the chosen attunement's own cards (§14.3)
   *  = the creature's full potential pool (the DeckBuilder's pool / Quick Fight deck). */
  function poolForFile() {
    const file = loadDraft(deckFile) || FILES[deckFile] || { cards: [] };
    const cards = (file.cards || []).filter((c) => c.type !== 'curse' && c.type !== 'status');
    // ~75% of the archetype cards convert to the creature's attunement (§14.3),
    // then add the attunement's own on-element cards (already correctly typed).
    return [...reskinDeck(cards, heroAttunement()), ...attunementCards(heroAttunement())];
  }

  /** The full POTENTIAL pool the deckbuilder draws from: the auto pool PLUS §14.3
   *  variant access — archetype attacks re-elemented to the creature's OTHER
   *  attunement, so a multi-attunement creature can choose its damage element per card.
   *  (Quick Fight stays on the lean poolForFile() to avoid duplicate-attack bloat.) */
  function builderPool() {
    const file = loadDraft(deckFile) || FILES[deckFile] || { cards: [] };
    const cards = (file.cards || []).filter((c) => c.type !== 'curse' && c.type !== 'status');
    return [...poolForFile(), ...attunementVariants(cards, heroAttunement())];
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

  /** A single creature's potential pool (archetype reskinned + attunement cards + variants). */
  function creatureRewardPool(c) {
    const pool = POOLS[c.class?.[0]] || [];
    return [...reskinDeck(pool, c.attunement), ...attunementCards(c.attunement), ...attunementVariants(pool, c.attunement)];
  }
  function startSelectedRun(creatures) {
    if (!creatures.length) return;
    // Per-member pools (each character drafts its OWN card rewards) + a combined pool for the shop.
    const rewardPools = Object.fromEntries(creatures.map((c) => [c.id, creatureRewardPool(c)]));
    const rewardPool = Object.values(rewardPools).flat();
    useRun.getState().startRun({ party: creatures, seed: Date.now(), rewardPool, rewardPools });
    setView('run');
  }
  function continueRun() { if (useRun.getState().loadSaved()) setView('run'); }

  if (view === 'editor') return <CardEditor onMenu={() => setView('menu')} />;
  if (view === 'combat') return <CombatScreen onMenu={() => setView('menu')} onRestart={() => launchCombat(lastDeck)} />;
  if (view === 'run') return <RunScreen onMenu={() => setView('menu')} onNewRun={() => setView('select')} />;
  if (view === 'select') return <SelectScreen roster={ROSTER} onConfirm={startSelectedRun} onCancel={() => setView('menu')} />;
  if (view === 'deckbuild') return (
    <DeckBuilder
      pool={builderPool()}
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
        <p className="menuSub">Card-driven creature deckbuilder{' '}
          <button className="menuVersion" onClick={() => setShowChangelog(true)} title="View changelog">{APP_VERSION}</button>
        </p>

        {/* Primary: descend */}
        <button className="menuBtn big" onClick={() => setView('select')}>
          ⚔ Choose Your Team &amp; Descend
        </button>
        {useRun.getState().hasSave() && (
          <button className="menuBtn" onClick={continueRun}>↻ Continue Saved Run</button>
        )}

        {/* Secondary: forge */}
        <button className="menuBtn" onClick={() => setView('editor')}>
          🃏 Open the Card Forge
        </button>

        {/* Advanced: playtest knobs, collapsed by default */}
        <button className="menuToggle" onClick={() => setShowPlaytest((v) => !v)} aria-expanded={showPlaytest}>
          <span>⚔ Playtest Combat</span>
          <span className="menuChevron">{showPlaytest ? '▾' : '▸'}</span>
        </button>
        {showPlaytest && (
          <div className="menuSetup">
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
                Quick Fight
              </button>
            </div>
            <p className="menuHint">
              Set your attunement (a 2nd drives Imbue, e.g. Fire→Burn) and give the dummy an
              attunement/biology to test matchups.
            </p>
          </div>
        )}
      </div>

      {showChangelog && (
        <div className="clWrap" onClick={() => setShowChangelog(false)}>
          <div className="clCard" onClick={(e) => e.stopPropagation()}>
            <button className="clClose" onClick={() => setShowChangelog(false)}>✕</button>
            <h2>Changelog <span className="clCardVer">{APP_VERSION}</span></h2>
            <div className="clList">
              {CHANGELOG.map((rel) => (
                <div className="clRel" key={rel.version}>
                  <div className="clRelHead"><b>{rel.version}</b><span>{rel.date}</span></div>
                  <ul>{rel.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
