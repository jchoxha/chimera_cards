// Turn-behavior smoke tests for the Vanguard/Peek engine (spec §9).
// Run: node src/engine/combat/__turn__.mjs   (also: npm run test:turn)
//
// Layer 1 (foundation): per-fighter deck ops + scope resolution + the effect
// engine (damage/block/heal/status). No manager loop yet — that arrives in the
// next layer. Tests are deterministic (no RNG dependence here).

import {
  createCombatState,
  drawCards, drawFreshHand, discardCard, discardWholeHand, deckTotal,
  resolveScope, applyCardEffects, computeAttackDamage,
  vanguard, benchFighters, livingFighters,
  TARGET_SCOPES,
  VanguardManager,
  createPlannedAction,
} from '../index.js';
import { sampleFighters, CARDS, makeFighter, makeCard } from './fixtures.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

function freshState() {
  const f = sampleFighters();
  return createCombatState({ playerFighters: f.player, enemyFighters: f.enemy });
}

console.log('Deck ops (per-fighter):');
{
  const f = makeFighter({ id: 'd', name: 'D', cards: [CARDS.strike, CARDS.guard, CARDS.mend] });
  const before = deckTotal(f);
  drawCards(f, 2, seq([0]));            // deterministic shuffle pick
  ok(f.hand.length === 2, 'drawCards pulls 2 into hand');
  ok(deckTotal(f) === before, 'deckTotal conserved across a draw');
  discardCard(f, f.hand[0]);
  ok(f.deck.discardPile.length === 1 && f.hand.length === 1, 'discardCard moves hand→discard');

  const g = makeFighter({ id: 'g', name: 'G', cards: [CARDS.strike, CARDS.guard, CARDS.mend, CARDS.rally] });
  drawFreshHand(g, 3, seq([0]));
  ok(g.hand.length === 3, 'drawFreshHand draws to hand size');
  const dumped = discardWholeHand(g);
  ok(dumped.length === 3 && g.hand.length === 0 && g.deck.discardPile.length === 3,
    'discardWholeHand dumps the entire hand (swap-out, ignores Retain)');

  // reshuffle when draw pile empties
  const h = makeFighter({ id: 'h', name: 'H', cards: [CARDS.strike, CARDS.guard] });
  drawCards(h, 2, seq([0]));
  discardCard(h, h.hand[0]); discardCard(h, h.hand[0]);
  const drawn = drawCards(h, 1, seq([0])); // draw pile empty → reshuffle from discard
  ok(drawn.length === 1, 'drawCards reshuffles discard when draw pile empties');
}

console.log('\nScope resolution (18 tokens resolve to living Fighters):');
{
  const s = freshState();
  const caster = vanguard(s.player); // hero
  // single-target enemy vanguard
  ok(resolveScope(s, 'player', caster, 'enemyActiveTarget')[0]?.id === 'grunt',
    'enemyActiveTarget → enemy Vanguard (grunt)');
  // self
  ok(resolveScope(s, 'player', caster, 'selfOnlyTarget')[0] === caster, 'selfOnlyTarget → caster');
  // whole enemy side
  ok(resolveScope(s, 'player', caster, 'wholeEnemySide').length === 2, 'wholeEnemySide → both enemies');
  // enemy bench only (single) → brute
  ok(resolveScope(s, 'player', caster, 'enemyBenchOnlyTarget')[0]?.id === 'brute',
    'enemyBenchOnlyTarget → benched enemy (brute)');
  // wholeField → all 4 living
  ok(resolveScope(s, 'player', caster, 'wholeField').length === 4, 'wholeField → all 4 units');
  // otherFriendlySide excludes the caster
  const others = resolveScope(s, 'player', caster, 'otherFriendlySide');
  ok(others.length === 1 && others[0].id === 'medic', 'otherFriendlySide excludes the caster');
  // targetId honored for flex
  ok(resolveScope(s, 'player', caster, 'flexEnemyTarget', { targetId: 'brute' })[0]?.id === 'brute',
    'flexEnemyTarget honors a chosen targetId');
  // every locked token resolves without throwing
  let okCount = 0;
  for (const sc of TARGET_SCOPES) { try { resolveScope(s, 'player', caster, sc, { targetId: 'grunt' }); okCount++; } catch { /* */ } }
  ok(okCount === TARGET_SCOPES.length, 'all 18 tokens resolve without throwing');
  // dead fighters are never targeted
  s.enemy.fighters[0].hp = 0;
  ok(resolveScope(s, 'player', caster, 'wholeEnemySide').length === 1, 'dead fighters excluded from scope');
}

