// Smoke test for the combat-v2 seven-stat model + pure formulas. Run: test:battle
import {
  battleStats, landChance, rollHit, attackDamage, debuffMagnitude, buffMagnitude, blockGain,
  BASE, BASE_ACCURACY,
} from './stats.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

console.log('Stat derivation from KIT + FACTOR (raw, base 50):');
{ const n = battleStats({});
  ok(n.stats.attack === 50 && n.stats.defense === 50 && n.stats.focus === 50 && n.stats.resolve === 50,
    `no kit → neutral 50/50/50/50 (${n.stats.attack}/${n.stats.defense}/${n.stats.focus}/${n.stats.resolve})`);
  ok(n.stats.accuracy === 100 && n.stats.evasion === 0 && n.stats.speed === 50,
    `no kit → ACC 100, EVA 0, SPD 50 (${n.stats.accuracy}/${n.stats.evasion}/${n.stats.speed})`); }
{ // KIT drives the shape: an Engineer archetype is a high-Defense, low-Evasion wall
  const eng = battleStats({ class: ['Engineer'] });
  ok(eng.stats.defense > 55, `Engineer kit → high Defense (${eng.stats.defense})`);
  ok(eng.stats.evasion < 1, `Engineer kit → low/zero Evasion (${eng.stats.evasion})`); }
{ // a Draconic family is bulky (big HP mult) and slower than a nimble family
  const drac = battleStats({ family: 'Draconic' });
  const mam = battleStats({ family: 'Mammalian' });
  ok(drac.hpMult > 1.3 && drac.stats.speed < mam.stats.speed,
    `Draconic → bulkier + slower than Mammalian (hp×${drac.hpMult}, spd ${drac.stats.speed} < ${mam.stats.speed})`); }
{ // a Rogue archetype is nimble (high Evasion)
  const rogue = battleStats({ class: ['Rogue'] });
  ok(rogue.stats.evasion > 5, `Rogue kit → nimble (EVA ${rogue.stats.evasion})`); }
{ // FACTOR nudges: a Shield weapon raises Defense over the same kit without it
  const bare = battleStats({ class: ['Warrior'] });
  const shielded = battleStats({ class: ['Warrior'], weapons: ['Shield'] });
  ok(shielded.stats.defense > bare.stats.defense,
    `Shield factor nudges Defense up (${bare.stats.defense} → ${shielded.stats.defense})`); }
{ // body type + subtype contribute NO stats now — only kit + factor
  const bodyOnly = battleStats({ biology: ['Beast'], subtypes: ['Giant'] });
  ok(bodyOnly.stats.attack === 50 && bodyOnly.hpMult === 1,
    `body type + subtype alone → neutral stats (ATK ${bodyOnly.stats.attack}, hp×${bodyOnly.hpMult})`); }

console.log('Damage (damped Attack÷Defense ratio, parity = face value):');
ok(attackDamage(10, BASE, BASE) === 10, `parity 50v50 → face value (${attackDamage(10, BASE, BASE)})`);
ok(attackDamage(10, 100, 50) === 14, `2× Attack → ~+41% damped (${attackDamage(10, 100, 50)})`);
ok(attackDamage(10, 50, 100) === 7, `2× Defense → ~−29% damped (${attackDamage(10, 50, 100)})`);
ok(attackDamage(10, BASE, BASE, 1.5) === 15, `matchup ×1.5 applied on top (${attackDamage(10, BASE, BASE, 1.5)})`);
ok(attackDamage(10, 50, 0) >= 10, 'zero Defense does not divide-by-zero');
ok(attackDamage(3, 40, 200) >= 1, `a landed hit always deals ≥1 (${attackDamage(3, 40, 200)})`);
ok(attackDamage(10, 300, 40) <= 30, `runaway Attack is clamped (${attackDamage(10, 300, 40)})`);

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
ok(debuffMagnitude(6, 100, 50) === 8, `high Focus vs low Resolve → bigger, damped (${debuffMagnitude(6, 100, 50)})`);
ok(debuffMagnitude(6, 50, 100) === 4, `high target Resolve → resisted, damped (${debuffMagnitude(6, 50, 100)})`);
ok(buffMagnitude(8, BASE) === 8, `self-buff parity → face value (${buffMagnitude(8, BASE)})`);
ok(buffMagnitude(8, 100) === 11, `high Resolve → better received buff, damped (${buffMagnitude(8, 100)})`);
ok(buffMagnitude(8, BASE, 100) === 11, `ally buff projected by caster Focus, damped (${buffMagnitude(8, BASE, 100)})`);
ok(blockGain(10, BASE) === 10, `Block (temp HP) uses buff scaling (${blockGain(10, BASE)})`);

console.log(`\nbattle/stats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
