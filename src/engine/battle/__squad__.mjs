// Smoke test for the combat-v2 SQUAD model + squad-aware targeting. Run: test:battlesquad
import { buildState, makeUnit, liveFrontUnit } from './state.js';
import { resolveRound } from './round.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const NEUTRAL = { attack: 50, defense: 50, focus: 50, resolve: 50, evasion: 0, accuracy: 100, speed: 50 };
const u = (id, o = {}) => makeUnit({ id, stats: { ...NEUTRAL, ...(o.stats || {}) }, maxHp: o.hp ?? 40 });
const strike = (o = {}) => ({ id: 'strike', effects: [{ op: 'damage', value: 10 }], ...o });
const rng = () => mulberry32(9);

// Fresh 3-creature player squad [F(front), S1, S2] vs a solo enemy squad [E].
function scene(eStats = {}) {
  const F = u('F'), S1 = u('S1'), S2 = u('S2'), E = u('E', { stats: eStats });
  const s = buildState({ p: [{ id: 'sq', members: [F, S1, S2] }], e: [{ id: 'eq', members: [E] }] });
  return { s, F, S1, S2, E };
}

console.log('Front/back reach:');
{ const { s, F, S1 } = scene();
  resolveRound(s, [{ ownerId: 'E', targetId: 'S1', card: strike() }], rng());
  ok(F.hp < 40 && S1.hp === 40, `default attack aimed at a Support redirects to the Vanguard (F ${F.hp}, S1 ${S1.hp})`); }
{ const { s, F, S1 } = scene();
  resolveRound(s, [{ ownerId: 'E', targetId: 'S1', card: strike({ reachesBack: true }) }], rng());
  ok(S1.hp < 40 && F.hp === 40, `reachesBack strikes the specific Support (F ${F.hp}, S1 ${S1.hp})`); }

console.log('Death → squad-scoped redirect + auto-promote:');
{ const { s, F, S1 } = scene();
  // kill the front, then a second attack aimed at the (now dead) front redirects to promoted S1
  s.unitsById.F.hp = 8;
  const log = resolveRound(s, [
    { ownerId: 'E', targetId: 'F', card: strike() },      // 10 dmg → F dies
    { ownerId: 'E', targetId: 'F', card: strike() },      // F gone → redirect to new front S1
  ], rng());
  ok(F.hp === 0 && S1.hp < 40 && log.some((e) => e.type === 'death' && e.unitId === 'F'),
    `front dies → next attack redirects to the promoted Support (F ${F.hp}, S1 ${S1.hp})`); }
{ const { s, F, S1, S2 } = scene();
  s.unitsById.F.hp = 1; s.unitsById.S1.hp = 1; s.unitsById.S2.hp = 1;
  const log = resolveRound(s, [
    { ownerId: 'E', targetId: 'F', card: strike({ reachesBack: true }) },
    { ownerId: 'E', targetId: 'S1', card: strike({ reachesBack: true }) },
    { ownerId: 'E', targetId: 'S2', card: strike({ reachesBack: true }) },
    { ownerId: 'E', targetId: 'F', card: strike() },      // whole squad gone → fizzle
  ], rng());
  ok(log.filter((e) => e.type === 'death').length === 3 && log.some((e) => e.type === 'fizzle' && e.reason === 'no-target'),
    'whole squad down → the extra attack fizzles'); }

console.log('Auto-swap-forward changes who is hit:');
{ const { s, S1 } = scene({ speed: 20 });   // enemy is SLOW
  // S1 (support) plays a fast swaps-forward card → becomes front BEFORE the slow enemy attack lands
  s.unitsById.S1.stats.speed = 90;
  resolveRound(s, [
    { ownerId: 'S1', targetId: 'E', card: { id: 'charge', swapsForward: true, effects: [{ op: 'damage', value: 4 }] } },
    { ownerId: 'E', targetId: 'F', card: strike() },      // squad-scoped → hits the NEW front S1
  ], rng());
  ok(liveFrontUnit(s, s.squadsById.sq).id === 'S1' && S1.hp < 40,
    `a swaps-forward card promotes the owner, so the enemy hit lands on it (front now S1, S1 hp ${S1.hp})`); }

console.log('locked vs adaptive:');
{ const { s } = scene();
  s.unitsById.F.hp = 0;   // intended target already down
  const log = resolveRound(s, [{ ownerId: 'E', targetId: 'F', card: strike({ locked: true }) }], rng());
  ok(log.some((e) => e.type === 'fizzle' && e.reason === 'no-target'), 'locked card fizzles on a dead specific target'); }
{ // two enemy squads; an adaptive card whose target is dead retargets to another live front
  const A = u('A'), B = u('B'), P = u('P');
  A.hp = 0;
  const s = buildState({ p: [{ id: 'psq', members: [P] }], e: [{ id: 'ea', members: [A] }, { id: 'eb', members: [B] }] });
  resolveRound(s, [{ ownerId: 'P', targetId: 'A', card: strike({ adaptive: true }) }], rng());
  ok(B.hp < 40, `adaptive retargets from a dead unit to another squad's front (B ${B.hp})`); }

console.log('Reposition (no card, energy-paid by planner):');
{ const { s, S1 } = scene();
  resolveRound(s, [{ type: 'reposition', ownerId: 'F', toId: 'S1' }], rng());
  ok(liveFrontUnit(s, s.squadsById.sq).id === 'S1' && s.squadsById.sq.frontIndex === 1, 'reposition moves a Support to the front'); }

console.log(`\nbattle/squad: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
