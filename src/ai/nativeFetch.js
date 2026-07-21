// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/nativeFetch — route the on-device model download through        ║
// ║ Capacitor NATIVE HTTP. In the Android WebView, plain fetch() to the model  ║
// ║ hosts (HuggingFace weight shards + the MLC model-lib on GitHub) fails with  ║
// ║ "TypeError: Failed to fetch" (cross-origin + redirect limits). CapacitorHttp║
// ║ (in @capacitor/core — already in the APK, so this ships over OTA) does the  ║
// ║ request natively, bypassing the WebView. We monkey-patch window.fetch to    ║
// ║ intercept ONLY those model hosts and hand WebLLM a normal Response.         ║
// ║ Everything else (app assets, the OTA check) passes straight through.        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { isNativeShell } from './provider.js';

// Hosts WebLLM pulls the model from: HF (config + weight shards) + the MLC
// model-lib WASM on GitHub raw. Scope the shim to these so nothing else changes.
const MODEL_HOSTS = ['huggingface.co', 'hf.co', 'cdn-lfs', 'raw.githubusercontent.com', 'githubusercontent.com'];

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let _installed = false;

/** Install the native-fetch shim (native shell only, once). Safe no-op on web. */
export async function installModelFetchShim() {
  if (_installed || !isNativeShell() || typeof window === 'undefined' || !window.fetch) return;
  let CapacitorHttp;
  try { ({ CapacitorHttp } = await import('@capacitor/core')); } catch { return; }
  if (!CapacitorHttp?.get) return;
  _installed = true;

  const orig = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    if (url && method === 'GET' && MODEL_HOSTS.some((h) => url.includes(h))) {
      try {
        const res = await CapacitorHttp.get({
          url,
          responseType: 'arraybuffer',
          connectTimeout: 60000,
          readTimeout: 180000,
        });
        // Native returns binary as a base64 string; small JSON may come as text/object.
        let body;
        if (typeof res.data === 'string') {
          body = /[^\x00-\x7F]/.test(res.data) ? res.data : tryDecode(res.data);
        } else if (res.data instanceof ArrayBuffer) {
          body = res.data;
        } else {
          body = JSON.stringify(res.data);
        }
        return new Response(body, { status: res.status || 200, headers: res.headers || {} });
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[nativeFetch] native GET failed, falling back:', url, e?.message || e);
        return orig(input, init);
      }
    }
    return orig(input, init);
  };
}

// A base64 string decodes to bytes; if it wasn't base64 (e.g. plain JSON text),
// atob throws → return the original string.
function tryDecode(s) {
  try { return base64ToArrayBuffer(s); } catch { return s; }
}
