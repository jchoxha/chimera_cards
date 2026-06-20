// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/combat/VanguardManager — turn manager for the       ║
// ║ symmetrical Active Vanguard + Bench action-economy model.           ║
// ║ UPDATE WHEN: turn phase logic, block decay rules, DoT/Regen ticks,  ║
// ║ or public manager API changes (spec §9).                          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { PHASES } from '../types.js';
import { createCombatState, createPlannedAction } from './state.js';
import {
  vanguard,
  benchFighters,
  pruneStatuses,
  addStatus,
  applyDamage,
  applyHeal,
  gainBlock,
  computeAttackDamage,
  applyCardEffects,
  stackingFor
} from './resolve.js';
import {
  drawCards,
  drawFreshHand,
  discardCard,
  exhaustCard,
  discardHandEndOfTurn,
  discardWholeHand
} from './deckOps.js';
import { draftCards, combinedTypeWeights } from '../cards/rarity.js';

/** @typedef {import('../types.js').CombatState} CombatState */
/** @typedef {import('../types.js').Fighter} Fighter */
/** @typedef {import('../types.js').PlannedAction} PlannedAction */
/** @typedef {import('../types.js').Card} Card */

export class VanguardManager {
  /**
   * @param {Object} args
   * @param {Fighter[]} args.playerFighters
   * @param {Fighter[]} args.enemyFighters
   * @param {import('../types.js').RoomKind} args.room
   * @param {import('../types.js').RarityState} args.rarity
   * @param {Object} [args.config]                 { energyPerTurn, handSize, peekCharges }
   * @param {(e: any) => void} [args.log]
   * @param {() => number} [args.rng]
   * @param {(rarity: import('../types.js').CardRarity, type: string|null, rng: ()=>number) => import('../types.js').Card} [args.pickCard]
   *        Card-database resolver for post-victory rewards (see cardPool.js). If
   *        omitted, `generateReward` throws.
   */
  constructor({ playerFighters, enemyFighters, room, rarity, config, log, rng = Math.random, pickCard }) {
    this.rng = rng;
    this.config = config;
    this.pickCard = pickCard;

    // createCombatState sets energyRule: 'bench' for both sides
    this.state = createCombatState({
      playerFighters,
      enemyFighters,
      room,
      rarity,
      log,
      config
    });
  }

