// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/combatStore — Zustand bridge between the engine and   ║
// ║ the React view. Wraps VanguardManager (symmetrical Vanguard/Peek    ║
// ║ model) and exposes an immutable snapshot each render.               ║
// ║ UPDATE WHEN: the UI needs more engine state, or new combat actions. ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The engine mutates CombatState in place (GC-light). React needs new
// references to re-render, so after every action we publish an immutable
// `snapshot` of what the UI reads, plus a `version` tick.

import { create } from 'zustand';
import { VanguardManager } from '../engine/combat/VanguardManager.js';
import { createFighter } from '../engine/combat/state.js';
import { adaptRoster } from '../engine/content/adapt.js';
import { buildCardPool } from '../engine/content/cardPool.js';
import { makeEnemyFighter } from '../engine/content/enemies.js';
import { DEFAULT_MONSTERS } from '../data/monsters.js';
import { TYPE_MOVES } from '../data/moves.js';

// Build the adapted roster + reward card pool once at module load.
const ROSTER = adaptRoster(DEFAULT_MONSTERS);
const POOL = buildCardPool({ rawMonsters: DEFAULT_MONSTERS, typeMoves: TYPE_MOVES });

const DEFAULT_PARTY = ['Cindermouse', 'Snowpup', 'Tidalith'];
const DEFAULT_ENCOUNTER = ['slime', 'hexer'];

/** Convert an adapted Monster → Fighter (loads signatureCards as draw pile). */
function monsterToFighter(m) {
  const f = createFighter({
    id: m.id,
    name: m.name,
    types: m.types,
    hp: m.hp,
    maxHp: m.maxHp,
    meta: { ...m.meta, form: m.form },
  });
  f.deck.drawPile = m.signatureCards.map((c) => ({ ...c }));
  return f;
}

/** Build player Fighter[] from party name list. */
function buildPlayerFighters(names) {
  return names
    .map((n) => ROSTER.find((m) => m.name === n))
    .filter(Boolean)
    .map(monsterToFighter);
}

/**
 * Map a single Fighter to its UI-safe shape.
 * @param {boolean} [includeDeck]  Expose the full deck card list (player side
 *   only — enemy decks stay hidden; the UI surfaces only enemy moves seen via
 *   the combat log).
 */
function mapFighter(f, includeDeck = false) {
  return {
    id: f.id,
    name: f.name,
    hp: f.hp,
    maxHp: f.maxHp,
    block: f.block,
    statuses: f.statuses.map((x) => ({ ...x })),
    types: f.types.map((t) => ({ ...t })),
    element: f.meta?.element ?? f.types[0]?.type ?? null,
    hand: f.hand.map((c) => ({ ...c, effects: { ...c.effects } })),
    piles: {
      draw: f.deck.drawPile.length,
      discard: f.deck.discardPile.length,
      exhaust: f.deck.exhaustPile.length,
    },
    deck: includeDeck
      ? [...f.deck.drawPile, ...f.deck.discardPile, ...f.deck.exhaustPile, ...f.hand]
          .map((c) => ({ ...c, effects: { ...c.effects } }))
      : null,
    sprite: f.meta?.sprite ?? null,
    form: f.meta?.form ?? 'regular',
    rarity: f.meta?.rarity ?? 'common',
    icon: f.meta?.icon ?? null,
  };
}

/** Immutable snapshot of CombatState for the UI. */
function snapshot(vm) {
  const s = vm.state;
  return {
    phase: s.phase,
    turn: s.turn,
    peekCharges: s.peekCharges,
    player: {
      energy: s.player.energy,
      energyPerTurn: s.player.energyPerTurn,
      manualSwapsThisTurn: s.player.manualSwapsThisTurn,
      vanguardIndex: s.player.vanguardIndex,
      fighters: s.player.fighters.map((f) => mapFighter(f, true)),
      fortifySlot: { block: s.player.fortifySlot.block },
    },
    enemy: {
      vanguardIndex: s.enemy.vanguardIndex,
      fighters: s.enemy.fighters.map((f) => mapFighter(f, false)),
    },
    enemyPlan: s.enemyPlan.map((a) => ({
      silhouette: a.silhouette,
      revealed: a.revealed,
      actor: a.actor,
      detail: a.detail
        ? { ...a.detail, effects: a.detail.effects ? { ...a.detail.effects } : undefined }
        : {},
    })),
  };
}

export const useCombat = create((set, get) => ({
  /** @type {VanguardManager|null} */ vm: null,
  /** Mutable events array; spread on each update for React diff. */
  _events: null,
  snap: null,
  version: 0,
  log: [],
  reward: null,
  roster: ROSTER,

  startCombat({ party = DEFAULT_PARTY, encounter = DEFAULT_ENCOUNTER } = {}) {
    const events = [];
    const vm = new VanguardManager({
      playerFighters: buildPlayerFighters(party),
      enemyFighters: encounter.map(makeEnemyFighter),
      room: 'combat',
      rarity: { offset: -0.05, ascension7: false },
      pickCard: POOL.pick,
      log: (e) => events.push(e),
    });
    vm.startCombat();
    set({ vm, _events: events, snap: snapshot(vm), version: 1, log: [...events], reward: null });
  },

  /** Play a card from the player Vanguard's hand. */
  play(cardId, opts = {}) {
    const { vm, _events } = get();
    if (!vm) return;
    vm.play(cardId, opts);
    set((st) => ({ snap: snapshot(vm), version: st.version + 1, log: [..._events] }));
  },

  /** Swap player Vanguard with a benched fighter by its index in fighters[]. */
  swap(benchIndex) {
    const { vm, _events } = get();
    if (!vm) return;
    vm.swap(benchIndex);
    set((st) => ({ snap: snapshot(vm), version: st.version + 1, log: [..._events] }));
  },

  /** Spend a Peek charge to reveal a single planned action slot. */
  peek(planIndex) {
    const { vm, _events } = get();
    if (!vm) return;
    vm.peek(planIndex);
    set((st) => ({ snap: snapshot(vm), version: st.version + 1, log: [..._events] }));
  },

  /** Spend one Peek charge to reveal the enemy's entire forecasted turn. */
  peekAll() {
    const { vm, _events } = get();
    if (!vm) return;
    vm.peekAll();
    set((st) => ({ snap: snapshot(vm), version: st.version + 1, log: [..._events] }));
  },

  /** End the player turn (runs enemy turn synchronously). */
  endTurn() {
    const { vm, _events } = get();
    if (!vm) return;
    vm.endTurn();
    set((st) => ({ snap: snapshot(vm), version: st.version + 1, log: [..._events] }));
  },

  /** Roll the post-victory card reward offering. */
  rollReward(count = 3) {
    const { vm } = get();
    if (!vm) return;
    const reward = vm.generateReward(count).map((c) => ({ ...c, effects: { ...c.effects } }));
    set({ reward });
  },
}));
