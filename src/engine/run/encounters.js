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
import { POOLS, rosterPool } from '../../app/pools.js';

// The generated roster of enemies (rebuilt once; the SAME biology-aware kit pools
// the player roster uses via app/pools — a beast foe fights with its beast kit).
const ENEMY_ROSTER = buildRoster(POOLS, POOLS.Warrior || [], rosterPool);
const BY_ID = Object.fromEntries(ENEMY_ROSTER.map((c) => [c.id, c]));

// Curated bestiary bands so difficulty + theme don't swing wildly with a random
// full-roster draw. Floor depth selects the normal-fight band; elites/bosses have
// their own dedicated pools. Ids reference data/roster.js. Unknown ids are skipped,
// so the bands degrade gracefully if the roster changes.
const BANDS = {
  // weaker / simpler foes for the opening floors
  early: ['emberwisp', 'nightveil', 'voltfang', 'wildeye'],
  // the bulk of the act
  mid: ['frostmind', 'grimsoul', 'dawnkeeper', 'thornroot', 'tidecaller', 'voltfang', 'wildeye', 'felhound'],
  // tougher foes deep in the act
  late: ['ironhide', 'cogwright', 'maw', 'grimsoul', 'frostmind', 'dawnkeeper', 'emberdrake', 'grizzlord'],
  // dedicated elite threats
  elite: ['ironhide', 'cogwright', 'maw', 'grimsoul', 'emberdrake', 'grizzlord'],
  // act bosses (the big bads)
  boss: ['maw', 'ironhide', 'cogwright'],
};
const bandCreatures = (key) => (BANDS[key] || []).map((id) => BY_ID[id]).filter(Boolean);
const normalBand = (floor) => (floor <= 3 ? 'early' : floor <= 6 ? 'mid' : 'late');

let _foeSeq = 0; // monotonic so two encounters in a run never share a fighter/card id

/** Gentle HP ramp by floor depth (each floor ≈ +3%), on top of the per-tier multiplier. */
const floorMult = (floor = 0) => 1 + Math.max(0, floor) * 0.03;

/** Convert a generated roster creature into a fresh, uniquely-identified enemy Fighter.
 * `form` overrides the displayed SIZE badge (e.g. elite/boss encounters). */
function rosterFighter(creature, hpMult, form) {
  const tag = `foe${++_foeSeq}`;
  const maxHp = Math.max(1, Math.round(creature.maxHp * hpMult));
  const f = creatureToFighter(creature, { id: `${tag}-${creature.id}`, hp: maxHp, maxHp, form });
  // Re-id the deck card instances so they can't collide with the player's copies.
  f.deck.drawPile = f.deck.drawPile.map((c) => ({ ...c, id: `${tag}:${c.id}` }));
  return f;
}

/** Pick `n` DISTINCT creatures from a band (falls back to the full roster / repeats). */
function pickDistinct(n, rng, bandKey) {
  const base = bandCreatures(bandKey);
  const pool = (base.length ? base : ENEMY_ROSTER).slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    const src = pool.length ? pool : ENEMY_ROSTER;
    if (!src.length) break;
    const idx = rng && rng.next ? Math.floor(rng.next() * src.length) : 0;
    const chosen = src[Math.min(idx, src.length - 1)];
    if (pool.length) pool.splice(pool.indexOf(chosen), 1);
    out.push(chosen);
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

  // Per-tier HP multipliers, re-tuned for the kit era via the headless balance
  // harness (the greedy autoplay bot reaches ~floor 5 and wins ~5% — a WEAK lower
  // bound; skilled play does far better). REVIEW: needs a human-play balance pass.
  if (node.type === 'boss') {
    // A strong leader (Boss size) + one lieutenant (Elite) on the bench.
    const [leader, aide] = pickDistinct(2, rng, 'boss');
    return [rosterFighter(leader, 1.8 * fm, 'boss'), rosterFighter(aide, 0.9 * fm, 'elite')];
  }
  if (node.type === 'elite') {
    // A beefy Elite pair.
    const [a, b] = pickDistinct(2, rng, 'elite');
    return [rosterFighter(a, 1.15 * fm, 'elite'), rosterFighter(b, 0.95 * fm, 'elite')];
  }
  // Normal combat: pick from the floor-appropriate band; a single foe early, a
  // chance of a second on deeper floors.
  const band = normalBand(floor);
  const pair = floor >= 5 && rng && rng.next && rng.next() < 0.45;
  if (pair) {
    const [a, b] = pickDistinct(2, rng, band);
    return [rosterFighter(a, 0.78 * fm), rosterFighter(b, 0.62 * fm)];
  }
  const [pick] = pickDistinct(1, rng, band);
  return [rosterFighter(pick, 0.78 * fm)];
}
