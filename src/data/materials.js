import { procIcon } from "../ui/icons.jsx";
import { ELEMENT_COLOR } from "../systems/elements.jsx";
import { rarityIndex } from "../systems/forge.js";
const ELEMENT_MATERIAL = {
  pyre: "cinderash", frost: "rimeshard", hydro: "tidepearl", charge: "voltfilament",
  aero: "zephyrplume", stone: "granitechip", metal: "alloyscrap", crystal: "prismsliver",
  toxin: "venomsac", flora: "bloomfiber", beast: "wildclaw", lumen: "sunmote",
  aether: "starthread", umbra: "duskveil", void: "nullfragment", blood: "crimsondrop",
};
const MATERIALS = [
  { id: "cinderash", name: "Cinder Ash", icon: "🔥", element: "pyre", tier: 1, text: "Still-warm ash from a pyre creature.", use: "Apply 2 Burn.", effect: { burn: 2 } },
  { id: "rimeshard", name: "Rime Shard", icon: "❄️", element: "frost", tier: 1, text: "A sliver of never-melting frost.", use: "Apply 2 Chill.", effect: { chill: 2 } },
  { id: "tidepearl", name: "Tide Pearl", icon: "🫧", element: "hydro", tier: 1, text: "A pearl that holds a captive current.", use: "Apply 2 Soak.", effect: { soak: 2 } },
  { id: "voltfilament", name: "Volt Filament", icon: "⚡", element: "charge", tier: 1, text: "A thread of tamed lightning.", use: "Apply 1 Shock.", effect: { shock: 1 } },
  { id: "zephyrplume", name: "Zephyr Plume", icon: "🪶", element: "aero", tier: 1, text: "A feather lighter than the air around it.", use: "Draw 1 card.", effect: { draw: 1 } },
  { id: "granitechip", name: "Granite Chip", icon: "🪨", element: "stone", tier: 1, text: "A chip of stubborn living rock.", use: "Gain 5 block.", effect: { block: 5 } },
  { id: "alloyscrap", name: "Alloy Scrap", icon: "⚙️", element: "metal", tier: 1, text: "Scrap from a machine-beast's plating.", use: "Gain 4 Shield.", effect: { shield: 4 } },
  { id: "prismsliver", name: "Prism Sliver", icon: "💎", element: "crystal", tier: 1, text: "A sliver that splits light into song.", use: "Deal 5 damage.", effect: { dmg: 5 } },
  { id: "venomsac", name: "Venom Sac", icon: "☣️", element: "toxin", tier: 1, text: "Handle with thick gloves. Twice.", use: "Apply 2 Poison.", effect: { poison: 2 } },
  { id: "bloomfiber", name: "Bloom Fiber", icon: "🌿", element: "flora", tier: 1, text: "A fiber that keeps trying to take root.", use: "Gain 2 Regen.", effect: { regen: 2 } },
  { id: "wildclaw", name: "Wild Claw", icon: "🐾", element: "beast", tier: 1, text: "A shed claw, still warm with instinct.", use: "Gain 1 Strength.", effect: { strength: 1 } },
  { id: "sunmote", name: "Sun Mote", icon: "☀️", element: "lumen", tier: 1, text: "A mote of daylight that refuses dusk.", use: "Heal 5 HP.", effect: { heal: 5 } },
  { id: "starthread", name: "Star Thread", icon: "✨", element: "aether", tier: 1, text: "A strand pulled from between stars.", use: "Gain 1 energy.", effect: { energy: 1 } },
  { id: "duskveil", name: "Dusk Veil", icon: "🌑", element: "umbra", tier: 1, text: "A scrap of woven shadow.", use: "Apply 1 Vulnerable.", effect: { vulnerable: 1 } },
  { id: "nullfragment", name: "Null Fragment", icon: "⚫", element: "void", tier: 1, text: "A piece of nothing. Surprisingly heavy.", use: "Apply 2 Decay.", effect: { decay: 2 } },
  { id: "crimsondrop", name: "Crimson Drop", icon: "🩸", element: "blood", tier: 1, text: "A drop that beats faintly in the vial.", use: "Deal 4 damage, heal 2.", effect: { dmg: 4, heal: 2 } },
  { id: "chimdust", name: "Chimera Dust", icon: "🌫️", element: null, tier: 0, text: "The common residue of all monsters.", use: "Gain 3 block.", effect: { block: 3 } },
  { id: "vitalessence", name: "Vital Essence", icon: "💠", element: null, tier: 2, text: "Concentrated life-force.", use: "Heal 8 HP.", effect: { heal: 8 } },
  { id: "primalcore", name: "Primal Core", icon: "🔮", element: null, tier: 3, text: "The dense heart of a powerful creature.", use: "Gain 2 Strength.", effect: { strength: 2 } },
  { id: "celestialshard", name: "Celestial Shard", icon: "🌟", element: null, tier: 4, text: "A fragment of something beyond rarity.", use: "+1 energy, draw 1, 5 block.", effect: { energy: 1, draw: 1, block: 5 } },
];
function materialIcon(m) { return procIcon(m.id, "material", m.element ? ELEMENT_COLOR[m.element] : "#a571ff"); }
const materialById = (id) => MATERIALS.find((m) => m.id === id);

