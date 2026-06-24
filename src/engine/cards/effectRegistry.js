// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/effectRegistry — the SINGLE source of truth for ║
// ║ card effect ops, triggers, and passives. Each op declares both its    ║
// ║ engine behavior (`apply`) AND its editor field metadata (`fields`), so ║
// ║ adding a new mechanic = adding ONE entry here — the interpreter and    ║
// ║ the card editor both pick it up automatically. See docs/card-editor.md.║
// ║ UPDATE WHEN: a new effect op / trigger event / passive is added.      ║
// ╚══════════════════════════════════════════════════════════════════╝

import { resolveScope, addStatus, stackingFor, gainBlock, applyHeal, applyDamage } from '../combat/resolve.js';
import { drawCards } from '../combat/deckOps.js';
import { computeMatchup, imbueStatusesFor, attunementsOf } from '../content/matchups.js';
import { canAttack, canBlock, bracesBlock, shiftStance, setStance } from '../combat/stances.js';
import { fireReactions } from './reactions.js';

// ── Vocabulary ────────────────────────────────────────────────────────────────
export const CARD_TYPES = Object.freeze(['attack', 'skill', 'power', 'curse', 'status']);
export const BUFF_STATUSES = Object.freeze(['strength', 'dexterity', 'regen', 'amplify']);
// Attunement signature debuffs. `weak/vulnerable/burn/poison` are LIVE (tick in the
// turn loop); `bleed/soak/shock/expose/confuse/decay` are authorable + shown as pips
// but INERT (no behavior yet) until the §5 status system lands.
export const DEBUFF_STATUSES = Object.freeze([
  'weak', 'vulnerable', 'burn', 'poison',
  'bleed', 'soak', 'shock', 'expose', 'confuse', 'decay',
]);

/** Card keywords with runtime behavior (mod #69 parity). Engine support:
 *  exhaust/unplayable (play), ethereal/retain/innate (deckOps), replay (replayCount). */
export const KEYWORDS = Object.freeze(['exhaust', 'ethereal', 'retain', 'innate', 'unplayable']);

/** Card types that may legitimately have no effect (inert/unplayable by design). */
export const INERT_OK_TYPES = Object.freeze(['curse', 'status']);

/**
 * Trigger events ANY effect (or power) can hook, fired by the turn loop / engine
 * (modelled on mod #69's After* hooks). `onPlay` = immediate (the default for a
 * card's own effects). `passive` = a rule-modifier, not a fired event.
 */
export const TRIGGER_EVENTS = Object.freeze([
  'onPlay', 'turnStart', 'turnEnd', 'onGainBlock', 'onDamageDealt', 'onDamageTaken',
  'onCardPlayed', 'onDraw', 'onDiscard', 'onExhaust', 'onEnergySpent', 'onDeath', 'fatal', 'passive',
]);

/** Editor duration presets (effects registered by a non-immediate trigger). */
export const DURATIONS = Object.freeze(['thisCombat', 'thisTurn']);

/** Normalize a duration descriptor → number of carrier turns, or null = permanent. */
export function parseDuration(d) {
  if (d == null || d === 'thisCombat') return null;
  if (d === 'thisTurn') return 1;
  if (typeof d === 'number') return d;
  if (d.kind === 'turns') return d.n ?? 1;
  return null;
}

/**
 * Passive rule-modifiers — flags a power grants while in play that change the
 * rules rather than firing a discrete effect (mod #69-style "knobs"). Read by
 * the engine via `hasPassive`. Each: { label, note }.
 */
