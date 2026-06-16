// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/CombatManager — the StS2-style turn cycle.    ║
// ║ UPDATE WHEN: turn phases, energy/block rules, the status system, or ║
// ║ reward generation change.                                           ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Drives one fight end to end. Phase order (spec §2B):
//   Draw Phase → Player Turn → Discard Phase → Enemy Intent Phase → Enemy Turn
// then re-telegraph intents and loop until victory or defeat.
//
// The manager owns a CombatState, mutates it, and emits CombatEvents through an
// optional `log` sink so the (future Phaser) view layer can animate without the
// engine ever importing a renderer. RNG is injected for deterministic tests and
// server-authoritative multiplayer.

import { CardDeck } from '../cards/CardDeck.js';
import { draftCards } from '../cards/rarity.js';
import { PHASES } from '../types.js';

/** @typedef {import('../types.js').CombatState} CombatState */
/** @typedef {import('../types.js').Card} Card */
/** @typedef {import('../types.js').Enemy} Enemy */
/** @typedef {import('../types.js').Intent} Intent */
/** @typedef {import('../types.js').StatusEffect} StatusEffect */
/** @typedef {import('../party/MonsterParty.js').MonsterParty} MonsterParty */
/** @typedef {import('../types.js').RarityState} RarityState */

const DEFAULTS = { energyPerTurn: 3, handSize: 5 };

export class CombatManager {
  /**
   * @param {Object} args
   * @param {MonsterParty} args.party
   * @param {Enemy[]} args.enemies                 Act left-to-right.
   * @param {import('../types.js').RoomKind} args.room
   * @param {RarityState} args.rarity              Run-level pity state (mutated).
   * @param {(enemy: Enemy, state: CombatState, rng: () => number) => Intent} args.enemyAI
   *        Chooses & telegraphs an enemy's next intent.
   * @param {(rarity: string, type: string|null, rng: () => number) => Card} [args.pickCard]
   *        Card-database resolver for rewards (see rarity.draftCards).
   * @param {Object} [args.config]                 { energyPerTurn, handSize }
   * @param {(e: import('../types.js').CombatEvent) => void} [args.log]
   * @param {() => number} [args.rng]
   */
  constructor({ party, enemies, room, rarity, enemyAI, pickCard, config, log, rng = Math.random }) {
    this.party = party;
    this.enemyAI = enemyAI;
    this.pickCard = pickCard;
    this.rng = rng;
    const cfg = { ...DEFAULTS, ...config };

    this.deck = new CardDeck(party.buildCombatDeck(), rng);

    /** @type {CombatState} */
    this.state = {
      phase: PHASES.DRAW,
      turn: 0,
      energy: 0,
      energyPerTurn: cfg.energyPerTurn,
      handSize: cfg.handSize,
      hand: this.deck.hand,
      drawPile: this.deck.drawPile,
      discardPile: this.deck.discardPile,
      exhaustPile: this.deck.exhaustPile,
      party: party.members,
      activeIndex: party.activeIndex,
      block: 0,
      statuses: [],
      enemies,
      room,
      rarity,
      log,
    };
  }

