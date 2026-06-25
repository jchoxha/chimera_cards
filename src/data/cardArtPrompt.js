// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/cardArtPrompt — every card's generative-AI art brief.     ║
// ║ Each card carries an `artPrompt` (a scene description). `cardArtScene`   ║
// ║ returns it (or derives a fallback from the card's data), and            ║
// ║ `cardArtPrompt` appends the locked Variant-B STYLE block so the whole    ║
// ║ string is ready to feed straight to the image generator (see            ║
// ║ scripts/gen_cards.py + docs/art-pipeline.md).                           ║
// ║ UPDATE WHEN: the art style locks change, or the effect→scene vocab does. ║
// ╚══════════════════════════════════════════════════════════════════╝

/** The locked "Variant-B" raster style block, minus the creature-only clause. */
export const CARD_ART_STYLE =
  'Flat 2D hand-drawn cartoon illustration in the spirit of Adventure Time / ' +
  'Pendleton Ward: simple bold shapes, thick confident black outlines, flat ' +
  'matte color fills, minimal shading, genuinely charming and characterful. ' +
  'BUT with the dramatic seriousness of Yu-Gi-Oh trading-card art: an intense, ' +
  'dynamic action, moody dramatic lighting, an epic elemental backdrop. ' +
  'Absolutely NOT Disney, NOT Pixar, NOT 3D, NOT glossy, NOT soft, NOT overly ' +
  'cute. Centered subject filling the frame. No text, no card frame, no border, ' +
  'no UI — only the illustration (the card frame is drawn separately). Square ' +
  '1:1 composition.';

const first = (v) => (Array.isArray(v) ? v[0] : v);

/** Element → palette + atmosphere phrase. All 13 attunements (cards use a subset today). */
const ELEMENT_FLAVOR = {
  Physical: 'raw kinetic force — dust, motion lines and steel-grey impact',
  Fire: 'roaring orange-and-crimson flame, flying embers and heat-shimmer',
  Frost: 'jagged pale-blue ice, biting frost and drifting snow',
  Nature: 'verdant vines and broad leaves, creeping thorns and toxic green spores',
  Arcane: 'shimmering violet arcane energy, glowing runes and geometric sigils',
  Shadow: 'swirling inky-black shadow shot through with wisps of purple gloom',
  Holy: 'radiant golden light, warm divine glow and soft haloes',
  Void: 'a devouring black void of fractured purple space and cold stars',
  Water: 'swirling translucent blue water, curling waves and spray',
  Air: 'rushing white wind, sweeping gusts and scattered feathers',
  Stone: 'heavy grey stone and shattering rubble, earthen weight',
  Energy: 'crackling neon-blue lightning arcs and electric sparks',
  Mind: 'rippling pink-violet psychic waves and warped, hypnotic air',
};

/** Archetype → the acting figure. */
const CLASS_ACTOR = {
  Warrior: 'a battle-scarred warrior',
  Rogue: 'a lithe hooded rogue',
  Mage: 'a robed arcane mage',
  Warlock: 'a sinister dark warlock',
  Priest: 'a radiant robed priest',
  Shaman: 'a primal vine-wreathed shaman',
  Ranger: 'a keen-eyed ranger',
  Engineer: 'a goggled tinker-engineer',
};

const opsOf = (card) => (Array.isArray(card.effects) ? card.effects : []);
const has = (card, op) => opsOf(card).some((o) => o.op === op);

/** Choose the dominant action phrase from the card's effects/type. */
function actionPhrase(card) {
  if (card.type === 'power' || card.trigger) {
    return 'conjuring a lingering, glowing construct that hovers ready on the battlefield';
  }
  if (has(card, 'stance')) return 'settling into a charged, ready combat stance, weapon poised';
  if (has(card, 'damage')) {
    const multi = opsOf(card).filter((o) => o.op === 'damage').length > 1 || (card.keywords || []).includes('aoe');
    return multi
      ? 'unleashing a sweeping, multi-target offensive blow'
      : 'unleashing a single brutal, focused offensive strike';
  }
  if (has(card, 'block')) return 'bracing behind a glowing wall of protective guard';
  if (has(card, 'heal')) return 'channeling restorative energy that knits wounds closed';
  if (has(card, 'buff')) return 'surging with empowering energy, muscles and aura flaring';
  if (has(card, 'debuff')) return 'hurling a withering hex toward an unseen foe';
  if (has(card, 'draw') || has(card, 'energy')) return 'drawing a focusing surge of insight, cards and motes swirling close';
  return 'performing a dramatic signature maneuver';
}

/**
 * The scene description for a card: its stored `artPrompt` if present, else a
 * fallback derived from the card's name / archetype / element / effect.
 * @param {object} card
 * @returns {string}
 */
export function cardArtScene(card) {
  if (card && typeof card.artPrompt === 'string' && card.artPrompt.trim()) return card.artPrompt.trim();
  if (!card) return '';
  const actor = CLASS_ACTOR[first(card.class)] || 'a lone fighter';
  const element = ELEMENT_FLAVOR[first(card.attunement)] || 'dramatic elemental energy';
  return `"${card.name}": ${actor} ${actionPhrase(card)}, rendered with ${element}.`;
}

/**
 * Full generator-ready brief: scene + the locked Variant-B style block.
 * Feed directly to the image generator (prefix with "generate the following
 * image:" when calling agy — see scripts/gen_cards.py).
 * @param {object} card
 * @returns {string}
 */
export function cardArtPrompt(card) {
  const scene = cardArtScene(card);
  return `Fantasy ability-card art depicting ${scene}\n\nStyle: ${CARD_ART_STYLE}`;
}
