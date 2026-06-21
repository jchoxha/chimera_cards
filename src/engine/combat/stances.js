// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/stances — the Warrior STANCE SPECTRUM (a      ║
// ║ State). 5-point slider; offense side can't Block, defense side can't ║
// ║ Attack; Balanced does both. See docs/class-design.md §5.            ║
// ║ UPDATE WHEN: stance rules/order change, or other State mechanics add.║
// ╚══════════════════════════════════════════════════════════════════╝

/** Ordered offense → defense. Index 0..4. */
export const STANCES = Object.freeze(['Rampage', 'Offensive', 'Balanced', 'Defensive', 'Full Guard']);

/** @param {string} s @returns {number} index (defaults to Balanced=2 if unknown). */
export function stanceIndex(s) {
  const i = STANCES.indexOf(s);
  return i < 0 ? 2 : i;
}

/** @param {string} s @returns {'offense'|'neutral'|'defense'} */
export function stanceSide(s) {
  const i = stanceIndex(s);
  return i < 2 ? 'offense' : i > 2 ? 'defense' : 'neutral';
}

/** Defense side (Defensive/Full Guard) cannot Attack. */
export function canAttack(s) { return stanceIndex(s) <= 2; }
/** Offense side (Rampage/Offensive) cannot gain Block. */
export function canBlock(s) { return stanceIndex(s) >= 2; }

/** Rampage deals 2× damage. */
export function damageMult(s) { return s === 'Rampage' ? 2 : 1; }
/** Full Guard makes gained Block persist (Brace). */
export function bracesBlock(s) { return s === 'Full Guard'; }
/** Offensive grants +1 Strength per Attack played this turn. */
export function strengthOnAttack(s) { return s === 'Offensive' ? 1 : 0; }
/** Defensive grants +1 Dexterity per Skill played this turn. */
export function dexterityOnSkill(s) { return s === 'Defensive' ? 1 : 0; }

/**
 * Shift along the spectrum. dir 'offense' lowers the index (toward Rampage),
 * 'defense' raises it (toward Full Guard). Clamped to the ends.
 * @param {string} s @param {'offense'|'defense'} dir @param {number} [steps]
 * @returns {string}
 */
export function shiftStance(s, dir, steps = 1) {
  let i = stanceIndex(s) + (dir === 'offense' ? -steps : steps);
  i = Math.max(0, Math.min(STANCES.length - 1, i));
  return STANCES[i];
}

/** Snap to a named stance (validated). @param {string} s @returns {string} */
export function setStance(s) {
  return STANCES.includes(s) ? s : 'Balanced';
}
