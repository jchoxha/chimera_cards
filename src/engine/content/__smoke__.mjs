// Throwaway: node src/engine/content/__smoke__.mjs
import { DEFAULT_MONSTERS } from '../../data/monsters.js';
import { TYPE_MOVES } from '../../data/moves.js';
import { adaptRoster, adaptMonster } from './adapt.js';
import { buildCardPool } from './cardPool.js';
import { makeEnemy, basicEnemyAI } from './enemies.js';
import { GameEngine, PHASES } from '../index.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
const lcg = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;

console.log('Content adapter:');
{
  const roster = adaptRoster(DEFAULT_MONSTERS);
  ok(roster.length === DEFAULT_MONSTERS.length, `adapted all ${roster.length} monsters`);
  ok(roster.every((m) => m.types.length >= 1 && m.types.length <= 3), 'every monster has 1–3 types');
  ok(roster.every((m) => Math.abs(m.types.reduce((s, t) => s + t.weight, 0) - 1) < 1e-9), 'type weights sum to 1');

  const dual = adaptMonster(DEFAULT_MONSTERS.find((m) => m.elements?.length === 2));
  ok(dual.types.length === 2 && dual.types[0].weight > dual.types[1].weight, 'dual-element split is dominant-weighted');

  const cind = roster.find((m) => m.name === 'Cindermouse');
  ok(cind.signatureCards.length === 3, 'Cindermouse has 3 signature cards');
  const scorch = cind.signatureCards.find((c) => c.id === 'scorch');
  ok(scorch.effects.dmg === 8 && scorch.effects.applyStatus?.burn === 2, 'scorch mapped dmg+burn into effects');
}

console.log('Card pool:');
{
  const pool = buildCardPool({ rawMonsters: DEFAULT_MONSTERS, typeMoves: TYPE_MOVES });
  ok(pool.all.length > 30, `pool built (${pool.all.length} unique cards)`);
  const rng = lcg(7);
  const rare = pool.pick('rare', 'pyre', rng);
  ok(rare && rare.id, 'pick returns a rare card');
  const fb = pool.pick('uncommon', 'no-such-type', rng);
  ok(fb && fb.id, 'pick falls back when type has no match');
}

console.log('Full fight with real content:');
{
  const roster = adaptRoster(DEFAULT_MONSTERS);
  const pool = buildCardPool({ rawMonsters: DEFAULT_MONSTERS, typeMoves: TYPE_MOVES });
  // Run-scoped clones (3-monster party) so we don't mutate the roster templates.
  const names = ['Cindermouse', 'Snowpup', 'Tidalith'];
  const party = names.map((n) => roster.find((m) => m.name === n)).map((m) => ({ ...m, hp: m.maxHp }));

  const game = new GameEngine({
    party, enemyAI: basicEnemyAI, pickCard: pool.pick, rng: lcg(99),
  });
  const cm = game.startCombat({ enemies: [makeEnemy('slime')], room: 'combat' });
  ok(cm.state.phase === PHASES.PLAYER, 'combat started into player phase');
  ok(cm.state.hand.length === 5, 'drew opening hand of 5');

  // Auto-play a few turns: dump the hand each turn until someone wins.
  let guard = 0;
  while (cm.state.phase !== PHASES.VICTORY && cm.state.phase !== PHASES.DEFEAT && guard++ < 30) {
    for (const card of [...cm.state.hand]) {
      if ((card.cost === -2) || (card.cost > cm.state.energy)) continue;
      cm.playCard(card, { enemyId: cm.state.enemies[0].id });
    }
    if (cm.state.phase === PHASES.PLAYER) cm.endPlayerTurn();
  }
  ok([PHASES.VICTORY, PHASES.DEFEAT].includes(cm.state.phase), `fight resolved (${cm.state.phase}) in ${guard} rounds`);

  if (cm.state.phase === PHASES.VICTORY) {
    const reward = cm.generateReward(3);
    ok(reward.length === 3 && reward.every((c) => c.id), 'victory reward generated from real pool');
  } else {
    ok(true, '(party lost — reward path skipped)');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
