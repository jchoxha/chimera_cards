// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/battleStore — Zustand bridge for the COMBAT-V2 squad engine ║
// ║ (src/engine/battle/*). Builds engine state from creatures, holds the       ║
// ║ player's in-progress blind PLAN per squad (spending per-squad energy),     ║
// ║ commits it with a placeholder enemy plan, resolves ONE simultaneous round  ║
// ║ (round.js/battle.js), and republishes an immutable snapshot the UI reads.  ║
// ║ FIRST UI SLICE: hands are a small demo card set (the real per-squad shared ║
// ║ deck/draw + AI planner land later). UPDATE WHEN: the battle store API or   ║
// ║ snapshot shape changes.                                                    ║
// ╚══════════════════════════════════════════════════════════════════╝
import { create } from 'zustand';
import { uid } from '../utils.js';
import { buildState, makeUnit, liveFrontUnit, isAlive } from '../engine/battle/state.js';
import { battleStats } from '../engine/battle/stats.js';
import { resolveBattleRound, startRound, planCost } from '../engine/battle/battle.js';
import { creatureToFace } from '../ui/combat/creatureVisuals.jsx';

const rng = () => Math.random();

/** Demo battle cards for the first UI slice (op-list matches round.js). */
export const DEMO_CARDS = {
  strike: { id: 'strike', name: 'Strike', cost: 1, type: 'attack', element: 'Physical', priority: 0, effects: [{ op: 'damage', value: 8 }], text: 'Deal 8 damage.' },
  cleave: { id: 'cleave', name: 'Cleave', cost: 2, type: 'attack', element: 'Physical', priority: 0, reachesBack: true, effects: [{ op: 'damage', value: 12 }], text: 'Deal 12. Can strike the back row.' },
  jab: { id: 'jab', name: 'Quick Jab', cost: 1, type: 'attack', element: 'Physical', priority: 1, effects: [{ op: 'damage', value: 5 }], text: 'Priority. Deal 5 damage.' },
  guard: { id: 'guard', name: 'Guard', cost: 1, type: 'skill', element: 'Physical', priority: 2, effects: [{ op: 'block', value: 9 }], text: 'Priority. Gain 9 Block (temporary HP).' },
  weaken: { id: 'weaken', name: 'Weaken', cost: 1, type: 'skill', element: 'Void', priority: 0, effects: [{ op: 'debuff', value: 2, status: 'weak' }], text: 'Apply 2 Weak.' },
};
const DEMO_DECK = ['strike', 'strike', 'strike', 'jab', 'guard', 'guard', 'cleave', 'weaken'];
const drawHand = (n = 5) => Array.from({ length: n }, () => {
  const id = DEMO_DECK[Math.floor(Math.random() * DEMO_DECK.length)];
  return { ...DEMO_CARDS[id], iid: `${id}#${uid()}` };
});

/** creature → engine battle unit (7-stat line + hp); keeps the creature for the card face. */
function creatureToUnit(creature, id) {
  const { stats } = battleStats(creature.biology, creature.subtypes, creature.family || null);
  const maxHp = creature.maxHp || 40;
  const u = makeUnit({ id, stats, hp: maxHp, maxHp });
  u.creature = creature;
  return u;
}

/** Build engine state + per-squad hands from squad specs [{ id, creatures:[creature] }]. */
function buildBattle(playerSquads, enemySquads) {
  const spec = { p: [], e: [] };
  const toSide = (squads, side) => squads.map((sq, i) => ({
    id: `${side}${i}`,
    members: sq.creatures.map((c, j) => creatureToUnit(c, `${side}${i}_${j}_${uid()}`)),
  }));
  spec.p = toSide(playerSquads, 'p');
  spec.e = toSide(enemySquads, 'e');
  const state = buildState(spec);
  const hands = {};
  for (const sqId of state.sides.p) hands[sqId] = drawHand();
  return { state, hands };
}

/** face + live combat fields for one unit. */
function unitFace(state, u, squad) {
  const face = creatureToFace(u.creature);
  return {
    ...face,
    id: u.id, hp: u.hp, maxHp: u.maxHp, block: u.block, statuses: u.statuses,
    isFront: liveFrontUnit(state, squad)?.id === u.id,
    dead: !isAlive(u),
  };
}

function squadSnap(store, sqId, side) {
  const { state, plans, hands } = store;
  const squad = state.squadsById[sqId];
  const units = squad.memberIds.map((id) => unitFace(state, state.unitsById[id], squad));
  const plan = plans[sqId] || [];
  const snap = {
    id: sqId, side, maxEnergy: squad.maxEnergy, energy: squad.energy,
    energyLeft: Math.max(0, squad.energy - planCost(plan)),
    frontId: liveFrontUnit(state, squad)?.id || null, units,
    plan: plan.map((a) => ({ card: a.card, targetId: a.targetId })),
  };
  if (side === 'p') snap.hand = hands[sqId] || [];
  return snap;
}

