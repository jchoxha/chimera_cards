// Smoke test for the §5.2 reaction engine (engine/cards/reactions.js).
import { fireReactions, previewReactions, forecastReactions, REACTIONS, primaryElement } from './reactions.js';
import { createFighter } from '../combat/state.js';
import { addStatus, stackingFor } from '../combat/resolve.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

function setup() {
  const atk = createFighter({ id: 'atk', name: 'Atk', types: [{ type: 'Physical', weight: 1 }], hp: 30, maxHp: 40 });
  const def = createFighter({ id: 'def', name: 'Def', types: [{ type: 'Physical', weight: 1 }], hp: 50, maxHp: 50 });
  const aide = createFighter({ id: 'aide', name: 'Aide', types: [{ type: 'Physical', weight: 1 }], hp: 50, maxHp: 50 });
  const state = { player: { fighters: [atk], vanguardIndex: 0 }, enemy: { fighters: [def, aide], vanguardIndex: 0, fortifySlot: { block: 0 } } };
  return { state, atk, def, aide };
}
const give = (f, id, n) => addStatus(f.statuses, { id, amount: n, stacking: stackingFor(id) });
const amt = (f, id) => f.statuses.find((s) => s.id === id)?.amount ?? 0;

console.log('Reaction table shape:');
ok(REACTIONS.Fire?.burn && REACTIONS.Water?.burn, 'Fire/Water react with Burn');
ok(primaryElement(['Fire', 'Frost']) === 'Fire', 'primaryElement takes the first of a re-skin pair');

console.log('Fire → Flare-up (Burn +2, no consume):');
{ const { state, atk, def } = setup(); give(def, 'burn', 3); fireReactions(state, atk, def, 'Fire'); ok(amt(def, 'burn') === 5, `burn 3 -> 5 (got ${amt(def, 'burn')})`); }

console.log('Water → Quench (consume Burn, apply Weak):');
{ const { state, atk, def } = setup(); give(def, 'burn', 4); fireReactions(state, atk, def, 'Water'); ok(amt(def, 'burn') === 0 && amt(def, 'weak') === 1, `burn 0, weak 1 (got burn ${amt(def, 'burn')}, weak ${amt(def, 'weak')})`); }

console.log('Nature → Fester (Poison doubles):');
{ const { state, atk, def } = setup(); give(def, 'poison', 3); fireReactions(state, atk, def, 'Nature'); ok(amt(def, 'poison') === 6, `poison 3 -> 6 (got ${amt(def, 'poison')})`); }

console.log('Void → Devour Bleed (consume, heal attacker):');
{ const { state, atk, def } = setup(); give(def, 'bleed', 5); const hp0 = atk.hp; fireReactions(state, atk, def, 'Void'); ok(amt(def, 'bleed') === 0, 'bleed consumed'); ok(atk.hp === hp0 + 5, `attacker healed 5 (got ${atk.hp - hp0})`); }

console.log('Physical → Rend (bonus dmg = bleed, +1 bleed):');
{ const { state, atk, def } = setup(); give(def, 'bleed', 4); const hp0 = def.hp; fireReactions(state, atk, def, 'Physical'); ok(def.hp === hp0 - 4, `target took 4 (got ${hp0 - def.hp})`); ok(amt(def, 'bleed') === 5, `bleed 4 -> 5 (got ${amt(def, 'bleed')})`); }

console.log('Holy → Purge-Smite (consume Poison, dmg = value):');
{ const { state, atk, def } = setup(); give(def, 'poison', 6); const hp0 = def.hp; fireReactions(state, atk, def, 'Holy'); ok(amt(def, 'poison') === 0 && def.hp === hp0 - 6, `poison 0 + 6 dmg (got poison ${amt(def, 'poison')}, dmg ${hp0 - def.hp})`); }

console.log('Energy → Electrocute (consume Soak, Shock self + chain to aide):');
{ const { state, atk, def, aide } = setup(); give(def, 'soak', 2); fireReactions(state, atk, def, 'Energy'); ok(amt(def, 'soak') === 0, 'soak consumed'); ok(amt(def, 'shock') >= 1, `target shocked (${amt(def, 'shock')})`); ok(amt(aide, 'shock') >= 1, `aide chained shock (${amt(aide, 'shock')})`); }

console.log('Water → Conduct (Shock spreads to bench):');
{ const { state, atk, def, aide } = setup(); give(def, 'shock', 2); fireReactions(state, atk, def, 'Water'); ok(amt(aide, 'shock') >= 1, `aide got shock (${amt(aide, 'shock')})`); }

