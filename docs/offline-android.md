# Offline Android + local generative models

*Started 2026-07-16 (Jeton: "available offline on Android; add offline generative features that leverage
local models; download button on the site; bundle a model that works out of the box").* This doc plans how
Chimera ships as an **installable, fully-offline Android app** with **on-device creature/card generation**,
without abandoning the React/Vite codebase. **We do NOT port to Godot** — a rewrite orphans the combat
engine, generators, validators, and UI, and gives no advantage for running local models (you'd bridge the
same native inference libs, more painfully). The durable, engine-agnostic assets are all JS: the **prompt
layer**, the **`sanitizeForgedCard` validators**, the **power-budget**, and the **procedural generator**.

## 0. Decisions (Jeton, 2026-07-16)
- **Device target:** a 2026 Razr Ultra (Snapdragon 8 Elite-class, ~16GB RAM) — ample for 2–3B (even 7–8B
  quantized) on-device inference.
- **Model tier: BOTH** — a **small model bundled** in the APK for out-of-box offline use, **+ a medium
  model as an optional higher-quality download**.
- **Android build/distribution: GitHub Actions → Releases** — CI installs the Android SDK, builds + signs
  the APK, publishes it as a GitHub Release; the site's download button auto-links to the latest.

## 1. The two hard infrastructure constraints (shape everything)
1. **GitHub Pages can't host the APK or the models** (~100MB/file, ~1GB/repo). The APK and models live on
   **GitHub Releases** (≤2GB/asset) or a CDN; the Pages site *links* to them. So models are **downloaded on
   first use (and cached)**, not physically inside the Pages bundle.
2. **The APK is built in CI, not on Pages** — a GitHub Actions runner installs the Android SDK and produces
   the signed APK. (The dev container here has Java + Gradle but no Android SDK.)

Neither blocks the goal; they only decide *where the big files live*.

## 2. The generation is already two layers — this is the key leverage
Per `card-pool-composition.md §11`:
- **Procedural composition = the balanced backbone.** `makeCreature` / kit+factor+attunement + the
  power-budget is **pure JS, NO model.** Unique, balanced creatures + cards already work fully offline.
  This is *most* of the generative value and needs nothing on-device.
- **AI forge = the flavor layer only.** A model is needed just for **names, lore, and bespoke signature-card
  concepts** — a small task a **1–3B local model** handles well.
- **Image gen** is the heavy one. Offline = **pre-baked art packs + the procedural SVG art** we already
  have; on-device diffusion is a later high-end experiment, not the baseline.

Every model output flows through the SAME `sanitizeForgedCard`/`sanitizeForgedDef` validators (axis legality,
op vocabulary, budget), so a **small, hallucination-prone local model is safe** — its output is clamped
exactly like the cloud model's.

## 3. Architecture — a pluggable inference PROVIDER seam
The whole app funnels text generation through `src/ai/claude.js` (`callClaude`/`askClaudeJson`) and
`generateArt`. We abstract that behind a **provider registry** (`src/ai/provider.js`) so the *same* prompts
+ validators run against any backend:

| Provider | Where | Backend | Status |
|---|---|---|---|
| **`api`** | web (dev/Claude app) | Anthropic Messages API (existing fetch) | ✅ built (moved onto the seam) |
| **`webllm`** | web (Chrome/WebGPU) | `@mlc-ai/web-llm` — model fetched from a CDN, cached in the browser (IndexedDB) | ⏳ stub → wire next |
| **`native`** | the Android app | a Capacitor plugin bridging **MediaPipe LLM Inference** or **MLC-LLM** to a bundled/downloaded model | ⏳ stub → wire in the app |

`getProvider()` reads a persisted setting (`chimera.ai.provider`); the app defaults to **`api`** on the web
and **`native`** inside the Capacitor shell. Providers are **lazy-loaded** (dynamic import) so the heavy
WebLLM runtime never bloats the default web bundle. Each provider implements:
`{ id, label, isAvailable(), ensureReady(onProgress), generateText(prompt,{maxTokens}) }`.

**The web version's "download or API" choice** = the settings UI lets the user pick the `webllm` provider
(triggers the first-run model download via WebLLM, cached thereafter) or stay on `api`.

## 4. The Android shell — Capacitor (not a rewrite)
Wrap the existing Vite build in **Capacitor**: the same web app runs in a native Android WebView (three.js /
react-three-fiber, Zustand, localStorage all work). Capacitor gives Play-Store/APK distribution + native
plugin access (filesystem for models, the LLM plugin). Steps: `npm i @capacitor/core @capacitor/cli
@capacitor/android`, `capacitor.config` (webDir = `dist`), `npx cap add android`, `npx cap sync`, gradle
assemble. Offline = the bundled `dist` + a service worker (the app already degrades gracefully with no
network).

**Why native inference over WebGPU-in-WebView:** Android System WebView's WebGPU support lags Chrome's, so
the app uses a **native plugin** (MediaPipe/MLC) for speed + reliability; WebLLM/WebGPU is the *web* path.

## 5. Models
- **Bundled (out-of-box):** a small instruct model, ~1–2B, Q4 (~0.7–1.3GB) — e.g. **Gemma-2 2B** /
  **Qwen2.5-1.5B** / **Phi-3-mini**. Fits inside the APK under the 2GB Release limit. Enough for
  names/lore/short card concepts.
- **Optional download (higher quality):** a medium model, ~3–4B (~2–2.5GB) — e.g. **Phi-3.5-mini** /
  **Gemma-3 4B** — fetched on demand from a Release/CDN, stored on the filesystem, selectable in settings.
- Same model choice powers the **web** path via WebLLM (its own prebuilt-model list / a hosted weight URL).

## 6. The download button
A **"Get the Android app"** section on the hub (`index.html`) linking to the **latest GitHub Release APK**
(and the optional-model download). It degrades gracefully before the first CI build exists (links to the
Releases page). Two builds may be offered: a **lite APK** (model downloaded on first launch) and a
**full/"batteries-included" APK** (small model bundled) — both published by CI.

## 7. Build order
1. **Provider seam** (`src/ai/provider.js` + move the API fetch onto it; rework `claude.js`) — the load-
   bearing refactor; API path stays working. ← *this commit*
2. **Capacitor shell** — config + scripts + `android/` platform; a fully-offline debug APK path.
3. **CI workflow** — GitHub Actions: install SDK → build + sign APK → publish Release (lite + full).
4. **Download section** on the hub → latest Release.
5. **WebLLM provider** — wire `@mlc-ai/web-llm`, a settings toggle (API ⁄ download local model), progress UI.
6. **Native LLM plugin** — Capacitor plugin bridging MediaPipe/MLC to the bundled + optional models; set
   `native` as the in-app default.
7. **Offline art** — pre-baked art packs + procedural SVG as the offline `generateArt` path.

## 8. Honest caveats
- On-device LLM needs a modern phone (the Razr is fine; low-RAM devices won't run the medium model). Speed
  is modest (a handful to tens of tokens/sec) — fine for a name + lore + a couple of card lines.
- Model downloads are large + one-time; gate them behind explicit user action with a progress bar.
- On-device image generation is deferred — offline art is pre-baked/procedural for now.
