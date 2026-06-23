// Validates EVERY archetype card kit in src/data/cards/*.json against validateCard
// (so all 8 kits are guaranteed valid CardSpec). Run: npm run test:kits
import { readdirSync, readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';

const dirUrl = new URL('./cards/', import.meta.url);
const files = readdirSync(dirUrl).filter((f) => f.endsWith('.json'));
let pass = 0, fail = 0, total = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

for (const f of files) {
  const data = JSON.parse(readFileSync(new URL('./cards/' + f, import.meta.url)));
  const cards = data.cards || [];
  console.log(`  ${f}: ${cards.length} cards (class ${data.class})`);
  const ids = new Set();
  for (const c of cards) {
    total++;
    const errs = validateCard(c);
    ok(errs.length === 0, `${f} ${c.id}: ${errs.join('; ')}`);
    ok(c.class === data.class, `${f} ${c.id}: class mismatch (${c.class} ≠ ${data.class})`);
    ok(!ids.has(c.id), `${f}: duplicate id ${c.id}`); ids.add(c.id);
  }
}
console.log(`\nkits: ${files.length} files, ${total} cards — ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
