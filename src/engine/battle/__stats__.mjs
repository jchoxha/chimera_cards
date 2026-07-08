// Smoke test for the combat-v2 seven-stat model + pure formulas. Run: test:battle
import {
  battleStats, landChance, rollHit, attackDamage, debuffMagnitude, buffMagnitude, blockGain,
  BASE, BASE_ACCURACY,
} from './stats.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

console.log('Stat derivation (raw, base 50):');
{ const n = battleStats([]);
  ok(n.stats.attack === 50 && n.stats.defense === 50 && n.stats.focus === 50 && n.stats.resolve === 50,
    `neutral → 50/50/50/50 (${n.stats.attack}/${n.stats.defense}/${n.stats.focus}/${n.stats.resolve})`);
  ok(n.stats.accuracy === 100 && n.stats.evasion === 0 && n.stats.speed === 50,
    `neutral → ACC 100, EVA 0, SPD 50 (${n.stats.accuracy}/${n.stats.evasion}/${n.stats.speed})`); }
{ const mech = battleStats(['Humanoid'], ['Mechanical']);
  ok(mech.stats.defense > 50, `Mechanical → high Defense (${mech.stats.defense})`);
  ok(mech.stats.evasion < 1, `Mechanical → low/zero Evasion (${mech.stats.evasion})`); }
{ const giant = battleStats(['Beast'], ['Giant']);
  const plain = battleStats(['Beast']);
  ok(giant.hpMult > 1.3 && giant.stats.speed < plain.stats.speed,
    `Giant → bulkier + slower than a plain Beast (hp×${giant.hpMult}, spd ${giant.stats.speed} < ${plain.stats.speed})`);
  ok(giant.stats.evasion === 0, `Giant → floored Evasion (${giant.stats.evasion})`); }
{ const feral = battleStats(['Beast'], ['Feral']);
  ok(feral.stats.evasion > 5, `Feral Beast → nimble (EVA ${feral.stats.evasion})`); }

console.log('Damage (Pokémon Attack÷Defense ratio):');
ok(attackDamage(10, BASE, BASE) === 10, `parity 50v50 → face value (${attackDamage(10, BASE, BASE)})`);
ok(attackDamage(10, 100, 50) === 20, `2× Attack → double (${attackDamage(10, 100, 50)})`);
ok(attackDamage(10, 50, 100) === 5, `2× Defense → half (${attackDamage(10, 50, 100)})`);
ok(attackDamage(10, BASE, BASE, 1.5) === 15, `matchup ×1.5 applied (${attackDamage(10, BASE, BASE, 1.5)})`);
ok(attackDamage(10, 50, 0) >= 10, 'zero Defense does not divide-by-zero');

console.log('Hit chance (floor 0, guaranteed miss possible):');
ok(landChance(100, 0) === 100, 'ACC100 EVA0 → 100%');
ok(landChance(100, 30) === 70, 'ACC100 EVA30 → 70%');
ok(landChance(100, 120) === 0, 'EVA ≥ ACC → 0% (guaranteed miss)');
ok(rollHit(0, () => 0) === false, 'a 0% chance always misses (non-lock-on)');
ok(rollHit(100, () => 0.999) === true, 'a 100% chance always hits');
{ // seeded determinism: same rng sequence → same outcome
  const seq = [0.1, 0.9]; let i = 0; const rng = () => seq[i++ % seq.length];
  ok(rollHit(50, rng) === true && rollHit(50, rng) === false, 'seeded rng → deterministic hit/miss');
}

console.log('Status magnitude (ratios):');
ok(debuffMagnitude(6, BASE, BASE) === 6, `debuff parity → face value (${debuffMagnitude(6, BASE, BASE)})`);
ok(debuffMagnitude(6, 100, 50) === 12, `high Focus vs low Resolve → bigger (${debuffMagnitude(6, 100, 50)})`);
ok(debuffMagnitude(6, 50, 100) === 3, `high target Resolve → resisted (${debuffMagnitude(6, 50, 100)})`);
ok(buffMagnitude(8, BASE) === 8, `self-buff parity → face value (${buffMagnitude(8, BASE)})`);
ok(buffMagnitude(8, 100) === 16, `high Resolve → better received buff (${buffMagnitude(8, 100)})`);
ok(buffMagnitude(8, BASE, 100) === 16, `ally buff projected by caster Focus (${buffMagnitude(8, BASE, 100)})`);
ok(blockGain(10, BASE) === 10, `Block (temp HP) uses buff scaling (${blockGain(10, BASE)})`);

console.log(`\nbattle/stats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
