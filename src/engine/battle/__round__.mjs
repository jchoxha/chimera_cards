// Smoke test for the combat-v2 round resolver. Run: test:battleround
import { resolveOrder, resolveRound, applyAction, endOfRound, makeUnit } from './round.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

// seeded rng (mulberry32) so ordering + hit rolls are deterministic
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const NEUTRAL = { attack: 50, defense: 50, focus: 50, resolve: 50, evasion: 0, accuracy: 100, speed: 50 };
const stat = (o) => ({ ...NEUTRAL, ...o });
const state = (units) => ({ unitsById: Object.fromEntries(units.map((u) => [u.id, u])) });
const card = (o) => ({ priority: 0, effects: [], ...o });

console.log('Resolution order (priority → speed → seeded tie):');
{
  const A = makeUnit({ id: 'A', side: 'p', stats: stat({ speed: 40 }), maxHp: 30 });
  const B = makeUnit({ id: 'B', side: 'e', stats: stat({ speed: 90 }), maxHp: 30 });
  const s = state([A, B]);
  const acts = [
    { ownerId: 'A', targetId: 'B', card: card({ id: 'slow' }) },
    { ownerId: 'B', targetId: 'A', card: card({ id: 'fast' }) },
  ];
  const order = resolveOrder(acts, s.unitsById, mulberry32(1)).map((a) => a.ownerId);
  ok(order[0] === 'B', `higher Speed resolves first (${order.join(' → ')})`);
  const acts2 = [
    { ownerId: 'B', targetId: 'A', card: card({ id: 'fastNoPrio', priority: 0 }) },
    { ownerId: 'A', targetId: 'B', card: card({ id: 'quickAttack', priority: 1 }) },
  ];
  const order2 = resolveOrder(acts2, s.unitsById, mulberry32(1)).map((a) => a.ownerId);
  ok(order2[0] === 'A', `priority tier BEATS Speed (${order2.join(' → ')})`);
}
{ // seeded tiebreak is deterministic + splits ties
  const A = makeUnit({ id: 'A', side: 'p', stats: stat({ speed: 50 }), maxHp: 30 });
  const B = makeUnit({ id: 'B', side: 'e', stats: stat({ speed: 50 }), maxHp: 30 });
  const s = state([A, B]);
  const acts = [{ ownerId: 'A', targetId: 'B', card: card({ id: 'a' }) }, { ownerId: 'B', targetId: 'A', card: card({ id: 'b' }) }];
  const o1 = resolveOrder(acts, s.unitsById, mulberry32(7)).map((a) => a.ownerId).join();
  const o2 = resolveOrder(acts, s.unitsById, mulberry32(7)).map((a) => a.ownerId).join();
  ok(o1 === o2, `equal-speed tie broken deterministically by seed (${o1})`);
}

console.log('Damage · Block(temp HP) · Speed-gated block:');
{ // slower attacker: the faster defender's Block lands FIRST and absorbs the hit
  const atk = makeUnit({ id: 'atk', side: 'e', stats: stat({ speed: 30 }), maxHp: 40 });
  const def = makeUnit({ id: 'def', side: 'p', stats: stat({ speed: 80 }), maxHp: 40 });
  const s = state([atk, def]);
  const acts = [
    { ownerId: 'atk', targetId: 'def', card: card({ id: 'strike', effects: [{ op: 'damage', value: 10 }] }) },
    { ownerId: 'def', targetId: 'def', card: card({ id: 'guard', effects: [{ op: 'block', value: 12 }] }) },
  ];
  resolveRound(s, acts, mulberry32(2));
  ok(def.hp === 40 && def.block === 2, `fast Block(temp HP) absorbs slow hit (hp ${def.hp}, block ${def.block})`);
}
{ // faster attacker: the block is TOO LATE this round
  const atk = makeUnit({ id: 'atk', side: 'e', stats: stat({ speed: 80 }), maxHp: 40 });
  const def = makeUnit({ id: 'def', side: 'p', stats: stat({ speed: 30 }), maxHp: 40 });
  const s = state([atk, def]);
  const acts = [
    { ownerId: 'atk', targetId: 'def', card: card({ id: 'strike', effects: [{ op: 'damage', value: 10 }] }) },
    { ownerId: 'def', targetId: 'def', card: card({ id: 'guard', effects: [{ op: 'block', value: 12 }] }) },
  ];
  resolveRound(s, acts, mulberry32(2));
  ok(def.hp === 30 && def.block === 12, `slow Block lands after the hit (hp ${def.hp}, block ${def.block})`);
}
{ // damped ratio: strong attacker (2× Attack) → ~+41%, not double
  const atk = makeUnit({ id: 'atk', side: 'e', stats: stat({ attack: 100 }), maxHp: 40 });
  const def = makeUnit({ id: 'def', side: 'p', stats: stat({ defense: 50 }), maxHp: 40 });
  const s = state([atk, def]);
  resolveRound(s, [{ ownerId: 'atk', targetId: 'def', card: card({ id: 's', effects: [{ op: 'damage', value: 10 }] }) }], mulberry32(3));
  ok(def.hp === 26, `2× Attack → 14 dmg damped (hp ${def.hp})`);
}

