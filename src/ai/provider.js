// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/provider — the pluggable inference PROVIDER seam. All text     ║
// ║ generation (claude.js callClaude/askClaudeJson, generateArt) routes       ║
// ║ through generateText() here, so the SAME prompts + validators run against ║
// ║ any backend: the Anthropic API (web/dev), an in-browser local model       ║
// ║ (WebLLM/WebGPU), or an on-device native model (Capacitor plugin).         ║
// ║ See docs/offline-android.md §3. Providers are lazy so the heavy local     ║
// ║ runtimes never bloat the default web bundle.                              ║
// ║ UPDATE WHEN: adding/altering a provider or the selection logic.           ║
// ╚══════════════════════════════════════════════════════════════════╝

const STORE_KEY = 'chimera.ai.provider';

/** True inside the Capacitor native shell (the Android app). */
export function isNativeShell() {
  return typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.() ?? window.Capacitor?.isNative);
}

// ── Provider: Anthropic API (the existing path, moved here) ──────────────────
const apiProvider = {
  id: 'api',
  label: 'Claude API (online)',
  isAvailable() { return typeof fetch === 'function'; },
  async ensureReady() { return true; },
  async generateText(prompt, { maxTokens = 1200 } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined' && window.ANTHROPIC_API_KEY) {
      headers['x-api-key'] = window.ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.content) throw new Error('No content in response');
    return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  },
};

// ── Provider: WebLLM (in-browser, WebGPU) ────────────────────────────────────
// isAvailable() gates on WebGPU; ensureReady() triggers the first-run model
// download (cached in the browser); generateText() runs a local chat completion.
// The heavy runtime (./webllm.js → @mlc-ai/web-llm) is imported LAZILY so it only
// loads when the user opts into on-device generation.
let _webllmProgress = null;
const webllmProvider = {
  id: 'webllm',
  label: 'On-device (browser · WebGPU)',
  isAvailable() { return typeof navigator !== 'undefined' && !!navigator.gpu; },
  /** Optional progress sink the settings UI sets before triggering a load. */
  onProgress(cb) { _webllmProgress = cb; },
  async ensureReady() {
    const { ensureEngine } = await import('./webllm.js');
    await ensureEngine(_webllmProgress || undefined);
    return true;
  },
  async generateText(prompt, opts) {
    const { webllmGenerate } = await import('./webllm.js');
    return webllmGenerate(prompt, opts);
  },
};

// ── Provider: native on-device (Capacitor plugin) — STUB until step 6 ────────
// Bridges MediaPipe LLM Inference / MLC-LLM to the bundled + optional models.
const nativeProvider = {
  id: 'native',
  label: 'On-device (app · native)',
  isAvailable() { return isNativeShell() && !!window.ChimeraLLM; },
  async ensureReady() {
    throw new Error('Native LLM provider not wired yet (offline-android.md build step 6).');
  },
  async generateText() {
    throw new Error('Native LLM provider not wired yet (offline-android.md build step 6).');
  },
};

export const PROVIDERS = Object.freeze({ api: apiProvider, webllm: webllmProvider, native: nativeProvider });

/** The default provider for the current environment. Inside the Android app (meant
 *  to run offline) we prefer the on-device path: the in-WebView WebLLM model when the
 *  WebView supports WebGPU (no native code needed), else the native plugin if present,
 *  else the API. The web/desktop always defaults to the API (users opt into a big
 *  local-model download explicitly). */
export function defaultProviderId() {
  if (isNativeShell()) {
    if (typeof navigator !== 'undefined' && navigator.gpu) return 'webllm';
    if (nativeProvider.isAvailable()) return 'native';
    return 'api';
  }
  return 'api';
}

/** The user's selected provider id (persisted), falling back to the env default. */
export function getProviderId() {
  try {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(STORE_KEY);
    if (saved && PROVIDERS[saved]) return saved;
  } catch { /* localStorage unavailable */ }
  return defaultProviderId();
}

/** Persist the chosen provider id. */
export function setProviderId(id) {
  if (!PROVIDERS[id]) throw new Error(`Unknown AI provider: ${id}`);
  try { localStorage.setItem(STORE_KEY, id); } catch { /* ignore */ }
}

/** The active provider object. */
export function getProvider() {
  return PROVIDERS[getProviderId()] || apiProvider;
}

/**
 * Generate text via the active provider, falling back to the API provider if a
 * local provider isn't ready (so the app never hard-fails on generation).
 * @param {string} prompt
 * @param {{ maxTokens?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function generateText(prompt, opts = {}) {
  const provider = getProvider();
  if (provider.id !== 'api' && provider.isAvailable()) {
    try {
      await provider.ensureReady();
      return await provider.generateText(prompt, opts);
    } catch (err) {
      // local provider not ready/failed → fall through to the API path
      if (typeof console !== 'undefined') console.warn(`[ai] ${provider.id} unavailable, falling back to API:`, err?.message || err);
    }
  }
  return apiProvider.generateText(prompt, opts);
}
