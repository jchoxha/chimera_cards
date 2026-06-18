// Barrel for the engine core. Import from here:
//   import { GameEngine, CombatManager, PHASES } from './engine/index.js';

export * from './types.js';
export { GameEngine } from './GameEngine.js';
export { CombatManager, computeAttackDamage } from './combat/CombatManager.js';
// Vanguard/Peek rebuild — structural shells (no turn behavior yet).
export {
  COMBAT_DEFAULTS, createFighter, createFighterDeck, createFortifySlot,
  createSide, createPlannedAction, createCombatState, computeEnergyPerTurn,
} from './combat/state.js';
export { SCOPE_TABLE, describeScope, isValidScope, assertScopeTableComplete } from './combat/scopes.js';
export {
  reshuffle, drawCards, drawFreshHand, discardCard, exhaustCard,
  discardHandEndOfTurn, discardWholeHand, deckTotal,
} from './combat/deckOps.js';
export {
  livingFighters, vanguard, benchFighters, opposingKey, resolveScope,
  stackingFor, addStatus, pruneStatuses, gainBlock, applyHeal, applyDamage,
  applyCardEffects, LIVE_STATUSES,
} from './combat/resolve.js';
export { CardDeck, shuffle } from './cards/CardDeck.js';
export { MonsterParty, normalizeTypes, MAX_PARTY, MAX_TYPES } from './party/MonsterParty.js';
export {
  createRarityState, currentRareChance, rollRarity, draftCards,
  combinedTypeWeights, pickWeightedType,
  BASE_RARE_CHANCE, OFFSET_START, OFFSET_CAP,
} from './cards/rarity.js';
export { AIPipeline, budgetFor } from './ai/AIPipeline.js';