// Roll battle drops for a defeated monster. ctx: { elite, boss, wild }.
// Returns { materialId: qty }. Chances scale with rarity/tier; elite and
// boss fights boost both odds and quantities.
function rollDrops(enemy, ctx = {}) {
  const out = {};
  const add = (id, n) => { if (n > 0) out[id] = (out[id] || 0) + n; };
  const ri = Math.max(0, rarityIndex(enemy.rarity || "common"));
  const tier = enemy.tier || 1;
  const boost = ctx.boss ? 1.5 : ctx.elite ? 1.3 : ctx.wild ? 0.85 : 1;

  // universal dust: always
  add("chimdust", ctx.boss ? 3 : ctx.elite ? 2 : 1);
  // element material: likely, more from evolved monsters
  const elMat = ELEMENT_MATERIAL[enemy.element];
  if (elMat && Math.random() < Math.min(0.95, 0.7 * boost)) {
    add(elMat, 1 + (tier >= 2 ? 1 : 0) + (Math.random() < 0.25 * boost ? 1 : 0));
  }
  // vital essence: rarity-driven
  if (Math.random() < Math.min(0.9, (0.15 + 0.08 * ri) * boost)) add("vitalessence", 1);
  // primal core: rare and above
  if (ri >= 2 && Math.random() < Math.min(0.6, (0.08 + 0.05 * (ri - 2)) * boost)) add("primalcore", 1);
  // celestial shard: legendary/godly only
  if (ri >= 5 && Math.random() < 0.18 * boost) add("celestialshard", 1);
  return out;
}

// The transmute drop TABLE for a captured monster: independent chances per
// material, driven by element, rarity, stage, and earned XP. Each entry is
// rolled with "exploding" repeats: on success you gain one and roll the SAME
// chance again, until a miss. (Expected copies at chance p = p/(1-p).)
function transmuteTable(m) {
  const ri = Math.max(0, rarityIndex(m.rarity || "common"));
  const tier = m.tier || 1;
  const xp = (m.prog && m.prog.xp) || 0;
  const xpBonus = Math.min(0.15, Math.floor(xp / 150) * 0.05);
  const table = [];
  const elMat = ELEMENT_MATERIAL[m.element];
  if (elMat) table.push({ id: elMat, chance: Math.min(0.85, 0.5 + 0.1 * (tier - 1) + xpBonus) });
  table.push({ id: "chimdust", chance: 0.8 });
  table.push({ id: "vitalessence", chance: Math.min(0.6, 0.15 + 0.08 * ri) });
  if (ri >= 2) table.push({ id: "primalcore", chance: Math.min(0.3, 0.05 + 0.05 * (ri - 2)) });
  if (ri >= 5) table.push({ id: "celestialshard", chance: 0.1 });
  return table;
}

// Roll a transmute table with exploding repeats per entry.
function rollTransmute(table) {
  const out = {};
  for (const entry of table) {
    let n = 0;
    while (Math.random() < entry.chance) n++;
    if (n > 0) out[entry.id] = n;
  }
  return out;
}

