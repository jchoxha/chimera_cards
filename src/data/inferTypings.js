// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/inferTypings — pick a creature's typings (Class / Body Type ║
// ║ / Attunement + descriptive Subtypes) from its NAME + LORE + physical      ║
// ║ DESCRIPTION. Tries the Claude connector when a key is present, else a     ║
// ║ keyword heuristic so it always works offline. Used by the custom-creature ║
// ║ creator when the player lets "AI decide" the typings. (Model: 3 BODY      ║
// ║ TYPES — Humanoid/Beast/Aberration — + 0–N SUBTYPES; docs/biology-kits §9.)║
// ╚══════════════════════════════════════════════════════════════════╝
import { askClaudeJson } from '../ai/claude.js';
import { CLASS_BASES, BODY_TYPES, SUBTYPES, ATTUNEMENT_BASES } from './synthesis.js';
import { BEAST_FAMILIES, anatomyForFamily, defaultAnatomy } from '../engine/cards/beastPool.js';
import { ABERRATION_FAMILIES, anatomyForAberrationFamily, defaultAberrationAnatomy } from '../engine/cards/aberrationPool.js';
import { weaponsForArchetype, defaultWeapons } from '../engine/cards/humanoidPool.js';

// keyword → axis value (lowercase). First strong hit wins by score.
const CLASS_KW = {
  Warrior: ['warrior', 'fighter', 'brawler', 'soldier', 'knight', 'berserker', 'gladiator', 'brute', 'champion', 'barbarian', 'guard'],
  Rogue: ['rogue', 'assassin', 'thief', 'stealth', 'dagger', 'sneak', 'duelist', 'bandit', 'shadow', 'ninja', 'blade'],
  Mage: ['mage', 'wizard', 'sorcerer', 'sorceress', 'spellcaster', 'arcanist', 'conjurer', 'elementalist', 'caster'],
  Warlock: ['warlock', 'curse', 'sacrifice', 'pact', 'summoner', 'necromancer', 'demonologist', 'hex'],
  Priest: ['priest', 'cleric', 'healer', 'paladin', 'monk', 'devotee', 'prophet', 'saint', 'holy'],
  Shaman: ['shaman', 'totem', 'druid', 'witch doctor', 'primal', 'spirit-caller', 'tribal'],
  Ranger: ['ranger', 'hunter', 'archer', 'bow', 'marksman', 'scout', 'tracker', 'trapper', 'sniper'],
  Engineer: ['engineer', 'tinker', 'gadget', 'inventor', 'mechanic', 'artificer', 'turret', 'machinist'],
};
// BODY TYPE = the FORM. Aberration is the catch-all (anything not clearly person/animal).
const BODY_KW = {
  Humanoid: ['human', 'man', 'woman', 'person', 'folk', 'soldier', 'mortal', 'elf', 'dwarf', 'humanoid', 'figure', 'cloaked', 'knight', 'mage', 'priest', 'warrior'],
  Beast: ['beast', 'wolf', 'lion', 'bear', 'tiger', 'fox', 'cat', 'dog', 'animal', 'fang', 'claw', 'paw', 'feral', 'predator', 'hound', 'boar', 'ram', 'stag', 'dragon', 'drake', 'wyrm', 'lizard', 'serpent', 'reptile', 'bird', 'fish', 'insect', 'turtle', 'tortoise', 'crab', 'shark', 'frog', 'toad', 'spider', 'scorpion', 'hawk', 'raven', 'owl'],
  Aberration: ['aberration', 'eldritch', 'horror', 'tentacle', 'eye', 'alien', 'mutant', 'abomination', 'cosmic', 'writhing', 'ooze', 'slime', 'crystal', 'plant', 'fungus', 'flora', 'formless', 'cloud', 'construct', 'golem', 'wisp', 'essence', 'elemental', 'living flame'],
};
// DESCRIPTIVE SUBTYPES — composition/affliction overlays (0–N).
const SUBTYPE_KW = {
  Mechanical: ['machine', 'robot', 'mech', 'gear', 'automaton', 'clockwork', 'steam', 'brass', 'metal', 'iron', 'cog', 'cyborg', 'augmented'],
  Elemental: ['elemental', 'living flame', 'embodiment', 'essence', 'primordial', 'made of', 'infused', 'attuned'],
  Giant: ['giant', 'titan', 'colossus', 'behemoth', 'huge', 'massive', 'towering', 'mountainous', 'gargantuan'],
  Demonic: ['demon', 'demonic', 'devil', 'fiend', 'imp', 'hellish', 'hellspawn', 'infernal', 'fel', 'possessed', 'corrupted'],
  Undead: ['undead', 'skeleton', 'zombie', 'ghost', 'lich', 'wraith', 'bone', 'grave', 'corpse', 'revenant', 'phantom', 'rotting'],
  Hallowed: ['hallowed', 'blessed', 'sacred', 'celestial', 'angelic', 'divine'],
  Feral: ['feral', 'savage', 'rabid', 'wild', 'frenzied', 'berserk'],
  Ancient: ['ancient', 'elder', 'primeval', 'eons', 'timeless', 'aged'],
  Swarm: ['swarm', 'colony', 'hive', 'myriad', 'countless', 'horde'],
  Cursed: ['cursed', 'plagued', 'hexed', 'doomed', 'blighted'],
  Spectral: ['spectral', 'ghostly', 'incorporeal', 'ethereal', 'phantasmal'],
};
// Kit specifics: family / anatomy / weapon keyword maps (validated vs the kits).
const FAMILY_KW = {
  Draconic: ['dragon', 'drake', 'wyrm', 'wyvern', 'draconic'],
  Avian: ['bird', 'avian', 'wing', 'hawk', 'raven', 'owl', 'eagle', 'feather', 'beak'],
  Reptilian: ['lizard', 'snake', 'serpent', 'reptile', 'scale', 'croc', 'turtle', 'gecko'],
  Piscine: ['fish', 'shark', 'eel', 'aquatic', 'fin', 'gill', 'sea creature'],
  Insectoid: ['insect', 'spider', 'bug', 'beetle', 'mantis', 'wasp', 'hive', 'chitin', 'scorpion'],
  Amphibian: ['frog', 'toad', 'newt', 'axolotl', 'amphibian'],
  Mammalian: ['wolf', 'bear', 'cat', 'lion', 'tiger', 'fox', 'hound', 'boar', 'fur', 'mammal', 'stag', 'ram'],
  Eldritch: ['eldritch', 'tentacle', 'horror', 'cosmic', 'unspeakable', 'mad'],
  Ooze: ['ooze', 'slime', 'gel', 'blob', 'amorphous'],
  Flora: ['plant', 'fungus', 'mushroom', 'tree', 'vine', 'flora', 'treant', 'moss'],
  Crystalline: ['crystal', 'gem', 'prism', 'mineral', 'quartz'],
  Construct: ['construct', 'golem', 'statue', 'animated'],
  Formless: ['formless', 'mist', 'cloud', 'gas', 'shadowy mass', 'wisp', 'energy being'],
};
const ANATOMY_KW = {
  Claws: ['claw', 'talon'], Teeth: ['teeth', 'fang', 'bite', 'jaw', 'maw'], Beak: ['beak'],
  Horns: ['horn', 'antler', 'tusk'], Tail: ['tail'], Hooves: ['hoof', 'hooves'],
  Wings: ['wing', 'flight', 'fly'], Quills: ['quill', 'spine', 'barb'], Venom: ['venom', 'poison', 'toxic'],
  Hide: ['hide', 'thick skin', 'fur'], Shell: ['shell', 'carapace'], Roar: ['roar', 'howl', 'bellow'],
  Breath: ['breath', 'breathe'],
  Tentacle: ['tentacle'], Eye: ['eye', 'gaze', 'stare'], Pseudopod: ['pseudopod'],
  Spore: ['spore'], Shard: ['shard', 'crystal'], Miasma: ['miasma', 'gas', 'fume'],
  Roots: ['root'], Mandible: ['mandible', 'pincer'],
};
const WEAPON_KW = {
  Sword: ['sword', 'blade'], Axe: ['axe'], Dagger: ['dagger', 'knife', 'knives'], Bow: ['bow', 'arrow', 'archer'],
  Crossbow: ['crossbow', 'bolt'], Spear: ['spear', 'lance', 'polearm'], Mace: ['mace'], Hammer: ['hammer', 'maul'],
  Staff: ['staff'], Wand: ['wand'], Shield: ['shield'], Fist: ['fist', 'unarmed', 'martial'],
};
// Word-boundary keyword test ("shell" must NOT match "hell", "impale" not "imp").
const hasWord = (text, kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);
const matchTags = (text, kwMap, valid) => Object.entries(kwMap)
  .filter(([tag, kws]) => valid.includes(tag) && kws.some((k) => hasWord(text, k)))
  .map(([tag]) => tag);