console.log('\nDamage math (per-hit Strength/Weak/Vulnerable):');
{
  ok(computeAttackDamage(6, [{ id: 'strength', amount: 3 }], []) === 9, 'base+Strength: 6+3=9');
  ok(computeAttackDamage(6, [{ id: 'strength', amount: 3 }, { id: 'weak', amount: 1 }], []) === 6,
    'Weak ×0.75 after Strength: floor(9×0.75)=6');
  ok(computeAttackDamage(6, [], [{ id: 'vulnerable', amount: 1 }]) === 9, 'Vulnerable ×1.5: floor(6×1.5)=9');
}

console.log('\nEffect engine (applyCardEffects):');
{
  const s = freshState();
  const hero = vanguard(s.player);
  const grunt = vanguard(s.enemy);

  // Strike: 6 dmg to enemy vanguard
  applyCardEffects(s, 'player', hero, CARDS.strike.effects);
  ok(grunt.hp === 14, 'Strike deals 6 (20→14)');

  // Guard: 5 block to self
  applyCardEffects(s, 'player', hero, CARDS.guard.effects);
  ok(hero.block === 5, 'Guard grants 5 self-block');

  // Block absorbs before HP
  applyCardEffects(s, 'enemy', grunt, CARDS.strike.effects, { targetId: 'hero' });
  ok(hero.block === 0 && hero.hp === 29, 'enemy Strike: 5 block absorbs, 1 to HP (30→29)');

  // Expose: vulnerable(2) THEN 4 dmg → benefits from its own vulnerable: floor(4×1.5)=6
  const brute = benchFighters(s.enemy)[0];
  applyCardEffects(s, 'player', hero, CARDS.expose.effects, { targetId: 'grunt' });
  ok(grunt.statuses.some((x) => x.id === 'vulnerable'), 'Expose applies Vulnerable');
  ok(grunt.hp === 8, 'Expose damage uses its own Vulnerable: 14 - floor(4×1.5)=6 → 8');

  // Quake: 4 to whole enemy side
  const gruntHp = grunt.hp, bruteHp = brute.hp;
  applyCardEffects(s, 'player', hero, CARDS.quake.effects);
  ok(grunt.hp === Math.max(0, gruntHp - Math.floor(4 * 1.5)) && brute.hp === bruteHp - 4,
    'Quake hits both enemies (grunt vulnerable-boosted, brute flat)');

  // Mend: heal medic, capped at maxHp
  const medic = benchFighters(s.player)[0];
  medic.hp = 20;
  applyCardEffects(s, 'player', medic, CARDS.mend.effects, { targetId: 'medic' });
  ok(medic.hp === 24, 'Mend heals 8 but caps at maxHp (20→24)');

  // Rally: self strength
  applyCardEffects(s, 'player', hero, CARDS.rally.effects);
  ok(hero.statuses.find((x) => x.id === 'strength')?.amount === 2, 'Rally grants 2 self-Strength');

  // Bulwark: fortify slot block (escapes creature decay later)
  applyCardEffects(s, 'player', hero, CARDS.bulwark.effects);
  ok(s.player.fortifySlot.block === 6, 'Bulwark adds 6 to the fortify slot');
}

console.log('\nX-cost scaling:');
{
  const s = freshState();
  const hero = vanguard(s.player);
  const grunt = vanguard(s.enemy);
  const xStrike = makeCard({ id: 'x', cost: -1, effects: { dmg: 2, hits: 1, scope: 'enemyActiveTarget' } });
  applyCardEffects(s, 'player', hero, xStrike.effects, { costPaid: 3, xCost: true });
  ok(grunt.hp === 14, 'X-cost (3 energy) scales hits ×3: 2 dmg ×3 = 6 (20→14)');
}

