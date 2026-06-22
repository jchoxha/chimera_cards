// Throwaway smoke test: node src/engine/__smoke__.mjs
import { GameEngine, createRarityState, rollRarity, currentRareChance, PHASES } from './index.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

// Deterministic RNG (LCG) for reproducibility.
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

console.log('Pity-offset engine:');
{
  const st = createRarityState(false);
  ok(Math.abs(st.offset + 0.05) < 1e-9, 'starts at -5% offset');
  ok(currentRareChance(st, 'combat') === 0, 'combat rare chance clamps to 0 (3% + -5% < 0)');
  // Force misses with rng that never triggers a rare (returns ~0.99).
  const miss = () => 0.99;
  for (let i = 0; i < 10; i++) rollRarity(st, 'combat', miss);
  ok(st.offset > -0.05, 'offset climbs after misses');
  ok(st.offset <= 0.40, 'offset respects +40% cap');
  // Force a rare with rng that always triggers (returns 0).
  const r = rollRarity(st, 'combat', () => 0);
  ok(r === 'rare', 'rare rolls when chance is met');
  ok(Math.abs(st.offset + 0.05) < 1e-9, 'offset resets to -5% on rare');
  // Boss is always rare-or-better (now distributed across the 7-tier ladder, §14.7).
  const HIGH = ['rare', 'epic', 'mythic', 'legendary', 'godly'];
  ok(HIGH.includes(rollRarity(createRarityState(), 'boss', () => 0.999)), 'boss room always rare-or-better');
}

console.log('Combat turn cycle:');
{
  const card = (id, fx, extra = {}) => ({ id, name: id, cardType: 'attack', rarity: 'basic', cost: 1, element: 'pyre', effects: fx, ...extra });
  const monster = {
    id: 'm1', name: 'Cindermouse',
    types: [{ type: 'pyre', weight: 0.66 }, { type: 'beast', weight: 0.34 }],
    hp: 30, maxHp: 30,
    signatureCards: [
      card('scorch', { dmg: 8, applyStatus: { burn: 2 } }),
      card('guard', { block: 5 }, { cardType: 'skill' }),
      card('flare', { dmg: 14 }, { cost: 2 }),
      card('jab', { dmg: 5 }),
      card('bash', { dmg: 6 }),
    ],
  };
  const enemy = { id: 'e1', name: 'Dummy', hp: 40, maxHp: 40, block: 0, statuses: [], intent: null };
  const enemyAI = () => ({ kind: 'attack', value: 6, hits: 1 });

  const events = [];
  const game = new GameEngine({
    party: [monster], enemyAI, rng: lcg(42),
    pickCard: (rarity, type) => card(`reward-${rarity}-${type}`, { dmg: 7 }, { rarity }),
  });
  const cm = game.startCombat({ enemies: [enemy], room: 'combat', log: (e) => events.push(e) });
  const s = cm.state;

  ok(s.phase === PHASES.PLAYER, 'reaches player phase after start');
  ok(s.energy === 3, 'energy refilled to 3');
  ok(s.hand.length === 5, 'drew a 5-card hand');
  ok(enemy.intent && enemy.intent.kind === 'attack', 'enemy intent telegraphed');

  const scorch = s.hand.find((c) => c.id === 'scorch');
  const played = cm.playCard(scorch, { enemyId: 'e1' });
  ok(played === true, 'played a card');
  ok(s.energy === 2, 'energy decremented by cost');
  ok(enemy.hp === 32, 'enemy took 8 damage (40→32)');
  ok(enemy.statuses.some((x) => x.id === 'burn' && x.amount === 2), 'burn applied');

  const hpBefore = monster.hp;
  cm.endPlayerTurn();
  ok(monster.hp === hpBefore - 6, 'enemy dealt 6 to active monster on its turn');
  ok(s.turn === 2, 'advanced to turn 2');
  ok(s.energy === 3, 'energy refilled next turn');

  // Burn ticked on the enemy at the start of its turn (during endPlayerTurn→enemyTurn): 32 - 2 = 30
  ok(enemy.hp === 30, 'enemy burn ticked for 2 (32→30)');

  const reward = cm.generateReward(3);
  ok(reward.length === 3, 'generated a 3-card reward');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
