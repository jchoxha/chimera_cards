// Smoke test for the §5.2 reaction engine (engine/cards/reactions.js).
import { fireReactions, REACTIONS, primaryElement } from './reactions.js';
import { createFighter } from '../combat/state.js';
import { addStatus, stackingFor } from '../combat/resolve.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

function setup() {
  const atk = createFighter({ id: 'atk', name: 'Atk', types: [{ type: 'Physical', weight: 1 }], hp: 30, maxHp: 40 });
  const def = createFighter({ id: 'def', name: 'Def', types: [{ type: 'Physical', weight: 1 }], hp: 50, maxHp: 50 });
  const aide = createFighter({ id: 'aide', name: 'Aide', types: [{ type: 'Physical', weight: 1 }], hp: 50, maxHp: 50 });
  const state = { player: { fighters: [atk], vanguardIndex: 0 }, enemy: { fighters: [def, aide], vanguardIndex: 0, fortifySlot: { block: 0 } } };
  return { state, atk, def, aide };
}
const give = (f, id, n) => addStatus(f.statuses, { id, amount: n, stacking: stackingFor(id) });
const amt = (f, id) => f.statuses.find((s) => s.id === id)?.amount ?? 0;

console.log('Reaction table shape:');
ok(REACTIONS.Fire?.burn && REACTIONS.Water?.burn, 'Fire/Water react with Burn');
ok(primaryElement(['Fire', 'Frost']) === 'Fire', 'primaryElement takes the first of a re-skin pair');

console.log('Fire → Flare-up (Burn +2, no consume):');
{ const { state, atk, def } = setup(); give(def, 'burn', 3); fireReactions(state, atk, def, 'Fire'); ok(amt(def, 'burn') === 5, `burn 3 -> 5 (got ${amt(def, 'burn')})`); }

console.log('Water → Quench (consume Burn, apply Weak):');
{ const { state, atk, def } = setup(); give(def, 'burn', 4); fireReactions(state, atk, def, 'Water'); ok(amt(def, 'burn') === 0 && amt(def, 'weak') === 1, `burn 0, weak 1 (got burn ${amt(def, 'burn')}, weak ${amt(def, 'weak')})`); }

console.log('Nature → Fester (Poison doubles):');
{ const { state, atk, def } = setup(); give(def, 'poison', 3); fireReactions(state, atk, def, 'Nature'); ok(amt(def, 'poison') === 6, `poison 3 -> 6 (got ${amt(def, 'poison')})`); }

console.log('Void → Devour Bleed (consume, heal attacker):');
{ const { state, atk, def } = setup(); give(def, 'bleed', 5); const hp0 = atk.hp; fireReactions(state, atk, def, 'Void'); ok(amt(def, 'bleed') === 0, 'bleed consumed'); ok(atk.hp === hp0 + 5, `attacker healed 5 (got ${atk.hp - hp0})`); }

console.log('Physical → Rend (bonus dmg = bleed, +1 bleed):');
{ const { state, atk, def } = setup(); give(def, 'bleed', 4); const hp0 = def.hp; fireReactions(state, atk, def, 'Physical'); ok(def.hp === hp0 - 4, `target took 4 (got ${hp0 - def.hp})`); ok(amt(def, 'bleed') === 5, `bleed 4 -> 5 (got ${amt(def, 'bleed')})`); }

console.log('Holy → Purge-Smite (consume Poison, dmg = value):');
{ const { state, atk, def } = setup(); give(def, 'poison', 6); const hp0 = def.hp; fireReactions(state, atk, def, 'Holy'); ok(amt(def, 'poison') === 0 && def.hp === hp0 - 6, `poison 0 + 6 dmg (got poison ${amt(def, 'poison')}, dmg ${hp0 - def.hp})`); }

console.log('Energy → Electrocute (consume Soak, Shock self + chain to aide):');
{ const { state, atk, def, aide } = setup(); give(def, 'soak', 2); fireReactions(state, atk, def, 'Energy'); ok(amt(def, 'soak') === 0, 'soak consumed'); ok(amt(def, 'shock') >= 1, `target shocked (${amt(def, 'shock')})`); ok(amt(aide, 'shock') >= 1, `aide chained shock (${amt(aide, 'shock')})`); }

console.log('Water → Conduct (Shock spreads to bench):');
{ const { state, atk, def, aide } = setup(); give(def, 'shock', 2); fireReactions(state, atk, def, 'Water'); ok(amt(aide, 'shock') >= 1, `aide got shock (${amt(aide, 'shock')})`); }

console.log('Shadow → Corrupt (Strength -1, +Weak):');
{ const { state, atk, def } = setup(); give(def, 'strength', 3); fireReactions(state, atk, def, 'Shadow'); ok(amt(def, 'strength') === 2 && amt(def, 'weak') === 1, `str 2, weak 1 (got str ${amt(def, 'strength')}, weak ${amt(def, 'weak')})`); }

console.log('No primer → no reaction:');
{ const { state, atk, def } = setup(); const fired = fireReactions(state, atk, def, 'Fire'); ok(fired.length === 0, 'nothing fired on a clean target'); }

console.log('Element with no table → no-op:');
{ const { state, atk, def } = setup(); give(def, 'burn', 2); const fired = fireReactions(state, atk, def, 'Stone'); ok(fired.length === 0 && amt(def, 'burn') === 2, 'Stone has no Burn cell'); }

console.log(`\nreactions: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
