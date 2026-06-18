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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
