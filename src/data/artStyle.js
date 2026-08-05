// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/artStyle — THE canonical creature-art PROMPT LAYER.          ║
// ║                                                                           ║
// ║ docs/art-pipeline.md calls the prompt layer "the durable, tool-independent ║
// ║ asset": whatever generates the pixels (the dev AGY bake, a live image API, ║
// ║ an on-device model later), they must all ask for the SAME picture. This   ║
// ║ module is that single source of truth, and it closes the DRIFT the doc    ║
// ║ flagged — the locked "Variant B" style used to live only in               ║
// ║ scripts/gen_roster.py, while the JS side had a different, SVG-oriented    ║
// ║ ART_STYLE (stroke widths, a 200×200 canvas) that is meaningless to a      ║
// ║ raster image model.                                                       ║
// ║                                                                           ║
// ║ A creature prompt is always three parts:  SUBJECT + SIZE + STYLE          ║
// ║   subject — what the creature IS, from its own taxonomy (or its lore)     ║
// ║   size    — FORM_ART_DESC, so the picture matches the size word shown     ║
// ║   style   — Variant B, verbatim and identical everywhere                  ║
// ║                                                                           ║
// ║ PURE (no DOM, no JSON kit imports) → node-testable via test:artprompt.    ║
// ║ ⚠ Keep ART_STYLE_VARIANT_B in sync with scripts/gen_roster.py STYLE.      ║
// ╚══════════════════════════════════════════════════════════════════╝

import { biologyDisplayName } from './biologyNaming.js';
import { attunementDisplayName } from './synthesis.js';

/**
 * The locked "Variant B" art direction — flat 2D Adventure-Time shapes with
 * Yu-Gi-Oh dramatic seriousness. Verbatim from scripts/gen_roster.py STYLE so
 * baked roster art and live-generated art look like the same game.
 */
export const ART_STYLE_VARIANT_B =
  'Flat 2D hand-drawn cartoon illustration in the spirit of Adventure Time / Pendleton Ward: '
  + 'simple bold shapes, thick confident black outlines, flat matte color fills, minimal shading, '
  + 'genuinely charming and characterful. BUT with the dramatic seriousness of Yu-Gi-Oh trading-card '
  + 'monster art: a dynamic heroic pose, moody dramatic lighting, an epic elemental backdrop. '
  + 'Absolutely NOT Disney, NOT Pixar, NOT 3D, NOT glossy, NOT soft, NOT overly cute. Single creature, '
  + 'centered, filling the frame. No text, no card frame, no UI, no humans unless described '
  + '— only the creature illustration. Square 1:1 composition. FULL-BLEED: the painted artwork must '
  + 'extend to ALL FOUR EDGES of the image — absolutely NO border, NO frame, NO margin, NO white edge '
  + 'of any kind.';

// Per-form phrase woven into art-generation prompts so each size is DRAWN
// distinctly (rather than one image rescaled). 'regular' is the neutral baseline.
// The phrasing must OVERRIDE size adjectives already in the subject text and put
// the size in the COMPOSITION (camera angle + frame fill + environment scale cues)
// — adjectives alone don't move the model. Mirrored in scripts/gen_roster.py
// SIZE_DESC (the fuller pipeline wording).
export const FORM_ART_DESC = {
  baby: 'as a cute juvenile / baby version (this overrides any size words above) — rounded chunky proportions, an oversized head and big eyes, short stubby limbs — but still filling most of the frame like a normal portrait; a simple flat background at normal scale, NO oversized props, giant grass, or footprints (it reads as young from its proportions, not from being tiny in a huge world)',
  young: 'as a YOUNG, half-grown adolescent (an in-between of baby and adult; this overrides any size words above) — leaner, more compact and a bit less developed than the adult, on a simple clean background; the whole creature clearly visible with margin',
  regular: 'at its typical adult size — balanced, characteristic proportions',
  elite: 'as a bigger, tougher ELITE veteran (this overrides any size words above) — clearly larger and more powerful than the adult, with only MINOR extra scars/heavier armor; keep the design essentially the same and plainer than a boss (do NOT out-ornament the boss). The ENTIRE creature stays within the frame with a margin — nothing cropped',
  boss: 'as the ultimate BOSS — the biggest, most fearsome and most VISUALLY SPECTACULAR apex version (this overrides any size words above), with a grander, more elaborate design (more massive/ornate armor, spikes/horns, glowing elemental power, a crest); convey huge scale with a low camera angle and tiny environment details, BUT keep the ENTIRE creature fully within the frame with a margin — nothing cropped or overflowing the edges',
};
export function formArtDesc(form) { return FORM_ART_DESC[form] || FORM_ART_DESC.regular; }