const ATT_KW = {
  Fire: ['fire', 'flame', 'ember', 'burn', 'blaze', 'lava', 'magma', 'inferno', 'scorch', 'cinder', 'pyro', 'molten', 'ash'],
  Frost: ['frost', 'ice', 'cold', 'snow', 'freeze', 'glacier', 'winter', 'chill', 'frozen', 'hail', 'icy'],
  Water: ['water', 'sea', 'ocean', 'wave', 'tide', 'aqua', 'river', 'rain', 'flood', 'marine', 'hydro', 'splash'],
  Nature: ['nature', 'plant', 'forest', 'vine', 'leaf', 'root', 'thorn', 'wood', 'grove', 'bloom', 'poison', 'toxic', 'venom', 'fungal', 'moss', 'bark'],
  Air: ['air', 'wind', 'sky', 'storm', 'gale', 'breeze', 'cloud', 'gust', 'tempest', 'flight', 'feather', 'aerial'],
  Energy: ['energy', 'electric', 'lightning', 'thunder', 'spark', 'volt', 'shock', 'bolt', 'plasma', 'charge', 'static'],
  Stone: ['stone', 'rock', 'earth', 'boulder', 'mineral', 'granite', 'gravel', 'crag', 'pebble'],
  Shadow: ['shadow', 'dark', 'night', 'gloom', 'umbra', 'shade', 'dusk', 'black', 'murk'],
  Holy: ['holy', 'light', 'divine', 'sacred', 'radiant', 'sun', 'blessed', 'celestial', 'dawn', 'angel', 'halo'],
  Void: ['void', 'abyss', 'oblivion', 'entropy', 'null', 'cosmic', 'eldritch', 'devour', 'rift'],
  Mind: ['mind', 'psychic', 'thought', 'telepath', 'mental', 'brain', 'dream', 'illusion', 'hypnotic'],
  Arcane: ['arcane', 'magic', 'magical', 'spell', 'mystic', 'rune', 'sorcery', 'enchant', 'ether', 'glyph'],
  Crystal: ['crystal', 'gem', 'prism', 'quartz', 'diamond'],
  Physical: ['physical', 'kinetic', 'brute', 'muscle', 'fist', 'melee', 'strike', 'steel', 'blade', 'might'],
};

