const UNIVERSAL_CARDS = [
  { id: "strike", name: "Strike", type: "attack", cost: 1, dmg: 6, text: "Deal 6 damage." },
  { id: "guard", name: "Guard", type: "skill", cost: 1, block: 5, text: "Gain 5 block." },
  { id: "focus", name: "Focus", type: "skill", cost: 0, draw: 2, text: "Draw 2 cards." },
  { id: "rally", name: "Rally", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
];

// TYPE moves: one per element, learnable at the Den's Move Tutor by any
// monster carrying that element. They keep their own element for matchups.
const TYPE_MOVES = [
  { id: "tm_pyre", element: "pyre", name: "Flame Burst", type: "attack", cost: 1, dmg: 9, burn: 2, text: "Deal 9 damage. Apply 2 Burn." },
  { id: "tm_frost", element: "frost", name: "Ice Lance", type: "attack", cost: 1, dmg: 8, chill: 2, text: "Deal 8 damage. Apply 2 Chill." },
  { id: "tm_hydro", element: "hydro", name: "Tide Swell", type: "attack", cost: 1, dmg: 7, soak: 2, text: "Deal 7 damage. Apply 2 Soak." },
  { id: "tm_charge", element: "charge", name: "Static Jab", type: "attack", cost: 0, dmg: 4, shock: 1, text: "Deal 4 damage. Apply 1 Shock." },
  { id: "tm_aero", element: "aero", name: "Slipstream", type: "skill", cost: 0, block: 4, draw: 1, text: "Gain 4 block. Draw 1." },
  { id: "tm_stone", element: "stone", name: "Stone Wall", type: "skill", cost: 1, block: 11, text: "Gain 11 block." },
  { id: "tm_metal", element: "metal", name: "Plate Up", type: "skill", cost: 1, shield: 6, text: "Gain 6 Shield." },
  { id: "tm_crystal", element: "crystal", name: "Refract Ray", type: "attack", cost: 1, dmg: 8, draw: 1, text: "Deal 8 damage. Draw 1." },
  { id: "tm_toxin", element: "toxin", name: "Venom Dart", type: "attack", cost: 0, dmg: 3, poison: 2, text: "Deal 3 damage. Apply 2 Poison." },
  { id: "tm_flora", element: "flora", name: "Verdant Mend", type: "skill", cost: 1, regen: 3, block: 4, text: "Gain 3 Regen and 4 block." },
  { id: "tm_beast", element: "beast", name: "Feral Claw", type: "attack", cost: 1, dmg: 10, text: "Deal 10 damage." },
  { id: "tm_lumen", element: "lumen", name: "Radiant Mend", type: "skill", cost: 1, teamheal: 5, text: "Heal team 5." },
  { id: "tm_aether", element: "aether", name: "Phase Step", type: "skill", cost: 1, block: 6, draw: 1, text: "Gain 6 block. Draw 1." },
  { id: "tm_umbra", element: "umbra", name: "Dark Hex", type: "attack", cost: 1, dmg: 6, vulnerable: 2, text: "Deal 6 damage. Apply 2 Vulnerable." },
  { id: "tm_void", element: "void", name: "Erosion", type: "attack", cost: 1, dmg: 5, decay: 3, text: "Deal 5 damage. Apply 3 Decay." },
  { id: "tm_blood", element: "blood", name: "Siphon", type: "attack", cost: 1, dmg: 7, leech: true, text: "Deal 7 damage. Heal for half." },
];

// SPECIAL moves: colorless, powerful, learnable by ANY monster, but only by
// consuming an Ancient Tome at the Move Tutor.
const SPECIAL_MOVES = [
  { id: "sp_omni", name: "Omnistrike", type: "attack", cost: 2, dmg: 9, hits: 2, text: "Deal 9 damage twice." },
  { id: "sp_aegis", name: "Aegis Field", type: "skill", cost: 2, shield: 10, block: 6, text: "Gain 10 Shield and 6 block." },
  { id: "sp_wind", name: "Second Wind", type: "skill", cost: 1, teamheal: 6, draw: 1, text: "Heal team 6. Draw 1." },
  { id: "sp_clock", name: "Overclock", type: "skill", cost: 0, energy: 2, exhaust: true, text: "Gain 2 energy. Exhaust." },
];
const MOVE_CAP = 5; // max equipped moves per monster (signatures + learned)


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/monsters — the 108-species roster
// ║ UPDATE WHEN: new monsters need: desc+lore+cards, dex order REGEN (CODEX_ORDER), rarity rule check (+1/stage), EVOLUTION_REQS if gated, admin Roster shows automatically
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Default monster roster ----------
// rarity ladder: common, uncommon, rare, epic, mythic, legendary, godly
// tier: stage in evolution line. evolvesTo: next form's name (or null).
// desc: short codex line shown to players. lore: rich hidden brief used to
// drive art + move generation and to flavor the world.

export { UNIVERSAL_CARDS, TYPE_MOVES, SPECIAL_MOVES, MOVE_CAP };
