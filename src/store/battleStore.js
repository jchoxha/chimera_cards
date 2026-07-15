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
import { buildState, makeUnit, makeSquad, liveFrontUnit, isAlive } from '../engine/battle/state.js';
import { battleStats, attackDamage } from '../engine/battle/stats.js';
import { computeMatchup } from '../engine/content/matchups.js';
import { resolveBattleRound, startRound, planCost } from '../engine/battle/battle.js';
import { kitDeckFor } from '../engine/battle/kitDeck.js';
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
  overload: { id: 'overload', name: 'Overload', cost: 2, type: 'skill', element: 'Energy', priority: 1, scope: 'self', exhaust: true, effects: [{ op: 'buff', value: 2, status: 'strength' }], text: 'Banish. Gain 2 Strength.' },
};
// OPTION A — cards are OWNED by a creature and cast by it (from the safety of the back row for a
// Support), but all of a squad's cards draw into ONE shared hand on shared squad energy. A card
// whose owner is dead becomes unplayable. A unit's deck comes from its real biology/typing KIT
// (kitDeckFor → the v1 generator adapted to the v2 engine), so each creature's cards express its
// identity (a Fire creature's strikes deal Fire, a Nature beast applies Poison, etc.).
const inst = (def, ownerId) => ({ ...def, iid: `${def.id}#${uid()}`, ownerId });
const personalDeck = (unit) => kitDeckFor(unit.creature).map((def) => inst(def, unit.id));
/** A squad's combined deck = each member's kit deck (stamped with its owner), shuffled. */
const squadDeckFor = (memberUnits) => shuffle(memberUnits.flatMap((u) => personalDeck(u)));

/** REWARD POOL — cards a victory can add to a creature's deck. Every card here uses ONLY the
 *  mechanically-live effects (damage incl. multi-hit · block · heal · poison DoT · regen), so a
 *  reward always changes how the fight plays, never a dead pip. `rarity` weights the draft. */
export const REWARD_POOL = {
  ironStrike: { id: 'ironStrike', name: 'Iron Strike', cost: 2, type: 'attack', element: 'Physical', priority: 0, scope: 'front', rarity: 'common', effects: [{ op: 'damage', value: 14 }], text: 'Deal 14 damage.' },
  twinFang: { id: 'twinFang', name: 'Twin Fang', cost: 1, type: 'attack', element: 'Physical', priority: 0, scope: 'targeted', reachesBack: true, rarity: 'common', effects: [{ op: 'damage', value: 5 }, { op: 'damage', value: 5 }], text: 'Deal 5 damage twice to any one creature.' },
  toxicBite: { id: 'toxicBite', name: 'Toxic Bite', cost: 1, type: 'attack', element: 'Nature', priority: 0, scope: 'front', rarity: 'common', effects: [{ op: 'damage', value: 4 }, { op: 'debuff', value: 4, status: 'poison' }], text: 'Deal 4 damage and apply 4 Poison.' },
  bulwark: { id: 'bulwark', name: 'Bulwark', cost: 2, type: 'skill', element: 'Stone', priority: 2, scope: 'self', rarity: 'common', effects: [{ op: 'block', value: 16 }], text: 'Priority. Gain 16 Block.' },
  quake: { id: 'quake', name: 'Quake', cost: 2, type: 'attack', element: 'Physical', priority: 0, scope: 'squad', rarity: 'rare', effects: [{ op: 'damage', value: 9 }], text: 'Deal 9 to an entire enemy squad.' },
  venomSpray: { id: 'venomSpray', name: 'Venom Spray', cost: 2, type: 'skill', element: 'Nature', priority: 0, scope: 'squad', rarity: 'rare', effects: [{ op: 'debuff', value: 4, status: 'poison' }], text: 'Apply 4 Poison to an enemy squad.' },
  mend: { id: 'mend', name: 'Mend', cost: 1, type: 'skill', element: 'Holy', priority: 2, scope: 'self', rarity: 'common', effects: [{ op: 'heal', value: 12 }], text: 'Priority. Heal 12 HP.' },
  renew: { id: 'renew', name: 'Renew', cost: 2, type: 'skill', element: 'Holy', priority: 2, scope: 'squad', rarity: 'rare', effects: [{ op: 'buff', value: 3, status: 'regen' }], text: 'Priority. Give your squad 3 Regen.' },
  thunderclap: { id: 'thunderclap', name: 'Thunderclap', cost: 3, type: 'attack', element: 'Energy', priority: 0, scope: 'field', rarity: 'epic', effects: [{ op: 'damage', value: 7 }], text: 'Deal 7 to every enemy creature.' },
  execute: { id: 'execute', name: 'Execute', cost: 2, type: 'attack', element: 'Void', priority: 0, scope: 'targeted', reachesBack: true, rarity: 'epic', effects: [{ op: 'damage', value: 20 }], text: 'Deal 20 to any one creature.' },
};
const REWARD_WEIGHT = { common: 5, rare: 3, epic: 1 };
/** Draft `n` distinct reward cards (rarity-weighted). Returns card DEFS (not instances). */
export function draftReward(n = 3) {
  const bag = [];
  for (const [id, c] of Object.entries(REWARD_POOL)) for (let i = 0; i < (REWARD_WEIGHT[c.rarity] || 1); i++) bag.push(id);
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const id = bag[Math.floor(rng() * bag.length)];
    if (seen.has(id)) continue;
    seen.add(id); out.push({ ...REWARD_POOL[id] });
  }
  return out;
}

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
const emptyPile = () => ({ deck: [], hand: [], discard: [], exhaust: [] });   // real decks build from squad members

