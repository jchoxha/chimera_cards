// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/frames — the type × rarity frame "matrix".        ║
// ║ Two independent axes feed one card-border style:                    ║
// ║   • TYPE  → hue. Multi-type = a gradient with stops sized by each    ║
// ║     type's weight (66/33 pyre/aero fills ~2/3 pyre, then aero).      ║
// ║   • RARITY → finish: a metallic bevel whose strength climbs, and (per ║
// ║     the chosen "finish + metal tint") a precious-metal tint blended   ║
// ║     into the hue at higher rarities. Holo/foil sheen on rare+.        ║
// ║ UPDATE WHEN: elements, rarities, or the frame look change.          ║
// ╚══════════════════════════════════════════════════════════════════╝
import { ELEMENT_COLOR } from '../../systems/elements.jsx';

// rarity → { tint metal color, metal: bevel strength 0..1, holo, foil }
// Covers card rarities (basic/common/uncommon/rare) and the fuller monster
// ladder (epic/godly/legendary/mythic). Unknown → common.
const RARITY_FINISH = {
  basic:     { tint: '#8c8c8c', metal: 0.12, holo: false, foil: false },
  common:    { tint: '#9a7b4a', metal: 0.20, holo: false, foil: false }, // bronze
  uncommon:  { tint: '#cdd6e0', metal: 0.34, holo: false, foil: false }, // silver
  rare:      { tint: '#f0c84a', metal: 0.50, holo: true,  foil: false }, // gold
  epic:      { tint: '#c98bff', metal: 0.58, holo: true,  foil: true  }, // amethyst
  godly:     { tint: '#ffe6a0', metal: 0.66, holo: true,  foil: true  },
  legendary: { tint: '#ff9a3d', metal: 0.66, holo: true,  foil: true  },
  mythic:    { tint: '#7ef0ff', metal: 0.72, holo: true,  foil: true  },
};
// how strongly the rarity tint bleeds into the type hue (the "metal tint").
const RARITY_TINT_MIX = {
  basic: 0.05, common: 0.08, uncommon: 0.14, rare: 0.20,
  epic: 0.26, godly: 0.32, legendary: 0.32, mythic: 0.36,
};

function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((n) => clampByte(n).toString(16).padStart(2, '0')).join('');
}
/** Linear blend of two hex colors. t=0 → a, t=1 → b. */
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
function lighten(hex, t) { return mix(hex, '#ffffff', t); }
function darken(hex, t) { return mix(hex, '#000000', t); }

/**
 * Build the weighted type-hue gradient as hard proportional bands so the
 * dominant type clearly occupies its share of the border.
 * @param {{type:string, weight:number}[]} types
 * @param {string} tint  rarity metal color blended into each band
 * @param {number} tintMix  0..1
 */
function typeGradient(types, tint, tintMix) {
  const list = (types && types.length ? types : [{ type: null, weight: 1 }]);
  const stops = [];
  let acc = 0;
  for (const t of list) {
    const base = ELEMENT_COLOR[t.type] || '#c9a66b';
    const col = mix(base, tint, tintMix);
    stops.push(`${col} ${Math.round(acc * 100)}%`);
    acc += t.weight ?? (1 / list.length);
    stops.push(`${col} ${Math.round(acc * 100)}%`);
  }
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

/**
 * Compute the border style for a card frame.
 * @param {{ types?: {type:string,weight:number}[], element?: string, rarity?: string }} opts
 * @returns {{ background: string, finish: string, holo: boolean }}
 */
export function frameStyle({ types, element, rarity } = {}) {
  const key = RARITY_FINISH[rarity] ? rarity : 'common';
  const fin = RARITY_FINISH[key];
  const tintMix = RARITY_TINT_MIX[key] ?? 0.1;
  const list = types && types.length ? types : (element ? [{ type: element, weight: 1 }] : []);

  // Metallic bevel: a diagonal light→dark→light sheen, alpha scaled by rarity.
  const m = fin.metal;
  const bevel = `linear-gradient(135deg,
    rgba(255,255,255,${0.55 * m}) 0%,
    rgba(0,0,0,${0.30 * m}) 26%,
    rgba(255,255,255,${0.40 * m}) 52%,
    rgba(0,0,0,${0.35 * m}) 78%,
    rgba(255,255,255,${0.50 * m}) 100%)`;

  // Layer the (semi-transparent) bevel over the tinted type hue.
  const background = `${bevel}, ${typeGradient(list, fin.tint, tintMix)}`;
  return { background, finish: `fin-${key}`, holo: fin.holo };
}

/** A solid accent for the dominant element (glows, mini bars). */
export function dominantColor(types, element) {
  const t = (types && types[0]?.type) || element;
  return ELEMENT_COLOR[t] || '#c9a66b';
}

export { lighten, darken, mix };
