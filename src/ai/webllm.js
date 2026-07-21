// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/webllm — the in-browser local-model runtime (WebGPU) behind    ║
// ║ the `webllm` provider. Loaded LAZILY (dynamic import from provider.js) so ║
// ║ the ~heavy @mlc-ai/web-llm runtime never enters the default bundle. Runs  ║
// ║ a small quantized instruct model entirely on-device; weights download     ║
// ║ once from the MLC CDN and cache in the browser (Cache/IndexedDB).         ║
// ║ See docs/offline-android.md §3/§5.                                        ║
// ║ UPDATE WHEN: the model list, runtime API, or generation params change.    ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Selectable on-device models (Jeton: a small bundled-tier + a medium optional).
 *  ids are @mlc-ai/web-llm prebuilt model ids. Sizes are approximate downloads. */
export const MODELS = Object.freeze([
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', tier: 'small',  label: 'Qwen2.5 1.5B (small · fast)',   approxMB: 1100 },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', tier: 'medium', label: 'Llama 3.2 3B (medium · better)', approxMB: 1900 },
]);
export const DEFAULT_MODEL_ID = MODELS[0].id;
const MODEL_KEY = 'chimera.ai.localModel';

/** WebGPU present? (the hard requirement for on-device inference in the browser). */
export function webgpuAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

/** The user's selected on-device model id (persisted), defaulting to the small tier. */
export function getLocalModelId() {
  try {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved && MODELS.some((m) => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_MODEL_ID;
}
export function setLocalModelId(id) {
  if (!MODELS.some((m) => m.id === id)) throw new Error(`Unknown local model: ${id}`);
  try { localStorage.setItem(MODEL_KEY, id); } catch { /* ignore */ }
}

// module-level engine cache — one live engine per loaded model id.
let _engine = null;
let _engineModelId = null;
let _loading = null;

/**
 * Ensure a WebLLM engine is ready for the selected model. Downloads + caches the
 * weights on first use (progress via onProgress: {progress:0..1, text}).
 * @param {(p:{progress:number,text:string})=>void} [onProgress]
 * @returns {Promise<object>} the MLC engine
 */
export async function ensureEngine(onProgress) {
  if (!webgpuAvailable()) throw new Error('WebGPU is not available in this browser.');
  const modelId = getLocalModelId();
  if (_engine && _engineModelId === modelId) return _engine;
  if (_loading && _engineModelId === modelId) return _loading;

  _engineModelId = modelId;
  _loading = (async () => {
    // Route the model download through native HTTP in the Android WebView (plain
    // fetch() to HuggingFace fails cross-origin there). No-op on the web.
    try { const { installModelFetchShim } = await import('./nativeFetch.js'); await installModelFetchShim(); } catch { /* ignore */ }
    const { CreateMLCEngine, prebuiltAppConfig } = await import('@mlc-ai/web-llm');
    // Use the IndexedDB cache backend, not the default Cache API: Cache.add() stores
    // cross-origin (opaque) weight responses, which WebViews + some browsers reject
    // with "Cache.add() encountered a network error". IndexedDB fetches + stores the
    // bytes directly and is robust in the Capacitor WebView.
    const appConfig = { ...prebuiltAppConfig, cacheBackend: 'indexeddb' };
    const engine = await CreateMLCEngine(modelId, {
      appConfig,
      initProgressCallback: (r) => {
        try { onProgress?.({ progress: r.progress ?? 0, text: r.text || '' }); } catch { /* ignore */ }
      },
    });
    _engine = engine;
    return engine;
  })();
  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

/** Whether an engine is already loaded (weights in memory) for the current model. */
export function isEngineReady() {
  return !!_engine && _engineModelId === getLocalModelId();
}

/**
 * Run a single-prompt chat completion on the local model.
 * @param {string} prompt
 * @param {{ maxTokens?: number, temperature?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function webllmGenerate(prompt, { maxTokens = 1200, temperature = 0.8 } = {}) {
  const engine = await ensureEngine();
  const reply = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
  });
  return reply?.choices?.[0]?.message?.content ?? '';
}