export const PASSIVES = Object.freeze({
  blockAlwaysBraces: { label: 'Block always Braces', note: 'gained Block never decays' },
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
/** Multi-variable condition vocabulary (mod #69 "conditional" pattern). */
export const CONDITION_EVENTS = Object.freeze([
  'cardsPlayed', 'cardsDrawn', 'cardsDiscarded', 'cardsExhausted',
  'damageDealt', 'damageTaken', 'blockGained', 'energySpent',
]);
export const CONDITION_VERBS = Object.freeze(['>=', '<=', '==', '!=', '>', '<']);
export const CONDITION_WINDOWS = Object.freeze(['thisTurn', 'thisCombat']);

/** Read a counter value for a condition/scaling spec from the caster's side. */
export function counterValue(spec, env) {
  const side = env.state?.[env.casterKey];
  const win = spec.window === 'thisCombat' ? 'combat' : 'turn';
  const c = side?.counters?.[win] ?? {};
  if (spec.event === 'cardsPlayed' && spec.cardType) return c.playedByType?.[spec.cardType] ?? 0;
  return c[spec.event] ?? 0;
}

/**
 * Test a condition. Supports the multi-variable counter form ({event,verb,threshold,
 * window,cardType}) AND the legacy narrow forms ({stance} / {targetHpPctBelow}).
 */
export function condMet(cond, env) {
  if (!cond) return false;
  if (cond.event) {
    const val = counterValue(cond, env);
    const t = cond.threshold ?? 0;
    switch (cond.verb) {
      case '>': return val > t;
      case '<': return val < t;
      case '<=': return val <= t;
      case '==': return val === t;
      case '!=': return val !== t;
      case '>=': default: return val >= t;
    }
  }
  if (cond.stance != null) return stanceOf(env.caster) === cond.stance;
  if (cond.targetHpPctBelow != null && env.target) {
    return env.target.maxHp > 0 && env.target.hp / env.target.maxHp < cond.targetHpPctBelow;
  }
  return false;
}

/**
 * An op's base numeric value INCLUDING history scaling: `value` (or valueFrom)
 * plus `scaleBy.per × counter(scaleBy)` (mod #69 per-effect scaling). Used by
 * every numeric handler so scaling composes uniformly.
 */
export function effectiveValue(op, env) {
  let v = resolveValue(op, env);
  if (op.scaleBy?.event) v += (op.scaleBy.per ?? 1) * counterValue(op.scaleBy, env);
  return v;
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
      const rng = env.rng || Math.random;
      let targets = resolveScope(env.state, env.casterKey, env.caster, op.scope ?? defaultScope(op), { targetId: env.opts.targetId });
      const hits = op.hits === 'X' ? Math.max(1, env.costPaid) : (op.hits ?? 1);

      // Confuse (Mind): the carrier's attack is unreliable — consume 1 Confuse, then
      // ~33% it fizzles entirely, else ~50% it strikes a RANDOM unit on the target side.
      const confuseSt = env.caster.statuses.find((s) => s.id === 'confuse');
      if (confuseSt && confuseSt.amount > 0 && targets.length) {
        confuseSt.amount -= 1;
        env.emit?.('status', { targetId: env.caster.id, id: 'confuse', amount: confuseSt.amount });
        if (rng() < 0.34) { env.emit?.('fizzle', { actorId: env.caster.id, cardId: env.card?.id }); targets = []; }
        else if (rng() < 0.5) {
          const pool = sideOf(env.state, targets[0]).fighters.filter((f) => f.hp > 0);
          if (pool.length) targets = [pool[Math.floor(rng() * pool.length)]];
        }
      }

      // Amplify (Arcane, self): the next attack deals +50%, cleared after this card.
      const ampSt = env.caster.statuses.find((s) => s.id === 'amplify');
      const ampMult = ampSt && ampSt.amount > 0 ? 1.5 : 1;

      const imbues = env.card?.imbue ? imbueStatusesFor(attunementsOf(env.caster)) : [];
      const imbueAmt = typeof env.card?.imbue === 'number' ? env.card.imbue : 1;
      let connected = false;

      for (const t of targets) {
        env.target = t;
        let v = effectiveValue(op, env);
        if (op.bonusIf && condMet(op.bonusIf, env)) { if (op.bonusMult) v *= op.bonusMult; if (op.bonusAdd) v += op.bonusAdd; }
        // Soak (Water): the next attack vs this target deals +25% per stack, then clears.
        const soakSt = t.statuses.find((s) => s.id === 'soak');
        const soakMult = soakSt && soakSt.amount > 0 ? 1 + 0.25 * soakSt.amount : 1;
        const typeMult = matchupOf(env.card?.attunement, t);
        const mult = typeMult * ampMult * soakMult;
        const ts = sideOf(env.state, t);
        let landed = false;
        for (let i = 0; i < hits; i++) {
          if (t.hp <= 0) break;
          applyDamage(t, scaledDamage(v, env.caster, t, mult), env.emit, false, ts, { matchup: typeMult });
          connected = true;
          landed = true;
        }
        // §5.2 Reactions: the attack's element reacts with the statuses already on
        // the target (primers). Fires BEFORE Soak's standalone clear + this card's
        // imbue, so it reads the pre-attack state. Pure upside (statuses stand alone).
        if (landed && t.hp > 0) fireReactions(env.state, env.caster, t, env.card?.attunement, { emit: env.emit, rng });
        if (soakSt && soakSt.amount > 0) { soakSt.amount = 0; env.emit?.('status', { targetId: t.id, id: 'soak', amount: 0 }); }
        if (t.hp > 0) for (const im of imbues) if (im.target === 'enemy') {
          addStatus(t.statuses, { id: im.id, amount: imbueAmt, stacking: stackingFor(im.id) });
          env.emit?.('status', { targetId: t.id, id: im.id, amount: imbueAmt });
        }
      }
      if (connected && ampSt && ampSt.amount > 0) { ampSt.amount = 0; env.emit?.('status', { targetId: env.caster.id, id: 'amplify', amount: 0 }); }
      // Self-imbue (e.g. Holy→Regen) lands once if the attack connected.
      if (connected) for (const im of imbues) if (im.target === 'self') {
        addStatus(env.caster.statuses, { id: im.id, amount: imbueAmt, stacking: stackingFor(im.id) });
        env.emit?.('status', { targetId: env.caster.id, id: im.id, amount: imbueAmt });
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
      const base = effectiveValue(op, env) + dex + (op.bonusPerDexterity ?? 0) * dex;
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
      const amt = r0(effectiveValue(op, env) * statOf(env.caster, 'resolve') * env.scale); // self → Resolve
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
        const amt = r0(effectiveValue(op, env) * statOf(env.caster, 'focus') / statOf(t, 'resolve') * env.scale);
        if (amt <= 0) continue;
        addStatus(t.statuses, { id: op.status, amount: amt, stacking: stackingFor(op.status) });
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
        applyHeal(t, r0(effectiveValue(op, env) * mult * env.scale), env.emit);
      }
    },
  },

  draw: {
    label: 'Draw cards',
    default: { op: 'draw', value: 1 },
    fields: [F.num('value')],
    apply(op, env) { drawCards(env.caster, effectiveValue(op, env) * env.scale, env.rng); },
  },

  energy: {
    label: 'Gain energy',
    default: { op: 'energy', value: 1 },
    fields: [F.num('value')],
    apply(op, env) { env.side.energy += effectiveValue(op, env) * env.scale; },
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

/** Run one op via its registry handler, gated by an optional `condition`. */
export function applyOp(op, env) {
  if (op.condition && !condMet(op.condition, env)) return; // conditional gate
  EFFECT_OPS[op.op]?.apply(op, env);
}

/**
 * Fire all registered triggered effects on a side that hook `event`. Entries are
 * uniform: { on, effects[], duration, passive, attunement, source } — produced by
 * power cards (card.trigger/passive) AND by any effect op carrying a non-`onPlay`
 * trigger. Discrete passives are read separately via `hasPassive`, not fired here.
 * @param {import('../types.js').CombatState} state
 * @param {'player'|'enemy'} sideKey
 * @param {string} event
 * @param {{ emit?: Function, rng?: ()=>number }} [opts]
 */
export function fireTriggers(state, sideKey, event, { emit, rng = Math.random } = {}) {
  const side = state[sideKey];
  for (const f of side.fighters) {
    if (f.hp <= 0) continue;
    for (const entry of f.powers ?? []) {
      if (entry.on !== event) continue;
      const env = { state, casterKey: sideKey, caster: f, card: { attunement: entry.attunement }, side, scale: 1, costPaid: 0, opts: {}, emit, rng, target: null, setIllegal: () => {} };
      for (const op of entry.effects ?? []) applyOp(op, env);
    }
  }
}

/** Decrement turn-bound triggered effects on a fighter; drop expired ones. */
export function tickTriggerDurations(fighter) {
  if (!fighter.powers) return;
  fighter.powers = fighter.powers.filter((e) => {
    if (typeof e.duration === 'number') { e.duration -= 1; return e.duration > 0; }
    return true; // null = permanent (powers, thisCombat)
  });
}
