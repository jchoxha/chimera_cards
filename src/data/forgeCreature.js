// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/forgeCreature — the ON-THE-FLY AI creature forge (the game's ║
// ║ core fantasy: describe a creature, get a playable one). ONE intelligently ║
// ║ prompted call authors: name · lore · physical description · full typings  ║
// ║ (body types / subtypes / family / anatomy / weapons / archetype /         ║
// ║ attunement / size) · 2–3 BESPOKE signature cards · an art prompt. Every   ║
// ║ field is VALIDATED + numerically clamped against the engine, and a        ║
// ║ heuristic fallback (inferTypings + template flavor) means the forge       ║
// ║ always produces a playable creature even with no API key.                 ║
// ║ UPDATE WHEN: the axis vocabulary, op vocabulary, or budgets change.       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { askClaudeJson, generateArt, ART_STYLE } from '../ai/claude.js';
import { CLASS_BASES, BODY_TYPES, SUBTYPES, ATTUNEMENT_BASES, legalAttunements } from './synthesis.js';
import { biologyDisplayName } from './biologyNaming.js';
import { inferTypingsHeuristic } from './inferTypings.js';
import { validateCard } from '../engine/cards/cardSpec.js';
import { BEAST_FAMILIES, anatomyForFamily, defaultAnatomy } from '../engine/cards/beastPool.js';
import { ABERRATION_FAMILIES, anatomyForAberrationFamily, defaultAberrationAnatomy } from '../engine/cards/aberrationPool.js';
import { weaponsForArchetype, defaultWeapons } from '../engine/cards/humanoidPool.js';
import { FORM_ORDER } from './forms.js';
import { formArtDesc } from './sizeArt.js';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

// The op vocabulary + statuses the model may author signature cards with.
const FORGE_OPS = ['damage', 'block', 'buff', 'debuff', 'heal', 'draw', 'energy'];
const FORGE_DEBUFFS = ['weak', 'vulnerable', 'burn', 'poison', 'bleed', 'soak', 'shock', 'expose', 'confuse', 'decay'];
const FORGE_BUFFS = ['strength', 'dexterity', 'regen', 'amplify'];

/** Numeric budgets per energy cost (REVIEW/tunable) — the fairness clamp. */
const BUDGET = {
  damage: (cost) => 6 + 5 * cost,     // total damage (value × hits)
  block: (cost) => 5 + 5 * cost,
  heal: (cost) => 4 + 3 * cost,
  status: (cost) => 2 + cost,
  draw: (cost) => 1 + Math.min(1, cost),
};

/** Clamp one authored card into engine-legal, budget-fair shape (or null). */
export function sanitizeForgedCard(raw, i, def) {
  if (!raw || typeof raw !== 'object' || !raw.name) return null;
  const cost = clampN(raw.cost, 0, 3);
  const atts = def.attunement || ['Physical'];
  const card = {
    id: `forged_${slug(def.name)}_${slug(raw.name) || i}`,
    name: String(raw.name).slice(0, 24),
    attunement: ATTUNEMENT_BASES.includes(raw.attunement) && atts.includes(raw.attunement) ? raw.attunement : atts[0],
    type: ['attack', 'skill', 'power'].includes(raw.type) ? raw.type : 'attack',
    cost,
    rarity: ['common', 'uncommon', 'rare'].includes(raw.rarity) ? raw.rarity : 'uncommon',
    effects: [],
  };
  for (const op of (Array.isArray(raw.effects) ? raw.effects : []).slice(0, 3)) {
    if (!FORGE_OPS.includes(op?.op)) continue;
    const o = { op: op.op };
    if (op.op === 'damage') {
      const hits = clampN(op.hits, 1, 3);
      o.value = clampN(op.value, 1, Math.max(1, Math.floor(BUDGET.damage(cost) / hits)));
      if (hits > 1) o.hits = hits;
      if (op.scope === 'wholeEnemySide') { o.scope = 'wholeEnemySide'; o.value = clampN(o.value * 0.66, 1, 99); }
    } else if (op.op === 'block') {
      o.value = clampN(op.value, 1, BUDGET.block(cost));
      if (op.brace === true) { o.brace = true; o.value = clampN(o.value * 0.8, 1, 99); }
    } else if (op.op === 'heal') o.value = clampN(op.value, 1, BUDGET.heal(cost));
    else if (op.op === 'buff') { if (!FORGE_BUFFS.includes(op.status)) continue; o.status = op.status; o.value = clampN(op.value, 1, BUDGET.status(cost)); }
    else if (op.op === 'debuff') { if (!FORGE_DEBUFFS.includes(op.status)) continue; o.status = op.status; o.value = clampN(op.value, 1, BUDGET.status(cost)); if (op.scope === 'wholeEnemySide') o.scope = 'wholeEnemySide'; }
    else if (op.op === 'draw') o.value = clampN(op.value, 1, BUDGET.draw(cost));
    else if (op.op === 'energy') o.value = 1;
    card.effects.push(o);
  }
  if (!card.effects.length) return null;
  if (card.type === 'attack' && card.effects.some((o) => o.op === 'damage')) card.imbue = 1;
  if (card.type === 'power') { card.trigger = { on: 'turnStart', effects: card.effects.slice(0, 1) }; card.effects = []; }
  return validateCard(card).length === 0 ? card : null;
}

