// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/fuse — SEAMLESS CREATURE FUSION (Cassette-Beasts  ║
// ║ style). ANY two creatures fuse into a coherent third; nothing is authored ║
// ║ per-pair. The whole trick is that our taxonomy is ALREADY a parts rig:    ║
// ║   body type   → the silhouette   (CB's "Body" — comes from the PRIMARY)   ║
// ║   kit (axis-2)→ Archetype/Family/Manifestation                            ║
// ║   factors     → the attachments  (CB's "Head"/"Helmet" — Claws, Wings…)   ║
// ║   subtypes    → surface/material overlay                                  ║
// ║   attunement  → element + palette                                         ║
// ║ Merge the axes and STATS + DECK fall out for free, because statProfile()  ║
// ║ and basePoolFor() are already pure functions of those axes.               ║
// ║                                                                           ║
// ║ ORDER MATTERS (as in CB): fuse(A,B) ≠ fuse(B,A) — the primary donates the ║
// ║ body/size and leads every axis, and the Fusion Power card differs.        ║
// ║                                                                           ║
// ║ PURE: no JSON kit imports, so this is node-testable (`npm run test:fuse`).║
// ║ Kit slots are inferred from each parent's BIOLOGY rather than from the    ║
// ║ family vocabularies. Pool is INJECTED by the caller (as in makeCreature). ║
// ║ UPDATE WHEN: the axis model changes, or fusion reduction rules are tuned. ║
// ╚══════════════════════════════════════════════════════════════════╝

import { orderSubtypes, legalAttunements, attunementComboLegal } from '../../data/synthesis.js';
import { makeCreature } from './generate.js';

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const dedupe = (list) => [...new Set(list.filter(Boolean))];

/**
 * Zip two card pools so the head ALTERNATES between them. starterDeck fills its
 * signature slots in pool order, so a plain concatenation would hand every slot
 * to whichever parent sorts first — this is what makes a fusion play like BOTH
 * parents ("both movesets", as in CB). De-duplicated by card id.
 */
function interleaveById(a, b) {
  const out = [], seen = new Set();
  const push = (c) => { if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c); } };
  for (let i = 0; i < Math.max(a.length, b.length); i++) { push(a[i]); push(b[i]); }
  return out;
}

/** Caps — how much of each axis survives a merge (the "≤2 reduction rule"). */
export const FUSION_CAPS = Object.freeze({
  biology: 2,      // body types (a hybrid silhouette)
  attunement: 2,   // elements → one fused type name (Kinetic, Frostfire…)
  subtypes: 3,     // surface overlays
  factors: 4,      // attachments: anatomy ∪ weapons (the visual "parts")
});

/** A fused creature is hardier than either parent (CB grants boosted stats). */
export const FUSION_HP_BONUS = 1.1;

// ── 1. Naming — the portmanteau ────────────────────────────────────────────

/**
 * Index of the onset of a name's LAST syllable = the last consonant→vowel
 * boundary. "Voltfang" → 4 ("fang") · "Ironhide" → 4 ("hide") · "Thornroot" → 5
 * ("root"). A trailing silent 'e' is ignored so "hide" doesn't split as "hi|de".
 * Returns 0 for a single-syllable name (no split point).
 */
function lastSyllableOnset(name) {
  const s = String(name || '');
  if (s.length < 3) return 0;
  const isVowel = (ch) => /[aeiouy]/i.test(ch);
  // ignore a trailing silent 'e' (hide, wave) when locating the split
  let end = s.length;
  if (end > 2 && /e/i.test(s[end - 1]) && !isVowel(s[end - 2])) end--;
  let best = 0;
  for (let j = 1; j < end - 1; j++) {
    if (!isVowel(s[j]) && isVowel(s[j + 1])) best = j;
  }
  return best;
}

/**
 * Blend two species names into a portmanteau: the primary's opening syllables +
 * the secondary's final syllable, with the seam de-duplicated.
 * Ironhide + Voltfang → "Ironfang" · Emberwisp + Thornroot → "Emberoot".
 */