function bestMatch(text, kwMap, valid, fallback) {
  const scores = {};
  for (const [val, kws] of Object.entries(kwMap)) {
    if (valid && !valid.includes(val)) continue;
    let s = 0;
    for (const kw of kws) if (hasWord(text, kw)) s += 1;
    if (s) scores[val] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length) return ranked[0][0];
  if (valid && valid.length) {
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return valid[h % valid.length];
  }
  return fallback;
}

/** Every subtype whose keywords hit the text (0–N). */
function matchSubtypes(text) {
  return Object.entries(SUBTYPE_KW)
    .filter(([, kws]) => kws.some((kw) => hasWord(text, kw)))
    .map(([val]) => val)
    .filter((s) => SUBTYPES.includes(s));
}

/** Heuristic typings from name + lore + description (always available, offline). */
export function inferTypingsHeuristic(name, lore = '', description = '') {
  const text = `${name} ${lore} ${description}`.toLowerCase();
  // Body type: direct keywords first; else a FAMILY hit implies its body (a
  // "turtle" is Reptilian → Beast, an "ooze" is → Aberration); else Humanoid.
  let body = bestMatch(text, BODY_KW, BODY_TYPES, null);
  if (!BODY_TYPES.includes(body) || !Object.entries(BODY_KW).some(([, kws]) => kws.some((k) => hasWord(text, k)))) {
    const beastFam = matchTags(text, FAMILY_KW, BEAST_FAMILIES);
    const aberrFam = matchTags(text, FAMILY_KW, ABERRATION_FAMILIES);
    if (beastFam.length) body = 'Beast';
    else if (aberrFam.length) body = 'Aberration';
    else body = bestMatch(text, BODY_KW, BODY_TYPES, 'Humanoid');
  }
  const klass = bestMatch(text, CLASS_KW, CLASS_BASES, 'Warrior');
  // Kit specifics per body type: a family + the anatomy/weapons the text names
  // (validated against the kit's allowed sets, with sensible defaults).
  let family = null, anatomy = [], weapons = [];
  if (body === 'Beast') {
    family = bestMatch(text, FAMILY_KW, BEAST_FAMILIES, 'Mammalian');
    const allowed = anatomyForFamily(family);
    anatomy = matchTags(text, ANATOMY_KW, allowed);
    if (anatomy.length < 2) anatomy = [...new Set([...anatomy, ...defaultAnatomy(family)])].slice(0, 3);
  } else if (body === 'Aberration') {
    family = bestMatch(text, FAMILY_KW, ABERRATION_FAMILIES, 'Eldritch');
    const allowed = anatomyForAberrationFamily(family);
    anatomy = matchTags(text, ANATOMY_KW, allowed);
    if (anatomy.length < 2) anatomy = [...new Set([...anatomy, ...defaultAberrationAnatomy(family)])].slice(0, 3);
  } else {
    const prof = weaponsForArchetype(klass);
    weapons = matchTags(text, WEAPON_KW, prof);
    if (!weapons.length) weapons = defaultWeapons(klass);
    weapons = weapons.slice(0, 2);
  }
  return {
    class: body === 'Humanoid' ? [klass] : null,   // archetype is Humanoid-only
    biology: [body],
    attunement: [bestMatch(text, ATT_KW, ATTUNEMENT_BASES, 'Physical')],
    subtypes: matchSubtypes(text),
    family, anatomy, weapons,
  };
}

