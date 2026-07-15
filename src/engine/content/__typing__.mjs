// Completeness guard for the TYPING MATRICES — asserts every synthesis + matchup table is fully
// fleshed out. Matchups are ATTUNEMENT-ONLY (constitution retired 2026-07-15), so the only matchup
// table to guard is the attunement ring; body/subtype/family have no matchup effect by construction.
// Run: test:typing
import {
  CLASS_BASES, BIOLOGY_BASES, ATTUNEMENT_BASES, BODY_TYPES, SUBTYPES,
  CLASS_SYNTHESIS, BIOLOGY_SYNTHESIS, ATTUNEMENT_SYNTHESIS, CLASS_ATTUNEMENT_RULES,
} from '../../data/synthesis.js';
import fs from 'node:fs';
import { ATTUNEMENT_MATCHUP, ATTUNEMENT_STATUS } from './matchups.js';
import { BODY_PROFILE, SUBTYPE_PROFILE } from './biology.js';
// read the kit family/manifestation lists straight from the JSON (node ESM can't `import` .json
// without an import attribute, and the pool modules do exactly that).
const readFamilies = (p) => Object.keys(JSON.parse(fs.readFileSync(new URL(p, import.meta.url))).families || {});
const BEAST_FAMILIES = readFamilies('../../data/beastKit.json');
const ABERRATION_FAMILIES = readFamilies('../../data/aberrationKit.json');

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
const ATT = new Set(ATTUNEMENT_BASES);
const allPairs = (bases) => { const o = []; for (let i = 0; i < bases.length; i++) for (let j = i + 1; j < bases.length; j++) o.push([bases[i], bases[j]].sort().join('|')); return o; };
const missing = (need, table) => need.filter((k) => !(k in table));

console.log('Synthesis NAMING tables are complete (every unordered pair named):');
ok(missing(allPairs(CLASS_BASES), CLASS_SYNTHESIS).length === 0, `Class: all ${allPairs(CLASS_BASES).length} pairs named`);
ok(missing(allPairs(BIOLOGY_BASES), BIOLOGY_SYNTHESIS).length === 0, `Biology: all ${allPairs(BIOLOGY_BASES).length} pairs named`);
ok(missing(allPairs(ATTUNEMENT_BASES), ATTUNEMENT_SYNTHESIS).length === 0, `Attunement: all ${allPairs(ATTUNEMENT_BASES).length} pairs named`);
ok(BODY_TYPES.every((a) => BODY_TYPES.every((b) => a === b || (a + '|' + b) in BIOLOGY_SYNTHESIS || (b + '|' + a) in BIOLOGY_SYNTHESIS)), 'every BODY-TYPE pair has a synthesis name');

console.log('Attunement matchup + status rings are complete (all 13):');
ok(ATTUNEMENT_BASES.every((e) => ATTUNEMENT_MATCHUP[e]), 'every attunement has a matchup row');
ok(ATTUNEMENT_BASES.every((e) => ATTUNEMENT_STATUS[e]), 'every attunement has a signature status');
const badRefs = [];
for (const [e, r] of Object.entries(ATTUNEMENT_MATCHUP)) for (const t of [...r.strong, ...r.weak]) if (!ATT.has(t)) badRefs.push(`${e}->${t}`);
ok(badRefs.length === 0, `matchup rows reference only valid attunements${badRefs.length ? ' (' + badRefs.join(',') + ')' : ''}`);
ok(Object.values(ATTUNEMENT_MATCHUP).every((r) => r.strong.length === 2 && r.weak.length === 2), 'every matchup row has exactly 2 strong + 2 weak');

console.log('Matchups are ATTUNEMENT-ONLY — no per-body/subtype/family matchup table exists:');
// The retired constitution meant body/subtype/family names could never leak into a matchup table;
// with the table gone, that invariant holds by construction. Assert the axes are still enumerated
// so downstream systems (pools, specificity, stats) have their vocabulary.
ok(BODY_TYPES.length === 3, `body types enumerated (${BODY_TYPES.join(', ')})`);
ok(SUBTYPES.length >= 4, `subtypes enumerated (${SUBTYPES.length})`);
ok(BEAST_FAMILIES.length >= 6 && ABERRATION_FAMILIES.length >= 6, `families (${BEAST_FAMILIES.length}) + manifestations (${ABERRATION_FAMILIES.length}) enumerated`);

console.log('Stat profiles cover the whole IDENTITY axis (interim — kit+factor stat model lands in step ①b):');
ok(missing(BODY_TYPES, BODY_PROFILE).length === 0, 'all body types have a stat profile');
ok(missing(SUBTYPES, SUBTYPE_PROFILE).length === 0, `all ${SUBTYPES.length} subtypes have a stat profile`);

console.log('Class→attunement legality is defined for every class:');
ok(CLASS_BASES.every((c) => Array.isArray(CLASS_ATTUNEMENT_RULES[c])), 'every class has an attunement legality rule');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
