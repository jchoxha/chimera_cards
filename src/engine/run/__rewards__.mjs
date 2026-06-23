// Smoke test for the party-pool reward drafter. Run: npm run test:rewards
import { draftRunReward, dedupePool } from './rewards.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const pool = [
  { id: 'basic1', rarity: 'basic', name: 'B1' }, { id: 'basic2', rarity: 'basic', name: 'B2' },
  { id: 'c1', rarity: 'common', name: 'C1' }, { id: 'c1#3', rarity: 'common', name: 'C1' }, // dup base id
  { id: 'c2', rarity: 'common', name: 'C2' }, { id: 'u1', rarity: 'uncommon', name: 'U1' },
  { id: 'r1', rarity: 'rare', name: 'R1' }, { id: 'e1', rarity: 'epic', name: 'E1' },
];
let seed = 1; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

console.log('dedupePool collapses #n copies by base id:');
ok(dedupePool(pool).filter((c) => c.id === 'c1').length === 1, 'c1 appears once after dedupe');

console.log('draftRunReward:');
const r = draftRunReward(pool, 3, rng);
ok(r.length === 3, `drafts 3 cards (${r.length})`);
ok(r.every((c) => c.rarity !== 'basic'), 'never offers basic cards');
ok(new Set(r.map((c) => c.id)).size === 3, 'offers distinct cards');
ok(draftRunReward([], 3, rng).length === 0, 'empty pool → no rewards (no crash)');
ok(draftRunReward([{ id: 'x', rarity: 'common' }], 3, rng).length === 1, "can't offer more than the pool has");

console.log(`\nrewards: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
