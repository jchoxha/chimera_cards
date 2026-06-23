// Smoke test for the run-layer spine: state + ActionManager (queue + undo) +
// seeded RNG + save/load. Run: node src/engine/run/__run__.mjs  (npm run test:run)

import { createRunState, createRun, starterDeck } from './state.js';
import { RunManager } from './RunManager.js';
import { makeRng, hashSeed } from './rng.js';
import { reachableFrom, currentNode } from './map.js';
import { partyToFighters, startRunCombat, combatOutcome } from './combatBridge.js';
import { createFighter } from '../combat/state.js';
import { RELICS, POTIONS } from './content.js';

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
  ok(a.map.nodes[0].type === 'start' && a.map.nodes[1].type === 'combat' && a.map.nodes[9].type === 'boss' && a.map.nodes[8].type === 'rest', 'start → combat … rest → boss');
  ok(a.map.nodes.map((n) => n.type).join() === b.map.nodes.map((n) => n.type).join(), 'same seed → identical act');
  const c = createRun({ party: baseParty, seed: 'other', floors: 10 });
  ok(a.map.nodes.map((n) => n.type).join() !== c.map.nodes.map((n) => n.type).join(), 'different seed → different act');
  ok(a.position === a.map.start && a.rngState !== a.seed, 'position = start; rngState advanced past map gen');
}

console.log('Navigation: travel only to reachable nodes; combat nodes commit on win:');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 5, floors: 6 }));
  const start = rm.state.position;
  const next = reachableFrom(rm.state.map, start)[0];
  rm.dispatch('travel', { nodeId: 'a1-f5' }); // not reachable from start
  ok(rm.state.position === start, 'cannot jump to a far node');
  rm.dispatch('travel', { nodeId: next });
  const node = currentNode(rm.state);
  ok(rm.state.position === next, 'traveled to the next node');
  const isCombat = ['combat', 'elite', 'boss'].includes(node.type);
  // Combat nodes are NOT visited on arrival (so an abandoned fight re-enters on
  // resume); non-combat rooms are marked visited immediately.
  ok(node.visited === !isCombat, `arrival visited = ${!isCombat} for a ${node.type} node`);
  rm.dispatch('markVisited', {});
  ok(currentNode(rm.state).visited, 'markVisited commits the node (combat won)');
  rm.undo();
  ok(rm.state.position === next, 'undo reverts the markVisited (still at the node)');
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

console.log('Card reward → deck (offer / choose / skip):');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 2, floors: 6 }));
  const offered = [
    { id: 'cleave', name: 'Cleave', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 8 }] },
    { id: 'guard', name: 'Guard', type: 'skill', cost: 1, attunement: 'Physical', effects: [{ op: 'block', value: 5 }] },
  ];
  rm.dispatch('offerReward', { cards: offered, rngState: 12345 });
  ok(rm.state.pendingReward.length === 2 && rm.state.rngState === 12345, 'offerReward stores offer + advances rng');
  rm.dispatch('chooseReward', { memberId: 'war', card: offered[0] });
  ok(rm.state.party[0].deck.some((c) => c.id === 'cleave') && rm.state.pendingReward === null, 'chosen card added; offer cleared');

  rm.dispatch('offerReward', { cards: offered });
  rm.dispatch('skipReward');
  ok(rm.state.pendingReward === null && rm.state.party[0].deck.filter((c) => c.id === 'guard').length === 0, 'skip clears offer, adds nothing');
}

console.log('Card upgrade (explicit patch + the card\'s own upgrade payload):');
{
  const rm = new RunManager(createRun({
    party: [{ id: 'war', name: 'W', attunement: ['Physical'], maxHp: 60, deck: [
      { id: 'strike', name: 'Strike', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 6 }], upgrade: { effects: [{ op: 'damage', value: 9 }] } },
    ] }],
    seed: 1, floors: 6,
  }));
  rm.dispatch('upgradeCard', { memberId: 'war', cardId: 'strike' }); // uses the card's own `upgrade`
  const c = rm.state.party[0].deck[0];
  ok(c.upgraded === true && c.effects[0].value === 9 && c.name === 'Strike+', 'upgrade applied own payload + renamed to Strike+');
  rm.dispatch('upgradeCard', { memberId: 'war', cardId: 'strike' });
  ok(rm.state.party[0].deck[0].name === 'Strike+', 'already-upgraded card is not upgraded twice');
}

