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
import { applyCardSpec } from './interpret.js';
import { fireTriggers, tickTriggerDurations } from '../cards/effectRegistry.js';
import { canAttack, stanceSide } from './stances.js';
import { describeScope } from './scopes.js';
import { previewReactions, REACTIONS, primaryElement } from '../cards/reactions.js';

/** Does this scope token deliver an effect to the OPPOSING (player) side? */
function scopeHitsEnemy(scope) {
  if (!scope) return false;
  try {
    const d = describeScope(scope);
    return d.side === 'enemy' || d.side === 'either' || d.side === 'both';
  } catch { return false; }
}

/** The card's reacting element (its damage attunement), if it has a reaction table. */
function reactionElement(card) {
  const el = primaryElement(card?.attunement);
  return el && REACTIONS[el] ? el : null;
}

/**
 * Enemy-AI competence tiers (the AI-behavior master plan, mechanics.md §6). Each tier
 * gates which planning rules the foe uses + how often it fumbles the optimal line, so
 * difficulty scales with the encounter: trash mobs are forgiving, bosses play sharp.
 *   reactions — seek/set up reactions (Rules 1 reaction-count, 3.5 setup, 4 bonus)
 *   typeSwap  — swap to a type-advantaged bencher (Rule 2)
 *   defend    — block/fortify when the vanguard is low (Rule 3)
 *   misplay   — per-action chance to play a RANDOM legal card instead of the best line
 */
const AI_SKILL = {
  basic: { reactions: false, typeSwap: false, defend: false, misplay: 0.30 },
  normal: { reactions: true, typeSwap: false, defend: true, misplay: 0.12 },
  sharp: { reactions: true, typeSwap: true, defend: true, misplay: 0.04 },
  expert: { reactions: true, typeSwap: true, defend: true, misplay: 0.0 },
};
/** Default competence by room tier when no explicit `aiSkill` is set on the state. */
const roomSkill = (room) => (room === 'boss' ? 'expert' : room === 'elite' ? 'sharp' : 'normal');

/** A data-driven CardSpec uses an op-LIST in `effects` (legacy cards use a flat object). */
const isCardSpec = (card) => Array.isArray(card.effects) || card.type === 'power';

/**
 * Normalize a card's effects into the FLAT summary the AI planner reasons over
 * (dmg/hits/block/applyStatus/selfStatus/strength/draw/energy/scope), regardless
 * of whether the card is a legacy flat-effects card or a data-driven CardSpec
 * op-list. Without this the planner sees no dmg/block on roster (CardSpec) enemies
 * and forecasts an empty turn.
 */
function effSummary(card) {
  const e = card?.effects;
  if (!Array.isArray(e)) return e || {};
  const out = {};
  for (const op of e) {
    switch (op.op) {
      case 'damage': {
        out.dmg = (out.dmg || 0) + (Number(op.value) || 0);
        const h = op.hits === 'X' ? 'X' : Number(op.hits);
        if (h) out.hits = h;
        if (op.scope && !out.scope) out.scope = op.scope;
        break;
      }
      case 'block': out.block = (out.block || 0) + (Number(op.value) || 0); break;
      case 'debuff': {
        out.applyStatus = out.applyStatus || {};
        const st = op.status || 'weak';
        out.applyStatus[st] = (out.applyStatus[st] || 0) + (Number(op.value) || 0);
        if (op.scope && !out.scope) out.scope = op.scope;
        break;
      }
      case 'buff':
        if (op.status === 'strength') out.strength = (out.strength || 0) + (Number(op.value) || 0);
        else { out.selfStatus = out.selfStatus || {}; out.selfStatus[op.status] = (out.selfStatus[op.status] || 0) + (Number(op.value) || 0); }
        break;
      case 'draw': out.draw = (out.draw || 0) + (Number(op.value) || 0); break;
      case 'energy': out.energy = (out.energy || 0) + (Number(op.value) || 0); break;
      default: break;
    }
  }
  return out;
}