/** Card display fields for pile inspection (own piles + enemy piles seen face-up). */
const cardInfo = (c) => ({ iid: c.iid, id: c.id, name: c.name, element: c.element, type: c.type, cost: c.cost, priority: c.priority, scope: c.scope, reachesBack: c.reachesBack, effects: c.effects, text: c.text, ownerId: c.ownerId });
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
  const cards = {};   // BOTH sides own real piles; each squad's deck = its members' OWNED cards
  for (const side of ['p', 'e']) for (const sqId of state.sides[side]) {
    const members = state.squadsById[sqId].memberIds.map((id) => state.unitsById[id]);
    cards[sqId] = drawInto({ deck: squadDeckFor(members), hand: [], discard: [], exhaust: [] }, HAND_SIZE);
  }
  return { state, cards };
}

/** face + live combat fields for one unit. */
function unitFace(state, u, squad) {
  const face = creatureToFace(u.creature);
  return {
    ...face,
    id: u.id, hp: u.hp, maxHp: u.maxHp, block: u.block, statuses: u.statuses,
    isFront: liveFrontUnit(state, squad)?.id === u.id,
    formation: u.formation || null,        // Vanguard's aura from its Support (attack/defense) — for a pip
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
    plan: plan.map((a) => ({ card: a.card, targetId: a.targetId, ownerId: a.ownerId })),
  };
  const c = cards[sqId] || { deck: [], hand: [], discard: [], exhaust: [] };
  snap.deckCount = c.deck.length; snap.discardCount = c.discard.length; snap.exhaustCount = c.exhaust.length;
  snap.discard = pileHidden(c.discard); snap.exhaust = pileHidden(c.exhaust);   // piles are visible to the player on BOTH sides
  if (side === 'p') {
    snap.stunned = (store.stunnedSquads || []).includes(sqId);   // failed a run-away roll → can't plan this round
    snap.hand = c.hand;                       // your own hand, face-up + draggable (each carries ownerId)
    snap.deck = pileHidden(c.deck);           // your draw pile — contents known, order hidden
  } else {
    snap.handCount = c.hand.length;           // enemy hand: face-down count only
    snap.deck = deckInspect(c.deck, store.seen || new Set());   // '?' until seen
  }
  return snap;
}

/** PREDICTED incoming damage per unit from the player's CURRENTLY QUEUED plan (StS-style intent,
 *  but for YOUR own moves — never reveals the enemy's). Honors card scope (front/targeted hit the
 *  target; squad hits its squad; field hits the whole side) and the real Attack÷Defense scaling. */
