// Structural smoke test for the Vanguard/Peek state shells + scope vocabulary.
// Run: node src/engine/combat/__smoke__.mjs   (also: npm run test:combat)
//
// Phase 1 boilerplate ONLY: this asserts the schema BOOTS into valid, empty
// side models with correct initial resource baselines, that the typing cap
// holds, and that every locked TargetScope token maps without throwing. It does
// NOT exercise turn behavior (none exists yet).

import {
  createCombatState, createSide, createFighter, createPlannedAction,
  computeEnergyPerTurn, COMBAT_DEFAULTS,
  TARGET_SCOPES, SCOPE_TABLE, describeScope, isValidScope, assertScopeTableComplete,
  PHASES, MAX_TYPES,
} from '../index.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));
const threw = (fn) => { try { fn(); return false; } catch { return true; } };

console.log('Side shell + resource baselines:');
{
  const side = createSide();
  ok(Array.isArray(side.fighters) && side.fighters.length === 0, 'empty side has no fighters');
  ok(side.vanguardIndex === 0, 'vanguardIndex baseline 0');
  ok(side.manualSwapsThisTurn === 0, 'manualSwapsThisTurn baseline 0');
  // empty side (0 fighters) → bench=0 → max(3,0)=3 — same floor for both sides
  ok(side.energyPerTurn === COMBAT_DEFAULTS.energyPerTurn, 'empty side bench formula → floor 3');
  ok(side.energy === side.energyPerTurn, 'energy seeded to its per-turn baseline');
  ok(side.handSize === COMBAT_DEFAULTS.handSize, 'handSize baseline 5');
  ok(side.fortifySlot && Array.isArray(side.fortifySlot.statuses) && side.fortifySlot.block === 0,
    'fortifySlot is an empty aura zone (statuses [], block 0)');
}

console.log('Enemy energy formula max(3, benched):');
{
  const f = (n) => createFighter({ id: `e${n}`, name: `E${n}`, types: [{ type: 'pyre', weight: 1 }], hp: 10 });
  ok(computeEnergyPerTurn([f(1)], 'bench', COMBAT_DEFAULTS) === 3, '1 fighter (0 benched) → floor 3');
  ok(computeEnergyPerTurn([f(1), f(2)], 'bench', COMBAT_DEFAULTS) === 3, '2 fighters (1 benched) → floor 3');
  ok(computeEnergyPerTurn([f(1), f(2), f(3), f(4), f(5)], 'bench', COMBAT_DEFAULTS) === 4,
    '5 fighters (4 benched) → 4');
}

console.log('Fighter shell + absolute typing cap:');
{
  const three = createFighter({
    id: 'm1', name: 'Overtyped',
    types: [{ type: 'pyre', weight: 0.4 }, { type: 'beast', weight: 0.4 }, { type: 'frost', weight: 0.2 }],
    hp: 30,
  });
  ok(MAX_TYPES === 2, 'MAX_TYPES locked to 2');
  ok(three.types.length === 2, 'createFighter caps types at 2 (dropped the 3rd)');
  ok(three.block === 0 && three.statuses.length === 0, 'fighter boots with 0 block, no statuses');
  ok(three.deck.drawPile.length === 0 && three.deck.discardPile.length === 0 && three.deck.exhaustPile.length === 0,
    'fighter owns empty draw/discard/exhaust piles');
  ok(Array.isArray(three.hand) && three.hand.length === 0, 'fighter hand starts empty');
  ok(three.maxHp === 30, 'maxHp defaults to hp when omitted');
}

console.log('CombatState boots valid & symmetrical:');
{
  const mk = (id) => createFighter({ id, name: id, types: [{ type: 'frost', weight: 1 }], hp: 20 });
  const state = createCombatState({
    playerFighters: [mk('p1'), mk('p2')],
    enemyFighters: [mk('x1'), mk('x2'), mk('x3')],
    room: 'elite',
  });
  ok(state.phase === PHASES.DRAW, 'boots into DRAW phase');
  ok(state.turn === 0, 'turn counter starts at 0');
  ok(!!state.player && !!state.enemy, 'has symmetrical player & enemy sides');
  ok(state.player.energyPerTurn === 3, 'player side (2 fighters, 1 benched) → floor 3');
  ok(state.enemy.energyPerTurn === 3, 'enemy side (3 fighters, 2 benched) → floor 3');
  ok(state.peekCharges === COMBAT_DEFAULTS.peekCharges, 'peekCharges default 3');
  ok(state.monstersCapturedThisFight === 0, 'capture counter starts at 0');
  ok(Array.isArray(state.enemyPlan) && state.enemyPlan.length === 0, 'enemyPlan starts empty');
  ok(state.room === 'elite', 'room threads through');
}

console.log('PlannedAction shell:');
{
  const pa = createPlannedAction({ silhouette: 'attack', actor: 'x1', detail: { value: 6 } });
  ok(pa.revealed === false, 'planned action starts hidden (revealed false)');
  ok(pa.silhouette === 'attack' && pa.actor === 'x1', 'silhouette + actor recorded');
}

console.log('TargetScope vocabulary maps without crashing:');
{
  ok(TARGET_SCOPES.length === 18, 'all 18 locked tokens present in the enum');
  ok(assertScopeTableComplete() === true, 'SCOPE_TABLE matches TARGET_SCOPES exactly (no drift)');
  let mapped = 0;
  for (const scope of TARGET_SCOPES) {
    const d = describeScope(scope); // must not throw for any locked token
    if (d && d.side && d.zone && d.selection) mapped++;
  }
  ok(mapped === TARGET_SCOPES.length, 'every token resolves to a {side, zone, selection} descriptor');
  ok(SCOPE_TABLE.piercingEnemyTarget.piercing === true, 'piercing scope flagged piercing');
  ok(SCOPE_TABLE.otherFriendlyBench.excludesSelf === true, 'other* scope flagged excludesSelf');
  ok(SCOPE_TABLE.selfOnlyTarget.side === 'self', 'selfOnlyTarget classified as self side');
  ok(SCOPE_TABLE.wholeField.side === 'both' && SCOPE_TABLE.wholeField.selection === 'all',
    'wholeField classified as both-sides all-selection (always friendly-fire)');
  ok(!isValidScope('vanguardFriendlySlotTarget') && !isValidScope('vanguardEnemySlotTarget'),
    'slot scope tokens removed — fortify uses CardEffects.fortify');
  ok(isValidScope('wholeField') && !isValidScope('notAToken'), 'isValidScope guards unknown tokens');
  ok(threw(() => describeScope('notAToken')), 'describeScope throws on an unknown token');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
