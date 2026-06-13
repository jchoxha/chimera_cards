const ITEMS = [
  // sigils (equippable, persistent, monster-bound)
  { id: "emberheart", name: "Ember Heart", kind: "sigil", icon: "❤️‍🔥", rarity: "common", text: "Sigil: your whole team's attacks deal +2 damage. Permanent.", effect: { dmgBonus: 2 } },
  { id: "stonescale", name: "Stonescale", kind: "sigil", icon: "🛡️", rarity: "common", text: "Sigil: your whole team's skills grant +2 block. Permanent.", effect: { blockBonus: 2 } },
  { id: "windcharm", name: "Wind Charm", kind: "sigil", icon: "🪶", rarity: "uncommon", text: "Sigil: draw +1 card each turn. Permanent.", effect: { drawBonus: 1 } },
  { id: "voidcrystal", name: "Void Crystal", kind: "sigil", icon: "🔮", rarity: "uncommon", text: "Sigil: your team starts combat with +1 Strength. Permanent.", effect: { startStrength: 1 } },
  { id: "solardisk", name: "Solar Disk", kind: "sigil", icon: "🥏", rarity: "rare", text: "Sigil: the first card each turn costs 0. Permanent.", effect: { firstFree: true } },
  { id: "titanband", name: "Titan Band", kind: "sigil", icon: "💍", rarity: "rare", text: "Sigil: team Max HP +20. Permanent.", effect: { maxHpBonus: 20 } },
  { id: "evostone", name: "Evolution Stone", kind: "special", icon: "🌀", rarity: "rare", text: "Required to evolve a monster. Consumed on use.", effect: {} },
  { id: "fusioncatalyst", name: "Fusion Catalyst", kind: "special", icon: "🧬", rarity: "rare", text: "Required to fuse two monsters. Consumed on use.", effect: {} },
  { id: "ancienttome", name: "Ancient Tome", kind: "special", icon: "📕", rarity: "rare", text: "Teaches one special move at the Den's Move Tutor. Consumed.", effect: {} },
  { id: "genesisspark", name: "Genesis Spark", kind: "special", icon: "✨", rarity: "rare", text: "Required to forge a brand-new monster. Consumed on use.", effect: {} },
  { id: "beastball", name: "Beast Ball", kind: "special", icon: "🔴", rarity: "common", text: "Required to capture a monster. Consumed on a successful catch.", effect: {} },
  // potions
  { id: "fireflask", name: "Fire Flask", kind: "potion", icon: "🧪", rarity: "common", text: "Deal 12 damage to the enemy.", effect: { potionDmg: 12 } },
  { id: "blockdraft", name: "Bulwark Draft", kind: "potion", icon: "🧴", rarity: "common", text: "Gain 15 block.", effect: { potionBlock: 15 } },
  { id: "ragevial", name: "Rage Vial", kind: "potion", icon: "⚗️", rarity: "uncommon", text: "Gain 3 Strength this combat.", effect: { potionStrength: 3 } },
  { id: "mendtonic", name: "Mend Tonic", kind: "potion", icon: "💉", rarity: "uncommon", text: "Heal 18 HP.", effect: { potionHeal: 18 } },
  { id: "energyshot", name: "Energy Shot", kind: "potion", icon: "🔋", rarity: "rare", text: "Gain 2 energy now.", effect: { potionEnergy: 2 } },
];


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/materials+recipes — materials, drops, transmute, recipes
// ║ UPDATE WHEN: new elements (signature material), new items (recipe?), new materials need battle `use`/`effect` + useMaterial support; admin Systems tables update automatically
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Crafting materials ----------
// Each element has a signature material; four universal tiers sit above.
// Monsters drop materials on defeat and yield them when transmuted, with
// chances driven by element, rarity, tier, and battle context.

export { ITEMS };
