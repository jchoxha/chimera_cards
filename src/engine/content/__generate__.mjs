// Smoke test for the kit+factor stat profiles + the creature generator. Run: test:generate
import { statProfile } from './statProfile.js';
import { makeCreature } from './generate.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

console.log('KIT stat profiles (the base shape):');
{ const eng = statProfile({ kits: ['Engineer'] });
  ok(eng.stats.guard > 1.2 && eng.stats.speed < 0, `Engineer: high Guard, slow (guard ${eng.stats.guard}, spd ${eng.stats.speed})`); }
{ const drac = statProfile({ kits: ['Draconic'] });
  ok(drac.hpMult === 1.4 && drac.stats.guard > 1, `Draconic: dragon bulk (hp×${drac.hpMult}, guard ${drac.stats.guard})`); }
{ const hybrid = statProfile({ kits: ['Warrior', 'Mammalian'] });
  ok(hybrid.stats.might > 1 && hybrid.hpMult > 1, `hybrid AVERAGES two kits (might ${hybrid.stats.might}, hp×${hybrid.hpMult})`); }
{ const none = statProfile({});
  ok(none.hpMult === 1 && none.stats.might === 1, 'no kit → neutral'); }

console.log('FACTORS nudge on top of the kit; body/subtype give NO stats:');
{ const bare = statProfile({ kits: ['Warrior'] });
  const shield = statProfile({ kits: ['Warrior'], factors: ['Shield'] });
  ok(shield.stats.guard > bare.stats.guard && shield.hpMult > bare.hpMult, `Shield nudges guard + hp up (guard ${bare.stats.guard}→${shield.stats.guard})`); }
{ const bare = statProfile({ kits: ['Insectoid'] });
  const venom = statProfile({ kits: ['Insectoid'], factors: ['Venom'] });
  ok(venom.stats.focus > bare.stats.focus, `Venom nudges Focus (${bare.stats.focus}→${venom.stats.focus})`); }
{ // body type + subtype are NOT kits/factors → no stat contribution
  const c = makeCreature({ name: 'Titan', biology: ['Beast'], attunement: ['Physical'], subtypes: ['Giant'], pool: [], baseHp: 60 });
  ok(c.stats.might === 1 && c.maxHp === 60, `body type + Giant subtype alone → neutral stats (might ${c.stats.might}, hp ${c.maxHp})`); }
{ // Giant is NOT a size gate — it keeps the requested size
  const baby = makeCreature({ name: 'Baby Titan', biology: ['Beast'], attunement: ['Physical'], subtypes: ['Giant'], size: 'baby', pool: [], baseHp: 60 });
  ok(baby.size === 'baby', 'Giant may be Baby (no size gate)'); }

console.log('Generator (triple + pool → creature):');
const pool = [
  { id: 'strike', name: 'Strike', attunement: 'Physical', type: 'attack', cost: 1, rarity: 'basic', effects: [{ op: 'damage', value: 6 }] },
  { id: 'guard', name: 'Guard', attunement: 'Physical', type: 'skill', cost: 1, rarity: 'basic', effects: [{ op: 'block', value: 5 }] },
  { id: 'cleave', name: 'Cleave', attunement: 'Physical', type: 'attack', cost: 1, rarity: 'common', effects: [{ op: 'damage', value: 8 }] },
];
{ const c = makeCreature({ name: 'Emberfang', class: 'Mage', biology: ['Beast'], family: 'Draconic', attunement: ['Fire'], pool, baseHp: 55 });
  ok(c.maxHp === Math.round(55 * 1.4), `Draconic family HP scaled by its kit (${c.maxHp})`);
  // Archetype is HUMANOID-ONLY: a non-humanoid body drops its class.
  ok(c.class === null && c.attunement[0] === 'Fire', 'non-humanoid → NO archetype; attunement set');
  const h = makeCreature({ name: 'Adept', class: 'Mage', biology: ['Humanoid'], attunement: ['Fire'], pool, baseHp: 55 });
  ok(h.class?.[0] === 'Mage', 'Humanoid keeps its archetype');
  const hy = makeCreature({ name: 'Chimera', class: 'Mage', biology: ['Beast', 'Humanoid'], attunement: ['Fire'], pool, baseHp: 55 });
  ok(hy.class?.[0] === 'Mage', 'Humanoid HYBRID keeps its archetype');
  // Recipe: 3 Strike + 3 Defend + 1–3 archetype starters (here the pool has 1 common → 7).
  ok(c.deck.length >= 6 && c.deck.length <= 10, `starter deck built (${c.deck.length} cards)`);
  ok(c.deck.every((card) => card.id.includes('#')), 'deck copies have unique instance ids');
  // ~75% of cards re-skinned to Fire (a few keep Physical).
  const fire = c.deck.filter((card) => card.attunement === 'Fire').length;
  ok(fire >= 1, `cards re-skinned to Fire (${fire}/${c.deck.length})`); }

console.log(`\ngenerate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
