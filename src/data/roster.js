// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/roster — the demo's pickable creature roster. Each entry   ║
// ║ is a (archetype, biology, attunement) triple with flavor; `buildRoster` ║
// ║ runs each through the generator (engine/content/generate) using the     ║
// ║ archetype's card pool. Attunements are LEGAL for their archetype        ║
// ║ (synthesis CLASS_ATTUNEMENT_RULES + universals Energy/Mind/Void).        ║
// ║ UPDATE WHEN: roster creatures change, or new archetype kits are added.  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { makeCreature } from '../engine/content/generate.js';
import CREATURE_ART from './creatureArt.json';

// GH-Pages base + which roster ids have an AI portrait baked in public/art/gen/.
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const HAS_ART = new Set(CREATURE_ART);

/**
 * Demo roster — spans all 8 base archetypes, varied biology + (legal) attunement.
 * `baseHp` pre-biology; the generator applies the biology HP multiplier.
 */
export const ROSTER = Object.freeze([
  { id: 'ironhide',    name: 'Ironhide',    class: 'Warrior',  biology: ['Humanoid'],   attunement: ['Physical'],        baseHp: 60, size: 'large', subtypes: ['Giant'], weapons: ['Hammer', 'Shield'], blurb: 'A mountain of a brawler — colossal HP, immovable.' },
  { id: 'voltfang',    name: 'Voltfang',    class: 'Warrior',  biology: ['Beast'],      attunement: ['Physical', 'Energy'], baseHp: 55, family: 'Mammalian', anatomy: ['Teeth', 'Claws', 'Roar'], blurb: 'A feral skirmisher whose strikes shock and tax the foe.' },
  { id: 'nightveil',   name: 'Nightveil',   class: 'Rogue',    biology: ['Humanoid'],   attunement: ['Shadow'],          baseHp: 52, weapons: ['Dagger', 'Sword'], blurb: 'A duelist who strikes from the dark and chains the kill.' },
  { id: 'emberwisp',   name: 'Emberwisp',   class: 'Mage',     biology: ['Aberration'], attunement: ['Fire'],            baseHp: 50, size: 'small', subtypes: ['Elemental'], family: 'Formless', anatomy: ['Miasma', 'Eye'], blurb: 'A living flame — fragile, but its spells burn and detonate.' },
  { id: 'frostmind',   name: 'Frostmind',   class: 'Mage',     biology: ['Humanoid'],   attunement: ['Frost'],           baseHp: 52, weapons: ['Staff', 'Wand'], blurb: 'A frost-caster who chills and locks down the battlefield.' },
  { id: 'grimsoul',    name: 'Grimsoul',    class: 'Warlock',  biology: ['Humanoid'],   attunement: ['Shadow'],          baseHp: 56, subtypes: ['Undead'], weapons: ['Staff', 'Dagger'], blurb: "An undying caster who pays HP it doesn't fear losing." },
  { id: 'dawnkeeper',  name: 'Dawnkeeper',  class: 'Priest',   biology: ['Humanoid'],   attunement: ['Holy'],            baseHp: 55, weapons: ['Mace', 'Shield'], blurb: 'A holy protector — heals the line and smites the wicked.' },
  { id: 'thornroot',   name: 'Thornroot',   class: 'Shaman',   biology: ['Beast'],      attunement: ['Nature'],          baseHp: 55, family: 'Reptilian', anatomy: ['Venom', 'Hide', 'Tail'], blurb: 'A spirit-beast that festers poison and grows its totems.' },
  { id: 'tidecaller',  name: 'Tidecaller',  class: 'Shaman',   biology: ['Humanoid'],   attunement: ['Water'],           baseHp: 54, subtypes: ['Elemental'], weapons: ['Staff', 'Spear'], blurb: 'A water-shaman who soaks foes for devastating follow-ups.' },
  { id: 'wildeye',     name: 'Wildeye',     class: 'Ranger',   biology: ['Beast'],      attunement: ['Nature'],          baseHp: 53, family: 'Avian', anatomy: ['Beak', 'Wings', 'Claws'], blurb: 'A hunter who marks its prey and snipes past the front line.' },
  { id: 'cogwright',   name: 'Cogwright',   class: 'Engineer', biology: ['Humanoid'],   attunement: ['Stone'],           baseHp: 58, subtypes: ['Mechanical'], weapons: ['Wand', 'Shield'], blurb: 'A gadgeteer who builds an unbreakable wall of Block.' },
  { id: 'maw',         name: 'Maw',         class: 'Warrior',  biology: ['Aberration'], attunement: ['Void'],            baseHp: 54, family: 'Eldritch', anatomy: ['Tentacle', 'Maw', 'Eye'], blurb: 'An eldritch horror whose blows rot armor, buffs, and powers.' },
]);

/**
 * Build the playable roster creatures. `poolsByClass` maps archetype → its CardSpec
 * pool (e.g. { Warrior: [...warrior.json cards] }). Archetypes without an authored
 * kit fall back to the Warrior pool (re-skinned to the attunement) until their kit
 * is written — a temporary stand-in during the demo build.
 * @param {Record<string, Object[]>} poolsByClass
 * @param {Object[]} [fallbackPool]  used when an archetype has no authored kit
 * @param {(entry:Object)=>Object[]} [poolResolver]  optional biology-aware pool
 *   builder (e.g. Beast → its kit pool). Injected from the app layer so roster.js
 *   stays JSON-free / node-testable. When omitted, falls back to the class pool.
 * @returns {Object[]} run-party-ready creatures
 */
export function buildRoster(poolsByClass = {}, fallbackPool = [], poolResolver = null) {
  return ROSTER.map((r) => {
    const pool = poolResolver ? poolResolver(r) : (poolsByClass[r.class] || fallbackPool);
    const c = makeCreature({ ...r, pool });   // makeCreature applies r.size (form) to HP/Might + meta.form
    c.blurb = r.blurb;
    // AI portrait (only if baked — else the UI falls back to the biology icon).
    c.portrait = HAS_ART.has(r.id) ? `${BASE}art/gen/${r.id}.png` : null;
    c.meta = { ...c.meta, portrait: c.portrait };   // keep the form set by makeCreature
    return c;
  });
}

/**
 * A passive Target Dummy as a selectable creature — used as the default practice
 * opponent. Big HP, an EMPTY deck (does nothing on its turn). Not part of the
 * playable roster; offered only when choosing practice opponents.
 */
export function buildDummyCreature() {
  const portrait = `${BASE}art/gen/training-dummy.png`;
  return {
    id: 'dummy', name: 'Target Dummy',
    class: ['Construct'], biology: ['Mechanical'], attunement: ['Physical'],
    stats: { might: 1, guard: 5, focus: 1, resolve: 5, speed: 0 },
    maxHp: 250, hp: 250, deck: [], signatureCards: [],
    blurb: 'A practice dummy — soaks hits and barely fights back.',
    portrait, meta: { portrait },
  };
}
