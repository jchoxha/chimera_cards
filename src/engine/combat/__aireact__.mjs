// Smoke test: the enemy AI planner SEEKS reactions (docs/mechanics.md §2 AI plan).
// Run: node src/engine/combat/__aireact__.mjs  (npm run test:aireact)
//
// Proves _generateEnemyPlan (1) prefers a reacting element over a higher raw-damage
// attack when a primer is present, and (2) sets up its OWN primer with a debuff so a
// follow-up attack detonates it in the same planned turn.

import { VanguardManager } from './VanguardManager.js';
import { createFighter } from './state.js';
import { addStatus, stackingFor } from './resolve.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const atkCard = (id, name, att, dmg) => ({
  id, name, type: 'attack', cost: 1, attunement: att,
  effects: [{ op: 'damage', value: dmg, scope: 'enemyActiveTarget' }],
});
const debuffCard = (id, name, status, value) => ({
  id, name, type: 'skill', cost: 1, attunement: 'Physical',
  effects: [{ op: 'debuff', status, value, scope: 'enemyActiveTarget' }],
});

function build(enemyHand, primeStatus) {
  const hero = createFighter({ id: 'hero', name: 'Hero', types: [{ type: 'Physical', weight: 1 }], hp: 60, maxHp: 60 });
  const foe = createFighter({ id: 'foe', name: 'Foe', types: [{ type: 'Physical', weight: 1 }], hp: 60, maxHp: 60 });
  const vm = new VanguardManager({ playerFighters: [hero], enemyFighters: [foe], room: 'combat', rarity: { offset: 0, ascension7: false } });
  vm.startCombat();
  if (primeStatus) addStatus(hero.statuses, { id: primeStatus.id, amount: primeStatus.amount, stacking: stackingFor(primeStatus.id) });
  // Force a known enemy hand, then re-plan.
  vm.state.enemy.fighters[vm.state.enemy.vanguardIndex].hand = enemyHand.map((c) => ({ ...c }));
  vm._generateEnemyPlan();
  return vm.state.enemyPlan.filter((a) => a.silhouette === 'attack' || a.detail?.cardId);
}

console.log('Prefers a reacting element over higher raw damage:');
{
  // Physical Strike (7) vs Fire Bolt (6); player carries Poison 5 → Fire Combust detonates for +10.
  const plan = build([atkCard('pstrike', 'Strike', 'Physical', 7), atkCard('fbolt', 'Fire Bolt', 'Fire', 6)],
    { id: 'poison', amount: 5 });
  ok(plan[0]?.detail?.cardId === 'fbolt', `picks Fire Bolt to detonate Poison (got ${plan[0]?.detail?.cardId})`);
}

console.log('Without a primer, falls back to the bigger raw attack:');
{
  const plan = build([atkCard('pstrike', 'Strike', 'Physical', 7), atkCard('fbolt', 'Fire Bolt', 'Fire', 6)], null);
  ok(plan[0]?.detail?.cardId === 'pstrike', `no reaction → picks the 7-dmg Strike (got ${plan[0]?.detail?.cardId})`);
}

console.log('Sets up its own primer, then detonates it the same turn:');
{
  // Poison Dart (applies Poison 4) + Fire Bolt; player is clean. AI should prime then combust.
  const plan = build([debuffCard('pdart', 'Poison Dart', 'poison', 4), atkCard('fbolt', 'Fire Bolt', 'Fire', 6)], null);
  const ids = plan.map((a) => a.detail?.cardId);
  ok(ids[0] === 'pdart', `plays the primer first (got ${ids[0]})`);
  ok(ids.includes('fbolt'), `follows with the Fire detonator (plan: ${ids.join(', ')})`);
}

console.log(`\naireact: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
