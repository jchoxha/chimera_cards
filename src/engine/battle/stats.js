// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/battle/stats — the COMBAT-V2 seven-stat model + the pure   ║
// ║ combat formulas (docs/combat-v2-spec.md §2). Isolated from the v1 engine: ║
// ║ v1's `content/biology.js biologyStats` (5-stat multiplier line) is left   ║
// ║ untouched; this adds `battleStats()` beside it, reusing the SAME body/     ║
// ║ subtype/family profiles so there is one source of the composition.        ║
// ║                                                                            ║
// ║ Stats are RAW Pokémon-style numbers centered on a neutral creature =       ║
// ║ Attack/Defense/Focus/Resolve 50, Accuracy 100, Evasion 0, Speed 50, so at  ║
// ║ parity (50 vs 50) a card deals its FACE value. Damage/effect magnitude use ║
// ║ RATIOS (Attack÷Defense, Focus÷Resolve), so the base 50 cancels at parity   ║
// ║ and only RELATIVE stats matter. Pure + node-testable. Numbers tunable.     ║
// ║ UPDATE WHEN: the v2 stat model or its formulas change.                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import { biologyStats } from '../content/biology.js';

/** The seven combat-v2 stats, in display order. */
export const BATTLE_STATS = Object.freeze(['attack', 'defense', 'focus', 'resolve', 'evasion', 'accuracy', 'speed']);
export const STAT_LABEL = Object.freeze({
  attack: 'ATK', defense: 'DEF', focus: 'FOC', resolve: 'RSV', evasion: 'EVA', accuracy: 'ACC', speed: 'SPD',
});
export const STAT_NAME = Object.freeze({
  attack: 'Attack', defense: 'Defense', focus: 'Focus', resolve: 'Resolve',
  evasion: 'Evasion', accuracy: 'Accuracy', speed: 'Speed',
});

/** Neutral baselines. Magnitude stats center on BASE (ratios cancel it at parity). */
export const BASE = 50;         // Attack/Defense/Focus/Resolve/Speed neutral
export const BASE_ACCURACY = 100;
export const BASE_EVASION = 0;
const MAX_EVASION = 95;         // even a dodge tank stays hittable by lock-on / accuracy buffs

/** v2-only IDENTITY overlay: Evasion (points subtracted from an attacker's Accuracy).
 *  Not in the shared profiles (which have no evasion), so it lives here. Nimble bodies/
 *  subtypes dodge; bulky/mechanical ones don't. Provisional. */
const BODY_EVASION = Object.freeze({ Humanoid: 0, Beast: 4, Aberration: 2 });
const SUBTYPE_EVASION = Object.freeze({
  Giant: -6, Mechanical: -4, Ancient: -4, Feral: 6, Swarm: 8, Spectral: 8,
});
const round = (n) => Math.round(n);
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

function evasionOverlay(biology, subtypes) {
  const bodies = arr(biology);
  const bodyEva = bodies.length
    ? bodies.reduce((s, b) => s + (BODY_EVASION[b] ?? 0), 0) / bodies.length
    : 0;
  const subEva = arr(subtypes).reduce((s, t) => s + (SUBTYPE_EVASION[t] ?? 0), 0);
  return bodyEva + subEva;
}

/**
 * The combat-v2 stat line for a creature triple. Reuses `biologyStats` for the
 * Body×Subtype×Family composition (its might/guard/focus/resolve/speed factors),
 * then maps to raw seven-stat numbers.
 *   attack  ← might factor · defense ← guard factor · focus/resolve ← same
 *   speed   ← base + speedFactor tempo · accuracy ← 100 · evasion ← identity overlay
 * @returns {{ hpMult:number, stats:{attack,defense,focus,resolve,evasion,accuracy,speed} }}
 */
export function battleStats(biology, subtypes = [], family = null) {
  const { hpMult, stats } = biologyStats(biology, subtypes, family);   // v1 composition (factors)
  return {
    hpMult,
    stats: {
      attack: round(BASE * stats.might),
      defense: round(BASE * stats.guard),
      focus: round(BASE * stats.focus),
      resolve: round(BASE * stats.resolve),
      // biology.js speed is a small flat tempo (−1..+1 before size); widen it into a raw order stat.
      speed: round(BASE + (stats.speed || 0) * 8),
      accuracy: BASE_ACCURACY,
      evasion: Math.max(0, Math.min(MAX_EVASION, BASE_EVASION + evasionOverlay(biology, subtypes))),
    },
  };
}

// ── Pure combat formulas (see §2). All clamp to sane bounds. ──

/** % chance a non-lock-on attack/debuff lands. FLOOR 0 → a guaranteed miss is possible. */
export function landChance(accuracy = BASE_ACCURACY, evasion = BASE_EVASION) {
  return Math.max(0, Math.min(100, accuracy - evasion));
}

/** Roll a hit. `rng()` → [0,1). Pass a seeded rng for deterministic combat/tests. */
export function rollHit(chance, rng = Math.random) {
  if (chance >= 100) return true;
  if (chance <= 0) return false;
  return rng() * 100 < chance;
}

/** Pokémon-style damage: card power scaled by the Attack÷Defense ratio × matchup. */
export function attackDamage(power, attackerAttack = BASE, targetDefense = BASE, matchup = 1, mult = 1) {
  const def = targetDefense > 0 ? targetDefense : 1;
  return Math.max(0, round(power * (attackerAttack / def) * matchup * mult));
}

/** Debuff magnitude: base × (caster Focus ÷ target Resolve). */
export function debuffMagnitude(base, casterFocus = BASE, targetResolve = BASE) {
  const res = targetResolve > 0 ? targetResolve : 1;
  return Math.max(0, round(base * (casterFocus / res)));
}

/** Buff magnitude: base × (recipient Resolve ÷ BASE), × (caster Focus ÷ BASE) when cast on another. */
export function buffMagnitude(base, recipientResolve = BASE, casterFocus = null) {
  const recv = recipientResolve / BASE;
  const proj = casterFocus == null ? 1 : (casterFocus / BASE);
  return Math.max(0, round(base * recv * proj));
}

/** Block is a buff → temporary HP. Same scaling as any buff. */
export const blockGain = buffMagnitude;
