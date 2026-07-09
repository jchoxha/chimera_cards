// Entry for the COMBAT-V2 squad-battle demo (battle.html). Builds a demo battle
// from real roster creatures and mounts the new BattleScreen. Runs ALONGSIDE the
// v1 app — nothing here touches the live game.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/theme.css';
import BattleScreen from '../ui/battle/BattleScreen.jsx';
import { useBattle } from '../store/battleStore.js';
import { buildRoster, ROSTER as ROSTER_ENTRIES } from '../data/roster.js';
import { POOLS, rosterPool } from '../app/pools.js';

const ROSTER = buildRoster(POOLS, POOLS.Warrior || [], rosterPool);
const byId = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];

// A demo: three player squads vs three enemy squads (mix of front + support) —
// enough to exercise the field carousel + per-squad card piles on both sides.
function demo() {
  const ids = ROSTER_ENTRIES.map((r) => r.id);
  const pick = (i) => byId(ids[i % ids.length]);
  return {
    player: [
      { creatures: [pick(0), pick(1), pick(2)] },   // full squad (Vanguard + 2 Support)
      { creatures: [pick(3)] },                      // solo squad
      { creatures: [pick(9), pick(10)] },            // duo squad
    ],
    enemy: [
      { creatures: [pick(4), pick(5)] },
      { creatures: [pick(6), pick(7), pick(8)] },
      { creatures: [pick(11)] },
    ],
  };
}

if (import.meta.env.DEV && typeof window !== 'undefined') window.__battle = useBattle;

function App() {
  useEffect(() => { useBattle.getState().startBattle(demo()); }, []);
  return <BattleScreen />;
}

createRoot(document.getElementById('root')).render(<App />);
