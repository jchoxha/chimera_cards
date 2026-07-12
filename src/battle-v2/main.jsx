// Entry for the COMBAT-V2 squad-battle + OPEN-WORLD demo (battle.html). A thin SHELL
// switches between the 3D exploration WorldScene and the BattleScreen off worldStore.mode.
// Boots straight into a battle (the long-standing combat demo); RUN AWAY from it (or win)
// drops you into the overworld, and walking into a battleground chunk starts a new battle.
// Runs ALONGSIDE the v1 app — nothing here touches the live game.
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/theme.css';
import BattleScreen from '../ui/battle/BattleScreen.jsx';
import WorldScene from '../ui/world/WorldScene.jsx';
import { useBattle } from '../store/battleStore.js';
import { useWorld, enemyFor } from '../store/worldStore.js';

if (import.meta.env.DEV && typeof window !== 'undefined') { window.__battle = useBattle; window.__world = useWorld; }

function Shell() {
  const mode = useWorld((s) => s.mode);
  const pendingEnemy = useWorld((s) => s.pendingEnemy);
  const battleChunk = useWorld((s) => s.battleChunk);
  const party = useWorld((s) => s.party);
  const winBattle = useWorld((s) => s.winBattle);
  const fleeBattle = useWorld((s) => s.fleeBattle);
  const startedFor = useRef(null);

  // (re)start a battle whenever we ENTER battle mode for a new encounter.
  useEffect(() => {
    if (mode !== 'battle') { startedFor.current = null; return; }
    const key = `${battleChunk || 'demo'}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    useBattle.getState().startBattle({ player: party, enemy: pendingEnemy || enemyFor(0) });
  }, [mode, pendingEnemy, battleChunk, party]);

  if (mode === 'explore') return <WorldScene />;
  return <BattleScreen onFlee={fleeBattle} onBattleEnd={(r) => (r === 'win' ? winBattle() : fleeBattle())} />;
}

createRoot(document.getElementById('root')).render(<Shell />);
