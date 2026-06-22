// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/encounters — pick the enemy Fighter(s) for a node. ║
// ║ Uses the existing archetype roster (real attacking enemies the AI      ║
// ║ planner can drive). Seeded by the run RNG for determinism.            ║
// ║ UPDATE WHEN: enemy pools per node type / act scaling change.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { makeEnemyFighter } from '../content/enemies.js';

const COMBAT_POOL = ['slime', 'hexer'];

/**
 * @param {{ type: string }} node
 * @param {{ pick:(a:any[])=>any }} [rng] seeded run RNG
 * @returns {import('../types.js').Fighter[]}
 */
export function enemyForNode(node, rng) {
  if (node.type === 'boss') return [makeEnemyFighter('boss')];
  if (node.type === 'elite') return [makeEnemyFighter('brute')];
  const key = rng ? rng.pick(COMBAT_POOL) : COMBAT_POOL[0];
  return [makeEnemyFighter(key)];
}
