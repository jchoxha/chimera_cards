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
const emptyPile = () => ({ deck: makeDeck(), hand: [], discard: [], exhaust: [] });

/** Card display fields for pile inspection (own piles + enemy piles seen face-up). */
const cardInfo = (c) => ({ iid: c.iid, id: c.id, name: c.name, element: c.element, type: c.type, cost: c.cost, priority: c.priority, scope: c.scope, reachesBack: c.reachesBack, effects: c.effects, text: c.text });
/** A pile shown with its ORDER hidden (sorted by name) — you know the contents, not the draw order. */
const pileHidden = (pile) => pile.map(cardInfo).sort((a, b) => a.name.localeCompare(b.name));
/** The enemy deck: cards whose id has been SEEN (played/discarded) show face-up; the rest are '?'. Order hidden. */
function deckInspect(deck, seen) {
  const known = [], unknown = [];
  for (const c of deck) (seen.has(c.id) ? known : unknown).push(c);
  known.sort((a, b) => a.name.localeCompare(b.name));
  return [...known.map((c) => ({ ...cardInfo(c), known: true })), ...unknown.map((c) => ({ iid: c.iid, known: false }))];
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
  const cards = {};   // BOTH sides own real piles now (enemy hand is hidden from the player)
  for (const side of ['p', 'e']) for (const sqId of state.sides[side]) cards[sqId] = drawInto(emptyPile(), HAND_SIZE);
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
  const c = cards[sqId] || { deck: [], hand: [], discard: [], exhaust: [] };
  snap.deckCount = c.deck.length; snap.discardCount = c.discard.length; snap.exhaustCount = c.exhaust.length;
  snap.discard = pileHidden(c.discard); snap.exhaust = pileHidden(c.exhaust);   // piles are visible to the player on BOTH sides
  if (side === 'p') {
    snap.hand = c.hand;                       // your own hand, face-up + draggable
    snap.deck = pileHidden(c.deck);           // your draw pile — contents known, order hidden
  } else {
    snap.handCount = c.hand.length;           // enemy hand: face-down count only
    snap.deck = deckInspect(c.deck, store.seen || new Set());   // '?' until seen
  }
  return snap;
}

