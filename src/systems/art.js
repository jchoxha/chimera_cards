// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/art — resolve a monster's portrait. Render order:    ║
// ║   baked art (manifest) → runtime imageUrl → legacy AI svg →          ║
// ║   element SILHOUETTE (game-icons). NEVER an emoji.                   ║
// ║ Monsters no longer have a rendered emoji identity; `sprite` lingers  ║
// ║ in the data only as a legacy field. Baked Variant-B art is produced  ║
// ║ by the agy pipeline (see docs/art-pipeline.md) into public/art/ and  ║
// ║ registered in src/data/artManifest.json (id → file under /art/).     ║
// ║ UPDATE WHEN: art storage, the manifest shape, or elements change.    ║
// ╚══════════════════════════════════════════════════════════════════╝
import manifest from "../data/artManifest.json";

// Honors the GH-Pages base path (VITE_BASE) so /art/ resolves when deployed.
const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";

// element → game-icons id used as the no-art silhouette placeholder. Shared
// with the combat view. 16 canonical elements; unknown falls back to a paw.
export const ELEMENT_FACE_ICON = {
  pyre: "game-icons:flame", frost: "game-icons:snowflake-1", hydro: "game-icons:water-drop",
  charge: "game-icons:lightning-arc", aero: "game-icons:wind-slap", stone: "game-icons:stone-block",
  metal: "game-icons:metal-bar", crystal: "game-icons:crystal-cluster", toxin: "game-icons:poison-bottle",
  flora: "game-icons:high-grass", beast: "game-icons:paw-print", lumen: "game-icons:sun",
  aether: "game-icons:sparkles", umbra: "game-icons:moon-bats", void: "game-icons:vortex",
  blood: "game-icons:drop",
};

/** Manifest lookup key for a monster (explicit artId, else id, else name-slug). */
export function monsterArtKey(m) {
  if (!m) return null;
  return m.artId || m.id || (m.name ? m.name.toLowerCase().replace(/\s+/g, "-") : null);
}

/** Baked portrait URL for a monster, or null if none is registered yet. */
export function monsterArtUrl(m) {
  const key = monsterArtKey(m);
  const file = key && manifest[key];
  return file ? `${BASE}art/${file}` : null;
}

/** game-icons id for the element silhouette placeholder (never an emoji). */
export function monsterFaceIcon(m) {
  const el = m && (m.element || (m.elements && m.elements[0]));
  return ELEMENT_FACE_ICON[el] || "game-icons:paw-print";
}
