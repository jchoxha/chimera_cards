// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/GameEngine — top-level run orchestrator.             ║
// ║ UPDATE WHEN: run-level state, map progression, or how combats are   ║
// ║ created/resolved changes.                                           ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Owns everything that persists ACROSS combats within a single expedition:
// the party, the run-level pity-offset RarityState, ascension toggle, RNG, and
// the AI pipeline handle. It builds CombatManagers for individual rooms and
// folds their results back into the run. The (future) Zustand/Phaser layers
// read this; the engine itself stays framework-free.

import { MonsterParty } from './party/MonsterParty.js';
import { CombatManager } from './combat/CombatManager.js';
import { createRarityState } from './cards/rarity.js';

/** @typedef {import('./types.js').Monster} Monster */
/** @typedef {import('./types.js').Enemy} Enemy */
/** @typedef {import('./types.js').RoomKind} RoomKind */
/** @typedef {import('./types.js').Card} Card */

export class GameEngine {
  /**
   * @param {Object} args
   * @param {Monster[]} args.party                 Starting team (≤3).
   * @param {boolean} [args.ascension7]            Harder difficulty toggle.
   * @param {import('./ai/AIPipeline.js').AIPipeline} [args.ai]
   * @param {(enemy: Enemy, state: any, rng: () => number) => any} args.enemyAI
   * @param {(rarity: string, type: string|null, rng: () => number) => Card} [args.pickCard]
   * @param {() => number} [args.rng]
   */
  constructor({ party, ascension7 = false, ai, enemyAI, pickCard, rng = Math.random }) {
    this.rng = rng;
    this.ai = ai;
    this.enemyAI = enemyAI;
    this.pickCard = pickCard;
    this.party = new MonsterParty(party);
    this.rarity = createRarityState(ascension7);
    /** @type {CombatManager|null} */ this.combat = null;
    this.room = 0; // index along the current path; map layer fills this in.
  }

  /**
   * Spin up a combat for a room. Returns the started CombatManager so the
   * caller can drive playCard/endPlayerTurn and read combat.state.
   * @param {Object} args
   * @param {Enemy[]} args.enemies
   * @param {RoomKind} args.room
   * @param {Object} [args.config]
   * @param {(e: any) => void} [args.log]
   * @returns {CombatManager}
   */
  startCombat({ enemies, room, config, log }) {
    this.combat = new CombatManager({
      party: this.party,
      enemies,
      room,
      rarity: this.rarity,       // shared so pity persists across the run
      enemyAI: this.enemyAI,
      pickCard: this.pickCard,
      config,
      log,
      rng: this.rng,
    });
    this.combat.startCombat();
    return this.combat;
  }

  /** @returns {boolean} the party survived the most recent combat. */
  get partyAlive() {
    return !this.party.isWiped;
  }
}
