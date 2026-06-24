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

/**
 * CURSES — junk cards an event can wedge into a deck. They're unplayable (cost -2)
 * and clog the hand until removed (a downside the player accepts for a big upside).
 */
export const CURSES = Object.freeze([
  { id: 'curse_doubt', name: 'Doubt', type: 'curse', cost: -2, attunement: null, keywords: ['unplayable'], text: 'Unplayable. Clogs your hand.', effects: [] },
  { id: 'curse_decay', name: 'Festering Wound', type: 'curse', cost: -2, attunement: null, keywords: ['unplayable'], text: 'Unplayable. A reminder of the bargain you struck.', effects: [] },
]);

/**
 * Events: a prompt + choices. A choice resolves either DIRECTLY ({ actions, result })
 * or via a weighted GAMBLE ({ outcomes:[{ weight, result, actions }] }) rolled by the
 * run RNG. `require` gates a choice (e.g. needs gold); `cost.gold` is auto-spent.
 * Action types include the RunManager actions plus three UI-resolved "meta" actions:
 *   grantRandomRelic · grantRandomPotion · addCurse  (the UI picks the concrete item).
 */
export const EVENTS = Object.freeze([
  {
    id: 'wounded_traveler', name: 'Wounded Traveler', icon: 'game-icons:bandage-roll',
    text: 'A hurt wanderer slumps by the path. They might reward kindness — or carry something worth taking.',
    choices: [
      { text: 'Tend their wounds', hint: 'Lose 6 HP — they may repay you', actions: [{ type: 'healParty', amount: -6 }],
        outcomes: [
          { weight: 2, result: 'Grateful, they press a pouch of gold into your hands.', actions: [{ type: 'gainGold', amount: 55 }] },
          { weight: 1, result: 'They had nothing but a strange trinket — and gladly give it.', actions: [{ type: 'grantRandomRelic' }] },
        ] },
      { text: 'Rob them', hint: 'Take their gold', actions: [{ type: 'gainGold', amount: 60 }],
        outcomes: [
          { weight: 2, result: 'You take the gold and go. (+60 gold)', actions: [] },
          { weight: 1, result: 'Their dying curse settles on you — a wound that will not close.', actions: [{ type: 'addCurse' }] },
        ] },
      { text: 'Leave them be', actions: [], result: 'You walk on.' },
    ],
  },
  {
    id: 'ancient_forge', name: 'Ancient Forge', icon: 'game-icons:anvil',
    text: 'A dormant dwarven forge still radiates heat. You could temper your bodies in its glow, or feed it your blood for power.',
    choices: [
      { text: 'Temper', hint: 'Heal 30% HP', actions: [{ type: 'healParty', pct: 0.30 }], result: 'The heat knits your wounds. (+30% HP)' },
      { text: 'Blood pact', hint: 'Lose 7 max HP — gain a relic', actions: [{ type: 'modifyMaxHp', amount: -7 }, { type: 'grantRandomRelic' }],
        result: 'You sear an oath into the anvil. It is weaker flesh, but the forge answers. (−7 max HP, +relic)' },
      { text: 'Scavenge parts', actions: [{ type: 'gainGold', amount: 50 }], result: 'You strip the forge for scrap. (+50 gold)' },
    ],
  },
  {
    id: 'mysterious_chest', name: 'Sealed Chest', icon: 'game-icons:open-treasure-chest',
    text: 'A heavy chest sits unattended. No lock — only a faint, uneasy hum.',
    choices: [
      { text: 'Open it', hint: 'A gamble',
        outcomes: [
          { weight: 3, result: 'Treasure! A relic gleams within.', actions: [{ type: 'grantRandomRelic' }] },
          { weight: 2, result: 'Coins spill out across the floor.', actions: [{ type: 'gainGold', amount: 65 }] },
          { weight: 2, result: 'A trap! Darts spray the party.', actions: [{ type: 'healParty', amount: -12 }] },
        ] },
      { text: 'Leave it', actions: [], result: 'Some things are better left shut.' },
    ],
  },
  {
    id: 'whispering_shrine', name: 'Whispering Shrine', icon: 'game-icons:prayer',
    text: 'An old shrine whispers promises. It asks for vigor, or merely for reverence.',
    choices: [
      { text: 'Offer your vitality', hint: 'Lose 6 max HP — gain 3 Strength relic',
        actions: [{ type: 'modifyMaxHp', amount: -6 }, { type: 'addRelic', relic: { id: 'shrine_brand', name: "Shrine's Favor", rarity: 'uncommon', text: 'At the start of each combat, gain 3 Strength.', onCombatStart: [{ op: 'buff', status: 'strength', value: 3 }] } }],
        result: 'The shrine drinks your vitality and brands you with strength. (−6 max HP, +relic)' },
      { text: 'Pray quietly', hint: 'Heal 25% HP', actions: [{ type: 'healParty', pct: 0.25 }], result: 'A calm settles over the party. (+25% HP)' },
      { text: 'Pocket the offerings', hint: 'Take 40 gold — risky',
        outcomes: [
          { weight: 1, result: 'You snatch the coins and flee. (+40 gold)', actions: [{ type: 'gainGold', amount: 40 }] },
          { weight: 1, result: 'The shrine recoils — a curse for your greed.', actions: [{ type: 'gainGold', amount: 40 }, { type: 'addCurse' }] },
        ] },
    ],
  },
  {
    id: 'wandering_merchant', name: 'Wandering Merchant', icon: 'game-icons:hooded-figure',
    text: 'A cloaked trader spreads a blanket of wares. "Coin for comfort, friend?"',
    choices: [
      { text: 'Buy a draught of potions', hint: 'Pay 40 gold — gain 2 potions', require: { gold: 40 }, cost: { gold: 40 },
        actions: [{ type: 'grantRandomPotion' }, { type: 'grantRandomPotion' }], result: 'The merchant hands over two flasks. (−40 gold, +2 potions)' },
      { text: 'Buy a curio', hint: 'Pay 75 gold — gain a relic', require: { gold: 75 }, cost: { gold: 75 },
        actions: [{ type: 'grantRandomRelic' }], result: 'You haggle for the relic and win. (−75 gold, +relic)' },
      { text: 'Move along', actions: [], result: 'The merchant shrugs and packs up.' },
    ],
  },
  {
    id: 'ember_spirit', name: 'Ember Spirit', icon: 'game-icons:fire-silhouette',
    text: 'A flickering spirit drifts close, curious and warm. It offers to share its fire — or to feed on yours.',
    choices: [
      { text: 'Commune with it', hint: 'Gain a potion + 15 gold', actions: [{ type: 'grantRandomPotion' }, { type: 'gainGold', amount: 15 }],
        result: 'The spirit shares its warmth. (+potion, +15 gold)' },
      { text: 'Let it feed', hint: 'Lose 5 max HP — gain 70 gold', actions: [{ type: 'modifyMaxHp', amount: -5 }, { type: 'gainGold', amount: 70 }],
        result: 'It draws a little life from you and leaves gold in its wake. (−5 max HP, +70 gold)' },
      { text: 'Wave it off', actions: [], result: 'The spirit drifts away.' },
    ],
  },
]);

export const POTIONS = Object.freeze([
  { id: 'heal_draught', name: 'Healing Draught', rarity: 'common', cost: 40, text: 'Heal 15 HP.', effects: [{ op: 'heal', value: 15, scope: 'selfOnlyTarget' }] },
  { id: 'fire_flask', name: 'Fire Flask', rarity: 'common', cost: 45, text: 'Deal 12 to the enemy Vanguard.', effects: [{ op: 'damage', value: 12, scope: 'enemyActiveTarget' }] },
  { id: 'block_potion', name: 'Block Potion', rarity: 'common', cost: 35, text: 'Gain 12 Block.', effects: [{ op: 'block', value: 12, scope: 'selfOnlyTarget' }] },
  { id: 'strength_potion', name: 'Strength Potion', rarity: 'uncommon', cost: 55, text: 'Gain 2 Strength.', effects: [{ op: 'buff', status: 'strength', value: 2 }] },
]);
