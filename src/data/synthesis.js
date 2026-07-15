// MODULE: data/synthesis -- LOCKED source data for the 3-axis Synthesis Matrix
// (Class / Biology / Attunement). Verbatim transcription of
// Synthesis_Matrices.xlsx -- the single source of truth for axis bases, hybrid
// NAMES, and class->attunement legality. Derived rules (matchups, stat
// profiles, card templates, generation) live elsewhere -- see
// docs/synthesis-matrix-spec.md.
// UPDATE WHEN: the authored matrix changes (regenerate from the xlsx).
//
// A creature carries 1-2 BASES per axis. Two bases = the named hybrid below
// (the matrix is the display-name table for an unordered base pair; pure
// single-base creatures use the base name itself). Pair keys are the two base
// names sorted alphabetically and joined with "|".

/** @typedef {{ type: string, weight: number }} AxisAffinity */

export const CLASS_BASES = Object.freeze(["Warrior", "Rogue", "Mage", "Warlock", "Priest", "Shaman", "Ranger", "Engineer"]);
export const BIOLOGY_BASES = Object.freeze(["Beast", "Humanoid", "Undead", "Dragonkin", "Elemental", "Demon", "Mechanical", "Giant", "Aberration"]);
export const ATTUNEMENT_BASES = Object.freeze(["Physical", "Fire", "Frost", "Nature", "Arcane", "Shadow", "Holy", "Void", "Water", "Air", "Stone", "Energy", "Mind"]);

// ── Body Types + Descriptive Subtypes (docs/biology-kits.md §9, the reworked model) ──
// BODY TYPE = the creature's FORM (one or two; the biology axis now holds these).
export const BODY_TYPES = Object.freeze(["Humanoid", "Beast", "Aberration"]);
// DESCRIPTIVE SUBTYPES = composition/affliction overlays (zero or more; a trait/card package,
// not a full kit). Mechanical/Elemental/Giant/Demonic built first; the rest are backlog.
export const SUBTYPES = Object.freeze(["Mechanical", "Elemental", "Giant", "Demonic", "Undead", "Hallowed", "Feral", "Ancient", "Swarm", "Cursed", "Spectral"]);
/** Canonical display order for subtype prefixes — English adjective order:
 *  SIZE → CONDITION/ORIGIN → COMPOSITION (so "Giant Demonic Mechanical Chimera"). */
export const SUBTYPE_ORDER = Object.freeze(["Giant", "Ancient", "Feral", "Cursed", "Hallowed", "Demonic", "Undead", "Spectral", "Swarm", "Elemental", "Mechanical"]);

/** Sort a creature's subtypes into canonical prefix order (unknown ones go last, stable). */
export function orderSubtypes(subtypes = []) {
  const idx = (s) => { const i = SUBTYPE_ORDER.indexOf(s); return i === -1 ? SUBTYPE_ORDER.length : i; };
  return [...(subtypes || [])].filter(Boolean).sort((a, b) => idx(a) - idx(b));
}

/** The full biological identity name: ordered subtype prefixes + the body-type synthesis name.
 *  e.g. (["Beast","Humanoid"], ["Mechanical","Giant","Demonic"]) → "Giant Demonic Mechanical Chimera". */
export function creatureBiologyName(bodyTypes = [], subtypes = []) {
  const bts = Array.isArray(bodyTypes) ? bodyTypes.filter(Boolean) : [bodyTypes].filter(Boolean);
  const base = bts.length >= 2 ? synthName("biology", bts[0], bts[1]) : (bts[0] || "");
  return [...orderSubtypes(subtypes), base].filter(Boolean).join(" ");
}

/** Unordered-pair -> hybrid name. Diagonal (a===a) is the base itself. */
export const CLASS_SYNTHESIS = Object.freeze({
  "Engineer|Mage": "Artificer",
  "Engineer|Priest": "Medic",
  "Engineer|Ranger": "Trapper",
  "Engineer|Rogue": "Saboteur",
  "Engineer|Shaman": "Tracker",
  "Engineer|Warlock": "Felcrafter",
  "Engineer|Warrior": "Ironclad",
  "Mage|Priest": "Arcanist",
  "Mage|Ranger": "Spellbow",
  "Mage|Rogue": "Bard",
  "Mage|Shaman": "Druid",
  "Mage|Warlock": "Necromancer",
  "Mage|Warrior": "Spellsword",
  "Priest|Ranger": "Sentinel",
  "Priest|Rogue": "Monk",
  "Priest|Shaman": "Cleric",
  "Priest|Warlock": "Inquisitor",
  "Priest|Warrior": "Paladin",
  "Ranger|Rogue": "Scout",
  "Ranger|Shaman": "Beastmaster",
  "Ranger|Warlock": "Demon Hunter",
  "Ranger|Warrior": "Hunter",
  "Rogue|Shaman": "Stalker",
  "Rogue|Warlock": "Assassin",
  "Rogue|Warrior": "Gladiator",
  "Shaman|Warlock": "Witch Doctor",
  "Shaman|Warrior": "Warmonger",
  "Warlock|Warrior": "Death Knight",
});

