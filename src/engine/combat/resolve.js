// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/resolve — scope→target resolution + the       ║
// ║ effect engine (damage/block/heal/status) for the Vanguard model.    ║
// ║ UPDATE WHEN: scope semantics, damage math, the live status set, or   ║
// ║ CardEffects fields change (spec §3, §9.3).                           ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pure, manager-agnostic resolution. `resolveScope` turns one of the 18 locked
// TargetScope tokens + an optional chosen targetId into the concrete list of
// living Fighters an effect lands on (scopes resolve to Fighters ONLY — the
// fortify slot is addressed separately via CardEffects.fortify, spec §9.3).
// `applyCardEffects` then composes the per-field effects over those targets.
// Everything takes an optional `emit` so the manager can stream CombatEvents;
// nothing here imports a renderer or owns turn flow.

import { SCOPE_TABLE } from './scopes.js';
import { drawCards, drawFreshHand, discardWholeHand } from './deckOps.js';

/** @typedef {import('../types.js').CombatState} CombatState */
/** @typedef {import('../types.js').Side} Side */
/** @typedef {import('../types.js').Fighter} Fighter */
/** @typedef {import('../types.js').CardEffects} CardEffects */
/** @typedef {import('../types.js').StatusEffect} StatusEffect */

const LIVE_STATUSES = Object.freeze([
  'burn', 'poison', 'weak', 'vulnerable', 'strength', 'regen',
  // Attunement signature statuses (now live): Physical/Void DoTs, consumed-on-use
  // modifiers, and the Arcane self-buff. (Soak/Shock handled in their own hooks.)
  'bleed', 'decay', 'soak', 'shock', 'expose', 'confuse', 'amplify',
]);

// ── Side / zone helpers ───────────────────────────────────────────────────────

/** @param {Side} side @returns {Fighter[]} living members. */
export function livingFighters(side) {
  return side.fighters.filter((f) => f.hp > 0);
}

/** @param {Side} side @returns {Fighter|null} the active Vanguard if alive. */
export function vanguard(side) {
  const v = side.fighters[side.vanguardIndex];
  return v && v.hp > 0 ? v : null;
}

/** @param {Side} side @returns {Fighter[]} living NON-Vanguard members. */
export function benchFighters(side) {
  return side.fighters.filter((f, i) => f.hp > 0 && i !== side.vanguardIndex);
}

/** Living candidates on one side for a given scope zone. */
function zoneCandidates(side, zone, caster) {
  switch (zone) {
    case 'active': { const v = vanguard(side); return v ? [v] : []; }
    case 'bench':  return benchFighters(side);
    case 'self':   return caster && caster.hp > 0 ? [caster] : [];
    case 'flex':
    case 'whole':
    case 'field':
    default:       return livingFighters(side);
  }
}

/** The side key opposite the caster's. @param {'player'|'enemy'} key */
export function opposingKey(key) {
  return key === 'player' ? 'enemy' : 'player';
}

/**
 * Resolve a TargetScope token to the concrete living Fighters it reaches.
 * @param {CombatState} state
 * @param {'player'|'enemy'} casterKey   which Side the caster belongs to.
 * @param {Fighter} caster
 * @param {import('../types.js').TargetScope} scope
 * @param {{ targetId?: string }} [opts]  required for single-selection scopes (UI/AI choice).
 * @returns {Fighter[]}
 */
export function resolveScope(state, casterKey, caster, scope, { targetId } = {}) {
  const d = SCOPE_TABLE[scope];
  if (!d) throw new Error(`Unknown TargetScope token: ${JSON.stringify(scope)}`);

  const friendly = state[casterKey];
  const enemy = state[opposingKey(casterKey)];

  let candidates;
  switch (d.side) {
    case 'friendly': candidates = zoneCandidates(friendly, d.zone, caster); break;
    case 'enemy':    candidates = zoneCandidates(enemy, d.zone, caster); break;
    case 'either':
    case 'both':     candidates = [...zoneCandidates(friendly, d.zone, caster),
                                   ...zoneCandidates(enemy, d.zone, caster)]; break;
    case 'self':     candidates = caster && caster.hp > 0 ? [caster] : []; break;
    default:         candidates = []; break;
  }
  if (d.excludesSelf) candidates = candidates.filter((f) => f !== caster);

  if (d.selection === 'all') return candidates;
  // single selection: honor the chosen target when it's reachable by this scope.
  // If the requested target isn't a valid candidate (e.g. an attack aimed at a
  // back-row foe under an active-only scope), fall back to the scope's default
  // candidate — the Vanguard for active scopes — rather than fizzling.
  if (targetId != null) {
    const picked = candidates.find((f) => f.id === targetId);
    if (picked) return [picked];
  }
  return candidates.length ? [candidates[0]] : [];
}

