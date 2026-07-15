// Smoke test for the matchup engine (src/engine/content/matchups.js).
// Run: node src/engine/content/__matchups__.mjs   (also: npm run test:matchups)
//
// Pins the LOCKED engine behavior — ATTUNEMENT-ONLY (locked 2026-07-15): the
// attacker's element vs the defender's element(s), attunement self-resist, best-of,
// and the clamp. The biology "constitution" Layer 2 is RETIRED. The matchup NUMBERS
// themselves are REVIEW/provisional — these tests assert the rules.

import {
  computeMatchup, matchupMultiplier, MAG,
  attunementsOf, biologiesOf,
} from './matchups.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
const near = (a, b) => Math.abs(a - b) < 1e-9;

// Helpers to build test units in BOTH the new and legacy shapes.
const A = (attunement, biology = []) => ({ attunement, biology });
const legacy = (...els) => ({ types: els.map((e) => ({ type: e, weight: 1 })) });

console.log('Accessors (new + legacy shapes):');
{
  ok(attunementsOf(A(['Fire'])).join() === 'Fire', 'attunementsOf reads new .attunement');
  ok(attunementsOf(legacy('Fire', 'Frost')).join() === 'Fire,Frost', 'attunementsOf falls back to legacy .types');
  ok(biologiesOf(A(['Fire'], ['Beast'])).join() === 'Beast', 'biologiesOf reads .biology (general accessor)');
  ok(attunementsOf({}).length === 0, 'empty unit → no attunements');
}

console.log('Layer 1 — attunement vs attunement:');
{
  // Fire strong vs Frost (1.5), weak vs Water (0.66), neutral vs Holy (1.0)
  ok(near(matchupMultiplier(A(['Fire']), A(['Frost'])), MAG.ATTUNE_STRONG), 'Fire→Frost = 1.5');
  ok(near(matchupMultiplier(A(['Fire']), A(['Water'])), MAG.ATTUNE_WEAK), 'Fire→Water = 0.66');
  ok(near(matchupMultiplier(A(['Fire']), A(['Holy'])), 1), 'Fire→Holy = 1.0 (neutral)');
  // Product across multiple defender attunements: Fire vs Frost+Nature = 1.5*1.5
  ok(near(matchupMultiplier(A(['Fire']), A(['Frost', 'Nature'])), 2.25), 'Fire→Frost+Nature = 2.25 (product)');
}

console.log('Attacker takes BEST of its attunements:');
{
  // Fire (weak vs Water 0.66) OR Nature (strong vs Water 1.5) → best = 1.5
  ok(near(matchupMultiplier(A(['Fire', 'Nature']), A(['Water'])), MAG.ATTUNE_STRONG),
    'Fire/Nature → Water picks the best element (Nature 1.5)');
}

console.log('Self-resist (attunement-only, B4):');
{
  // Fire attacking a Fire defender → 0.75 self-resist
  ok(near(matchupMultiplier(A(['Fire']), A(['Fire'])), MAG.SELF_RESIST), 'Fire→Fire = 0.75 self-resist');
}

console.log('Biology is IGNORED (constitution retired 2026-07-15):');
{
  // A defender's body type / subtype / family has NO matchup effect now — only its attunement matters.
  const plain   = matchupMultiplier(A(['Fire']), A(['Frost']));
  const beast   = matchupMultiplier(A(['Fire']), A(['Frost'], ['Beast']));
  const subtyped = matchupMultiplier(A(['Fire']), { attunement: ['Frost'], biology: ['Humanoid'], subtypes: ['Undead'], family: 'Draconic' });
  ok(near(plain, beast) && near(plain, subtyped),
    `body/subtype/family don't change the matchup (${plain} == ${beast} == ${subtyped})`);
  // Fire → Fire-Beast is just the attunement self-resist; biology never enters.
  ok(near(matchupMultiplier(A(['Fire']), A(['Fire'], ['Beast'])), MAG.SELF_RESIST),
    'Fire → Fire-Beast = 0.75 (self-resist; biology ignored)');
}

console.log('Clamp:');
{
  ok(matchupMultiplier(A(['Fire']), A(['Frost', 'Nature'])) <= MAG.CLAMP_MAX, 'never exceeds clamp max');
  ok(matchupMultiplier(A(['Holy']), A(['Holy', 'Mind'])) >= MAG.CLAMP_MIN, 'never below clamp min');
}

console.log('Breakdown shape (for the live UI readout, B3):');
{
  const r = computeMatchup(A(['Fire']), A(['Frost']));
  ok(r.best === 'Fire' && typeof r.attune === 'number' && typeof r.total === 'number' && typeof r.label === 'string',
    'computeMatchup returns {total,best,attune,selfResisted,label}');
  ok(r.selfResisted === false, 'selfResisted flag present');
}

console.log(`\nmatchups: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