  /** @param {string} type @param {any} [payload] */
  _emit(type, payload) {
    this.state.log?.({ type, payload });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Begin the fight: telegraph intents, then the opening player turn. */
  startCombat() {
    this.startRound();
    return this.state;
  }

  // ── Round Loop ─────────────────────────────────────────────────────────────

  /**
   * ROUND START / planning
   * Computes the forecasted enemy plan, resets swaps, and proceeds to draw.
   */
  startRound() {
    const s = this.state;
    s.turn += 1;
    s.phase = PHASES.ENEMY_INTENT;
    this._emit('phase', { phase: PHASES.ENEMY_INTENT, turn: s.turn });

    // Reset manual swaps counter for both sides at round start
    s.player.manualSwapsThisTurn = 0;
    s.enemy.manualSwapsThisTurn = 0;

    // Symmetrically, draw cards for enemy Vanguard before generating plan
    const eVanguard = vanguard(s.enemy);
    if (eVanguard) {
      if (s.turn === 1) {
        drawFreshHand(eVanguard, s.enemy.handSize, this.rng);
      } else {
        const toDraw = Math.max(0, s.enemy.handSize - eVanguard.hand.length);
        drawCards(eVanguard, toDraw, this.rng);
      }
      this._emit('draw', { side: 'enemy', hand: eVanguard.hand.slice() });
    }

    // Generate the enemy plan
    this._generateEnemyPlan();

    // Proceed to draw phase
    this.playerDrawPhase();
  }

  /**
   * Version-B AI Planner (full multi-Vanguard lookahead).
   */
  _generateEnemyPlan() {
    const s = this.state;
    const enemyVanguard = vanguard(s.enemy);
    if (!enemyVanguard) {
      s.enemyPlan = [];
      return;
    }

    const playerVanguard = vanguard(s.player);
    if (!playerVanguard) {
      s.enemyPlan = [];
      return;
    }

    // 1. Clone the enemy side for planning simulation
    const simSide = {
      fighters: s.enemy.fighters.map(f => ({
        id: f.id,
        name: f.name,
        hp: f.hp,
        maxHp: f.maxHp,
        block: f.block,
        types: [...f.types],
        statuses: f.statuses.map(st => ({ ...st })),
        deck: {
          drawPile: [...f.deck.drawPile],
          discardPile: [...f.deck.discardPile],
          exhaustPile: [...f.deck.exhaustPile]
        },
        hand: [...f.hand]
      })),
      vanguardIndex: s.enemy.vanguardIndex,
      energy: s.enemy.energy,
      energyPerTurn: s.enemy.energyPerTurn,
      manualSwapsThisTurn: s.enemy.manualSwapsThisTurn,
      fortifySlot: {
        statuses: s.enemy.fortifySlot.statuses.map(st => ({ ...st })),
        block: s.enemy.fortifySlot.block,
        duration: s.enemy.fortifySlot.duration
      },
      handSize: s.enemy.handSize
    };

    // If calling from startRound, reset the energy for simulation
    if (s.phase === PHASES.ENEMY_INTENT) {
      const benchedCount = simSide.fighters.filter((f, idx) => f.hp > 0 && idx !== simSide.vanguardIndex).length;
      simSide.energy = Math.max(3, benchedCount);
      simSide.manualSwapsThisTurn = 0;
    }

    const plan = [];

    // 2. Planning loop
    while (true) {
      const simVanguard = simSide.fighters[simSide.vanguardIndex];
      if (!simVanguard || simVanguard.hp <= 0) break;

      // Find playable cards in simulated hand
      const playableCards = simVanguard.hand.filter(c => {
        if (c.keywords?.includes('unplayable') || c.cost === -2) return false;
        const cost = c.cost === -1 ? simSide.energy : c.cost;
        return cost <= simSide.energy;
      });

      // Find benched fighters for manual swap
      const swapCost = simSide.manualSwapsThisTurn + 1;
      const canSwap = simSide.energy >= swapCost;
      const benched = simSide.fighters.filter((f, idx) => f.hp > 0 && idx !== simSide.vanguardIndex);

      // If no moves can be made, terminate planning
      if (playableCards.length === 0 && (!canSwap || benched.length === 0)) {
        break;
      }

      let decision = null;

      // Rule 1: Lethal burst check
      let totalComboDmg = 0;
      let highestDmgAttack = null;
      let highestDmgVal = -1;

      for (const c of playableCards) {
        if (c.effects?.dmg) {
          const dmg = getExpectedHPLoss(c, simVanguard, playerVanguard, s.player, simSide.energy);
          totalComboDmg += dmg;
          if (dmg > highestDmgVal) {
            highestDmgVal = dmg;
            highestDmgAttack = c;
          }
        }
      }

      const isLethalCombo = totalComboDmg >= playerVanguard.hp;
      if (isLethalCombo && highestDmgAttack) {
        decision = { type: 'play', card: highestDmgAttack };
      }

      // Rule 2: Swap to type advantage check
      if (!decision && canSwap && benched.length > 0) {
        const currentMult = getMatchupMultiplier(simVanguard, playerVanguard);
        let bestBenchedFighter = null;
        let bestBenchedIdx = -1;
        let bestBenchedMult = currentMult;

        simSide.fighters.forEach((f, idx) => {
          if (f.hp > 0 && idx !== simSide.vanguardIndex) {
            const mult = getMatchupMultiplier(f, playerVanguard);
            if (mult > bestBenchedMult && mult > 1.0) {
              bestBenchedMult = mult;
              bestBenchedFighter = f;
              bestBenchedIdx = idx;
            }
          }
        });

        if (bestBenchedFighter) {
          decision = { type: 'swap', index: bestBenchedIdx };
        }
      }

      // Rule 3: Block/Fortify if HP < 40% check
      if (!decision) {
        const hpPct = simVanguard.hp / simVanguard.maxHp;
        if (hpPct < 0.40) {
          let bestDefensiveCard = null;
          let maxDefensiveVal = -1;
          for (const c of playableCards) {
            const blockVal = c.effects?.block ?? 0;
            const fortifyVal = c.effects?.fortify?.block ?? 0;
            const totalDef = blockVal + fortifyVal;
            if (totalDef > maxDefensiveVal && totalDef > 0) {
              maxDefensiveVal = totalDef;
              bestDefensiveCard = c;
            }
          }
          if (bestDefensiveCard) {
            decision = { type: 'play', card: bestDefensiveCard };
          }
        }
      }

      // Rule 4: Highest value attack check
      if (!decision) {
        let bestAttackCard = null;
        let maxAttackDmg = -1;
        for (const c of playableCards) {
          if (c.effects?.dmg) {
            const dmg = getExpectedHPLoss(c, simVanguard, playerVanguard, s.player, simSide.energy);
            if (dmg > maxAttackDmg) {
              maxAttackDmg = dmg;
              bestAttackCard = c;
            }
          }
        }
        if (bestAttackCard) {
          decision = { type: 'play', card: bestAttackCard };
        }
      }

      // Rule 5: Fallback play of any other card to avoid wasting energy
      if (!decision && playableCards.length > 0) {
        let bestOtherCard = playableCards[0];
        for (const c of playableCards) {
          const cost = c.cost === -1 ? simSide.energy : c.cost;
          const bestCost = bestOtherCard.cost === -1 ? simSide.energy : bestOtherCard.cost;
          if (cost > bestCost) {
            bestOtherCard = c;
          }
        }
        decision = { type: 'play', card: bestOtherCard };
      }

      if (!decision) {
        break;
      }

      // Execute simulated decision
      if (decision.type === 'play') {
        const card = decision.card;
        const cost = card.cost === -1 ? simSide.energy : card.cost;
        simSide.energy -= cost;

        let silhouette = 'skill';
        if (card.effects?.dmg) {
          silhouette = 'attack';
        } else if (card.effects?.block || card.effects?.fortify) {
          silhouette = 'block';
        } else if (card.effects?.applyStatus && (card.effects.applyStatus.weak || card.effects.applyStatus.vulnerable || card.effects.applyStatus.burn || card.effects.applyStatus.poison)) {
          silhouette = 'debuff';
        } else if (card.effects?.strength || card.effects?.selfStatus?.strength || card.effects?.selfStatus?.regen || card.effects?.draw || card.effects?.energy) {
          silhouette = 'buff';
        } else if (card.effects?.displacement) {
          silhouette = 'swap';
        }

        const hits = (card.effects?.hits ?? 1) * (card.cost === -1 ? Math.max(1, cost) : 1);
        const detail = {
          cardId: card.id,
          cardName: card.name,
          targetScope: card.effects?.scope,
          // Full effect payload so the UI can label the action's ASPECTS even
          // while hidden (e.g. "Hidden Special — includes Attack, Block") and
          // show exact numbers once Peeked. The UI gates numbers by `revealed`.
          effects: { ...card.effects },
        };
        if (card.effects?.dmg) {
          detail.value = card.effects.dmg;
          detail.hits = hits;
        } else if (card.effects?.block) {
          detail.value = card.effects.block;
        } else if (card.effects?.fortify) {
          detail.value = card.effects.fortify.block;
        }

        plan.push(
          createPlannedAction({
            silhouette,
            actor: simVanguard.id,
            detail
          })
        );

        const cIdx = simVanguard.hand.indexOf(card);
        simVanguard.hand.splice(cIdx, 1);

        if (card.effects) {
          applySimulatedSelfEffects(simSide, simVanguard, card.effects, this.rng);
        }

      } else if (decision.type === 'swap') {
        const chosenIdx = decision.index;
        const incoming = simSide.fighters[chosenIdx];
        const cost = simSide.manualSwapsThisTurn + 1;
        simSide.energy -= cost;
        simSide.manualSwapsThisTurn += 1;

        plan.push(
          createPlannedAction({
            silhouette: 'swap',
            actor: simVanguard.id,
            detail: {
              incomingFighterId: incoming.id,
              targetScope: 'selfOnlyTarget'
            }
          })
        );

        discardWholeHand(simVanguard);
        simSide.vanguardIndex = chosenIdx;
        
        drawFreshHand(incoming, simSide.handSize, this.rng);

        const allCards = [
          ...incoming.deck.drawPile,
          ...incoming.deck.discardPile,
          ...incoming.deck.exhaustPile,
          ...incoming.hand
        ];
        for (const card of allCards) {
          if (card.swapInBoon) {
            applySimulatedSelfEffects(simSide, incoming, card.swapInBoon, this.rng);
          }
        }
      }
    }

    s.enemyPlan = plan;
    this._emit('intents', { plan: s.enemyPlan });
  }

  /**
   * PLAYER DRAW phase
   * Decay player Vanguard/bench block to 0, decrement fortifySlot, and draw hand.
   */
  playerDrawPhase() {
    const s = this.state;
    s.phase = PHASES.DRAW;
    this._emit('phase', { phase: PHASES.DRAW });

    // 1. Decay creature block per-side at start of its side's turn
    for (const f of s.player.fighters) {
      f.block = 0;
    }

    // 2. Decrement player fortifySlot block duration separately
    if (s.player.fortifySlot.block > 0) {
      if (s.player.fortifySlot.duration != null) {
        s.player.fortifySlot.duration -= 1;
        if (s.player.fortifySlot.duration <= 0) {
          s.player.fortifySlot.block = 0;
          s.player.fortifySlot.duration = 0;
        }
      } else {
        // Fallback if no duration is recorded
        s.player.fortifySlot.block = 0;
      }
    }

    // 3. Symmetrical energy rules: max(3, benchedCount)
    const benchedCount = benchFighters(s.player).length;
    s.player.energyPerTurn = Math.max(3, benchedCount);
    s.player.energy = s.player.energyPerTurn;

    // 4. Draw cards
    const pVanguard = vanguard(s.player);
    if (pVanguard) {
      if (s.turn === 1) {
        drawFreshHand(pVanguard, s.player.handSize, this.rng);
      } else {
        const toDraw = Math.max(0, s.player.handSize - pVanguard.hand.length);
        drawCards(pVanguard, toDraw, this.rng);
      }
      this._emit('draw', { hand: pVanguard.hand.slice() });
    }

    s.phase = PHASES.PLAYER;
    this._emit('phase', { phase: PHASES.PLAYER });
  }

  // ── Public Player Actions ──────────────────────────────────────────────────

  /**
   * Play a card from the player Vanguard's hand.
   * @param {string} cardId
   * @param {{ targetId?: string }} [opts]
   * @returns {boolean} Whether the card was successfully played.
   */
  play(cardId, opts = {}) {
    const s = this.state;
    if (s.phase !== PHASES.PLAYER) return false;

    const pVanguard = vanguard(s.player);
    if (!pVanguard) return false;

    const card = pVanguard.hand.find((c) => c.id === cardId);
    if (!card) return false;
    if (card.keywords?.includes('unplayable') || card.cost === -2) return false;

    const cost = card.cost === -1 ? s.player.energy : card.cost;
    if (cost > s.player.energy) return false;
    s.player.energy -= cost;

    // Announce the play BEFORE its effects so the combat log reads naturally
    // ("Strike played." → "Foe takes 6 damage.").
    this._emit('play', { card, actorId: pVanguard.id, side: 'player', targetId: opts.targetId ?? null });

    // Apply card effects
    applyCardEffects(s, 'player', pVanguard, card.effects, {
      targetId: opts.targetId,
      costPaid: cost,
      xCost: card.cost === -1,
      rng: this.rng,
      emit: this._emit.bind(this)
    });

    // Move card from hand: Exhaust if exhaustible, else discard
    if (card.keywords?.includes('exhaust')) {
      exhaustCard(pVanguard, card);
    } else {
      discardCard(pVanguard, card);
    }

    this._resolveDeaths();

    if (s.enemyPlan.length === 0 && !this._checkEnd()) {
      this._generateEnemyPlan();
    }

    if (this._checkEnd()) return true;
    return true;
  }

  /**
   * Spend a charge to reveal a planned action in the enemy forecast.
   * @param {number} planIndex
   * @returns {boolean}
   */
  peek(planIndex) {
    const s = this.state;
    if (s.peekCharges <= 0) return false;
    const action = s.enemyPlan[planIndex];
    if (!action || action.revealed) return false;

    s.peekCharges -= 1;
    action.revealed = true;
    this._emit('peek', { planIndex, action });
    return true;
  }

  /**
   * Spend ONE charge to reveal the enemy's ENTIRE forecasted turn at once —
   * every planned action (including post-swap incoming Vanguard moves). A Peek
   * scouts a whole turn, not a single move (spec §2 macro-silhouette intel).
   * @returns {boolean} Whether a charge was spent (false if none left / nothing hidden).
   */
  peekAll() {
    const s = this.state;
    if (s.peekCharges <= 0) return false;
    const hidden = s.enemyPlan.filter((a) => !a.revealed);
    if (hidden.length === 0) return false;

    s.peekCharges -= 1;
    for (const action of s.enemyPlan) action.revealed = true;
    this._emit('peek', { all: true, plan: s.enemyPlan });
    return true;
  }

  /**
   * Swap the active Vanguard with a benched monster.
   * @param {number} benchIndex
   * @returns {boolean} Whether the swap was successful.
   */
  swap(benchIndex) {
    const s = this.state;
    if (s.phase !== PHASES.PLAYER) return false;

    const side = s.player;
    if (benchIndex < 0 || benchIndex >= side.fighters.length) return false;
    if (benchIndex === side.vanguardIndex) return false;

    const incoming = side.fighters[benchIndex];
    if (!incoming || incoming.hp <= 0) return false;

    const cost = side.manualSwapsThisTurn + 1;
    if (side.energy < cost) return false;

    side.energy -= cost;
    side.manualSwapsThisTurn += 1;

    const oldIndex = side.vanguardIndex;
    const outgoing = side.fighters[oldIndex];

    discardWholeHand(outgoing);
    side.vanguardIndex = benchIndex;
    drawFreshHand(incoming, side.handSize, this.rng);

    this._emit('swap', {
      side: 'player',
      fromIndex: oldIndex,
      toIndex: benchIndex,
      cost
    });

    this._triggerSwapInBoons('player', incoming);

    this._resolveDeaths();
    this._checkEnd();
    return true;
  }

  /**
   * Use a consumable item.
   * Stubbed for Layer 2. Returns false.
   */
  useConsumable(itemId, opts = {}) {
    return false;
  }

  /**
   * End player turn: discard hand, tick enemy DoTs, tick player Regen,
   * decrement player duration debuffs, resolve deaths, and run enemy turn.
   */
  endTurn() {
    const s = this.state;
    if (s.phase !== PHASES.PLAYER) return s;

    // PLAYER END
    s.phase = PHASES.DISCARD;
    this._emit('phase', { phase: PHASES.DISCARD });

    const pVanguard = vanguard(s.player);
    if (pVanguard) {
      const result = discardHandEndOfTurn(pVanguard);
      this._emit('discard', result);
    }

    // Tick enemy DoTs (at end of player's turn)
    this._tickStatuses('enemy', 'dots');
    // Tick player Regen (at end of carrier's own turn)
    this._tickStatuses('player', 'regen');
    // Decrement player duration debuffs (at end of player's turn)
    this._tickStatuses('player', 'duration');

    this._resolveDeaths();

    if (this._checkEnd()) return s;

    // Hand off to enemy turn
    this.enemyTurn();
    return s;
  }

  // ── Enemy Turn ─────────────────────────────────────────────────────────────

  /**
   * ENEMY phase
   * Decay enemy Vanguard/bench block to 0, execute planned actions,
   * tick player DoTs, tick enemy Regen, decrement enemy duration debuffs, and loop.
   */
  enemyTurn() {
    const s = this.state;
    s.phase = PHASES.ENEMY;
    this._emit('phase', { phase: PHASES.ENEMY });

    // 1. Decay enemy block at start of enemy's turn
    for (const f of s.enemy.fighters) {
      f.block = 0;
    }

    // Decrement enemy fortifySlot block duration separately
    if (s.enemy.fortifySlot.block > 0) {
      if (s.enemy.fortifySlot.duration != null) {
        s.enemy.fortifySlot.duration -= 1;
        if (s.enemy.fortifySlot.duration <= 0) {
          s.enemy.fortifySlot.block = 0;
          s.enemy.fortifySlot.duration = 0;
        }
      } else {
        s.enemy.fortifySlot.block = 0;
      }
    }

    // Symmetrically reset enemy energy at start of enemy's turn
    const benchedCount = benchFighters(s.enemy).length;
    s.enemy.energyPerTurn = Math.max(3, benchedCount);
    s.enemy.energy = s.enemy.energyPerTurn;

    // 2. Execute telegraphed telegraphed actions sequentially
    for (const action of s.enemyPlan) {
      this.executeEnemyAction(action);
      this._resolveDeaths();
      if (this._checkEnd()) return;
    }

    // ENEMY END
    // Tick player DoTs (at end of enemy's turn)
    this._tickStatuses('player', 'dots');
    // Tick enemy Regen (at end of carrier's own turn)
    this._tickStatuses('enemy', 'regen');
    // Decrement enemy duration debuffs (at end of enemy's turn)
    this._tickStatuses('enemy', 'duration');

    // Symmetrically, discard remaining hand of enemy Vanguard
    const eVanguard = vanguard(s.enemy);
    if (eVanguard) {
      const result = discardHandEndOfTurn(eVanguard);
      this._emit('discard', { side: 'enemy', ...result });
    }

    this._resolveDeaths();

    if (this._checkEnd()) return;

    // Start next round
    this.startRound();
  }

  /**
   * Resolve a single enemy planned action.
   * @param {PlannedAction} action
   */
  executeEnemyAction(action) {
    const s = this.state;
    const actor = s.enemy.fighters.find((f) => f.id === action.actor);
    if (!actor || actor.hp <= 0) return;

    if (action.silhouette === 'swap') {
      const targetIdx = s.enemy.fighters.findIndex((f) => f.id === action.detail.incomingFighterId);
      if (targetIdx !== -1 && targetIdx !== s.enemy.vanguardIndex) {
        const oldIndex = s.enemy.vanguardIndex;
        const outgoing = s.enemy.fighters[oldIndex];
        const incoming = s.enemy.fighters[targetIdx];
        if (incoming && incoming.hp > 0) {
          const cost = s.enemy.manualSwapsThisTurn + 1;
          s.enemy.energy = Math.max(0, s.enemy.energy - cost);
          s.enemy.manualSwapsThisTurn += 1;

          discardWholeHand(outgoing);
          s.enemy.vanguardIndex = targetIdx;
          drawFreshHand(incoming, s.enemy.handSize, this.rng);

          this._emit('swap', {
            side: 'enemy',
            fromIndex: oldIndex,
            toIndex: targetIdx,
            cost
          });

          this._triggerSwapInBoons('enemy', incoming);
        }
      }
    } else if (action.detail.cardId) {
      const card = actor.hand.find((c) => c.id === action.detail.cardId);
      if (card) {
        const cost = card.cost === -1 ? s.enemy.energy : card.cost;
        s.enemy.energy = Math.max(0, s.enemy.energy - cost);

        const pVanguard = vanguard(s.player);
        const targetId = pVanguard ? pVanguard.id : null;

        this._emit('play', { card, actorId: actor.id, side: 'enemy', targetId });

        applyCardEffects(s, 'enemy', actor, card.effects, {
          targetId,
          costPaid: cost,
          xCost: card.cost === -1,
          rng: this.rng,
          emit: this._emit.bind(this)
        });

        if (card.keywords?.includes('exhaust')) {
          exhaustCard(actor, card);
        } else {
          discardCard(actor, card);
        }
      }
    } else {
      if (action.silhouette === 'attack') {
        const target = vanguard(s.player);
        if (target) {
          const dmg = computeAttackDamage(action.detail.value ?? 6, actor.statuses, target.statuses);
          applyDamage(target, dmg, this._emit.bind(this), false, s.player);
        }
      } else if (action.silhouette === 'block') {
        gainBlock(actor, action.detail.value ?? 5, this._emit.bind(this));
      } else if (action.silhouette === 'buff') {
        addStatus(actor.statuses, { id: 'strength', amount: action.detail.value ?? 2, stacking: 'intensity' });
        this._emit('status', { targetId: actor.id, id: 'strength', amount: action.detail.value ?? 2 });
      } else if (action.silhouette === 'debuff') {
        const target = vanguard(s.player);
        if (target) {
          addStatus(target.statuses, { id: 'weak', amount: action.detail.value ?? 2, stacking: 'duration' });
          this._emit('status', { targetId: target.id, id: 'weak', amount: action.detail.value ?? 2 });
        }
      }
    }

    this._emit('intentResolved', { actorId: actor.id, action });
  }


  // ── Status & Death Helpers ─────────────────────────────────────────────────

  /**
   * Tick statuses for all living fighters on a side.
   * @param {'player'|'enemy'} sideKey
   * @param {'dots'|'regen'|'duration'} type
   */
  _tickStatuses(sideKey, type) {
    const side = this.state[sideKey];
    const emit = this._emit.bind(this);
    
    for (const f of side.fighters) {
      if (f.hp <= 0) continue;

      if (type === 'dots') {
        // Burn & Poison tick
        for (const id of ['burn', 'poison']) {
          const st = f.statuses.find((x) => x.id === id);
          if (st && st.amount > 0) {
            const amount = st.amount;
            // DoTs bypass Block
            applyDamage(f, amount, emit, true);
            st.amount -= 1;
          }
        }
      } else if (type === 'regen') {
        const st = f.statuses.find((x) => x.id === 'regen');
        if (st && st.amount > 0) {
          applyHeal(f, st.amount, emit);
          st.amount -= 1;
        }
      } else if (type === 'duration') {
        // Weak & Vulnerable count down
        for (const st of f.statuses) {
          if (st.stacking === 'duration' && st.id !== 'regen') {
            st.amount -= 1;
          }
        }
      }
      
      pruneStatuses(f.statuses);
    }
  }

  /**
   * Resolve dead vanguards by switching to the next living benched unit.
   */
  _resolveDeaths() {
    const s = this.state;
    const emit = this._emit.bind(this);

    // Player deaths
    const pSide = s.player;
    const pVanguard = pSide.fighters[pSide.vanguardIndex];
    if (pVanguard && pVanguard.hp <= 0) {
      emit('death', { fighterId: pVanguard.id });
      discardWholeHand(pVanguard);
      const nextIdx = pSide.fighters.findIndex((f) => f.hp > 0);
      if (nextIdx !== -1) {
        const oldIndex = pSide.vanguardIndex;
        pSide.vanguardIndex = nextIdx;
        const incoming = pSide.fighters[nextIdx];
        drawFreshHand(incoming, pSide.handSize, this.rng);
        this._emit('swap', { side: 'player', fromIndex: oldIndex, toIndex: nextIdx, cost: 0, forced: true });
        this._triggerSwapInBoons('player', incoming);
      }
    }

    // Enemy deaths
    const eSide = s.enemy;
    const eVanguard = eSide.fighters[eSide.vanguardIndex];
    if (eVanguard && eVanguard.hp <= 0) {
      emit('death', { fighterId: eVanguard.id });
      discardWholeHand(eVanguard);
      // Remove any queued actions for this dead Vanguard
      s.enemyPlan = s.enemyPlan.filter((a) => a.actor !== eVanguard.id);
      const nextIdx = eSide.fighters.findIndex((f) => f.hp > 0);
      if (nextIdx !== -1) {
        const oldIndex = eSide.vanguardIndex;
        eSide.vanguardIndex = nextIdx;
        const incoming = eSide.fighters[nextIdx];
        drawFreshHand(incoming, eSide.handSize, this.rng);
        this._emit('swap', { side: 'enemy', fromIndex: oldIndex, toIndex: nextIdx, cost: 0, forced: true });
        this._triggerSwapInBoons('enemy', incoming);
      }
    }
  }

  _triggerSwapInBoons(sideKey, fighter) {
    const s = this.state;
    const allCards = [
      ...fighter.deck.drawPile,
      ...fighter.deck.discardPile,
      ...fighter.deck.exhaustPile,
      ...fighter.hand
    ];
    for (const card of allCards) {
      if (card.swapInBoon) {
        applyCardEffects(s, sideKey, fighter, card.swapInBoon, {
          rng: this.rng,
          emit: this._emit.bind(this)
        });
      }
    }
  }

  /**
   * Check if combat has ended due to all fighters on either side being wiped out.
   * @returns {boolean} True if combat ended.
   */
  _checkEnd() {
    const s = this.state;
    const playerAlive = s.player.fighters.some((f) => f.hp > 0);
    const enemyAlive = s.enemy.fighters.some((f) => f.hp > 0);

    if (!playerAlive) {
      s.phase = PHASES.DEFEAT;
      this._emit('phase', { phase: PHASES.DEFEAT });
      return true;
    }
    if (!enemyAlive) {
      s.phase = PHASES.VICTORY;
      this._emit('phase', { phase: PHASES.VICTORY });
      return true;
    }
    return false;
  }

  // ── Rewards (adaptive Pity-Offset engine) ───────────────────────────────────

  /**
   * Generate a post-victory card-reward offering, advancing the pity offset.
   * The card TYPE distribution follows the COMBINED typings of the SURVIVING
   * player fighters (spec §2A); rarity follows the room + pity offset. Boss rooms
   * force Rare. Requires a `pickCard` resolver supplied to the constructor.
   * @param {number} [count]
   * @returns {Card[]}
   */
  generateReward(count = 3) {
    if (!this.pickCard) throw new Error('generateReward needs a pickCard resolver');
    const survivors = this.state.player.fighters.filter((f) => f.hp > 0);
    const typeWeights = combinedTypeWeights(survivors.map((f) => f.types));
    return draftCards({
      state: this.state.rarity,
      room: this.state.room,
      count,
      typeWeights,
      pickCard: this.pickCard,
      rng: this.rng,
    });
  }
}

const ELEMENT_MATRIX = {
  pyre:    { strong: ["flora", "metal", "crystal"], weak: ["hydro", "stone"] },
  frost:   { strong: ["flora", "beast", "aero"],    weak: ["pyre", "metal"] },
  hydro:   { strong: ["pyre", "stone", "void"],     weak: ["charge", "toxin"] },
  charge:  { strong: ["hydro", "aero"],             weak: ["stone", "metal"] },
  aero:    { strong: ["toxin", "beast"],            weak: ["charge", "frost"] },
  stone:   { strong: ["pyre", "charge"],            weak: ["hydro", "flora"] },
  metal:   { strong: ["crystal", "frost"],          weak: ["pyre", "void"] },
  crystal: { strong: ["charge", "umbra"],           weak: ["pyre", "metal"] },
  toxin:   { strong: ["flora", "hydro"],            weak: ["aero", "aether"] },
  flora:   { strong: ["hydro", "stone"],            weak: ["pyre", "frost", "toxin"] },
  beast:   { strong: ["toxin", "lumen"],            weak: ["frost", "aero"] },
  lumen:   { strong: ["umbra", "void", "blood"],    weak: ["aether"] },
  aether:  { strong: ["toxin", "lumen"],            weak: ["umbra"] },
  umbra:   { strong: ["lumen", "beast"],            weak: ["crystal", "aether"] },
  void:    { strong: ["metal", "aether"],           weak: ["hydro", "lumen"] },
  blood:   { strong: ["beast", "flora"],            weak: ["lumen"] },
};

function getElementMultiplier(atk, def) {
  if (!atk || !def) return 1.0;
  const entry = ELEMENT_MATRIX[atk];
  if (!entry) return 1.0;
  if (entry.strong.includes(def)) return 1.5;
  if (entry.weak.includes(def)) return 0.66;
  return 1.0;
}

function getMatchupMultiplier(atkFighter, defFighter) {
  const atkEls = atkFighter.types.map((t) => t.type).filter(Boolean);
  const defEls = defFighter.types.map((t) => t.type).filter(Boolean);
  if (atkEls.length === 0 || defEls.length === 0) return 1.0;

  let maxMult = 0;
  for (const atkEl of atkEls) {
    let mult = 1.0;
    for (const defEl of defEls) {
      mult *= getElementMultiplier(atkEl, defEl);
    }
    if (defEls.includes(atkEl)) {
      mult *= 0.75; // SELF_RESIST
    }
    if (mult > maxMult) {
      maxMult = mult;
    }
  }
  return maxMult;
}

function getExpectedHPLoss(card, attacker, target, targetSide, energyPaid) {
  if (!card.effects?.dmg) return 0;
  const hits = (card.effects.hits ?? 1) * (card.cost === -1 ? Math.max(1, energyPaid) : 1);
  const dmgPerHit = computeAttackDamage(card.effects.dmg, attacker.statuses, target.statuses);
  const totalDmgBeforeBlock = hits * dmgPerHit;

  let tempBlock = target.block;
  let tempFortify = targetSide.fortifySlot.block;
  let hpLoss = totalDmgBeforeBlock;

  const absorbedCreature = Math.min(tempBlock, hpLoss);
  hpLoss -= absorbedCreature;
  
  const absorbedFortify = Math.min(tempFortify, hpLoss);
  hpLoss -= absorbedFortify;

  return hpLoss;
}

function applySimulatedSelfEffects(side, fighter, effects, rng) {
  if (effects.energy) side.energy += effects.energy;
  if (effects.draw) drawCards(fighter, effects.draw, rng);
  if (effects.strength) {
    addStatus(fighter.statuses, { id: 'strength', amount: effects.strength, stacking: 'intensity' });
  }
  if (effects.selfStatus) {
    for (const [id, amt] of Object.entries(effects.selfStatus)) {
      addStatus(fighter.statuses, { id, amount: amt, stacking: stackingFor(id) });
    }
  }
  if (effects.fortify) {
    side.fortifySlot.block += (effects.fortify.block ?? 0);
    side.fortifySlot.duration = Math.max(side.fortifySlot.duration ?? 0, effects.fortify.duration);
  }
}