console.log('\nVanguardManager (Layer 2 manager loop):');
{
  const f = sampleFighters();
  const mgr = new VanguardManager({
    playerFighters: f.player,
    enemyFighters: f.enemy,
    room: 'combat',
    rarity: { offset: -0.05, ascension7: false },
    config: { handSize: 6 },
    rng: seq([0])
  });

  // startCombat
  const s = mgr.startCombat();
  ok(s.phase === 'player', 'startCombat transitions to PLAYER phase');
  ok(s.turn === 1, 'starts on Turn 1');
  ok(s.player.energy === 3, 'player starts with 3 energy (1 benched survivor)');
  ok(s.enemyPlan.length === 2 && s.enemyPlan[0].silhouette === 'attack' && s.enemyPlan[1].silhouette === 'block', 'enemy plan generated with attacks and block');

  // play Strike
  const hero = vanguard(s.player);
  const strike = hero.hand.find((c) => c.id === 'strike');
  ok(strike != null, 'drawn hand contains Strike');
  mgr.play('strike', { targetId: 'grunt' });
  const grunt = vanguard(s.enemy);
  ok(grunt.hp === 14, 'playing Strike deals 6 dmg (20→14)');
  ok(s.player.energy === 2, 'energy spent (3→2)');
  ok(!hero.hand.includes(strike), 'played Strike left the hand');

  // apply some Block and fortify, test decays
  hero.block = 5;
  mgr.play('bulwark'); // Fortify 6 block duration 2
  ok(s.player.fortifySlot.block === 6, 'Bulwark adds 6 fortify slot block');
  ok(s.player.fortifySlot.duration === 2, 'Bulwark sets duration to 2');

  // Clear enemy plan so they don't attack, to test that fortify block escapes decay
  s.enemyPlan = [];

  // Let's add DoT and Regen to test timing
  grunt.statuses.push({ id: 'burn', amount: 3, stacking: 'intensity' });
  hero.statuses.push({ id: 'regen', amount: 4, stacking: 'duration' });

  // endTurn
  mgr.endTurn();

  ok(s.turn === 2, 'transitions to Turn 2 after round loop');
  ok(grunt.hp === 11, 'enemy DoT (Burn) ticked at player turn-end (14→11)');
  ok(grunt.statuses.find((x) => x.id === 'burn')?.amount === 2, 'enemy Burn decremented');
  ok(hero.statuses.find((x) => x.id === 'regen')?.amount === 3, 'player Regen decremented');

  // Block decays
  ok(hero.block === 0, 'creature block decays to 0 at start of own turn');
  ok(s.player.fortifySlot.block === 6, 'fortifySlot block escapes start-of-turn decay (no attack)');
  ok(s.player.fortifySlot.duration === 1, 'fortifySlot duration decremented (2→1)');

  // Now restore an enemy attack to test fortify block absorption
  s.enemyPlan = [
    createPlannedAction({
      silhouette: 'attack',
      actor: grunt.id,
      detail: { value: 6, hits: 1, targetScope: 'friendlyActiveTarget' }
    })
  ];

  mgr.endTurn(); // end Turn 2 -> runs Enemy Turn 2 -> starts Turn 3
  ok(s.turn === 3, 'transitions to Turn 3');
  ok(hero.hp === 30, 'enemy attack of 6 fully absorbed by 6 fortify block (30→30)');
  ok(s.player.fortifySlot.block === 0, 'fortifySlot block became 0 after absorbing attack + duration hit 0');

  // test death swap index update
  grunt.hp = 1;
  grunt.statuses = []; // clear weak/vuln
  mgr.play('strike', { targetId: 'grunt' });
  ok(grunt.hp === 0, 'grunt killed');
  ok(s.enemy.vanguardIndex === 1, 'enemy vanguard Index updated to next living (1, brute) on grunt death');

  // test victory/defeat check
  const brute = s.enemy.fighters[1];
  brute.hp = 1;
  mgr.play('quake'); // Quake hits whole enemy side for 4, killing brute
  ok(brute.hp === 0, 'brute killed');
  ok(s.phase === 'victory', 'combat ends in VICTORY when all enemies die');
}