/** Validate/normalize a whole forged definition against every axis + kit. */
export function sanitizeForgedDef(json, concept) {
  const name = String(json.name || concept || 'Nameless').slice(0, 22).trim() || 'Nameless';
  const bodies = (Array.isArray(json.biology) ? json.biology : [json.biology]).filter((b) => BODY_TYPES.includes(b)).slice(0, 2);
  const biology = bodies.length ? bodies : ['Beast'];
  const klass = CLASS_BASES.includes(json.class) ? json.class : 'Warrior';
  const legal = legalAttunements([klass]);
  const atts = (Array.isArray(json.attunement) ? json.attunement : [json.attunement])
    .filter((a) => ATTUNEMENT_BASES.includes(a)).slice(0, 2);
  const attunement = atts.length ? (biology.includes('Humanoid') && !atts.some((a) => legal.includes(a)) ? [legal[0], atts[0]] : atts) : ['Physical'];
  const subtypes = (Array.isArray(json.subtypes) ? json.subtypes : []).filter((s) => SUBTYPES.includes(s)).slice(0, 3);

  let family = null, anatomy = [], weapons = [];
  if (biology.includes('Beast')) {
    family = BEAST_FAMILIES.includes(json.family) ? json.family : BEAST_FAMILIES[0];
    const allowed = anatomyForFamily(family);
    anatomy = (Array.isArray(json.anatomy) ? json.anatomy : []).filter((t) => allowed.includes(t)).slice(0, 4);
    if (anatomy.length < 2) anatomy = [...new Set([...anatomy, ...defaultAnatomy(family)])].slice(0, 3);
  } else if (biology.includes('Aberration')) {
    family = ABERRATION_FAMILIES.includes(json.family) ? json.family : ABERRATION_FAMILIES[0];
    const allowed = anatomyForAberrationFamily(family);
    anatomy = (Array.isArray(json.anatomy) ? json.anatomy : []).filter((t) => allowed.includes(t)).slice(0, 4);
    if (anatomy.length < 2) anatomy = [...new Set([...anatomy, ...defaultAberrationAnatomy(family)])].slice(0, 3);
  }
  if (biology.includes('Humanoid')) {
    const prof = weaponsForArchetype(klass);
    weapons = (Array.isArray(json.weapons) ? json.weapons : []).filter((w) => prof.includes(w)).slice(0, 2);
    if (!weapons.length) weapons = defaultWeapons(klass);
  }

  const def = {
    name,
    lore: String(json.lore || '').slice(0, 600) || null,
    description: String(json.description || '').slice(0, 500) || null,
    // Archetype is HUMANOID-ONLY: instinct-driven bodies carry no trained class.
    class: biology.includes('Humanoid') ? [klass] : null,
    biology, attunement, subtypes, family, anatomy, weapons,
    size: FORM_ORDER.includes(json.size) && json.size !== 'elite' && json.size !== 'boss' ? json.size : 'regular',
  };
  def.signatureCards = (Array.isArray(json.signatureCards) ? json.signatureCards : [])
    .map((c, i) => sanitizeForgedCard(c, i, def)).filter(Boolean).slice(0, 3);
  // Size-aware base prompt: `${sizeToken}` is a placeholder the gen pipeline swaps
  // per form (see data/sizeArt.js FORM_ART_DESC) so each size is DRAWN differently,
  // not one image rescaled. Rendered here at the creature's own size for the forge.
  def.artPromptBase = `"${name}" — ${def.description || 'a fantasy creature'} (${biologyDisplayName(biology, family ? [family] : [], subtypes)}, ${attunement.join('/')} attuned), \${sizeDesc}. ${ART_STYLE.split('\n')[1] || ''}`.trim();
  def.artPrompt = def.artPromptBase.replace('${sizeDesc}', formArtDesc(def.size));
  return def;
}