console.log('Shadow → Corrupt (Strength -1, +Weak):');
{ const { state, atk, def } = setup(); give(def, 'strength', 3); fireReactions(state, atk, def, 'Shadow'); ok(amt(def, 'strength') === 2 && amt(def, 'weak') === 1, `str 2, weak 1 (got str ${amt(def, 'strength')}, weak ${amt(def, 'weak')})`); }

console.log('No primer → no reaction:');
{ const { state, atk, def } = setup(); const fired = fireReactions(state, atk, def, 'Fire'); ok(fired.length === 0, 'nothing fired on a clean target'); }

console.log('Element with no table → no-op:');
{ const { state, atk, def } = setup(); give(def, 'burn', 2); const fired = fireReactions(state, atk, def, 'Stone'); ok(fired.length === 0 && amt(def, 'burn') === 2, 'Stone has no Burn cell'); }

console.log('Magnitude scales with primer stacks (Physical → Ground on Shock):');
{ const { state, atk, def } = setup(); give(def, 'shock', 3); const hp0 = def.hp; fireReactions(state, atk, def, 'Physical'); ok(amt(def, 'shock') === 0 && hp0 - def.hp === 9, `consume + 3*3 dmg (got shock ${amt(def, 'shock')}, dmg ${hp0 - def.hp})`); }

console.log('Detonate consumes, amplify keeps (Frost Freeze vs Frostbite):');
{ const { state, atk, def } = setup(); give(def, 'soak', 2); fireReactions(state, atk, def, 'Frost'); ok(amt(def, 'soak') === 0 && amt(def, 'expose') === 3, `Freeze consumes Soak, Expose 1+2=3 (got soak ${amt(def, 'soak')}, expose ${amt(def, 'expose')})`); }
{ const { state, atk, def } = setup(); give(def, 'bleed', 4); fireReactions(state, atk, def, 'Frost'); ok(amt(def, 'bleed') === 5, `Frostbite keeps + grows Bleed 4->5 (got ${amt(def, 'bleed')})`); }

console.log('previewReactions is a non-mutating value estimate:');
{ const { state, atk, def } = setup(); give(def, 'poison', 5);
  const p = previewReactions(def, 'Holy');
  ok(p.damage === 5 && amt(def, 'poison') === 5, `predicts 5 burst, leaves status intact (dmg ${p.damage}, poison ${amt(def, 'poison')})`);
  // sanity: prediction matches the real reaction
  const hp0 = def.hp; fireReactions(state, atk, def, 'Holy');
  ok(hp0 - def.hp === p.damage, `prediction == actual (${p.damage})`); }
{ const def = { id: 'd', hp: 50, statuses: [] };
  ok(previewReactions(def, 'Fire').score === 0, 'no primer → 0 score');
  ok(previewReactions(def, 'Stone').score === 0, 'no table → 0 score'); }

console.log('previewReactions values a queued (setup) primer:');
{ const def = { id: 'd', hp: 50, statuses: [] };
  const without = previewReactions(def, 'Holy').damage;
  const withP = previewReactions(def, 'Holy', { poison: 4 }).damage;
  ok(without === 0 && withP === 4, `priming Poison 4 makes Holy worth 4 (got ${without} -> ${withP})`); }

console.log('forecastReactions describes what would fire (for the targeting readout):');
{ const { def } = setup(); give(def, 'poison', 4); give(def, 'soak', 2);
  const fc = forecastReactions(def, 'Fire');
  const verbs = fc.map((r) => r.verb);
  ok(verbs.includes('Combust') && verbs.includes('Steam'), `lists Combust + Steam (got ${verbs.join(', ')})`);
  const combust = fc.find((r) => r.verb === 'Combust');
  ok(combust.damage === 8 && combust.consumed, `Combust = 8 dmg, consumes Poison (dmg ${combust.damage}, consumed ${combust.consumed})`);
  ok(amt(def, 'poison') === 4 && amt(def, 'soak') === 2, 'forecast did not mutate the target'); }
{ const { def } = setup(); give(def, 'bleed', 3);
  const fc = forecastReactions(def, 'Frost');
  const frostbite = fc.find((r) => r.verb === 'Frostbite');
  ok(frostbite && frostbite.applied.some((a) => a.id === 'bleed') && !frostbite.consumed, 'amplify cell reports applied status, not consumed'); }
{ ok(forecastReactions({ hp: 10, statuses: [] }, 'Fire').length === 0, 'clean target → empty forecast'); }

console.log(`\nreactions: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
