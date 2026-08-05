// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/imageProvider — the pluggable IMAGE-GENERATION seam, mirroring ║
// ║ ai/provider.js (which does the same job for text). Call sites ask for a   ║
// ║ picture; this decides who paints it.                                      ║
// ║                                                                           ║
// ║ WHY POLLINATIONS IS THE DEFAULT: this game ships as a PUBLIC static site  ║
// ║ (GitHub Pages) and a sideloaded Android app. There is no server to hide a ║
// ║ secret in, and CLAUDE.md forbids committing/deploying a key. Pollinations ║
// ║ needs NO API KEY AT ALL — generation is a plain GET whose response IS the ║
// ║ image — so there is nothing to leak, and it runs from a static page.      ║
// ║ It serves FLUX for free. Trade-offs (documented, not hidden): no SLA, and ║
// ║ anonymous callers are rate-limited (~1 request / 15s), so this is a       ║
// ║ one-at-a-time forge button, NOT a batch baker. Bulk roster art still goes ║
// ║ through the dev pipeline in docs/art-pipeline.md.                         ║
// ║                                                                           ║
// ║ ADDING A PROVIDER: add an entry to PROVIDERS with the same shape. A keyed ║
// ║ provider must read its key from window/localStorage at CALL time and must ║
// ║ never be the default — see docs/art-pipeline.md § "Live image providers". ║
// ║ UPDATE WHEN: a provider is added, or the default changes.                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { creatureArtPrompt } from '../data/artStyle.js';

const LS_KEY = 'chimera.imageProvider';

/** Stable 32-bit hash → a deterministic seed, so the same creature re-renders
 *  the same portrait instead of a different one on every reload. */
export function seedFor(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Build a Pollinations image URL. The URL *is* the generation request — GET it
 * (or point an <img> at it) and the response body is the finished image.
 */
export function pollinationsUrl({ prompt, width = 512, height = 512, seed = 0, model = 'flux' }) {
  const p = encodeURIComponent(String(prompt || '').slice(0, 1800));
  const q = new URLSearchParams({
    width: String(width), height: String(height), seed: String(seed >>> 0),
    model, nologo: 'true', private: 'true',
  });
  return `https://image.pollinations.ai/prompt/${p}?${q}`;
}

export const PROVIDERS = {
  pollinations: {
    id: 'pollinations',
    label: 'Pollinations (free · FLUX · no key)',
    needsKey: false,
    /** @returns {{url:string}} the image URL — loading it performs the generation */
    build: (opts) => ({ url: pollinationsUrl(opts) }),
  },
  none: {
    id: 'none',
    label: 'Off (use placeholder art)',
    needsKey: false,
    build: () => ({ url: null }),
  },
};

export const DEFAULT_PROVIDER = 'pollinations';

export function getImageProviderId() {
  try { return localStorage.getItem(LS_KEY) || DEFAULT_PROVIDER; } catch { return DEFAULT_PROVIDER; }
}
export function setImageProviderId(id) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* private mode — fall back to default */ }
}
export function getImageProvider() {
  return PROVIDERS[getImageProviderId()] ?? PROVIDERS[DEFAULT_PROVIDER];
}

/**
 * The image URL for a creature: composes the canonical SUBJECT+SIZE+STYLE prompt
 * and hands it to the active provider. Seeded by the creature id, so a given
 * creature keeps its portrait.
 * @param {object} creature
 * @param {{width?:number,height?:number,form?:string,subject?:string,seed?:number}} [opts]
 * @returns {{url:string|null, prompt:string, seed:number}}
 */
export function creatureImageRequest(creature, opts = {}) {
  const prompt = creatureArtPrompt(creature, { form: opts.form, subject: opts.subject });
  const seed = opts.seed ?? seedFor(creature?.id ?? creature?.name ?? 'creature');
  const { url } = getImageProvider().build({
    prompt, seed,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
  });
  return { url, prompt, seed };
}

/**
 * Load an image URL and resolve once it has actually decoded, so callers can show
 * a spinner and handle failure instead of leaving a broken <img>. Resolves to the
 * same URL (the browser has it cached by then).
 * @returns {Promise<string>} rejects on network/decode failure or timeout
 */
export function preloadImage(url, { timeoutMs = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error('no image url')); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { img.src = ''; reject(new Error('timed out')); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(url); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image request failed')); };
    img.src = url;
  });
}

/**
 * Generate a portrait for a creature and MUTATE it in place (`portrait` is what
 * every render site reads — CardFace, TeamManager, the 3D billboards…).
 * @returns {Promise<string>} the portrait url
 */
export async function generateCreaturePortrait(creature, opts = {}) {
  const { url, prompt, seed } = creatureImageRequest(creature, opts);
  if (!url) throw new Error('image generation is turned off');
  await preloadImage(url, opts);
  creature.portrait = url;
  creature.artPrompt = prompt;
  creature.artSeed = seed;
  if (creature.meta) creature.meta.portrait = url;
  return url;
}
