// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: render/partShapes — PROCEDURAL stand-in art for every rig part.   ║
// ║                                                                           ║
// ║ Why these exist: the parts rig is useless until something can be drawn in ║
// ║ every slot, and baking ~38 AI part sprites is a separate (network-bound)  ║
// ║ job. These flat, thick-outlined vector shapes let the WHOLE system run    ║
// ║ today with no assets at all — offline, instantly, for every creature and  ║
// ║ every fusion. They deliberately follow the Variant-B language (bold flat  ║
// ║ shapes, heavy dark outlines) so baked art can replace them one part at a  ║
// ║ time without the portrait ever looking broken.                            ║
// ║                                                                           ║
// ║ Each shape is authored in its OWN 0..100 local box; composeCreature places ║
// ║ and scales it. Outlines use non-scaling-stroke so a big body and a tiny   ║
// ║ fang keep the same line weight.                                           ║
// ║ UPDATE WHEN: a rig part gains a new `draw` id.                            ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';

const INK = '#1a1228';
/** Shared outline treatment — constant line weight at any layer scale. */
const line = (w = 2.4) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' });

/** Bodies need to read as a solid silhouette; several attunement tints (Physical
 *  is near-white) are too pale for that, so body fills are always deepened. */
export const bodyTint = (t) => shade(t, 0.66);

