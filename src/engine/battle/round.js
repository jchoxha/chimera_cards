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
import { unitSquad, liveFrontUnit, reachable, setFront, anyLiveEnemyFront, makeUnit } from './state.js';

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

/** Squad-scoped offensive target resolution + redirect (spec §7 dead-target ruling). */
function resolveOffensiveTarget(state, action) {
  const card = action.card;
  const tgt = state.unitsById[action.targetId];
  if (card.locked) return live(tgt) ? tgt : null;                        // true snipe → fizzle if gone
  if (card.adaptive) {
    if (live(tgt) && reachable(state, tgt, card)) return tgt;
    return anyLiveEnemyFront(state, state.unitsById[action.ownerId]?.side);
  }
  const squad = tgt ? unitSquad(state, tgt) : null;
  if (!squad) return live(tgt) ? tgt : null;                             // legacy solo unit
  if (card.reachesBack && live(tgt)) return tgt;                         // strike the specific Support
  return liveFrontUnit(state, squad);                                    // else the squad's live front
}

/** Friendly ops (block/buff/heal): the direct target, no redirect. */
function directTarget(state, action) {
  const tgt = state.unitsById[action.targetId];
  return live(tgt) ? tgt : null;
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
  const target = offensive ? resolveOffensiveTarget(state, action) : directTarget(state, action);
  if (!live(target)) { log.push({ type: 'fizzle', reason: 'no-target', ownerId: owner.id, card: card.id }); return; }

  if (offensive && !card.lockOn) {
    const chance = landChance(owner.stats.accuracy, target.stats.evasion);
    if (!rollHit(chance, rng)) { log.push({ type: 'miss', ownerId: owner.id, targetId: target.id, card: card.id, chance }); return; }
  }
  log.push({ type: 'play', ownerId: owner.id, targetId: target.id, card: card.id });

  for (const e of card.effects || []) {
    switch (e.op) {
      case 'damage': {
        dealDamage(target, attackDamage(e.value, owner.stats.attack, target.stats.defense, e.matchup ?? 1), log);
        break;
      }
      case 'block': {   // Block is a buff → temporary HP (self)
        const amt = buffMagnitude(e.value, owner.stats.resolve);
        owner.block = (owner.block || 0) + amt;
        log.push({ type: 'block', unitId: owner.id, amount: amt, total: owner.block });
        break;
      }
      case 'buff': {
        const amt = buffMagnitude(e.value, owner.stats.resolve);
        addStatus(owner, e.status || 'buff', amt);
        log.push({ type: 'buff', unitId: owner.id, status: e.status, amount: amt });
        break;
      }
      case 'debuff': {
        const amt = debuffMagnitude(e.value, owner.stats.focus, target.stats.resolve);
        addStatus(target, e.status || 'debuff', amt);
        log.push({ type: 'debuff', targetId: target.id, status: e.status, amount: amt });
        break;
      }
      case 'heal': {
        target.hp = Math.min(target.maxHp, target.hp + e.value);
        log.push({ type: 'heal', targetId: target.id, amount: e.value, hp: target.hp });
        break;
      }
      default: break;
    }
    if (!live(target) && offensive) break;   // dead → remaining effects on it fizzle
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
