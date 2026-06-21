// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/interpret — runs a data-driven CardSpec        ║
// ║ (op-list) through the engine, applying Topic-1 stat scaling and the   ║
// ║ Warrior stance rules. See docs/card-editor.md.                       ║
// ║ UPDATE WHEN: new ops, stat-scaling rules, or stance behavior change. ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  resolveScope, addStatus, gainBlock, applyHeal, applyDamage,
} from './resolve.js';
import { drawCards } from './deckOps.js';
import { computeMatchup } from '../content/matchups.js';
import {
  canAttack, canBlock, damageMult, bracesBlock, strengthOnAttack, dexterityOnSkill,
  shiftStance, setStance, stanceSide,
} from './stances.js';
import { resolveValue, condMet, defaultScope, DEBUFF_STATUSES } from '../cards/cardSpec.js';

const r0 = (x) => Math.max(0, Math.round(x));
const statOf = (f, k, dflt = 1) => (f.stats && f.stats[k] != null ? f.stats[k] : dflt);
const stanceOf = (f) => f.stance ?? 'Balanced';
const dexterityOf = (f) => f.statuses.find((s) => s.id === 'dexterity')?.amount ?? 0;
const sideOf = (state, f) => (state.player.fighters.includes(f) ? state.player : state.enemy);

/** Element matchup of an attack's attunement vs a target (defaults to 1). */
function matchupOf(attunement, target) {
  if (!attunement) return 1;
  try { return computeMatchup({ attunement: [attunement] }, target).total; }
  catch { return 1; }
}

/** Topic-1 damage pipeline: (base+Strength) × Might × matchup × stance × Weak × Vuln. */
function scaledDamage(base, caster, target, matchup) {
  const str = caster.statuses.find((s) => s.id === 'strength')?.amount ?? 0;
  let dmg = (base + str) * statOf(caster, 'might') * matchup * damageMult(stanceOf(caster));
  if (caster.statuses.some((s) => s.id === 'weak')) dmg *= 0.75;
  if (target.statuses.some((s) => s.id === 'vulnerable')) dmg *= 1.5;
  return Math.max(0, Math.floor(dmg));
}

/** Apply one effect op. Mutates ctx.illegal if an op can't be performed. */
function applyOp(state, casterKey, caster, card, op, ctx, opts) {
  const side = state[casterKey];
  const emit = opts.emit;
  const rng = opts.rng ?? Math.random;
  const scale = ctx.scale;

  switch (op.op) {
    case 'energy':
      side.energy += (op.value ?? 0) * scale;
      break;

    case 'draw':
      drawCards(caster, (op.value ?? 0) * scale, rng);
      break;

    case 'stance':
      caster.stance = op.set ? setStance(op.set)
        : shiftStance(stanceOf(caster), op.shift?.dir ?? 'offense', op.shift?.steps ?? 1);
      emit?.('stance', { id: caster.id, stance: caster.stance });
      break;

    case 'pay': {
      let owed = (op.block ?? 0);
      const fromBlock = Math.min(caster.block, owed);
      caster.block -= fromBlock; owed -= fromBlock;
      const hp = (op.hp ?? 0) + owed; // unpaid block overflows to HP
      if (hp > 0) {
        caster.hp = Math.max(0, caster.hp - hp);
        emit?.('damage', { targetId: caster.id, amount: hp, hpLoss: hp, hp: caster.hp, self: true });
      }
      break;
    }

    case 'buff': {
      const amt = r0((op.value ?? 0) * statOf(caster, 'resolve') * scale); // self → Resolve
      if (amt > 0) {
        addStatus(caster.statuses, { id: op.status, amount: amt, stacking: 'intensity', temporary: !!op.temporary });
        emit?.('status', { targetId: caster.id, id: op.status, amount: amt });
      }
      break;
    }

    case 'block': {
      if (!canBlock(stanceOf(caster))) break; // offense side can't gain Block
      const dex = dexterityOf(caster);
      const base = resolveValue(op, ctx) + dex + (op.bonusPerDexterity ?? 0) * dex;
      const amt = r0(base * statOf(caster, 'guard') * scale);
      if (amt <= 0) break;
      if (op.brace || bracesBlock(stanceOf(caster))) {
        caster.bracedBlock = (caster.bracedBlock ?? 0) + amt;
        emit?.('block', { targetId: caster.id, amount: amt, braced: true, total: caster.block + caster.bracedBlock });
      } else {
        gainBlock(caster, amt, emit);
      }
      break;
    }

    case 'debuff': {
      if (!DEBUFF_STATUSES.includes(op.status)) break;
      const targets = resolveScope(state, casterKey, caster, op.scope ?? defaultScope(op), { targetId: opts.targetId });
      for (const t of targets) {
        const amt = r0((op.value ?? 0) * statOf(caster, 'focus') / statOf(t, 'resolve') * scale);
        if (amt > 0) {
          addStatus(t.statuses, { id: op.status, amount: amt, stacking: op.status === 'burn' || op.status === 'poison' ? 'intensity' : 'duration' });
          emit?.('status', { targetId: t.id, id: op.status, amount: amt });
        }
      }
      break;
    }

    case 'heal': {
      const targets = resolveScope(state, casterKey, caster, op.scope ?? defaultScope(op), { targetId: opts.targetId });
      for (const t of targets) {
        const mult = t === caster ? statOf(t, 'resolve') : statOf(caster, 'focus') * statOf(t, 'resolve');
        applyHeal(t, r0((op.value ?? 0) * mult * scale), emit);
      }
      break;
    }

    case 'damage': {
      if (!canAttack(stanceOf(caster))) { ctx.illegal = true; break; } // defense side can't Attack
      const targets = resolveScope(state, casterKey, caster, op.scope ?? defaultScope(op), { targetId: opts.targetId });
      const hits = op.hits === 'X' ? Math.max(1, ctx.costPaid) : (op.hits ?? 1);
      for (const t of targets) {
        ctx.target = t;
        let v = resolveValue(op, ctx);
        if (op.bonusIf && condMet(op.bonusIf, ctx)) {
          if (op.bonusMult) v *= op.bonusMult;
          if (op.bonusAdd) v += op.bonusAdd;
        }
        const matchup = matchupOf(card.attunement, t);
        const ts = sideOf(state, t);
        for (let i = 0; i < hits; i++) {
          if (t.hp <= 0) break;
          applyDamage(t, scaledDamage(v, caster, t, matchup), emit, false, ts);
        }
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Run a CardSpec's effects. Does NOT deduct energy (the manager does that on play);
 * it reads `card.cost` only to size X-cost scaling. Powers register their trigger.
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

  // Powers: register the trigger (firing wired into the turn loop in a later increment).
  if (card.type === 'power') {
    caster.powers = caster.powers ?? [];
    caster.powers.push({ id: card.id, trigger: card.trigger ?? null });
    return { ok: true, power: true };
  }

  const costPaid = card.cost === -1 ? (opts.costPaid ?? side.energy) : card.cost;
  const ctx = { caster, target: null, costPaid, scale: card.cost === -1 ? Math.max(1, costPaid) : 1 };

  for (const op of card.effects ?? []) {
    applyOp(state, casterKey, caster, card, op, ctx, opts);
    if (ctx.illegal) return { ok: false, reason: 'an effect was illegal in current stance' };
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
