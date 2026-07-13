// Entry for the COMBAT-V2 squad-battle + SEAMLESS OPEN-WORLD (battle.html). There is ONE
// 3D board (BattleScreen/Board3D). The battlefield IS a chunk of the overworld: when no
// battle is happening the party stands on a peaceful chunk (no enemies, combat HUD hidden,
// a travel HUD instead); walking into a wild/dungeon chunk drops enemies onto the SAME field
// and shows the combat HUD. worldStore.mode just switches which HUD renders — no scene swap.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/theme.css';
import BattleScreen from '../ui/battle/BattleScreen.jsx';
import { useBattle } from '../store/battleStore.js';
import { useWorld, enemyFor } from '../store/worldStore.js';
import { BIOMES } from '../ui/battle/SceneEnv.jsx';

if (import.meta.env.DEV && typeof window !== 'undefined') { window.__battle = useBattle; window.__world = useWorld; }

function Shell() {
  const mode = useWorld((s) => s.mode);
  const grid = useWorld((s) => s.grid);
  const pos = useWorld((s) => s.pos);
  const gridW = useWorld((s) => s.gridW);
  const gridH = useWorld((s) => s.gridH);
  const pendingEnemy = useWorld((s) => s.pendingEnemy);
  const battleChunk = useWorld((s) => s.battleChunk);
  const party = useWorld((s) => s.party);
  const move = useWorld((s) => s.move);
  const event = useWorld((s) => s.event);
  const closeEvent = useWorld((s) => s.closeEvent);
  const winBattle = useWorld((s) => s.winBattle);
  const fleeBattle = useWorld((s) => s.fleeBattle);
  const biome = grid[`${pos.x},${pos.y}`]?.biome || 'forest';

  // Build the party board ONCE (peaceful, no enemies). It is NEVER rebuilt after this, so the
  // party's HP + decks PERSIST across chunks + fights.
  const booted = useRef(false);
  useEffect(() => { if (!booted.current) { booted.current = true; useBattle.getState().startBattle({ player: party, enemy: [] }); } }, [party]);

  // enter a fight → drop enemies onto the SAME board; return to explore → strip them off. The
  // party state is untouched either way (persistence).
  const wasBattle = useRef(false);
  useEffect(() => {
    if (!booted.current) return;
    if (mode === 'battle') { useBattle.getState().spawnEnemies(pendingEnemy || enemyFor(0)); wasBattle.current = true; }
    else if (wasBattle.current) { useBattle.getState().despawnEnemies(); wasBattle.current = false; }
  }, [mode, pendingEnemy, battleChunk]);

  // a light flash on entering/leaving combat so enemies appear-with-a-beat, not a hard pop.
  const [flash, setFlash] = useState(false);
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== mode) { prevMode.current = mode; setFlash(true); const t = setTimeout(() => setFlash(false), 380); return () => clearTimeout(t); }
    return undefined;
  }, [mode]);

  return (
    <>
      <BattleScreen
        sceneBiome={biome}
        worldMode={mode}
        world={{ gridW, gridH, grid, pos, biome }}
        event={event}
        onCloseEvent={() => { if (event?.kind === 'town') useBattle.getState().healParty(); closeEvent(); }}
        onTravel={move}
        onFlee={fleeBattle}
        onBattleEnd={(r) => (r === 'win' ? winBattle() : fleeBattle())} />
      {flash && <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: BIOMES[biome]?.fog || '#0c0805', pointerEvents: 'none', animation: 'shellFlash .38s ease-out forwards' }} />}
      <style>{'@keyframes shellFlash{from{opacity:.7}to{opacity:0}}'}</style>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Shell />);
