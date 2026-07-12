// Mobile helpers shared by the battle + world screens.

// Put the app into FULLSCREEN and lock to LANDSCAPE. MUST be called from a user gesture
// (a tap) — fullscreen has to succeed BEFORE orientation.lock is allowed. Both are
// best-effort: iOS Safari has no orientation.lock, so it degrades to "rotate manually".
export async function enterLandscapeFullscreen() {
  const el = document.documentElement;
  try {
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req && !document.fullscreenElement && !document.webkitFullscreenElement) await req.call(el);
  } catch { /* fullscreen denied — continue and try to lock anyway */ }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch { /* orientation lock unsupported (e.g. iOS) — the player rotates manually */ }
}

// True on touch / small screens where we want the fullscreen-landscape flow.
export function wantsLandscape() {
  return (typeof window !== 'undefined')
    && (window.matchMedia?.('(pointer: coarse)')?.matches || window.innerWidth < 900);
}