// ── Status helpers ────────────────────────────────────────────────────────────

/** Default stacking discipline per status id. @param {string} id */
const INTENSITY_STATUSES = new Set([
  'strength', 'burn', 'poison',
  // consumed-on-use / DoT counters — NOT turn-countdown debuffs.
  // (Expose is intentionally NOT here: it accumulates AND decays 1/turn like a
  // duration debuff, so it can build past the target's HP — Expose v2.)
  'bleed', 'decay', 'soak', 'shock', 'confuse', 'amplify',
]);
export function stackingFor(id) {
  return INTENSITY_STATUSES.has(id) ? 'intensity' : 'duration'; // weak, vulnerable, regen, frail → duration
}

/** Add/merge a status onto a fighter (amounts accumulate). @param {StatusEffect[]} list @param {StatusEffect} status */
export function addStatus(list, status) {
  const existing = list.find((s) => s.id === status.id);
  if (existing) existing.amount += status.amount;
  else list.push({ ...status });
}

/** Drop statuses that have decayed to ≤0. @param {StatusEffect[]} list */
export function pruneStatuses(list) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].amount <= 0) list.splice(i, 1);
}

/**
 * StS attack math, applied PER HIT: (base + Strength), ×0.75 if attacker Weak,
 * ×1.5 if target Vulnerable, floored, min 0 (spec §9.3).
 * @param {number} base @param {StatusEffect[]} attacker @param {StatusEffect[]} target @returns {number}
 */
export function computeAttackDamage(base, attacker, target) {
  const strength = attacker.find((s) => s.id === 'strength')?.amount ?? 0;
  let dmg = base + strength;
  if (attacker.some((s) => s.id === 'weak')) dmg *= 0.75;
  if (target.some((s) => s.id === 'vulnerable')) dmg *= 1.5;
  return Math.max(0, Math.floor(dmg));
}

// ── Primitive effects (creature-bound; block → HP, no shared pool) ─────────────

/** @param {Fighter} target @param {number} amount @param {(t,p)=>void} [emit] */
export function gainBlock(target, amount, emit) {
  if (amount <= 0) return;
  target.block += amount;
  emit?.('block', { targetId: target.id, amount, total: target.block });
}

/** @param {Fighter} target @param {number} amount @param {(t,p)=>void} [emit] */
export function applyHeal(target, amount, emit) {
  if (amount <= 0) return;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  emit?.('heal', { targetId: target.id, amount: target.hp - before, hp: target.hp });
}

/**
 * Deal one already-computed damage instance: Block absorbs first, remainder to HP.
 * @param {Fighter} target @param {number} amount @param {(t,p)=>void} [emit] @param {boolean} [dot]
 * @param {Side} [side] Optional side to apply fortifySlot block.
 */
export function applyDamage(target, amount, emit, dot = false, side = null) {
  if (amount <= 0 || target.hp <= 0) return;
  // Count real attack hits this window (consumed + reset by the Bleed tick).
  if (!dot) target.hitsTaken = (target.hitsTaken || 0) + 1;

  let hpLoss = amount;
  let absorbedCreature = 0;
  let absorbedBraced = 0;
  let absorbedFortify = 0;

  // Expose (Air): while Expose > 0, EVERY hit ignores ALL Block layers (a window,
  // NOT consumed per hit — it decays 1/turn and can build past the target's HP).
  const exposeSt = !dot && target.statuses.find((s) => s.id === 'expose');
  const exposed = exposeSt && exposeSt.amount > 0;

  if (!dot && !exposed) {
    // 1. Creature block absorbs first
    absorbedCreature = Math.min(target.block, hpLoss);
    target.block -= absorbedCreature;
    hpLoss -= absorbedCreature;

    // 1b. Braced (persistent) block absorbs next — Warrior Brace, decays only when spent.
    if (target.bracedBlock > 0) {
      absorbedBraced = Math.min(target.bracedBlock, hpLoss);
      target.bracedBlock -= absorbedBraced;
      hpLoss -= absorbedBraced;
    }

    // 2. Fortify slot block absorbs next (if target is Vanguard)
    if (side && side.fighters[side.vanguardIndex] === target) {
      absorbedFortify = Math.min(side.fortifySlot.block, hpLoss);
      side.fortifySlot.block -= absorbedFortify;
      hpLoss -= absorbedFortify;
    }
  }
  // (exposed → Block was skipped above; Expose is not consumed per hit.)

  target.hp = Math.max(0, target.hp - hpLoss);
  emit?.('damage', {
    targetId: target.id,
    amount,
    hpLoss,
    hp: target.hp,
    dot,
    absorbedCreature,
    absorbedBraced,
    absorbedFortify
  });
  if (target.hp === 0) emit?.('death', { fighterId: target.id });
}

