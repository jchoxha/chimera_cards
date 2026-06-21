// Smoke test for the data-driven card interpreter (src/engine/combat/interpret.js)
// + Warrior stances + Topic-1 stat scaling. Run: node src/engine/cards/__cards__.mjs
// (also: npm run test:cards)
//
// Pins the LOCKED behavior: op-list cards resolve through the engine; Might scales
// damage, Guard scales Block, Focus/Resolve scale effects, and the stance spectrum
// gates Attack/Block + applies its bonuses. Card NUMBERS are tunable (warrior.json).

import { readFileSync } from 'fs';
import { createCombatState, createFighter } from '../combat/state.js';
import { applyCardSpec } from '../combat/interpret.js';
import { applyDamage } from '../combat/resolve.js';
import { validateCard } from './cardSpec.js';
import { fireTriggers, hasPassive } from './effectRegistry.js';

const WARRIOR = JSON.parse(readFileSync(new URL('../../data/cards/warrior.json', import.meta.url)));
const byId = Object.fromEntries(WARRIOR.cards.map((c) => [c.id, c]));

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

function mk(pstats = {}, stance = 'Balanced') {
  const player = createFighter({ id: 'w', name: 'W', types: [{ type: 'Physical', weight: 1 }], hp: 50, maxHp: 50, stats: pstats, stance });
  const enemy = createFighter({ id: 'e', name: 'E', hp: 100, maxHp: 100 });
  const state = createCombatState({ playerFighters: [player], enemyFighters: [enemy] });
  return { state, player, enemy };
}
const play = (s, p, id, opts) => applyCardSpec(s.state ?? s, 'player', p, byId[id], opts);

console.log('Schema: every Warrior card validates:');
{
  const bad = WARRIOR.cards.flatMap((c) => validateCard(c).map((e) => `${c.id}: ${e}`));
  ok(bad.length === 0, bad.length ? bad.join('; ') : `all ${WARRIOR.cards.length} cards valid`);
}

console.log('Might scales damage:');
{
  const g = mk({ might: 1.5 });
  play(g, g.player, 'warrior_strike');           // (6+0)*1.5 = 9
  ok(g.enemy.hp === 91, `Strike with Might 1.5 → 9 dmg (hp ${g.enemy.hp})`);
}

console.log('Guard scales Block:');
{
  const g = mk({ guard: 1.2 });
  play(g, g.player, 'warrior_shield_wall');      // round(8*1.2) = 10
  ok(g.player.block === 10, `Shield Wall with Guard 1.2 → 10 block (got ${g.player.block})`);
}

console.log('Crushing Weight = current Block (valueFrom selfBlock):');
{
  const g = mk({ might: 1.5 });
  g.player.block = 10;
  play(g, g.player, 'warrior_crushing_weight');  // floor(10*1.5) = 15
  ok(g.enemy.hp === 85, `Crushing Weight → 15 dmg from 10 block (hp ${g.enemy.hp})`);
}

console.log('Whirlwind X = hits per energy:');
{
  const g = mk();                                 // might 1, energy floor 3
  play(g, g.player, 'warrior_whirlwind');         // 5 dmg × 3 hits = 15
  ok(g.enemy.hp === 85, `Whirlwind X(3) → 15 dmg (hp ${g.enemy.hp})`);
}

console.log('Execute doubles vs low-HP target only:');
{
  const lo = mk(); lo.enemy.hp = 10;
  play(lo, lo.player, 'warrior_execute');         // 10 → ×2 = 20 ≥ 10 → dead
  ok(lo.enemy.hp === 0, `Execute vs <50% → doubled, lethal (hp ${lo.enemy.hp})`);
  const hi = mk(); hi.enemy.hp = 80;
  play(hi, hi.player, 'warrior_execute');         // 10, no bonus
  ok(hi.enemy.hp === 70, `Execute vs >50% → no bonus (hp ${hi.enemy.hp})`);
}

console.log('Offensive stance: can\'t Block, +Strength per Attack:');
{
  const g = mk({}, 'Offensive');
  play(g, g.player, 'warrior_shield_wall');       // blocked: offense side can't gain Block
  ok(g.player.block === 0, 'Shield Wall fizzles in Offensive (no Block on offense side)');
  play(g, g.player, 'warrior_cleave');            // attack → +1 Strength on play
  ok(g.player.statuses.find((s) => s.id === 'strength')?.amount === 1, 'Cleave grants +1 Strength in Offensive');
}

