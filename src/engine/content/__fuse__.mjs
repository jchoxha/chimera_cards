// Validates SEAMLESS CREATURE FUSION (engine/content/fuse.js): the portmanteau
// namer, the axis merge + its reduction/legality rules, order-sensitivity, the
// generated Fusion Power card, and the fact that a fused creature's STATS and
// DECK fall out of the merged axes. Pure — no JSON kit imports. Run: test:fuse

import { fusionName, fuseAxes, fusionPowerCard, fuseCreatures, FUSION_CAPS } from './fuse.js';
import { validateCard } from '../cards/cardSpec.js';
import { statProfile } from './statProfile.js';
import { attunementComboLegal } from '../../data/synthesis.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

// ── fixtures: one of each body type ────────────────────────────────────────
const IRONHIDE = {                       // Humanoid warrior
  id: 'ironhide', name: 'Ironhide', biology: ['Humanoid'], class: ['Warrior'],
  attunement: ['Physical'], weapons: ['Hammer', 'Shield'], subtypes: ['Giant'],
  size: 'regular', maxHp: 70,
};
const VOLTFANG = {                       // Beast
  id: 'voltfang', name: 'Voltfang', biology: ['Beast'], family: 'Mammalian',
  attunement: ['Energy'], anatomy: ['Teeth', 'Claws'], size: 'regular', maxHp: 55,
};
const MAW = {                            // Aberration
  id: 'maw', name: 'Maw', biology: ['Aberration'], family: 'Eldritch',
  attunement: ['Void'], anatomy: ['Tentacle', 'Eye'], subtypes: ['Demonic'],
  size: 'regular', maxHp: 60,
};

console.log('Portmanteau naming:');
eq(fusionName('Ironhide', 'Voltfang'), 'Ironfang', 'Ironhide+Voltfang');
eq(fusionName('Voltfang', 'Ironhide'), 'Volthide', 'Voltfang+Ironhide (order flips)');
eq(fusionName('Emberwisp', 'Thornroot'), 'Emberoot', 'seam de-duplicated (rr→r)');
ok(fusionName('Maw', 'Ironhide').length >= 3, 'single-syllable primary still yields a name');
ok(/^[A-Z]/.test(fusionName('voltfang', 'maw')), 'result is capitalised');
ok(fusionName('', '') && fusionName(null, null), 'degenerate input never throws/empties');

console.log('Axis merge — bodies, kits, factors:');
{
  const a = fuseAxes(IRONHIDE, VOLTFANG);
  eq(a.biology, ['Humanoid', 'Beast'], 'body union, primary first');
  eq(a.class, ['Warrior'], 'Humanoid present → archetype kept');
  eq(a.family, 'Mammalian', 'Beast present → beast family inherited from the secondary');
  ok(a.manifestation == null, 'no Aberration → no manifestation slot');
  ok(a.weapons.includes('Hammer'), 'primary weapons survive');
  ok(a.anatomy.includes('Teeth'), 'secondary anatomy survives (both parents visible)');
  eq(a.size, 'regular', 'primary donates the frame/size');
}
{
  const a = fuseAxes(VOLTFANG, IRONHIDE);
  eq(a.biology, ['Beast', 'Humanoid'], 'reversed order → reversed body list');
  ok(a.anatomy.includes('Teeth') && a.weapons.includes('Hammer'), 'both kits still represented');
}
{ // Aberration keeps its kit in the dedicated manifestation slot
  const a = fuseAxes(MAW, VOLTFANG);
  eq(a.manifestation, 'Eldritch', 'Aberration-only parent: family → manifestation');
  eq(a.family, 'Mammalian', 'beast family comes from the Beast parent');
  ok(a.class == null, 'no Humanoid → archetype dropped (instinctive)');
}
{ // a body type that drops out of the merge must not leave an orphan kit
  const a = fuseAxes(VOLTFANG, { ...MAW, biology: ['Beast'], family: 'Reptilian' });
  eq(a.biology, ['Beast'], 'same-body fusion stays single-bodied');
  ok(a.manifestation == null, 'no Aberration body → no manifestation');
  eq(a.family, 'Mammalian', 'primary wins a contested kit slot');
}

