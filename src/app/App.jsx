// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/App — the unified shell + main menu. Routes between team   ║
// ║ assembly, the roguelike run, the practice fight, the custom-creature   ║
// ║ creator, the Card Forge (editor), and the Codex. Owns the saved team,  ║
// ║ custom creatures, and practice setup (all localStorage-persisted).     ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useState } from 'react';
import { useCombat } from '../store/combatStore.js';
import { useRun } from '../store/runStore.js';
import EditorHub from './EditorHub.jsx';
import CombatScreen from '../ui/combat/CombatScreen.jsx';
import RunScreen from '../ui/run/RunScreen.jsx';
import Codex from '../ui/Codex.jsx';
import SelectScreen from './SelectScreen.jsx';
import CreatureCreator from './CreatureCreator.jsx';
import StarterPick from './StarterPick.jsx';
import { ATTUNEMENT_BASES, BODY_TYPES, SUBTYPES, legalAttunements } from '../data/synthesis.js';
import { BEAST_FAMILIES } from '../engine/cards/beastPool.js';
import { makeCreature } from '../engine/content/generate.js';
import { POOLS, ARCHETYPES, basePoolFor, rosterPool, potentialPool } from './pools.js';
import { buildRoster, buildRosterCreature, buildDummyCreature, ROSTER as ROSTER_ENTRIES } from '../data/roster.js';
import {
  loadCollection, saveCollection, emptyCollection, seedFullCollection,
  addCaptured, capturedForms, STARTER_IDS,
} from './collection.js';
import { FORM_ORDER } from '../data/forms.js';
import { APP_VERSION } from '../version.js';
import { CHANGELOG } from '../data/changelog.js';
import './app.css';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const ROSTER = buildRoster(POOLS, POOLS.Warrior || [], rosterPool);
const DUMMY = buildDummyCreature();

if (import.meta.env.DEV && typeof window !== 'undefined') { window.__useRun = useRun; window.__useCombat = useCombat; }

const TEAM_KEY = 'chimera.team';
const PRACTICE_KEY = 'chimera.practiceOpp';
const PRACTICE_ACTIVE_KEY = 'chimera.practiceActive';
const PRACTICE_MS_KEY = 'chimera.practiceMs';
const CUSTOM_KEY = 'chimera.custom';
function loadIds(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
}
const loadTeamIds = () => loadIds(TEAM_KEY, []);

/** Build a run-ready creature from a custom definition (typings + lore/description).
 *  The deck is always auto-generated from the typings (no per-monster custom decks here). */
function buildCustomCreature(def) {
  const c = makeCreature({ id: def.id, name: def.name, class: def.class, biology: def.biology, attunement: def.attunement,
    family: def.family || null, anatomy: def.anatomy || null, weapons: def.weapons || null, subtypes: def.subtypes || null, size: def.size || 'regular',
    pool: basePoolFor({ klass: def.class?.[0], biology: def.biology, family: def.family, anatomy: def.anatomy, weapons: def.weapons, subtypes: def.subtypes, signatureCards: def.signatureCards }) });
  // The Editor (admin tool) can attach a hand-built deck; the end-user creator never does.
  if (def.customDeck && def.customDeck.length) c.deck = def.customDeck.map((card) => ({ ...card }));
  c.blurb = def.lore || def.blurb || `A custom ${(def.attunement || []).join('/')} ${(def.class || def.biology || []).join('/')}.`;
  c.lore = def.lore || null;
  c.description = def.description || null;
  c.signatureCards = def.signatureCards || null;
  c.portrait = def.portraitSvg || null;              // forged SVG portrait (data URI)
  c.meta = { portrait: def.portraitSvg || null, custom: true };
  c.custom = true;
  return c;
}

