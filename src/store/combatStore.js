// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/combatStore — Zustand bridge between the engine and   ║
// ║ the React view.                                                     ║
// ║ UPDATE WHEN: the UI needs more engine state, or new combat actions. ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The engine mutates a CombatState in place (fast, GC-light). React needs new
// references to re-render, so after every action we publish an immutable
// `snapshot` of just what the UI reads, plus a `version` tick. The engine and
// the live CombatManager are kept off to the side (not what components read).

import { create } from 'zustand';
import { GameEngine } from '../engine/index.js';
import { adaptRoster } from '../engine/content/adapt.js';
import { buildCardPool } from '../engine/content/cardPool.js';
import { makeEnemy, basicEnemyAI } from '../engine/content/enemies.js';
import { DEFAULT_MONSTERS } from '../data/monsters.js';
import { TYPE_MOVES } from '../data/moves.js';

// Build the content layer once at module load.
const ROSTER = adaptRoster(DEFAULT_MONSTERS);
const POOL = buildCardPool({ rawMonsters: DEFAULT_MONSTERS, typeMoves: TYPE_MOVES });

const DEFAULT_PARTY = ['Cindermouse', 'Snowpup', 'Tidalith'];
const DEFAULT_ENCOUNTER = ['slime', 'hexer'];

/** Run-scoped clones so combat never mutates roster templates. */
function cloneParty(names) {
  return names
    .map((n) => ROSTER.find((m) => m.name === n))
    .filter(Boolean)
    .map((m) => ({ ...m, hp: m.maxHp, types: m.types.map((t) => ({ ...t })), signatureCards: m.signatureCards.map((c) => ({ ...c })) }));
}

/** Immutable view of CombatState for the UI. */
function snapshot(cm) {
  const s = cm.state;
  return {
    phase: s.phase,
    turn: s.turn,
    energy: s.energy,
    energyPerTurn: s.energyPerTurn,
    block: s.block,
    statuses: s.statuses.map((x) => ({ ...x })),
    activeId: cm.party.active?.id ?? null,
    party: cm.party.members.map((m) => ({
      id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp,
      types: m.types.map((t) => ({ ...t })),
      element: m.types[0]?.type ?? null,
      sprite: m.meta?.sprite ?? null,
      form: m.form ?? 'regular',
      rarity: m.meta?.rarity ?? 'common',
    })),
    enemies: s.enemies.map((e) => ({
      id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, block: e.block,
      element: e.element ?? null,
      icon: e.icon ?? null,
      form: e.form ?? 'regular',
      rarity: e.rarity ?? 'common',
      intent: e.intent ? { ...e.intent } : null,
      statuses: e.statuses.map((x) => ({ ...x })),
    })),
    hand: s.hand.map((c) => ({ ...c, effects: { ...c.effects } })),
    piles: { draw: s.drawPile.length, discard: s.discardPile.length, exhaust: s.exhaustPile.length },
  };
}

export const useCombat = create((set, get) => ({
  /** @type {GameEngine|null} */ engine: null,
  /** @type {import('../engine/combat/CombatManager.js').CombatManager|null} */ combat: null,
  snap: null,
  version: 0,
  reward: null,
  log: [],

  roster: ROSTER,

  /** Start a fresh demo combat. */
  startCombat({ party = DEFAULT_PARTY, encounter = DEFAULT_ENCOUNTER } = {}) {
    const events = [];
    const engine = new GameEngine({
      party: cloneParty(party),
      enemyAI: basicEnemyAI,
      pickCard: POOL.pick,
    });
    const combat = engine.startCombat({
      enemies: encounter.map(makeEnemy),
      room: 'combat',
      log: (e) => events.push(e),
    });
    set({ engine, combat, snap: snapshot(combat), version: 1, reward: null, log: events });
  },

  /** Play a card from hand against an enemy (defaults to first living enemy). */
  playCard(cardId, enemyId) {
    const { combat } = get();
    if (!combat) return;
    const card = combat.state.hand.find((c) => c.id === cardId);
    if (!card) return;
    combat.playCard(card, { enemyId });
    set((st) => ({ snap: snapshot(combat), version: st.version + 1 }));
  },

  /** End the player turn (runs the enemy turn synchronously). */
  endTurn() {
    const { combat } = get();
    if (!combat) return;
    combat.endPlayerTurn();
    set((st) => ({ snap: snapshot(combat), version: st.version + 1 }));
  },

  /**
   * Swap the active (fronting) party monster during the player's turn.
   * In this engine block/energy/statuses/deck are shared player-side, so a
   * switch only changes which monster's HP absorbs damage and gets regen — a
   * free tactical swap. (Balance lever: could later cost energy or the turn.)
   * @param {string} monsterId
   */
  switchActive(monsterId) {
    const { combat } = get();
    if (!combat) return;
    if (combat.state.phase !== 'player') return;
    const idx = combat.party.members.findIndex((m) => m.id === monsterId);
    if (idx < 0) return;
    if (!combat.party.setActive(idx)) return; // refuses fainted monsters
    combat.state.activeIndex = combat.party.activeIndex;
    set((st) => ({ snap: snapshot(combat), version: st.version + 1 }));
  },

  /** Generate the post-victory card reward. */
  rollReward(count = 3) {
    const { combat } = get();
    if (!combat) return;
    const reward = combat.generateReward(count);
    set({ reward });
  },
}));
