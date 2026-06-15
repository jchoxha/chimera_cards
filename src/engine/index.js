// Barrel for the engine core. Import from here:
//   import { GameEngine, CombatManager, PHASES } from './engine/index.js';

export * from './types.js';
export { GameEngine } from './GameEngine.js';
export { CombatManager, computeAttackDamage } from './combat/CombatManager.js';
export { CardDeck, shuffle } from './cards/CardDeck.js';
export { MonsterParty, normalizeTypes, MAX_PARTY, MAX_TYPES } from './party/MonsterParty.js';
export {
  createRarityState, currentRareChance, rollRarity, draftCards,
  combinedTypeWeights, pickWeightedType,
  BASE_RARE_CHANCE, OFFSET_START, OFFSET_CAP,
} from './cards/rarity.js';
export { AIPipeline, budgetFor } from './ai/AIPipeline.js';