/** Apply a {id: amount} status map onto a fighter, ignoring inert ids. */
function applyStatusMap(target, map, scale, emit) {
  for (const [id, amt] of Object.entries(map)) {
    if (!LIVE_STATUSES.includes(id)) continue; // defined-but-inert this milestone
    addStatus(target.statuses, { id, amount: amt * scale, stacking: stackingFor(id) });
    emit?.('status', { targetId: target.id, id, amount: amt * scale });
  }
}

/**
 * Apply one card/consumable's effects. Self-economy (energy/draw) and self-buffs
 * (strength/selfStatus/fortify) land on the caster/its side; scoped fields
 * (applyStatus → dmg → block → heal) land on the resolved targets. X-cost
 * (cost === -1) scales scalar amounts and hit count by energy spent.
 * @param {CombatState} state
 * @param {'player'|'enemy'} casterKey
 * @param {Fighter} caster
 * @param {CardEffects} effects
 * @param {{ targetId?: string, costPaid?: number, xCost?: boolean, rng?: ()=>number, emit?: (t,p)=>void }} [opts]
 * @returns {Fighter[]} the resolved targets (for the caller/UI).
 */
export function applyCardEffects(state, casterKey, caster, effects = {}, opts = {}) {
  const { targetId, costPaid = 0, xCost = false, rng = Math.random, emit } = opts;
  const scale = xCost ? Math.max(1, costPaid) : 1;
  const side = state[casterKey];

  // Self economy + self buffs.
  if (effects.energy) side.energy += effects.energy * scale;
  if (effects.draw) drawCards(caster, effects.draw * scale, rng);
  if (effects.strength) addStatus(caster.statuses,
    { id: 'strength', amount: effects.strength * scale, stacking: 'intensity' });
  if (effects.selfStatus) applyStatusMap(caster, effects.selfStatus, scale, emit);
  if (effects.fortify) {
    side.fortifySlot.block += (effects.fortify.block ?? 0);
    side.fortifySlot.duration = Math.max(side.fortifySlot.duration ?? 0, effects.fortify.duration);
    emit?.('fortify', { side: casterKey, block: side.fortifySlot.block, duration: effects.fortify.duration });
  }

  // Scoped fields. No scope → no scoped resolution (pure self/economy card).
  const targets = effects.scope ? resolveScope(state, casterKey, caster, effects.scope, { targetId }) : [];
  for (const t of targets) {
    if (effects.applyStatus) applyStatusMap(t, effects.applyStatus, scale, emit);
    if (effects.dmg) {
      const hits = (effects.hits ?? 1) * scale;
      for (let i = 0; i < hits; i++) {
        if (t.hp <= 0) break;
        const targetSide = state.player.fighters.includes(t) ? state.player : state.enemy;
        applyDamage(t, computeAttackDamage(effects.dmg, caster.statuses, t.statuses), emit, false, targetSide);
      }
    }
    if (effects.block) gainBlock(t, effects.block * scale, emit);
    if (effects.heal) applyHeal(t, effects.heal * scale, emit);
    if (effects.displacement && t.hp > 0) {
      const targetSideKey = state.player.fighters.includes(t) ? 'player' : 'enemy';
      const targetSide = state[targetSideKey];
      if (targetSide.fighters[targetSide.vanguardIndex] === t) {
        const benchIdxs = targetSide.fighters
          .map((f, idx) => ({ f, idx }))
          .filter((item) => item.idx !== targetSide.vanguardIndex && item.f.hp > 0)
          .map((item) => item.idx);

        if (benchIdxs.length > 0) {
          const oldIndex = targetSide.vanguardIndex;
          let chosenIdx;
          if (effects.displacement.chooser === 'random') {
            const randVal = rng();
            chosenIdx = benchIdxs[Math.floor(randVal * benchIdxs.length)];
          } else {
            chosenIdx = benchIdxs[0];
          }

          discardWholeHand(t);
          targetSide.vanguardIndex = chosenIdx;
          const incoming = targetSide.fighters[chosenIdx];
          drawFreshHand(incoming, targetSide.handSize, rng);

          emit?.('displacement', {
            side: targetSideKey,
            fromIndex: oldIndex,
            toIndex: chosenIdx,
            chooser: effects.displacement.chooser
          });

          const allCards = [
            ...incoming.deck.drawPile,
            ...incoming.deck.discardPile,
            ...incoming.deck.exhaustPile,
            ...incoming.hand
          ];
          for (const card of allCards) {
            if (card.swapInBoon) {
              applyCardEffects(state, targetSideKey, incoming, card.swapInBoon, opts);
            }
          }

          if (targetSideKey === 'enemy') {
            state.enemyPlan = [];
          }
        }
      }
    }
  }
  return targets;
}

export { LIVE_STATUSES };
