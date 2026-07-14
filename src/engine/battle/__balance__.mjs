// FORMATION BALANCE HARNESS — an abstract but faithful sim that isolates the formation ECONOMY
// (size-scaled energy + Support→Vanguard auras + front-only protection + auto-promote) from deck
// RNG, so we can tune the wide-vs-tall tradeoff. Run: npm run balance:formations
//
// Model per round: startRound (auras + energy); then in Speed order each squad's CASTER (its live
// front) spends energy on Strikes (10 base dmg, scaled by attack÷defense) aimed at the enemy's
// first live front — so Support in the back row is untargetable and a squad only falls when ALL
// its members die. A front below 40% HP spends 1 energy on Block instead. Both sides identical
// creatures, so any win-rate skew is PURELY the formation choice.
import { buildState, makeUnit, liveFrontUnit, liveUnits, isAlive } from './state.js';
import { startRound } from './battle.js';
import { attackDamage } from './stats.js';

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const STATS = { attack: 50, defense: 50, focus: 50, resolve: 50, evasion: 0, accuracy: 100, speed: 50 };
const HP = 42, STRIKE = 10, BLOCK = 9, LOW = 0.4;

let U = 0;
const unit = () => makeUnit({ id: `u${U++}`, stats: { ...STATS }, maxHp: HP });
// formation builders for 6 identical creatures
const WIDE = () => Array.from({ length: 6 }, (_, i) => ({ id: `sq${i}`, members: [unit()] }));
const TALL = () => [{ id: 'A', members: [unit(), unit(), unit()] }, { id: 'B', members: [unit(), unit(), unit()] }];
const DUOS = () => [0, 1, 2].map((i) => ({ id: `d${i}`, members: [unit(), unit()] }));

function firstEnemyFront(state, side) {
  const enemy = side === 'p' ? 'e' : 'p';
  for (const sqId of state.sides[enemy]) { const f = liveFrontUnit(state, state.squadsById[sqId]); if (f) return f; }
  return null;
}
function applyDamage(u, dmg) {
  const soak = Math.min(u.block || 0, dmg); u.block -= soak; u.hp -= (dmg - soak);
}

const nsIds = (spec, side) => spec.map((sq) => ({ ...sq, id: `${side}_${sq.id}` }));   // unique squad ids per side
function simulate(pSpec, eSpec, seed) {
  U = 0;
  const state = buildState({ p: nsIds(pSpec, 'p'), e: nsIds(eSpec, 'e') });
  const rng = mulberry32(seed);
  for (let round = 0; round < 60; round++) {
    startRound(state);
    // gather each squad's caster action budget; resolve in Speed order (ties → seeded)
    const actors = [];
    for (const side of ['p', 'e']) for (const sqId of state.sides[side]) {
      const sq = state.squadsById[sqId]; const front = liveFrontUnit(state, sq);
      if (front) actors.push({ side, sq, front, energy: sq.energy });
    }
    // seeded Fisher-Yates, THEN a stable sort by Speed (ties keep the uniform-random order —
    // a `rng()-0.5` comparator is a biased shuffle that hands the first-listed side the edge).
    for (let i = actors.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [actors[i], actors[j]] = [actors[j], actors[i]]; }
    actors.sort((a, b) => b.front.stats.speed - a.front.stats.speed);
    for (const a of actors) {
      if (!isAlive(a.front)) continue;
      let e = a.energy;
      // spend 1 on Block if hurt, rest on Strikes at the enemy's first live front
      if (a.front.hp < a.front.maxHp * LOW && e > 0) { a.front.block = (a.front.block || 0) + BLOCK; e -= 1; }
      while (e > 0) {
        const tgt = firstEnemyFront(state, a.side); if (!tgt) break;
        applyDamage(tgt, attackDamage(STRIKE, a.front.stats.attack, tgt.stats.defense));
        e -= 1;
      }
    }
    const p = liveUnits(state, 'p').length, en = liveUnits(state, 'e').length;
    if (!p || !en) return { winner: !p && !en ? 'draw' : (p ? 'p' : 'e'), rounds: round + 1 };
  }
  return { winner: 'draw', rounds: 60 };
}

function matchup(name, pSpec, eSpec, n = 400) {
  let pw = 0, ew = 0, dr = 0, rounds = 0;
  for (let i = 0; i < n; i++) { const r = simulate(pSpec(), eSpec(), 1000 + i * 7); rounds += r.rounds; if (r.winner === 'p') pw++; else if (r.winner === 'e') ew++; else dr++; }
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  console.log(`  ${name.padEnd(26)}  P ${pct(pw)} · E ${pct(ew)} · draw ${pct(dr)}   avg ${(rounds / n).toFixed(1)} rounds`);
  return pw / n;
}

console.log('FORMATION BALANCE (identical 6 creatures; P vs E):');
matchup('WIDE vs WIDE (mirror)', WIDE, WIDE);
matchup('TALL vs TALL (mirror)', TALL, TALL);
const wt = matchup('WIDE vs TALL', WIDE, TALL);
matchup('TALL vs WIDE', TALL, WIDE);
matchup('DUOS vs WIDE', DUOS, WIDE);
matchup('DUOS vs TALL', DUOS, TALL);
console.log('\nRead: mirrors should be ~50%. WIDE-vs-TALL should be COMPETITIVE (roughly 35–65%),');
console.log('so the formation is a real choice, not a dominant strategy. Tune energy curve + auras to taste.');
process.exit(0);
