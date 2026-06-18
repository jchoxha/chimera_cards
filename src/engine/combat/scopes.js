// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/scopes — structural classification of the    ║
// ║ locked 18-token TargetScope vocabulary (combat-engine-spec §3.1).  ║
// ║ UPDATE WHEN: a TargetScope token is added/renamed/removed.          ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// PURE VOCABULARY ONLY — Phase 1 boilerplate. This maps each scope token to a
// {side, zone, selection, ...} descriptor so the (future) resolver can pick the
// right unit(s)/slot. It deliberately contains NO combat behavior: it does not
// touch a CombatState, deal damage, or move fighters. `describeScope` just reads
// the static table; `assertScopeTableComplete` guards token/table drift.

import { TARGET_SCOPES } from '../types.js';

/** @typedef {import('../types.js').TargetScope} TargetScope */

/**
 * @typedef {Object} ScopeDescriptor
 * @property {'friendly'|'enemy'|'either'|'both'|'self'} side  Which side(s) the scope reaches.
 * @property {'active'|'bench'|'slot'|'whole'|'field'|'flex'|'self'} zone  Which zone it addresses.
 * @property {'single'|'all'} selection  One unit/slot, or every matching unit.
 * @property {boolean} piercing      Bypasses the Vanguard frontline to reach the bench.
 * @property {boolean} excludesSelf  "other…" scopes omit the casting unit.
 */

/** Tiny builder to keep the table terse and uniform. */
const S = (side, zone, selection, { piercing = false, excludesSelf = false } = {}) =>
  Object.freeze({ side, zone, selection, piercing, excludesSelf });

/**
 * Static classification of every locked scope token. Keyed by `TargetScope`.
 * @type {Readonly<Record<TargetScope, ScopeDescriptor>>}
 */
export const SCOPE_TABLE = Object.freeze({
  friendlyActiveTarget:       S('friendly', 'active', 'single'),
  enemyActiveTarget:          S('enemy',    'active', 'single'),
  flexFriendlyTarget:         S('friendly', 'flex',   'single'),
  flexEnemyTarget:            S('enemy',    'flex',   'single'),
  anyActiveTarget:            S('either',   'active', 'single'),
  anyTarget:                  S('either',   'flex',   'single'),
  friendlyBenchOnlyTarget:    S('friendly', 'bench',  'single'),
  enemyBenchOnlyTarget:       S('enemy',    'bench',  'single'),
  selfOnlyTarget:             S('self',     'self',   'single'),
  piercingFriendlyTarget:     S('friendly', 'bench',  'single', { piercing: true }),
  piercingEnemyTarget:        S('enemy',    'bench',  'single', { piercing: true }),
  wholeField:                 S('both',     'field',  'all'),
  wholeFriendlySide:          S('friendly', 'whole',  'all'),
  wholeEnemySide:             S('enemy',    'whole',  'all'),
  wholeFriendlyBench:         S('friendly', 'bench',  'all'),
  wholeEnemyBench:            S('enemy',    'bench',  'all'),
  otherFriendlySide:          S('friendly', 'whole',  'all', { excludesSelf: true }),
  otherFriendlyBench:         S('friendly', 'bench',  'all', { excludesSelf: true }),
  // 18 tokens total. Fortify-slot effects use CardEffects.fortify (spec §3.1).
});

/**
 * Look up the structural descriptor for a scope token.
 * @param {TargetScope} scope
 * @returns {ScopeDescriptor}
 * @throws if the token is not part of the locked vocabulary.
 */
export function describeScope(scope) {
  const d = SCOPE_TABLE[scope];
  if (!d) throw new Error(`Unknown TargetScope token: ${JSON.stringify(scope)}`);
  return d;
}

/** @param {TargetScope} scope @returns {boolean} */
export function isValidScope(scope) {
  return Object.prototype.hasOwnProperty.call(SCOPE_TABLE, scope);
}

/**
 * Guard against drift between the frozen `TARGET_SCOPES` enum and `SCOPE_TABLE`.
 * Throws if any token is unmapped or the table has stray keys. Called by the
 * smoke test (and cheap enough to call at boot).
 * @returns {true}
 */
export function assertScopeTableComplete() {
  const missing = TARGET_SCOPES.filter((t) => !isValidScope(t));
  const extra = Object.keys(SCOPE_TABLE).filter((k) => !TARGET_SCOPES.includes(k));
  if (missing.length) throw new Error(`SCOPE_TABLE missing tokens: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`SCOPE_TABLE has stray tokens: ${extra.join(', ')}`);
  return true;
}
