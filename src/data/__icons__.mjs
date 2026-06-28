// Completeness smoke test for the placeholder art manifest. Verifies every axis
// base (from the locked synthesis data) has an icon, attunements have a color, and
// the card/creature resolvers behave. Run: node src/data/__icons__.mjs (test:icons)

import { CLASS_BASES, BIOLOGY_BASES, ATTUNEMENT_BASES, SUBTYPES } from './synthesis.js';
import {
  ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, SUBTYPE_ICON,
  axisIcon, cardIcon, creatureIcon, creatureColor,
} from './axisIcons.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
const isIcon = (s) => typeof s === 'string' && s.startsWith('game-icons:');

console.log('Every archetype/biology/attunement base has a valid icon id:');
for (const c of CLASS_BASES) ok(isIcon(ARCHETYPE_ICON[c]), `archetype ${c} → ${ARCHETYPE_ICON[c]}`);
for (const b of BIOLOGY_BASES) ok(isIcon(BIOLOGY_ICON[b]), `biology ${b} → ${BIOLOGY_ICON[b]}`);
for (const a of ATTUNEMENT_BASES) ok(isIcon(ATTUNEMENT_ICON[a]), `attunement ${a} → ${ATTUNEMENT_ICON[a]}`);
for (const s of SUBTYPES) ok(isIcon(SUBTYPE_ICON[s]), `subtype ${s} → ${SUBTYPE_ICON[s]}`);

console.log('Every attunement has an identity color:');
for (const a of ATTUNEMENT_BASES) ok(/^#[0-9a-f]{6}$/i.test(ATTUNEMENT_COLOR[a] || ''), `attunement ${a} → ${ATTUNEMENT_COLOR[a]}`);

console.log('axisIcon resolves each axis:');
ok(axisIcon('class', 'Warrior') === ARCHETYPE_ICON.Warrior, 'axisIcon class');
ok(axisIcon('biology', 'Undead') === BIOLOGY_ICON.Undead, 'axisIcon biology');
ok(axisIcon('attunement', 'Fire') === ATTUNEMENT_ICON.Fire, 'axisIcon attunement');

console.log('cardIcon heuristics (op-list + flat):');
ok(cardIcon({ attunement: 'Fire', type: 'attack', effects: [{ op: 'damage', value: 6 }] }) === ATTUNEMENT_ICON.Fire, 'fire attack → flame');
ok(cardIcon({ type: 'skill', effects: [{ op: 'block', value: 5 }] }) === 'game-icons:checked-shield', 'block → shield');
ok(cardIcon({ type: 'power', effects: [] }) === 'game-icons:upgrade', 'power → upgrade');
ok(cardIcon({ type: 'skill', effects: [{ op: 'heal', value: 8 }] }) === 'game-icons:healing', 'heal → healing');
ok(cardIcon({ icon: 'game-icons:meteor', effects: [] }) === 'game-icons:meteor', 'explicit icon override wins');
ok(isIcon(cardIcon({ type: 'attack', effects: { dmg: 6 } })), 'legacy flat-effect card resolves');

console.log('creatureIcon / creatureColor fall back through the axes:');
ok(creatureIcon({ biology: ['Dragonkin'], attunement: ['Fire'] }) === BIOLOGY_ICON.Dragonkin, 'biology wins for the silhouette');
ok(creatureIcon({ attunement: ['Fire'] }) === ATTUNEMENT_ICON.Fire, 'no biology → attunement');
ok(creatureIcon({ class: ['Warrior'] }) === ARCHETYPE_ICON.Warrior, 'no biology/attunement → archetype');
ok(creatureIcon({ types: [{ type: 'Fire' }] }) === ATTUNEMENT_ICON.Fire, 'legacy types shape resolves');
ok(creatureColor({ attunement: ['Frost'] }) === ATTUNEMENT_COLOR.Frost, 'creatureColor = primary attunement color');

console.log(`\nicons: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
