// Entry for the COMBAT-V2 squad-battle + SEAMLESS OPEN-WORLD (battle.html). There is ONE
// 3D board (BattleScreen/Board3D). The battlefield IS a chunk of the overworld: when no
// battle is happening the party stands on a peaceful chunk (no enemies, combat HUD hidden,
// a travel HUD instead); walking into a wild/dungeon chunk drops enemies onto the SAME field
// and shows the combat HUD. worldStore.mode just switches which HUD renders — no scene swap.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/theme.css';
import BattleScreen from '../ui/battle/BattleScreen.jsx';
import { useBattle, draftReward } from '../store/battleStore.js';
import { useWorld, enemyFor } from '../store/worldStore.js';
import { BIOMES } from '../ui/battle/SceneEnv.jsx';
import { isNativeShell } from '../ai/provider.js';

const MENU_URL = ((import.meta.env && import.meta.env.BASE_URL) || '/') + 'index.html';

if (import.meta.env.DEV && typeof window !== 'undefined') { window.__battle = useBattle; window.__world = useWorld; }

function Shell() {
  const mode = useWorld((s) => s.mode);
  const grid = useWorld((s) => s.grid);
  const pos = useWorld((s) => s.pos);
  const gridW = useWorld((s) => s.gridW);
  const gridH = useWorld((s) => s.gridH);
  const pendingEnemy = useWorld((s) => s.pendingEnemy);
  const battleChunk = useWorld((s) => s.battleChunk);
  const facing = useWorld((s) => s.facing);
  const turns = useWorld((s) => s.turns);
  const step = useWorld((s) => s.step);
  const turn = useWorld((s) => s.turn);
  const event = useWorld((s) => s.event);
  const closeEvent = useWorld((s) => s.closeEvent);
  const winBattle = useWorld((s) => s.winBattle);
  const fleeBattle = useWorld((s) => s.fleeBattle);
  const reward = useWorld((s) => s.reward);
  const runOver = useWorld((s) => s.runOver);
  const gold = useWorld((s) => s.gold);
  const runSeq = useWorld((s) => s.runSeq);
  const collectReward = useWorld((s) => s.collectReward);
  const skipReward = useWorld((s) => s.skipReward);
  const loseRun = useWorld((s) => s.loseRun);
  const newRun = useWorld((s) => s.newRun);
  const addGold = useWorld((s) => s.addGold);
  const spendGold = useWorld((s) => s.spendGold);
  const markBought = useWorld((s) => s.markBought);
  const biome = grid[`${pos.x},${pos.y}`]?.biome || 'forest';

  const firstSquadId = () => useBattle.getState().snapshot?.player?.[0]?.id || null;
  // a town-shop purchase: spend gold, add the card to the chosen squad, mark it sold.
  const buyShopCard = (idx, squadId) => {
    const ev = useWorld.getState().event; const item = ev?.shop?.[idx];
    if (!item || (ev.bought || []).includes(idx)) return;
    if (!spendGold(item.price)) return;
    useBattle.getState().grantCard(squadId || firstSquadId(), item.card);
    markBought(idx);
  };
  // an event choice boon: heal · gold · a free drafted card (to the front squad).
  const takeEventChoice = (choice) => {
    if (choice?.kind === 'heal') useBattle.getState().healParty();
    else if (choice?.kind === 'gold') addGold(choice.amount || 0);
    else if (choice?.kind === 'card') useBattle.getState().grantCard(firstSquadId(), draftReward(1)[0]);
    closeEvent();
  };

  // Build the party board ONCE per RUN (peaceful, no enemies). It is not rebuilt within a run, so
  // the party's HP + decks PERSIST across chunks + fights; a NEW run (runSeq bump) re-boots it.
  const booted = useRef(false);
  const bootedSeq = useRef(-1);
  useEffect(() => {
    if (bootedSeq.current === runSeq) return;
    bootedSeq.current = runSeq; booted.current = true;
    useBattle.getState().startBattle({ player: useWorld.getState().party, enemy: [] });
  }, [runSeq]);

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
        world={{ gridW, gridH, grid, pos, biome, facing, turns, gold }}
        event={event}
        onCloseEvent={() => { if (event?.kind === 'town') useBattle.getState().healParty(); closeEvent(); }}
        onEventChoice={takeEventChoice}
        onBuyCard={buyShopCard}
        reward={reward}
        onCollectReward={(sel) => {
          const bs = useBattle.getState();
          if (sel?.card && sel?.squadId) bs.grantCard(sel.squadId, sel.card);
          if (sel?.capture) bs.addPlayerCreature(sel.capture);
          collectReward(sel);
        }}
        onSkipReward={skipReward}
        runOver={runOver}
        onNewRun={newRun}
        onStep={step}
        onTurn={turn}
        onFlee={fleeBattle}
        onBattleEnd={(r) => (r === 'win' ? winBattle() : loseRun())} />
      {flash && <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: BIOMES[biome]?.fog || '#0c0805', pointerEvents: 'none', animation: 'shellFlash .38s ease-out forwards' }} />}
      {/* In the Android app there's no browser chrome, so give the player a way back to the
          game menu (index.html → GameMenu). Web users have the hub nav already. */}
      {isNativeShell() && (
        <button onClick={() => { if (confirm('Return to the main menu? Your current run will be left behind.')) window.location.href = MENU_URL; }}
          title="Main menu"
          style={{ position: 'fixed', top: 8, left: 8, zIndex: 9500, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(20,16,26,.72)', color: '#efe6d6', font: '13px system-ui', cursor: 'pointer' }}>
          ☰ Menu
        </button>
      )}
      <style>{'@keyframes shellFlash{from{opacity:.7}to{opacity:0}}'}</style>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Shell />);
