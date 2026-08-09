// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/PartsPortrait — renders a composed creature (render/           ║
// ║ composeCreature) as a single scalable SVG.                                ║
// ║                                                                           ║
// ║ Every layer is either procedural (`draw` → render/partShapes) or a baked  ║
// ║ cut-out PNG (`file`), and the two MIX FREELY in one portrait — so real    ║
// ║ art can land one part at a time without the picture ever breaking.        ║
// ║ Because the composition is normalised 0..1, this scales to a card, a      ║
// ║ roster chip, or a 3D billboard with no re-layout.                         ║
// ║ UI-only: no game state, no generation logic.                              ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo } from 'react';
import { composeCreature } from '../render/composeCreature.js';
import { SHAPES } from '../render/partShapes.jsx';
import { effectiveParts } from '../lab/partsStore.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

/**
 * @param {{ creature: object, size?: number|string, background?: boolean, className?: string,
 *           bakedOverride?: Record<string,string>|null }} props
 */
export default function PartsPortrait({ creature, size = '100%', background = true, className = '', bakedOverride = null, anchorOverride = null }) {
  // committed manifest ∪ parts cut locally in the studio; the studio passes an
  // explicit override so an uncommitted cut can be previewed in place.
  const baked = bakedOverride ?? effectiveParts();
  const { layers, tint } = useMemo(
    () => composeCreature(creature, { baked, ...(anchorOverride ? { anchorOverride } : {}) }),
    [creature, baked, anchorOverride],
  );

  return (
    <svg
      viewBox="0 0 100 100" width={size} height={size} className={`partsPortrait ${className}`}
      role="img" aria-label={creature?.name ? `${creature.name} portrait` : 'creature portrait'}
      style={{ display: 'block' }}
    >
      {background && (
        <>
          <defs>
            <radialGradient id={`bg-${creature?.id ?? 'x'}`} cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor={tint} stopOpacity="0.42" />
              <stop offset="100%" stopColor={tint} stopOpacity="0.04" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill={`url(#bg-${creature?.id ?? 'x'})`} />
        </>
      )}

      {layers.map((l) => {
        // place: move to the layer's box, then scale the part's own 0..100 space
        // into it. A mirrored twin flips about its own centre.
        const t = [
          `translate(${l.x * 100} ${l.y * 100})`,
          `scale(${l.w} ${l.h})`,
          l.flip ? 'translate(100 0) scale(-1 1)' : '',
        ].filter(Boolean).join(' ');

        return (
          <g key={l.id} transform={t} opacity={l.opacity}>
            {l.file
              ? <image href={l.file.startsWith('data:') ? l.file : BASE + l.file} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
              : SHAPES[l.draw]?.(l.tint) ?? null}
          </g>
        );
      })}
    </svg>
  );
}