// ---------- Achievements (feats that teach crafting recipes) ----------
// check receives the stats object; recipe is the ITEM id whose recipe is learned.
const ACHIEVEMENTS = [
  { id: "firstblood", label: "Win 3 battles", check: (s) => s.battlesWon >= 3, recipe: "fireflask" },
  { id: "warpath", label: "Win 12 battles", check: (s) => s.battlesWon >= 12, recipe: "ragevial" },
  { id: "collector", label: "Capture 3 monsters", check: (s) => s.monstersCaptured >= 3, recipe: "mendtonic" },
  { id: "alchemist", label: "Transmute a monster", check: (s) => s.monstersTransmuted >= 1, recipe: "blockdraft" },
  { id: "artisan", label: "Craft 3 items", check: (s) => s.itemsCrafted >= 3, recipe: "energyshot" },
  { id: "slayer", label: "Slay a boss", check: (s) => s.bossesSlain >= 1, recipe: "evostone" },
  { id: "conqueror", label: "Slay 3 bosses", check: (s) => s.bossesSlain >= 3, recipe: "fusioncatalyst" },
];

// ---------- Crafting recipes ----------
// needs: [{ id, qty }] for specific materials; anyElement: total count drawn
// from any element materials (largest stacks consumed first).
const RECIPES = [
  { item: "beastball", needs: [{ id: "chimdust", qty: 3 }], anyElement: 0 },
  { item: "fireflask", needs: [{ id: "chimdust", qty: 2 }], anyElement: 2 },
  { item: "blockdraft", needs: [{ id: "chimdust", qty: 2 }], anyElement: 2 },
  { item: "mendtonic", needs: [{ id: "vitalessence", qty: 1 }, { id: "chimdust", qty: 2 }], anyElement: 0 },
  { item: "ragevial", needs: [{ id: "vitalessence", qty: 1 }], anyElement: 3 },
  { item: "energyshot", needs: [{ id: "vitalessence", qty: 2 }], anyElement: 4 },
  { item: "emberheart", needs: [{ id: "cinderash", qty: 4 }, { id: "vitalessence", qty: 1 }], anyElement: 0 },
  { item: "stonescale", needs: [{ id: "granitechip", qty: 4 }, { id: "vitalessence", qty: 1 }], anyElement: 0 },
  { item: "windcharm", needs: [{ id: "zephyrplume", qty: 4 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "voidcrystal", needs: [{ id: "nullfragment", qty: 4 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "solardisk", needs: [{ id: "sunmote", qty: 5 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "titanband", needs: [{ id: "granitechip", qty: 3 }, { id: "alloyscrap", qty: 3 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "evostone", needs: [{ id: "vitalessence", qty: 3 }, { id: "chimdust", qty: 5 }], anyElement: 0 },
  { item: "fusioncatalyst", needs: [{ id: "primalcore", qty: 2 }, { id: "vitalessence", qty: 2 }], anyElement: 4 },
  { item: "genesisspark", needs: [{ id: "primalcore", qty: 2 }, { id: "celestialshard", qty: 1 }], anyElement: 6 },
  { item: "ancienttome", needs: [{ id: "celestialshard", qty: 1 }, { id: "vitalessence", qty: 2 }], anyElement: 0 },
];

// Can the player afford a recipe? Returns { ok, missing: [labels] }.
function canCraft(recipe, materials) {
  const missing = [];
  for (const n of recipe.needs) {
    const have = materials[n.id] || 0;
    if (have < n.qty) missing.push(`${n.qty - have} more ${materialById(n.id).name}`);
  }
  if (recipe.anyElement > 0) {
    const totalEl = MATERIALS.filter((m) => m.element).reduce((a, m) => a + (materials[m.id] || 0), 0);
    if (totalEl < recipe.anyElement) missing.push(`${recipe.anyElement - totalEl} more element materials (any)`);
  }
  return { ok: missing.length === 0, missing };
}

// Consume a recipe's cost from a materials map (returns the new map).
function consumeRecipe(recipe, materials) {
  const next = { ...materials };
  for (const n of recipe.needs) next[n.id] = (next[n.id] || 0) - n.qty;
  if (recipe.anyElement > 0) {
    let remaining = recipe.anyElement;
    // consume from the largest element stacks first
    const els = MATERIALS.filter((m) => m.element).map((m) => m.id).sort((a, b) => (next[b] || 0) - (next[a] || 0));
    for (const id of els) {
      if (remaining <= 0) break;
      const take = Math.min(next[id] || 0, remaining);
      next[id] = (next[id] || 0) - take;
      remaining -= take;
    }
  }
  for (const k in next) if (next[k] <= 0) delete next[k];
  return next;
}


export { ELEMENT_MATERIAL, MATERIALS, materialIcon, materialById, rollDrops, transmuteTable, rollTransmute, ACHIEVEMENTS, RECIPES, canCraft, consumeRecipe };
