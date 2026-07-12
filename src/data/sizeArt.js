// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/sizeArt — the per-SIZE creature-art framework.               ║
// ║ Size no longer rescales the portrait image (that just blurred/stretched   ║
// ║ one picture). Instead each FORM can have its OWN generated portrait at     ║
// ║ public/art/gen/<id>-<form>.png; until those are baked, `sizedPortrait`     ║
// ║ falls back to the base <id>.png. `FORM_ART_DESC` gives the generation      ║
// ║ pipeline (scripts/gen_roster.py + the AI forge) size-specific phrasing so  ║
// ║ a Baby and a Boss are DRAWN differently, not the same art at two scales.   ║
// ║ UPDATE WHEN: baking per-size art (add the form to creatureArtSizes.json)   ║
// ║ or retuning how each size is described to the image model.                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import SIZE_MANIFEST from './creatureArtSizes.json';

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

// Does id-stem `stem` have a distinct baked image for `form`?
const hasSized = (stem, form) => Array.isArray(SIZE_MANIFEST[stem]) && SIZE_MANIFEST[stem].includes(form);

/**
 * Resolve a portrait URL to its size-specific variant when one has been baked.
 *   `<base>/gen/<id>.png` + form 'boss' (manifest lists it) → `<base>/gen/<id>-boss.png`.
 * 'regular' (and unbaked forms) use the base file; data-URI / non-png portraits
 * (e.g. a forged SVG) pass through untouched.
 * @param {string|null|undefined} url   the base portrait URL
 * @param {string} form                 the creature's current form id
 */
export function sizedPortrait(url, form) {
  if (!url || !form || form === 'regular') return url;
  const m = /([^/]+)\.png(\?.*)?$/.exec(url);
  if (!m) return url;                 // data URI (forged SVG) or non-png → leave as-is
  const stem = m[1];
  if (!hasSized(stem, form)) return url;
  return url.replace(`${stem}.png`, `${stem}-${form}.png`);
}