console.log('Hit / miss (Accuracy − Evasion, floor 0):');
{ const atk = makeUnit({ id: 'atk', side: 'e', stats: stat({ accuracy: 100 }), maxHp: 40 });
  const def = makeUnit({ id: 'def', side: 'p', stats: stat({ evasion: 100 }), maxHp: 40 });
  const s = state([atk, def]);
  const log = resolveRound(s, [{ ownerId: 'atk', targetId: 'def', card: card({ id: 's', effects: [{ op: 'damage', value: 10 }] }) }], mulberry32(4));
  ok(def.hp === 40 && log.some((e) => e.type === 'miss'), 'Evasion ≥ Accuracy → guaranteed miss');
  // lock-on ignores evasion
  const s2 = state([makeUnit({ id: 'atk', side: 'e', stats: stat({}), maxHp: 40 }), makeUnit({ id: 'def', side: 'p', stats: stat({ evasion: 100 }), maxHp: 40 })]);
  resolveRound(s2, [{ ownerId: 'atk', targetId: 'def', card: card({ id: 'lock', lockOn: true, effects: [{ op: 'damage', value: 10 }] }) }], mulberry32(4));
  ok(s2.unitsById.def.hp === 30, 'lock-on card bypasses Evasion');
}

console.log('Death mid-round → fizzle:');
{ // fast A kills B; B's committed attack (owner now dead) fizzles
  const A = makeUnit({ id: 'A', side: 'p', stats: stat({ speed: 90, attack: 100 }), maxHp: 30 });
  const B = makeUnit({ id: 'B', side: 'e', stats: stat({ speed: 20, defense: 25 }), maxHp: 10 });
  const s = state([A, B]);
  const log = resolveRound(s, [
    { ownerId: 'A', targetId: 'B', card: card({ id: 'kill', effects: [{ op: 'damage', value: 10 }] }) },
    { ownerId: 'B', targetId: 'A', card: card({ id: 'revenge', effects: [{ op: 'damage', value: 10 }] }) },
  ], mulberry32(5));
  ok(B.hp === 0 && A.hp === 30 && log.some((e) => e.type === 'fizzle' && e.reason === 'owner-dead'),
    `dead owner's committed action fizzles (A hp ${A.hp}, B hp ${B.hp})`);
}

console.log('End-of-round ticks:');
{ const U = makeUnit({ id: 'U', side: 'p', stats: stat({}), maxHp: 40, statuses: [{ id: 'poison', amount: 3 }] });
  const s = state([U]);
  endOfRound(s, []);
  ok(U.hp === 37 && U.statuses.find((x) => x.id === 'poison').amount === 2, `poison ticks at end of round (hp ${U.hp})`);
}

console.log('Type effectiveness (card element vs target constitution):');
{
  // attacker untyped-stat, but the CARD is Fire; Beast is weak to Fire (×1.25), Aberration resists none of Fire.
  const mk = (id, creature) => { const u = makeUnit({ id, side: id === 'ATK' ? 'p' : 'e', stats: stat({}), maxHp: 100 }); u.creature = creature; return u; };
  const fire = card({ id: 'firebolt', element: 'Fire', effects: [{ op: 'damage', value: 20 }] });
  // neutral defender (no typing) → ×1
  { const A = mk('ATK', { attunement: ['Physical'] }), D = mk('D', null); const s = state([A, D]);
    applyAction(s, { ownerId: 'ATK', targetId: 'D', card: fire }, mulberry32(3), []);
    ok(D.hp === 80, `untyped defender takes base 20 (hp ${D.hp})`); }
  // Beast is weak to Fire → ×1.25 → 25 damage
  { const A = mk('ATK', { attunement: ['Physical'] }), D = mk('D', { biology: ['Beast'] }); const s = state([A, D]); const log = [];
    applyAction(s, { ownerId: 'ATK', targetId: 'D', card: fire }, mulberry32(3), log);
    ok(D.hp === 75, `Beast is weak to Fire → 25 dmg (hp ${D.hp})`);
    ok(log.some((e) => e.type === 'damage' && e.mult === 1.25 && /effective/.test(e.eff || '')), 'damage log carries the effectiveness (×1.25, label)'); }
  // a Fire creature resists Fire (self-resist ×0.75) → 15 damage, and its biology weakness is overridden
  { const A = mk('ATK', { attunement: ['Physical'] }), D = mk('D', { attunement: ['Fire'], biology: ['Beast'] }); const s = state([A, D]);
    applyAction(s, { ownerId: 'ATK', targetId: 'D', card: fire }, mulberry32(3), []);
    ok(D.hp === 85, `Fire creature self-resists Fire, biology weakness overridden → 15 dmg (hp ${D.hp})`); }
}

console.log(`\nbattle/round: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