  /** @param {string} type @param {any} [payload] */
  _emit(type, payload) { this.state.log?.({ type, payload }); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Begin the fight: telegraph intents, then the opening player turn. */
  startCombat() {
    this._telegraphIntents();
    this.startPlayerTurn(/* opening */ true);
    return this.state;
  }

  // ── Draw Phase / Player Turn ────────────────────────────────────────────────

  /**
   * Draw Phase: new turn, refill energy, reset block, tick DoTs, draw a hand.
   * On the opening turn we use drawOpeningHand() so Innate cards surface first.
   * @param {boolean} [opening]
   */
  startPlayerTurn(opening = false) {
    const s = this.state;
    s.turn += 1;
    s.phase = PHASES.DRAW;
    this._emit('phase', { phase: PHASES.DRAW, turn: s.turn });

    s.energy = s.energyPerTurn;
    s.block = 0; // Block expires at the start of your turn (no Retain in Phase 1).

    this._tickStartOfTurn(/* isPlayer */ true);
    if (this._checkEnd()) return s;

    if (opening) this.deck.drawOpeningHand(s.handSize);
    else this.deck.draw(s.handSize);
    this._syncPiles();
    this._emit('draw', { hand: s.hand.slice() });

    s.phase = PHASES.PLAYER;
    this._emit('phase', { phase: PHASES.PLAYER });
    return s;
  }

  /**
   * Play a card from hand against an optional target enemy.
   * @param {Card} card
   * @param {{ enemyId?: string }} [opts]
   * @returns {boolean} whether the card was played.
   */
  playCard(card, opts = {}) {
    const s = this.state;
    if (s.phase !== PHASES.PLAYER) return false;
    if (!s.hand.includes(card)) return false;
    if (card.keywords?.includes('unplayable') || card.cost === -2) return false;

    const cost = card.cost === -1 ? s.energy : card.cost; // X-cost spends all energy
    if (cost > s.energy) return false;
    s.energy -= cost;

    const target = this._resolveTarget(opts.enemyId);
    this._applyCardEffects(card, target, cost);

    // Leave hand: Exhaust if flagged, else discard.
    if (card.keywords?.includes('exhaust')) this.deck.exhaust(card);
    else this.deck.discard(card);
    this._syncPiles();

    this._emit('play', { card, targetId: target?.id ?? null });
    this._checkEnd();
    return true;
  }

  /** Discard Phase → hands off to the enemy turn. */
  endPlayerTurn() {
    const s = this.state;
    if (s.phase !== PHASES.PLAYER) return s;

    s.phase = PHASES.DISCARD;
    const result = this.deck.discardHandEndOfTurn();
    this._syncPiles();
    this._emit('phase', { phase: PHASES.DISCARD, ...result });

    this._tickEndOfTurn(/* isPlayer */ true);
    if (this._checkEnd()) return s;

    return this._enemyTurn();
  }

  // ── Enemy Intent Phase / Enemy Turn ─────────────────────────────────────────

  /** Resolve every enemy's telegraphed intent, left to right, then re-telegraph. */
  _enemyTurn() {
    const s = this.state;
    s.phase = PHASES.ENEMY_INTENT;
    this._emit('phase', { phase: PHASES.ENEMY_INTENT });

    s.phase = PHASES.ENEMY;
    for (const enemy of s.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.block = 0; // enemy block also expires at the start of its turn
      this._tickStartOfTurn(false, enemy);
      if (enemy.hp <= 0) continue;
      this._resolveIntent(enemy);
      if (this._checkEnd()) return s;
    }
    this._tickEndOfTurn(false);

    this._telegraphIntents();
    if (this._checkEnd()) return s;
    return this.startPlayerTurn();
  }

  /** @param {Enemy} enemy */
  _resolveIntent(enemy) {
    const intent = enemy.intent;
    if (!intent) return;
    switch (intent.kind) {
      case 'attack': {
        const hits = intent.hits ?? 1;
        for (let i = 0; i < hits; i++) {
          const dmg = computeAttackDamage(intent.value ?? 0, enemy.statuses, this.state.statuses);
          this._damagePlayer(dmg);
        }
        break;
      }
      case 'block':
        enemy.block += intent.value ?? 0;
        break;
      case 'buff':
        addStatus(enemy.statuses, { id: 'strength', amount: intent.value ?? 0, stacking: 'intensity' });
        break;
      case 'debuff':
        addStatus(this.state.statuses, { id: 'weak', amount: intent.value ?? 0, stacking: 'duration' });
        break;
      default: break;
    }
    this._emit('intentResolved', { enemyId: enemy.id, intent });
  }

  _telegraphIntents() {
    for (const enemy of this.state.enemies) {
      if (enemy.hp > 0) enemy.intent = this.enemyAI(enemy, this.state, this.rng);
    }
    this._emit('intents', { enemies: this.state.enemies.map((e) => ({ id: e.id, intent: e.intent })) });
  }

  // ── Effect resolution ───────────────────────────────────────────────────────

  /**
   * @param {Card} card @param {Enemy|null} target @param {number} costPaid
   */
  _applyCardEffects(card, target, costPaid) {
    const s = this.state;
    const fx = card.effects ?? {};
    const scale = card.cost === -1 ? Math.max(1, costPaid) : 1; // X-cost scales with energy spent

    if (fx.block) this._gainBlock(fx.block * scale);
    if (fx.draw) { this.deck.draw(fx.draw * scale); this._syncPiles(); }
    if (fx.energy) s.energy += fx.energy * scale;
    if (fx.strength) addStatus(s.statuses, { id: 'strength', amount: fx.strength * scale, stacking: 'intensity' });
    if (fx.selfStatus) for (const [id, amt] of Object.entries(fx.selfStatus))
      addStatus(s.statuses, { id, amount: amt * scale, stacking: stackingFor(id) });

    if (fx.dmg && target) {
      const hits = (fx.hits ?? 1) * scale;
      for (let i = 0; i < hits; i++) {
        if (target.hp <= 0) break;
        const dmg = computeAttackDamage(fx.dmg, s.statuses, target.statuses);
        this._damageEnemy(target, dmg);
      }
    }
    if (fx.applyStatus && target) for (const [id, amt] of Object.entries(fx.applyStatus))
      addStatus(target.statuses, { id, amount: amt * scale, stacking: stackingFor(id) });
  }

  _gainBlock(amount) {
    this.state.block += amount;
    this._emit('block', { who: 'player', amount, total: this.state.block });
  }

  /** @param {Enemy} enemy @param {number} amount */
  _damageEnemy(enemy, amount) {
    const absorbed = Math.min(enemy.block, amount);
    enemy.block -= absorbed;
    const hpLoss = amount - absorbed;
    enemy.hp = Math.max(0, enemy.hp - hpLoss);
    this._emit('damage', { targetId: enemy.id, amount, hpLoss, hp: enemy.hp });
    if (enemy.hp === 0) this._emit('death', { enemyId: enemy.id });
  }

  /** Damage directed at the player: block first, then the active monster's HP. */
  _damagePlayer(amount) {
    const s = this.state;
    const absorbed = Math.min(s.block, amount);
    s.block -= absorbed;
    let hpLoss = amount - absorbed;
    if (hpLoss <= 0) return;

    const active = this.party.active;
    if (!active) return;
    active.hp = Math.max(0, active.hp - hpLoss);
    s.activeIndex = this.party.activeIndex;
    this._emit('damage', { targetId: active.id, amount, hpLoss, hp: active.hp });

    if (active.hp === 0) {
      this._emit('death', { monsterId: active.id });
      const next = this.party.survivors[0];
      if (next) { this.party.setActive(this.party.members.indexOf(next)); s.activeIndex = this.party.activeIndex; }
    }
  }

  // ── Status ticking ──────────────────────────────────────────────────────────

  /**
   * Start-of-turn: damage-over-time (burn/poison) ticks on the entity whose
   * turn is beginning, then decrements by 1 (StS poison behavior).
   * @param {boolean} isPlayer @param {Enemy} [enemy]
   */
  _tickStartOfTurn(isPlayer, enemy) {
    const statuses = isPlayer ? this.state.statuses : enemy.statuses;
    for (const id of ['burn', 'poison']) {
      const st = statuses.find((x) => x.id === id);
      if (!st || st.amount <= 0) continue;
      if (isPlayer) this._damagePlayerDirect(st.amount);
      else this._damageEnemy(enemy, st.amount); // DoT ignores nothing special here
      st.amount -= 1;
    }
    pruneStatuses(statuses);
  }

  /** @param {boolean} isPlayer @param {Enemy} [enemy] */
  _tickEndOfTurn(isPlayer, enemy) {
    const statuses = isPlayer ? this.state.statuses : enemy?.statuses ?? [];
    // Regen heals the active monster (player) at end of turn, then decrements.
    const regen = statuses.find((x) => x.id === 'regen');
    if (regen && regen.amount > 0 && isPlayer) {
      const active = this.party.active;
      if (active) active.hp = Math.min(active.maxHp, active.hp + regen.amount);
      regen.amount -= 1;
    }
    // Duration debuffs (weak/vulnerable/frail) count down at end of turn.
    for (const st of statuses) if (st.stacking === 'duration' && st.id !== 'regen') st.amount -= 1;
    pruneStatuses(statuses);
  }

  /** DoT damage straight to the active monster (bypasses block, like poison). */
  _damagePlayerDirect(amount) {
    const active = this.party.active;
    if (!active) return;
    active.hp = Math.max(0, active.hp - amount);
    this.state.activeIndex = this.party.activeIndex;
    this._emit('damage', { targetId: active.id, amount, hpLoss: amount, hp: active.hp, dot: true });
    if (active.hp === 0) this._emit('death', { monsterId: active.id });
  }

  // ── Rewards (adaptive Pity Offset engine) ───────────────────────────────────

  /**
   * Generate a post-combat card reward offering, advancing the pity offset.
   * Boss rooms force Rare; otherwise rarity follows the offset and the card's
   * type follows the party's combined typing distribution (spec §2A/§2B).
   * @param {number} [count]
   * @returns {Card[]}
   */
  generateReward(count = 3) {
    if (!this.pickCard) throw new Error('generateReward needs a pickCard resolver');
    return draftCards({
      state: this.state.rarity,
      room: this.state.room,
      count,
      typeWeights: this.party.combinedTypeWeights(),
      pickCard: this.pickCard,
      rng: this.rng,
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  _resolveTarget(enemyId) {
    const s = this.state;
    if (enemyId) return s.enemies.find((e) => e.id === enemyId && e.hp > 0) ?? null;
    return s.enemies.find((e) => e.hp > 0) ?? null; // default: first living enemy
  }

  /** Keep CombatState's pile references pointing at the deck's live arrays. */
  _syncPiles() {
    const s = this.state;
    s.hand = this.deck.hand;
    s.drawPile = this.deck.drawPile;
    s.discardPile = this.deck.discardPile;
    s.exhaustPile = this.deck.exhaustPile;
  }

  /** @returns {boolean} true if the fight ended (sets victory/defeat phase). */
  _checkEnd() {
    const s = this.state;
    if (this.party.isWiped) { s.phase = PHASES.DEFEAT; this._emit('phase', { phase: PHASES.DEFEAT }); return true; }
    if (s.enemies.every((e) => e.hp <= 0)) { s.phase = PHASES.VICTORY; this._emit('phase', { phase: PHASES.VICTORY }); return true; }
    return false;
  }
}

// ── Status helpers (module-private) ───────────────────────────────────────────

/** Default stacking behavior per status id. */
function stackingFor(id) {
  if (id === 'strength' || id === 'burn' || id === 'poison') return 'intensity';
  return 'duration'; // weak, vulnerable, frail, regen
}

/**
 * Add/merge a status into a list (intensity & duration both accumulate amount).
 * @param {StatusEffect[]} list @param {StatusEffect} status
 */
function addStatus(list, status) {
  const existing = list.find((s) => s.id === status.id);
  if (existing) existing.amount += status.amount;
  else list.push({ ...status });
}

/** @param {StatusEffect[]} list */
function pruneStatuses(list) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].amount <= 0) list.splice(i, 1);
}

/**
 * StS attack math: (base + attacker Strength), then ×0.75 if attacker is Weak,
 * then ×1.5 if the target is Vulnerable. Floored, min 0.
 * @param {number} base @param {StatusEffect[]} attacker @param {StatusEffect[]} target
 * @returns {number}
 */
export function computeAttackDamage(base, attacker, target) {
  const strength = attacker.find((s) => s.id === 'strength')?.amount ?? 0;
  let dmg = base + strength;
  if (attacker.some((s) => s.id === 'weak')) dmg *= 0.75;
  if (target.some((s) => s.id === 'vulnerable')) dmg *= 1.5;
  return Math.max(0, Math.floor(dmg));
}
