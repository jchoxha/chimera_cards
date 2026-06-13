import { clamp } from "../utils.js";
const NODE_TYPES = {
  fight: { icon: "⚔️", label: "Battle", color: "#ff8a4d" },
  elite: { icon: "💀", label: "Elite", color: "#ff5a4d" },
  treasure: { icon: "💎", label: "Treasure", color: "#5fd0e0" },
  mystery: { icon: "❓", label: "Mystery", color: "#a571ff" },
  shop: { icon: "🛒", label: "Shop", color: "#ffd34d" },
  rest: { icon: "🔥", label: "Rest", color: "#7ee787" },
  boss: { icon: "🐉", label: "Boss", color: "#ff4dd2" },
};

// Generate a layered DAG: ROWS rows, each with a few nodes, edges only
// to the next row. Row 0 is the start fight, last row is the boss.
function generateMap(rows = 9) {
  const layout = [];
  for (let r = 0; r < rows; r++) {
    let count;
    if (r === 0) count = 1;
    else if (r === rows - 1) count = 1; // boss
    else count = 2 + Math.floor(Math.random() * 3); // 2-4
    const row = [];
    for (let i = 0; i < count; i++) {
      row.push({
        id: `${r}-${i}`,
        row: r,
        col: i,
        type: pickNodeType(r, rows),
        edges: [],
        visited: false,
      });
    }
    layout.push(row);
  }
  // connect each node to 1-2 nodes in the next row, keeping it roughly aligned
  for (let r = 0; r < rows - 1; r++) {
    const cur = layout[r];
    const nxt = layout[r + 1];
    cur.forEach((node, i) => {
      const frac = cur.length === 1 ? 0.5 : i / (cur.length - 1);
      const targetCenter = Math.round(frac * (nxt.length - 1));
      const links = new Set();
      links.add(clamp(targetCenter, 0, nxt.length - 1));
      if (Math.random() < 0.5) links.add(clamp(targetCenter + (Math.random() < 0.5 ? 1 : -1), 0, nxt.length - 1));
      node.edges = [...links];
    });
    // ensure every next-row node has at least one incoming edge
    nxt.forEach((_, j) => {
      const hasIncoming = cur.some((n) => n.edges.includes(j));
      if (!hasIncoming) {
        // attach to nearest current node
        const frac = nxt.length === 1 ? 0.5 : j / (nxt.length - 1);
        const src = clamp(Math.round(frac * (cur.length - 1)), 0, cur.length - 1);
        cur[src].edges.push(j);
      }
    });
  }
  return layout;
}

function pickNodeType(r, rows) {
  if (r === 0) return "fight";
  if (r === rows - 1) return "boss";
  if (r === rows - 2) return "rest"; // a rest before the boss
  const roll = Math.random();
  // weight types; elites and shops rarer
  if (roll < 0.40) return "fight";
  if (roll < 0.55) return "mystery";
  if (roll < 0.68) return "treasure";
  if (roll < 0.80) return "rest";
  if (roll < 0.90) return "elite";
  return "shop";
}

// ---------- Overworld (Pokémon-style tile map) ----------
// Tiles: 0 grass, 1 tall grass (wild encounters), 2 water (blocked),
// 3 tree/wall (blocked), 4 path. Special features sit on top of walkable
// tiles: shop, inn (rest), dungeon entrances.
const OW_W = 12;
const OW_H = 10;

function generateOverworld() {
  // base: mostly grass with a water border feature and scattered trees
  const tiles = [];
  for (let y = 0; y < OW_H; y++) {
    const row = [];
    for (let x = 0; x < OW_W; x++) {
      let t = 0; // grass
      // a lake in the bottom-right
      if (x >= OW_W - 3 && y >= OW_H - 3) t = 2;
      // a river column
      else if (x === 3 && y > 1 && y < OW_H - 2) t = 2;
      // scattered trees
      else if (Math.random() < 0.10) t = 3;
      row.push(t);
    }
    tiles.push(row);
  }
  // carve two tall-grass patches
  const patch = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x >= 0 && x < OW_W && y >= 0 && y < OW_H && tiles[y][x] !== 2) tiles[y][x] = 1;
  };
  patch(7, 2, 1);
  patch(2, 6, 1);

  // a bridge across the river so the map is traversable
  tiles[Math.floor(OW_H / 2)][3] = 4;

  const start = { x: 1, y: 1 };
  tiles[start.y][start.x] = 0;

  // features placed on walkable tiles
  const features = [
    { type: "den", x: 1, y: 2, icon: "🏠", label: "Your Den" },
    { type: "npc", npc: "professor", x: 3, y: 1, icon: "🧑‍🔬", label: "Professor Bramble" },
    { type: "npc", npc: "rival", x: 7, y: 3, icon: "🧑‍🎤", label: "Kael (rival)" },
    { type: "shop", x: 5, y: 1, icon: "🛒", label: "Town Shop" },
    { type: "inn", x: 9, y: 1, icon: "🏨", label: "Inn (Rest)" },
    { type: "dungeon", x: 8, y: 4, icon: "🏚️", label: "Ruins", depth: 1 },
    { type: "dungeon", x: 2, y: 8, icon: "🗻", label: "Cavern", depth: 2 },
    { type: "dungeon", x: 6, y: 7, icon: "🏯", label: "Citadel", depth: 3 },
  ];
  // make sure feature tiles are walkable grass
  features.forEach((f) => (tiles[f.y][f.x] = 0));

  return { tiles, features, start };
}

function featureAt(ow, x, y) {
  return ow.features.find((f) => f.x === x && f.y === y) || null;
}
function isWalkable(ow, x, y) {
  if (x < 0 || x >= OW_W || y < 0 || y >= OW_H) return false;
  const t = ow.tiles[y][x];
  return t !== 2 && t !== 3; // not water, not tree
}

// ============================================================
// COMPONENT
// ============================================================

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/quests — NPCs + quest chains. UPDATE WHEN: new stats
// ║ exist to quest against; new NPCs need an overworld feature + dialog;
// ║ quest state is PERSISTENT (serializeSave/hydrateSave must carry it).
// ╚══════════════════════════════════════════════════════════════════╝

export { NODE_TYPES, generateMap, pickNodeType, OW_W, OW_H, generateOverworld, featureAt, isWalkable };