export const BIOLOGY_SYNTHESIS = Object.freeze({
  "Aberration|Beast": "Anomalous",
  "Aberration|Demon": "Eldritch",
  "Aberration|Dragonkin": "Xenodrake",
  "Aberration|Elemental": "Anomaly",
  "Aberration|Giant": "Gargantuan",
  "Aberration|Humanoid": "Warped",
  "Aberration|Mechanical": "Malfunction",
  "Aberration|Undead": "Phantom",
  "Beast|Demon": "Felbeast",
  "Beast|Dragonkin": "Hydra",
  "Beast|Elemental": "Primal",
  "Beast|Giant": "Behemoth",
  "Beast|Humanoid": "Chimera",
  "Beast|Mechanical": "Cybeast",
  "Beast|Undead": "Stitched",
  "Demon|Dragonkin": "Hellwing",
  "Demon|Elemental": "Chaosborn",
  "Demon|Giant": "Pitlord",
  "Demon|Humanoid": "Fiend",
  "Demon|Mechanical": "Soulengine",
  "Demon|Undead": "Cryptlord",
  "Dragonkin|Elemental": "Aspect",
  "Dragonkin|Giant": "Leviathan",
  "Dragonkin|Humanoid": "Dragonspawn",
  "Dragonkin|Mechanical": "Geargon",
  "Dragonkin|Undead": "Scourgewyrm",
  "Elemental|Giant": "Titan",
  "Elemental|Humanoid": "Attuned",
  "Elemental|Mechanical": "Golem",
  "Elemental|Undead": "Revenant",
  "Giant|Humanoid": "Half-Giant",
  "Giant|Mechanical": "Colossus",
  "Giant|Undead": "Abomination",
  "Humanoid|Mechanical": "Augmented",
  "Humanoid|Undead": "Ghoul",
  "Mechanical|Undead": "Necromech",
});

export const ATTUNEMENT_SYNTHESIS = Object.freeze({
  "Air|Arcane": "Aether",
  "Air|Energy": "Lightning",
  "Air|Fire": "Plasma",
  "Air|Frost": "Blizzard",
  "Air|Holy": "Zephyr",
  "Air|Mind": "Inspiration",
  "Air|Nature": "Storm",
  "Air|Physical": "Piercing",
  "Air|Shadow": "Miasma",
  "Air|Stone": "Dust",
  "Air|Void": "Vacuum",
  "Air|Water": "Typhoon",
  "Arcane|Energy": "Mana",
  "Arcane|Fire": "Spellfire",
  "Arcane|Frost": "Temporal",
  "Arcane|Holy": "Celestial",
  "Arcane|Mind": "Illusion",
  "Arcane|Nature": "Astral",
  "Arcane|Physical": "Force",
  "Arcane|Shadow": "Nether",
  "Arcane|Stone": "Rune",
  "Arcane|Void": "Cosmic",
  "Arcane|Water": "Torrent",
  "Energy|Fire": "Laser",
  "Energy|Frost": "Cryo",
  "Energy|Holy": "Radiance",
  "Energy|Mind": "Psionic",
  "Energy|Nature": "Electric",
  "Energy|Physical": "Kinetic",
  "Energy|Shadow": "Dark Energy",
  "Energy|Stone": "Crystal",
  "Energy|Void": "Antimatter",
  "Energy|Water": "Hydraulic",
  "Fire|Frost": "Frostfire",
  "Fire|Holy": "Sunlight",
  "Fire|Mind": "Pyrokinesis",
  "Fire|Nature": "Wildfire",
  "Fire|Physical": "Searing",
  "Fire|Shadow": "Felfire",
  "Fire|Stone": "Magma",
  "Fire|Void": "Smoke",
  "Fire|Water": "Steam",
  "Frost|Holy": "Purity",
  "Frost|Mind": "Stupor",
  "Frost|Nature": "Tundra",
  "Frost|Physical": "Brittle",
  "Frost|Shadow": "Gloom",
  "Frost|Stone": "Glacial",
  "Frost|Void": "Abyssal",
  "Frost|Water": "Slush",
  "Holy|Mind": "Enlightenment",
  "Holy|Nature": "Spirit",
  "Holy|Physical": "Smite",
  "Holy|Shadow": "Discipline",
  "Holy|Stone": "Consecration",
  "Holy|Void": "Penance",
  "Holy|Water": "Blessing",
  "Mind|Nature": "Instinct",
  "Mind|Physical": "Telekinesis",
  "Mind|Shadow": "Nightmare",
  "Mind|Stone": "Resolve",
  "Mind|Void": "Madness",
  "Mind|Water": "Tranquility",
  "Nature|Physical": "Venomous",
  "Nature|Shadow": "Blight",
  "Nature|Stone": "Earthen",
  "Nature|Void": "Decay",
  "Nature|Water": "Algae",
  "Physical|Shadow": "Bleed",
  "Physical|Stone": "Fracture",
  "Physical|Void": "Crush",
  "Physical|Water": "Impact",
  "Shadow|Stone": "Metal",
  "Shadow|Void": "Deep Dark",
  "Shadow|Water": "Mire",
  "Stone|Void": "Gravity",
  "Stone|Water": "Mud",
  "Void|Water": "Abyss",
});