console.log('Reduction caps:');
{
  const wide = { ...MAW, biology: ['Aberration', 'Beast'], subtypes: ['Demonic', 'Mechanical'] };
  const a = fuseAxes(wide, { ...IRONHIDE, subtypes: ['Giant', 'Undead'] });
  ok(a.biology.length <= FUSION_CAPS.biology, `bodies capped at ${FUSION_CAPS.biology}`);
  ok(a.subtypes.length <= FUSION_CAPS.subtypes, `subtypes capped at ${FUSION_CAPS.subtypes}`);
  ok(a.attunement.length <= FUSION_CAPS.attunement, `attunements capped at ${FUSION_CAPS.attunement}`);
  ok((a.anatomy ?? []).length <= FUSION_CAPS.factors, `factors capped at ${FUSION_CAPS.factors}`);
  ok(new Set(a.subtypes).size === a.subtypes.length, 'subtypes de-duplicated');
}

console.log('Attunement legality repair:');
{
  // Warrior cannot take Shadow/Fire — the merge must repair to a legal combo.
  const shady = { ...VOLTFANG, attunement: ['Shadow'] };
  const a = fuseAxes(IRONHIDE, shady);
  ok(attunementComboLegal(['Warrior'], a.attunement), `repaired to a legal combo (${a.attunement})`);
  const b = fuseAxes(VOLTFANG, shady);
  ok(b.attunement.includes('Shadow'), 'no archetype → no legality constraint, Shadow survives');
  ok(fuseAxes({ ...VOLTFANG, attunement: [] }, { ...MAW, attunement: [] }).attunement.length === 1,
    'attunement-less parents still yield one element');
}

console.log('Fusion Power card (prefix=element, suffix=shape; order-sensitive):');
{
  const card = fusionPowerCard(IRONHIDE, VOLTFANG);
  eq(validateCard(card), [], `fusion card is a valid CardSpec (${card.name})`);
  ok(card.fusionPower === true, 'flagged as a fusion power');
  ok(card.effects.length > 0, 'does something');
  ok(card.rarity === 'rare', 'fusion powers are rare');
  const again = fusionPowerCard(IRONHIDE, VOLTFANG);
  eq(again.name, card.name, 'deterministic for the same ordered pair');
  const flipped = fusionPowerCard(VOLTFANG, IRONHIDE);
  ok(flipped.name !== card.name || flipped.attunement !== card.attunement,
    'ORDER MATTERS — reversing the pair changes the power');
  // every pairing across the fixtures must produce a legal card
  const all = [IRONHIDE, VOLTFANG, MAW];
  let n = 0;
  for (const p of all) for (const s of all) {
    if (p === s) continue;
    const c = fusionPowerCard(p, s);
    eq(validateCard(c), [], `${p.name}>${s.name} power valid`);
    n++;
  }
  ok(n === 6, 'covered every ordered pairing');
}

