// Integration smoke test: data-driven CardSpec cards (warrior.json) played through
// the full VanguardManager turn engine. Run: node src/engine/combat/__cardturn__.mjs
// (also: npm run test:cardturn)
//
// Proves the editor's cards actually run in combat: the interpreter path in play(),
// stat scaling, stances, and power triggers firing in the turn loop.

import { readFileSync } from 'fs';
import { VanguardManager } from './VanguardManager.js';
import { createFighter } from './state.js';

const WARRIOR = JSON.parse(readFileSync(new URL('../../data/cards/warrior.json', import.meta.url)));
const byId = Object.fromEntries(WARRIOR.cards.map((c) => [c.id, c]));
const card = (id) => JSON.parse(JSON.stringify(byId[id]));

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

function setup() {
  const warrior = createFighter({
    id: 'war', name: 'Warrior', types: [{ type: 'Physical', weight: 1 }], hp: 60, maxHp: 60,
    stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 },
  });
  // Stock the draw pile so the opening hand can be drawn without errors.
  warrior.deck.drawPile = ['warrior_strike', 'warrior_guard', 'warrior_cleave', 'warrior_shield_wall',
    'warrior_pommel_strike', 'warrior_war_cry'].map(card);
  const foe = createFighter({ id: 'foe', name: 'Foe', hp: 100, maxHp: 100 });

  const vm = new VanguardManager({ playerFighters: [warrior], enemyFighters: [foe], room: 'combat', rarity: { offset: -0.05, ascension7: false } });
  vm.startCombat();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  // Force a known hand + energy for a deterministic test.
  p.hand = ['warrior_strike', 'warrior_berserk', 'warrior_bloodlust', 'warrior_strike'].map(card);
  vm.state.player.energy = 10;
  return { vm, p, foe };
}

console.log('Data-driven cards resolve through VanguardManager.play:');
{
  const { vm, foe } = setup();
  vm.play('warrior_strike');                  // Balanced, Might 1 → 6 dmg
  ok(foe.hp === 94, `Strike via engine → 6 dmg (foe ${foe.hp})`);
}

console.log('Stance card sets state; subsequent attack scales (Rampage 2×):');
{
  const { vm, p, foe } = setup();
  vm.play('warrior_berserk');                 // snap to Rampage
  ok(p.stance === 'Rampage', `Berserk set stance Rampage (${p.stance})`);
  vm.play('warrior_strike');                  // 6 × 2 = 12
  ok(foe.hp === 88, `Strike in Rampage → 12 dmg (foe ${foe.hp})`);
}

console.log('Power registers + exhausts; turnStart trigger fires next turn:');
{
  const { vm, p } = setup();
  vm.play('warrior_bloodlust');               // power → registered + exhausted
  ok(p.powers.length === 1 && p.deck.exhaustPile.some((c) => c.id === 'warrior_bloodlust'),
    'Bloodlust registered as a power and exhausted from hand');
  const strBefore = p.statuses.find((s) => s.id === 'strength')?.amount ?? 0;
  vm.endTurn();                               // → enemy turn → next round → player turnStart fires Bloodlust
  const strAfter = p.statuses.find((s) => s.id === 'strength')?.amount ?? 0;
  ok(strAfter === strBefore + 1, `Bloodlust turnStart trigger fired across the turn cycle (+1 Strength: ${strBefore}→${strAfter})`);
  ok(vm.state.player.fighters[0].hp > 0, 'player survived the cycle (idle enemy)');
}

console.log('Replay count re-runs the card effects for free:');
{
  const { vm, foe } = setup();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  p.hand = [{ ...card('warrior_strike'), id: 'replay_strike', replayCount: 1 }]; // plays twice
  vm.state.player.energy = 5;
  const before = foe.hp;
  vm.play('replay_strike');
  ok(foe.hp === before - 12, `Replay 1 → Strike hits twice (6×2=12; ${before}→${foe.hp})`);
}

console.log('Illegal stance play is rejected without cost:');
{
  const { vm, p } = setup();
  p.stance = 'Full Guard';                    // defense extreme — can't Attack
  const energyBefore = vm.state.player.energy;
  const r = vm.play('warrior_strike');
  ok(r === false && vm.state.player.energy === energyBefore, 'Strike rejected in Full Guard, energy unspent');
}

console.log('Conditional op gated by live event-history counters:');
{
  const { vm, foe } = setup();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  // deals 5 only if ≥1 card already played this turn (count is bumped AFTER each play)
  const cond = { id: 'cond', name: 'Cond', attunement: 'Physical', type: 'skill', cost: 0, effects: [{ op: 'damage', value: 5, scope: 'enemyActiveTarget', condition: { event: 'cardsPlayed', verb: '>=', threshold: 1, window: 'thisTurn' } }] };
  p.hand = [cond, { ...cond, id: 'cond2' }];
  vm.state.player.energy = 5;
  const start = foe.hp;
  vm.play('cond');   // 0 prior plays → condition fails → no damage
  ok(foe.hp === start, 'conditional skipped on the 1st play (0 prior)');
  vm.play('cond2');  // 1 prior play → condition passes → 5 dmg
  ok(foe.hp === start - 5, 'conditional fires once the counter threshold is met');
}

console.log('Attunement imbue: a flagged attack adds the CASTER attunement signature status:');
{
  const { vm, foe } = setup();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  p.attunement = ['Physical', 'Fire'];           // dual: Fire live (Burn); Physical bleed inert
  p.hand = ['warrior_strike'].map(card);          // warrior_strike carries imbue:1
  vm.state.player.energy = 5;
  const before = foe.hp;
  vm.play('warrior_strike');
  ok(foe.hp === before - 6, `imbued Strike still deals its Physical 6 (foe ${before}→${foe.hp})`);
  ok((foe.statuses.find((s) => s.id === 'burn')?.amount ?? 0) === 1, 'Fire attunement imbued 1 Burn onto the target');
}

console.log('Pure-Physical imbue is inert (Bleed not live); Holy self-imbue buffs the caster:');
{
  const { vm, foe } = setup();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  p.attunement = ['Physical'];
  p.hand = ['warrior_strike'].map(card);
  vm.state.player.energy = 5;
  vm.play('warrior_strike');
  ok((foe.statuses.find((s) => s.id === 'burn')?.amount ?? 0) === 0, 'Physical imbue adds no live status');
  p.attunement = ['Holy'];                         // Holy → self Regen
  p.statuses = p.statuses.filter((s) => s.id !== 'regen');
  p.hand = ['warrior_strike'].map(card);
  vm.state.player.energy = 5;
  vm.play('warrior_strike');
  ok((p.statuses.find((s) => s.id === 'regen')?.amount ?? 0) === 1, 'Holy attunement self-imbued 1 Regen on the caster');
}

console.log('Matchup multiplier keys on the card damage element:');
{
  const { vm, foe } = setup();
  const p = vm.state.player.fighters[vm.state.player.vanguardIndex];
  foe.attunement = ['Frost'];                      // Fire is strong vs Frost (×1.5)
  const fireCard = { id: 'fbolt', name: 'Firebolt', attunement: 'Fire', type: 'attack', cost: 1, effects: [{ op: 'damage', value: 6, scope: 'enemyActiveTarget' }] };
  p.hand = [fireCard];
  vm.state.player.energy = 5;
  const before = foe.hp;
  vm.play('fbolt');
  ok(foe.hp === before - 9, `Fire→Frost ×1.5 → 6 becomes 9 (foe ${before}→${foe.hp})`);
}

console.log(`\ncardturn: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
