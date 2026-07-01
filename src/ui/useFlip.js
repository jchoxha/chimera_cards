// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/useFlip — a tiny FLIP animator. Give it a `key` that changes  ║
// ║ only when the LAYOUT should reflow (e.g. a list's order string, or which  ║
// ║ item is lifted) and a ref to a Map<id, HTMLElement>. On each key change   ║
// ║ it measures every element's new box, compares to its box from the         ║
// ║ previous key, and plays a transform tween so siblings SLIDE to their new  ║
// ║ spots instead of jumping. Used by the team cards + the combat hand.       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { useLayoutEffect, useRef } from 'react';

export function useFlip(key, elsRef, { duration = 170, easing = 'ease' } = {}) {
  const prev = useRef(null);
  useLayoutEffect(() => {
    const cur = new Map();
    for (const [id, el] of elsRef.current) if (el && el.isConnected) cur.set(id, el.getBoundingClientRect());
    const before = prev.current;
    if (before) {
      for (const [id, el] of elsRef.current) {
        if (!el || !el.isConnected) continue;
        const a = before.get(id); const b = cur.get(id);
        if (!a || !b) continue;
        const dx = a.left - b.left; const dy = a.top - b.top;
        if (!dx && !dy) continue;
        // compose with any INLINE transform the element already carries (e.g. the
        // hand's per-card fan translateY/rotate) so the slide doesn't flatten it.
        const base = (el.style && el.style.transform) ? el.style.transform : '';
        try {
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px) ${base}`.trim() }, { transform: base || 'translate(0,0)' }],
            { duration, easing },
          );
        } catch { /* WAAPI unsupported → no-op */ }
      }
    }
    prev.current = cur;
  }, [key]);
}