console.log('\nSwaps & Displacement (Layer 3 swaps):');
{
  const f = sampleFighters();
  const windBoon = makeCard({
    id: 'windBoon',
    name: 'Wind Boon',
    swapInBoon: { strength: 1, scope: 'selfOnlyTarget' }
  });
  const galeForce = makeCard({
    id: 'galeForce',
    name: 'Gale Force',
    cost: 1,
    effects: { displacement: { chooser: 'random' }, scope: 'enemyActiveTarget' }
  });

  f.player[1].deck.drawPile.push(windBoon);
  f.player[0].deck.drawPile.push(galeForce);

  const mgr = new VanguardManager({
    playerFighters: f.player,
    enemyFighters: f.enemy,
    room: 'combat',
    rarity: { offset: -0.05, ascension7: false },
    config: { handSize: 6 },
    rng: seq([0])
  });

  const s = mgr.startCombat();
  const hero = s.player.fighters[0];
  const medic = s.player.fighters[1];

  hero.block = 8;
  
  ok(s.player.energy === 3, 'player starts with 3 energy');
  ok(s.player.vanguardIndex === 0, 'player vanguard is Hero (index 0)');

  const swapResult = mgr.swap(1);
  ok(swapResult === true, 'manual swap successful');
  ok(s.player.vanguardIndex === 1, 'vanguard updated to Medic (index 1)');
  ok(s.player.energy === 2, 'manual swap cost 1 energy (3→2)');
  ok(s.player.manualSwapsThisTurn === 1, 'manualSwapsThisTurn counter incremented to 1');

  ok(hero.block === 8, 'Hero block (8) preserved on bench after swap');

  ok(hero.hand.length === 0, 'outgoing Hero hand discarded');
  ok(medic.hand.length > 0, 'incoming Medic hand drawn');

  ok(medic.statuses.find((st) => st.id === 'strength')?.amount === 1, 'Medic swap-in boon triggered strength buff');

  const swapResult2 = mgr.swap(0);
  ok(swapResult2 === true, 'manual swap back successful');
  ok(s.player.vanguardIndex === 0, 'vanguard updated back to Hero');
  ok(s.player.energy === 0, 'escalating manual swap cost 2 energy (2→0)');
  ok(s.player.manualSwapsThisTurn === 2, 'manualSwapsThisTurn counter incremented to 2');

  s.player.energy = 2;
  const grunt = s.enemy.fighters[0];
  const brute = s.enemy.fighters[1];

  ok(s.enemyPlan.length > 0 && s.enemyPlan.every((a) => a.actor === 'grunt'), 'initial enemy plan targeted at grunt');

  hero.hand.push(galeForce);
  mgr.play('galeForce', { targetId: 'grunt' });

  ok(s.enemy.vanguardIndex === 1, 'enemy vanguard index displaced to brute (index 1)');
  ok(grunt.hand.length === 0, 'outgoing grunt hand discarded');
  ok(brute.hand.length > 0, 'incoming brute hand drawn');

  ok(s.enemyPlan.length > 0 && s.enemyPlan.every((a) => a.actor === 'brute'), 'enemy plan re-planned with brute as actor');

  brute.hp = 0;
  mgr._resolveDeaths();

  ok(s.enemy.vanguardIndex === 0, 'enemy vanguard index death-swapped back to grunt (index 0)');
  ok(s.enemyPlan.length === 0, 'dead brute plans discarded');
}

console.log('\nLayer 4: Peek charges & Version-B AI Planner:');
{
  const f = sampleFighters();
  const mgr = new VanguardManager({
    playerFighters: f.player,
    enemyFighters: f.enemy,
    room: 'combat',
    rarity: { offset: -0.05, ascension7: false },
    config: { handSize: 6, peekCharges: 3 },
    rng: seq([0])
  });

  const s = mgr.startCombat();
  
  // 1. Peek tests
  ok(s.peekCharges === 3, 'starts with 3 Peek charges');
  ok(s.enemyPlan.length > 0, 'enemy plan is generated');
  
  // Spend 1 Peek charge
  const p1 = mgr.peek(0);
  ok(p1 === true, 'peek(0) returns true');
  ok(s.enemyPlan[0].revealed === true, 'plan[0] is revealed');
  ok(s.peekCharges === 2, 'peek charges decremented to 2');

  // Peek already revealed slot
  const p2 = mgr.peek(0);
  ok(p2 === false, 'peeking already revealed slot fails/returns false');
  ok(s.peekCharges === 2, 'peek charges remains at 2');

  // Spend all remaining charges
  mgr.peek(1);
  ok(s.peekCharges === 1, 'peek charges is 1');
  const p3 = mgr.peek(1);
  ok(p3 === false, 'peeking already revealed slot fails/returns false');
  ok(s.peekCharges === 1, 'peek charges remains at 1');

  // 2. AI Lethal burst prioritization
  const hero = vanguard(s.player);
  hero.hp = 5;
  hero.block = 0;
  
  // Re-generate enemy plan
  mgr._generateEnemyPlan();
  
  ok(s.enemyPlan[0].silhouette === 'attack' && s.enemyPlan[0].detail.cardId === 'strike',
    'AI lethal burst priority selects Strike first');

  // 3. AI Type Advantage manual swap check
  hero.types = [{ type: 'flora', weight: 1.0 }];
  hero.hp = 30; // reset health to avoid lethal
  
  const brute = s.enemy.fighters[1]; // benched enemy
  brute.types = [{ type: 'pyre', weight: 1.0 }];
  brute.hp = 28;

  // Let's re-generate plan
  mgr._generateEnemyPlan();

  ok(s.enemyPlan[0].silhouette === 'swap' && s.enemyPlan[0].detail.incomingFighterId === 'brute',
    'AI plans a swap to benched unit with type advantage');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