function predictIncoming(state, plans) {
  const inc = {};
  const add = (id, n) => { if (n > 0) inc[id] = (inc[id] || 0) + n; };
  const squadOf = (uid) => Object.values(state.squadsById).find((sq) => sq.memberIds.includes(uid));
  for (const sqId of Object.keys(plans || {})) {
    for (const a of plans[sqId] || []) {
      const owner = state.unitsById[a.ownerId], tgt = state.unitsById[a.targetId];
      if (!owner || !tgt) continue;
      const card = a.card;
      const dmgEffs = (card.effects || []).filter((e) => e.op === 'damage');
      if (!dmgEffs.length) continue;
      const scope = card.scope || (card.reachesBack ? 'targeted' : 'front');
      const tsq = squadOf(tgt.id);
      let targets = [tgt];
      if (scope === 'field' && tsq) targets = state.sides[tsq.side].flatMap((id) => state.squadsById[id].memberIds.map((m) => state.unitsById[m])).filter((u) => u && isAlive(u));
      else if (scope === 'squad' && tsq) targets = tsq.memberIds.map((m) => state.unitsById[m]).filter((u) => u && isAlive(u));
      for (const t of targets) {
        const mult = (card.element && t.creature) ? computeMatchup({ attunement: [card.element] }, t.creature).total : 1;
        let per = 0; for (const e of dmgEffs) per += attackDamage(e.value, owner.stats.attack, t.stats.defense, mult);
        add(t.id, per);
      }
    }
  }
  return inc;
}

function publish(store) {
  const { state, selectedSquadId } = store;
  return {
    incoming: predictIncoming(state, store.plans),
    version: (store.version || 0) + 1,
    phase: store.phase, outcome: store.outcome, log: store.log, dealKey: store.dealKey || 0,
    turn: store.turn || 1, logHistory: store.logHistory || [], startedAt: store.startedAt || null,
    selectedSquadId, canRedo: (store.undone || []).length > 0, runPassed: store.runPassed || [],
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
  const elOf = (id) => state.unitsById[id]?.creature?.element || null;
  const entries = []; let cur = null;
  for (const e of log) {
    if (e.type === 'play') {
      cur = { turn, side: state.unitsById[e.ownerId]?.side || 'p', actor: nameOf(e.ownerId), actorSide: sideLbl(e.ownerId),
        verb: e.offensive ? 'Attacked' : 'Buffed', target: nameOf(e.targetId), targetSide: sideLbl(e.targetId),
        card: e.cardName || 'a card', effects: [],
        // ids + element + the card spec so the UI can render clickable crests, tinted card
        // chips, AND open the full card face on click.
        ownerId: e.ownerId, targetId: e.targetId, cardId: e.card, cardObj: DEMO_CARDS[e.card] || null,
        offensive: !!e.offensive, element: elOf(e.ownerId) };
      entries.push(cur);
    } else if (cur) {
      // "N Damage Taken" (what got past block) + ", X Blocked" for the absorbed portion.
      if (e.type === 'damage') { const taken = (e.amount || 0) - (e.blocked || 0); cur.effects.push(`${taken} Damage Taken${e.eff ? ` (${e.eff})` : ''}`); if (e.blocked > 0) cur.effects.push(`${e.blocked} Blocked`); }
      // block / buffs read as "N ... Granted"
      else if (e.type === 'block') cur.effects.push(`${e.amount} Block Granted`);
      else if (e.type === 'heal') cur.effects.push(`${e.amount} Healed`);
      else if (e.type === 'debuff') cur.effects.push(`${e.amount} ${cap(e.status || 'Debuff')}`);
      else if (e.type === 'buff') cur.effects.push(`${e.amount} ${cap(e.status || 'Buff')} Granted`);
      else if (e.type === 'miss') cur.effects.push('Miss');
    }
  }
  for (const en of entries) {
    const body = `${en.actorSide} ${en.actor} ${en.verb} ${en.targetSide} ${en.target} with ${en.card}`
      + (en.effects.length ? `, causing ${en.effects.join(', ')}` : '');
    en.headline = body;                       // no turn prefix (used in the live ticker)
    en.text = `Turn ${en.turn} — ${body}`;    // full line (combat log history)
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
      // OPTION A: a card is cast by its OWNER (if alive); a dead owner's cards are unplayable.
      const owner = (card.ownerId && state.unitsById[card.ownerId] && state.unitsById[card.ownerId].squadId === sqId && isAlive(state.unitsById[card.ownerId])) ? state.unitsById[card.ownerId] : front;
      if (!isAlive(owner)) continue;
      const offensive = isOffensiveCard(card);
      if (offensive && !targetFront) continue;
      actions.push({ ownerId: owner.id, targetId: (offensive ? targetFront : owner).id, card });
      energy -= cost;
    }
    plans[sqId] = actions;
  }
  return plans;
}

