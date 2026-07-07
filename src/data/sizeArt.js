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
export const FORM_ART_DESC = {
  baby: 'as a tiny, adorable juvenile — soft rounded proportions, oversized head and eyes, small and unthreatening',
  small: 'as a small, young specimen — lean and compact, not yet grown into its full size',
  regular: 'at its typical adult size — balanced, characteristic proportions',
  large: 'as an unusually large, powerful adult — heavier build, thicker limbs, an imposing presence',
  elite: 'as a battle-hardened elite — scarred and ornamented, bristling with menacing detail',
  boss: 'as a colossal, towering boss — monstrous in scale, elaborate and terrifying, dominating the frame',
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
