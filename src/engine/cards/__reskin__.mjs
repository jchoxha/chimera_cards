// Smoke test: archetype re-skin + §14.3 variant access (engine/cards/reskin.js).
// Run: node src/engine/cards/__reskin__.mjs  (npm run test:reskin)

import { reskinDeck, attunementVariants } from './reskin.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const CARDS = [
  { id: 'strike', name: 'Strike', type: 'attack', attunement: 'Physical', cost: 1, effects: [{ op: 'damage', value: 6 }] },
  { id: 'cleave', name: 'Cleave', type: 'attack', attunement: 'Physical', cost: 1, effects: [{ op: 'damage', value: 8 }] },
  { id: 'guard', name: 'Guard', type: 'skill', attunement: 'Physical', cost: 1, effects: [{ op: 'block', value: 5 }] },
  { id: 'warcry', name: 'War Cry', type: 'skill', attunement: 'Physical', cost: 1, effects: [{ op: 'buff', status: 'strength', value: 2 }] },
];

console.log('reskinDeck converts most cards to the primary attunement, never mutates:');
{
  const out = reskinDeck(CARDS, ['Energy', 'Fire']);
  const energy = out.filter((c) => c.attunement === 'Energy').length;
  ok(energy >= 2, `majority re-skinned to primary Energy (${energy}/4)`);
  ok(CARDS.every((c) => c.attunement === 'Physical'), 'source cards untouched');
  ok(out.every((c) => c.effects !== CARDS.find((s) => s.id === c.id || c.id.startsWith(s.id))?.effects), 'effects deep-cloned');
}

console.log('attunementVariants — mono-attunement creature gets none:');
{ ok(attunementVariants(CARDS, ['Physical']).length === 0, 'single attunement → no cross-element variants'); }

console.log('attunementVariants — re-elements ATTACKS to the OTHER attunement(s):');
{
  const v = attunementVariants(CARDS, ['Physical', 'Fire']);
  ok(v.length === 2, `two attacks (strike, cleave) varied to Fire (got ${v.length})`);
  ok(v.every((c) => c.attunement === 'Fire'), 'all variants are Fire');
  ok(v.every((c) => /@Fire$/.test(c.id)), `variants get distinct @Fire ids (${v.map((c) => c.id).join(', ')})`);
  ok(!v.some((c) => c.id.startsWith('guard') || c.id.startsWith('warcry')), 'block/utility cards are NOT varied (no damage element)');
}

console.log('attunementVariants — supports two non-primary attunements:');
{
  const v = attunementVariants(CARDS, ['Physical', 'Fire', 'Frost']);
  ok(v.filter((c) => c.attunement === 'Fire').length === 2 && v.filter((c) => c.attunement === 'Frost').length === 2,
    `2 attacks × 2 other attunements = 4 variants (got ${v.length})`);
}

console.log(`\nreskin: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
