// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/content — starter RELICS & POTIONS for the run.   ║
// ║ Relics = run-long effect sources (onCombatStart op-list and/or a      ║
// ║ passive). Potions = one-shot consumables (an effect op-list run via    ║
// ║ VanguardManager.useConsumable). Both reuse the card effect vocabulary. ║
// ║ UPDATE WHEN: adding relic/potion content (or port src/data/artifacts).║
// ╚══════════════════════════════════════════════════════════════════╝

export const RELICS = Object.freeze([
  { id: 'iron_brand', name: 'Iron Brand', rarity: 'common', cost: 60, text: 'At the start of each combat, gain 6 Block.', onCombatStart: [{ op: 'block', value: 6 }] },
  { id: 'war_totem', name: 'War Totem', rarity: 'uncommon', cost: 90, text: 'At the start of each combat, gain 2 Strength.', onCombatStart: [{ op: 'buff', status: 'strength', value: 2 }] },
  { id: 'whetstone', name: 'Whetstone', rarity: 'common', cost: 70, text: 'Whenever you gain Block, deal 2 to the enemy Vanguard.', passive: null, onGainBlock: true }, // sample; wiring TBD
]);

export const POTIONS = Object.freeze([
  { id: 'heal_draught', name: 'Healing Draught', rarity: 'common', cost: 40, text: 'Heal 15 HP.', effects: [{ op: 'heal', value: 15, scope: 'selfOnlyTarget' }] },
  { id: 'fire_flask', name: 'Fire Flask', rarity: 'common', cost: 45, text: 'Deal 12 to the enemy Vanguard.', effects: [{ op: 'damage', value: 12, scope: 'enemyActiveTarget' }] },
  { id: 'block_potion', name: 'Block Potion', rarity: 'common', cost: 35, text: 'Gain 12 Block.', effects: [{ op: 'block', value: 12, scope: 'selfOnlyTarget' }] },
  { id: 'strength_potion', name: 'Strength Potion', rarity: 'uncommon', cost: 55, text: 'Gain 2 Strength.', effects: [{ op: 'buff', status: 'strength', value: 2 }] },
]);