function publish(store) {
  const { state, selectedSquadId } = store;
  return {
    version: (store.version || 0) + 1,
    phase: store.phase, outcome: store.outcome, log: store.log, dealKey: store.dealKey || 0,
    turn: store.turn || 1, logHistory: store.logHistory || [],
    selectedSquadId,
    enemy: state.sides.e.map((id) => squadSnap(store, id, 'e')),
    player: state.sides.p.map((id) => squadSnap(store, id, 'p')),
  };
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Turn the raw round log into readable combat-log entries (one per card played):
 *  "Turn 3 — Enemy Frostmind Attacked Friendly Ironhide with Strike, causing 8 Damage". */
export function formatRoundLog(state, log, turn) {
  const nameOf = (id) => state.unitsById[id]?.creature?.name || state.unitsById[id]?.name || 'Unknown';
  const sideLbl = (id) => (state.unitsById[id]?.side === 'e' ? 'Enemy' : 'Friendly');
  const entries = []; let cur = null;
  for (const e of log) {
    if (e.type === 'play') {
      cur = { turn, side: state.unitsById[e.ownerId]?.side || 'p', actor: nameOf(e.ownerId), actorSide: sideLbl(e.ownerId),
        verb: e.offensive ? 'Attacked' : 'Buffed', target: nameOf(e.targetId), targetSide: sideLbl(e.targetId),
        card: e.cardName || 'a card', effects: [] };
      entries.push(cur);
    } else if (cur) {
      if (e.type === 'damage') { const net = e.amount - (e.blocked || 0); cur.effects.push(`${net} Damage`); }
      else if (e.type === 'block') cur.effects.push(`${e.amount} Block`);
      else if (e.type === 'heal') cur.effects.push(`${e.amount} Heal`);
      else if (e.type === 'debuff') cur.effects.push(`${e.amount} ${cap(e.status || 'Debuff')}`);
      else if (e.type === 'buff') cur.effects.push(`${e.amount} ${cap(e.status || 'Buff')}`);
      else if (e.type === 'miss') cur.effects.push('Miss');
    }
  }
  for (const en of entries) {
    en.text = `Turn ${en.turn} — ${en.actorSide} ${en.actor} ${en.verb} ${en.targetSide} ${en.target} with ${en.card}`
      + (en.effects.length ? `, causing ${en.effects.join(', ')}` : '');
  }
  return entries;
}

const isOffensiveCard = (card) => (card?.effects || []).some((e) => e.op === 'damage' || e.op === 'debuff');

/**
 * OPPONENT PROVIDER seam (multiplayer-ready). The engine never assumes the enemy side
 * is an AI: `resolve()` asks a provider for the enemy's committed plan given the live
 * (state, cards). Today the only provider is `aiOpponent`; a NETWORK provider would
 * return the remote player's committed plan instead (same shape), and because the round
 * resolves from a shared seed the result is identical on both clients. Swap via
 * `useBattle.getState().setOpponent(fn)` — no engine change needed for multiplayer.
 * @typedef {(state:object, cards:object) => Record<string, object[]>} OpponentProvider
 */
export function aiOpponent(state, cards) { return enemyPlan(state, cards); }

/** Enemy AI: each enemy squad draws a real hand and plays affordable cards from it,
 *  aiming offense at the player's front squad. Returns per-squad plans. */
function enemyPlan(state, cards) {
  const plans = {};
  const targetFront = liveFrontUnit(state, state.squadsById[state.sides.p[0]]);
  for (const sqId of state.sides.e) {
    const squad = state.squadsById[sqId];
    const front = liveFrontUnit(state, squad);
    const pile = cards[sqId];
    if (!front || !pile) { plans[sqId] = []; continue; }
    const actions = []; let energy = squad.energy;
    for (const card of pile.hand) {
      const cost = card.cost ?? 1;
      if (cost > energy) continue;
      const offensive = isOffensiveCard(card);
      if (offensive && !targetFront) continue;
      actions.push({ ownerId: front.id, targetId: (offensive ? targetFront : front).id, card });
      energy -= cost;
    }
    plans[sqId] = actions;
  }
  return plans;
}

export const useBattle = create((set, get) => ({
  snapshot: null, state: null, plans: {}, cards: {}, seen: new Set(), queueOrder: [], selectedSquadId: null,
  phase: 'plan', outcome: null, log: [], version: 0, dealKey: 0, turn: 1, logHistory: [],
  opponent: aiOpponent,   // multiplayer seam: swap for a network provider (see aiOpponent)

  /** Replace the opponent provider (AI ↔ remote player). Netcode entry point. */
  setOpponent(fn) { set({ opponent: fn || aiOpponent }); },

  startBattle({ player, enemy }) {
    const { state, cards } = buildBattle(player, enemy);
    startRound(state);
    const base = { state, cards, seen: new Set(), plans: {}, queueOrder: [], selectedSquadId: state.sides.p[0], phase: 'plan', outcome: null, log: [], version: 0, dealKey: 1, turn: 1, logHistory: [] };
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
    const ePlan = (s.opponent || aiOpponent)(s.state, s.cards);
    const { log, outcome } = resolveBattleRound(s.state, { p: s.plans, e: ePlan }, rng);
    // discard played + leftover, draw fresh hands (unless the battle ended)
    const cards = { ...s.cards };
    const seen = new Set(s.seen);
    if (!outcome) {
      for (const sqId of s.state.sides.p) {
        const played = (s.plans[sqId] || []).map((a) => a.card);
        cards[sqId] = cycle(s.cards[sqId] || emptyPile(), played);
      }
      for (const sqId of s.state.sides.e) {
        const pile = s.cards[sqId] || emptyPile();
        const played = (ePlan[sqId] || []).map((a) => a.card);
        const playedIids = new Set(played.map((c) => c.iid));
        for (const c of pile.hand) seen.add(c.id);   // the whole enemy hand becomes visible (played or discarded)
        cards[sqId] = cycle({ ...pile, hand: pile.hand.filter((c) => !playedIids.has(c.iid)) }, played);
      }
    }
    const entries = formatRoundLog(s.state, log, s.turn);
    const logHistory = [...(s.logHistory || []), ...entries];
    const turn = outcome ? s.turn : s.turn + 1;
    const dealKey = (s.dealKey || 0) + 1;
    const next = { ...s, plans: {}, cards, seen, queueOrder: [], log, outcome, phase: outcome ? 'over' : 'plan', dealKey, turn, logHistory };
    set({ plans: {}, cards, seen, queueOrder: [], log, outcome, phase: next.phase, dealKey, turn, logHistory, snapshot: publish(next) });
    return { log, outcome, entries };
  },
}));
