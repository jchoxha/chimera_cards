// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: updateCheck — self-update for the sideloaded Android app. Compares ║
// ║ the app's bundled APP_VERSION to the version deployed on GitHub Pages       ║
// ║ (app-version.json, emitted by the Vite build) and, when newer, points the  ║
// ║ user at the latest release APK to install. Fails closed (offline → no       ║
// ║ update prompt). See docs/offline-android.md.                               ║
// ╚══════════════════════════════════════════════════════════════════╝
import { APP_VERSION } from './version.js';
import { isNativeShell } from './ai/provider.js';

const PAGES_BASE = 'https://jchoxha.github.io/chimera_cards';
export const APK_URL = 'https://github.com/jchoxha/chimera_cards/releases/download/android-latest/chimera-cards.apk';

// Fetch the deployed version JSON. In the Android app, use Capacitor's NATIVE HTTP
// (CapacitorHttp) so the tiny cross-origin request isn't blocked by the WebView's
// CORS/network limits (which break plain fetch() to other origins in the shell).
async function fetchVersionJson(url) {
  if (isNativeShell()) {
    try {
      const { CapacitorHttp } = await import('@capacitor/core');
      const res = await CapacitorHttp.get({ url, headers: { 'Cache-Control': 'no-cache' } });
      const d = res?.data;
      return typeof d === 'string' ? JSON.parse(d) : d;
    } catch { /* fall through to fetch */ }
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

/** Compare two "v3.165.0"-style versions → 1 if a>b, -1 if a<b, 0 if equal. */
export function compareVersions(a, b) {
  const norm = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = norm(a), pb = norm(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Check whether a newer build has been deployed than the one running.
 * @returns {Promise<{ current:string, latest:string|null, updateAvailable:boolean, apkUrl:string }>}
 */
export async function checkForUpdate() {
  const base = { current: APP_VERSION, latest: null, updateAvailable: false, apkUrl: APK_URL };
  try {
    const { version } = await fetchVersionJson(`${PAGES_BASE}/app-version.json?t=${Date.now()}`);
    return { ...base, latest: version, updateAvailable: compareVersions(version, APP_VERSION) > 0 };
  } catch {
    return base; // offline / unreachable → no update prompt
  }
}
