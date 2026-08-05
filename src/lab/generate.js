// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/generate — DYNAMIC CREATURE GENERATION for the Lab. Turns a   ║
// ║ set of wheel spins (and/or a text prompt) into a real, playable creature. ║
// ║                                                                           ║
// ║ Two sources of truth, mixable — that's the point of the Lab:              ║
// ║   WHEEL  — rarity / form / evolutions / attunement / body come from the   ║
// ║            weighted wheels (engine/content/wheels.js), kit + factors are  ║
// ║            rolled from the body type's own vocabulary.                    ║
// ║   PROMPT — attunement / body / kit / factors are read out of free text by ║
// ║            `inferTypingsHeuristic` (fully OFFLINE, no API key).           ║
// ║   MIXED  — the prompt sets IDENTITY, the wheels set FATE (rarity/form/    ║
// ║            evolutions). This is the interesting one.                      ║
// ║                                                                           ║
// ║ Lives in the UI layer (not engine/) because it imports the JSON kit       ║
// ║ vocabularies, which only Vite can resolve. The odds/maths are in          ║
// ║ engine/content/wheels.js so they stay node-testable.                      ║
// ║ UPDATE WHEN: a new body type / kit axis / generation source is added.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { WHEELS, spinWheel, rarityProfile, evolutionLine } from '../engine/content/wheels.js';
import { makeCreature } from '../engine/content/generate.js';
import { basePoolFor } from '../app/pools.js';
import { inferTypingsHeuristic } from '../data/inferTypings.js';
import { BEAST_FAMILIES, anatomyForFamily } from '../engine/cards/beastPool.js';
import { ABERRATION_FAMILIES, anatomyForAberrationFamily } from '../engine/cards/aberrationPool.js';
import { weaponsForArchetype } from '../engine/cards/humanoidPool.js';
import { CLASS_BASES, SUBTYPES, legalAttunements, attunementComboLegal } from '../data/synthesis.js';

const pick = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];
const pickN = (list, n, rng = Math.random) => {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length) out.push(...pool.splice(Math.floor(rng() * pool.length), 1));
  return out;
};

// ── name generation ────────────────────────────────────────────────────────

const NAME_PREFIX = {
  Physical: ['Iron', 'Stone', 'Brute', 'Gore'], Fire: ['Ember', 'Cinder', 'Pyre', 'Ash'],
  Frost: ['Frost', 'Rime', 'Glacier', 'Chill'], Nature: ['Thorn', 'Bramble', 'Moss', 'Verdant'],
  Arcane: ['Rune', 'Sigil', 'Astral', 'Mana'], Shadow: ['Night', 'Umbra', 'Dusk', 'Grim'],
  Holy: ['Dawn', 'Sanct', 'Halo', 'Gleam'], Void: ['Null', 'Hollow', 'Abyss', 'Rift'],
  Water: ['Tide', 'Brine', 'Mire', 'Wave'], Air: ['Gale', 'Zephyr', 'Cirrus', 'Squall'],
  Stone: ['Granite', 'Basalt', 'Crag', 'Slate'], Energy: ['Volt', 'Arc', 'Surge', 'Spark'],
  Mind: ['Psy', 'Whisper', 'Dream', 'Echo'],
};
const NAME_SUFFIX = {
  Beast: ['fang', 'claw', 'maw', 'hide', 'howl', 'mane'],
  Humanoid: ['blade', 'guard', 'warden', 'seeker', 'binder', 'knight'],
  Aberration: ['wisp', 'thing', 'spawn', 'coil', 'husk', 'bloom'],
};

/** Family-specific suffixes so the name matches the creature — a serpent should
 *  not end up called "-mane". Falls back to the body-type set. */
const FAMILY_SUFFIX = {
  // Beast
  Mammalian: ['fang', 'claw', 'mane', 'howl'], Reptilian: ['scale', 'coil', 'fang', 'tail'],
  Avian: ['beak', 'wing', 'talon', 'plume'], Piscine: ['fin', 'gill', 'tide', 'scale'],
  Insectoid: ['sting', 'pincer', 'shell', 'swarm'], Amphibian: ['croak', 'mire', 'spawn'],
  Draconic: ['wyrm', 'drake', 'wing', 'flame'],
  // Aberration
  Eldritch: ['whisper', 'eye', 'horror'], Construct: ['cog', 'frame', 'core'],
  Ooze: ['sludge', 'blob', 'ooze'], Flora: ['bloom', 'root', 'vine'],
  Crystalline: ['shard', 'prism', 'facet'], Formless: ['wisp', 'drift', 'haze'],
  Parasitic: ['leech', 'hook', 'brood'], Abyssal: ['depth', 'trench', 'maw'],
  Fungal: ['spore', 'cap', 'bloom'],
};

