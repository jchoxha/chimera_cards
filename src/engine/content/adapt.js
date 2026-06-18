// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/adapt — bridge the existing src/data into    ║
// ║ the new engine Monster/Card shapes.                                 ║
// ║ UPDATE WHEN: the data schema or the engine type schema changes.     ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The legacy data (src/data/*) predates the 3-type matrix and the
// effects-object Card shape. This adapter is the single conversion point so the
// rest of the engine never sees the old format. Pure functions, no side effects.

/** @typedef {import('../types.js').Monster} Monster */
/** @typedef {import('../types.js').Card} Card */
/** @typedef {import('../types.js').TypeAffinity} TypeAffinity */
/** @typedef {import('../types.js').CardRarity} CardRarity */

// Legacy monster rarities → engine CardRarity (for reward-pool tagging).
const RARITY_MAP = {
  common: 'common', uncommon: 'uncommon', rare: 'rare',
  epic: 'rare', godly: 'rare', legendary: 'rare', mythic: 'rare',
};

// Weight ladders for 1/2/3 typings (dominant first). ~66/33 for duals.
const WEIGHT_LADDER = { 1: [1], 2: [0.667, 0.333], 3: [0.5, 0.3, 0.2] };

// Card numeric fields that map to target-applied (enemy) statuses.
const TARGET_STATUS = ['burn', 'poison', 'chill', 'soak', 'shock', 'vulnerable', 'weak', 'decay'];

/** @param {CardRarity} r */
export function mapRarity(r) { return RARITY_MAP[r] ?? 'common'; }

/**
 * Convert a legacy element/elements pair into weighted TypeAffinity[].
 * @param {string} element            Primary element.
 * @param {string[]} [elements]       Optional [dominant, …secondary] list.
 * @returns {TypeAffinity[]}
 */
export function elementsToTypes(element, elements) {
  const list = (elements && elements.length ? elements : [element]).slice(0, 3);
  const ladder = WEIGHT_LADDER[list.length] ?? WEIGHT_LADDER[1];
  return list.map((type, i) => ({ type, weight: ladder[i] }));
}

/**
 * Adapt one legacy card def into an engine Card.
 * @param {Object} raw                 Legacy card { id,name,type,cost,dmg,... }.
 * @param {Object} [ctx]               { element, rarity } context from the owner.
 * @returns {Card}
 */
export function adaptCard(raw, ctx = {}) {
  /** @type {import('../types.js').CardEffects} */
  const effects = {};
  if (raw.dmg) effects.dmg = raw.dmg;
  if (raw.hits) effects.hits = raw.hits;
  if (raw.block) effects.block = raw.block;          // self block (active fighter)
  if (raw.draw) effects.draw = raw.draw;
  if (raw.energy) effects.energy = raw.energy;        // bonus energy this turn
  if (raw.strength) effects.strength = raw.strength;  // self Strength (active fighter)
  if (raw.shield) effects.shield = raw.shield;        // TEAM shield (shared, resets each turn)
  if (raw.teamheal) effects.teamheal = raw.teamheal;  // heal whole party now
  if (raw.regen) effects.regen = raw.regen;           // heal-over-time stacks (active)
  if (raw.leech) effects.leech = true;                // heal active for a share of dmg dealt

  const applyStatus = {};
  for (const k of TARGET_STATUS) if (raw[k]) applyStatus[k] = raw[k];
  if (Object.keys(applyStatus).length) effects.applyStatus = applyStatus;

  // Legacy boolean flags → engine keyword list (preserve any explicit keywords).
  const keywords = [...(raw.keywords ?? [])];
  if (raw.exhaust && !keywords.includes('exhaust')) keywords.push('exhaust');
  if (raw.retain && !keywords.includes('retain')) keywords.push('retain');

  return {
    id: raw.id,
    name: raw.name,
    cardType: raw.type ?? 'attack',
    rarity: mapRarity(ctx.rarity),
    cost: raw.cost ?? 1,
    element: ctx.element ?? raw.element ?? null,
    effects,
    text: raw.text,
    keywords: keywords.length ? keywords : undefined,
  };
}

/**
 * Adapt one legacy monster into an engine Monster (≤3 weighted typings).
 * @param {Object} raw   Legacy monster from DEFAULT_MONSTERS.
 * @returns {Monster}
 */
export function adaptMonster(raw) {
  const types = elementsToTypes(raw.element, raw.elements);
  const dominant = types[0]?.type ?? raw.element;
  return {
    id: raw.id ?? raw.name.toLowerCase().replace(/\s+/g, '-'),
    name: raw.name,
    types,
    form: raw.form ?? 'regular',
    hp: raw.hp,
    maxHp: raw.hp,
    signatureCards: (raw.cards ?? []).map((c) => adaptCard(c, { element: dominant, rarity: raw.rarity })),
    meta: { rarity: raw.rarity, tier: raw.tier, desc: raw.desc, sprite: raw.sprite, source: 'roster' },
  };
}

/**
 * Adapt the whole roster.
 * @param {Object[]} rawMonsters
 * @returns {Monster[]}
 */
export function adaptRoster(rawMonsters) {
  return rawMonsters.map(adaptMonster);
}
