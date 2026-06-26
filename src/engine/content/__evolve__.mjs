// Smoke test for creature evolution (size-ladder advancement). Run: test:evolve
import { evolve, canEvolve, evolutionTarget, sizeLabel } from './evolve.js';
import { ACTIONS } from '../run/actions.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

console.log('Evolution math:');
{ const e = evolve({ size: 'regular', maxHp: 100, stats: { might: 1 } });
  ok(e.to === 'large', `regular → large (${e.to})`);
  ok(e.newMaxHp === 130, `HP 100 → 130 (${e.newMaxHp})`);
  ok(e.hpGain === 30, `+30 HP (${e.hpGain})`);
  ok(e.mightDelta === 1, `+1 Might (${e.mightDelta})`); }
{ const e = evolve({ size: 'small', maxHp: 75 });
  ok(e.to === 'regular' && e.newMaxHp === 100, `small(75) → regular(${e.newMaxHp})`); }
{ const e = evolve({ size: 'baby', maxHp: 50 });
  ok(e.to === 'small' && e.newMaxHp === 75, `baby(50) → small(${e.newMaxHp})`); }
{ const e = evolve({ size: 'large', maxHp: 130 });
  ok(e.to === 'elite' && e.newMaxHp === 160, `large(130) → elite(${e.newMaxHp})`); }

console.log('Terminal forms:');
ok(canEvolve('regular') === true, 'regular can evolve');
ok(canEvolve('elite') === false, 'elite is terminal');
ok(canEvolve('boss') === false, 'boss is terminal');
ok(evolve({ size: 'elite', maxHp: 160 }) === null, 'evolve(elite) → null');
ok(evolutionTarget('boss') === null, 'evolutionTarget(boss) → null');
ok(sizeLabel('large').includes('Large'), `sizeLabel(large) = "${sizeLabel('large')}"`);

console.log('evolveMember run action:');
{ const s = { party: [{ id: 'a', size: 'regular', maxHp: 100, hp: 70, stats: { might: 1, guard: 1 } }] };
  ACTIONS.evolveMember(s, { memberId: 'a' });
  const m = s.party[0];
  ok(m.size === 'large', `size → large (${m.size})`);
  ok(m.maxHp === 130, `maxHp → 130 (${m.maxHp})`);
  ok(m.hp === 100, `hp 70 + 30 gain = 100 (${m.hp})`);
  ok(m.stats.might === 2, `might → 2 (${m.stats.might})`);
  ok(m.stats.guard === 1, 'other stats untouched'); }
{ // terminal → no-op
  const s = { party: [{ id: 'b', size: 'boss', maxHp: 200, hp: 200, stats: { might: 4 } }] };
  ACTIONS.evolveMember(s, { memberId: 'b' });
  ok(s.party[0].size === 'boss' && s.party[0].maxHp === 200, 'boss member unchanged'); }

console.log(`\nevolve: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
