// Verifies the bundled placeholder-art manifest has the category families the
// artPool resolvers map onto. Reads the JSON via fs (artPool itself is Vite-only —
// it imports JSON, which Node ESM won't do without assertions). Run: test:art

import { readFileSync } from 'fs';
const m = JSON.parse(readFileSync(new URL('./placeholderArt.json', import.meta.url)));

let pass = 0, fail = 0;
const ok = (c, msg) => (c ? (pass++, console.log('  ✓', msg)) : (fail++, console.error('  ✗', msg)));
const items = m.items || [], beings = m.beings || [];
const has = (p) => items.some((f) => f.toLowerCase().startsWith(p.toLowerCase()));

console.log('Bundled art manifest has the move-art families (496 CC0 pack):');
for (const p of ['S_Fire', 'S_Ice', 'S_Poison', 'S_Shadow', 'S_Holy', 'S_Thunder', 'S_Water', 'S_Wind', 'S_Earth', 'S_Magic', 'S_Buff', 'W_Sword', 'W_Dagger', 'W_Bow', 'W_Staff', 'P_Medicine']) {
  ok(has(p), `has ${p}* icons`);
}
console.log('Creature sprites present (CodeSpree pack):');
ok(beings.length >= 50, `beings bundled (${beings.length})`);
ok(items.length >= 100, `item icons bundled (${items.length})`);
ok(items.every((f) => f.endsWith('.png')) && beings.every((f) => f.endsWith('.png')), 'all entries are .png filenames');

console.log(`\nart: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
