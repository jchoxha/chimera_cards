// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/map — act map generation + navigation helpers.    ║
// ║ LINEAR act for now (start→…→boss); the node/edge shape is branch-ready ║
// ║ so we can add multiple paths later without changing the run actions.  ║
// ║ UPDATE WHEN: node types, the act layout, or distribution change.     ║
// ╚══════════════════════════════════════════════════════════════════╝

export const NODE_TYPES = Object.freeze(['start', 'combat', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss']);

/** Pick an interior (non-first/non-boss) node type, seeded + position-aware. */
function interiorType(rng, floor, floors) {
  const progress = floor / floors;
  const roll = rng.next();
  if (progress > 0.4 && roll < 0.15) return 'elite';   // elites only mid/late
  if (roll < 0.34) return 'event';
  if (roll < 0.46) return 'treasure';
  if (roll < 0.58) return 'shop';
  if (roll < 0.70 && progress > 0.3) return 'rest';
  return 'combat';                                       // default / most common
}

/**
 * Generate a linear act: a sequence of typed nodes start→…→rest→boss.
 * @param {{next:()=>number}} rng seeded run RNG
 * @param {{ floors?: number, act?: number }} [opts]
 * @returns {{ act:number, floors:number, nodes:Array, edges:Array, start:string, bossId:string }}
 */
export function generateAct(rng, { floors = 10, act = 1 } = {}) {
  const id = (f) => `a${act}-f${f}`;
  const nodes = [];
  const edges = [];
  for (let f = 0; f < floors; f++) {
    let type;
    if (f === 0) type = 'start';                  // you begin HERE (not a room)
    else if (f === 1) type = 'combat';            // the act opens on a fight
    else if (f === floors - 1) type = 'boss';
    else if (f === floors - 2) type = 'rest';     // a campfire before the boss
    else type = interiorType(rng, f, floors);
    nodes.push({ id: id(f), type, floor: f, act, visited: f === 0 });
    if (f > 0) edges.push([id(f - 1), id(f)]);
  }
  return { act, floors, nodes, edges, start: nodes[0].id, bossId: nodes[floors - 1].id };
}

// ── navigation helpers ────────────────────────────────────────────────────────
export const nodeById = (map, nodeId) => (map ? map.nodes.find((n) => n.id === nodeId) || null : null);
export const reachableFrom = (map, nodeId) => (map ? map.edges.filter((e) => e[0] === nodeId).map((e) => e[1]) : []);
export const currentNode = (state) => nodeById(state.map, state.position);
export const isBoss = (state) => currentNode(state)?.type === 'boss';
