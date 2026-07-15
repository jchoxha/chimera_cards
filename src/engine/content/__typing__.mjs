// Completeness guard for the TYPING MATRICES — asserts every synthesis + matchup table is fully
// fleshed out, and that the kit axis (Archetype / Family / Manifestation) stays OUT of the matchup
// layer (parity with Class), with Draconic the sole documented exception. Run: test:typing
import {
  CLASS_BASES, BIOLOGY_BASES, ATTUNEMENT_BASES, BODY_TYPES, SUBTYPES,
  CLASS_SYNTHESIS, BIOLOGY_SYNTHESIS, ATTUNEMENT_SYNTHESIS, CLASS_ATTUNEMENT_RULES,
} from '../../data/synthesis.js';
import fs from 'node:fs';
import { ATTUNEMENT_MATCHUP, BIOLOGY_ATTUNEMENT, ATTUNEMENT_STATUS } from './matchups.js';
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

console.log('Constitution (Layer 2) covers the whole IDENTITY axis (body types + ALL subtypes):');
ok(missing(BODY_TYPES, BIOLOGY_ATTUNEMENT).length === 0, `all ${BODY_TYPES.length} body types have a constitution`);
const subMiss = missing(SUBTYPES, BIOLOGY_ATTUNEMENT);
ok(subMiss.length === 0, `all ${SUBTYPES.length} subtypes have a constitution${subMiss.length ? ' (missing: ' + subMiss.join(',') + ')' : ''}`);
const conBad = [];
for (const [k, r] of Object.entries(BIOLOGY_ATTUNEMENT)) for (const t of [...(r.weak || []), ...(r.resist || [])]) if (!ATT.has(t)) conBad.push(`${k}->${t}`);
ok(conBad.length === 0, `constitution entries reference only valid attunements${conBad.length ? ' (' + conBad.join(',') + ')' : ''}`);

console.log('Stat profiles cover the whole IDENTITY axis:');
ok(missing(BODY_TYPES, BODY_PROFILE).length === 0, 'all body types have a stat profile');
ok(missing(SUBTYPES, SUBTYPE_PROFILE).length === 0, `all ${SUBTYPES.length} subtypes have a stat profile`);

console.log('KIT axis (Family / Manifestation) stays OUT of the matchup + stat layers (parity with Class; Draconic excepted):');
const famsInMatchup = BEAST_FAMILIES.filter((f) => f !== 'Draconic' && BIOLOGY_ATTUNEMENT[f]);
const manifInMatchup = ABERRATION_FAMILIES.filter((m) => BIOLOGY_ATTUNEMENT[m]);
ok(famsInMatchup.length === 0, `no non-Draconic beast FAMILY leaks into constitution${famsInMatchup.length ? ' (' + famsInMatchup.join(',') + ')' : ''}`);
ok(manifInMatchup.length === 0, `no aberration MANIFESTATION leaks into constitution${manifInMatchup.length ? ' (' + manifInMatchup.join(',') + ')' : ''}`);
ok(BEAST_FAMILIES.length >= 6 && ABERRATION_FAMILIES.length >= 6, `families (${BEAST_FAMILIES.length}) + manifestations (${ABERRATION_FAMILIES.length}) enumerated`);

console.log('Class→attunement legality is defined for every class:');
ok(CLASS_BASES.every((c) => Array.isArray(CLASS_ATTUNEMENT_RULES[c])), 'every class has an attunement legality rule');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
