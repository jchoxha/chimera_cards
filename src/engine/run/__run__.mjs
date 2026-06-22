// Smoke test for the run-layer spine: state + ActionManager (queue + undo) +
// seeded RNG + save/load. Run: node src/engine/run/__run__.mjs  (npm run test:run)

import { createRunState, createRun } from './state.js';
import { RunManager } from './RunManager.js';
import { makeRng, hashSeed } from './rng.js';
import { reachableFrom, currentNode } from './map.js';
import { partyToFighters, startRunCombat, combatOutcome } from './combatBridge.js';
import { createFighter } from '../combat/state.js';

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

console.log('Act map generates deterministically (linear, boss last):');
{
  const a = createRun({ party: baseParty, seed: 'spire', floors: 10 });
  const b = createRun({ party: baseParty, seed: 'spire', floors: 10 });
  ok(a.map.nodes.length === 10, 'act has 10 floors');
  ok(a.map.nodes[0].type === 'combat' && a.map.nodes[9].type === 'boss' && a.map.nodes[8].type === 'rest', 'opens on combat, rest then boss at the end');
  ok(a.map.nodes.map((n) => n.type).join() === b.map.nodes.map((n) => n.type).join(), 'same seed → identical act');
  const c = createRun({ party: baseParty, seed: 'other', floors: 10 });
  ok(a.map.nodes.map((n) => n.type).join() !== c.map.nodes.map((n) => n.type).join(), 'different seed → different act');
  ok(a.position === a.map.start && a.rngState !== a.seed, 'position = start; rngState advanced past map gen');
}

console.log('Navigation: travel only to reachable nodes, marks visited:');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 5, floors: 6 }));
  const start = rm.state.position;
  const next = reachableFrom(rm.state.map, start)[0];
  rm.dispatch('travel', { nodeId: 'a1-f5' }); // not reachable from start
  ok(rm.state.position === start, 'cannot jump to a far node');
  rm.dispatch('travel', { nodeId: next });
  ok(rm.state.position === next && currentNode(rm.state).visited, 'traveled to the next node, marked visited');
  rm.undo();
  ok(rm.state.position === start, 'undo returns to the previous node');
}

console.log('Combat bridge: build fighters from the run party + fold the result back:');
{
  const rm = new RunManager(createRun({
    party: [
      { id: 'war', name: 'Warrior', attunement: ['Physical'], maxHp: 60, stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 },
        deck: [{ id: 'strike', name: 'Strike', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 6 }] }] },
      { id: 'mage', name: 'Mage', attunement: ['Fire'], maxHp: 40, deck: [{ id: 'bolt', name: 'Bolt', type: 'attack', cost: 1, attunement: 'Fire', effects: [{ op: 'damage', value: 5 }] }] },
    ],
    seed: 9, floors: 6,
  }));
  rm.state.party[0].hp = 45; // simulate prior damage carried in

  const fighters = partyToFighters(rm.state.party);
  ok(fighters.length === 2 && fighters[0].deck.drawPile.length === 1, 'fighters built from party w/ their decks');
  ok(fighters[0].hp === 45 && fighters[0].stats.might === 1 && fighters[0].attunement[0] === 'Physical', 'carries HP/stats/attunement');

  const foe = createFighter({ id: 'foe', name: 'Dummy', hp: 40, maxHp: 40 });
  const vm = startRunCombat(rm.state, [foe]);
  ok(vm.state.phase === 'player', 'combat started in player phase');

  // Simulate combat ending: damage the warrior, kill the mage, player wins.
  vm.state.player.fighters[0].hp = 38;
  vm.state.player.fighters[1].hp = 0;
  vm.state.phase = 'victory';
  const out = combatOutcome(vm);
  ok(out.won === true && out.hpById.war === 38 && out.hpById.mage === 0, 'outcome reports win + per-member HP');

  rm.dispatch('applyCombatResult', out);
  ok(rm.state.party[0].hp === 38 && rm.state.party[1].hp === 0, 'HP folded back into the run party');
  ok(rm.state.status === 'active', 'win keeps the run active');
}

console.log('Defeat folds back as a lost run:');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 3, floors: 6 }));
  rm.dispatch('applyCombatResult', { won: false, hpById: { war: 0 } });
  ok(rm.state.party[0].hp === 0 && rm.state.status === 'lost', 'defeat → party HP 0, run lost');
}

console.log(`\nrun: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