function publish(store) {
  const { state, selectedSquadId } = store;
  return {
    version: (store.version || 0) + 1,
    phase: store.phase, outcome: store.outcome, log: store.log,
    selectedSquadId,
    enemy: state.sides.e.map((id) => squadSnap(store, id, 'e')),
    player: state.sides.p.map((id) => squadSnap(store, id, 'p')),
  };
}

/** Placeholder enemy AI: each enemy squad spends its energy on Strikes at the player's front squad. */
function enemyPlan(state) {
  const plans = {};
  const targetFront = liveFrontUnit(state, state.squadsById[state.sides.p[0]]);
  if (!targetFront) return plans;
  for (const sqId of state.sides.e) {
    const squad = state.squadsById[sqId];
    const front = liveFrontUnit(state, squad);
    if (!front) continue;
    const actions = []; let energy = squad.energy;
    while (energy >= 1) { actions.push({ ownerId: front.id, targetId: targetFront.id, card: { ...DEMO_CARDS.strike } }); energy -= 1; }
    plans[sqId] = actions;
  }
  return plans;
}

export const useBattle = create((set, get) => ({
  snapshot: null, state: null, plans: {}, hands: {}, queueOrder: [], selectedSquadId: null,
  phase: 'plan', outcome: null, log: [], version: 0,

  startBattle({ player, enemy }) {
    const { state, hands } = buildBattle(player, enemy);
    startRound(state);
    const base = { state, hands, plans: {}, queueOrder: [], selectedSquadId: state.sides.p[0], phase: 'plan', outcome: null, log: [], version: 0 };
    set({ ...base, snapshot: publish({ ...get(), ...base }) });
  },

  selectSquad(sqId) { set((s) => ({ selectedSquadId: sqId, snapshot: publish({ ...s, selectedSquadId: sqId }) })); },

  /** Queue a hand card (by iid) from the selected squad onto a target unit. */
  queueCard(handIid, targetId) {
    const s = get();
    const sqId = s.selectedSquadId; if (!sqId) return;
    const squad = s.state.squadsById[sqId];
    const front = liveFrontUnit(s.state, squad); if (!front) return;
    const hand = s.hands[sqId] || [];
    const card = hand.find((c) => c.iid === handIid); if (!card) return;
    const plan = s.plans[sqId] || [];
    if (planCost(plan) + (card.cost ?? 1) > squad.energy) return;   // not enough energy
    const nextPlan = [...plan, { ownerId: front.id, targetId, card }];
    const nextHand = hand.filter((c) => c.iid !== handIid);
    const plans = { ...s.plans, [sqId]: nextPlan };
    const hands = { ...s.hands, [sqId]: nextHand };
    const queueOrder = [...s.queueOrder, sqId];
    set({ plans, hands, queueOrder, snapshot: publish({ ...s, plans, hands }) });
  },

  /** Undo the MOST RECENT queued move across all squads (returns its card to hand). */
  undoLast() {
    const s = get();
    if (!s.queueOrder.length) return;
    const queueOrder = s.queueOrder.slice(0, -1);
    const sqId = s.queueOrder[s.queueOrder.length - 1];
    const plan = s.plans[sqId] || []; if (!plan.length) { set({ queueOrder }); return; }
    const last = plan[plan.length - 1];
    const plans = { ...s.plans, [sqId]: plan.slice(0, -1) };
    const hands = { ...s.hands, [sqId]: [...(s.hands[sqId] || []), last.card] };
    set({ plans, hands, queueOrder, snapshot: publish({ ...s, plans, hands }) });
  },

  /** Reset ALL of this turn's queued moves (return every card to its hand). */
  resetPlans() {
    const s = get();
    if (!s.queueOrder.length) return;
    const hands = { ...s.hands };
    for (const [sqId, plan] of Object.entries(s.plans)) {
      if (plan?.length) hands[sqId] = [...(hands[sqId] || []), ...plan.map((a) => a.card)];
    }
    set({ plans: {}, hands, queueOrder: [], snapshot: publish({ ...s, plans: {}, hands }) });
  },

  /** Commit the plan (+ enemy AI) and resolve one simultaneous round. Returns the log
   *  so the UI can play it back before the final snapshot is shown. */
  resolve() {
    const s = get();
    if (s.phase !== 'plan') return { log: [], outcome: null };
    const ePlan = enemyPlan(s.state);
    const { log, outcome } = resolveBattleRound(s.state, { p: s.plans, e: ePlan }, rng);
    const hands = {};
    for (const sqId of s.state.sides.p) hands[sqId] = drawHand();   // fresh hands next round
    const next = { ...s, plans: {}, hands, queueOrder: [], log, outcome, phase: outcome ? 'over' : 'plan' };
    set({ plans: {}, hands, queueOrder: [], log, outcome, phase: next.phase, snapshot: publish(next) });
    return { log, outcome };
  },
}));
