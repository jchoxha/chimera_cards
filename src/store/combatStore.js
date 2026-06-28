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
import { partyToFighters, applyRelics } from '../engine/run/combatBridge.js';
import { DEFAULT_MONSTERS } from '../data/monsters.js';
import { TYPE_MOVES } from '../data/moves.js';

// Build the adapted roster + reward card pool once at module load.
const ROSTER = adaptRoster(DEFAULT_MONSTERS);
const POOL = buildCardPool({ rawMonsters: DEFAULT_MONSTERS, typeMoves: TYPE_MOVES });

// GH-Pages base path so /art/ resolves when deployed.
const ART_BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

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

/** Build a Fighter from data-driven CardSpec cards + a stat line (playtest). */
function buildCardFighter({ id, name, attunement, biology, klass, cards = [], stats, hp = 60 }) {
  const f = createFighter({
    id, name, hp, maxHp: hp, stats,
    types: attunement ? attunement.map((a) => ({ type: a, weight: 1 })) : [],
  });
  if (klass) f.class = klass;
  if (biology) f.biology = biology;
  if (attunement) f.attunement = attunement;
  f.deck.drawPile = cards.map((c) => ({ ...c, effects: cloneEffects(c.effects) }));
  return f;
}

/** A target dummy with lots of HP — does nothing on its turn (empty deck). Optional
 * attunement/biology so playtests can exercise the matchup layer (defender axes). */
function buildDummy({ hp = 200, name = 'Target Dummy', attunement, biology } = {}) {
  const f = createFighter({
    id: 'dummy', name, hp, maxHp: hp,
    types: attunement?.length ? attunement.map((a) => ({ type: a, weight: 1 })) : [],
  });
  if (attunement?.length) f.attunement = attunement;
  if (biology?.length) f.biology = biology;
  // AI-generated (Variant-B) portrait — trial of the agy art pipeline.
  f.meta = { ...f.meta, portrait: `${ART_BASE}art/gen/training-dummy.png` };
  return f;
}

/**
 * Map a single Fighter to its UI-safe shape.
 * @param {boolean} [includeDeck]  Expose the full deck card list (player side
 *   only — enemy decks stay hidden; the UI surfaces only enemy moves seen via
 *   the combat log).
 */
// Clone a card safely whether it's a data-driven CardSpec (op-LIST effects), a power
// card (no `effects` — trigger/passive only), or a legacy adapted card (flat effects
// object). Preserve the shape: an array clones to an array, an object to an object,
// and undefined/null stay as-is (turning a power's undefined into {} broke its text).
function cloneEffects(e) {
  if (Array.isArray(e)) return e.map((o) => ({ ...o }));
  return e ? { ...e } : e;
}
function cloneCard(c) {
  return { ...c, effects: cloneEffects(c.effects) };
}

function mapFighter(f, includeDeck = false) {
  return {
    id: f.id,
    name: f.name,
    hp: f.hp,
    maxHp: f.maxHp,
    block: f.block,
    bracedBlock: f.bracedBlock ?? 0,
    statuses: f.statuses.map((x) => ({ ...x })),
    types: f.types.map((t) => ({ ...t })),
    element: f.meta?.element ?? f.types[0]?.type ?? null,
    // New 3-axis taxonomy + Topic-1 stat line + Warrior stance (present once content uses them).
    stance: f.stance ?? null,
    stats: f.stats ? { ...f.stats } : null,
    axes: { class: f.class ?? null, biology: f.biology ?? null, attunement: f.attunement ?? null, family: f.family ?? null, anatomy: f.anatomy ?? null, weapons: f.weapons ?? null },
    powers: (f.powers ?? []).map((p) => ({
      id: p.source ?? p.id, on: p.on ?? null, passive: p.passive ?? null,
      attunement: p.attunement ?? null, effects: (p.effects ?? []).map((o) => ({ ...o })),
    })),
    hand: f.hand.map(cloneCard),
    piles: {
      draw: f.deck.drawPile.length,
      discard: f.deck.discardPile.length,
      exhaust: f.deck.exhaustPile.length,
    },
    deck: includeDeck
      ? [...f.deck.drawPile, ...f.deck.discardPile, ...f.deck.exhaustPile, ...f.hand].map(cloneCard)
      : null,
    sprite: f.meta?.sprite ?? null,
    form: f.meta?.form ?? 'regular',
    rarity: f.meta?.rarity ?? 'common',
    icon: f.meta?.icon ?? null,
    portrait: f.meta?.portrait ?? null,   // AI-generated creature art URL (overrides icon/silhouette)
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
      // Shock tax: extra energy the active Vanguard pays per Shocked ally (capped).
      // Surfaced so the hand can show the EFFECTIVE cost of each card.
      shockTax: typeof vm._shockTax === 'function' ? vm._shockTax('player') : 0,
      vanguardIndex: s.player.vanguardIndex,
      fighters: s.player.fighters.map((f) => mapFighter(f, true)),
      fortifySlot: { block: s.player.fortifySlot.block },
    },
    enemy: {
      vanguardIndex: s.enemy.vanguardIndex,
      fighters: s.enemy.fighters.map((f) => mapFighter(f, false)),
    },
    enemyPlan: s.enemyPlan.map((a) => {
      // Once an action is revealed (Peeked), expose the ACTUAL card so the UI can
      // show its full face on click. Hidden actions never leak the card.
      let card;
      if (a.revealed && a.detail?.cardId) {
        const actor = s.enemy.fighters.find((f) => f.id === a.actor);
        const c = actor?.hand?.find((h) => h.id === a.detail.cardId);
        if (c) card = cloneCard(c);
      }
      return {
        silhouette: a.silhouette,
        revealed: a.revealed,
        actor: a.actor,
        detail: a.detail
          ? { ...a.detail, effects: a.detail.effects ? { ...a.detail.effects } : undefined, card }
          : {},
      };
    }),
  };
}

