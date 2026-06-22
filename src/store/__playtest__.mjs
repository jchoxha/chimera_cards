// Headless test of the playtest store path (combatStore.startPlaytest). zustand's
// vanilla store works in node. Run: node src/store/__playtest__.mjs
// (also: npm run test:playtest)

import { readFileSync } from 'fs';
import { useCombat } from './combatStore.js';

const WARRIOR = JSON.parse(readFileSync(new URL('../data/cards/warrior.json', import.meta.url)));
const strike = WARRIOR.cards.find((c) => c.id === 'warrior_strike');

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const deck = Array.from({ length: 10 }, () => ({ ...strike })); // all Strikes → deterministic hand
useCombat.getState().startPlaytest({
  playerCards: deck,
  playerName: 'Warrior',
  stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 },
  attunement: ['Physical'], klass: ['Warrior'],
  enemyHp: 200,
});

console.log('startPlaytest builds a CardSpec player vs a target dummy:');
{
  const snap = useCombat.getState().snap;
  const player = snap.player.fighters[snap.player.vanguardIndex];
  const enemy = snap.enemy.fighters[0];
  ok(player.stance === 'Balanced', `player has a stance (${player.stance})`);
  ok(player.stats && player.stats.might === 1, 'player carries the Topic-1 stat line');
  ok(player.axes.attunement?.[0] === 'Physical' && player.axes.class?.[0] === 'Warrior', 'player carries 3-axis tags');
  ok(enemy.hp === 200 && enemy.name === 'Target Dummy', `enemy is a 200-HP Target Dummy`);
  ok(player.hand.length > 0 && Array.isArray(player.hand[0].effects), 'hand holds data-driven CardSpec cards');
}

console.log('Playing a card updates the snapshot and hits the dummy:');
{
  const beforeVersion = useCombat.getState().version;
  const before = useCombat.getState().snap;
  const player = before.player.fighters[before.player.vanguardIndex];
  const cardId = player.hand[0].id; // a Strike
  useCombat.getState().play(cardId);
  const after = useCombat.getState();
  ok(after.version > beforeVersion, `store version advanced (${beforeVersion}→${after.version})`);
  ok(after.snap.enemy.fighters[0].hp === 194, `Strike dealt 6 to the dummy via the store (hp ${after.snap.enemy.fighters[0].hp})`);
}

console.log(`\nplaytest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