/** The intelligently-prompted forge call. */
function forgePrompt(concept) {
  return `You are the creature forge for "Chimera Cards" — a Slay-the-Spire × Pokémon deckbuilder with a high-fantasy typing matrix (WoW/D&D-inspired). Design ONE creature from this concept:

CONCEPT: "${concept}"

Respond ONLY with JSON:
{
 "name": "evocative 1-2 word name",
 "lore": "2 short paragraphs of high-fantasy lore (who/what it is, a striking detail). Separate with \\n\\n.",
 "description": "1 paragraph purely PHYSICAL description (colors, silhouette, materials, pose) — used to draw it.",
 "biology": ["1-2 of: ${BODY_TYPES.join(' | ')}"]  // the FORM. Humanoid=person-shaped, Beast=animal-shaped, Aberration=neither (ooze/plant/construct/eldritch/formless/crystal).
 "subtypes": ["0-3 of: ${SUBTYPES.join(' | ')}"],  // composition/affliction overlays
 "class": "one of: ${CLASS_BASES.join(' | ')}",     // its trained discipline (matters only if Humanoid)
 "attunement": ["1-2 of: ${ATTUNEMENT_BASES.join(' | ')}"],  // its element(s)
 "family": "if Beast: one of ${BEAST_FAMILIES.join('|')}; if Aberration: one of ${ABERRATION_FAMILIES.join('|')}; else null",
 "anatomy": ["if Beast/Aberration: 2-4 body-part tags it visibly HAS (Beast: Claws,Teeth,Beak,Horns,Tail,Hooves,Wings,Quills,Venom,Hide,Shell,Roar,Breath · Aberration: Tentacle,Eye,Maw,Pseudopod,Spore,Shard,Miasma,Roots,Mandible)"],
 "weapons": ["if Humanoid: 1-2 weapons it carries (Sword,Axe,Dagger,Bow,Crossbow,Spear,Mace,Hammer,Staff,Wand,Shield,Fist)"],
 "size": "one of: baby | small | regular | large",
 "signatureCards": [  // 2-3 UNIQUE moves that express its identity. Keep numbers modest — they will be clamped.
   { "name": "move name", "type": "attack|skill|power", "cost": 0-3, "rarity": "common|uncommon|rare",
     "attunement": "one of ITS attunements",
     "effects": [ up to 3 of:
       {"op":"damage","value":N,"hits":1-3,"scope":"wholeEnemySide"(optional AoE)},
       {"op":"block","value":N,"brace":true(optional)},
       {"op":"debuff","status":"${FORGE_DEBUFFS.join('|')}","value":N},
       {"op":"buff","status":"${FORGE_BUFFS.join('|')}","value":N},
       {"op":"heal","value":N}, {"op":"draw","value":1-2}, {"op":"energy","value":1} ] }
 ]
}
Make the mechanics MATCH the fantasy (a venomous thing poisons; an armored thing braces; a swift thing draws). Fair numbers: ~6-11 total damage or ~5-8 block per 1 energy.`;
}

/** Template flavor for the offline path — always gives SOMETHING readable. */
function templateFlavor(def) {
  const identity = biologyDisplayName(def.biology, def.family ? [def.family] : [], def.subtypes);
  return {
    lore: `${def.name} is a ${identity.toLowerCase()} attuned to ${def.attunement.join(' and ')}. Travelers speak of it in the low voice reserved for things half-believed.\n\nWhat it wants, none can say — but where it passes, the ${def.attunement[0].toLowerCase()} lingers.`,
    description: `A ${identity.toLowerCase()} wreathed in ${def.attunement[0].toLowerCase()} light${def.anatomy?.length ? `, marked by its ${def.anatomy.map((a) => a.toLowerCase()).join(', ')}` : ''}${def.weapons?.length ? `, bearing ${def.weapons.map((w) => w.toLowerCase()).join(' and ')}` : ''}.`,
  };
}

/**
 * Forge a full creature from a free-text concept. Tries Claude (typings + flavor
 * + bespoke signature cards + an SVG portrait); falls back to the keyword
 * heuristic + template flavor so it ALWAYS returns a playable, validated def.
 * @param {string} concept  free text — a name, a vibe, a whole paragraph
 * @param {{ withPortrait?: boolean }} [opts]
 * @returns {Promise<Object>} a custom-creature def (+ forged: 'ai'|'heuristic')
 */
export async function forgeCreature(concept, { withPortrait = true } = {}) {
  let def = null;
  try {
    const json = await askClaudeJson(forgePrompt(concept), 2000);
    if (json && json.name) { def = sanitizeForgedDef(json, concept); def.forged = 'ai'; }
  } catch { /* fall through */ }
  if (!def) {
    const t = inferTypingsHeuristic(concept, '', '');
    def = sanitizeForgedDef({ name: concept.split(/[,.—-]/)[0].trim().slice(0, 22), ...t, biology: t.biology, attunement: t.attunement, class: t.class?.[0] }, concept);
    const flavor = templateFlavor(def);
    def.lore = flavor.lore; def.description = flavor.description;
    def.forged = 'heuristic';
  }
  if (!def.lore || !def.description) {
    const flavor = templateFlavor(def);
    def.lore = def.lore || flavor.lore; def.description = def.description || flavor.description;
  }
  // On-the-fly portrait: a style-locked SVG from the physical description (needs a key).
  if (withPortrait && def.forged === 'ai') {
    const svg = await generateArt({ name: def.name, element: def.attunement[0], desc: def.description, lore: def.lore });
    if (svg) def.portraitSvg = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  return def;
}
