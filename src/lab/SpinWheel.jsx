// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/SpinWheel — an animated, HONEST prize wheel. Wedge ANGLES are ║
// ║ proportional to each segment's weight, so a 1-in-100 `godly` really is a  ║
// ║ gold sliver you have to be lucky to hit — the odds are visible, not just  ║
// ║ tabulated.                                                                ║
// ║                                                                           ║
// ║ Controlled: the PARENT decides the outcome (so generation stays seedable  ║
// ║ and testable) and bumps `spinKey`; the wheel just animates to that wedge  ║
// ║ and calls onDone. UI only — no game state lives here.                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useMemo, useRef, useState } from 'react';

const TAU = Math.PI * 2;
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];

/** SVG path for one wedge of the pie. */
function wedgePath(cx, cy, r, startA, endA) {
  const [x1, y1] = polar(cx, cy, r, startA);
  const [x2, y2] = polar(cx, cy, r, endA);
  const large = endA - startA > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * @param {{
 *   segments: {value:any,weight:number,label:string}[],
 *   targetIndex: number|null,   which wedge to land on
 *   spinKey: number,            bump to trigger a spin
 *   colorFor?: (value:any, i:number) => string,
 *   size?: number, title?: string, result?: string, onDone?: () => void,
 * }} props
 */
export default function SpinWheel({
  segments = [], targetIndex = null, spinKey = 0, colorFor, size = 168, title, result, onDone,
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const lastKey = useRef(spinKey);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Wedge geometry from the WEIGHTS (proportional = honest odds).
  const wedges = useMemo(() => {
    const total = segments.reduce((s, x) => s + (x.weight ?? 1), 0) || 1;
    let acc = 0;
    return segments.map((s) => {
      const frac = (s.weight ?? 1) / total;
      const start = acc * TAU;
      acc += frac;
      const end = acc * TAU;
      return { ...s, start, end, mid: (start + end) / 2, frac };
    });
  }, [segments]);

  useEffect(() => {
    if (spinKey === lastKey.current || targetIndex == null || !wedges[targetIndex]) return;
    lastKey.current = spinKey;
    // Land the target wedge's midpoint under the pointer (top, 0rad), after a
    // few full turns. Always rotate FORWARD so it never looks like it rewinds.
    const midDeg = (wedges[targetIndex].mid / TAU) * 360;
    const target = 360 * 5 - midDeg;
    setRotation((prev) => {
      const turns = Math.ceil((prev + 360) / 360) * 360;
      return turns + target;
    });
    setSpinning(true);
  }, [spinKey, targetIndex, wedges]);

  const r = size / 2;
  const landed = !spinning && targetIndex != null ? wedges[targetIndex] : null;

  return (
    <div className="lwWrap">
      {title && <div className="lwTitle">{title}</div>}
      <div className="lwStage" style={{ width: size, height: size }}>
        <div className="lwPointer" aria-hidden="true" />
        <svg
          width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="lwSvg"
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 3.1s cubic-bezier(.15,.9,.2,1)' : 'none' }}
          onTransitionEnd={() => { setSpinning(false); doneRef.current?.(); }}
        >
          {wedges.map((w, i) => (
            <path
              key={i} d={wedgePath(r, r, r - 3, w.start, w.end)}
              // a colorFor that returns null (this wheel has no themed palette)
              // must still fall back to the generated hue ramp, not paint black
              fill={(colorFor && colorFor(w.value, i)) || `hsl(${(i * 47 + 25) % 360} 45% 42%)`}
              stroke="rgba(0,0,0,.45)" strokeWidth="1"
            />
          ))}
          {/* only label wedges with room, so the wheel stays readable */}
          {wedges.map((w, i) => {
            if (w.frac < 0.055) return null;
            const [tx, ty] = polar(r, r, r * 0.62, w.mid);
            return (
              <text
                key={`t${i}`} x={tx} y={ty} className="lwLabel" textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${(w.mid / TAU) * 360} ${tx} ${ty})`}
              >{String(w.label).slice(0, 9)}</text>
            );
          })}
          <circle cx={r} cy={r} r={r * 0.14} fill="#1a140c" stroke="rgba(255,255,255,.25)" />
        </svg>
      </div>
      <div className={`lwResult${landed ? ' lwLanded' : ''}`}>
        {result ?? (landed ? landed.label : spinning ? '…' : '—')}
      </div>
    </div>
  );
}
