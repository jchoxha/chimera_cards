// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/effectRegistry — the SINGLE source of truth for ║
// ║ card effect ops, triggers, and passives. Each op declares both its    ║
// ║ engine behavior (`apply`) AND its editor field metadata (`fields`), so ║
// ║ adding a new mechanic = adding ONE entry here — the interpreter and    ║
// ║ the card editor both pick it up automatically. See docs/card-editor.md.║
// ║ UPDATE WHEN: a new effect op / trigger event / passive is added.      ║
// ╚══════════════════════════════════════════════════════════════════╝

import { resolveScope, addStatus, gainBlock, applyHeal, applyDamage } from '../combat/resolve.js';
import { drawCards } from '../combat/deckOps.js';
import { computeMatchup } from '../content/matchups.js';
import { canAttack, canBlock, bracesBlock, shiftStance, setStance } from '../combat/stances.js';

// ── Vocabulary ────────────────────────────────────────────────────────────────
export const CARD_TYPES = Object.freeze(['attack', 'skill', 'power']);
export const BUFF_STATUSES = Object.freeze(['strength', 'dexterity', 'regen']);
export const DEBUFF_STATUSES = Object.freeze(['weak', 'vulnerable', 'burn', 'poison']);

/** Trigger events a power can hook (fired by the turn loop / engine). */
export const TRIGGER_EVENTS = Object.freeze([
  'turnStart', 'turnEnd', 'onGainBlock', 'onPlayCard', 'onDeath', 'fatal', 'passive',
]);

/**
 * Passive rule-modifiers — flags a power grants while in play that change the
 * rules rather than firing a discrete effect (mod #69-style "knobs"). Read by
 * the engine via `hasPassive`. Each: { label, note }.
 */
export const PASSIVES = Object.freeze({
  blockAlwaysBraces: { label: 'Block always Braces', note: 'gained Block never decays' },
  extraStanceStep: { label: 'Extra stance step', note: 'may shift 2 stance steps per turn' },
});

// ── Small helpers (shared by handlers; kept here to avoid import cycles) ────────
export const r0 = (x) => Math.max(0, Math.round(x));
const statOf = (f, k, d = 1) => (f.stats && f.stats[k] != null ? f.stats[k] : d);
const stanceOf = (f) => f.stance ?? 'Balanced';
const dexterityOf = (f) => f.statuses.find((s) => s.id === 'dexterity')?.amount ?? 0;
const sideOf = (state, f) => (state.player.fighters.includes(f) ? state.player : state.enemy);

/** All passive ids a fighter currently has (from its registered powers). */
export function passivesOf(fighter) {
  return (fighter.powers ?? []).map((p) => p.passive).filter(Boolean);
}
export function hasPassive(fighter, id) {
  return passivesOf(fighter).includes(id);
}

/** Resolve an op's base value (static or dynamic). */
export function resolveValue(op, env) {
  if (op.valueFrom === 'selfBlock') return (env.caster.block ?? 0) + (env.caster.bracedBlock ?? 0);
  return op.value ?? 0;
}
/** Test a `bonusIf` condition. */
export function condMet(cond, env) {
  if (!cond) return false;
  if (cond.stance != null) return stanceOf(env.caster) === cond.stance;
  if (cond.targetHpPctBelow != null && env.target) {
    return env.target.maxHp > 0 && env.target.hp / env.target.maxHp < cond.targetHpPctBelow;
  }
  return false;
}
/** Default target scope per op when none is specified. */
export function defaultScope(op) {
  if (op.op === 'damage' || op.op === 'debuff') return 'enemyActiveTarget';
  return 'selfOnlyTarget';
}

function matchupOf(attunement, target) {
  if (!attunement) return 1;
  try { return computeMatchup({ attunement: [attunement] }, target).total; } catch { return 1; }
}
/** Topic-1 damage pipeline: (base+Strength) × Might × matchup × stance × Weak × Vuln. */
function scaledDamage(base, caster, target, matchup) {
  const str = caster.statuses.find((s) => s.id === 'strength')?.amount ?? 0;
  let dmg = (base + str) * statOf(caster, 'might') * matchup * (stanceOf(caster) === 'Rampage' ? 2 : 1);
  if (caster.statuses.some((s) => s.id === 'weak')) dmg *= 0.75;
  if (target.statuses.some((s) => s.id === 'vulnerable')) dmg *= 1.5;
  return Math.max(0, Math.floor(dmg));
}

