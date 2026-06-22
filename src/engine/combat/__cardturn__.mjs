// Integration smoke test: data-driven CardSpec cards (warrior.json) played through
// the full VanguardManager turn engine. Run: node src/engine/combat/__cardturn__.mjs
// (also: npm run test:cardturn)
//
// Proves the editor's cards actually run in combat: the interpreter path in play(),
// stat scaling, stances, and power triggers firing in the turn loop.

import { readFileSync } from 'fs';
import { VanguardManager } from './VanguardManager.js';
import { createFighter } from './state.js';

const WARRIOR = JSON.parse(readFileSync(new URL('../../data/cards/warrior.json', import.meta.url)));
const byId = Object.fromEntries(WARRIOR.cards.map((c) => [c.id, c]));
const card = (id) => JSON.parse(JSON.stringify(byId[id]));

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

function setup() {
  const warrior = createFighter({
    id: 'war', name: 'Warrior', types: [{ type: 'Physical', weight: 1 }], hp: 60, maxHp: 60,
    stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 },
  });
  // Stock the draw pile so the opening hand can be drawn without errors.
  warrior.deck.drawPile = ['warrior_strike', 'warrior_guard', 'warrior_cleave', 'warrior_shield_wall',
    'warrior_pommel_strike', 'warrior_war_cry'].map(card);
  const foe = createFighter({ id: 'foe', name: 'Foe', hp: 100, maxHp: 100 });

  const vm = new VanguardManager({ playerFighters: [warrior], enemyFighters: [foe], room: 'combat', rarity: { offset: -0.05, ascension7: false } });
  vm.startCombat();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  // Force a known hand + energy for a deterministic test.
  p.hand = ['warrior_strike', 'warrior_berserk', 'warrior_bloodlust', 'warrior_strike'].map(card);
  vm.state.player.energy = 10;
  return { vm, p, foe };
}

console.log('Data-driven cards resolve through VanguardManager.play:');
{
  const { vm, foe } = setup();
  vm.play('warrior_strike');                  // Balanced, Might 1 → 6 dmg
  ok(foe.hp === 94, `Strike via engine → 6 dmg (foe ${foe.hp})`);
}

console.log('Stance card sets state; subsequent attack scales (Rampage 2×):');
{
  const { vm, p, foe } = setup();
  vm.play('warrior_berserk');                 // snap to Rampage
  ok(p.stance === 'Rampage', `Berserk set stance Rampage (${p.stance})`);
  vm.play('warrior_strike');                  // 6 × 2 = 12
  ok(foe.hp === 88, `Strike in Rampage → 12 dmg (foe ${foe.hp})`);
}

console.log('Power registers + exhausts; turnStart trigger fires next turn:');
{
  const { vm, p } = setup();
  vm.play('warrior_bloodlust');               // power → registered + exhausted
  ok(p.powers.length === 1 && p.deck.exhaustPile.some((c) => c.id === 'warrior_bloodlust'),
    'Bloodlust registered as a power and exhausted from hand');
  const strBefore = p.statuses.find((s) => s.id === 'strength')?.amount ?? 0;
  vm.endTurn();                               // → enemy turn → next round → player turnStart fires Bloodlust
  const strAfter = p.statuses.find((s) => s.id === 'strength')?.amount ?? 0;
  ok(strAfter === strBefore + 1, `Bloodlust turnStart trigger fired across the turn cycle (+1 Strength: ${strBefore}→${strAfter})`);
  ok(vm.state.player.fighters[0].hp > 0, 'player survived the cycle (idle enemy)');
}

console.log('Illegal stance play is rejected without cost:');
{
  const { vm, p } = setup();
  p.stance = 'Full Guard';                    // defense extreme — can't Attack
  const energyBefore = vm.state.player.energy;
  const r = vm.play('warrior_strike');
  ok(r === false && vm.state.player.energy === energyBefore, 'Strike rejected in Full Guard, energy unspent');
}

console.log(`\ncardturn: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
