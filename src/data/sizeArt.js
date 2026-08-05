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

// The per-form PROMPT phrasing moved to data/artStyle.js (the single prompt
// layer) — it is prompt text, not part of this module's baked-art manifest, and
// keeping it here made sizeArt.js (which imports JSON) un-importable from node
// tests. Re-exported so existing importers are unaffected.
export { FORM_ART_DESC, formArtDesc } from './artStyle.js';

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
