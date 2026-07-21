// Validates the Aberration biology kit (src/data/aberrationKit.json). Mirrors the
// beast-kit test: every family has a theme + allowed anatomy + signatures (1 starter),
// every anatomy tag has a valid card cluster + is used by ≥1 family, every card is a
// valid CardSpec. Reads JSON via fs. Run: test:aberration

import { readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';

const KIT = JSON.parse(readFileSync(new URL('./aberrationKit.json', import.meta.url)));
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const families = Object.keys(KIT.families);
const anatomy = Object.keys(KIT.anatomy);
const NOUN_TAGS = ['Tentacle', 'Eye', 'Maw', 'Pseudopod', 'Spore', 'Shard', 'Miasma', 'Roots', 'Mandible', 'Carapace', 'Membrane', 'Cilia', 'Ichor'];

console.log('Families (the wide, exhaustive Aberration set):');
ok(families.length >= 6, `expected ≥6 families, got ${families.length}`);
for (const f of families) {
  const fam = KIT.families[f];
  ok(typeof fam.theme === 'string' && fam.theme.length > 0, `${f}: missing theme`);
  ok(Array.isArray(fam.anatomy) && fam.anatomy.length >= 3, `${f}: needs ≥3 allowed anatomy`);
  ok(Array.isArray(fam.signatures) && fam.signatures.length >= 2, `${f}: needs ≥2 signatures`);
  for (const t of fam.anatomy) ok(anatomy.includes(t), `${f}: unknown anatomy "${t}"`);
  ok(fam.signatures.filter((s) => s.starter).length === 1, `${f}: expected exactly 1 starter signature`);
}

console.log('Aberrant-feature tags (noun-only) + coverage:');
for (const t of anatomy) {
  ok(NOUN_TAGS.includes(t), `anatomy "${t}" not in the locked aberration noun set`);
  ok(Array.isArray(KIT.anatomy[t].cards) && KIT.anatomy[t].cards.length >= 2, `${t}: needs ≥2 cards`);
  ok(families.some((f) => KIT.families[f].anatomy.includes(t)), `anatomy "${t}" unused by every family`);
}

console.log('Every card is a valid CardSpec (unique id, Physical):');
let total = 0;
const ids = new Set();
const allCards = [
  ...families.flatMap((f) => KIT.families[f].signatures),
  ...anatomy.flatMap((t) => KIT.anatomy[t].cards),
];
for (const c of allCards) {
  total++;
  const errs = validateCard(c);
  ok(errs.length === 0, `${c.id}: ${errs.join('; ')}`);
  ok(c.attunement === 'Physical', `${c.id}: should be authored Physical (got ${c.attunement})`);
  ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
}
ok(total >= 30, `expected ≥30 Aberration cards, got ${total}`);

console.log(`  ${families.length} families · ${anatomy.length} aberrant-feature tags · ${total} cards`);
console.log(`aberration-kit: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
