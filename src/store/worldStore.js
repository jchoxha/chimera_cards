// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/worldStore — the OPEN-WORLD layer for combat-v2. A PROCEDURALLY  ║
// ║ generated grid of stitched CHUNKS: each chunk has a BIOME (forest/plains/      ║
// ║ desert/snow/marsh) and CONTENT (empty · wild encounter · town · event ·        ║
// ║ dungeon). The party walks chunk-to-chunk; wild/dungeon chunks hand off to a    ║
// ║ battle FOUGHT ON THAT CHUNK'S BIOME (the battlefield IS the overworld spot),   ║
// ║ towns/events pop a modal. Winning clears the chunk; fleeing bumps the party    ║
// ║ back. worldStore owns the mode + persistent world; battleStore stays combat.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { create } from 'zustand';
import { buildRoster, ROSTER as ROSTER_ENTRIES } from '../data/roster.js';
import { POOLS, rosterPool } from '../app/pools.js';
import { BIOMES } from '../ui/battle/SceneEnv.jsx';

const ROSTER = buildRoster(POOLS, POOLS.Warrior || [], rosterPool);
const IDS = ROSTER_ENTRIES.map((r) => r.id);
const byId = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];
const pick = (i) => byId(IDS[((i % IDS.length) + IDS.length) % IDS.length]);

export function makeParty() {
  return [
    { creatures: [pick(0), pick(1), pick(2)] },
    { creatures: [pick(3)] },
    { creatures: [pick(9), pick(10)] },
  ];
}
// enemy squads for an encounter — `tough` (dungeon) adds a third squad.
export function enemyFor(seed = 0, tough = false) {
  const s = seed * 2;
  const squads = [
    { creatures: [pick(4 + s), pick(5 + s)] },
    { creatures: [pick(6 + s)] },
  ];
  if (tough) squads.push({ creatures: [pick(7 + s), pick(8 + s)] });
  return squads;
}

const GRID_W = 6, GRID_H = 6;
const key = (x, y) => `${x},${y}`;
const FACING_DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N, E, S, W
const BIOME_KEYS = Object.keys(BIOMES);          // forest/plains/desert/snow/swamp
const CONTENTS = ['empty', 'empty', 'empty', 'wild', 'wild', 'town', 'event', 'dungeon'];

// tiny value-noise so biomes form CLUSTERS (regions), not per-cell confetti.
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function makeGrid(seed) {
  const rng = mulberry32(seed);
  // per-region biome (2x2 cells share a region) → contiguous biome blobs
  const regionBiome = {};
  const biomeAt = (x, y) => {
    const rk = `${x >> 1},${y >> 1}`;
    if (!(rk in regionBiome)) regionBiome[rk] = BIOME_KEYS[(rng() * BIOME_KEYS.length) | 0];
    return regionBiome[rk];
  };
  const chunks = {};
  const spawn = { x: 2, y: 3 };
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const biome = biomeAt(x, y);
      let kind = 'empty';
      if (!(x === spawn.x && y === spawn.y)) kind = CONTENTS[(rng() * CONTENTS.length) | 0];
      chunks[key(x, y)] = { x, y, biome, kind, cleared: false, seed: (x * 7 + y * 13) % 5 };
    }
  }
  return chunks;
}

// flavour for town / event popups (kept light for the first cut)
const EVENTS = [
  { title: 'A Wandering Merchant', icon: 'game-icons:hooded-figure', text: 'A cloaked trader offers curios from distant lands. (Shop coming soon.)' },
  { title: 'Ancient Shrine', icon: 'game-icons:stone-tablet', text: 'You touch a mossy shrine. A calm resolve settles over your squads.' },
  { title: 'Abandoned Camp', icon: 'game-icons:campfire', text: 'A cold campfire and scattered supplies. You rest a moment before moving on.' },
  { title: 'Strange Lights', icon: 'game-icons:sparkles', text: 'Lights dance between the trees, then vanish. Curious — but harmless.' },
];
const TOWN = { title: 'A Quiet Town', icon: 'game-icons:village', text: 'Lantern-lit streets and a warm inn. Your party recovers here. (Shops & quests coming soon.)' };