console.log('Shop: buy actions gate on gold (atomic):');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 4, floors: 6 }));
  rm.dispatch('gainGold', { amount: 100 });
  rm.dispatch('buyRelic', { relic: RELICS[0], cost: 60 });
  ok(rm.state.gold === 40 && rm.state.relics.length === 1, 'buyRelic spent 60, relic added');
  rm.dispatch('buyRelic', { relic: RELICS[1], cost: 90 }); // can't afford
  ok(rm.state.gold === 40 && rm.state.relics.length === 1, 'unaffordable buy is a no-op');
  rm.dispatch('buyPotion', { potion: POTIONS[0], cost: 40 });
  ok(rm.state.gold === 0 && rm.state.potions.length === 1, 'buyPotion spent 40');
  rm.dispatch('buyRelic', { relic: RELICS[0], cost: 0 }); // duplicate relic
  ok(rm.state.relics.length === 1, 'duplicate relic not added');
}

console.log('Relics inject onCombatStart effects onto the Vanguard:');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 4, floors: 6 }));
  rm.dispatch('addRelic', { relic: RELICS[0] }); // Iron Brand → +6 Block
  rm.dispatch('addRelic', { relic: RELICS[1] }); // War Totem → +2 Strength
  const foe = createFighter({ id: 'foe', name: 'Dummy', hp: 40, maxHp: 40 });
  const vm = startRunCombat(rm.state, [foe]);
  const v = vm.state.player.fighters[vm.state.player.vanguardIndex];
  ok(v.block === 6, `Iron Brand → 6 Block at combat start (got ${v.block})`);
  ok(v.statuses.find((x) => x.id === 'strength')?.amount === 2, 'War Totem → 2 Strength at combat start');
}

console.log('Potions resolve in combat via useConsumable:');
{
  const rm = new RunManager(createRun({ party: baseParty, seed: 4, floors: 6 }));
  const foe = createFighter({ id: 'foe', name: 'Dummy', hp: 40, maxHp: 40 });
  const vm = startRunCombat(rm.state, [foe]);
  ok(vm.useConsumable(POTIONS[1]) === true && vm.state.enemy.fighters[0].hp === 28, 'Fire Flask dealt 12 to the foe');
  const v = vm.state.player.fighters[vm.state.player.vanguardIndex];
  vm.useConsumable(POTIONS[2]); // Block Potion → 12 block
  ok(v.block === 12, 'Block Potion gave 12 Block');
}

console.log('Starter deck is capped at 10 with unique instance ids:');
{
  const pool = [
    { id: 'strike', name: 'Strike', rarity: 'basic', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 6 }] },
    { id: 'guard', name: 'Guard', rarity: 'basic', type: 'skill', cost: 1, attunement: 'Physical', effects: [{ op: 'block', value: 5 }] },
    { id: 'cleave', name: 'Cleave', rarity: 'common', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 8 }] },
    { id: 'pommel', name: 'Pommel', rarity: 'common', type: 'attack', cost: 1, attunement: 'Physical', effects: [{ op: 'damage', value: 7 }] },
    { id: 'rare1', name: 'Rare', rarity: 'rare', type: 'attack', cost: 2, attunement: 'Physical', effects: [{ op: 'damage', value: 20 }] },
  ];
  const deck = starterDeck(pool, 10);
  ok(deck.length === 10, `starter deck capped at 10 (got ${deck.length})`);
  ok(deck.filter((c) => c.id.startsWith('strike#')).length === 4, '4 copies of each basic (Strike)');
  ok(new Set(deck.map((c) => c.id)).size === 10, 'all 10 instance ids are unique');
  ok(!deck.some((c) => c.id.startsWith('rare')), 'rares excluded from the starter');
}

console.log(`\nrun: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
