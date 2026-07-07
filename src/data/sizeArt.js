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
  baby: 'as a tiny, adorable hatchling (this overrides any size words above) — oversized head and eyes, stubby limbs, occupying only the middle of the frame, dwarfed by oversized environment details',
  small: 'as a small, half-grown young specimen (this overrides any size words above) — lean, compact and slightly gangly, filling about half the frame',
  regular: 'at its typical adult size — balanced, characteristic proportions',
  large: 'as an unusually large, powerful adult, visibly bigger than a typical member of its kind (this overrides any size words above) — low camera angle, its body filling the frame edge to edge',
  elite: 'as a huge battle-hardened elite veteran (this overrides any size words above) — scarred, trophied and ornamented, low camera angle, looming past the frame edges',
  boss: 'as a colossal building-sized boss DWARFING the landscape (this overrides any size words above) — extreme low camera angle looking far up, tiny environment details establishing enormous scale, silhouette overflowing the frame',
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
