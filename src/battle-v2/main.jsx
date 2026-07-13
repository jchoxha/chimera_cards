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

  // (re)build the board: a battle when entering an encounter, else a PEACEFUL party-only field
  // (enemy: [] — we simply never resolve, so no auto-win). Keyed so travel between peaceful
  // chunks does NOT rebuild (only the biome/scene changes live).
  const startedFor = useRef(null);
  useEffect(() => {
    const k = mode === 'battle' ? `b:${battleChunk}` : 'explore';
    if (startedFor.current === k) return;
    startedFor.current = k;
    if (mode === 'battle') useBattle.getState().startBattle({ player: party, enemy: pendingEnemy || enemyFor(0) });
    else useBattle.getState().startBattle({ player: party, enemy: [] });
  }, [mode, battleChunk, pendingEnemy, party]);

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
        onCloseEvent={closeEvent}
        onTravel={move}
        onFlee={fleeBattle}
        onBattleEnd={(r) => (r === 'win' ? winBattle() : fleeBattle())} />
      {flash && <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: BIOMES[biome]?.fog || '#0c0805', pointerEvents: 'none', animation: 'shellFlash .38s ease-out forwards' }} />}
      <style>{'@keyframes shellFlash{from{opacity:.7}to{opacity:0}}'}</style>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Shell />);