console.log('Defensive stance: +Dexterity per Skill, can\'t Attack:');
{
  const g = mk({}, 'Defensive');
  play(g, g.player, 'warrior_guard');             // skill → +1 Dexterity on play
  ok(g.player.statuses.find((s) => s.id === 'dexterity')?.amount === 1, 'Guard grants +1 Dexterity in Defensive');
  const r = play(g, g.player, 'warrior_strike');  // attack illegal on defense side
  ok(r.ok === false && g.enemy.hp === 100, 'Strike rejected in Defensive (no Attack on defense side)');
}

console.log('Rampage: 2× damage:');
{
  const g = mk({}, 'Rampage');
  play(g, g.player, 'warrior_rampage_slam');      // (14+6)*1*2 = 40
  ok(g.enemy.hp === 60, `Rampage Slam in Rampage → (14+6)×2 = 40 (hp ${g.enemy.hp})`);
}

console.log('Full Guard: can\'t Attack; Block gains Brace:');
{
  const g = mk({}, 'Full Guard');
  const r = play(g, g.player, 'warrior_strike');
  ok(r.ok === false, 'Attack rejected in Full Guard');
  play(g, g.player, 'warrior_shield_wall');       // block braces in Full Guard
  ok(g.player.block === 0 && g.player.bracedBlock === 8, `Shield Wall braces in Full Guard (braced ${g.player.bracedBlock})`);
}

console.log('Bulwark grants Braced block:');
{
  const g = mk();
  play(g, g.player, 'warrior_bulwark');           // 10, brace
  ok(g.player.bracedBlock === 10 && g.player.block === 0, `Bulwark → 10 braced (got ${g.player.bracedBlock})`);
}

console.log('Braced block persists through damage (resolve.applyDamage):');
{
  const g = mk();
  g.player.bracedBlock = 10;
  applyDamage(g.player, 6, null, false, g.state.player);
  ok(g.player.bracedBlock === 4 && g.player.hp === 50, `6 dmg absorbed by Brace (braced ${g.player.bracedBlock}, hp ${g.player.hp})`);
}

console.log('Buffs scale with Resolve; debuffs with Focus:');
{
  const g = mk({ resolve: 2 });
  play(g, g.player, 'warrior_war_cry');           // 2 × Resolve 2 = 4 Strength
  ok(g.player.statuses.find((s) => s.id === 'strength')?.amount === 4, `War Cry × Resolve 2 → 4 Strength`);
  const d = mk({ focus: 2 });
  play(d, d.player, 'warrior_sunder');            // vulnerable 2 × Focus 2 / Resolve 1 = 4
  ok(d.enemy.statuses.find((s) => s.id === 'vulnerable')?.amount === 4, `Sunder vulnerable × Focus 2 → 4`);
}

console.log('Powers register, then triggers fire & passives apply:');
{
  const g = mk();
  const r = play(g, g.player, 'warrior_bloodlust');
  ok(r.power === true && g.player.powers.length === 1, 'Bloodlust registers as a power');
  // turnStart trigger → +1 Strength (Resolve 1 → 1)
  fireTriggers(g.state, 'player', 'turnStart');
  ok(g.player.statuses.find((s) => s.id === 'strength')?.amount === 1, 'Bloodlust turnStart trigger fires → +1 Strength');

  // Rampart passive: a normal Block op braces even in Balanced.
  const p = mk();
  play(p, p.player, 'warrior_rampart');
  ok(hasPassive(p.player, 'blockAlwaysBraces'), 'Rampart grants blockAlwaysBraces passive');
  play(p, p.player, 'warrior_shield_wall');
  ok(p.player.block === 0 && p.player.bracedBlock === 8, `Rampart makes Shield Wall brace (braced ${p.player.bracedBlock})`);

  // Endless Stamina passive present.
  const e = mk();
  play(e, e.player, 'warrior_endless_stamina');
  ok(hasPassive(e.player, 'extraStanceStep'), 'Endless Stamina grants extraStanceStep passive');
}

console.log('Juggernaut onGainBlock trigger deals damage:');
{
  const g = mk();
  play(g, g.player, 'warrior_juggernaut');
  fireTriggers(g.state, 'player', 'onGainBlock');  // deal 3 to enemy vanguard
  ok(g.enemy.hp === 97, `Juggernaut onGainBlock → 3 dmg (hp ${g.enemy.hp})`);
}

console.log(`\ncards: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
