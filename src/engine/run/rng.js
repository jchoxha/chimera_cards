// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/rng — seeded deterministic PRNG (mulberry32) for  ║
// ║ the run layer. The integer state lives IN run state, so undo/redo and ║
// ║ save/load reproduce the exact sequence. See docs/run-layer-gap.md.   ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Build a mulberry32 PRNG fully determined by its 32-bit integer state.
 * @param {number} seed  initial state (use the run's saved `rngState`).
 * @returns {{ next: ()=>number, int: (n:number)=>number, pick: <T>(a:T[])=>T, state: number }}
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    get state() { return a >>> 0; },
  };
}

/** Hash an arbitrary string seed → 32-bit int (so runs can be shared by word). */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
