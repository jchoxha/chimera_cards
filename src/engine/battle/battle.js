// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/battle/battle — the COMBAT-V2 plan/commit + round loop.    ║
// ║ Sits on the round resolver (round.js): each side COMMITS a plan per squad ║
// ║ (an ordered list of actions), constrained by that squad's ENERGY; both    ║
// ║ blind commits merge into ONE action list that the resolver runs in global ║
// ║ Speed order. Then win/loss is checked. Energy is per-squad, resets each    ║
// ║ round (base 3, StS-style, no carry-over). Pure + seeded → node-testable.  ║
// ║ The AI planner + deck/hand draw layer land later; this takes plans as      ║
// ║ input so a store/AI can drive it.                                          ║
// ║ UPDATE WHEN: energy rules, the commit shape, or win/loss change.           ║
// ╚══════════════════════════════════════════════════════════════════╝
import { resolveRound } from './round.js';
import { liveUnits, liveFrontUnit, isAlive } from './state.js';

// ── FORMATIONS (docs/formations-design.md) ───────────────────────────────────
// Per-squad energy scales with LIVE size, so concentrating creatures buys bigger single plays
// while many solo squads buy more total actions (a wide-vs-tall tradeoff). Tunable.
export const ENERGY_PER_MEMBER = 2;         // ≈2 energy per living creature (solo 2, duo 4, trio 6)
export const ENERGY_MIN = 2;                // solo-squad floor
// Each living SUPPORT empowers its Vanguard by an aura keyed to the support's build: a defensive
// support hardens the front (+Defense), an offensive one sharpens it (+Attack). Flat per support.
export const AURA_DEFENSE = 6;
export const AURA_ATTACK = 5;

/** A squad's energy for the round. Energy is ~constant PER creature (≈2 each) so splitting into
 *  many squads does NOT hand you more total actions — the wide-vs-tall choice is about protection
 *  & concentration, not raw economy. A small solo floor keeps 1-creature squads playable. */
export function squadEnergyFor(state, squad) {
  const live = squad.memberIds.reduce((n, id) => n + (isAlive(state.unitsById[id]) ? 1 : 0), 0);
  if (live <= 0) return 0;
  return Math.max(ENERGY_MIN, live * ENERGY_PER_MEMBER);
}

/** Recompute every unit's EFFECTIVE stats = base + formation auras from its living Support.
 *  Resets to base first, then stacks each support's aura onto the squad's live Vanguard. */
export function applyFormationAuras(state) {
  for (const squad of Object.values(state.squadsById || {})) {
    const members = squad.memberIds.map((id) => state.unitsById[id]).filter(Boolean);
    for (const u of members) { u.stats = { ...u.baseStats }; u.formation = null; }
    const front = liveFrontUnit(state, squad);
    if (!front) continue;
    let aAtk = 0, aDef = 0;
    for (const u of members) {
      if (u === front || !isAlive(u)) continue;                 // supports = the other live members
      if (u.baseStats.attack > u.baseStats.defense) aAtk += AURA_ATTACK; else aDef += AURA_DEFENSE;
    }
    if (aAtk || aDef) {
      front.stats = { ...front.baseStats, attack: front.baseStats.attack + aAtk, defense: front.baseStats.defense + aDef };
      front.formation = { attack: aAtk, defense: aDef };        // surfaced to the UI as a pip
    }
  }
}

/** Energy cost of one committed action (card cost, or a reposition's cost). Basics = 1. */
export function actionCost(action) {
  if (action.type === 'reposition') return action.cost ?? 1;
  return action.card?.cost ?? 1;
}

/** Sum the energy a squad's ordered plan spends. */
export function planCost(actions = []) {
  return actions.reduce((n, a) => n + actionCost(a), 0);
}

/**
 * Validate one side's commit (a map squadId → ordered actions) against energy.
 * @returns {{ ok:boolean, errors:string[], costBySquad:Record<string,number> }}
 */
export function validatePlan(state, plansBySquad = {}) {
  const errors = []; const costBySquad = {};
  for (const [squadId, actions] of Object.entries(plansBySquad)) {
    const squad = state.squadsById?.[squadId];
    if (!squad) { errors.push(`unknown squad ${squadId}`); continue; }
    const cost = planCost(actions);
    costBySquad[squadId] = cost;
    if (cost > squad.energy) errors.push(`squad ${squadId} plan costs ${cost} > energy ${squad.energy}`);
    for (const a of actions) {
      const owner = state.unitsById[a.ownerId];
      if (!owner) errors.push(`squad ${squadId}: unknown owner ${a.ownerId}`);
      else if (owner.squadId !== squadId) errors.push(`squad ${squadId}: ${a.ownerId} is not a member`);
    }
  }
  return { ok: errors.length === 0, errors, costBySquad };
}

/** Deduct each squad's plan cost from its energy pool (mutates). */
export function spendPlan(state, plansBySquad = {}) {
  for (const [squadId, actions] of Object.entries(plansBySquad)) {
    const squad = state.squadsById?.[squadId];
    if (squad) squad.energy = Math.max(0, squad.energy - planCost(actions));
  }
}

/** Merge both blind commits into ONE action list (order is decided by the resolver). */
export function flattenPlans(plansBySide) {
  const out = [];
  for (const side of ['p', 'e']) for (const actions of Object.values(plansBySide[side] || {})) out.push(...actions);
  return out;
}

/** Start-of-round: recompute formation auras, then size-scale + refresh every squad's energy
 *  (StS-style, no carry-over). (Hand draw from the shared deck lands with the deck/hand layer.) */
export function startRound(state) {
  applyFormationAuras(state);
  for (const squad of Object.values(state.squadsById || {})) {
    squad.maxEnergy = squadEnergyFor(state, squad);
    squad.energy = squad.maxEnergy;
  }
}

/** Who has won? A side is defeated when it has no living units. */
export function battleOutcome(state) {
  const p = liveUnits(state, 'p').length > 0;
  const e = liveUnits(state, 'e').length > 0;
  if (p && e) return null;
  if (p) return 'p';
  if (e) return 'e';
  return 'draw';
}

/**
 * Resolve one full battle round from both sides' blind commits.
 * @param {object} state
 * @param {{ p:Record<string,object[]>, e:Record<string,object[]> }} plansBySide  squadId → actions
 * @param {() => number} rng  seeded
 * @returns {{ log:object[], outcome:('p'|'e'|'draw'|null), errors:string[] }}
 */
export function resolveBattleRound(state, plansBySide, rng) {
  const errors = [];
  for (const side of ['p', 'e']) errors.push(...validatePlan(state, plansBySide[side] || {}).errors);
  if (errors.length) return { log: [], outcome: null, errors };

  for (const side of ['p', 'e']) spendPlan(state, plansBySide[side] || {});
  const log = resolveRound(state, flattenPlans(plansBySide), rng);
  const outcome = battleOutcome(state);
  if (!outcome) startRound(state);          // ready the next round (energy refresh)
  return { log, outcome, errors: [] };
}
