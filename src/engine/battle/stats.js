// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/battle/stats — the COMBAT-V2 seven-stat model + the pure   ║
// ║ combat formulas (docs/combat-v2-spec.md §2). The stat SHAPE now composes   ║
// ║ from a creature's KIT + FACTOR (content/statProfile.js) — body type and    ║
// ║ subtype contribute no stats (locked 2026-07-15). `battleStats(creature)`   ║
// ║ maps that shape to the raw seven-stat combat numbers.                      ║
// ║                                                                            ║
// ║ Stats are RAW Pokémon-style numbers centered on a neutral creature =       ║
// ║ Attack/Defense/Focus/Resolve 50, Accuracy 100, Evasion 0, Speed 50, so at  ║
// ║ parity (50 vs 50) a card deals its FACE value. Damage/effect magnitude use ║
// ║ RATIOS (Attack÷Defense, Focus÷Resolve), so the base 50 cancels at parity   ║
// ║ and only RELATIVE stats matter. Pure + node-testable. Numbers tunable.     ║
// ║ UPDATE WHEN: the v2 stat model or its formulas change.                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import { creatureStatProfile } from '../content/statProfile.js';

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

const round = (n) => Math.round(n);

/**
 * The combat-v2 stat line for a creature. Composes the might/guard/focus/resolve/
 * speed/eva SHAPE from its KIT + FACTOR (content/statProfile.js), then maps to raw
 * seven-stat numbers.
 *   attack  ← might factor · defense ← guard factor · focus/resolve ← same
 *   speed   ← base + speedFactor tempo · accuracy ← 100 · evasion ← eva overlay
 * @param {{ class?, family?, manifestation?, weapons?, anatomy?, features? }} creature
 * @returns {{ hpMult:number, stats:{attack,defense,focus,resolve,evasion,accuracy,speed} }}
 */
export function battleStats(creature) {
  const { hpMult, stats } = creatureStatProfile(creature);   // kit + factor composition
  return {
    hpMult,
    stats: {
      attack: round(BASE * stats.might),
      defense: round(BASE * stats.guard),
      focus: round(BASE * stats.focus),
      resolve: round(BASE * stats.resolve),
      // speed is a small flat tempo (−1..+1 before size); widen it into a raw order stat.
      speed: round(BASE + (stats.speed || 0) * 8),
      accuracy: BASE_ACCURACY,
      evasion: Math.max(0, Math.min(MAX_EVASION, BASE_EVASION + (stats.eva || 0))),
    },
  };
}

// ── Pure combat formulas (see §2). All clamp to sane bounds. ──

/** DAMPED stat ratio (the heart of the magnitude model). A raw Attack÷Defense ratio is
 *  Pokémon-literal but too swingy for a card game: a 2× defender crushes an 8 to ~1, a
 *  buffed attacker explodes. We keep the Pokémon SPIRIT — higher Attack vs lower Defense
 *  = more damage, parity (a==b) = exactly 1 (so a card's authored "Deal 8" lands as 8) —
 *  but soften it with a sub-linear exponent and clamp the extremes. So a 2× stat edge is
 *  ~+41% (not +100%), a 2× wall is ~−29% (not −50%), and nothing crushes to 0 or runs away. */
const RATIO_EXP = 0.5;                 // sub-linear damping (0=flat, 1=raw Pokémon linear)
const RATIO_MIN = 0.25, RATIO_MAX = 3; // hard bounds on the multiplier
export function statRatio(a = BASE, b = BASE, exp = RATIO_EXP) {
  const num = a > 0 ? a : 1, den = b > 0 ? b : 1;
  return Math.max(RATIO_MIN, Math.min(RATIO_MAX, Math.pow(num / den, exp)));
}

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

/** Damage. `baseDamage` is the card's authored, LEGIBLE number — realized 1:1 at neutral
 *  stats (Attack 50 vs Defense 50) — scaled by the DAMPED Attack÷Defense ratio × matchup.
 *  A landed hit always deals ≥ 1 (chip damage never stalls the fight). */
export function attackDamage(baseDamage, attackerAttack = BASE, targetDefense = BASE, matchup = 1, mult = 1) {
  const dmg = round(baseDamage * statRatio(attackerAttack, targetDefense) * matchup * mult);
  return baseDamage > 0 ? Math.max(1, dmg) : Math.max(0, dmg);
}

/** The owner-adjusted number to SHOW on a card face (StS-style, like Strength): the card's
 *  base damage vs a NEUTRAL defender (Defense 50). Real defense/matchup apply at hit. */
export function displayedDamage(baseDamage, attackerAttack = BASE) {
  return Math.max(0, round(baseDamage * statRatio(attackerAttack, BASE)));
}

/** Debuff magnitude: base × damped (caster Focus ÷ target Resolve). */
export function debuffMagnitude(base, casterFocus = BASE, targetResolve = BASE) {
  return Math.max(0, round(base * statRatio(casterFocus, targetResolve)));
}

/** Buff magnitude: base × damped(recipient Resolve ÷ BASE), × damped(caster Focus ÷ BASE)
 *  when cast on another creature. */
export function buffMagnitude(base, recipientResolve = BASE, casterFocus = null) {
  const recv = statRatio(recipientResolve, BASE);
  const proj = casterFocus == null ? 1 : statRatio(casterFocus, BASE);
  return Math.max(0, round(base * recv * proj));
}

/** Block is a buff → temporary HP. Same scaling as any buff. */
export const blockGain = buffMagnitude;