/**
 * Class -> legal base attunements (a Warrior MUST be Physical, etc.). Every
 * class may ALSO use any UNIVERSAL_ATTUNEMENTS token. Hybrid classes take the
 * UNION of both parents' allowed sets (see docs/synthesis-matrix-spec.md).
 */
export const CLASS_ATTUNEMENT_RULES = Object.freeze({
  "Warrior": Object.freeze(["Physical"]),
  "Mage": Object.freeze(["Fire", "Frost", "Arcane"]),
  "Shaman": Object.freeze(["Nature", "Water", "Air", "Stone"]),
  "Warlock": Object.freeze(["Shadow"]),
  "Priest": Object.freeze(["Holy"]),
  "Rogue": Object.freeze(["Physical", "Shadow"]),
  "Ranger": Object.freeze(["Physical", "Nature"]),
  "Engineer": Object.freeze(["Physical", "Stone"]),
});

export const UNIVERSAL_ATTUNEMENTS = Object.freeze(["Energy", "Mind", "Void"]);

/** Raw legality text as authored (reference only). */
export const SYNTHESIS_RULE_TEXT = Object.freeze(["Rules for synth mx", "Warrior Classes must have a Physical Type", "Mage Classes must use a Fire, Frost, or Arcane Type", "Shaman Classes must use a Nature, Water, Air, or Stone Type", "Warlock Classes must use a Shadow Type", "Priest Classes must use a Holy Type", "Rouge Classes must use a Physical, or Shadow Type", "Ranger Classes must use a Physical, or Nature Type", "Engineer Classes must use a Physical, or Stone Type", "All classes can use an Energy, Mind, or Void Type"]);

const SYNTH_TABLES = {
  class: CLASS_SYNTHESIS,
  biology: BIOLOGY_SYNTHESIS,
  attunement: ATTUNEMENT_SYNTHESIS,
};

/**
 * Display name for 1-2 bases on an axis.
 * axis: 'class' | 'biology' | 'attunement'; a, b: base names (omit/equal b = pure).
 */
export function synthName(axis, a, b) {
  if (!b || a === b) return a;
  const [x, y] = [a, b].sort();
  return SYNTH_TABLES[axis]?.[x + '|' + y] ?? (a + '/' + b);
}

/** A creature's ATTUNEMENT display name: a single base uses its own name; a dual attunement
 *  reads as its synthesized hybrid name (e.g. ["Physical","Energy"] → "Kinetic") so a character
 *  presents as ONE fused type, not two separate ones. */
export function attunementDisplayName(attunements = []) {
  const a = (Array.isArray(attunements) ? attunements : [attunements]).filter(Boolean);
  if (!a.length) return '';
  return a.length >= 2 ? synthName('attunement', a[0], a[1]) : a[0];
}

/**
 * Legal base attunements for a class value (1-2 base classes): the UNION of
 * each base class's allowed set plus the universals.
 */
export function legalAttunements(classBases) {
  const set = new Set(UNIVERSAL_ATTUNEMENTS);
  for (const c of classBases) for (const a of (CLASS_ATTUNEMENT_RULES[c] ?? [])) set.add(a);
  return [...set].sort();
}

/**
 * A creature's attunement combo is legal if AT LEAST ONE base attunement is
 * allowed by its class (locked ruling A4: a Rogue may carry Shadow/Fire because
 * Shadow is legal, even though Fire is not). Bases carry NO per-axis weight (A2)
 * — both bases of a hybrid are mechanically equal.
 * @param {string[]} classBases       1-2 base class names.
 * @param {string[]} attunementBases  1-2 base attunement names.
 * @returns {boolean}
 */
export function attunementComboLegal(classBases, attunementBases) {
  const legal = new Set(legalAttunements(classBases));
  return attunementBases.some((a) => legal.has(a));
}
