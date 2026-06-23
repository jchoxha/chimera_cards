// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/encounters — pick the enemy Fighter(s) for a node. ║
// ║ Enemies are drawn from the GENERATED ROSTER (data/roster.js) — the     ║
// ║ same (archetype, biology, attunement) creatures the player picks from, ║
// ║ so foes have real axes, portraits, stats and decks. Seeded by the run  ║
// ║ RNG for determinism; node tier scales enemy HP.                        ║
// ║ UPDATE WHEN: enemy pools per node type / act scaling change.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { buildRoster } from '../../data/roster.js';
import { creatureToFighter } from './combatBridge.js';

// Archetype card pools keyed by class name (bundled JSON), for the generator.
const CARD_FILES = import.meta.glob('../../data/cards/*.json', { eager: true });
const POOLS = Object.fromEntries(
  Object.values(CARD_FILES).map((m) => { const f = m.default ?? m; return [f.class, f.cards || []]; }),
);
// The generated roster of enemies (rebuilt once; same creatures as the player roster).
const ENEMY_ROSTER = buildRoster(POOLS, POOLS.Warrior || []);

// HP multiplier per node tier (combat = baseline; elites/bosses are beefier).
const TIER_HP = { combat: 1, elite: 1.6, boss: 2.4 };

let _foeSeq = 0; // monotonic so two encounters in a run never share a fighter/card id

/** Convert a generated roster creature into a fresh, uniquely-identified enemy Fighter. */
function rosterFighter(creature, tier) {
  const tag = `foe${++_foeSeq}`;
  const mult = TIER_HP[tier] ?? 1;
  const maxHp = Math.round(creature.maxHp * mult);
  const f = creatureToFighter(creature, { id: `${tag}-${creature.id}`, hp: maxHp, maxHp });
  // Re-id the deck card instances so they can't collide with the player's copies.
  f.deck.drawPile = f.deck.drawPile.map((c) => ({ ...c, id: `${tag}:${c.id}` }));
  return f;
}

/**
 * @param {{ type: string }} node
 * @param {{ pick:(a:any[])=>any }} [rng] seeded run RNG
 * @returns {import('../types.js').Fighter[]}
 */
export function enemyForNode(node, rng) {
  const tier = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'combat';
  const pick = rng ? rng.pick(ENEMY_ROSTER) : ENEMY_ROSTER[0];
  return [rosterFighter(pick, tier)];
}