console.log('Whole fusion — stats + deck fall out of the merged axes:');
{
  const fused = fuseCreatures(IRONHIDE, VOLTFANG, { pool: [] });
  eq(fused.name, 'Ironfang', 'named by portmanteau');
  ok(fused.maxHp > 0, 'has HP');
  ok(fused.deck.length > 0, 'has a playable deck (starterDeck guarantees strike+defend)');
  ok(fused.deck.some((c) => c.name === fused.fusion.power.name), 'the Fusion Power is IN the starting deck');
  ok(fused.fusion.primary === 'ironhide' && fused.fusion.secondary === 'voltfang', 'records its parents');
  eq(fused.signatureCards.length, 1, 'the power is its signature card');

  // stats must equal statProfile over the merged kits+factors — i.e. free, not bespoke
  const expect = statProfile({ kits: ['Warrior', 'Mammalian'], factors: [...fused.weapons, ...fused.anatomy] });
  eq(fused.stats.might, expect.stats.might, 'might is the pure axis composition');
  eq(fused.stats.eva, expect.stats.eva, 'evasion is the pure axis composition');

  // the blend should sit between the parents, not clone one of them
  const solo = statProfile({ kits: ['Warrior'], factors: ['Hammer', 'Shield'] });
  ok(fused.stats.eva > solo.stats.eva, 'beast agility pulls evasion up from the pure warrior');
}
{
  const fused = fuseCreatures(MAW, VOLTFANG, { pool: [] });
  ok(fused.manifestation === 'Eldritch', 'manifestation carried onto the creature');
  ok(fused.class == null, 'instinctive fusion carries no archetype');
  ok(fused.maxHp > 0 && fused.deck.length > 0, 'aberration fusion is playable');
}
{ // determinism + order-sensitivity end to end
  const x = fuseCreatures(IRONHIDE, MAW, { pool: [] });
  const y = fuseCreatures(IRONHIDE, MAW, { pool: [] });
  eq(x.id, y.id, 'same pair → same id (deterministic, cacheable)');
  const z = fuseCreatures(MAW, IRONHIDE, { pool: [] });
  ok(z.id !== x.id, 'reversed pair → a DIFFERENT creature');
  ok(z.name !== x.name, 'reversed pair → a different name');
}
{ // every ordered pairing of the fixtures must produce a playable creature
  const all = [IRONHIDE, VOLTFANG, MAW];
  let n = 0;
  for (const p of all) for (const s of all) {
    if (p === s) continue;
    const f = fuseCreatures(p, s, { pool: [] });
    ok(f.maxHp > 0 && f.deck.length > 0 && !!f.name, `${p.name}>${s.name} is playable`);
    n++;
  }
  ok(n === 6, 'seamless across every ordered pairing');
}
console.log('Deck composition regressions:');
{
  // REGRESSION: an "Aegis"-shaped power carries BOTH a damage and a block op. If it
  // leads the pool, starterDeck adopts it as strikeBase AND defendBase and clones it
  // into all six basic slots (observed: 6× "Hollow Aegis").
  const kit = [
    { id: 'k_str', name: 'Kit Strike', attunement: 'Physical', type: 'attack', cost: 1, rarity: 'basic', effects: [{ op: 'damage', value: 6 }] },
    { id: 'k_def', name: 'Kit Guard', attunement: 'Physical', type: 'skill', cost: 1, rarity: 'basic', effects: [{ op: 'block', value: 5 }] },
    { id: 'k_c1', name: 'Kit Common', attunement: 'Physical', type: 'attack', cost: 1, rarity: 'common', effects: [{ op: 'damage', value: 8 }] },
  ];
  const f = fuseCreatures(IRONHIDE, VOLTFANG, { pool: kit });
  const powerName = f.fusion.power.name;
  const copies = f.deck.filter((c) => c.name === powerName).length;
  eq(copies, 1, `Fusion Power appears EXACTLY once (got ${copies})`);
  ok(f.deck.some((c) => c.name === 'Kit Strike'), 'the power did not hijack the Strike slot');
  ok(f.deck.some((c) => c.name === 'Kit Guard'), 'the power did not hijack the Defend slot');
}
{
  // REGRESSION: the power is `rare`, and starterDeck's signature slots only accept
  // `common` — so in a large pool it silently vanished from the opening hand.
  const big = Array.from({ length: 40 }, (_, i) => ({
    id: `big_${i}`, name: `Filler ${i}`, attunement: 'Physical', type: 'attack',
    cost: 1, rarity: i < 4 ? 'basic' : 'common', effects: [{ op: i % 2 ? 'block' : 'damage', value: 6 }],
  }));
  const f = fuseCreatures(IRONHIDE, VOLTFANG, { pool: big });
  eq(f.deck.filter((c) => c.name === f.fusion.power.name).length, 1,
    'a large pool cannot crowd the Fusion Power out of the deck');
  ok(f.deck.length <= 10, 'deck still respects its size cap');
}
{
  // Both movesets: interleaving the PARENT pools must surface cards from each.
  const poolA = Array.from({ length: 8 }, (_, i) => ({
    id: `a_${i}`, name: `Alpha ${i}`, attunement: 'Physical', type: 'attack',
    cost: 1, rarity: i === 0 ? 'basic' : 'common', effects: [{ op: 'damage', value: 6 }],
  }));
  const poolB = Array.from({ length: 8 }, (_, i) => ({
    id: `b_${i}`, name: `Beta ${i}`, attunement: 'Physical', type: 'skill',
    cost: 1, rarity: i === 0 ? 'basic' : 'common', effects: [{ op: 'block', value: 5 }],
  }));
  const f = fuseCreatures(IRONHIDE, VOLTFANG, { primaryPool: poolA, secondaryPool: poolB });
  const names = f.deck.map((c) => c.name).join(' ');
  ok(/Alpha/.test(names), 'primary parent contributes cards');
  ok(/Beta/.test(names), 'secondary parent contributes cards (both movesets)');
}

{ // self-fusion is degenerate but must not explode
  const f = fuseCreatures(VOLTFANG, VOLTFANG, { pool: [] });
  ok(f.maxHp > 0 && f.deck.length > 0, 'self-fusion still yields a valid creature');
  eq(f.biology, ['Beast'], 'self-fusion does not duplicate the body type');
}

console.log(`fuse: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