/** Darken/lighten a hex tint for cheap two-tone shading. */
function shade(hex, amt) {
  const h = String(hex || '#888').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(n, 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((num >> 16) & 255) * amt), g = cl(((num >> 8) & 255) * amt), b = cl((num & 255) * amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Every procedural part. Signature: (tint) => SVG children in a 0..100 box.
 */
export const SHAPES = {
  // ── bodies ────────────────────────────────────────────────────────────────
  bodyHumanoid: (t) => (
    <>
      <path d="M50 8 C64 8 70 20 68 34 L74 64 C76 82 68 96 50 96 C32 96 24 82 26 64 L32 34 C30 20 36 8 50 8 Z" fill={bodyTint(t)} {...line()} />
      <path d="M50 40 C58 40 62 52 62 66 C62 80 57 90 50 90 Z" fill={shade(t, 0.82)} stroke="none" />
    </>
  ),
  bodyBeast: (t) => (
    <>
      <ellipse cx="52" cy="54" rx="42" ry="30" fill={bodyTint(t)} {...line()} />
      <path d="M18 74 l4 20 M38 80 l2 18 M66 80 l2 18 M86 72 l5 20" {...line(3)} fill="none" />
      <path d="M52 54 C74 54 86 62 90 76 C70 84 34 84 16 76 C22 62 34 54 52 54 Z" fill={shade(t, 0.82)} stroke="none" />
    </>
  ),
  bodyAberration: (t) => (
    <>
      <path d="M50 6 C74 10 92 30 88 56 C84 84 66 96 50 96 C34 96 16 84 12 56 C8 30 26 10 50 6 Z" fill={bodyTint(t)} {...line()} />
      <path d="M50 50 C66 52 78 62 80 76 C66 88 34 88 20 76 C22 62 34 52 50 50 Z" fill={shade(t, 0.84)} stroke="none" />
    </>
  ),

  // ── heads ─────────────────────────────────────────────────────────────────
  headRound: (t) => (
    <>
      <circle cx="50" cy="50" r="40" fill={t} {...line()} />
      <circle cx="36" cy="45" r="6" fill={INK} /><circle cx="64" cy="45" r="6" fill={INK} />
    </>
  ),
  headSnout: (t) => (
    <>
      <path d="M22 30 C42 16 78 20 88 42 C94 56 84 72 62 76 C40 80 18 68 16 50 C15 42 17 35 22 30 Z" fill={t} {...line()} />
      <circle cx="42" cy="42" r="6" fill={INK} />
      <circle cx="84" cy="50" r="4" fill={INK} />
    </>
  ),
  headBlob: (t) => (
    <>
      <path d="M50 12 C74 12 88 30 86 52 C84 74 68 86 50 86 C32 86 16 74 14 52 C12 30 26 12 50 12 Z" fill={t} {...line()} />
      <circle cx="38" cy="46" r="7" fill="#fff" {...line(1.6)} /><circle cx="38" cy="47" r="3.4" fill={INK} />
      <circle cx="64" cy="52" r="5" fill="#fff" {...line(1.6)} /><circle cx="64" cy="53" r="2.4" fill={INK} />
    </>
  ),
  headBeak: (t) => (
    <>
      <circle cx="46" cy="48" r="34" fill={t} {...line()} />
      <path d="M76 46 L98 56 L76 64 Z" fill={shade(t, 1.25)} {...line()} />
      <circle cx="40" cy="40" r="5.5" fill={INK} />
    </>
  ),

  // ── attachments ───────────────────────────────────────────────────────────
  wing: (t) => (
    <path d="M96 50 C70 18 30 10 6 26 C22 40 20 62 8 78 C36 92 74 82 96 50 Z" fill={shade(t, 1.12)} {...line()} />
  ),
  tail: (t) => (
    <path d="M4 40 C34 26 66 34 92 58 C74 56 58 62 44 74 C30 62 16 52 4 40 Z" fill={shade(t, 0.9)} {...line()} />
  ),
  claw: (t) => (
    <path d="M50 6 C62 26 66 52 56 92 C50 74 40 66 30 62 C42 44 46 26 50 6 Z" fill={shade(t, 1.3)} {...line()} />
  ),
  horn: (t) => (
    <path d="M50 96 C42 62 46 30 62 4 C70 34 68 68 58 96 Z" fill={shade(t, 1.25)} {...line()} />
  ),
  fangs: () => (
    <>
      <path d="M28 20 L38 62 L48 20 Z" fill="#fff" {...line(1.8)} />
      <path d="M56 20 L66 62 L76 20 Z" fill="#fff" {...line(1.8)} />
    </>
  ),
  maw: (t) => (
    <>
      <ellipse cx="50" cy="50" rx="42" ry="30" fill={shade(t, 0.35)} {...line()} />
      <path d="M14 40 L24 56 L36 40 L48 56 L60 40 L72 56 L84 40" fill="#fff" {...line(1.6)} />
    </>
  ),
  eyes: () => (
    <>
      <circle cx="26" cy="40" r="15" fill="#fff" {...line(1.8)} /><circle cx="26" cy="42" r="7" fill={INK} />
      <circle cx="62" cy="30" r="11" fill="#fff" {...line(1.8)} /><circle cx="62" cy="32" r="5" fill={INK} />
      <circle cx="56" cy="66" r="9" fill="#fff" {...line(1.8)} /><circle cx="56" cy="68" r="4" fill={INK} />
    </>
  ),
  beak: (t) => <path d="M10 40 L92 52 L12 66 Z" fill={shade(t, 1.3)} {...line()} />,
  quills: (t) => (
    <path d="M10 90 L20 26 L30 84 L40 18 L50 82 L60 18 L70 84 L80 26 L90 90 Z" fill={shade(t, 0.85)} {...line()} />
  ),
  shell: (t) => (
    <>
      <ellipse cx="50" cy="52" rx="46" ry="38" fill={shade(t, 0.75)} {...line()} />
      <path d="M50 14 L50 90 M12 52 L88 52 M24 26 L76 78 M76 26 L24 78" {...line(1.6)} fill="none" opacity=".5" />
    </>
  ),
  plates: (t) => (
    <>
      <ellipse cx="50" cy="52" rx="44" ry="36" fill={shade(t, 0.8)} {...line(1.8)} />
      <path d="M18 38 q32 12 64 0 M16 56 q34 12 68 0 M22 72 q28 10 56 0" {...line(1.6)} fill="none" opacity=".55" />
    </>
  ),
  cilia: (t) => (
    <>
      <ellipse cx="50" cy="54" rx="42" ry="34" fill={shade(t, 0.88)} {...line(1.8)} />
      <path d="M12 40 q8 -14 16 0 M30 30 q8 -14 16 0 M50 26 q8 -14 16 0 M70 32 q8 -14 16 0" {...line(1.8)} fill="none" />
    </>
  ),
  tentacle: (t) => (
    <path d="M42 4 C60 24 62 52 50 96 C40 60 32 34 30 10 Z" fill={shade(t, 1.08)} {...line()} />
  ),
  roots: (t) => (
    <path d="M50 4 L50 46 M50 46 L22 92 M50 46 L50 94 M50 46 L78 92" {...line(4)} fill="none" stroke={shade(t, 0.6)} />
  ),
  motes: (t) => (
    <>
      {[[18, 24, 6], [76, 20, 5], [30, 76, 5], [84, 66, 4], [54, 12, 4], [12, 56, 4]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={shade(t, 1.3)} opacity=".8" {...line(1.2)} />
      ))}
    </>
  ),
  cloud: (t) => (
    <ellipse cx="50" cy="52" rx="48" ry="40" fill={shade(t, 0.7)} opacity=".38" stroke="none" />
  ),
  drips: (t) => (
    <>
      {[[26, 30], [50, 46], [72, 26], [38, 66], [64, 70]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} c-5 8 -2 14 ${0} 14 c3 0 6 -6 0 -14 Z`} fill={shade(t, 1.15)} {...line(1.4)} />
      ))}
    </>
  ),
  breath: (t) => (
    <path d="M6 50 C28 34 52 34 74 48 C56 50 44 56 32 66 C22 62 12 58 6 50 Z" fill={shade(t, 1.2)} opacity=".75" {...line(1.6)} />
  ),
  shard: (t) => <path d="M50 96 L34 40 L50 4 L66 40 Z" fill={shade(t, 1.35)} {...line()} />,
  mandible: (t) => (
    <>
      <path d="M20 20 C34 44 40 62 34 84" fill="none" {...line(4)} stroke={shade(t, 1.25)} />
      <path d="M80 20 C66 44 60 62 66 84" fill="none" {...line(4)} stroke={shade(t, 1.25)} />
    </>
  ),
  hoof: (t) => <path d="M32 10 L68 10 L74 84 L26 84 Z" fill={shade(t, 0.6)} {...line()} />,

  // ── held weapons ──────────────────────────────────────────────────────────
  sword: () => (
    <>
      <path d="M50 4 L60 26 L60 70 L40 70 L40 26 Z" fill="#cfd6e2" {...line()} />
      <rect x="30" y="70" width="40" height="8" fill="#8a6b3a" {...line()} />
      <rect x="45" y="78" width="10" height="18" fill="#8a6b3a" {...line()} />
    </>
  ),
  axe: () => (
    <>
      <rect x="45" y="10" width="10" height="86" fill="#8a6b3a" {...line()} />
      <path d="M55 14 C82 18 88 40 58 50 Z" fill="#cfd6e2" {...line()} />
    </>
  ),
  hammer: () => (
    <>
      <rect x="45" y="16" width="10" height="80" fill="#8a6b3a" {...line()} />
      <rect x="20" y="8" width="60" height="30" rx="5" fill="#cfd6e2" {...line()} />
    </>
  ),
  spear: () => (
    <>
      <rect x="46" y="20" width="8" height="76" fill="#8a6b3a" {...line()} />
      <path d="M50 0 L64 26 L36 26 Z" fill="#cfd6e2" {...line()} />
    </>
  ),
  staff: (t) => (
    <>
      <rect x="45" y="18" width="10" height="78" rx="4" fill="#8a6b3a" {...line()} />
      <circle cx="50" cy="12" r="14" fill={shade(t, 1.35)} {...line()} />
    </>
  ),
  bow: (t) => (
    <>
      <path d="M32 4 C72 28 72 72 32 96" fill="none" {...line(5)} stroke={shade(t, 0.7)} />
      <path d="M32 4 L32 96" fill="none" {...line(1.6)} />
    </>
  ),
  shield: (t) => (
    <>
      <path d="M50 4 L92 18 C92 60 74 88 50 96 C26 88 8 60 8 18 Z" fill={shade(t, 0.85)} {...line()} />
      <path d="M50 20 L74 28 C74 56 62 74 50 80 C38 74 26 56 26 28 Z" fill={shade(t, 1.1)} stroke="none" />
    </>
  ),
  fist: (t) => (
    <>
      <rect x="16" y="30" width="68" height="46" rx="16" fill={t} {...line()} />
      <path d="M34 38 L34 68 M50 36 L50 70 M66 38 L66 68" fill="none" {...line(1.8)} opacity=".6" />
    </>
  ),
};

/** Render one composed layer's procedural art (null if it has no `draw`). */
export function PartShape({ draw, tint }) {
  const fn = SHAPES[draw];
  return fn ? fn(tint) : null;
}
