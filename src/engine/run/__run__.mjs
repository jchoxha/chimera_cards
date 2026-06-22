// Smoke test for the run-layer spine: state + ActionManager (queue + undo) +
// seeded RNG + save/load. Run: node src/engine/run/__run__.mjs  (npm run test:run)

import { createRunState } from './state.js';
import { RunManager } from './RunManager.js';
import { makeRng, hashSeed } from './rng.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const baseParty = [{ id: 'war', name: 'Warrior', attunement: ['Physical'], maxHp: 60, deck: [{ id: 'strike', name: 'Strike', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 6 }] }] }];

console.log('Run state boots serializable:');
{
  const s = createRunState({ party: baseParty, seed: 'alpha' });
  ok(s.party.length === 1 && s.party[0].hp === 60, 'party seeded with hp = maxHp');
  ok(s.gold === 0 && s.status === 'active', 'gold 0, status active');
  ok(JSON.parse(JSON.stringify(s)).seed === s.seed, 'state is JSON-serializable');
}

console.log('Actions mutate via the manager:');
{
  const rm = new RunManager(createRunState({ party: baseParty, seed: 1 }));
  rm.dispatch('gainGold', { amount: 50 });
  ok(rm.state.gold === 50, 'gainGold → 50');
  rm.dispatch('spendGold', { amount: 30 });
  ok(rm.state.gold === 20, 'spendGold → 20');
  rm.dispatch('addCardToDeck', { memberId: 'war', card: { id: 'cleave', name: 'Cleave', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 8 }] } });
  ok(rm.state.party[0].deck.length === 2, 'card added to deck');
  rm.dispatch('upgradeCard', { memberId: 'war', cardId: 'strike', patch: { effects: [{ op: 'damage', value: 9 }] } });
  ok(rm.state.party[0].deck.find((c) => c.id === 'strike').upgraded === true, 'card upgraded');
}

console.log('Undo / redo restore prior snapshots:');
{
  const rm = new RunManager(createRunState({ party: baseParty, seed: 1 }));
  rm.dispatch('gainGold', { amount: 100 });
  rm.dispatch('spendGold', { amount: 40 });
  ok(rm.state.gold === 60, 'state at gold 60');
  rm.undo();
  ok(rm.state.gold === 100, 'undo → 100');
  rm.undo();
  ok(rm.state.gold === 0, 'undo → 0 (initial)');
  rm.redo();
  ok(rm.state.gold === 100, 'redo → 100');
  rm.dispatch('gainGold', { amount: 5 });
  ok(rm.state.gold === 105 && !rm.canRedo(), 'new action clears the redo stack');
}

console.log('Undo does not leak mutations into past snapshots (immutability):');
{
  const rm = new RunManager(createRunState({ party: baseParty, seed: 1 }));
  rm.dispatch('gainGold', { amount: 10 });
  rm.dispatch('addCardToDeck', { memberId: 'war', card: { id: 'x', name: 'X', type: 'skill', cost: 1, attunement: 'Physical', effects: [{ op: 'block', value: 5 }] } });
  rm.undo(); // back to 1-card deck
  ok(rm.state.party[0].deck.length === 1, 'undo restored the 1-card deck (no shared mutation)');
}

console.log('Seeded RNG is deterministic and reproducible from saved state:');
{
  const a = makeRng(hashSeed('alpha')); const b = makeRng(hashSeed('alpha'));
  ok(a.next() === b.next() && a.next() === b.next(), 'same seed → same sequence');
  const r = makeRng(123); r.next(); r.next(); const mid = r.state;
  const r2 = makeRng(mid);
  ok(r.next() === r2.next(), 'rng resumes deterministically from a saved state int');
}

console.log('Save / load roundtrip:');
{
  const rm = new RunManager(createRunState({ party: baseParty, seed: 7 }));
  rm.dispatch('gainGold', { amount: 42 });
  rm.dispatch('healParty', { pct: 0.5 });
  const json = rm.serialize();
  const rm2 = RunManager.deserialize(json);
  ok(rm2.state.gold === 42 && rm2.state.seed === 7, 'restored gold + seed');
  ok(JSON.stringify(rm2.state) === json, 'restored state matches serialized');
}

console.log(`\nrun: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
