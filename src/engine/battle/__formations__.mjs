// Smoke test for FORMATIONS: size-scaled energy + Support→Vanguard auras. Run: test:formations
import { buildState, makeUnit, liveFrontUnit } from './state.js';
import { startRound, squadEnergyFor, applyFormationAuras, AURA_ATTACK, AURA_DEFENSE } from './battle.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

const NEUTRAL = { attack: 50, defense: 50, focus: 50, resolve: 50, evasion: 0, accuracy: 100, speed: 50 };
const u = (id, o = {}) => makeUnit({ id, stats: { ...NEUTRAL, ...(o.stats || {}) }, maxHp: o.hp ?? 40 });
const striker = (id) => u(id, { stats: { attack: 70, defense: 40 } });
const guardian = (id) => u(id, { stats: { attack: 40, defense: 70 } });

console.log('Energy scales with live squad size:');
{
  const solo = u('s0'), duoA = u('d0'), duoB = u('d1'), trioA = u('t0'), trioB = u('t1'), trioC = u('t2');
  const s = buildState({
    p: [{ id: 'solo', members: [solo] }, { id: 'duo', members: [duoA, duoB] }, { id: 'trio', members: [trioA, trioB, trioC] }],
    e: [{ id: 'es', members: [u('E')] }],
  });
  startRound(s);
  ok(squadEnergyFor(s, s.squadsById.solo) === 2, 'solo squad → 2 energy (≈2 per creature)');
  ok(squadEnergyFor(s, s.squadsById.duo) === 4, 'duo squad → 4 energy');
  ok(squadEnergyFor(s, s.squadsById.trio) === 6, 'trio squad → 6 energy');
  ok(s.squadsById.trio.energy === 6 && s.squadsById.trio.maxEnergy === 6, 'startRound sets trio energy to 6');
  // kill two trio members → energy drops to a solo's (2)
  s.unitsById.t1.hp = 0; s.unitsById.t2.hp = 0;
  ok(squadEnergyFor(s, s.squadsById.trio) === 2, 'trio reduced to 1 live → 2 energy (degrades)');
}

console.log('Support auras empower the Vanguard by build:');
{
  // Guardian vanguard + two striker supports → +ATK aura ×2
  const gv = guardian('gv'), sp1 = striker('sp1'), sp2 = striker('sp2');
  const s = buildState({ p: [{ id: 'sq', members: [gv, sp1, sp2] }], e: [{ id: 'es', members: [u('E')] }] });
  startRound(s);
  const front = liveFrontUnit(s, s.squadsById.sq);
  ok(front.id === 'gv', 'guardian is the vanguard (index 0)');
  ok(front.stats.attack === 40 + 2 * AURA_ATTACK, `two striker supports → +${2 * AURA_ATTACK} attack (${front.stats.attack})`);
  ok(front.stats.defense === 70, 'defense unchanged by striker supports');
  ok(front.formation && front.formation.attack === 2 * AURA_ATTACK, 'formation aura surfaced on the front');
  ok(sp1.stats.attack === sp1.baseStats.attack, 'support keeps its own base stats (no aura on support)');
}

console.log('Guardian supports harden an offensive Vanguard:');
{
  const sv = striker('sv'), g1 = guardian('g1');
  const s = buildState({ p: [{ id: 'sq', members: [sv, g1] }], e: [{ id: 'es', members: [u('E')] }] });
  startRound(s);
  const front = liveFrontUnit(s, s.squadsById.sq);
  ok(front.stats.defense === 40 + AURA_DEFENSE, `one guardian support → +${AURA_DEFENSE} defense (${front.stats.defense})`);
  ok(front.stats.attack === 70, 'attack unchanged by guardian support');
}

console.log('Aura recomputes to base when supports die:');
{
  const gv = guardian('gv'), sp1 = striker('sp1');
  const s = buildState({ p: [{ id: 'sq', members: [gv, sp1] }], e: [{ id: 'es', members: [u('E')] }] });
  startRound(s);
  ok(liveFrontUnit(s, s.squadsById.sq).stats.attack === 40 + AURA_ATTACK, 'aura active with support alive');
  s.unitsById.sp1.hp = 0;
  applyFormationAuras(s);
  ok(s.unitsById.gv.stats.attack === 40 && !s.unitsById.gv.formation, 'support dead → aura removed, back to base');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
