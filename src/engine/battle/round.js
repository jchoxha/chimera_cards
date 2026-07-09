// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/battle/round — the COMBAT-V2 simultaneous ROUND resolver   ║
// ║ (docs/combat-v2-spec.md §7). Both sides commit blind; every committed      ║
// ║ ACTION across the board resolves in ONE global order:                      ║
// ║   priority tier (desc) → owner Speed (desc) → seeded coin-flip tiebreak.   ║
// ║ Attacks roll a binary hit (Accuracy − Evasion, floor 0; lock-on skips),    ║
// ║ deal Pokémon-ratio damage absorbed by Block (temporary HP) then HP.        ║
// ║ TARGETING is squad-aware (state.js): default attacks are squad-scoped and  ║
// ║ redirect to the target squad's live front (focus-fire denies at the squad  ║
// ║ level); `locked` binds to the instance (fizzle if gone), `adaptive`        ║
// ║ retargets anywhere, `reachesBack` can strike a Support. Playing a          ║
// ║ swaps-forward card auto-promotes its owner to Vanguard (positions live at  ║
// ║ fire time). DoTs/Regen tick once at END OF ROUND. Pure + seeded.           ║
// ║ UPDATE WHEN: the round loop, ordering, targeting, or effects change.       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { attackDamage, landChance, rollHit, buffMagnitude, debuffMagnitude } from './stats.js';
import { unitSquad, liveFrontUnit, reachable, setFront, anyLiveEnemyFront, squadLiveMembers, liveUnits, makeUnit } from './state.js';

export { makeUnit };   // re-export so callers can build units from one entry point

/** @typedef {{ id, name, priority?, lockOn?, locked?, adaptive?, reachesBack?, swapsForward?, effects:{op,value,status?,matchup?}[] }} BattleCard */
/** @typedef {{ ownerId:string, targetId?:string, type?:'reposition', toId?:string, card?:BattleCard }} BattleAction */

const OFFENSIVE_OPS = new Set(['damage', 'debuff']);
const isOffensive = (card) => (card?.effects || []).some((e) => OFFENSIVE_OPS.has(e.op));
const live = (u) => !!u && u.hp > 0;

/** Global resolution order: priority ↓, owner Speed ↓, then a per-action SEEDED
 *  key (deterministic, fair — avoids a non-transitive rng comparator). */
export function resolveOrder(actions, unitsById, rng) {
  const keyed = actions.map((a) => ({ a, tie: rng() }));
  keyed.sort((x, y) => {
    const px = x.a.card?.priority || 0, py = y.a.card?.priority || 0;
    if (px !== py) return py - px;
    const sx = unitsById[x.a.ownerId]?.stats.speed ?? 0;
    const sy = unitsById[y.a.ownerId]?.stats.speed ?? 0;
    if (sx !== sy) return sy - sx;
    return x.tie - y.tie;
  });
  return keyed.map((k) => k.a);
}

/** A card's target SCOPE: field (whole side) · squad · targeted (any one) · front (default). */
const scopeOf = (card) => card.scope || (card.reachesBack ? 'targeted' : 'front');

/** Offensive targets (enemy units) an action affects, honoring scope + the dead-target ruling. */
function offensiveTargets(state, action) {
  const card = action.card;
  const owner = state.unitsById[action.ownerId];
  const enemySide = owner.side === 'p' ? 'e' : 'p';
  const scope = scopeOf(card);
  if (scope === 'field') return liveUnits(state, enemySide);
  const tgt = state.unitsById[action.targetId];
  const squad = tgt ? unitSquad(state, tgt) : null;
  if (scope === 'squad') return squad ? squadLiveMembers(state, squad) : (live(tgt) ? [tgt] : []);
  // single-target: targeted (specific) or front (squad-scoped redirect)
  let one;
  if (card.locked) one = live(tgt) ? tgt : null;
  else if (card.adaptive) one = (live(tgt) && reachable(state, tgt, card)) ? tgt : anyLiveEnemyFront(state, owner.side);
  else if (!squad) one = live(tgt) ? tgt : null;
  else if (scope === 'targeted' && live(tgt)) one = tgt;
  else one = liveFrontUnit(state, squad);
  return one ? [one] : [];
}

/** Friendly targets (own units) for block/buff/heal, honoring scope (self default). */
function friendlyTargets(state, action) {
  const owner = state.unitsById[action.ownerId];
  const scope = scopeOf(action.card);
  if (scope === 'field') return liveUnits(state, owner.side);
  if (scope === 'squad') return squadLiveMembers(state, unitSquad(state, owner));
  return [owner];
}

/** Absorb `amount` into Block (temp HP) first, then HP. Block persists (no decay). */
function dealDamage(target, amount, log) {
  const fromBlock = Math.min(target.block || 0, amount);
  target.block = (target.block || 0) - fromBlock;
  const toHp = amount - fromBlock;
  target.hp = Math.max(0, target.hp - toHp);
  log.push({ type: 'damage', targetId: target.id, amount, blocked: fromBlock, hp: target.hp });
  if (target.hp <= 0) log.push({ type: 'death', unitId: target.id });
}

