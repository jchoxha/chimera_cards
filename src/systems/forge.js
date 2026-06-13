const RARITY_COLOR = {
  common: "#e8e6f0",   // white
  uncommon: "#7ee787", // green
  rare: "#4d9fff",     // blue
  epic: "#a571ff",     // purple
  mythic: "#ff5a4d",   // red
  legendary: "#ff9a3d",// orange
  godly: "#ffd34d",    // yellow
};

// ---------- Forge roll system ----------
const RARITY_LADDER = ["common", "uncommon", "rare", "epic", "mythic", "legendary", "godly"];

// Stat budgets per rarity: drives the HP range and move-power scale the AI
// is told to use, so higher rarity genuinely means a stronger monster.
const RARITY_BUDGET = {
  common: { hp: [24, 32], power: "modest (Spire-scale, small numbers)" },
  uncommon: { hp: [30, 40], power: "solid (a bit above common)" },
  rare: { hp: [38, 48], power: "strong (clearly above average)" },
  epic: { hp: [46, 58], power: "powerful (well above average)" },
  mythic: { hp: [56, 70], power: "fearsome (near the top)" },
  legendary: { hp: [66, 82], power: "formidable (top-tier, still balanced)" },
  godly: { hp: [80, 100], power: "overwhelming (the strongest in the world)" },
};

// Signature boons (passives). Tagged with the minimum rarity that can roll
// them, so higher rarities reach the best ones and commons usually get none.
const BOONS = [
  { id: "none", name: "No boon", text: "No special passive.", min: "common" },
  { id: "none2", name: "No boon", text: "No special passive.", min: "common" },
  { id: "thorns", name: "Thornskin", text: "Reflect 2 damage when hit.", min: "common", effect: { thorns: 2 } },
  { id: "opener", name: "Quick Draw", text: "Draw 1 extra card on the turn this monster swaps in.", min: "uncommon", effect: { swapDraw: 1 } },
  { id: "bulwark", name: "Bulwark", text: "Start each combat with 5 block.", min: "rare", effect: { startBlock: 5 } },
  { id: "ferocity", name: "Ferocity", text: "Start each combat with 1 Strength.", min: "epic", effect: { startStrength: 1 } },
  { id: "freecard", name: "Prodigy", text: "The first card each turn costs 0.", min: "mythic", effect: { firstFree: true } },
  { id: "overflow", name: "Overflowing", text: "Gain +1 energy on the turn this monster swaps in.", min: "legendary", effect: { swapEnergy: 1 } },
  { id: "regen", name: "Undying", text: "Heal 4 HP at the start of each of this monster's turns.", min: "godly", effect: { regen: 4 } },
];

const STAT_EMPHASES = [
  { id: "offense", name: "Offense", text: "Moves lean toward heavy damage.", min: "common" },
  { id: "defense", name: "Defense", text: "Moves lean toward block and survival.", min: "common" },
  { id: "balanced", name: "Balanced", text: "A mix of attack and defense.", min: "common" },
];

const rarityIndex = (r) => RARITY_LADDER.indexOf(r);

// Weighted random rarity for a forge. Skews low but the top tiers are rare.

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/forge — forge wheel rolls
// ║ UPDATE WHEN: rarity ladder changes; starter forge pins via rollForge(forced)
// ╚══════════════════════════════════════════════════════════════════╝
function rollRarity() {
  const r = Math.random();
  if (r < 0.38) return "common";
  if (r < 0.63) return "uncommon";
  if (r < 0.80) return "rare";
  if (r < 0.90) return "epic";
  if (r < 0.96) return "mythic";
  if (r < 0.99) return "legendary";
  return "godly";
}

// Evolution stages, CONSTRAINED by rarity headroom: every later stage must
// climb one rarity rung, so a higher base rarity allows fewer stages.
// We still cap evolution lines at 3 stages.
function rollStages(rarity) {
  const headroom = RARITY_LADDER.length - rarityIndex(rarity); // rungs available incl. self
  const maxStages = Math.min(3, headroom);
  // weight toward fewer stages, but allow the max
  const weights = [];
  for (let s = 1; s <= maxStages; s++) weights.push({ s, w: maxStages - s + 1 });
  const total = weights.reduce((a, b) => a + b.w, 0);
  let roll = Math.random() * total;
  for (const { s, w } of weights) {
    if (roll < w) return s;
    roll -= w;
  }
  return 1;
}

function rollBoon(rarity) {
  const ri = rarityIndex(rarity);
  // boons available at this rarity or below; higher rarity = more likely a real boon
  const pool = BOONS.filter((b) => rarityIndex(b.min) <= ri);
  // low rarities mostly get "none"; high rarities weight toward the strong end
  if (ri <= 1 && Math.random() < 0.6) return BOONS[0];
  const startBias = ri >= 4 ? Math.floor(pool.length / 2) : 0;
  const idx = startBias + Math.floor(Math.random() * (pool.length - startBias));
  return pool[idx];
}

function rollEmphasis() {
  return STAT_EMPHASES[Math.floor(Math.random() * STAT_EMPHASES.length)];
}

// Roll a full forge result. `forced` can pin rarity/stages (starter forge).
function rollForge(forced) {
  const rarity = (forced && forced.rarity) || rollRarity();
  const stages = (forced && forced.stages) || rollStages(rarity);
  const emphasis = rollEmphasis();
  const boon = rollBoon(rarity);
  return { rarity, stages, emphasis, boon };
}



// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/artifacts+passives — run artifacts, sigil/combined bonuses
// ║ UPDATE WHEN: new bonus KEYS need wiring in makeFighter/playCard; new artifacts/sigils with existing keys are automatic
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Artifacts (run-scoped dungeon passives) ----------
// Found inside dungeons; empower the whole team; LOST when the run ends.

export { RARITY_COLOR, RARITY_LADDER, RARITY_BUDGET, BOONS, STAT_EMPHASES, rarityIndex, rollRarity, rollStages, rollBoon, rollEmphasis, rollForge };
