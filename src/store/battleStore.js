// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/battleStore — Zustand bridge for the COMBAT-V2 squad engine ║
// ║ (src/engine/battle/*). Builds engine state from creatures; each PLAYER      ║
// ║ squad owns real card PILES (deck · hand · discard · exhaust). You blind-     ║
// ║ PLAN per squad (spending per-squad energy), commit with a placeholder enemy ║
// ║ plan, resolve ONE simultaneous round (round.js/battle.js), then discard the ║
// ║ hand and DRAW a fresh one (reshuffling discard into the deck when empty).   ║
// ║ Republishes an immutable snapshot (per-squad hand + pile COUNTS) the UI     ║
// ║ reads. Demo cards for now; the real generated decks land later.             ║
// ╚══════════════════════════════════════════════════════════════════╝
import { create } from 'zustand';
import { uid, shuffle } from '../utils.js';
import { buildState, makeUnit, liveFrontUnit, isAlive } from '../engine/battle/state.js';
import { battleStats } from '../engine/battle/stats.js';
import { resolveBattleRound, startRound, planCost } from '../engine/battle/battle.js';
import { creatureToFace } from '../ui/combat/creatureVisuals.jsx';

const rng = () => Math.random();
const HAND_SIZE = 5;

/** Demo battle cards for the current UI slice (op-list matches round.js).
 *  `scope` = front (squad-redirect default) · targeted (any one) · squad (whole squad) · field (whole side). */
export const DEMO_CARDS = {
  strike: { id: 'strike', name: 'Strike', cost: 1, type: 'attack', element: 'Physical', priority: 0, scope: 'front', effects: [{ op: 'damage', value: 8 }], text: 'Deal 8 damage.' },
  cleave: { id: 'cleave', name: 'Cleave', cost: 2, type: 'attack', element: 'Physical', priority: 0, scope: 'targeted', reachesBack: true, effects: [{ op: 'damage', value: 12 }], text: 'Deal 12 to any one creature (front or back).' },
  jab: { id: 'jab', name: 'Quick Jab', cost: 1, type: 'attack', element: 'Physical', priority: 1, scope: 'front', effects: [{ op: 'damage', value: 5 }], text: 'Priority. Deal 5 damage.' },
  sweep: { id: 'sweep', name: 'Whirl Sweep', cost: 2, type: 'attack', element: 'Physical', priority: 0, scope: 'squad', effects: [{ op: 'damage', value: 6 }], text: 'Deal 6 to an entire enemy squad.' },
  volley: { id: 'volley', name: 'Arc Volley', cost: 3, type: 'attack', element: 'Energy', priority: 0, scope: 'field', effects: [{ op: 'damage', value: 4 }], text: 'Deal 4 to every enemy creature.' },
  guard: { id: 'guard', name: 'Guard', cost: 1, type: 'skill', element: 'Physical', priority: 2, scope: 'self', effects: [{ op: 'block', value: 9 }], text: 'Priority. Gain 9 Block (temporary HP).' },
  rally: { id: 'rally', name: 'Rally', cost: 2, type: 'skill', element: 'Holy', priority: 2, scope: 'squad', effects: [{ op: 'block', value: 6 }], text: 'Priority. Give your squad 6 Block.' },
  weaken: { id: 'weaken', name: 'Weaken', cost: 1, type: 'skill', element: 'Void', priority: 0, scope: 'front', effects: [{ op: 'debuff', value: 2, status: 'weak' }], text: 'Apply 2 Weak.' },
  overload: { id: 'overload', name: 'Overload', cost: 2, type: 'skill', element: 'Energy', priority: 1, scope: 'self', exhaust: true, effects: [{ op: 'buff', value: 2, status: 'strength' }], text: 'Exhaust. Gain 2 Strength.' },
};
const DEMO_DECK = ['strike', 'strike', 'strike', 'jab', 'jab', 'guard', 'guard', 'sweep', 'cleave', 'weaken', 'rally', 'overload'];
const inst = (id) => ({ ...DEMO_CARDS[id], iid: `${id}#${uid()}` });
const makeDeck = () => shuffle(DEMO_DECK.map(inst));