function addStatus(unit, id, amount) {
  const s = unit.statuses.find((x) => x.id === id);
  if (s) s.amount += amount; else unit.statuses.push({ id, amount });
}

/** Resolve one committed action against the LIVE board. */
export function applyAction(state, action, rng, log) {
  const owner = state.unitsById[action.ownerId];
  if (!live(owner)) { log.push({ type: 'fizzle', reason: 'owner-dead', ownerId: action.ownerId }); return; }

  // Reposition (no card): move a squad member to the front (energy paid by the planner).
  if (action.type === 'reposition') {
    const to = state.unitsById[action.toId];
    if (live(to) && to.squadId === owner.squadId && setFront(state, to)) log.push({ type: 'reposition', squadId: owner.squadId, frontId: to.id });
    else log.push({ type: 'fizzle', reason: 'reposition', ownerId: owner.id });
    return;
  }

  const card = action.card;
  // Auto-swap forward: a `swapsForward` card pulls its owner to the Vanguard slot.
  if (card.swapsForward && setFront(state, owner)) log.push({ type: 'swap', squadId: owner.squadId, frontId: owner.id });

  const offensive = isOffensive(card);
  const off = offensive ? offensiveTargets(state, action) : [];
  if (offensive && !off.length) { log.push({ type: 'fizzle', reason: 'no-target', ownerId: owner.id, card: card.id }); return; }

  // Log the play against a primary target (first offensive target, else the owner).
  const primary = off[0] || owner;
  log.push({ type: 'play', ownerId: owner.id, targetId: primary.id, card: card.id, cardName: card.name, offensive, scope: scopeOf(card) });

  // Pre-roll a binary hit per offensive target (lock-on always lands; a miss still
  // "spent" the action — it just does nothing to that target).
  const hit = new Set();
  for (const t of off) {
    if (card.lockOn) { hit.add(t.id); continue; }
    const chance = landChance(owner.stats.accuracy, t.stats.evasion);
    if (rollHit(chance, rng)) hit.add(t.id);
    else log.push({ type: 'miss', ownerId: owner.id, targetId: t.id, card: card.id, chance });
  }

  for (const e of card.effects || []) {
    switch (e.op) {
      case 'damage': {
        for (const t of off) {
          if (!hit.has(t.id) || !live(t)) continue;
          dealDamage(t, attackDamage(e.value, owner.stats.attack, t.stats.defense, e.matchup ?? 1), log);
        }
        break;
      }
      case 'debuff': {
        for (const t of off) {
          if (!hit.has(t.id) || !live(t)) continue;
          const amt = debuffMagnitude(e.value, owner.stats.focus, t.stats.resolve);
          addStatus(t, e.status || 'debuff', amt);
          log.push({ type: 'debuff', targetId: t.id, status: e.status, amount: amt });
        }
        break;
      }
      case 'block': {   // Block is a buff → temporary HP
        for (const t of friendlyTargets(state, action)) {
          const amt = buffMagnitude(e.value, t.stats.resolve);
          t.block = (t.block || 0) + amt;
          log.push({ type: 'block', unitId: t.id, amount: amt, total: t.block });
        }
        break;
      }
      case 'buff': {
        for (const t of friendlyTargets(state, action)) {
          const amt = buffMagnitude(e.value, t.stats.resolve);
          addStatus(t, e.status || 'buff', amt);
          log.push({ type: 'buff', unitId: t.id, status: e.status, amount: amt });
        }
        break;
      }
      case 'heal': {
        for (const t of friendlyTargets(state, action)) {
          t.hp = Math.min(t.maxHp, t.hp + e.value);
          log.push({ type: 'heal', targetId: t.id, amount: e.value, hp: t.hp });
        }
        break;
      }
      default: break;
    }
  }
}

/** End-of-round step: DoTs / Regen tick once, durations decrement. */
export function endOfRound(state, log) {
  for (const u of Object.values(state.unitsById)) {
    if (!live(u)) continue;
    for (const s of [...u.statuses]) {
      if (s.id === 'poison' && s.amount > 0) { dealDamage(u, s.amount, log); s.amount -= 1; }
      else if (s.id === 'regen' && s.amount > 0) {
        u.hp = Math.min(u.maxHp, u.hp + s.amount); s.amount -= 1;
        log.push({ type: 'regen', unitId: u.id, hp: u.hp });
      }
    }
    u.statuses = u.statuses.filter((s) => s.amount > 0);
  }
  log.push({ type: 'endOfRound' });
}

/** Resolve a full round: order all committed actions, apply each against the live
 *  board, then run the end-of-round step. Mutates `state`; returns the event log. */
export function resolveRound(state, actions, rng) {
  const log = [];
  const ordered = resolveOrder(actions, state.unitsById, rng);
  log.push({ type: 'order', ids: ordered.map((a) => `${a.ownerId}:${a.card?.id ?? a.type}`) });
  for (const action of ordered) applyAction(state, action, rng, log);
  endOfRound(state, log);
  return log;
}
