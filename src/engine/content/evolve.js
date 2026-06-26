// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/evolve — creature EVOLUTION (first cut). In this   ║
// ║ engine evolution = advancing one step up the SIZE ladder (baby → small →  ║
// ║ regular → large), which re-scales HP + Might. Elite & Boss are terminal.  ║
// ║ Pure math over data/forms.js so it can re-derive a creature/party member  ║
// ║ WITHOUT regenerating (and losing) its deck. Used by the run campfire.     ║
// ╚══════════════════════════════════════════════════════════════════╝
import { formOf, nextForm, formAllowsEvolution, formLabel } from '../../data/forms.js';

/** Can this size still evolve? (false at Elite/Boss). */
export function canEvolve(size) { return formAllowsEvolution(size || 'regular'); }

/** The next size up the ladder, or null if terminal. */
export function evolutionTarget(size) { return nextForm(size || 'regular'); }

/** Pretty "Large 🔺" style label for a size. */
export function sizeLabel(size) { return formLabel(size) || 'Regular'; }

/**
 * Evolve a creature one size up: re-scale maxHp by the form HP-mult ratio and
 * shift Might by the form Strength delta. Returns the deltas + the new size so a
 * caller can apply them (HP gain is added to current HP — evolution is a boon).
 * Returns null if already terminal.
 * @param {{ size?:string, maxHp:number, stats?:Object }} c
 */
export function evolve(c) {
  const from = c.size || c.meta?.form || 'regular';
  const to = nextForm(from);
  if (!to) return null;
  const fA = formOf(from), fB = formOf(to);
  const newMaxHp = Math.max(1, Math.round(c.maxHp * (fB.hpMult / fA.hpMult)));
  const hpGain = newMaxHp - c.maxHp;
  const mightDelta = fB.str - fA.str;
  return { from, to, newMaxHp, hpGain, mightDelta };
}
