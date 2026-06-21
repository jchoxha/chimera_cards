// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/cardSpec — the data-driven CARD SCHEMA (op-list ║
// ║ effects) shared by the card editor, the engine interpreter, and the  ║
// ║ (future) generator. See docs/card-editor.md.                        ║
// ║ UPDATE WHEN: new op types / card fields / play-gates are added.      ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * @typedef {Object} CardSpec
 * @property {string} id
 * @property {string} name
 * @property {string|null} [class]
 * @property {string|null} [biology]
 * @property {string} attunement          Always present.
 * @property {'attack'|'skill'|'power'} type
 * @property {number} cost                 Energy; -1 = X (spend-all).
 * @property {string} [rarity]
 * @property {string[]} [keywords]
 * @property {string} [text]
 * @property {Object} [requires]           Play-gate: { stance?, stanceSide? }.
 * @property {EffectOp[]} effects
 * @property {{ on: string, effects: EffectOp[] }} [trigger]   For powers.
 */

/**
 * @typedef {Object} EffectOp
 * @property {'damage'|'block'|'buff'|'debuff'|'heal'|'draw'|'energy'|'pay'|'stance'} op
 * @property {number} [value]
 * @property {'selfBlock'} [valueFrom]     Dynamic value source.
 * @property {number|'X'} [hits]           damage: hit count ('X' = energy spent).
 * @property {string} [scope]              18-token TargetScope (default per op).
 * @property {string} [status]             buff/debuff status id.
 * @property {boolean} [temporary]         buff: lost at end of turn.
 * @property {boolean} [brace]             block: gained Block persists (Brace).
 * @property {number} [bonusPerDexterity]  block: + this × Dexterity.
 * @property {Object} [bonusIf]            damage: condition for a bonus.
 * @property {number} [bonusMult]          damage: multiply value if bonusIf.
 * @property {number} [bonusAdd]           damage: add to value if bonusIf.
 * @property {number} [hp]                 pay: HP to spend.
 * @property {string} [set]               stance: snap to this stance.
 * @property {{ dir:'offense'|'defense', steps:number }} [shift]  stance: slide.
 */

export const OP_TYPES = Object.freeze([
  'damage', 'block', 'buff', 'debuff', 'heal', 'draw', 'energy', 'pay', 'stance',
]);
export const CARD_TYPES = Object.freeze(['attack', 'skill', 'power']);
export const BUFF_STATUSES = Object.freeze(['strength', 'dexterity', 'regen']);
export const DEBUFF_STATUSES = Object.freeze(['weak', 'vulnerable', 'burn', 'poison']);

/** Default target scope per op when none is specified. */
export function defaultScope(op) {
  switch (op.op) {
    case 'damage':
    case 'debuff':
      return 'enemyActiveTarget';
    case 'heal':
    case 'block':
    case 'buff':
    default:
      return 'selfOnlyTarget';
  }
}

/**
 * Validate a CardSpec. Returns a list of human-readable problems ([] = valid).
 * Cheap structural validation — used by the editor and tests, not the hot path.
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
  if (!Array.isArray(c.effects) && !c.trigger) errs.push('needs effects[] or a trigger');
  for (const op of c.effects ?? []) {
    if (!OP_TYPES.includes(op.op)) { errs.push(`unknown op: ${op.op}`); continue; }
    if (op.op === 'buff' && !BUFF_STATUSES.includes(op.status)) errs.push(`buff needs a status: ${op.status}`);
    if (op.op === 'debuff' && !DEBUFF_STATUSES.includes(op.status)) errs.push(`debuff needs a status: ${op.status}`);
    if (op.op === 'stance' && !op.set && !op.shift) errs.push('stance op needs set or shift');
    if ((op.op === 'damage' || op.op === 'block') && op.value == null && op.valueFrom == null) {
      errs.push(`${op.op} op needs value or valueFrom`);
    }
  }
  return errs;
}

/** Resolve an op's base numeric value (static or dynamic). @param {EffectOp} op @param {Object} ctx */
export function resolveValue(op, ctx) {
  if (op.valueFrom === 'selfBlock') return (ctx.caster.block ?? 0) + (ctx.caster.bracedBlock ?? 0);
  return op.value ?? 0;
}

/** Test a `bonusIf` condition against the resolve context. @param {Object} cond @param {Object} ctx */
export function condMet(cond, ctx) {
  if (!cond) return false;
  if (cond.stance != null) return ctx.caster.stance === cond.stance;
  if (cond.targetHpPctBelow != null && ctx.target) {
    return ctx.target.maxHp > 0 && ctx.target.hp / ctx.target.maxHp < cond.targetHpPctBelow;
  }
  return false;
}