/** Total living HP on a side (for damage-dealt/taken trigger detection). */
const sideHp = (side) => side.fighters.reduce((n, f) => n + Math.max(0, f.hp), 0);

/** Buff statuses Decay can sap (Void §5.1). */
const DECAY_BUFFS = ['strength', 'dexterity', 'regen', 'amplify'];

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

  /** Fire registered triggered effects on a side for an event (turnStart, onCardPlayed, …). */
  _fire(sideKey, event) {
    fireTriggers(this.state, sideKey, event, { emit: this._emit.bind(this), rng: this.rng });
  }

  /** Bump an event-history counter (turn + combat) for conditional/scaling effects. */
  _count(sideKey, key, n = 1) {
    if (n <= 0) return;
    const c = this.state[sideKey].counters;
    if (!c) return;
    c.turn[key] = (c.turn[key] ?? 0) + n;
    c.combat[key] = (c.combat[key] ?? 0) + n;
  }

  /** Count a card play, broken down by card type. */
  _countPlayed(sideKey, cardType) {
    this._count(sideKey, 'cardsPlayed');
    const c = this.state[sideKey].counters;
    for (const win of ['turn', 'combat']) {
      c[win].playedByType = c[win].playedByType ?? {};
      c[win].playedByType[cardType] = (c[win].playedByType[cardType] ?? 0) + 1;
    }
  }

  /** Reset the per-turn counters for a side at the start of its turn. */
  _resetTurnCounters(sideKey) {
    if (this.state[sideKey].counters) this.state[sideKey].counters.turn = {};
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
    // Fresh turn → the forecast re-fogs until the player spends a Peek again.
    s.peekedThisTurn = false;

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

    // The plan always represents the enemy's UPCOMING turn, so simulate from a
    // fresh next-turn resource baseline whenever we (re)plan — including the
    // mid-player-turn re-plans triggered after each player action.
    {
      const benchedCount = simSide.fighters.filter((f, idx) => f.hp > 0 && idx !== simSide.vanguardIndex).length;
      simSide.energy = Math.max(3, benchedCount);
      simSide.manualSwapsThisTurn = 0;
    }

    const plan = [];
    // Primers (statusId→amount) this planned turn will have already applied to the
    // player vanguard, so reaction-seeking can value a setup→detonate chain that
    // lands in sequence at execution time (the sim doesn't model debuffs onto the foe).
    const plannedPrimers = {};

    // Difficulty tier: explicit state.aiSkill, else derived from the room.
    const skill = AI_SKILL[s.aiSkill] || AI_SKILL[roomSkill(s.room)];

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

      // Rule 0: Misplay — a less-skilled foe sometimes just plays a random legal card
      // instead of the optimal line (models difficulty without changing raw numbers).
      if (skill.misplay > 0 && playableCards.length > 0 && this.rng() < skill.misplay) {
        decision = { type: 'play', card: playableCards[Math.floor(this.rng() * playableCards.length)] };
      }

      // Rule 1: Lethal burst check
      let totalComboDmg = 0;
      let highestDmgAttack = null;
      let highestDmgVal = -1;

      for (const c of (decision ? [] : playableCards)) {
        if (effSummary(c).dmg) {
          // Count any reaction BURST the card's element would detonate on the
          // player vanguard (incl. primers this plan already queued) toward lethal.
          const react = skill.reactions && reactionElement(c) ? previewReactions(playerVanguard, c.attunement, plannedPrimers).damage : 0;
          const dmg = getExpectedHPLoss(c, simVanguard, playerVanguard, s.player, simSide.energy) + react;
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
      if (!decision && skill.typeSwap && canSwap && benched.length > 0) {
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
      if (!decision && skill.defend) {
        const hpPct = simVanguard.hp / simVanguard.maxHp;
        if (hpPct < 0.40) {
          let bestDefensiveCard = null;
          let maxDefensiveVal = -1;
          for (const c of playableCards) {
            const ce = effSummary(c);
            const blockVal = ce.block ?? 0;
            const fortifyVal = ce.fortify?.block ?? 0;
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

      // Rule 3.5: Set up a reaction primer — if a pure debuff applies a status the
      // hand can DETONATE/AMPLIFY with a follow-up attack, prime it first so the
      // chain lands this turn (the attack scores its reaction once the primer is queued).
      if (!decision && skill.reactions) {
        let bestPrimer = null;
        let bestPrimerVal = 0;
        for (const c of playableCards) {
          const ce = effSummary(c);
          if (ce.dmg || !ce.applyStatus || !scopeHitsEnemy(ce.scope)) continue;
          for (const [stId, amt] of Object.entries(ce.applyStatus)) {
            if (!(amt > 0)) continue;
            for (const other of playableCards) {
              if (other === c) continue;
              const el = reactionElement(other);
              if (!el || !effSummary(other).dmg || !REACTIONS[el][stId]) continue;
              // Marginal worth of priming this status before the follow-up reacts.
              const withP = previewReactions(playerVanguard, el, { ...plannedPrimers, [stId]: amt }).score;
              const without = previewReactions(playerVanguard, el, plannedPrimers).score;
              const gain = withP - without;
              if (gain > bestPrimerVal) { bestPrimerVal = gain; bestPrimer = c; }
            }
          }
        }
        if (bestPrimer && bestPrimerVal >= 3) {
          decision = { type: 'play', card: bestPrimer };
        }
      }

      // Rule 4: Highest value attack check (reaction value biases the pick).
      if (!decision) {
        let bestAttackCard = null;
        let maxAttackDmg = -1;
        for (const c of playableCards) {
          if (effSummary(c).dmg) {
            const react = skill.reactions && reactionElement(c) ? previewReactions(playerVanguard, c.attunement, plannedPrimers).score : 0;
            const dmg = getExpectedHPLoss(c, simVanguard, playerVanguard, s.player, simSide.energy) + react;
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

        const eff = effSummary(card);
        let silhouette = 'skill';
        if (eff.dmg) {
          silhouette = 'attack';
        } else if (eff.block || eff.fortify) {
          silhouette = 'block';
        } else if (eff.applyStatus && Object.keys(eff.applyStatus).length) {
          silhouette = 'debuff';
        } else if (eff.strength || eff.selfStatus?.strength || eff.selfStatus?.regen || eff.draw || eff.energy) {
          silhouette = 'buff';
        } else if (eff.displacement) {
          silhouette = 'swap';
        }

        const hits = (eff.hits === 'X' ? Math.max(1, cost) : (eff.hits ?? 1)) * (card.cost === -1 ? Math.max(1, cost) : 1);
        const detail = {
          cardId: card.id,
          cardName: card.name,
          targetScope: eff.scope,
          // Flat effect summary so the UI can label the action's ASPECTS even
          // while hidden (e.g. "Hidden Special — includes Attack, Block") and
          // show exact numbers once Peeked. The UI gates numbers by `revealed`.
          effects: { ...eff },
        };
        if (eff.dmg) {
          detail.value = eff.dmg;
          detail.hits = hits;
        } else if (eff.block) {
          detail.value = eff.block;
        } else if (eff.fortify) {
          detail.value = eff.fortify.block;
        }

        plan.push(
          createPlannedAction({
            silhouette,
            actor: simVanguard.id,
            detail
          })
        );

        // Queue any enemy-targeted status this card lands, so later attacks in
        // the SAME plan value the reaction it sets up (chain at execution time).
        if (eff.applyStatus && scopeHitsEnemy(eff.scope)) {
          for (const [stId, amt] of Object.entries(eff.applyStatus)) {
            if (amt > 0) plannedPrimers[stId] = (plannedPrimers[stId] || 0) + amt;
          }
        }

        const cIdx = simVanguard.hand.indexOf(card);
        simVanguard.hand.splice(cIdx, 1);

        if (card.effects) {
          applySimulatedSelfEffects(simSide, simVanguard, effSummary(card), this.rng);
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

    // Peek is turn-wide intel (spec §2): once the player spends a Peek this turn,
    // every (re)generated plan stays fully revealed so adapting forecasts remain
    // visible without re-paying.
    if (s.peekedThisTurn) for (const a of plan) a.revealed = true;
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

    // 4. Draw cards (reset the per-turn counters at the start of the player's turn).
    this._resetTurnCounters('player');
    const pVanguard = vanguard(s.player);
    if (pVanguard) {
      const handBefore = pVanguard.hand.length;
      if (s.turn === 1) {
        drawFreshHand(pVanguard, s.player.handSize, this.rng);
      } else {
        const toDraw = Math.max(0, s.player.handSize - pVanguard.hand.length);
        drawCards(pVanguard, toDraw, this.rng);
      }
      this._count('player', 'cardsDrawn', pVanguard.hand.length - handBefore);
      this._emit('draw', { hand: pVanguard.hand.slice() });
    }

    // Fire player powers that hook the start of the turn (e.g. Bloodlust → +Strength).
    this._fire('player', 'turnStart');
    this._fire('player', 'onDraw');

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

    // Stance / play-gate pre-check for data-driven cards, so an illegal play
    // (e.g. an Attack while in a defense stance) is rejected without cost.
    if (isCardSpec(card)) {
      const stance = pVanguard.stance ?? 'Balanced';
      if (card.type === 'attack' && !canAttack(stance)) return false;
      if (card.requires?.stance && stance !== card.requires.stance) return false;
      if (card.requires?.stanceSide && stanceSide(stance) !== card.requires.stanceSide) return false;
    }

    const cost = card.cost === -1 ? s.player.energy : card.cost + this._shockTax('player');
    if (cost > s.player.energy) return false;
    s.player.energy -= cost;

    // Capture deltas for damage/block trigger detection.
    const enemyHpBefore = sideHp(s.enemy);
    const playerHpBefore = sideHp(s.player);
    const blockBefore = pVanguard.block + (pVanguard.bracedBlock ?? 0);

    // Announce the play BEFORE its effects so the combat log reads naturally
    // ("Strike played." → "Foe takes 6 damage.").
    this._emit('play', { card, actorId: pVanguard.id, side: 'player', targetId: opts.targetId ?? null });

    // Apply card effects — data-driven CardSpec via the interpreter, else legacy.
    if (isCardSpec(card)) {
      const res = applyCardSpec(s, 'player', pVanguard, card, {
        targetId: opts.targetId, costPaid: cost, rng: this.rng, emit: this._emit.bind(this),
      });
      if (!res.ok) { s.player.energy += cost; return false; } // shouldn't hit (pre-checked)
    } else {
      applyCardEffects(s, 'player', pVanguard, card.effects, {
        targetId: opts.targetId,
        costPaid: cost,
        xCost: card.cost === -1,
        rng: this.rng,
        emit: this._emit.bind(this)
      });
    }

    // Replay: re-run the card's effects N extra times for free (StS2 Replay).
    const replays = card.type === 'power' ? 0 : Math.max(0, card.replayCount ?? 0);
    for (let r = 0; r < replays; r++) {
      this._emit('replay', { card, actorId: pVanguard.id, n: r + 1 });
      if (isCardSpec(card)) {
        applyCardSpec(s, 'player', pVanguard, card, { targetId: opts.targetId, costPaid: 0, rng: this.rng, emit: this._emit.bind(this) });
      } else {
        applyCardEffects(s, 'player', pVanguard, card.effects, { targetId: opts.targetId, costPaid: 0, xCost: false, rng: this.rng, emit: this._emit.bind(this) });
      }
    }

    // Update event-history counters (before firing, so conditions see this play).
    const blockDelta = (pVanguard.block + (pVanguard.bracedBlock ?? 0)) - blockBefore;
    const dealt = enemyHpBefore - sideHp(s.enemy);
    const taken = playerHpBefore - sideHp(s.player);
    this._count('player', 'energySpent', cost);
    this._countPlayed('player', card.type);
    this._count('player', 'blockGained', blockDelta);
    this._count('player', 'damageDealt', dealt);
    this._count('player', 'damageTaken', taken);

    // Fire play-related triggered effects (player side), then resolve deaths.
    this._fire('player', 'onEnergySpent');
    this._fire('player', 'onCardPlayed');
    if (blockDelta > 0) this._fire('player', 'onGainBlock');
    if (dealt > 0) this._fire('player', 'onDamageDealt');
    if (taken > 0) this._fire('player', 'onDamageTaken');

    // Move card from hand: powers + Exhaust cards leave the deck, else discard.
    if (card.type === 'power' || card.keywords?.includes('exhaust')) {
      exhaustCard(pVanguard, card);
      this._count('player', 'cardsExhausted', 1);
      this._fire('player', 'onExhaust');
    } else {
      discardCard(pVanguard, card);
    }

    this._resolveDeaths();

    // Re-plan the enemy's upcoming turn after every player action so the forecast
    // adapts (a battered vanguard may switch to defending/swapping; a freshly
    // swapped-in replacement gets a real plan instead of doing nothing).
    if (!this._checkEnd()) {
      this._generateEnemyPlan();
    }
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
    s.peekedThisTurn = true;
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
    if (this._exposeLocked(incoming)) return false; // can't swap in while Expose > HP

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
    // A player swap is an action too — let the enemy forecast react to it.
    if (!this._checkEnd()) {
      this._generateEnemyPlan();
    }
    return true;
  }

  /**
   * Use a consumable (potion): run its effect op-list on the player Vanguard via
   * the card interpreter. Potions are type 'skill' (no stance gate on the card),
   * usable on the player's turn. Returns whether it resolved.
   * @param {{ id?:string, name?:string, attunement?:string, effects:object[] }} potion
   * @param {{ targetId?: string }} [opts]
   */
  useConsumable(potion, opts = {}) {
    const s = this.state;
    if (s.phase !== PHASES.PLAYER || !potion?.effects) return false;
    const v = vanguard(s.player);
    if (!v) return false;
    this._emit('play', { card: { name: potion.name ?? 'Potion', ...potion }, actorId: v.id, side: 'player', potion: true });
    applyCardSpec(s, 'player', v, {
      id: potion.id ?? 'potion', name: potion.name ?? 'Potion', type: 'skill', cost: 0,
      attunement: potion.attunement ?? 'Physical', effects: potion.effects,
    }, { targetId: opts.targetId, rng: this.rng, emit: this._emit.bind(this) });
    this._resolveDeaths();
    if (!this._checkEnd()) this._generateEnemyPlan();
    return true;
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

    // Fire player powers that hook the end of the turn.
    this._fire('player', 'turnEnd');

    const pVanguard = vanguard(s.player);
    if (pVanguard) {
      const result = discardHandEndOfTurn(pVanguard);
      this._emit('discard', result);
      this._count('player', 'cardsDiscarded', result.discarded.length);
      this._fire('player', 'onDiscard');
    }
    // Expire turn-bound triggered effects on the player side.
    for (const f of s.player.fighters) tickTriggerDurations(f);

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

    // Fire enemy powers that hook the start of the turn.
    this._resetTurnCounters('enemy');
    this._fire('enemy', 'turnStart');

    // 2. Execute telegraphed telegraphed actions sequentially
    for (const action of s.enemyPlan) {
      this.executeEnemyAction(action);
      this._resolveDeaths();
      if (this._checkEnd()) return;
    }

    // ENEMY END
    // Fire enemy powers that hook the end of the turn.
    this._fire('enemy', 'turnEnd');
    for (const f of s.enemy.fighters) tickTriggerDurations(f);

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

    // Track player HP across the action so the player's onDamageTaken triggers
    // (Ranger Traps: Bear/Explosive Trap, Trapper, Deflector) fire when the ENEMY
    // hits them — previously these only fired on self-inflicted damage, so Traps
    // never went off.
    const pHpBefore = sideHp(s.player);
    const fireTrapsIfHit = () => { if (sideHp(s.player) < pHpBefore) this._fire('player', 'onDamageTaken'); };

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
        const cost = card.cost === -1 ? s.enemy.energy : card.cost + this._shockTax('enemy');
        s.enemy.energy = Math.max(0, s.enemy.energy - cost);

        const pVanguard = vanguard(s.player);
        const targetId = pVanguard ? pVanguard.id : null;

        this._emit('play', { card, actorId: actor.id, side: 'enemy', targetId });

        if (isCardSpec(card)) {
          applyCardSpec(s, 'enemy', actor, card, {
            targetId,
            costPaid: cost,
            rng: this.rng,
            emit: this._emit.bind(this),
          });
        } else {
          applyCardEffects(s, 'enemy', actor, card.effects, {
            targetId,
            costPaid: cost,
            xCost: card.cost === -1,
            rng: this.rng,
            emit: this._emit.bind(this)
          });
        }

        if (card.keywords?.includes('exhaust')) {
          exhaustCard(actor, card);
        } else {
          discardCard(actor, card);
        }
        this._countPlayed('enemy', card.type ?? 'skill');
        this._fire('enemy', 'onCardPlayed');
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

    fireTrapsIfHit();
    this._emit('intentResolved', { actorId: actor.id, action });
  }


  // ── Status & Death Helpers ─────────────────────────────────────────────────

  /**
   * Tick statuses for all living fighters on a side.
   * @param {'player'|'enemy'} sideKey
   * @param {'dots'|'regen'|'duration'} type
   */
  /**
   * Shock v2: card-cost tax = number of living creatures on the side carrying Shock,
   * CAPPED at 2 so Shock can never fully lock a side out of acting (with the base
   * energy floor of 3 the cheapest 1-cost card always stays affordable).
   */
  _shockTax(sideKey) {
    const shocked = this.state[sideKey].fighters.filter(
      (f) => f.hp > 0 && f.statuses.some((s) => s.id === 'shock' && s.amount > 0),
    ).length;
    return Math.min(2, shocked);
  }

  /** Expose v2: a creature is locked out of the Vanguard while its Expose > its HP. */
  _exposeLocked(f) {
    return (f.statuses.find((s) => s.id === 'expose')?.amount ?? 0) > f.hp;
  }

  /** Best incoming Vanguard: first living, non-Expose-locked unit; else the first
   *  living unit (the last-creature / all-locked fallback). */
  _firstIncoming(side) {
    const free = side.fighters.findIndex((f) => f.hp > 0 && !this._exposeLocked(f));
    return free !== -1 ? free : side.fighters.findIndex((f) => f.hp > 0);
  }

  /** Expose v2: force-swap out any Vanguard whose Expose exceeds its HP, when a
   *  living non-locked benched unit exists (else it stays — last/all-locked). */
  _checkExposeLockout() {
    for (const sideKey of ['player', 'enemy']) {
      const side = this.state[sideKey];
      const vg = side.fighters[side.vanguardIndex];
      if (!vg || vg.hp <= 0 || !this._exposeLocked(vg)) continue;
      const idx = side.fighters.findIndex((f, i) => i !== side.vanguardIndex && f.hp > 0 && !this._exposeLocked(f));
      if (idx === -1) continue;
      const oldIndex = side.vanguardIndex;
      discardWholeHand(vg);
      side.vanguardIndex = idx;
      const incoming = side.fighters[idx];
      drawFreshHand(incoming, side.handSize, this.rng);
      this._emit('swap', { side: sideKey, fromIndex: oldIndex, toIndex: idx, cost: 0, forced: true, reason: 'expose' });
      this._triggerSwapInBoons(sideKey, incoming);
      if (sideKey === 'enemy') this.state.enemyPlan = this.state.enemyPlan.filter((a) => a.actor !== vg.id);
    }
  }

  _tickStatuses(sideKey, type) {
    const side = this.state[sideKey];
    const emit = this._emit.bind(this);
    // Shock spread factor: how many creatures on this side carry Shock (Shock v2).
    const shockN = side.fighters.filter((f) => f.hp > 0 && f.statuses.some((x) => x.id === 'shock' && x.amount > 0)).length;

    for (const f of side.fighters) {
      if (f.hp <= 0) continue;

      if (type === 'dots') {
        // Burn & Poison tick (DoTs bypass Block); each decays by 1.
        for (const id of ['burn', 'poison']) {
          const st = f.statuses.find((x) => x.id === id);
          if (st && st.amount > 0) {
            applyDamage(f, st.amount, emit, true);
            st.amount -= 1;
          }
        }
        // Bleed (Physical): damage = stacks × times hit this window. Hit 0 times →
        // Bleed falls off entirely; otherwise it also decays by 1.
        const bl = f.statuses.find((x) => x.id === 'bleed');
        if (bl && bl.amount > 0) {
          const hits = f.hitsTaken || 0;
          if (hits > 0) { applyDamage(f, bl.amount * hits, emit, true); bl.amount -= 1; }
          else bl.amount = 0;
        }
        // Decay (Void): saps ONE random buff on the target by however much Decay it
        // has — removes min(decay, buffStacks); if Decay ≥ the buff it is wiped, and
        // any excess Decay is wasted this turn. Announced in the log + as a floater.
        // Decay itself ticks down 1/turn.
        const dec = f.statuses.find((x) => x.id === 'decay');
        if (dec && dec.amount > 0) {
          const present = f.statuses.filter((x) => DECAY_BUFFS.includes(x.id) && x.amount > 0);
          if (present.length) {
            const buff = present[Math.floor(this.rng() * present.length)];
            const removed = Math.min(dec.amount, buff.amount);
            buff.amount -= removed;
            emit('status', { targetId: f.id, id: buff.id, amount: buff.amount });
            emit('decay', { targetId: f.id, buff: buff.id, removed, wiped: buff.amount <= 0, decay: dec.amount });
          } else {
            emit('decay', { targetId: f.id, buff: null, removed: 0, wiped: false, decay: dec.amount });
          }
          dec.amount -= 1;
        }
        // Shock (Energy): DoT = stacks; stack changes by (N-1) per tick → persists at
        // N=1, GROWS when 2+ creatures on this side are Shocked. Capped at 9.
        const sh = f.statuses.find((x) => x.id === 'shock');
        if (sh && sh.amount > 0) {
          applyDamage(f, sh.amount, emit, true);
          sh.amount = Math.max(0, Math.min(9, sh.amount + (shockN - 1)));
        }
        // Reset the per-window hit counter once Bleed has consumed it.
        f.hitsTaken = 0;
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
      this._fire('player', 'onDeath');   // dying side's own death hooks
      this._fire('enemy', 'fatal');      // killer side's fatal hooks
      discardWholeHand(pVanguard);
      const nextIdx = this._firstIncoming(pSide);
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
      this._fire('enemy', 'onDeath');
      this._fire('player', 'fatal');
      discardWholeHand(eVanguard);
      // Remove any queued actions for this dead Vanguard
      s.enemyPlan = s.enemyPlan.filter((a) => a.actor !== eVanguard.id);
      const nextIdx = this._firstIncoming(eSide);
      if (nextIdx !== -1) {
        const oldIndex = eSide.vanguardIndex;
        eSide.vanguardIndex = nextIdx;
        const incoming = eSide.fighters[nextIdx];
        drawFreshHand(incoming, eSide.handSize, this.rng);
        this._emit('swap', { side: 'enemy', fromIndex: oldIndex, toIndex: nextIdx, cost: 0, forced: true });
        this._triggerSwapInBoons('enemy', incoming);
      }
    }

    // Expose v2: force-swap out any Vanguard whose Expose now exceeds its HP.
    this._checkExposeLockout();
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
  const eff = effSummary(card);
  if (!eff.dmg) return 0;
  const baseHits = eff.hits === 'X' ? Math.max(1, energyPaid) : (eff.hits ?? 1);
  const hits = baseHits * (card.cost === -1 ? Math.max(1, energyPaid) : 1);
  const dmgPerHit = computeAttackDamage(eff.dmg, attacker.statuses, target.statuses);
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

