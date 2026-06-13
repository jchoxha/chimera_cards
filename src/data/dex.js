const CODEX_ORDER = [
  "Coggle", "Ironclad", "Colossite", "Pengloo",
  "Emperorime", "Ampup", "Dynamole", "Brineling",
  "Krakenmaw", "Zephyrling", "Gustrike", "Stormcrest",
  "Thistlit", "Bramblequeen", "Voltick", "Sparkbug",
  "Thunderwing", "Shellid", "Drizzlit", "Snortle",
  "Tuskarge", "Tinwhisk", "Quicksilverr", "Cactus Kid",
  "Sporelet", "Myconid", "Rotwarden", "Smoglet",
  "Mireviper", "Blinkout", "Vanishrym", "Candela",
  "Pipdream", "Reverielle", "Shardle", "Geodon",
  "Cindermouse", "Emberat", "Infernyx", "Pulsepetal",
  "Cardiflora", "Lanternaut", "Beaconwright", "Mothlet",
  "Spectermoth", "Inkpaw", "Calligrim", "Snowpup",
  "Frostfang", "Glaciathar", "Magmaw", "Volcanoth",
  "Cubrawl", "Ursurge", "Beastlord", "Fennqi",
  "Geomite", "Vipertongue", "Murmurk", "Tidalith",
  "Maelune", "Seedling", "Bloomback", "Verdantaur",
  "Shadepup", "Nightmaw", "Pebblet", "Boulderkin",
  "Titanore", "Nullbit", "Oblivox", "Tickfright",
  "Sleetsprite", "Prismling", "Gemglow", "Aurorach",
  "Wispveil", "Aethernox", "Glimmer", "Radiel",
  "Seraphage", "Leechling", "Sanguine", "Hemarch",
  "Riftrick", "Banshreek", "Wispling", "Reaperion",
  "Wyrmling", "Drakareth", "Pyraxis", "Wicklash",
  "Hollowbell", "Mirrorkoi", "Opalisk", "Gloomare",
  "Nullmare", "Magnetar", "Howlphony", "Solgrave",
  "Ragnaroc", "Chronolisk", "Tempestus", "Leviathos",
  "Phoenetia", "Cosmara", "Voidwyrm", "Terrabyss",
];
const dexNumber = (name) => CODEX_ORDER.indexOf(name) + 1;




// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/items — sigils, potions, specials
// ║ UPDATE WHEN: new sigils: update sigilBonuses keys + codex mechanics; new specials: consider RECIPES + reward/shop pools (automatic via ITEMS)
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Items (sigils, potions, specials) ----------
// sigil: persistent enchantment equipped to ONE monster. potion: one-time
// use in battle. special: enables capture/evolution/fusion/forging.

export { CODEX_ORDER, dexNumber };
