// Smoke test for biology profiles + the creature generator. Run: test:generate
import { biologyStats } from './biology.js';
import { makeCreature } from './generate.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

console.log('Biology stat profiles:');
{ const giant = biologyStats(['Giant']);
  ok(giant.hpMult === 1.6 && giant.stats.guard > 1 && giant.stats.speed === -1, `Giant: bulky/slow (hp×${giant.hpMult}, spd ${giant.stats.speed})`); }
{ const mech = biologyStats(['Mechanical']);
  ok(mech.stats.guard === 1.4, `Mechanical: high Guard (${mech.stats.guard})`); }
{ const dual = biologyStats(['Giant', 'Beast']);
  ok(dual.hpMult === 1.25 && dual.stats.might > 1, `dual averages (hp×${dual.hpMult}, might ${dual.stats.might})`); }
{ const none = biologyStats([]);
  ok(none.hpMult === 1 && none.stats.might === 1, 'no biology → neutral'); }

console.log('Body-type + subtype/family composition (§9 model):');
{ const g = biologyStats(['Humanoid'], ['Giant']);
  ok(g.hpMult === 1.6 && g.stats.might === 1.2 && g.stats.speed === 0,
    `Giant Humanoid: hp×${g.hpMult}, might ${g.stats.might}, spd ${g.stats.speed} (1 body +1, Giant −1)`); }
{ const m = biologyStats(['Humanoid'], ['Mechanical']);
  ok(m.stats.guard === 1.4 && m.hpMult === 1.1, `Mechanical Humanoid: guard ${m.stats.guard}, hp×${m.hpMult}`); }
{ const stack = biologyStats(['Beast'], ['Giant', 'Mechanical']);
  ok(stack.hpMult > 1.5 && stack.stats.guard > 1.3, `subtypes STACK (hp×${stack.hpMult}, guard ${stack.stats.guard})`); }
{ const drac = biologyStats(['Beast'], [], 'Draconic');
  ok(drac.hpMult === 1.31 && drac.stats.guard > 1 && drac.stats.speed === 0,
    `Draconic beast carries the dragon bulk (hp×${drac.hpMult}, spd ${drac.stats.speed})`); }
{ // the Giant subtype gates size to Large+ in the generator
  const c = makeCreature({ name: 'Titan', class: 'Warrior', biology: ['Humanoid'], attunement: ['Physical'], subtypes: ['Giant'], pool: [], baseHp: 60 });
  ok(c.size === 'large' && c.meta.form === 'large', `Giant gates size → ${c.size}`);
  const c2 = makeCreature({ name: 'Boss Titan', class: 'Warrior', biology: ['Humanoid'], attunement: ['Physical'], subtypes: ['Giant'], size: 'boss', pool: [], baseHp: 60 });
  ok(c2.size === 'boss', 'Giant does not shrink an already-bigger size'); }

console.log('Generator (triple + pool → creature):');
const pool = [
  { id: 'strike', name: 'Strike', attunement: 'Physical', type: 'attack', cost: 1, rarity: 'basic', effects: [{ op: 'damage', value: 6 }] },
  { id: 'guard', name: 'Guard', attunement: 'Physical', type: 'skill', cost: 1, rarity: 'basic', effects: [{ op: 'block', value: 5 }] },
  { id: 'cleave', name: 'Cleave', attunement: 'Physical', type: 'attack', cost: 1, rarity: 'common', effects: [{ op: 'damage', value: 8 }] },
];
{ const c = makeCreature({ name: 'Emberfang', class: 'Mage', biology: ['Dragonkin'], attunement: ['Fire'], pool, baseHp: 55 });
  ok(c.maxHp === Math.round(55 * 1.3), `Dragonkin HP scaled (${c.maxHp})`);
  ok(c.class[0] === 'Mage' && c.attunement[0] === 'Fire', 'axes set');
  // Recipe: 3 Strike + 3 Defend + 1–3 archetype starters (here the pool has 1 common → 7).
  ok(c.deck.length >= 6 && c.deck.length <= 10, `starter deck built (${c.deck.length} cards)`);
  ok(c.deck.every((card) => card.id.includes('#')), 'deck copies have unique instance ids');
  // ~75% of cards re-skinned to Fire (a few keep Physical).
  const fire = c.deck.filter((card) => card.attunement === 'Fire').length;
  ok(fire >= 1, `cards re-skinned to Fire (${fire}/${c.deck.length})`); }

console.log(`\ngenerate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
