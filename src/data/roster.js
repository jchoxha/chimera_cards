// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/roster — the demo's pickable creature roster. Each entry   ║
// ║ is a (archetype, biology, attunement) triple with flavor; `buildRoster` ║
// ║ runs each through the generator (engine/content/generate) using the     ║
// ║ archetype's card pool. Attunements are LEGAL for their archetype        ║
// ║ (synthesis CLASS_ATTUNEMENT_RULES + universals Energy/Mind/Void).        ║
// ║ UPDATE WHEN: roster creatures change, or new archetype kits are added.  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { makeCreature } from '../engine/content/generate.js';

/**
 * Demo roster — spans all 8 base archetypes, varied biology + (legal) attunement.
 * `baseHp` pre-biology; the generator applies the biology HP multiplier.
 */
export const ROSTER = Object.freeze([
  { id: 'ironhide',    name: 'Ironhide',    class: 'Warrior',  biology: ['Giant'],      attunement: ['Physical'],        baseHp: 60, blurb: 'A mountain of a brawler — colossal HP, immovable.' },
  { id: 'voltfang',    name: 'Voltfang',    class: 'Warrior',  biology: ['Beast'],      attunement: ['Physical', 'Energy'], baseHp: 55, blurb: 'A feral skirmisher whose strikes shock and tax the foe.' },
  { id: 'nightveil',   name: 'Nightveil',   class: 'Rogue',    biology: ['Humanoid'],   attunement: ['Shadow'],          baseHp: 52, blurb: 'A duelist who strikes from the dark and chains the kill.' },
  { id: 'emberwisp',   name: 'Emberwisp',   class: 'Mage',     biology: ['Elemental'],  attunement: ['Fire'],            baseHp: 50, blurb: 'A living flame — fragile, but its spells burn and detonate.' },
  { id: 'frostmind',   name: 'Frostmind',   class: 'Mage',     biology: ['Humanoid'],   attunement: ['Frost'],           baseHp: 52, blurb: 'A frost-caster who chills and locks down the battlefield.' },
  { id: 'grimsoul',    name: 'Grimsoul',    class: 'Warlock',  biology: ['Undead'],     attunement: ['Shadow'],          baseHp: 56, blurb: "An undying caster who pays HP it doesn't fear losing." },
  { id: 'dawnkeeper',  name: 'Dawnkeeper',  class: 'Priest',   biology: ['Humanoid'],   attunement: ['Holy'],            baseHp: 55, blurb: 'A holy protector — heals the line and smites the wicked.' },
  { id: 'thornroot',   name: 'Thornroot',   class: 'Shaman',   biology: ['Beast'],      attunement: ['Nature'],          baseHp: 55, blurb: 'A spirit-beast that festers poison and grows its totems.' },
  { id: 'tidecaller',  name: 'Tidecaller',  class: 'Shaman',   biology: ['Elemental'],  attunement: ['Water'],           baseHp: 54, blurb: 'A water-shaman who soaks foes for devastating follow-ups.' },
  { id: 'wildeye',     name: 'Wildeye',     class: 'Ranger',   biology: ['Beast'],      attunement: ['Nature'],          baseHp: 53, blurb: 'A hunter who marks its prey and snipes past the front line.' },
  { id: 'cogwright',   name: 'Cogwright',   class: 'Engineer', biology: ['Mechanical'], attunement: ['Stone'],           baseHp: 58, blurb: 'A gadgeteer who builds an unbreakable wall of Block.' },
  { id: 'maw',         name: 'Maw',         class: 'Warrior',  biology: ['Aberration'], attunement: ['Void'],            baseHp: 54, blurb: 'An eldritch horror whose blows rot armor, buffs, and powers.' },
]);

/**
 * Build the playable roster creatures. `poolsByClass` maps archetype → its CardSpec
 * pool (e.g. { Warrior: [...warrior.json cards] }). Archetypes without an authored
 * kit fall back to the Warrior pool (re-skinned to the attunement) until their kit
 * is written — a temporary stand-in during the demo build.
 * @param {Record<string, Object[]>} poolsByClass
 * @param {Object[]} [fallbackPool]  used when an archetype has no authored kit
 * @returns {Object[]} run-party-ready creatures
 */
export function buildRoster(poolsByClass = {}, fallbackPool = []) {
  return ROSTER.map((r) => {
    const pool = poolsByClass[r.class] || fallbackPool;
    const c = makeCreature({ ...r, pool });
    c.blurb = r.blurb;
    return c;
  });
}