export default function App() {
  // The COLLECTION (discovered/captured creatures × sizes). null in storage means a
  // FRESH app → the starter pick. A legacy save (team but no collection) is seeded
  // with the full roster at native sizes so existing players lose nothing.
  const [collection, setCollection] = useState(() => {
    const stored = loadCollection();
    if (stored) return stored;
    if (loadTeamIds().length) { const seeded = seedFullCollection(ROSTER_ENTRIES); saveCollection(seeded); return seeded; }
    return null;   // fresh → starter pick
  });
  const updateCollection = (next) => { setCollection(next); saveCollection(next); };

  const [view, setView] = useState(() => (collection ? 'menu' : 'starter'));
  const [teamIds, setTeamIds] = useState(loadTeamIds);
  const [practiceOppIds, setPracticeOppIds] = useState(() => loadIds(PRACTICE_KEY, ['dummy']));
  const [practiceActive, setPracticeActive] = useState(() => !!localStorage.getItem(PRACTICE_ACTIVE_KEY));
  const [customDefs, setCustomDefs] = useState(() => loadIds(CUSTOM_KEY, []));
  const [showChangelog, setShowChangelog] = useState(false);
  const [codexTab, setCodexTab] = useState('creatures');
  const [codexReturn, setCodexReturn] = useState('menu');
  // Open the Codex at a tab; `from` is the view to return to (combat/run state is
  // preserved in its store, so we land right back where we were).
  const openCodex = (tab, from = 'menu') => { setCodexTab(tab || 'creatures'); setCodexReturn(from); setView('codex'); };

  // Custom creatures (rebuilt from their saved definitions) + the full pickable sets.
  const customCreatures = useMemo(() => customDefs.map(buildCustomCreature), [customDefs]);
  // The PLAYER roster = what's CAPTURED: one creature per captured (id, size) pair
  // (a non-native size is a distinct `<id>#<form>` variant with re-derived HP/Might).
  // Custom creations are yours by definition. Opponents draw from the FULL roster.
  const playerRoster = useMemo(() => {
    const out = []; const seen = new Set();
    for (const r of ROSTER_ENTRIES) {
      const forms = capturedForms(collection, r.id);
      const ordered = FORM_ORDER.filter((f) => forms.includes(f));
      for (const f of ordered) {
        const c = buildRosterCreature(r, rosterPool(r), f);
        // the Giant gate can coerce two captured sizes into one creature — dedupe
        if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
      }
    }
    return [...out, ...customCreatures];
  }, [collection, customCreatures]);
  const oppRoster = useMemo(() => [...ROSTER, ...customCreatures, DUMMY], [customCreatures]);

  // The chosen team (ordered; index 0 = vanguard), resolved to creatures.
  const team = teamIds.map((id) => playerRoster.find((c) => c.id === id)).filter(Boolean);
  function saveTeam(creatures) {
    const ids = creatures.map((c) => c.id);
    setTeamIds(ids);
    try { localStorage.setItem(TEAM_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
    setView('menu');
  }

  // Create a custom creature → save its definition, add it to the team, return to select.
  function createCustomCreature(def) {
    const full = { ...def, id: `custom_${slug(def.name) || 'creature'}_${customDefs.length + 1}_${Math.floor(performance.now())}` };
    const next = [...customDefs, full];
    setCustomDefs(next);
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setTeamIds((ids) => (ids.length < 3 ? [...ids, full.id] : ids));
    setView('select');
  }
  function deleteCustomCreature(id) {
    const next = customDefs.filter((d) => d.id !== id);
    setCustomDefs(next);
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setTeamIds((ids) => ids.filter((x) => x !== id));
  }
  // Editor (admin) upsert: create a new def or update an existing one by id.
  function saveCustomDef(def) {
    const id = def.id || `custom_${slug(def.name) || 'creature'}_${Date.now()}`;
    const full = { ...def, id };
    setCustomDefs((defs) => {
      const next = defs.some((d) => d.id === id) ? defs.map((d) => (d.id === id ? full : d)) : [...defs, full];
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return id;
  }

  // Starter pick (fresh app): capturing the starter begins the collection + team.
  const starters = useMemo(() => STARTER_IDS
    .map((id) => ROSTER_ENTRIES.find((r) => r.id === id)).filter(Boolean)
    .map((r) => buildRosterCreature(r, rosterPool(r))), []);
  function pickStarter(c) {
    updateCollection(addCaptured(emptyCollection(), c.baseId || c.id, c.meta?.form || 'regular'));
    setTeamIds([c.id]);
    try { localStorage.setItem(TEAM_KEY, JSON.stringify([c.id])); } catch { /* ignore */ }
    setView('menu');
  }
  // Admin reset → back to the fresh starter-pick state.
  function resetCollection() {
    setCollection(null);
    setTeamIds([]);
    try { localStorage.removeItem('chimera.collection'); localStorage.removeItem(TEAM_KEY); } catch { /* ignore */ }
    setView('starter');
  }

  // Practice fight: your team vs a chosen OPPONENT team (Target Dummy by default).
  const practiceOpp = practiceOppIds.map((id) => oppRoster.find((c) => c.id === id)).filter(Boolean);
  // `resume` keeps the saved playtime clock; a fresh fight resets it.
  function launchPractice(oppCreatures, { resume = false } = {}) {
    if (!team.length) return;
    const opp = (oppCreatures && oppCreatures.length) ? oppCreatures : (practiceOpp.length ? practiceOpp : [DUMMY]);
    let elapsedMs = 0;
    if (resume) { try { elapsedMs = Number(localStorage.getItem(PRACTICE_MS_KEY)) || 0; } catch { elapsedMs = 0; } }
    else { try { localStorage.setItem(PRACTICE_MS_KEY, '0'); } catch { /* ignore */ } }
    setPracticeActive(true);
    try { localStorage.setItem(PRACTICE_ACTIVE_KEY, '1'); } catch { /* ignore */ }
    useCombat.getState().startPlaytest({ party: team, enemyParty: opp, elapsedMs });
    setView('combat');
  }
  function confirmPracticeOpponents(oppCreatures) {
    const ids = (oppCreatures && oppCreatures.length ? oppCreatures : [DUMMY]).map((c) => c.id);
    setPracticeOppIds(ids);
    try { localStorage.setItem(PRACTICE_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
    launchPractice(oppCreatures);   // new setup → fresh clock
  }
  const restartCombat = () => launchPractice();   // NEW FIGHT → fresh clock
  // Leave the practice combat: persist the elapsed playtime so it resumes later.
  function leaveCombat() {
    const sa = useCombat.getState().startedAt;
    if (sa) { try { localStorage.setItem(PRACTICE_MS_KEY, String(Date.now() - sa)); } catch { /* ignore */ } }
    setView('menu');
  }

  /** A single creature's potential pool (biology base reskinned + attunement cards + variants). */
  function creatureRewardPool(c) { return potentialPool(c); }
  function beginRun() {
    const creatures = team;
    if (!creatures.length) { setView('select'); return; }
    // Per-member pools (each character drafts its OWN card rewards) + a combined pool for the shop.
    const rewardPools = Object.fromEntries(creatures.map((c) => [c.id, creatureRewardPool(c)]));
    const rewardPool = Object.values(rewardPools).flat();
    useRun.getState().startRun({ party: creatures, seed: Date.now(), rewardPool, rewardPools });
    setView('run');
  }
  function continueRun() { if (useRun.getState().loadSaved()) setView('run'); }

  if (view === 'starter') return <StarterPick starters={starters} onPick={pickStarter} />;
  if (view === 'codex') return <Codex initialTab={codexTab} backLabel={codexReturn === 'menu' ? 'Menu' : 'Back'} onMenu={() => setView(codexReturn)} collection={collection} />;
  if (view === 'editor') return (
    <EditorHub onMenu={() => setView('menu')}
      monsterProps={{
        defs: customDefs, classes: ARCHETYPES, biologies: BODY_TYPES, subtypeOptions: SUBTYPES, attunements: ATTUNEMENT_BASES,
        legalFor: (k) => legalAttunements([k]), buildPool: potentialPool, families: BEAST_FAMILIES,
        onSave: saveCustomDef, onDelete: deleteCustomCreature,
      }}
      collectionProps={{
        rosterEntries: ROSTER_ENTRIES, collection: collection || emptyCollection(),
        onChange: updateCollection, onReset: resetCollection,
      }} />
  );
  if (view === 'combat') return <CombatScreen onMenu={leaveCombat} onRestart={restartCombat} onCodex={(tab) => openCodex(tab, 'combat')} />;
  if (view === 'run') return <RunScreen onMenu={() => { if (useRun.getState().view === 'combat') useRun.getState()._recordPlayTime?.(); setView('menu'); }} onNewRun={() => setView('select')} onCodex={(tab) => openCodex(tab, 'run')} />;
  if (view === 'select') return <SelectScreen roster={playerRoster} initial={teamIds} onConfirm={saveTeam} onCancel={() => setView('menu')} onCreateCustom={() => setView('createCreature')} onDeleteCustom={deleteCustomCreature} />;
  if (view === 'practice') return (
    <SelectScreen roster={oppRoster} initial={practiceOppIds} onConfirm={confirmPracticeOpponents} onCancel={() => setView('menu')}
      title="Choose Practice Opponents"
      intro="Pick up to 3 creatures to spar against — the Target Dummy (last in the list) is a passive punching bag. Your own team fights them."
      teamLabel="Opponents" confirmLabel="Start Practice ⚔" />
  );
  if (view === 'createCreature') return (
    <CreatureCreator
      classes={ARCHETYPES} biologies={BODY_TYPES} attunements={ATTUNEMENT_BASES}
      legalFor={(k) => legalAttunements([k])}
      onCreate={createCustomCreature}
      onCancel={() => setView('select')}
    />
  );

  return (
    <div className="menu">
      <div className="menuCard">
        <h1 className="menuTitle">CHIMERA</h1>
        <p className="menuSub">Card-driven creature deckbuilder{' '}
          <button className="menuVersion" onClick={() => setShowChangelog(true)} title="View changelog">{APP_VERSION}</button>
        </p>

        {/* Your team — used for runs AND playtest fights */}
        <div className="teamSummary">
          {team.length === 0
            ? <span className="teamNone">No team assembled yet.</span>
            : <>
                <span className="tsTag">★ {team[0].name}</span>
                {team.slice(1).map((c) => <span key={c.id} className="tsTag bench">{c.name}</span>)}
              </>}
        </div>
        <button className="menuBtn big" onClick={() => setView('select')}>
          ⚔ Assemble Your Team
        </button>
        <div className="menuRow">
          <button className="menuBtn big" onClick={beginRun} disabled={!team.length}
            title={team.length ? 'Start a roguelike run with your team' : 'Assemble a team first'}>
            ▶ Begin Run
          </button>
          <button className="menuBtn big" onClick={() => setView('practice')} disabled={!team.length}
            title={team.length ? 'Spar with your team vs opponents you choose' : 'Assemble a team first'}>
            🛡 Practice Fight
          </button>
        </div>
        {useRun.getState().hasSave() && (
          <button className="menuBtn" onClick={continueRun}>↻ Continue Saved Run</button>
        )}
        {practiceActive && team.length > 0 && (
          <button className="menuBtn" onClick={() => launchPractice(null, { resume: true })}
            title={`Resume your practice fight vs ${practiceOpp.map((c) => c.name).join(', ') || 'Target Dummy'}`}>
            ↻ Continue Practice Fight
          </button>
        )}

        {/* Secondary: forge + codex */}
        <button className="menuBtn" onClick={() => setView('editor')}>
          🛠 Open the Editor
        </button>
        <button className="menuBtn" onClick={() => openCodex('creatures', 'menu')}>
          📖 Read the Codex
        </button>
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
