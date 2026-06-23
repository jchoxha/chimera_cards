// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/OrientationGate — force landscape on touch devices.     ║
// ║ Chimera's whole UI (menu/select/combat/run) is landscape-designed.  ║
// ║ On a coarse-pointer device held in portrait we cover the app with a ║
// ║ "rotate your device" prompt + a best-effort fullscreen/orientation  ║
// ║ lock (Android Chrome); iOS just shows the prompt. Desktop (fine     ║
// ║ pointer) is never gated. UPDATE WHEN: adding new top-level screens.  ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useState } from 'react';

const mq = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);

function useMedia(query) {
  const [on, setOn] = useState(() => mq(query)?.matches ?? false);
  useEffect(() => {
    const m = mq(query);
    if (!m) return;
    const handler = () => setOn(m.matches);
    handler();
    m.addEventListener?.('change', handler);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      m.removeEventListener?.('change', handler);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [query]);
  return on;
}

function lockLandscape() {
  try { window.screen?.orientation?.lock?.('landscape').catch(() => {}); } catch { /* unsupported */ }
}

export default function OrientationGate({ children }) {
  const portrait = useMedia('(orientation: portrait)');
  const touch = useMedia('(pointer: coarse)');
  const block = portrait && touch;

  // Best-effort lock once (succeeds only in fullscreen on Android; harmless elsewhere).
  useEffect(() => { lockLandscape(); }, []);

  async function goFullscreen() {
    try { await document.documentElement.requestFullscreen?.(); } catch { /* denied */ }
    lockLandscape();
  }

  return (
    <>
      {children}
      {block && (
        <div className="rotGate">
          <div className="rotInner">
            <iconify-icon icon="mdi:phone-rotate-landscape" class="rotIcon"></iconify-icon>
            <h2>Rotate your device</h2>
            <p>Chimera is played in landscape. Turn your phone sideways to enter the pit.</p>
            <button className="rotBtn" onClick={goFullscreen}>Go fullscreen</button>
          </div>
        </div>
      )}
    </>
  );
}