export function fusionName(primaryName, secondaryName) {
  const a = String(primaryName || 'Creature').trim();
  const b = String(secondaryName || 'Creature').trim();
  const ai = lastSyllableOnset(a);
  const bi = lastSyllableOnset(b);
  const head = ai > 0 ? a.slice(0, ai) : a;
  const tail = bi > 0 ? b.slice(bi) : b;
  let out = head + tail;
  // de-duplicate the seam ("Ember"+"root" → "Emberoot", not "Emberroot")
  if (head && tail && head[head.length - 1].toLowerCase() === tail[0].toLowerCase()) {
    out = head + tail.slice(1);
  }
  out = out.replace(/\s+/g, '');
  if (out.length < 3) out = a + b;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// ── 2. Axis merge ──────────────────────────────────────────────────────────

/**
 * Which kit each parent carries, inferred from its own biology (no vocabulary
 * import needed): a Beast-only parent's `family` is a beast Family; an
 * Aberration-only parent's `family` is its Manifestation.
 */
function kitSlotsOf(p) {
  const bodies = arr(p?.biology);
  const isBeast = bodies.includes('Beast');
  const isAberr = bodies.includes('Aberration');
  return {
    klass: bodies.includes('Humanoid') ? (arr(p?.class)[0] ?? null) : null,
    family: isBeast ? (p?.family ?? null) : null,
    manifestation: isAberr ? (p?.manifestation ?? (isBeast ? null : p?.family ?? null)) : null,
  };
}

/**
 * Merge two creatures' typing axes into one legal set. The PRIMARY leads every
 * axis (its body is the silhouette); the secondary fills the remaining slots.
 * @param {object} primary   the body donor
 * @param {object} secondary the feature donor
 * @returns {{biology,class,family,manifestation,anatomy,weapons,subtypes,attunement,size}}
 */
export function fuseAxes(primary, secondary) {
  const P = primary ?? {}, S = secondary ?? {};

  // Body types — primary first, capped at 2 → Chimera / Anomalous / Warped.
  const biology = dedupe([...arr(P.biology), ...arr(S.biology)]).slice(0, FUSION_CAPS.biology);

  // Kits — one axis-2 per body base, primary preferred for a contested slot.
  const kp = kitSlotsOf(P), ks = kitSlotsOf(S);
  const klass = biology.includes('Humanoid') ? (kp.klass ?? ks.klass ?? null) : null;
  const family = biology.includes('Beast') ? (kp.family ?? ks.family ?? null) : null;
  const manifestation = biology.includes('Aberration') ? (kp.manifestation ?? ks.manifestation ?? null) : null;

  // Factors (the visual attachments) — split the budget between both parents so
  // the fusion visibly carries something from each, then top up from the primary.
  const half = Math.ceil(FUSION_CAPS.factors / 2);
  const anatomy = biology.some((b) => b === 'Beast' || b === 'Aberration')
    ? dedupe([...arr(P.anatomy).slice(0, half), ...arr(S.anatomy).slice(0, half), ...arr(P.anatomy)])
      .slice(0, FUSION_CAPS.factors)
    : null;
  const weapons = biology.includes('Humanoid')
    ? dedupe([...arr(P.weapons).slice(0, half), ...arr(S.weapons).slice(0, half), ...arr(P.weapons)])
      .slice(0, FUSION_CAPS.factors)
    : null;

  // Subtypes — union in canonical adjective order.
  const subtypes = orderSubtypes(dedupe([...arr(P.subtypes), ...arr(S.subtypes)])).slice(0, FUSION_CAPS.subtypes);

  // Attunement — union, primary first, then repair archetype legality.
  let attunement = dedupe([...arr(P.attunement), ...arr(S.attunement)]).slice(0, FUSION_CAPS.attunement);
  if (!attunement.length) attunement = ['Physical'];
  if (klass && !attunementComboLegal([klass], attunement)) {
    const legal = legalAttunements([klass]);
    if (legal.length) attunement = dedupe([legal[0], attunement[0]]).slice(0, FUSION_CAPS.attunement);
  }

  return {
    biology: biology.length ? biology : null,
    class: klass ? [klass] : null,
    family, manifestation,
    anatomy: anatomy?.length ? anatomy : null,
    weapons: weapons?.length ? weapons : null,
    subtypes: subtypes.length ? subtypes : null,
    attunement,
    size: P.size ?? S.size ?? 'regular',   // the body donor sets the frame
  };
}

// ── 3. The Fusion Power card ───────────────────────────────────────────────
// CB's signature: every fusion grants a unique move whose NAME is a prefix
// (from the element) + a suffix (which decides targeting / shape / power).
// Deterministic per ORDERED pair, so A→B and B→A differ.

const FUSION_PREFIX = Object.freeze({
  Physical: ['Rending', 'Brutal', 'Savage'],
  Fire: ['Blazing', 'Infernal', 'Ember'],
  Frost: ['Glacial', 'Rimebound', 'Hoarfrost'],
  Nature: ['Verdant', 'Thorned', 'Blooming'],
  Arcane: ['Eldritch', 'Runic', 'Astral'],
  Shadow: ['Umbral', 'Creeping', 'Nightbound'],
  Holy: ['Radiant', 'Hallowed', 'Gilded'],
  Void: ['Devouring', 'Entropic', 'Hollow'],
  Water: ['Surging', 'Tidal', 'Drowning'],
  Air: ['Howling', 'Cyclonic', 'Scouring'],
  Stone: ['Adamant', 'Tectonic', 'Bulwark'],
  Energy: ['Arcing', 'Overcharged', 'Voltaic'],
  Mind: ['Maddening', 'Fracturing', 'Unraveling'],
});

/** Suffix → the move's SHAPE (scope, cost, power), exactly as in CB. */
const FUSION_SUFFIX = Object.freeze([
  { word: 'Strike', cost: 1, scope: 'enemyActiveTarget', damage: 11 },
  { word: 'Barrage', cost: 2, scope: 'enemyActiveTarget', damage: 8, hits: 2 },
  { word: 'Wave', cost: 2, scope: 'wholeEnemySide', damage: 9 },
  { word: 'Bane', cost: 2, scope: 'enemyActiveTarget', damage: 10, debuff: 'vulnerable', stacks: 2 },
  { word: 'Aegis', cost: 1, scope: 'enemyActiveTarget', damage: 7, block: 8 },
  { word: 'Surge', cost: 2, scope: 'enemyActiveTarget', damage: 9, buff: 'strength', stacks: 2 },
]);

/** Stable 32-bit hash (FNV-1a) — deterministic across runs, order-sensitive. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/**
 * The unique move a fusion grants. Name = element prefix + shape suffix; the
 * suffix picks targeting and power. Order-sensitive by design.
 * @returns {import('../cards/cardSpec.js').CardSpec}
 */
export function fusionPowerCard(primary, secondary, axes) {
  const a = axes ?? fuseAxes(primary, secondary);
  const element = a.attunement?.[0] ?? 'Physical';
  const seedStr = `${primary?.id ?? primary?.name ?? 'a'}>${secondary?.id ?? secondary?.name ?? 'b'}`;
  const seed = hash(seedStr);

  const prefixes = FUSION_PREFIX[element] ?? FUSION_PREFIX.Physical;
  const prefix = prefixes[seed % prefixes.length];
  const shape = FUSION_SUFFIX[(seed >>> 8) % FUSION_SUFFIX.length];

  const effects = [];
  for (let i = 0; i < (shape.hits ?? 1); i++) {
    effects.push({ op: 'damage', value: shape.damage, scope: shape.scope });
  }
  if (shape.block) effects.push({ op: 'block', value: shape.block, scope: 'selfOnlyTarget' });
  if (shape.debuff) effects.push({ op: 'debuff', status: shape.debuff, value: shape.stacks, scope: shape.scope });
  if (shape.buff) effects.push({ op: 'buff', status: shape.buff, value: shape.stacks, scope: 'selfOnlyTarget' });

  return {
    id: `fusion_${seed.toString(36)}`,
    name: `${prefix} ${shape.word}`,
    attunement: element,
    type: 'attack',
    cost: shape.cost,
    rarity: 'rare',
    imbue: 1,
    fusionPower: true,
    text: `The bond of ${primary?.name ?? 'one'} and ${secondary?.name ?? 'another'}.`,
    effects,
  };
}

// ── 4. The whole operation ─────────────────────────────────────────────────

/**
 * Fuse two creatures into a new one. STATS + DECK are derived by makeCreature
 * from the merged axes — no bespoke math.
 *
 * @param {object} primary   body donor (leads every axis)
 * @param {object} secondary feature donor
 * @param {{pool?: object[], primaryPool?: object[], secondaryPool?: object[],
 *          baseHp?: number, deckSize?: number, id?: string, name?: string}} opts
 *   `pool` should be built by the caller from the MERGED axes (app/pools.js
 *   `basePoolFor`), so the fused deck unions both kits + hybrid pair cards.
 *   Passing the two PARENT pools instead interleaves them, which guarantees both
 *   movesets show up in the 4 signature slots rather than whichever kit sorts first.
 * @returns {object} a creature (makeCreature shape) + fusion metadata
 */
export function fuseCreatures(primary, secondary, opts = {}) {
  const axes = fuseAxes(primary, secondary);
  const name = opts.name ?? fusionName(primary?.name, secondary?.name);
  const power = fusionPowerCard(primary, secondary, axes);
  const deckSize = opts.deckSize ?? 10;

  const baseHp = opts.baseHp
    ?? Math.round((((primary?.maxHp ?? 55) + (secondary?.maxHp ?? 55)) / 2) * FUSION_HP_BONUS);

  // NOTE: the fusion power must NOT lead the pool. starterDeck picks its Strike/
  // Defend bases by scanning for the first card with a damage/block op, so a rare
  // power at the head gets cloned into all six basic slots.
  const pool = (opts.primaryPool || opts.secondaryPool)
    ? interleaveById(arr(opts.primaryPool), arr(opts.secondaryPool))
    : arr(opts.pool);

  const c = makeCreature({
    id: opts.id ?? `fus_${hash(`${primary?.id}>${secondary?.id}`).toString(36)}`,
    name,
    class: axes.class,
    biology: axes.biology,
    attunement: axes.attunement,
    family: axes.family,
    anatomy: axes.anatomy,
    weapons: axes.weapons,
    subtypes: axes.subtypes,
    size: axes.size,
    baseHp,
    deckSize,
    pool,
  });

  // Guarantee the Fusion Power appears in the opening deck EXACTLY once. It is
  // rare, so starterDeck's common-only signature slots would otherwise skip it.
  const isPower = (d) => d.name === power.name;
  c.deck = c.deck.filter((d, i) => !isPower(d) || c.deck.findIndex(isPower) === i);
  if (!c.deck.some(isPower)) {
    const inst = { ...power, id: `${power.id}#0` };
    if (c.deck.length >= deckSize) c.deck[c.deck.length - 1] = inst;
    else c.deck.push(inst);
  }

  // makeCreature doesn't know about the Aberration manifestation slot; carry it
  // so statProfile/kitsOf and the UI can read it.
  if (axes.manifestation) c.manifestation = axes.manifestation;

  // The parts rig follows Cassette Beasts' rule: the BODY always comes from the
  // primary and never swaps, while the HEAD comes from the secondary — that swap
  // is what makes a fusion read as "both parents" at a glance.
  // (render/composeCreature reads this; harmless when no part art exists yet.)
  const kitOf = (p) => arr(p?.class)[0] ?? p?.family ?? p?.manifestation ?? null;
  c.parts = {
    bodyFrom: arr(primary?.biology)[0] ?? null,
    headFrom: kitOf(secondary),
    headBody: arr(secondary?.biology)[0] ?? null,
  };

  c.fusion = {
    primary: primary?.id ?? null,
    secondary: secondary?.id ?? null,
    primaryName: primary?.name ?? null,
    secondaryName: secondary?.name ?? null,
    power,
  };
  c.signatureCards = [power];
  return c;
}