/** Draw `n` cards into hand, reshuffling discard into the deck when it runs dry. */
function drawInto(p, n) {
  const c = { deck: [...p.deck], hand: [...p.hand], discard: [...p.discard], exhaust: [...p.exhaust] };
  for (let i = 0; i < n; i++) {
    if (!c.deck.length) { if (!c.discard.length) break; c.deck = shuffle(c.discard); c.discard = []; }
    c.hand.push(c.deck.shift());
  }
  return c;
}
/** End-of-round: played cards → exhaust/discard, leftover hand → discard, then draw a fresh hand. */
function cycle(p, playedCards) {
  const c = { deck: [...p.deck], hand: [], discard: [...p.discard], exhaust: [...p.exhaust] };
  for (const card of playedCards) (card.exhaust ? c.exhaust : c.discard).push(card);
  for (const card of p.hand) c.discard.push(card);   // unplayed cards discard
  return drawInto(c, HAND_SIZE);
}

/** creature → engine battle unit (7-stat line + hp); keeps the creature for the card face. */
function creatureToUnit(creature, id) {
  const { stats } = battleStats(creature.biology, creature.subtypes, creature.family || null);
  const maxHp = creature.maxHp || 40;
  const u = makeUnit({ id, stats, hp: maxHp, maxHp });
  u.creature = creature;
  return u;
}

/** Build engine state + per-squad card piles from squad specs [{ id, creatures:[creature] }]. */
function buildBattle(playerSquads, enemySquads) {
  const spec = { p: [], e: [] };
  const toSide = (squads, side) => squads.map((sq, i) => ({
    id: `${side}${i}`,
    members: sq.creatures.map((c, j) => creatureToUnit(c, `${side}${i}_${j}_${uid()}`)),
  }));
  spec.p = toSide(playerSquads, 'p');
  spec.e = toSide(enemySquads, 'e');
  const state = buildState(spec);
  const cards = {};
  for (const sqId of state.sides.p) cards[sqId] = drawInto({ deck: makeDeck(), hand: [], discard: [], exhaust: [] }, HAND_SIZE);
  return { state, cards };
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
  const { state, plans, cards } = store;
  const squad = state.squadsById[sqId];
  const units = squad.memberIds.map((id) => unitFace(state, state.unitsById[id], squad));
  const plan = plans[sqId] || [];
  const snap = {
    id: sqId, side, maxEnergy: squad.maxEnergy, energy: squad.energy,
    energyLeft: Math.max(0, squad.energy - planCost(plan)),
    frontId: liveFrontUnit(state, squad)?.id || null, units,
    plan: plan.map((a) => ({ card: a.card, targetId: a.targetId })),
  };
  if (side === 'p') {
    const c = cards[sqId] || { deck: [], hand: [], discard: [], exhaust: [] };
    snap.hand = c.hand;
    snap.deckCount = c.deck.length; snap.discardCount = c.discard.length; snap.exhaustCount = c.exhaust.length;
  }
  return snap;
}

