// Smoke test for the rarity-weighted deck budget. Run: node src/engine/deck/__budget__.mjs
// (also: npm run test:deck)

import {
  cardCost, deckCost, deckSize, canAdd, validateDeck, indexPool, expandDeck, deckToCounts,
  budgetForTier, PER_CARD_CAP,
} from './budget.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const pool = [
  { id: 'strike', name: 'Strike', rarity: 'basic' },
  { id: 'cleave', name: 'Cleave', rarity: 'common' },
  { id: 'meteor', name: 'Meteor', rarity: 'rare' },
  { id: 'godcard', name: 'Godcard', rarity: 'godly' },
];
const idx = indexPool(pool);

console.log('Card cost by rarity ladder:');
ok(cardCost(pool[0]) === 0, 'basic costs 0');
ok(cardCost(pool[1]) === 1, 'common costs 1');
ok(cardCost(pool[2]) === 3, 'rare costs 3');
ok(cardCost(pool[3]) === 7, 'godly costs 7');
ok(cardCost({ rarity: 'mystery' }) === 1, 'unknown rarity → common cost');

console.log('Deck cost + size:');
const counts = { strike: 4, cleave: 3, meteor: 1 }; // 0 + 3 + 3 = 6 pts, 8 cards
ok(deckCost(counts, idx) === 6, `deckCost sums by rarity (${deckCost(counts, idx)})`);
ok(deckSize(counts) === 8, `deckSize counts copies (${deckSize(counts)})`);

console.log('canAdd respects budget / per-card cap / sandbox:');
ok(canAdd({ strike: 4 }, pool[0], idx, {}).ok === false, 'cannot exceed per-card cap (4 basics)');
ok(canAdd({ meteor: 7 }, pool[1], idx, { budget: 21 }).ok === false, 'cannot exceed budget');
ok(canAdd({ meteor: 7 }, pool[1], idx, { budget: 21, sandbox: true }).ok === true, 'sandbox ignores budget');
ok(canAdd({}, pool[0], idx, { budget: 0 }).ok === true, 'a free basic fits a 0 budget');

console.log('validateDeck:');
ok(validateDeck({ cleave: 2 }, idx, { budget: 24, minSize: 5 }).ok === false, 'flags under min size');
ok(validateDeck({ godcard: 5 }, idx, { budget: 24, perCardCap: PER_CARD_CAP }).errors.length >= 2, 'flags over-budget AND over-cap');
ok(validateDeck({ strike: 4, cleave: 2 }, idx, { budget: 24 }).ok === true, 'a legal deck validates');
ok(validateDeck({ godcard: 6 }, idx, { sandbox: true, minSize: 5 }).ok === true, 'sandbox skips budget/cap (min size still met)');

console.log('expandDeck → unique instance ids; deckToCounts round-trips:');
const deck = expandDeck({ strike: 2, meteor: 1 }, idx);
ok(deck.length === 3, 'expands to the right card count');
ok(new Set(deck.map((c) => c.id)).size === 3, 'every copy gets a unique id');
ok(deck.every((c) => c.id.includes('#')), 'instance ids use baseId#n');
const round = deckToCounts(deck);
ok(round.strike === 2 && round.meteor === 1, 'deckToCounts collapses instance ids back to base counts');

console.log('budgetForTier scales with rarity:');
ok(budgetForTier('common') < budgetForTier('godly'), 'higher tier → bigger budget');

console.log(`\ndeck-budget: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
