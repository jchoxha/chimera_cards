// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/artPool — PLACEHOLDER illustrated art for cards (moves)   ║
// ║ and creatures, mapped BY CATEGORY (we have no per-card art yet). Real   ║
// ║ pixel-art sprites bundled in public/art/ (see public/art/CREDITS.txt):  ║
// ║   • items/  = "496 Pixel Art Icons" by 7Soul1 (CC0) — spells/weapons.   ║
// ║   • beings/ = CodeSpree "RPG Beings" (CC BY-SA 4.0) — creatures.        ║
// ║ Resolvers pick a deterministic variant per card/creature id (stable but ║
// ║ varied). AI Variant-B art replaces these later via systems/art.js.     ║
// ║ UPDATE WHEN: the bundled packs change, or category→art mapping changes. ║
// ╚══════════════════════════════════════════════════════════════════╝

import manifest from './placeholderArt.json';
import genCards from './cardGenArt.json';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const ITEMS = manifest.items || [];
const BEINGS = manifest.beings || [];
const GEN_CARDS = new Set(genCards || []);

const itemUrl = (f) => `${BASE}art/items/${f}`;
const beingUrl = (f) => `${BASE}art/beings/${f}`;

/** Stable FNV-1a hash → deterministic variant choice per id. */
function hash(s) {
  let h = 2166136261; const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick(list, seed) { return list.length ? list[hash(seed) % list.length] : null; }
function byPrefix(prefix) {
  if (!prefix) return [];
  const p = prefix.toLowerCase();
  return ITEMS.filter((f) => f.toLowerCase().startsWith(p));
}
function firstNonEmpty(...prefixes) {
  for (const p of prefixes) { const l = byPrefix(p); if (l.length) return l; }
  return [];
}

// Attunement → spell-icon family in the 496 set (the card's damage element).
const ATT_SPELL = {
  Physical: 'S_Physic', Fire: 'S_Fire', Frost: 'S_Ice', Nature: 'S_Poison', Arcane: 'S_Magic',
  Shadow: 'S_Shadow', Holy: 'S_Holy', Void: 'S_Shadow', Water: 'S_Water', Air: 'S_Wind',
  Stone: 'S_Earth', Energy: 'S_Thunder', Mind: 'S_Magic',
};
// Archetype → weapon family (physical attacks use a fitting weapon).
const CLASS_WEAPON = {
  Warrior: 'W_Sword', Rogue: 'W_Dagger', Mage: 'W_Staff', Warlock: 'W_Book',
  Priest: 'W_Mace', Shaman: 'W_Staff', Ranger: 'W_Bow', Engineer: 'W_Gun',
};

/**
 * Placeholder illustration URL for a card ("move art"), or null → caller falls
 * back to the axis icon. Explicit `card.art` URL/path overrides.
 */
export function cardArt(card) {
  if (!card) return null;
  if (typeof card.art === 'string' && /^(https?:|\/)/.test(card.art)) return card.art;
  // Prefer generated Variant-B ability art (scripts/gen_cards.py) when it exists.
  const baseId = card.id && String(card.id).replace(/#\d+$/, '');
  if (baseId && GEN_CARDS.has(baseId)) return `${BASE}art/gen/cards/${baseId}.png`;

  const ops = Array.isArray(card.effects) ? card.effects : [];
  const flat = (!Array.isArray(card.effects) && card.effects) || {};
  const has = (op) => ops.some((o) => o.op === op);
  const att = card.attunement;
  const cls = Array.isArray(card.class) ? card.class[0] : card.class;

  let group = [];
  if (card.type === 'power') group = firstNonEmpty('S_Magic', 'W_Book');
  else if (has('stance')) group = firstNonEmpty('S_Buff');
  else if (has('damage') || flat.dmg != null) {
    if (att && att !== 'Physical') group = byPrefix(ATT_SPELL[att]);   // elemental spell art
    if (!group.length) group = firstNonEmpty(CLASS_WEAPON[cls] || 'W_Sword', ATT_SPELL[att] || 'S_Physic'); // physical → weapon
  } else if (has('block') || flat.block != null) group = firstNonEmpty('A_Armour', 'A_Armor', 'C_Elm', 'C_Hat');
  else if (has('heal') || flat.heal != null) group = firstNonEmpty('P_Medicine', 'P_Green', 'S_Holy');
  else if (has('buff')) group = firstNonEmpty('S_Buff');
  else if (has('debuff')) group = firstNonEmpty(ATT_SPELL[att], 'S_Poison', 'S_Shadow');
  else if (has('draw') || has('energy') || flat.draw || flat.energy) group = firstNonEmpty('I_Scroll', 'I_Book');

  if (!group.length) group = byPrefix(ATT_SPELL[att]);
  if (!group.length) group = ITEMS;
  const f = pick(group, card.id || card.name);
  return f ? itemUrl(f) : null;
}

// Biology → being-name keywords (the pack is mostly animals; best-effort buckets).
const BIO_KEYWORDS = {
  Beast: ['bear', 'wolf', 'fox', 'hare', 'bat', 'dog', 'cat', 'boar', 'parrot', 'rat', 'deer', 'ram', 'mouse', 'snail', 'crab', 'fish', 'eel', 'spider', 'ant', 'bee'],
  Aberration: ['coral', 'tentacle', 'eye', 'gossip', 'squid', 'slime', 'blob', 'geo', 'grab', 'grub'],
  Elemental: ['salamander', 'electro', 'aurora', 'spark', 'fire', 'flame', 'ice', 'storm', 'gust', 'circow', 'equestion'],
  Dragonkin: ['dragon', 'drake', 'wyrm', 'lizard', 'salamander', 'serpent', 'snake', 'chameleon'],
  Undead: ['skull', 'bone', 'ghost', 'zombie', 'skeleton', 'spirit'],
  Demon: ['demon', 'imp', 'devil', 'fiend'],
  Mechanical: ['mech', 'robot', 'golem', 'bot'],
  Giant: ['giant', 'troll', 'ogre', 'whale'],
  Humanoid: ['man', 'person', 'knight', 'goblin', 'orc'],
};

/**
 * Placeholder creature silhouette URL, or null → caller falls back to the
 * biology/attunement icon. Picks a being by biology keywords (else any), stable
 * per creature id.
 */
export function creatureArt(creature) {
  const bio = Array.isArray(creature?.biology) ? creature.biology[0] : null;
  const kws = bio && BIO_KEYWORDS[bio];
  let group = kws ? BEINGS.filter((f) => kws.some((k) => f.toLowerCase().includes(k))) : [];
  if (!group.length) group = BEINGS;
  const f = pick(group, `${creature?.id || creature?.name || 'x'}|${bio || ''}`);
  return f ? beingUrl(f) : null;
}

export const ART_COUNTS = { items: ITEMS.length, beings: BEINGS.length };