function publish(store) {
  const { state, selectedSquadId } = store;
  return {
    version: (store.version || 0) + 1,
    phase: store.phase, outcome: store.outcome, log: store.log, dealKey: store.dealKey || 0,
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
  snapshot: null, state: null, plans: {}, cards: {}, queueOrder: [], selectedSquadId: null,
  phase: 'plan', outcome: null, log: [], version: 0, dealKey: 0,

  startBattle({ player, enemy }) {
    const { state, cards } = buildBattle(player, enemy);
    startRound(state);
    const base = { state, cards, plans: {}, queueOrder: [], selectedSquadId: state.sides.p[0], phase: 'plan', outcome: null, log: [], version: 0, dealKey: 1 };
    set({ ...base, snapshot: publish({ ...get(), ...base }) });
  },

  selectSquad(sqId) { set((s) => ({ selectedSquadId: sqId, snapshot: publish({ ...s, selectedSquadId: sqId }) })); },

  /** Queue a hand card (by iid) from the selected squad onto a target unit. */
  queueCard(handIid, targetId) {
    const s = get();
    const sqId = s.selectedSquadId; if (!sqId) return;
    const squad = s.state.squadsById[sqId]; if (!squad || squad.side !== 'p') return;
    const front = liveFrontUnit(s.state, squad); if (!front) return;
    const pile = s.cards[sqId] || { hand: [] };
    const card = pile.hand.find((c) => c.iid === handIid); if (!card) return;
    const plan = s.plans[sqId] || [];
    if (planCost(plan) + (card.cost ?? 1) > squad.energy) return;   // not enough energy
    const plans = { ...s.plans, [sqId]: [...plan, { ownerId: front.id, targetId, card }] };
    const cards = { ...s.cards, [sqId]: { ...pile, hand: pile.hand.filter((c) => c.iid !== handIid) } };
    const queueOrder = [...s.queueOrder, sqId];
    set({ plans, cards, queueOrder, snapshot: publish({ ...s, plans, cards }) });
  },

  /** Undo the MOST RECENT queued move across all squads (returns its card to hand). */
  undoLast() {
    const s = get();
    if (!s.queueOrder.length) return;
    const queueOrder = s.queueOrder.slice(0, -1);
    const sqId = s.queueOrder[s.queueOrder.length - 1];
    const plan = s.plans[sqId] || []; if (!plan.length) { set({ queueOrder }); return; }
    const last = plan[plan.length - 1];
    const pile = s.cards[sqId] || { hand: [] };
    const plans = { ...s.plans, [sqId]: plan.slice(0, -1) };
    const cards = { ...s.cards, [sqId]: { ...pile, hand: [...pile.hand, last.card] } };
    set({ plans, cards, queueOrder, snapshot: publish({ ...s, plans, cards }) });
  },

  /** Reset ALL of this turn's queued moves (return every card to its hand). */
  resetPlans() {
    const s = get();
    if (!s.queueOrder.length) return;
    const cards = { ...s.cards };
    for (const [sqId, plan] of Object.entries(s.plans)) {
      if (plan?.length) { const pile = cards[sqId] || { hand: [] }; cards[sqId] = { ...pile, hand: [...pile.hand, ...plan.map((a) => a.card)] }; }
    }
    set({ plans: {}, cards, queueOrder: [], snapshot: publish({ ...s, plans: {}, cards }) });
  },

  /** Commit the plan (+ enemy AI) and resolve one simultaneous round. Returns the log
   *  so the UI can play it back before the final snapshot is shown. */
  resolve() {
    const s = get();
    if (s.phase !== 'plan') return { log: [], outcome: null };
    const ePlan = enemyPlan(s.state);
    const { log, outcome } = resolveBattleRound(s.state, { p: s.plans, e: ePlan }, rng);
    // discard played + leftover, draw fresh hands (unless the battle ended)
    const cards = { ...s.cards };
    if (!outcome) {
      for (const sqId of s.state.sides.p) {
        const played = (s.plans[sqId] || []).map((a) => a.card);
        cards[sqId] = cycle(s.cards[sqId] || { deck: makeDeck(), hand: [], discard: [], exhaust: [] }, played);
      }
    }
    const dealKey = (s.dealKey || 0) + 1;
    const next = { ...s, plans: {}, cards, queueOrder: [], log, outcome, phase: outcome ? 'over' : 'plan', dealKey };
    set({ plans: {}, cards, queueOrder: [], log, outcome, phase: next.phase, dealKey, snapshot: publish(next) });
    return { log, outcome };
  },
}));
