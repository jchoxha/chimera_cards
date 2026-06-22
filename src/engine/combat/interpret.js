// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/interpret — runs a data-driven CardSpec        ║
// ║ (op-list) through the engine. Effect behavior + editor metadata live  ║
// ║ in engine/cards/effectRegistry.js; this file owns play-gates, X-cost  ║
// ║ scaling, the stance on-play bonuses, and power registration.          ║
// ║ UPDATE WHEN: play-gate / cost / power-registration logic changes.    ║
// ╚══════════════════════════════════════════════════════════════════╝

import { addStatus } from './resolve.js';
import { canAttack, strengthOnAttack, dexterityOnSkill, stanceSide } from './stances.js';
import { applyOp, fireTriggers, parseDuration } from '../cards/effectRegistry.js';

export { fireTriggers };

const stanceOf = (f) => f.stance ?? 'Balanced';

/**
 * Run a CardSpec's effects. Does NOT deduct energy (the manager does that on play);
 * it reads `card.cost` only to size X-cost scaling. Powers register their trigger +
 * passive (fired/read elsewhere — see effectRegistry.fireTriggers / hasPassive).
 * @param {import('../types.js').CombatState} state
 * @param {'player'|'enemy'} casterKey
 * @param {import('../types.js').Fighter} caster
 * @param {import('../cards/cardSpec.js').CardSpec} card
 * @param {{ targetId?: string, costPaid?: number, rng?: ()=>number, emit?: (t,p)=>void }} [opts]
 * @returns {{ ok: boolean, reason?: string, power?: boolean }}
 */
export function applyCardSpec(state, casterKey, caster, card, opts = {}) {
  const side = state[casterKey];
  const stanceAtPlay = stanceOf(caster);

  // Play-gates.
  if (card.requires?.stance && stanceAtPlay !== card.requires.stance) {
    return { ok: false, reason: `requires ${card.requires.stance} stance` };
  }
  if (card.requires?.stanceSide && stanceSide(stanceAtPlay) !== card.requires.stanceSide) {
    return { ok: false, reason: `requires ${card.requires.stanceSide} stance` };
  }
  if (card.type === 'attack' && !canAttack(stanceAtPlay)) {
    return { ok: false, reason: 'cannot Attack in current stance' };
  }

  // Powers: register the trigger + passive (fired/read by the turn loop / engine).
  if (card.type === 'power') {
    caster.powers = caster.powers ?? [];
    caster.powers.push({
      source: card.id, on: card.trigger?.on ?? null, effects: card.trigger?.effects ?? [],
      duration: null, passive: card.passive ?? null, attunement: card.attunement,
    });
    return { ok: true, power: true };
  }

  const costPaid = card.cost === -1 ? (opts.costPaid ?? side.energy) : card.cost;
  let illegal = false;
  const env = {
    state, casterKey, caster, card, side,
    scale: card.cost === -1 ? Math.max(1, costPaid) : 1,
    costPaid, opts, emit: opts.emit, rng: opts.rng ?? Math.random,
    target: null, setIllegal: () => { illegal = true; },
  };

  for (const op of card.effects ?? []) {
    // An op with a non-`onPlay` trigger REGISTERS to fire on that future event
    // (for `duration` carrier-turns) instead of resolving now.
    if (op.trigger && op.trigger !== 'onPlay') {
      const { trigger, duration, ...rest } = op;
      caster.powers = caster.powers ?? [];
      caster.powers.push({
        source: card.id, on: trigger, effects: [rest], duration: parseDuration(duration),
        passive: null, attunement: card.attunement,
      });
      continue;
    }
    applyOp(op, env);
    if (illegal) return { ok: false, reason: 'an effect was illegal in current stance' };
  }

  // Stance on-play bonuses (based on the stance at the moment of play).
  if (card.type === 'attack') {
    const s = strengthOnAttack(stanceAtPlay);
    if (s) addStatus(caster.statuses, { id: 'strength', amount: s, stacking: 'intensity' });
  } else if (card.type === 'skill') {
    const d = dexterityOnSkill(stanceAtPlay);
    if (d) addStatus(caster.statuses, { id: 'dexterity', amount: d, stacking: 'intensity' });
  }

  return { ok: true };
}