export const useBattle = create((set, get) => ({
  snapshot: null, state: null, plans: {}, cards: {}, seen: new Set(), queueOrder: [], undone: [], selectedSquadId: null,
  phase: 'plan', outcome: null, log: [], version: 0, dealKey: 0, turn: 1, logHistory: [],
  stunnedSquads: [], pendingStun: null,   // run-away failure: squads locked out of the NEXT plan phase
  runPassed: [],                          // squads that have ALREADY passed a run-away roll this battle
  opponent: aiOpponent,   // multiplayer seam: swap for a network provider (see aiOpponent)

  /** Replace the opponent provider (AI ↔ remote player). Netcode entry point. */
  setOpponent(fn) { set({ opponent: fn || aiOpponent }); },

  startBattle({ player, enemy }) {
    const { state, cards } = buildBattle(player, enemy);
    startRound(state);
    const base = { state, cards, seen: new Set(), plans: {}, queueOrder: [], undone: [], selectedSquadId: state.sides.p[0], phase: 'plan', outcome: null, log: [], version: 0, dealKey: 1, turn: 1, logHistory: [], startedAt: Date.now(), stunnedSquads: [], pendingStun: null, runPassed: [] };
    set({ ...base, snapshot: publish({ ...get(), ...base }) });
  },

  selectSquad(sqId) { set((s) => ({ selectedSquadId: sqId, snapshot: publish({ ...s, selectedSquadId: sqId }) })); },

  /** OVERWORLD PERSISTENCE: add enemy squads to the LIVE state (the party is never rebuilt,
   *  so its HP + decks carry across chunks). Redeals the party's hands from its own persistent
   *  deck (a fresh encounter), refreshes energy, starts a new round. */
  spawnEnemies(enemySquads) {
    const s = get(); if (!s.state) return;
    const state = s.state; const cards = { ...s.cards };
    // drop any leftover enemies, then build the new squads
    for (const sqId of state.sides.e) { const sq = state.squadsById[sqId]; sq?.memberIds.forEach((id) => delete state.unitsById[id]); delete state.squadsById[sqId]; delete cards[sqId]; }
    const eIds = [];
    (enemySquads || []).forEach((sq, i) => {
      const sqId = `e${i}_${uid()}`;
      const members = sq.creatures.map((c, j) => creatureToUnit(c, `${sqId}_${j}`));
      members.forEach((u) => { u.side = 'e'; u.squadId = sqId; state.unitsById[u.id] = u; });
      state.squadsById[sqId] = makeSquad({ id: sqId, side: 'e', memberIds: members.map((u) => u.id) });
      cards[sqId] = drawInto({ deck: squadDeckFor(members), hand: [], discard: [], exhaust: [] }, HAND_SIZE);
      eIds.push(sqId);
    });
    state.sides.e = eIds;
    // fresh hands for the party from its OWN persistent deck (banished returns per-fight)
    for (const sqId of state.sides.p) {
      const pile = cards[sqId] || emptyPile();
      const deck = shuffle([...pile.deck, ...pile.hand, ...pile.discard, ...pile.exhaust]);
      cards[sqId] = drawInto({ deck, hand: [], discard: [], exhaust: [] }, HAND_SIZE);
    }
    startRound(state);
    const patch = { state, cards, plans: {}, queueOrder: [], undone: [], phase: 'plan', outcome: null, turn: 1, dealKey: (s.dealKey || 0) + 1, stunnedSquads: [], pendingStun: null, runPassed: [], seen: new Set(), selectedSquadId: state.sides.p[0] };
    set({ ...patch, snapshot: publish({ ...s, ...patch }) });
  },

  /** OVERWORLD PERSISTENCE: strip the enemy side back to a peaceful party-only board. The
   *  party's units (HP) + cards are untouched, so wounds carry into exploration + the next fight. */
  despawnEnemies() {
    const s = get(); if (!s.state) return;
    const state = s.state; const cards = { ...s.cards };
    for (const sqId of state.sides.e) { const sq = state.squadsById[sqId]; sq?.memberIds.forEach((id) => delete state.unitsById[id]); delete state.squadsById[sqId]; delete cards[sqId]; }
    state.sides.e = [];
    const patch = { state, cards, plans: {}, queueOrder: [], undone: [], phase: 'plan', outcome: null, stunnedSquads: [], pendingStun: null, runPassed: [] };
    set({ ...patch, snapshot: publish({ ...s, ...patch }) });
  },

  /** Restore every living party unit to full HP (towns). */
  healParty() {
    const s = get(); if (!s.state) return;
    const state = s.state;
    for (const sqId of state.sides.p) for (const id of state.squadsById[sqId].memberIds) { const u = state.unitsById[id]; if (u) { u.hp = u.maxHp; u.block = 0; u.statuses = []; } }   // towns fully restore (revive included)
    set({ state, snapshot: publish({ ...s, state }) });
  },

  /** REWARD: add a card DEF to a squad's persistent DECK (a victory draft), OWNED by a member
   *  (the given ownerId if valid, else the squad's Vanguard). */
  grantCard(sqId, cardDef, ownerId) {
    const s = get(); if (!s.state || !cardDef) return;
    const squad = s.state.squadsById[sqId]; const pile = s.cards[sqId]; if (!squad || !pile) return;
    const owner = (ownerId && squad.memberIds.includes(ownerId)) ? ownerId : (liveFrontUnit(s.state, squad)?.id || squad.memberIds[0]);
    const card = { ...cardDef, iid: `${cardDef.id}#${uid()}`, ownerId: owner };
    const cards = { ...s.cards, [sqId]: { ...pile, deck: [...pile.deck, card] } };
    set({ cards, snapshot: publish({ ...s, cards }) });
  },

  /** CAPTURE: add a defeated creature to the party as a NEW squad on the live board (the party
   *  board is never rebuilt, so a capture must be inserted here to persist). Capped so the party
   *  can't balloon. Returns true if it was added. */
  addPlayerCreature(creature, maxSquads = 6) {
    const s = get(); if (!s.state || !creature) return false;
    const state = s.state;
    if (state.sides.p.length >= maxSquads) return false;
    const cards = { ...s.cards };
    const sqId = `p${state.sides.p.length}_${uid()}`;
    const u = creatureToUnit(creature, `${sqId}_0`);
    u.side = 'p'; u.squadId = sqId; state.unitsById[u.id] = u;
    state.squadsById[sqId] = makeSquad({ id: sqId, side: 'p', memberIds: [u.id] });
    cards[sqId] = drawInto({ deck: squadDeckFor([u]), hand: [], discard: [], exhaust: [] }, HAND_SIZE);
    state.sides.p = [...state.sides.p, sqId];
    set({ state, cards, snapshot: publish({ ...s, state, cards }) });
    return true;
  },

  /** Cosmetically reorder a squad's HAND (move card `iid` to `index`). Persists until the
   *  hand is redrawn next turn — lets the player organise the hand while viewing it. */
  reorderHand(sqId, iid, index) {
    const s = get();
    const pile = s.cards[sqId]; if (!pile) return;
    const hand = [...pile.hand];
    const from = hand.findIndex((c) => c.iid === iid); if (from < 0) return;
    const [card] = hand.splice(from, 1);
    const idx = Math.max(0, Math.min(hand.length, index));
    if (idx === from) return;   // no-op
    hand.splice(idx, 0, card);
    const cards = { ...s.cards, [sqId]: { ...pile, hand } };
    set({ cards, snapshot: publish({ ...s, cards }) });
  },

  /** Queue a hand card (by iid) from the selected squad onto a target unit. */
  queueCard(handIid, targetId) {
    const s = get();
    const sqId = s.selectedSquadId; if (!sqId) return;
    if ((s.stunnedSquads || []).includes(sqId)) return;   // stunned by a failed run-away → can't plan
    const squad = s.state.squadsById[sqId]; if (!squad || squad.side !== 'p') return;
    const front = liveFrontUnit(s.state, squad); if (!front) return;
    const pile = s.cards[sqId] || { hand: [] };
    const card = pile.hand.find((c) => c.iid === handIid); if (!card) return;
    // OPTION A: the CASTER is the card's OWNER (cast from wherever that creature stands — a
    // Support casts from the protected back row). A dead owner's cards are unplayable.
    const owner = (card.ownerId && squad.memberIds.includes(card.ownerId)) ? s.state.unitsById[card.ownerId] : front;
    if (!owner || !isAlive(owner)) return;
    const plan = s.plans[sqId] || [];
    if (planCost(plan) + (card.cost ?? 1) > squad.energy) return;   // not enough energy
    const plans = { ...s.plans, [sqId]: [...plan, { ownerId: owner.id, targetId, card }] };
    const cards = { ...s.cards, [sqId]: { ...pile, hand: pile.hand.filter((c) => c.iid !== handIid) } };
    const queueOrder = [...s.queueOrder, sqId];
    set({ plans, cards, queueOrder, undone: [], snapshot: publish({ ...s, plans, cards, undone: [] }) });   // a fresh play clears the redo stack
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
    const undone = [...(s.undone || []), { sqId, iid: last.card.iid, targetId: last.targetId }];   // remember for REDO
    set({ plans, cards, queueOrder, undone, snapshot: publish({ ...s, plans, cards, undone }) });
  },

  /** Redo the most recently undone move (re-queue it onto its original target). */
  redoLast() {
    const s = get();
    if (!(s.undone || []).length) return;
    const u = s.undone[s.undone.length - 1];
    const undone = s.undone.slice(0, -1);
    const squad = s.state.squadsById[u.sqId];
    const pile = s.cards[u.sqId] || { hand: [] };
    const card = pile.hand.find((c) => c.iid === u.iid);
    const plan = s.plans[u.sqId] || [];
    if (!squad || !card || planCost(plan) + (card.cost ?? 1) > squad.energy) { set({ undone }); return; }
    const front = liveFrontUnit(s.state, squad);
    const plans = { ...s.plans, [u.sqId]: [...plan, { ownerId: front.id, targetId: u.targetId, card }] };
    const cards = { ...s.cards, [u.sqId]: { ...pile, hand: pile.hand.filter((c) => c.iid !== u.iid) } };
    const queueOrder = [...s.queueOrder, u.sqId];
    set({ plans, cards, queueOrder, undone, snapshot: publish({ ...s, plans, cards, undone }) });
  },

  /** AUTO-PLAN the player's turn — mirrors the enemy AI planner (enemyPlan): for every
   *  player squad, greedily queue affordable hand cards, aiming offense at the enemy's front
   *  and beneficial cards at the squad's own front. TOPS UP each squad's remaining energy, so
   *  any moves you queued by hand are kept and only the leftover AP is filled. */
  autoPlan() {
    const s = get();
    if (s.phase !== 'plan' || s.outcome) return;
    // primary offense anchor = the first LIVE enemy vanguard (same idea as enemyPlan's targetFront)
    let enemyFront = null;
    for (const eId of s.state.sides.e) { const f = liveFrontUnit(s.state, s.state.squadsById[eId]); if (f) { enemyFront = f; break; } }
    const plans = { ...s.plans };
    const cards = { ...s.cards };
    const queueOrder = [...s.queueOrder];
    let added = false;
    for (const sqId of s.state.sides.p) {
      if ((s.stunnedSquads || []).includes(sqId)) continue;   // stunned squads can't be auto-planned
      const squad = s.state.squadsById[sqId];
      const front = liveFrontUnit(s.state, squad);
      const pile = cards[sqId];
      if (!front || !pile) continue;
      const plan = [...(plans[sqId] || [])];
      let energy = squad.energy - planCost(plan);
      const remaining = [];
      for (const card of pile.hand) {                    // hand order, like the AI
        const cost = card.cost ?? 1;
        const offensive = isOffensiveCard(card);
        // cast by the card's OWNER (Option A); skip if its owner is dead
        const owner = (card.ownerId && squad.memberIds.includes(card.ownerId) && isAlive(s.state.unitsById[card.ownerId])) ? s.state.unitsById[card.ownerId] : front;
        if (cost > energy || !isAlive(owner) || (offensive && !enemyFront)) { remaining.push(card); continue; }
        const targetId = (offensive ? enemyFront : owner).id;
        plan.push({ ownerId: owner.id, targetId, card });
        queueOrder.push(sqId);
        energy -= cost; added = true;
      }
      plans[sqId] = plan;
      cards[sqId] = { ...pile, hand: remaining };         // queued cards leave the hand (like queueCard)
    }
    if (!added) return;
    set({ plans, cards, queueOrder, undone: [], snapshot: publish({ ...s, plans, cards, queueOrder, undone: [] }) });
  },

  /** Reset ALL of this turn's queued moves (return every card to its hand). */
  resetPlans() {
    const s = get();
    if (!s.queueOrder.length) return;
    const cards = { ...s.cards };
    for (const [sqId, plan] of Object.entries(s.plans)) {
      if (plan?.length) { const pile = cards[sqId] || { hand: [] }; cards[sqId] = { ...pile, hand: [...pile.hand, ...plan.map((a) => a.card)] }; }
    }
    set({ plans: {}, cards, queueOrder: [], undone: [], snapshot: publish({ ...s, plans: {}, cards, undone: [] }) });
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
    // stamp each entry with the battle clock (mm:ss since start) for the combat log
    const elapsed = Math.max(0, Math.floor((Date.now() - (s.startedAt || Date.now())) / 1000));
    const clk = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
    for (const en of entries) en.at = clk;
    const logHistory = [...(s.logHistory || []), ...entries];
    const turn = outcome ? s.turn : s.turn + 1;
    const dealKey = (s.dealKey || 0) + 1;
    // promote any PENDING stun (set by a failed run-away this round) into effect for the NEXT
    // plan phase, and clear whatever stun was active this round (it's now spent).
    const stunnedSquads = s.pendingStun || [];
    const next = { ...s, plans: {}, cards, seen, queueOrder: [], log, outcome, phase: outcome ? 'over' : 'plan', dealKey, turn, logHistory, stunnedSquads, pendingStun: null };
    set({ plans: {}, cards, seen, queueOrder: [], log, outcome, phase: next.phase, dealKey, turn, logHistory, stunnedSquads, pendingStun: null, snapshot: publish(next) });
    return { log, outcome, entries };
  },

  /** RUN AWAY. Given each living player squad's d6 roll, decide the escape:
   *  - ALL squads ≥ threshold → success (the caller transitions to exploration).
   *  - ANY squad below → failure: the party FORFEITS this turn (queued cards return to hand,
   *    the round then resolves with the player idle), and each FAILED squad is STUNNED for the
   *    following plan phase. Returns { success, failed } so the UI can react + animate.  */
  attemptRunAway(rolls, threshold = 3) {
    const s = get();
    if (s.phase !== 'plan' || s.outcome) return { success: false, failed: [] };
    const livingIds = s.state.sides.p.filter((id) => liveFrontUnit(s.state, s.state.squadsById[id]));
    const already = new Set(s.runPassed || []);                       // passed in a PRIOR attempt this battle
    // a squad passes if it passed before OR beats the threshold now; only the rest can fail.
    const passedNow = livingIds.filter((id) => already.has(id) || (rolls[id] ?? 0) >= threshold);
    const passedSet = new Set(passedNow);
    const failed = livingIds.filter((id) => !passedSet.has(id));
    if (!failed.length) { set({ runPassed: [] }); return { success: true, failed: [] }; }   // all out → clear
    // escape failed → forfeit the turn: return queued cards to hand, arm the stun for next round,
    // and PERSIST the passers so they don't re-roll next attempt.
    const cards = { ...s.cards };
    for (const [sqId, plan] of Object.entries(s.plans)) {
      if (plan?.length) { const pile = cards[sqId] || { hand: [] }; cards[sqId] = { ...pile, hand: [...pile.hand, ...plan.map((a) => a.card)] }; }
    }
    const runPassed = passedNow;
    set({ plans: {}, cards, queueOrder: [], undone: [], pendingStun: failed, runPassed, snapshot: publish({ ...s, plans: {}, cards, undone: [], runPassed }) });
    return { success: false, failed, passed: runPassed };
  },
}));