// ── Field-type shorthands for editor metadata ──────────────────────────────────
const F = {
  num: (path, label = path) => ({ path, label, type: 'number' }),
  text: (path, label = path) => ({ path, label, type: 'text' }),
  bool: (path, label = path) => ({ path, label, type: 'bool' }),
  enum: (path, options, label = path) => ({ path, label, type: 'enum', options }),
  scope: (path = 'scope', label = 'scope') => ({ path, label, type: 'scope' }),
  stance: (path, label = path) => ({ path, label, type: 'stance' }),
};

/**
 * The registry. Each op: { label, cardTypes?, fields, apply(op, env), default }.
 * `env` = { state, casterKey, caster, card, side, scale, costPaid, opts, emit, rng,
 *           target, setIllegal }.
 */
export const EFFECT_OPS = {
  damage: {
    label: 'Deal damage',
    default: { op: 'damage', value: 6 },
    fields: [
      F.num('value'), F.enum('valueFrom', ['', 'selfBlock']), F.text('hits', 'hits (n or X)'),
      F.scope(), F.num('bonusMult', 'bonus ×'), F.num('bonusAdd', 'bonus +'),
      F.num('bonusIf.targetHpPctBelow', 'bonusIf HP<%'), F.stance('bonusIf.stance', 'bonusIf stance'),
    ],
    apply(op, env) {
      if (!canAttack(stanceOf(env.caster))) { env.setIllegal(); return; }
      const targets = resolveScope(env.state, env.casterKey, env.caster, op.scope ?? defaultScope(op), { targetId: env.opts.targetId });
      const hits = op.hits === 'X' ? Math.max(1, env.costPaid) : (op.hits ?? 1);
      for (const t of targets) {
        env.target = t;
        let v = resolveValue(op, env);
        if (op.bonusIf && condMet(op.bonusIf, env)) { if (op.bonusMult) v *= op.bonusMult; if (op.bonusAdd) v += op.bonusAdd; }
        const matchup = matchupOf(env.card?.attunement, t);
        const ts = sideOf(env.state, t);
        for (let i = 0; i < hits; i++) { if (t.hp <= 0) break; applyDamage(t, scaledDamage(v, env.caster, t, matchup), env.emit, false, ts); }
      }
    },
  },

  block: {
    label: 'Gain Block',
    default: { op: 'block', value: 5 },
    fields: [F.num('value'), F.enum('valueFrom', ['', 'selfBlock']), F.bool('brace'), F.num('bonusPerDexterity', '+ / Dexterity')],
    apply(op, env) {
      const c = env.caster;
      if (!canBlock(stanceOf(c))) return; // offense side can't gain Block
      const dex = dexterityOf(c);
      const base = resolveValue(op, env) + dex + (op.bonusPerDexterity ?? 0) * dex;
      const amt = r0(base * statOf(c, 'guard') * env.scale);
      if (amt <= 0) return;
      if (op.brace || bracesBlock(stanceOf(c)) || hasPassive(c, 'blockAlwaysBraces')) {
        c.bracedBlock = (c.bracedBlock ?? 0) + amt;
        env.emit?.('block', { targetId: c.id, amount: amt, braced: true, total: c.block + c.bracedBlock });
      } else {
        gainBlock(c, amt, env.emit);
      }
    },
  },

  buff: {
    label: 'Buff self',
    default: { op: 'buff', status: 'strength', value: 1 },
    fields: [F.enum('status', BUFF_STATUSES), F.num('value'), F.bool('temporary')],
    apply(op, env) {
      const amt = r0((op.value ?? 0) * statOf(env.caster, 'resolve') * env.scale); // self → Resolve
      if (amt <= 0) return;
      addStatus(env.caster.statuses, { id: op.status, amount: amt, stacking: 'intensity', temporary: !!op.temporary });
      env.emit?.('status', { targetId: env.caster.id, id: op.status, amount: amt });
    },
  },

  debuff: {
    label: 'Debuff target',
    default: { op: 'debuff', status: 'vulnerable', value: 2 },
    fields: [F.enum('status', DEBUFF_STATUSES), F.num('value'), F.scope()],
    apply(op, env) {
      if (!DEBUFF_STATUSES.includes(op.status)) return;
      const targets = resolveScope(env.state, env.casterKey, env.caster, op.scope ?? defaultScope(op), { targetId: env.opts.targetId });
      for (const t of targets) {
        const amt = r0((op.value ?? 0) * statOf(env.caster, 'focus') / statOf(t, 'resolve') * env.scale);
        if (amt <= 0) continue;
        addStatus(t.statuses, { id: op.status, amount: amt, stacking: op.status === 'burn' || op.status === 'poison' ? 'intensity' : 'duration' });
        env.emit?.('status', { targetId: t.id, id: op.status, amount: amt });
      }
    },
  },

  heal: {
    label: 'Heal',
    default: { op: 'heal', value: 5 },
    fields: [F.num('value'), F.scope()],
    apply(op, env) {
      const targets = resolveScope(env.state, env.casterKey, env.caster, op.scope ?? defaultScope(op), { targetId: env.opts.targetId });
      for (const t of targets) {
        const mult = t === env.caster ? statOf(t, 'resolve') : statOf(env.caster, 'focus') * statOf(t, 'resolve');
        applyHeal(t, r0((op.value ?? 0) * mult * env.scale), env.emit);
      }
    },
  },

  draw: {
    label: 'Draw cards',
    default: { op: 'draw', value: 1 },
    fields: [F.num('value')],
    apply(op, env) { drawCards(env.caster, (op.value ?? 0) * env.scale, env.rng); },
  },

  energy: {
    label: 'Gain energy',
    default: { op: 'energy', value: 1 },
    fields: [F.num('value')],
    apply(op, env) { env.side.energy += (op.value ?? 0) * env.scale; },
  },

  pay: {
    label: 'Pay (Block then HP)',
    default: { op: 'pay', block: 0, hp: 0 },
    fields: [F.num('block'), F.num('hp')],
    apply(op, env) {
      const c = env.caster;
      let owed = op.block ?? 0;
      const fromBlock = Math.min(c.block, owed); c.block -= fromBlock; owed -= fromBlock;
      const hp = (op.hp ?? 0) + owed;
      if (hp > 0) { c.hp = Math.max(0, c.hp - hp); env.emit?.('damage', { targetId: c.id, amount: hp, hpLoss: hp, hp: c.hp, self: true }); }
    },
  },

  stance: {
    label: 'Shift / set stance',
    default: { op: 'stance', set: 'Balanced' },
    fields: [F.stance('set'), F.enum('shift.dir', ['offense', 'defense']), F.num('shift.steps', 'shift steps')],
    apply(op, env) {
      env.caster.stance = op.set ? setStance(op.set)
        : shiftStance(stanceOf(env.caster), op.shift?.dir ?? 'offense', op.shift?.steps ?? 1);
      env.emit?.('stance', { id: env.caster.id, stance: env.caster.stance });
    },
  },
};

export const OP_TYPES = Object.freeze(Object.keys(EFFECT_OPS));

/** Run one op via its registry handler. */
export function applyOp(op, env) {
  EFFECT_OPS[op.op]?.apply(op, env);
}

/**
 * Fire all powers on a side that hook `event` (turnStart / onGainBlock / …).
 * Runs each trigger's effect op-list. Discrete passives (PASSIVES) are read
 * separately via `hasPassive`, not fired here.
 * @param {import('../types.js').CombatState} state
 * @param {'player'|'enemy'} sideKey
 * @param {string} event
 * @param {{ emit?: Function, rng?: ()=>number }} [opts]
 */
export function fireTriggers(state, sideKey, event, { emit, rng = Math.random } = {}) {
  const side = state[sideKey];
  for (const f of side.fighters) {
    if (f.hp <= 0) continue;
    for (const power of f.powers ?? []) {
      if (power.trigger?.on !== event) continue;
      const env = { state, casterKey: sideKey, caster: f, card: { attunement: power.attunement }, side, scale: 1, costPaid: 0, opts: {}, emit, rng, target: null, setIllegal: () => {} };
      for (const op of power.trigger.effects ?? []) applyOp(op, env);
    }
  }
}
