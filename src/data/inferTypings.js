// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/inferTypings — pick a creature's matrix typings (Class /    ║
// ║ Biology / Attunement) from its NAME + LORE + physical DESCRIPTION. Tries  ║
// ║ the Claude connector when a key is present, else a keyword heuristic so   ║
// ║ it always works offline. Used by the custom-creature creator when the    ║
// ║ player lets "AI decide" the typings.                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import { askClaudeJson } from '../ai/claude.js';
import { CLASS_BASES, BIOLOGY_BASES, ATTUNEMENT_BASES } from './synthesis.js';

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
const BIO_KW = {
  Beast: ['beast', 'wolf', 'lion', 'bear', 'tiger', 'fox', 'cat', 'dog', 'animal', 'fang', 'claw', 'paw', 'feral', 'predator', 'hound', 'serpent-less', 'boar', 'ram', 'stag'],
  Humanoid: ['human', 'man', 'woman', 'person', 'folk', 'soldier', 'mortal', 'elf', 'dwarf', 'humanoid', 'figure', 'cloaked'],
  Undead: ['undead', 'skeleton', 'zombie', 'ghost', 'lich', 'wraith', 'bone', 'grave', 'corpse', 'death', 'revenant', 'phantom', 'spectre', 'spectral'],
  Dragonkin: ['dragon', 'drake', 'wyrm', 'lizard', 'serpent', 'reptile', 'scale', 'wyvern', 'saurian', 'draconic'],
  Elemental: ['elemental', 'living flame', 'embodiment', 'essence', 'primordial', 'wisp', 'sentient', 'made of'],
  Demon: ['demon', 'devil', 'fiend', 'imp', 'hell', 'infernal', 'horned'],
  Mechanical: ['machine', 'robot', 'mech', 'gear', 'automaton', 'clockwork', 'steam', 'brass', 'metal', 'iron', 'cog'],
  Giant: ['giant', 'titan', 'colossus', 'behemoth', 'huge', 'massive', 'towering', 'mountainous', 'gargantuan'],
  Aberration: ['aberration', 'eldritch', 'horror', 'tentacle', 'eye', 'alien', 'mutant', 'abomination', 'cosmic', 'writhing', 'void'],
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
  // deterministic fallback from the text so it isn't always the same default
  if (valid && valid.length) {
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return valid[h % valid.length];
  }
  return fallback;
}

/** Heuristic typings from name + lore + description (always available, offline). */
export function inferTypingsHeuristic(name, lore = '', description = '') {
  const text = `${name} ${lore} ${description}`.toLowerCase();
  return {
    class: [bestMatch(text, CLASS_KW, CLASS_BASES, 'Warrior')],
    biology: [bestMatch(text, BIO_KW, BIOLOGY_BASES, 'Humanoid')],
    attunement: [bestMatch(text, ATT_KW, ATTUNEMENT_BASES, 'Physical')],
  };
}

/**
 * Infer typings: ask Claude if a key is available, else the heuristic. Always
 * resolves to a valid {class,biology,attunement} (1 base each).
 */
export async function inferTypings(name, lore = '', description = '') {
  const fallback = inferTypingsHeuristic(name, lore, description);
  try {
    const prompt = `You are classifying a creature for a deckbuilding game with three axes.
Class (archetype), one of: ${CLASS_BASES.join(', ')}.
Biology (body), one of: ${BIOLOGY_BASES.join(', ')}.
Attunement (element), one of: ${ATTUNEMENT_BASES.join(', ')}.

Creature name: "${name}"
Lore: ${lore || '(none)'}
Physical description: ${description || '(none)'}

Pick the single best value for each axis. Respond ONLY with JSON: {"class":"…","biology":"…","attunement":"…"}.`;
    const json = await askClaudeJson(prompt, 200);
    if (json) {
      const pick = (v, valid, fb) => (valid.includes(v) ? [v] : fb);
      return {
        class: pick(json.class, CLASS_BASES, fallback.class),
        biology: pick(json.biology, BIOLOGY_BASES, fallback.biology),
        attunement: pick(json.attunement, ATTUNEMENT_BASES, fallback.attunement),
      };
    }
  } catch { /* fall through to heuristic */ }
  return fallback;
}
