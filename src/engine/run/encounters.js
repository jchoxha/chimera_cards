// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/encounters — pick the enemy Fighter(s) for a node. ║
// ║ Enemies are drawn from the GENERATED ROSTER (data/roster.js) — the     ║
// ║ same (archetype, biology, attunement) creatures the player picks from, ║
// ║ so foes have real axes, portraits, stats and decks. Seeded by the run  ║
// ║ RNG for determinism; node tier + floor depth scale count + HP.         ║
// ║ UPDATE WHEN: enemy pools per node type / act scaling change.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { buildRoster } from '../../data/roster.js';
import { creatureToFighter } from './combatBridge.js';

// Archetype card pools keyed by class name (bundled JSON), for the generator.
const CARD_FILES = import.meta.glob('../../data/cards/*.json', { eager: true });
const POOLS = Object.fromEntries(
  Object.values(CARD_FILES).map((m) => { const f = m.default ?? m; return [f.class, f.cards || []]; }),
);
// The generated roster of enemies (rebuilt once; same creatures as the player roster).
const ENEMY_ROSTER = buildRoster(POOLS, POOLS.Warrior || []);

let _foeSeq = 0; // monotonic so two encounters in a run never share a fighter/card id

/** Gentle HP ramp by floor depth (each floor ≈ +4%), on top of the per-tier multiplier. */
const floorMult = (floor = 0) => 1 + Math.max(0, floor) * 0.04;

/** Convert a generated roster creature into a fresh, uniquely-identified enemy Fighter. */
function rosterFighter(creature, hpMult) {
  const tag = `foe${++_foeSeq}`;
  const maxHp = Math.max(1, Math.round(creature.maxHp * hpMult));
  const f = creatureToFighter(creature, { id: `${tag}-${creature.id}`, hp: maxHp, maxHp });
  // Re-id the deck card instances so they can't collide with the player's copies.
  f.deck.drawPile = f.deck.drawPile.map((c) => ({ ...c, id: `${tag}:${c.id}` }));
  return f;
}

/** Pick `n` DISTINCT roster creatures (falls back to repeats if the roster is small). */
function pickDistinct(n, rng) {
  const pool = [...ENEMY_ROSTER];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!pool.length) { out.push(rng ? rng.pick(ENEMY_ROSTER) : ENEMY_ROSTER[0]); continue; }
    const idx = rng ? Math.floor((rng.next ? rng.next() : 0) * pool.length) : 0;
    out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return out;
}

/**
 * @param {{ type: string, floor?: number }} node
 * @param {{ pick:(a:any[])=>any, next?:()=>number }} [rng] seeded run RNG
 * @returns {import('../types.js').Fighter[]}  index 0 is the starting vanguard.
 */
export function enemyForNode(node, rng) {
  const floor = node.floor ?? 0;
  const fm = floorMult(floor);

  if (node.type === 'boss') {
    // A strong leader + one lieutenant on the bench.
    const [leader, aide] = pickDistinct(2, rng);
    return [rosterFighter(leader, 2.4 * fm), rosterFighter(aide, 1.2 * fm)];
  }
  if (node.type === 'elite') {
    // A beefy pair.
    const [a, b] = pickDistinct(2, rng);
    return [rosterFighter(a, 1.6 * fm), rosterFighter(b, 1.4 * fm)];
  }
  // Normal combat: a single foe early; a chance of a second on deeper floors.
  const pair = floor >= 5 && rng && rng.next && rng.next() < 0.45;
  if (pair) {
    const [a, b] = pickDistinct(2, rng);
    return [rosterFighter(a, fm), rosterFighter(b, 0.85 * fm)];
  }
  const pick = rng ? rng.pick(ENEMY_ROSTER) : ENEMY_ROSTER[0];
  return [rosterFighter(pick, fm)];
}