/** Readable phrasing for a factor tag, so "Venom" reads as a picture, not a key. */
const FACTOR_PHRASE = {
  Claws: 'vicious claws', Teeth: 'bared fangs', Beak: 'a sharp hooked beak', Horns: 'curved horns',
  Tail: 'a long expressive tail', Hooves: 'heavy hooves', Wings: 'broad outspread wings',
  Quills: 'bristling quills', Venom: 'dripping venom', Hide: 'thick armoured hide',
  Shell: 'a hard protective shell', Roar: 'a wide roaring maw', Breath: 'elemental breath',
  Tentacle: 'writhing tentacles', Eye: 'many staring eyes', Maw: 'a gaping maw',
  Pseudopod: 'shifting pseudopods', Spore: 'drifting spore clouds', Shard: 'jutting crystal shards',
  Miasma: 'a shroud of miasma', Roots: 'creeping roots', Mandible: 'clacking mandibles',
  Carapace: 'a segmented carapace', Membrane: 'translucent membranes', Cilia: 'waving cilia',
  Ichor: 'oozing ichor',
  Sword: 'a drawn sword', Axe: 'a heavy axe', Dagger: 'twin daggers', Bow: 'a longbow',
  Crossbow: 'a crossbow', Spear: 'a long spear', Mace: 'a spiked mace', Hammer: 'a great warhammer',
  Staff: 'a gnarled staff', Wand: 'a glowing wand', Shield: 'a broad shield', Fist: 'raised fists',
};

const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

/**
 * Describe a creature as an art SUBJECT, purely from its taxonomy. This is what
 * makes generated + fused creatures paintable without an author writing lore:
 * the axes already say what it looks like.
 * @returns {string} e.g. "Ironfang, a Kinetic Giant Chimera, with a great warhammer, a broad shield and bared fangs"
 */
export function creatureArtSubject(c) {
  if (!c) return 'a strange creature';
  const fams = [c.family, c.manifestation].filter(Boolean);
  const kind = biologyDisplayName(list(c.biology), fams, list(c.subtypes));
  const element = attunementDisplayName(list(c.attunement));
  const factors = [...list(c.weapons), ...list(c.anatomy)]
    .map((f) => FACTOR_PHRASE[f] ?? f.toLowerCase())
    .slice(0, 3);

  let s = `"${c.name}", a ${[element, kind].filter(Boolean).join(' ')}`;
  if (c.class?.[0]) s += ` ${c.class[0].toLowerCase()}`;
  if (factors.length) {
    s += `, with ${factors.length === 1 ? factors[0]
      : `${factors.slice(0, -1).join(', ')} and ${factors[factors.length - 1]}`}`;
  }
  return s;
}

/**
 * The full image prompt for a creature: SUBJECT + SIZE + STYLE.
 * Prefers an authored physical `description`/lore when the creature has one
 * (forged creatures do); otherwise derives the subject from the taxonomy.
 * @param {object} c        a creature / forged def
 * @param {{form?: string, subject?: string}} [opts]
 * @returns {string}
 */
export function creatureArtPrompt(c, { form, subject } = {}) {
  const body = subject ?? c?.description ?? creatureArtSubject(c);
  const size = formArtDesc(form ?? c?.meta?.form ?? c?.size ?? 'regular');
  return `Subject: ${body}.\n\n${size}\n\nStyle: ${ART_STYLE_VARIANT_B}`;
}
