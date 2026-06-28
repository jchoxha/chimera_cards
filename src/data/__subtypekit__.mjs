// Validates the descriptive-subtype card packages (src/data/subtypeKit.json):
// every built subtype has a themed package of valid CardSpecs (unique ids, Physical).
// Reads JSON via fs. Run: test:subtype

import { readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';

const KIT = JSON.parse(readFileSync(new URL('./subtypeKit.json', import.meta.url)));
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const subtypes = Object.keys(KIT.subtypes);
const BUILT = ['Mechanical', 'Elemental', 'Giant', 'Demonic'];

console.log('Built subtypes each have a themed package (≥3 cards):');
for (const s of BUILT) {
  ok(KIT.subtypes[s], `missing package for ${s}`);
  ok(typeof KIT.subtypes[s]?.theme === 'string' && KIT.subtypes[s].theme.length > 0, `${s}: missing theme`);
  ok(Array.isArray(KIT.subtypes[s]?.cards) && KIT.subtypes[s].cards.length >= 3, `${s}: needs ≥3 cards`);
}

console.log('Every card is a valid CardSpec (unique id, Physical):');
let total = 0;
const ids = new Set();
for (const s of subtypes) {
  for (const c of (KIT.subtypes[s].cards || [])) {
    total++;
    const errs = validateCard(c);
    ok(errs.length === 0, `${c.id}: ${errs.join('; ')}`);
    ok(c.attunement === 'Physical', `${c.id}: should be authored Physical (got ${c.attunement})`);
    ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
  }
}
ok(total >= 12, `expected ≥12 subtype cards, got ${total}`);

console.log(`  ${subtypes.length} subtype packages · ${total} cards`);
console.log(`subtype-kit: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
