// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/axisIcons — PLACEHOLDER ART for the 3-axis taxonomy.     ║
// ║ Source: game-icons.net (CC BY 3.0) via Iconify (`game-icons:*`), the   ║
// ║ free/open-source set already loaded on combat/app/index pages. These   ║
// ║ are stand-ins until AI-generated Variant-B art is baked in (the        ║
// ║ systems/art.js + artManifest.json pipeline swaps them out later).      ║
// ║ Every icon id here was validated against the Iconify API.             ║
// ║ UPDATE WHEN: axis bases change, or real art replaces a placeholder.   ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Attribution to surface in an About/credits screen. */
export const ART_CREDIT = 'Placeholder icons: game-icons.net (CC BY 3.0) via Iconify.';

/** Archetype (the "Class" axis) → game-icons id. */
export const ARCHETYPE_ICON = Object.freeze({
  Warrior: 'game-icons:spartan-helmet',
  Rogue: 'game-icons:hood',
  Mage: 'game-icons:pointy-hat',
  Warlock: 'game-icons:pentacle',
  Priest: 'game-icons:holy-symbol',
  Shaman: 'game-icons:totem-head',
  Ranger: 'game-icons:bow-arrow',
  Engineer: 'game-icons:gears',
});

/** Biology → game-icons id (also the creature's placeholder silhouette). */
export const BIOLOGY_ICON = Object.freeze({
  Beast: 'game-icons:paw-print',
  Humanoid: 'game-icons:person',
  Undead: 'game-icons:skeleton',
  Dragonkin: 'game-icons:dragon-head',
  Elemental: 'game-icons:whirlwind',
  Demon: 'game-icons:daemon-skull',
  Mechanical: 'game-icons:robot-golem',
  Giant: 'game-icons:giant',
  Aberration: 'game-icons:squid',
});

/** Attunement → game-icons id (the element's symbol; also imbue/damage flavor). */
export const ATTUNEMENT_ICON = Object.freeze({
  Physical: 'game-icons:fist',
  Fire: 'game-icons:flame',
  Frost: 'game-icons:snowflake-1',
  Nature: 'game-icons:sprout',
  Arcane: 'game-icons:magic-swirl',
  Shadow: 'game-icons:shadow-follower',
  Holy: 'game-icons:sun',
  Void: 'game-icons:vortex',
  Water: 'game-icons:water-drop',
  Air: 'game-icons:wind-slap',
  Stone: 'game-icons:stone-block',
  Energy: 'game-icons:lightning-arc',
  Mind: 'game-icons:brain',
});

/** Attunement → identity color (frames, tints, the creature-silhouette color). */
export const ATTUNEMENT_COLOR = Object.freeze({
  Physical: '#c9c4b0', Fire: '#ff5a3c', Frost: '#7ad7ff', Nature: '#6ad24a',
  Arcane: '#c08cff', Shadow: '#8a5bd6', Holy: '#ffe08a', Void: '#4b2e83',
  Water: '#3f8fff', Air: '#bfe3ff', Stone: '#b08d5a', Energy: '#ffe34d', Mind: '#ff7ad0',
});

const DEFAULT_CARD_ICON = 'game-icons:scroll-unfurled';
const DEFAULT_CREATURE_ICON = 'game-icons:paw-print';

/** Generic icon lookup for an axis base. axis: 'class'|'biology'|'attunement'. */
export function axisIcon(axis, base) {
  const map = axis === 'class' ? ARCHETYPE_ICON : axis === 'biology' ? BIOLOGY_ICON : ATTUNEMENT_ICON;
  return map[base] || DEFAULT_CREATURE_ICON;
}

/**
 * Placeholder icon for a card ("move art"). Priority: explicit `card.icon` / a
 * `game-icons:` `card.art` override → effect-shape heuristic (attacks use the
 * card's attunement element; block/heal/buff/debuff/draw get a fitting symbol).
 * Works for op-list CardSpec AND legacy flat-effect cards.
 */
export function cardIcon(card) {
  if (!card) return DEFAULT_CARD_ICON;
  if (typeof card.icon === 'string' && card.icon.startsWith('game-icons:')) return card.icon;
  if (typeof card.art === 'string' && card.art.startsWith('game-icons:')) return card.art;

  const att = ATTUNEMENT_ICON[card.attunement];
  const ops = Array.isArray(card.effects) ? card.effects : [];
  const flat = (!Array.isArray(card.effects) && card.effects) || {};
  const has = (op) => ops.some((o) => o.op === op);
  const dmg = has('damage') || flat.dmg != null;
  const block = has('block') || flat.block != null;
  const heal = has('heal') || flat.heal != null;

  if (card.type === 'power') return 'game-icons:upgrade';
  if (has('stance')) return 'game-icons:sword-brandish';
  if (dmg) return att || 'game-icons:crossed-swords';
  if (block) return 'game-icons:checked-shield';
  if (heal) return 'game-icons:healing';
  if (has('buff')) return 'game-icons:upgrade';
  if (has('debuff')) return 'game-icons:broken-shield';
  if (has('draw') || has('energy') || flat.draw || flat.energy) return 'game-icons:card-draw';
  return att || DEFAULT_CARD_ICON;
}

/** Pick the first base of an axis from a creature/fighter (new shape or legacy `types`). */
function first(c, key) {
  const v = c?.[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

/**
 * Placeholder silhouette for a creature: its primary BIOLOGY, else its primary
 * ATTUNEMENT, else its primary ARCHETYPE. (Legacy creatures fall back to `types`.)
 */
export function creatureIcon(c) {
  const bio = first(c, 'biology');
  const att = first(c, 'attunement') ?? (Array.isArray(c?.types) ? (c.types[0]?.type ?? c.types[0]) : null);
  const cls = first(c, 'class');
  return BIOLOGY_ICON[bio] || ATTUNEMENT_ICON[att] || ARCHETYPE_ICON[cls] || DEFAULT_CREATURE_ICON;
}

/** Identity color for a creature (its primary attunement), for tinting the silhouette. */
export function creatureColor(c) {
  const att = first(c, 'attunement') ?? (Array.isArray(c?.types) ? (c.types[0]?.type ?? c.types[0]) : null);
  return ATTUNEMENT_COLOR[att] || '#c9a66b';
}
