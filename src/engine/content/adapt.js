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

import { RARITIES } from '../types.js';

// Monster rarities now map 1:1 onto the unified card-rarity ladder (§14.7),
// so reward cards keep their TRUE tier (epic/mythic/legendary/godly) instead of
// being collapsed to `rare` — this is what populates the top reward tiers.

// Weight ladders for 1/2/3 typings (dominant first). ~66/33 for duals.
const WEIGHT_LADDER = { 1: [1], 2: [0.667, 0.333], 3: [0.5, 0.3, 0.2] };

// Card numeric fields that map to target-applied (enemy) statuses.
const TARGET_STATUS = ['burn', 'poison', 'chill', 'soak', 'shock', 'vulnerable', 'weak', 'decay'];

/** Pass-through onto the unified ladder; unknown tiers fall back to common. */
/** @param {CardRarity} r */
export function mapRarity(r) { return RARITIES.includes(r) ? r : 'common'; }

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
  if (raw.shield) effects.shield = raw.shield;        // TEAM shield — REMOVED in Vanguard model (inert)
  if (raw.teamheal) effects.teamheal = raw.teamheal;  // heal whole party — not in live set (inert)
  if (raw.leech) effects.leech = true;                // lifesteal — not modeled yet (inert)

  // Self heal-over-time → the live `regen` self-status (the engine ticks it at
  // the carrier's own turn-end; spec §3.2).
  const selfStatus = {};
  if (raw.regen) selfStatus.regen = raw.regen;
  if (Object.keys(selfStatus).length) effects.selfStatus = selfStatus;

  const applyStatus = {};
  for (const k of TARGET_STATUS) if (raw[k]) applyStatus[k] = raw[k];
  if (Object.keys(applyStatus).length) effects.applyStatus = applyStatus;

  // Targeting scope. Legacy cards predate the 18-token scope system; the 1-v-1
  // data maps cleanly to single-target Vanguard scopes. Offensive fields
  // (damage / debuff statuses) hit the enemy Vanguard; everything else (block,
  // self-buffs, draw/energy economy) resolves on the caster. Without a scope the
  // engine skips ALL scoped effects (resolve.js), so this assignment is required
  // for player cards to actually do anything.
  effects.scope = (effects.dmg != null || effects.applyStatus != null)
    ? 'enemyActiveTarget'
    : 'selfOnlyTarget';

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
