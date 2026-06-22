// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/cardSpec — the data-driven CARD SCHEMA + its    ║
// ║ validator. The effect VOCABULARY (ops + their fields) and behavior    ║
// ║ live in effectRegistry.js; this file owns the card shape + validation.║
// ║ UPDATE WHEN: card-level fields or validation rules change.            ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  EFFECT_OPS, OP_TYPES, CARD_TYPES, BUFF_STATUSES, DEBUFF_STATUSES,
  PASSIVES, TRIGGER_EVENTS, DURATIONS, KEYWORDS, INERT_OK_TYPES,
  CONDITION_EVENTS, CONDITION_VERBS, CONDITION_WINDOWS, defaultScope, resolveValue, condMet,
} from './effectRegistry.js';

// Re-export the vocabulary so existing importers (editor, interpreter, tests)
// have one stable import surface.
export {
  EFFECT_OPS, OP_TYPES, CARD_TYPES, BUFF_STATUSES, DEBUFF_STATUSES,
  PASSIVES, TRIGGER_EVENTS, DURATIONS, KEYWORDS, INERT_OK_TYPES,
  CONDITION_EVENTS, CONDITION_VERBS, CONDITION_WINDOWS, defaultScope, resolveValue, condMet,
};

/**
 * @typedef {Object} CardSpec
 * @property {string} id
 * @property {string} name
 * @property {string|null} [class]
 * @property {string|null} [biology]
 * @property {string} attunement
 * @property {'attack'|'skill'|'power'} type
 * @property {number} cost                 -1 = X (spend-all).
 * @property {string} [rarity]
 * @property {string[]} [keywords]
 * @property {string} [text]
 * @property {string} [art]                Art manifest key / URL (mod #69 parity; optional).
 * @property {Object} [requires]           Play-gate: { stance?, stanceSide? }.
 * @property {import('./effectRegistry.js').EffectOp[]} [effects]
 * @property {{ on: string, effects: object[] }} [trigger]   For powers.
 * @property {string} [passive]            For powers: a PASSIVES key (rule-modifier).
 */

function validateOpList(ops, where, errs) {
  for (const op of ops ?? []) {
    if (!OP_TYPES.includes(op.op)) { errs.push(`${where}: unknown op "${op.op}"`); continue; }
    if (op.op === 'buff' && !BUFF_STATUSES.includes(op.status)) errs.push(`${where}: buff needs a status`);
    if (op.op === 'debuff' && !DEBUFF_STATUSES.includes(op.status)) errs.push(`${where}: debuff needs a status`);
    if (op.op === 'stance' && !op.set && !op.shift) errs.push(`${where}: stance op needs set or shift`);
    if ((op.op === 'damage' || op.op === 'block') && op.value == null && op.valueFrom == null) {
      errs.push(`${where}: ${op.op} needs value or valueFrom`);
    }
  }
}

/**
 * Validate a CardSpec → list of human-readable problems ([] = valid). Crucially
 * flags **non-functional** cards (no effects / no trigger / no passive) so no card
 * "does nothing".
 * @param {CardSpec} c @returns {string[]}
 */
export function validateCard(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['card is not an object'];
  if (!c.id) errs.push('missing id');
  if (!c.name) errs.push('missing name');
  if (!c.attunement) errs.push('missing attunement');
  if (!CARD_TYPES.includes(c.type)) errs.push(`bad type: ${c.type}`);
  if (typeof c.cost !== 'number') errs.push('cost must be a number (-1 = X)');
  for (const kw of c.keywords ?? []) if (!KEYWORDS.includes(kw)) errs.push(`unknown keyword: ${kw}`);
  if (c.replayCount != null && (typeof c.replayCount !== 'number' || c.replayCount < 0)) errs.push('replayCount must be a number ≥ 0');
  if (c.imbue != null && c.imbue !== true && (typeof c.imbue !== 'number' || c.imbue < 0)) errs.push('imbue must be true or a number ≥ 0');

  validateOpList(c.effects, 'effects', errs);

  if (c.passive && !PASSIVES[c.passive]) errs.push(`unknown passive: ${c.passive}`);
  if (c.trigger) {
    if (!TRIGGER_EVENTS.includes(c.trigger.on)) errs.push(`bad trigger.on: ${c.trigger.on}`);
    validateOpList(c.trigger.effects, 'trigger', errs);
  }

  // Functional check — every card must DO something (Curse/Status may be inert).
  const hasEffects = Array.isArray(c.effects) && c.effects.length > 0;
  const hasTriggerFx = !!c.trigger && Array.isArray(c.trigger.effects) && c.trigger.effects.length > 0;
  const hasPassive = !!c.passive;
  if (c.type === 'power') {
    if (!hasTriggerFx && !hasPassive) errs.push('power has no trigger effects or passive — it does nothing');
  } else if (!hasEffects && !INERT_OK_TYPES.includes(c.type)) {
    errs.push('card has no effects — it does nothing');
  }
  return errs;
}
