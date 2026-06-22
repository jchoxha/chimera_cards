// Integration test for the attunement signature statuses made live (§5):
// bleed, decay, expose, amplify, soak, shock, confuse. Run: node src/engine/combat/__statuses__.mjs
// (also: npm run test:statuses)

import { VanguardManager } from './VanguardManager.js';
import { createFighter } from './state.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

function setup({ rng } = {}) {
  const player = createFighter({ id: 'p', name: 'P', types: [{ type: 'Physical', weight: 1 }], hp: 60, maxHp: 60, stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 } });
  player.attunement = ['Physical'];
  const foe = createFighter({ id: 'f', name: 'F', hp: 100, maxHp: 100 });
  const args = { playerFighters: [player], enemyFighters: [foe], room: 'combat', rarity: { offset: -0.05, ascension7: false } };
  if (rng) args.rng = rng;
  const m = new VanguardManager(args);
  m.startCombat();
  const p = m.state.player.fighters[m.state.player.vanguardIndex];
  m.state.player.energy = 10;
  return { m, p, foe };
}
const strike = (extra = {}) => ({ id: 's', name: 'Strike', attunement: 'Physical', type: 'attack', cost: 1, effects: [{ op: 'damage', value: 6, ...extra }] });
const addSt = (f, id, amount) => f.statuses.push({ id, amount, stacking: 'intensity' });
const amt = (f, id) => f.statuses.find((s) => s.id === id)?.amount ?? 0;

console.log('Expose (Air): next hit ignores all Block:');
{ const { m, p, foe } = setup(); foe.block = 10; addSt(foe, 'expose', 1); p.hand = [strike()]; const b = foe.hp; m.play('s');
  ok(foe.hp === b - 6 && foe.block === 10, `6 to HP straight through 10 Block (hp ${foe.hp}, block ${foe.block})`);
  ok(amt(foe, 'expose') === 0, 'Expose consumed'); }

console.log('Soak (Water): next attack +25% per stack, then clears:');
{ const { m, p, foe } = setup(); addSt(foe, 'soak', 2); p.hand = [strike()]; const b = foe.hp; m.play('s');
  ok(foe.hp === b - 9, `Soak x2 → 6 becomes 9 (hp ${foe.hp})`);
  ok(amt(foe, 'soak') === 0, 'Soak cleared'); }

console.log('Amplify (Arcane, self): next attack +50%, then clears:');
{ const { m, p, foe } = setup(); addSt(p, 'amplify', 1); p.hand = [strike()]; const b = foe.hp; m.play('s');
  ok(foe.hp === b - 9, `Amplify → 6 becomes 9 (hp ${foe.hp})`);
  ok(amt(p, 'amplify') === 0, 'Amplify cleared'); }

console.log('Bleed (Physical): grows +1 per hit, ticks at opponent turn-end:');
{ const { m, p, foe } = setup(); addSt(foe, 'bleed', 2); p.hand = [strike({ hits: 2 })]; m.play('s');
  ok(amt(foe, 'bleed') === 4, `grew +1/hit (2 → ${amt(foe, 'bleed')} after 2 hits)`);
  const b = foe.hp; m.endTurn();
  ok(foe.hp === b - 4, `ticked 4 at opponent turn-end (hp ${foe.hp})`);
  ok(amt(foe, 'bleed') === 3, 'decayed 1 after the tick'); }

console.log('Decay (Void): loses HP AND Block on the DoT tick:');
{ const { m, foe } = setup(); foe.block = 5; addSt(foe, 'decay', 3); const b = foe.hp;
  m._tickStatuses('enemy', 'dots'); // isolate the tick (full endTurn would also block-decay)
  ok(foe.hp === b - 3 && foe.block === 2, `-3 HP and -3 Block (hp ${foe.hp}, block ${foe.block})`);
  ok(amt(foe, 'decay') === 2, 'decayed 1'); }

console.log('Shock (Energy): drains energy at turn start:');
{ const { m, p } = setup(); m.state.player.energy = 5; addSt(p, 'shock', 3); m._applyShock('player');
  ok(m.state.player.energy === 2, `drained 3 energy (5 → ${m.state.player.energy})`);
  ok(amt(p, 'shock') === 0, 'Shock cleared'); }

console.log('Confuse (Mind): fizzle vs normal, driven by rng:');
{ const { m, p, foe } = setup({ rng: () => 0 }); addSt(p, 'confuse', 1); p.hand = [strike()]; const b = foe.hp; m.play('s');
  ok(foe.hp === b, `fizzle (rng 0 < .34): no damage (hp ${foe.hp})`);
  ok(amt(p, 'confuse') === 0, 'Confuse consumed'); }
{ const { m, p, foe } = setup({ rng: () => 0.9 }); addSt(p, 'confuse', 1); p.hand = [strike()]; const b = foe.hp; m.play('s');
  ok(foe.hp === b - 6, `no fizzle/retarget (rng .9): normal 6 (hp ${foe.hp})`); }

console.log(`\nstatuses: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