/** Stamp each combat event with wall-clock time so the log can show playtime + local time. */
const stampEvent = (e) => { if (e && e._ts == null) e._ts = Date.now(); return e; };

export const useCombat = create((set, get) => ({
  /** @type {VanguardManager|null} */ vm: null,
  /** Mutable events array; spread on each update for React diff. */
  _events: null,
  snap: null,
  version: 0,
  log: [],
  reward: null,
  startedAt: null,   // wall-clock combat start (for the playtime timer)
  roster: ROSTER,

  startCombat({ party = DEFAULT_PARTY, encounter = DEFAULT_ENCOUNTER } = {}) {
    const events = [];
    const vm = new VanguardManager({
      playerFighters: buildPlayerFighters(party),
      enemyFighters: encounter.map(makeEnemyFighter),
      room: 'combat',
      rarity: { offset: -0.05, ascension7: false },
      pickCard: POOL.pick,
      log: (e) => events.push(stampEvent(e)),
    });
    vm.startCombat();
    set({ vm, _events: events, snap: snapshot(vm), version: 1, log: [...events], reward: null, startedAt: Date.now() });
  },

  /**
   * Start a PLAYTEST fight: one data-driven card deck vs a configurable enemy
   * (defaults to a no-axis target dummy with lots of HP). Feeds the editor's
   * author→playtest loop. `playerCards` are CardSpec objects (e.g. warrior.json).
   */
  startPlaytest({ party, enemyParty, elapsedMs = 0, playerCards = [], playerName = 'Warrior', stats, attunement, biology, klass, enemyHp = 200, enemyName, enemyAttunement, enemyBiology } = {}) {
    const events = [];
    // A chosen TEAM (vanguard + bench) takes precedence; else a single card-built hero.
    const playerFighters = (party && party.length)
      ? partyToFighters(party)
      : [buildCardFighter({ id: 'player', name: playerName, attunement, biology, klass, cards: playerCards, stats })];
    // A chosen OPPONENT team (e.g. a practice fight) takes precedence over the dummy.
    const enemyFighters = (enemyParty && enemyParty.length)
      ? partyToFighters(enemyParty)
      : [buildDummy({ hp: enemyHp, name: enemyName, attunement: enemyAttunement, biology: enemyBiology })];
    const vm = new VanguardManager({
      playerFighters,
      enemyFighters,
      room: 'combat',
      rarity: { offset: -0.05, ascension7: false },
      pickCard: POOL.pick,
      log: (e) => events.push(stampEvent(e)),
    });
    vm.startCombat();
    // startedAt is the timer ORIGIN: backdate it by elapsedMs so the playtime
    // clock continues from where a resumed run/practice left off (not from 0).
    set({ vm, _events: events, snap: snapshot(vm), version: 1, log: [...events], reward: null, startedAt: Date.now() - (elapsedMs || 0) });
  },

  /**
   * Start a RUN fight: the run party (per-monster decks/stats/HP) vs node enemies,
   * with the run's relics injected at combat start. Used by the run layer.
   * `elapsedMs` backdates the playtime clock so it resumes (doesn't reset).
   */
  startRunFight({ party = [], enemyFighters = [], relics = [], elapsedMs = 0 } = {}) {
    const events = [];
    const vm = new VanguardManager({
      playerFighters: partyToFighters(party),
      enemyFighters,
      room: 'combat',
      rarity: { offset: -0.05, ascension7: false },
      pickCard: POOL.pick,
      log: (e) => events.push(stampEvent(e)),
    });
    vm.startCombat();
    applyRelics(vm, relics);
    set({ vm, _events: events, snap: snapshot(vm), version: 1, log: [...events], reward: null, startedAt: Date.now() - (elapsedMs || 0) });
  },

  /** Use a potion (consumable) during combat. */
  useConsumable(potion, opts = {}) {
    const { vm, _events } = get();
    if (!vm) return;
    vm.useConsumable(potion, opts);
    set((st) => ({ snap: snapshot(vm), version: st.version + 1, log: [..._events] }));
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
    const reward = vm.generateReward(count).map((c) => ({ ...c, effects: cloneEffects(c.effects) }));
    set({ reward });
  },
}));
