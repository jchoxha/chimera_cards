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
  Beast: ['beast', 'wolf', 'lion', 'bear', 'tiger', 'fox', 'cat', 'dog', 'animal', 'fang', 'claw', 'paw', 'feral', 'predator', 'hound', 'boar', 'ram', 'stag', 'dragon', 'drake', 'wyrm', 'lizard', 'serpent', 'reptile', 'bird', 'fish', 'insect'],
  Aberration: ['aberration', 'eldritch', 'horror', 'tentacle', 'eye', 'alien', 'mutant', 'abomination', 'cosmic', 'writhing', 'ooze', 'slime', 'crystal', 'plant', 'fungus', 'flora', 'formless', 'cloud', 'construct', 'golem', 'wisp', 'essence', 'elemental', 'living flame'],
};
// DESCRIPTIVE SUBTYPES — composition/affliction overlays (0–N).
const SUBTYPE_KW = {
  Mechanical: ['machine', 'robot', 'mech', 'gear', 'automaton', 'clockwork', 'steam', 'brass', 'metal', 'iron', 'cog', 'cyborg', 'augmented'],
  Elemental: ['elemental', 'living flame', 'embodiment', 'essence', 'primordial', 'made of', 'infused', 'attuned'],
  Giant: ['giant', 'titan', 'colossus', 'behemoth', 'huge', 'massive', 'towering', 'mountainous', 'gargantuan'],
  Demonic: ['demon', 'demonic', 'devil', 'fiend', 'imp', 'hell', 'infernal', 'fel', 'possessed', 'corrupted'],
  Undead: ['undead', 'skeleton', 'zombie', 'ghost', 'lich', 'wraith', 'bone', 'grave', 'corpse', 'revenant', 'phantom', 'rotting'],
  Hallowed: ['hallowed', 'blessed', 'sacred', 'celestial', 'angelic', 'divine'],
  Feral: ['feral', 'savage', 'rabid', 'wild', 'frenzied', 'berserk'],
  Ancient: ['ancient', 'elder', 'primeval', 'eons', 'timeless', 'aged'],
  Swarm: ['swarm', 'colony', 'hive', 'myriad', 'countless', 'horde'],
  Cursed: ['cursed', 'plagued', 'hexed', 'doomed', 'blighted'],
  Spectral: ['spectral', 'ghostly', 'incorporeal', 'ethereal', 'phantasmal'],
};
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
    for (const kw of kws) if (text.includes(kw)) s += 1;
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
    .filter(([, kws]) => kws.some((kw) => text.includes(kw)))
    .map(([val]) => val)
    .filter((s) => SUBTYPES.includes(s));
}

/** Heuristic typings from name + lore + description (always available, offline). */
export function inferTypingsHeuristic(name, lore = '', description = '') {
  const text = `${name} ${lore} ${description}`.toLowerCase();
  return {
    class: [bestMatch(text, CLASS_KW, CLASS_BASES, 'Warrior')],
    biology: [bestMatch(text, BODY_KW, BODY_TYPES, 'Humanoid')],
    attunement: [bestMatch(text, ATT_KW, ATTUNEMENT_BASES, 'Physical')],
    subtypes: matchSubtypes(text),
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
      return {
        class: pick(json.class, CLASS_BASES, fallback.class),
        biology: pick(json.biology, BODY_TYPES, fallback.biology),
        attunement: pick(json.attunement, ATTUNEMENT_BASES, fallback.attunement),
        subtypes: subs,
      };
    }
  } catch { /* fall through to heuristic */ }
  return fallback;
}