export const useWorld = create((set, get) => ({
  mode: 'explore',             // 'battle' | 'explore' — drives which HUD BattleScreen shows (SAME 3D board)
  gridW: GRID_W, gridH: GRID_H,
  grid: makeGrid(1337),
  pos: { x: 2, y: 3 },
  prevPos: { x: 2, y: 3 },
  facing: 0,                   // 0=N 1=E 2=S 3=W — the direction the avatar/camera faces
  party: makeParty(),
  pendingEnemy: null,
  pendingBiome: 'forest',      // the biome the current battle is fought on
  battleChunk: null,
  event: null,                 // { kind:'town'|'event', chunkKey, title, icon, text }
  moveSeq: 0,

  keyOf: key,
  biomeAt(x, y) { return get().grid[key(x, y)]?.biome || 'forest'; },

  /** Rotate the facing 90° (d = -1 left / +1 right). */
  turn(d) { const s = get(); if (s.mode !== 'explore' || s.event) return; set({ facing: (((s.facing + d) % 4) + 4) % 4 }); },
  /** Move ONE chunk relative to the facing: forward / back / left / right (strafe). */
  step(rel) {
    const s = get(); if (s.mode !== 'explore' || s.event) return;
    const off = rel === 'forward' ? 0 : rel === 'right' ? 1 : rel === 'back' ? 2 : 3;   // left=3
    const [dx, dy] = FACING_DELTA[(s.facing + off) % 4];
    get().move(dx, dy);
  },

  /** Move the party one chunk. Battlegrounds start a fight; towns/events pop a modal. */
  move(dx, dy) {
    const s = get();
    if (s.mode !== 'explore' || s.event) return;
    const nx = Math.max(0, Math.min(s.gridW - 1, s.pos.x + dx));
    const ny = Math.max(0, Math.min(s.gridH - 1, s.pos.y + dy));
    if (nx === s.pos.x && ny === s.pos.y) return;
    const ch = s.grid[key(nx, ny)];
    const prev = { x: s.pos.x, y: s.pos.y };
    if (!ch.cleared && (ch.kind === 'wild' || ch.kind === 'dungeon')) {
      set({ prevPos: prev, pos: { x: nx, y: ny }, moveSeq: s.moveSeq + 1 });
      get().enterBattle(key(nx, ny));
      return;
    }
    if (!ch.cleared && (ch.kind === 'town' || ch.kind === 'event')) {
      const info = ch.kind === 'town' ? TOWN : EVENTS[(nx * 3 + ny * 5) % EVENTS.length];
      set({ prevPos: prev, pos: { x: nx, y: ny }, moveSeq: s.moveSeq + 1, event: { kind: ch.kind, chunkKey: key(nx, ny), ...info } });
      return;
    }
    set({ pos: { x: nx, y: ny }, prevPos: prev, moveSeq: s.moveSeq + 1 });
  },

  enterBattle(chunkKey) {
    const s = get();
    const ch = chunkKey ? s.grid[chunkKey] : null;
    const tough = ch?.kind === 'dungeon';
    set({ mode: 'battle', pendingEnemy: enemyFor(ch?.seed ?? 0, tough), pendingBiome: ch?.biome || 'forest', battleChunk: chunkKey || null });
  },

  /** Close a town/event popup → mark the chunk visited (cleared). */
  closeEvent() {
    const s = get();
    if (!s.event) return;
    const grid = { ...s.grid };
    const k = s.event.chunkKey;
    if (grid[k]) grid[k] = { ...grid[k], cleared: true };
    set({ grid, event: null });
  },

  winBattle() {
    const s = get();
    const grid = { ...s.grid };
    if (s.battleChunk && grid[s.battleChunk]) grid[s.battleChunk] = { ...grid[s.battleChunk], cleared: true };
    set({ mode: 'explore', grid, pendingEnemy: null, battleChunk: null });
  },

  fleeBattle() {
    const s = get();
    set({ mode: 'explore', pos: s.prevPos || s.pos, pendingEnemy: null, battleChunk: null, moveSeq: s.moveSeq + 1 });
  },
}));
