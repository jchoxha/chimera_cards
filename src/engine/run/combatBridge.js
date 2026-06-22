// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/combatBridge — bridges the RUN layer and the       ║
// ║ in-place VanguardManager combat. Builds Fighters from the run party    ║
// ║ (per-monster decks/stats/HP), runs a combat as a sub-process, and      ║
// ║ folds the outcome (surviving HP, win/loss) back as a run action.       ║
// ║ UPDATE WHEN: party→fighter mapping or outcome shape changes.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createFighter } from '../combat/state.js';
import { VanguardManager } from '../combat/VanguardManager.js';
import { makeRng } from './rng.js';

/** Build combat Fighters from the LIVING run party (carrying current HP + deck + stats + axes). */
export function partyToFighters(party) {
  return party.filter((m) => m.hp > 0).map((m) => {
    const f = createFighter({
      id: m.id,
      name: m.name,
      types: (m.attunement ?? ['Physical']).map((a) => ({ type: a, weight: 1 })),
      hp: m.hp,
      maxHp: m.maxHp,
      stats: m.stats,
    });
    if (m.class) f.class = m.class;
    if (m.biology) f.biology = m.biology;
    if (m.attunement) f.attunement = m.attunement;
    f.deck.drawPile = (m.deck ?? []).map((c) => ({ ...c }));
    return f;
  });
}

/**
 * Start a combat for the current run node. Combat RNG is forked deterministically
 * from the run's RNG state + floor (so a given run/floor replays the same), but is
 * NOT threaded back — the run's own rngState advances via map/reward draws.
 * @param {Object} runState
 * @param {import('../types.js').Fighter[]} enemyFighters
 * @param {{ room?: string }} [opts]
 * @returns {VanguardManager}
 */
export function startRunCombat(runState, enemyFighters, { room = 'combat' } = {}) {
  const combatRng = makeRng((runState.rngState ^ (runState.floor * 0x9e3779b1)) >>> 0);
  const vm = new VanguardManager({
    playerFighters: partyToFighters(runState.party),
    enemyFighters,
    room,
    rarity: { offset: -0.05, ascension7: false },
    rng: () => combatRng.next(),
  });
  vm.startCombat();
  return vm;
}

/** Read a finished combat's outcome for fold-back. */
export function combatOutcome(vm) {
  const won = vm.state.phase === 'victory';
  const hpById = {};
  for (const f of vm.state.player.fighters) hpById[f.id] = f.hp;
  return { won, hpById };
}
