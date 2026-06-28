// Validates the Beast biology kit (src/data/beastKit.json): every family has a
// theme + allowed anatomy + signatures, every anatomy tag has a valid card cluster,
// every card is a valid CardSpec, families only reference real anatomy, and every
// anatomy tag is used by at least one family. Reads the JSON via fs (the node test
// harness avoids bare JSON imports). Run: test:beast

import { readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';

const KIT = JSON.parse(readFileSync(new URL('./beastKit.json', import.meta.url)));
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const families = Object.keys(KIT.families);
const anatomy = Object.keys(KIT.anatomy);
// The locked noun-only tag set (Roar is the allowed behaviour exception).
const NOUN_TAGS = ['Claws', 'Teeth', 'Beak', 'Horns', 'Tail', 'Hooves', 'Wings', 'Quills', 'Venom', 'Hide', 'Shell', 'Roar'];

console.log('Families (4–6 scientific classes):');
ok(families.length >= 4 && families.length <= 6, `expected 4–6 families, got ${families.length}`);
for (const f of families) {
  const fam = KIT.families[f];
  ok(typeof fam.theme === 'string' && fam.theme.length > 0, `${f}: missing theme`);
  ok(Array.isArray(fam.anatomy) && fam.anatomy.length >= 3, `${f}: needs ≥3 allowed anatomy`);
  ok(Array.isArray(fam.signatures) && fam.signatures.length >= 2, `${f}: needs ≥2 signatures`);
  // every allowed anatomy is a real tag
  for (const t of fam.anatomy) ok(anatomy.includes(t), `${f}: unknown anatomy "${t}"`);
  // exactly one starter signature
  const starters = fam.signatures.filter((s) => s.starter);
  ok(starters.length === 1, `${f}: expected exactly 1 starter signature, got ${starters.length}`);
}

console.log('Anatomy tags (noun-only, Roar excepted):');
for (const t of anatomy) {
  ok(NOUN_TAGS.includes(t), `anatomy "${t}" is not in the locked noun-tag set`);
  ok(Array.isArray(KIT.anatomy[t].cards) && KIT.anatomy[t].cards.length >= 2, `${t}: needs ≥2 cards`);
}
// coverage: every anatomy tag is used by at least one family
for (const t of anatomy) {
  const used = families.some((f) => KIT.families[f].anatomy.includes(t));
  ok(used, `anatomy "${t}" is unused by every family`);
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
ok(total >= 30, `expected ≥30 Beast cards, got ${total}`);

console.log(`  ${families.length} families · ${anatomy.length} anatomy tags · ${total} cards`);
console.log(`beast-kit: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
