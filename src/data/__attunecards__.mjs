// Validates the attunement-own card pools (src/data/attunementCards.json): every
// attunement has a pool, every card is a valid CardSpec, correctly tagged. Reads
// the JSON via fs (Node ESM won't import JSON without assertions). Run: test:attunecards

import { readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';
import { ATTUNEMENT_BASES } from './synthesis.js';

const POOLS = JSON.parse(readFileSync(new URL('./attunementCards.json', import.meta.url)));
let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, c && false) : (fail++, console.error('  ✗', m)));

console.log('Every attunement has an authored pool (≥3 cards):');
for (const a of ATTUNEMENT_BASES) ok(Array.isArray(POOLS[a]) && POOLS[a].length >= 3, `${a} pool missing/short (${POOLS[a]?.length || 0})`);

let total = 0;
const ids = new Set();
for (const a of ATTUNEMENT_BASES) {
  for (const c of (POOLS[a] || [])) {
    total++;
    const errs = validateCard(c);
    ok(errs.length === 0, `${c.id}: ${errs.join('; ')}`);
    ok(c.attunement === a, `${c.id} mis-tagged (${c.attunement} ≠ ${a})`);
    ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
  }
}
ok(total >= 48, `expected ≥48 attunement cards, got ${total}`);

console.log(`  authored ${total} attunement cards across ${ATTUNEMENT_BASES.length} attunements`);
console.log(`attune-cards: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
