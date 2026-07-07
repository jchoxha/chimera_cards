// Validates the HYBRID signature-card kit (src/data/hybridKit.json): every pair
// (body / subtype / attunement) holds valid CardSpecs with unique ids, and the
// loader returns cards only for creatures that actually span two values on an axis.
// Reads JSON via fs. Run: test:hybrid

import { readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';

const KIT = JSON.parse(readFileSync(new URL('./hybridKit.json', import.meta.url)));

// Local re-implementation of engine/cards/hybridPool.hybridCards (that module
// static-imports the JSON, which node ESM can't load without an assertion).
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v != null ? [v] : []);
const pairKeys = (list) => { const o = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) o.push([list[i], list[j]].sort().join('+')); return o; };
function hybridCards({ biology, subtypes, attunement } = {}) {
  const out = []; const seen = new Set();
  const add = (cards) => { for (const c of cards || []) if (!seen.has(c.id)) { seen.add(c.id); out.push({ ...c }); } };
  for (const k of pairKeys(arr(biology))) add(KIT.bodyPairs?.[k]);
  for (const k of pairKeys(arr(subtypes))) add(KIT.subtypePairs?.[k]);
  for (const k of pairKeys(arr(attunement))) add(KIT.attunementPairs?.[k]);
  return out;
}
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const groups = ['bodyPairs', 'subtypePairs', 'attunementPairs'];
const ids = new Set();
let total = 0;

console.log('Every hybrid pair key is sorted, and holds valid unique CardSpecs:');
for (const g of groups) {
  for (const [key, cards] of Object.entries(KIT[g] || {})) {
    const parts = key.split('+');
    ok(parts.length === 2, `${g}.${key}: key must be two values joined by '+'`);
    ok([...parts].sort().join('+') === key, `${g}.${key}: key must be alphabetically sorted`);
    ok(Array.isArray(cards) && cards.length >= 1, `${g}.${key}: needs ≥1 card`);
    for (const c of cards || []) {
      total++;
      const errs = validateCard(c);
      ok(errs.length === 0, `${c.id}: ${errs.join('; ')}`);
      ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
    }
  }
}
ok(total >= 18, `expected ≥18 hybrid cards, got ${total}`);

console.log('Loader only fires for genuine hybrids (two values on an axis):');
ok(hybridCards({ biology: ['Humanoid'] }).length === 0, 'single body type → no body-pair cards');
ok(hybridCards({ biology: ['Beast', 'Humanoid'] }).length >= 1, 'Beast+Humanoid → body-pair cards');
ok(hybridCards({ attunement: ['Fire'] }).length === 0, 'single attunement → no attunement-pair cards');
ok(hybridCards({ attunement: ['Fire', 'Frost'] }).length >= 1, 'Fire+Frost → attunement-pair card');
ok(hybridCards({ attunement: ['Frost', 'Fire'] }).length >= 1, 'order-independent: Frost+Fire matches Fire+Frost');
ok(hybridCards({ subtypes: ['Giant', 'Demonic'] }).length >= 1, 'Giant+Demonic → subtype-pair card');
ok(hybridCards({ subtypes: ['Giant'] }).length === 0, 'single subtype → no subtype-pair cards');

console.log(`  ${total} hybrid cards across ${groups.reduce((n, g) => n + Object.keys(KIT[g] || {}).length, 0)} pairs`);
console.log(`hybrid-kit: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
