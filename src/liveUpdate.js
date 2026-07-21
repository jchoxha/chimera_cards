// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: liveUpdate — Over-The-Air WEB updates for the Android app (Capgo    ║
// ║ @capgo/capacitor-updater, self-hosted). On launch the app checks the        ║
// ║ deployed version (app-version.json on Pages) vs the running bundle and, if  ║
// ║ newer, downloads the new web bundle (a small zip) via the plugin's NATIVE    ║
// ║ downloader — which bypasses the WebView CORS/network limits — then swaps it  ║
// ║ in. So web changes (nearly everything) reach the app WITHOUT reinstalling    ║
// ║ the APK. Native/plugin changes still need a new APK. See offline-android.md. ║
// ╚══════════════════════════════════════════════════════════════════╝
import { isNativeShell } from './ai/provider.js';
import { checkForUpdate } from './updateCheck.js';

// The web bundle zip, refreshed on every push by the ota.yml workflow.
const BUNDLE_URL = 'https://github.com/jchoxha/chimera_cards/releases/download/web-latest/web-bundle.zip';

/**
 * Confirm the current bundle is good (so the plugin doesn't roll back), then
 * check for + apply a newer web bundle OTA. Returns a status the UI can show.
 * On success it calls set(), which RELOADS the WebView into the new bundle.
 * @returns {Promise<{status:'web'|'no-plugin'|'up-to-date'|'updating'|'error', latest?:string, error?:string}>}
 */
export async function runLiveUpdate() {
  if (!isNativeShell()) return { status: 'web' };
  let CapacitorUpdater;
  try { ({ CapacitorUpdater } = await import('@capgo/capacitor-updater')); }
  catch { return { status: 'no-plugin' }; }
  try { await CapacitorUpdater.notifyAppReady(); } catch { /* ignore */ }
  try {
    const { updateAvailable, latest } = await checkForUpdate();
    if (!updateAvailable || !latest) return { status: 'up-to-date', latest };
    const bundle = await CapacitorUpdater.download({ url: BUNDLE_URL, version: latest });
    await CapacitorUpdater.set(bundle); // activates + reloads into the new bundle
    return { status: 'updating', latest };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[liveUpdate]', e?.message || e);
    return { status: 'error', error: e?.message || String(e) };
  }
}

let _ran = false;
/** Run the OTA check once on app launch (no-op on web / repeat calls). */
export async function initLiveUpdate() {
  if (_ran || !isNativeShell()) return;
  _ran = true;
  await runLiveUpdate();
}
