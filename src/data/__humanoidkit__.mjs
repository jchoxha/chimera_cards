// Validates the Humanoid weapons kit (src/data/humanoidKit.json): every weapon has
// a theme + a valid card cluster, every archetype has a proficiency list referencing
// real weapons, every weapon is used by ≥1 archetype, and every card is a valid
// CardSpec. Reads the JSON via fs (node test harness avoids bare JSON imports).
// Run: test:humanoid

import { readFileSync } from 'fs';
import { validateCard } from '../engine/cards/cardSpec.js';
import { CLASS_BASES } from './synthesis.js';

const KIT = JSON.parse(readFileSync(new URL('./humanoidKit.json', import.meta.url)));
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const weapons = Object.keys(KIT.weapons);

console.log('Proficiency: every archetype maps to real weapons:');
for (const klass of CLASS_BASES) {
  const prof = KIT.proficiency[klass];
  ok(Array.isArray(prof) && prof.length >= 2, `${klass}: needs ≥2 proficient weapons`);
  for (const w of (prof || [])) ok(weapons.includes(w), `${klass}: unknown weapon "${w}"`);
}

console.log('Weapons: each has a theme + ≥2 cards, and is used by ≥1 archetype:');
for (const w of weapons) {
  ok(typeof KIT.weapons[w].theme === 'string' && KIT.weapons[w].theme.length > 0, `${w}: missing theme`);
  ok(Array.isArray(KIT.weapons[w].cards) && KIT.weapons[w].cards.length >= 2, `${w}: needs ≥2 cards`);
  const used = CLASS_BASES.some((k) => (KIT.proficiency[k] || []).includes(w));
  ok(used, `weapon "${w}" is unused by every archetype`);
}

console.log('Every card is a valid CardSpec (unique id, Physical):');
let total = 0;
const ids = new Set();
for (const w of weapons) {
  for (const c of KIT.weapons[w].cards) {
    total++;
    const errs = validateCard(c);
    ok(errs.length === 0, `${c.id}: ${errs.join('; ')}`);
    ok(c.attunement === 'Physical', `${c.id}: should be authored Physical (got ${c.attunement})`);
    ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
  }
}
ok(total >= 20, `expected ≥20 weapon cards, got ${total}`);

console.log(`  ${weapons.length} weapons · ${total} cards`);
console.log(`humanoid-kit: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