/**
 * Infer typings: ask Claude if a key is available, else the heuristic. Always
 * resolves to a valid {class, biology (body type), attunement, subtypes}.
 */
export async function inferTypings(name, lore = '', description = '') {
  const fallback = inferTypingsHeuristic(name, lore, description);
  try {
    const prompt = `You are classifying a creature for a deckbuilding game.
- Class (archetype, used only for Humanoid-form creatures), one of: ${CLASS_BASES.join(', ')}.
- Body Type (its FORM), exactly one of: ${BODY_TYPES.join(', ')}. (Aberration = anything not clearly a person or an animal — formless, eldritch, plant, ooze, crystal, machine, elemental, construct.)
- Attunement (element), one of: ${ATTUNEMENT_BASES.join(', ')}.
- Subtypes (composition/affliction overlays, zero or more), any of: ${SUBTYPES.join(', ')}.

Creature name: "${name}"
Lore: ${lore || '(none)'}
Physical description: ${description || '(none)'}

Respond ONLY with JSON: {"class":"…","biology":"…","attunement":"…","subtypes":["…"]}.`;
    const json = await askClaudeJson(prompt, 250);
    if (json) {
      const pick = (v, valid, fb) => (valid.includes(v) ? [v] : fb);
      const subs = Array.isArray(json.subtypes) ? json.subtypes.filter((s) => SUBTYPES.includes(s)) : fallback.subtypes;
      const biology = pick(json.biology, BODY_TYPES, fallback.biology);
      const klass = pick(json.class, CLASS_BASES, fallback.class || ['Warrior']);
      // Re-derive the kit specifics (family/anatomy/weapons) for the CHOSEN body
      // type via the keyword heuristic — keeps them valid for the actual kit.
      const kit = inferTypingsHeuristic(`${biology[0]} ${klass[0]} ${name}`, lore, description);
      return {
        class: biology.includes('Humanoid') ? klass : null,   // archetype is Humanoid-only
        biology,
        attunement: pick(json.attunement, ATTUNEMENT_BASES, fallback.attunement),
        subtypes: subs,
        family: biology[0] === kit.biology[0] ? kit.family : null,
        anatomy: biology[0] === kit.biology[0] ? kit.anatomy : [],
        weapons: biology[0] === kit.biology[0] ? kit.weapons : [],
      };
    }
  } catch { /* fall through to heuristic */ }
  return fallback;
}
