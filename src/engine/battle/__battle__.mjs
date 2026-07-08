// Smoke test for the combat-v2 plan/commit + round loop. Run: test:battleloop
import { buildState, makeUnit, liveUnits } from './state.js';
import {
  actionCost, planCost, validatePlan, spendPlan, flattenPlans,
  startRound, battleOutcome, resolveBattleRound,
} from './battle.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = () => mulberry32(11);

const NEUTRAL = { attack: 50, defense: 50, focus: 50, resolve: 50, evasion: 0, accuracy: 100, speed: 50 };
const u = (id, o = {}) => makeUnit({ id, stats: { ...NEUTRAL, ...(o.stats || {}) }, maxHp: o.hp ?? 30 });
const strike = (o = {}) => ({ id: 'strike', cost: 1, effects: [{ op: 'damage', value: 10 }], ...o });
const act = (ownerId, card, targetId = 'E') => ({ ownerId, targetId, card });

// One squad each side (single creature) with 3 energy.
function duel(pHp = 30, eHp = 30) {
  const P = u('P', { hp: pHp }), E = u('E', { hp: eHp });
  const s = buildState({ p: [{ id: 'ps', members: [P] }], e: [{ id: 'es', members: [E] }] });
  return { s, P, E };
}

console.log('Energy costs + validation:');
{ const { s } = duel();
  ok(actionCost(act('P', strike())) === 1 && actionCost(act('P', strike({ cost: 2 }))) === 2, 'action cost = card cost (default 1)');
  ok(planCost([act('P', strike()), act('P', strike({ cost: 2 }))]) === 3, 'plan cost sums');
  const good = validatePlan(s, { ps: [act('P', strike()), act('P', strike()), act('P', strike())] });   // 3 ≤ 3
  ok(good.ok, 'plan within energy validates');
  const bad = validatePlan(s, { ps: [act('P', strike()), act('P', strike()), act('P', strike()), act('P', strike())] }); // 4 > 3
  ok(!bad.ok && bad.errors.length > 0, 'over-budget plan is rejected');
  const wrong = validatePlan(s, { ps: [act('E', strike(), 'P')] });
  ok(!wrong.ok, 'action whose owner is not in the squad is rejected'); }

console.log('Energy spend + refresh:');
{ const { s } = duel();
  spendPlan(s, { ps: [act('P', strike()), act('P', strike())] });
  ok(s.squadsById.ps.energy === 1, `spend deducts energy (${s.squadsById.ps.energy})`);
  startRound(s);
  ok(s.squadsById.ps.energy === 3, `startRound refreshes to max (${s.squadsById.ps.energy})`); }

console.log('flatten merges both blind commits:');
{ const acts = flattenPlans({ p: { ps: [act('P', strike()), act('P', strike())] }, e: { es: [act('E', strike(), 'P')] } });
  ok(acts.length === 3, `both sides merged into one action list (${acts.length})`); }

console.log('resolveBattleRound + win/loss:');
{ const { s, P, E } = duel(30, 30);
  const r1 = resolveBattleRound(s, {
    p: { ps: [{ ownerId: 'P', targetId: 'E', card: strike() }] },
    e: { es: [{ ownerId: 'E', targetId: 'P', card: strike() }] },
  }, rng());
  ok(P.hp === 20 && E.hp === 20 && r1.outcome === null, `both trade a hit, battle continues (P ${P.hp}, E ${E.hp})`);
  ok(s.squadsById.ps.energy === 3 && s.squadsById.es.energy === 3, 'energy refreshed for next round'); }
{ const { s, E } = duel(30, 8);   // E is nearly dead → one hit ends it
  const r = resolveBattleRound(s, {
    p: { ps: [{ ownerId: 'P', targetId: 'E', card: strike() }] },
    e: {},
  }, rng());
  ok(E.hp === 0 && r.outcome === 'p' && liveUnits(s, 'e').length === 0, `lethal round → player wins (outcome ${r.outcome})`); }

console.log('invalid commit is a no-op (no partial resolution):');
{ const { s, E } = duel();
  const r = resolveBattleRound(s, { p: { ps: [strike(), strike(), strike(), strike()] }, e: {} }, rng());
  ok(r.errors.length > 0 && r.log.length === 0 && E.hp === 30, 'over-budget commit rejected without mutating the board');
  ok(s.squadsById.ps.energy === 3, 'energy untouched on a rejected commit'); }

console.log('multi-squad side (energy is per-squad):');
{ const A = u('A'), B = u('B'), X = u('X', { hp: 60 });
  const s = buildState({ p: [{ id: 'a', members: [A] }, { id: 'b', members: [B] }], e: [{ id: 'x', members: [X] }] });
  resolveBattleRound(s, {
    p: { a: [{ ownerId: 'A', targetId: 'X', card: strike() }], b: [{ ownerId: 'B', targetId: 'X', card: strike() }] },
    e: {},
  }, rng());
  ok(X.hp === 40, `two squads each spend their OWN energy to both act (X ${X.hp})`); }

console.log(`\nbattle/loop: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