/** Coin a name from the creature's own identity (element prefix + kit suffix). */
export function coinName(attunement, body, family = null, rng = Math.random) {
  const p = pick(NAME_PREFIX[attunement] ?? NAME_PREFIX.Physical, rng);
  const s = pick(FAMILY_SUFFIX[family] ?? NAME_SUFFIX[body] ?? NAME_SUFFIX.Beast, rng);
  return p + s;
}

/** Pull a plausible NAME out of a free-text prompt, else coin one. */
function nameFromPrompt(prompt, attunement, body, family, rng) {
  const words = String(prompt || '').trim().split(/\s+/).filter((w) => /^[a-z]/i.test(w));
  // A capitalised word that isn't the first is probably a proper name.
  const proper = words.find((w, i) => i > 0 && /^[A-Z][a-z]{2,}$/.test(w));
  if (proper) return proper;
  return coinName(attunement, body, family, rng);
}

// ── identity: rolled or read from a prompt ─────────────────────────────────

/** Roll a complete kit + factor set for a body type, sized by the rarity budget. */
function rollIdentity(body, factorCount, rng) {
  if (body === 'Beast') {
    const family = pick(BEAST_FAMILIES, rng);
    return { class: null, family, anatomy: pickN(anatomyForFamily(family), factorCount, rng), weapons: null };
  }
  if (body === 'Aberration') {
    const family = pick(ABERRATION_FAMILIES, rng);
    return { class: null, family, anatomy: pickN(anatomyForAberrationFamily(family), factorCount, rng), weapons: null };
  }
  const klass = pick(CLASS_BASES, rng);
  return { class: [klass], family: null, anatomy: null, weapons: pickN(weaponsForArchetype(klass), Math.min(2, factorCount), rng) };
}

/**
 * Generate a creature.
 * @param {{
 *   mode?: 'wheel'|'prompt'|'mixed',
 *   prompt?: string,
 *   spins?: Record<string,{value:any}>,   pre-rolled wheel results (the UI animates them)
 *   rng?: () => number,
 * }} opts
 * @returns {object} a creature (makeCreature shape) + `gen` metadata
 */
export function generateCreature({ mode = 'mixed', prompt = '', spins = {}, rng = Math.random } = {}) {
  const spun = (key) => spins[key]?.value ?? spinWheel(WHEELS[key], rng).value;

  // FATE — always from the wheels.
  const rarity = spun('rarity');
  const form = spun('form');
  const stages = spun('evolutions');
  const profile = rarityProfile(rarity);

  // IDENTITY — from the prompt when there is one, else rolled.
  const usePrompt = mode !== 'wheel' && String(prompt).trim().length > 0;
  let identity, attunement, subtypes, body;

  if (usePrompt) {
    const inferred = inferTypingsHeuristic(prompt, '', prompt);
    body = inferred.biology?.[0] ?? 'Beast';
    attunement = inferred.attunement?.length ? inferred.attunement : [spun('attunement')];
    identity = {
      class: inferred.class, family: inferred.family,
      anatomy: inferred.anatomy?.length ? inferred.anatomy : null,
      weapons: inferred.weapons?.length ? inferred.weapons : null,
    };
    subtypes = inferred.subtypes?.length ? inferred.subtypes : pickN(SUBTYPES, profile.subtypes, rng);
  } else {
    body = spun('body');
    attunement = [spun('attunement')];
    identity = rollIdentity(body, profile.factors, rng);
    subtypes = pickN(SUBTYPES, profile.subtypes, rng);
  }

  // A Humanoid archetype constrains which elements are legal — repair, don't fail.
  const klass = identity.class?.[0] ?? null;
  if (klass && !attunementComboLegal([klass], attunement)) {
    const legal = legalAttunements([klass]);
    if (legal.length) attunement = [legal[0]];
  }

  const name = usePrompt
    ? nameFromPrompt(prompt, attunement[0], body, identity.family, rng)
    : coinName(attunement[0], body, identity.family, rng);
  const line = evolutionLine(stages, form);

  const pool = basePoolFor({
    klass, biology: [body], family: identity.family,
    anatomy: identity.anatomy, weapons: identity.weapons, subtypes,
  });

  const c = makeCreature({
    id: `gen_${Math.random().toString(36).slice(2, 9)}`,
    name,
    class: identity.class, biology: [body], attunement,
    family: identity.family, anatomy: identity.anatomy, weapons: identity.weapons,
    subtypes: subtypes.length ? subtypes : null,
    size: form, baseHp: profile.baseHp, pool,
  });

  c.rarity = rarity;
  c.gen = { mode, prompt: usePrompt ? prompt : '', rarity, form, ...line, profile, poolSize: pool.length };
  return c;
}

/** The pool a creature would draw from — used by the Fuse tab to feed fuseCreatures. */
export function poolForCreature(c) {
  return basePoolFor({
    klass: c?.class?.[0], biology: c?.biology, family: c?.family,
    anatomy: c?.anatomy, weapons: c?.weapons, subtypes: c?.subtypes,
  });
}
