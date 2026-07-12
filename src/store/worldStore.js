// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/worldStore — the OPEN-WORLD layer for combat-v2. The world is  ║
// ║ a GRID of stitched CHUNKS; each chunk is a tile the party can stand on, and  ║
// ║ some chunks are BATTLEGROUNDS. Walking into an uncleared battleground starts ║
// ║ a battle (mode → 'battle'); winning clears the chunk, fleeing bumps the      ║
// ║ party back — either way you return to 'explore'. This store owns the mode    ║
// ║ switch + the persistent world; the battleStore stays combat-only. The shell  ║
// ║ (battle-v2/main.jsx) renders WorldScene or BattleScreen off `mode`. This is  ║
// ║ the roguelike seam: chunks are procedurally themed, and each is a scene the  ║
// ║ battlefield can transition into seamlessly.                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { create } from 'zustand';
import { buildRoster, ROSTER as ROSTER_ENTRIES } from '../data/roster.js';
import { POOLS, rosterPool } from '../app/pools.js';

const ROSTER = buildRoster(POOLS, POOLS.Warrior || [], rosterPool);
const IDS = ROSTER_ENTRIES.map((r) => r.id);
const byId = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];
const pick = (i) => byId(IDS[((i % IDS.length) + IDS.length) % IDS.length]);

// starting party = the same trio-of-squads the combat demo used.
export function makeParty() {
  return [
    { creatures: [pick(0), pick(1), pick(2)] },   // Vanguard + 2 Support
    { creatures: [pick(3)] },                      // solo squad
    { creatures: [pick(9), pick(10)] },            // duo squad
  ];
}
// enemy for a battleground chunk — varied by the chunk's seed.
export function enemyFor(seed = 0) {
  const s = seed * 2;
  return [
    { creatures: [pick(4 + s), pick(5 + s)] },
    { creatures: [pick(6 + s)] },
  ];
}

const GRID_W = 6, GRID_H = 6;
const key = (x, y) => `${x},${y}`;
// battlegrounds scattered on the grid (spawn is the centre, kept clear).
const BATTLE_CELLS = [[4, 1], [1, 2], [3, 4], [5, 3], [0, 5], [2, 0]];

function makeGrid() {
  const chunks = {};
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) chunks[key(x, y)] = { x, y, kind: 'field', cleared: false, seed: (x * 7 + y * 13) % 5 };
  BATTLE_CELLS.forEach(([x, y], i) => { chunks[key(x, y)] = { x, y, kind: 'battle', cleared: false, seed: i }; });
  return chunks;
}

export const useWorld = create((set, get) => ({
  mode: 'battle',              // 'battle' | 'explore' — the shell renders off this
  gridW: GRID_W, gridH: GRID_H,
  grid: makeGrid(),
  pos: { x: 2, y: 3 },         // party's current chunk (spawn)
  prevPos: { x: 2, y: 3 },     // where we came from (flee bumps back here)
  party: makeParty(),          // persistent player squads
  pendingEnemy: null,          // enemy squads for the battle we're entering
  battleChunk: null,           // chunk key of the active/last battle
  moveSeq: 0,                  // bumps on every move so the scene can tween

  keyOf: key,

  /** Move the party one chunk. Entering an uncleared battleground starts a battle. */
  move(dx, dy) {
    const s = get();
    if (s.mode !== 'explore') return;
    const nx = Math.max(0, Math.min(s.gridW - 1, s.pos.x + dx));
    const ny = Math.max(0, Math.min(s.gridH - 1, s.pos.y + dy));
    if (nx === s.pos.x && ny === s.pos.y) return;
    const ch = s.grid[key(nx, ny)];
    if (ch.kind === 'battle' && !ch.cleared) {
      set({ prevPos: { x: s.pos.x, y: s.pos.y }, pos: { x: nx, y: ny }, moveSeq: s.moveSeq + 1 });
      get().enterBattle(key(nx, ny));
      return;
    }
    set({ pos: { x: nx, y: ny }, prevPos: { x: s.pos.x, y: s.pos.y }, moveSeq: s.moveSeq + 1 });
  },

  /** Begin a battle on a chunk (or a standalone one). */
  enterBattle(chunkKey) {
    const s = get();
    const ch = chunkKey ? s.grid[chunkKey] : null;
    set({ mode: 'battle', pendingEnemy: enemyFor(ch?.seed ?? 0), battleChunk: chunkKey || null });
  },

  /** WON a battle → clear the chunk, back to exploration. */
  winBattle() {
    const s = get();
    const grid = { ...s.grid };
    if (s.battleChunk && grid[s.battleChunk]) grid[s.battleChunk] = { ...grid[s.battleChunk], kind: 'field', cleared: true };
    set({ mode: 'explore', grid, pendingEnemy: null, battleChunk: null });
  },

  /** FLED (ran away, or lost) → back to exploration, bumped to the previous chunk. */
  fleeBattle() {
    const s = get();
    set({ mode: 'explore', pos: s.prevPos || s.pos, pendingEnemy: null, battleChunk: null, moveSeq: s.moveSeq + 1 });
  },
}));
