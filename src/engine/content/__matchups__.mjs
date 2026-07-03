// Smoke test for the 3-axis matchup engine (src/engine/content/matchups.js).
// Run: node src/engine/content/__matchups__.mjs   (also: npm run test:matchups)
//
// Pins the LOCKED engine behavior (two attunement-keyed layers, attunement-only
// self-resist, the own-attunement biology OVERRIDE, and the clamp). The matchup
// NUMBERS themselves are REVIEW/provisional — these tests assert the rules, using
// relationships from the current v0 tables.

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
  ok(biologiesOf(A(['Fire'], ['Beast'])).join() === 'Beast', 'biologiesOf reads .biology');
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
  // Fire attacking a Fire defender → 0.75 self-resist (no biology)
  ok(near(matchupMultiplier(A(['Fire']), A(['Fire'])), MAG.SELF_RESIST), 'Fire→Fire = 0.75 self-resist');
}

console.log('Layer 2 — biology constitution vs incoming element:');
{
  // Beast is weak to Fire (1.25). Attacker Physical (neutral vs Beast? Beast resists Physical 0.8)
  // Use Holy attacker (neutral attunement vs a no-attunement... give defender an attunement)
  // Defender: Frost Beast. Attacker Fire: attune Fire→Frost 1.5, biology Beast weak Fire 1.25 → 1.875
  ok(near(matchupMultiplier(A(['Fire']), A(['Frost'], ['Beast'])), 1.5 * 1.25),
    'Fire → Frost-Beast = 1.5 (attune) × 1.25 (Beast weak Fire) = 1.875');
  // Mechanical resists Physical (0.8): Physical → Water-Mechanical
  // attune Physical→Water = neutral(1.0); biology Mechanical resist Physical 0.8 → 0.8
  ok(near(matchupMultiplier(A(['Physical']), A(['Water'], ['Mechanical'])), MAG.BIO_RESIST),
    'Physical → Mechanical = 0.8 (biology resist)');
}

console.log('OVERRIDE — own attunement cancels biology elemental relationship:');
{
  // Beast weak to Fire, but a FIRE Beast cancels it → biology layer skipped,
  // self-resist applies instead. Fire → Fire-Beast: attune 0.75 self-resist, biology cancelled.
  const r = computeMatchup(A(['Fire']), A(['Fire'], ['Beast']));
  ok(near(r.total, MAG.SELF_RESIST), 'Fire → Fire-Beast = 0.75 (biology weakness cancelled, self-resist applies)');
  ok(r.biology === 1, 'biology layer is 1.0 when overridden');
  ok(r.overridden.includes('Beast'), 'breakdown reports Beast as overridden');
  ok(r.selfResisted === true, 'breakdown flags self-resist');
}

console.log('Clamp:');
{
  // Stack a big multiplier and confirm clamp at 4.0
  // Fire → Frost+Nature (2.25) on a Beast weak-to-Fire (1.25) = 2.8125 < 4, so craft bigger:
  // Use defender Frost+Nature+... can only have 1-2 attunements, so 2.25 * 1.25 = 2.8125.
  ok(matchupMultiplier(A(['Fire']), A(['Frost', 'Nature'], ['Beast'])) <= MAG.CLAMP_MAX, 'never exceeds clamp max');
  ok(matchupMultiplier(A(['Holy']), A(['Holy', 'Mind'], ['Aberration'])) >= MAG.CLAMP_MIN, 'never below clamp min');
}

console.log('Breakdown shape (for the live UI readout, B3):');
{
  const r = computeMatchup(A(['Fire']), A(['Frost'], ['Beast']));
  ok(r.best === 'Fire' && typeof r.attune === 'number' && typeof r.biology === 'number' && typeof r.label === 'string',
    'computeMatchup returns {total,best,attune,biology,label,...}');
}


console.log('Subtype + family constitutions (§9 re-key):');
{ // a Giant Humanoid resists Stone via its Giant SUBTYPE (Humanoid alone is neutral)
  const giant = matchupMultiplier(A(['Stone']), { attunement: ['Physical'], biology: ['Humanoid'], subtypes: ['Giant'] });
  const plain = matchupMultiplier(A(['Stone']), { attunement: ['Physical'], biology: ['Humanoid'] });
  ok(near(giant, MAG.BIO_RESIST) && near(plain, 1), `Stone -> Giant Humanoid = ${giant} via the subtype (plain ${plain})`);
}
{ // Undead subtype: weak to Holy stacks with... Humanoid neutral to Holy
  const r = matchupMultiplier(A(['Holy']), { attunement: ['Shadow'], biology: ['Humanoid'], subtypes: ['Undead'] });
  ok(r > 1, `Holy -> Undead Humanoid is weak (${r})`);
}
{ // Draconic family: weak to Frost
  const r = matchupMultiplier(A(['Frost']), { attunement: ['Fire'], biology: ['Beast'], family: 'Draconic' });
  ok(r > matchupMultiplier(A(['Frost']), { attunement: ['Fire'], biology: ['Beast'] }),
    'Frost hits a Draconic beast harder than a plain beast');
}
{ // snapshot shape (axes.*) resolves the same as the fighter shape
  const fighter = { attunement: ['Shadow'], biology: ['Humanoid'], subtypes: ['Undead'] };
  const snap = { types: [{ type: 'Shadow', weight: 1 }], axes: { biology: ['Humanoid'], subtypes: ['Undead'] } };
  ok(near(matchupMultiplier(A(['Holy']), fighter), matchupMultiplier(A(['Holy']), snap)),
    'snapshot axes.* shape == fighter shape');
}

console.log(`\nmatchups: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
