// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/bake_parts_local.mjs — bake creature PART sprites on a LOCAL         ║
// ║ ComfyUI instead of the paid Retro Diffusion API. Free + unlimited, and the   ║
// ║ images never leave the machine.                                             ║
// ║                                                                            ║
// ║   node scripts/bake_parts_local.mjs --probe                                 ║
// ║   node scripts/bake_parts_local.mjs --bodies                                ║
// ║   node scripts/bake_parts_local.mjs wings tail claws                        ║
// ║   node scripts/bake_parts_local.mjs            # everything in partsRig.js   ║
// ║                                                                            ║
// ║ Mirrors bake_parts_rd.mjs's CLI + output contract EXACTLY (same plan order,  ║
// ║ same public/art/parts/<id>.png, same src/data/partsBaked.json) so the two    ║
// ║ are drop-in swappable. What changes is HOW the three cloud-only features are ║
// ║ replaced:                                                                   ║
// ║   reference_images → an IP-Adapter pass that feeds the already-baked BODY    ║
// ║                      sprite in as a style reference, so every head/attachment║
// ║                      inherits its palette + line weight (--ref, default on   ║
// ║                      when the IP-Adapter models are installed).              ║
// ║   remove_bg        → generate on flat magenta, then chroma-key with the      ║
// ║                      repo's OWN cutout (src/lab/cutout.js) — the same        ║
// ║                      constants the browser Parts Studio uses. Deliberately   ║
// ║                      NOT rembg: u2net's soft alpha matting rounds off the    ║
// ║                      hard pixel edges that make this art style read.         ║
// ║   check_cost       → nothing to price. Local generation is free; the only    ║
// ║                      budget is wall-clock, reported per image.               ║
// ║                                                                            ║
// ║ Zero dependencies (node:fetch + node:zlib via scripts/png.mjs) to match the  ║
// ║ RD script — nothing new enters package.json for a dev-only bake tool.        ║
// ║ UPDATE WHEN: the ComfyUI graph, the style lock, or the part list changes.   ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { PART_SUBJECT, BODY_PART_IDS } from '../src/data/partSubjects.js';
import { keyMagenta, alphaBounds, assessCut } from '../src/lab/cutout.js';
import { decodePNG, encodePNG, resizeRGBA, cropRGBA, padRGBA } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const OUT_DIR = join(ROOT, 'public', 'art', 'parts');
const MANIFEST = join(ROOT, 'src', 'data', 'partsBaked.json');

// ── CLI (same shape as bake_parts_rd.mjs) ────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : def;
};
const HOST = String(flag('--host', 'http://127.0.0.1:8188'));
const SIZE = Number(flag('--size', 256));            // max output edge (contract: ≤256)
const GEN = Number(flag('--gen', 1024));             // SDXL native canvas
const STEPS = Number(flag('--steps', 28));
const CFG = Number(flag('--cfg', 7));
const SEED = Number(flag('--seed', 12345));          // stable → reproducible re-bakes
const CKPT = String(flag('--ckpt', 'sd_xl_base_1.0.safetensors'));
const LORA = String(flag('--lora', 'pixel-art-xl.safetensors'));
const LORA_W = Number(flag('--lora-weight', 1.0));
// IP-Adapter strength. Kept LOW on purpose: at 0.55 the adapter dragged the
// reference body's whole COMPOSITION across and rendered `head-beast` as another
// full body. We want palette + line weight to travel, not layout.
const REF_W = Number(flag('--ref-weight', 0.35));
const NO_REF = argv.includes('--no-ref');            // disable reference conditioning
const PROBE = argv.includes('--probe');
const BODIES_ONLY = argv.includes('--bodies');
// Keep the pre-cutout 1024px renders. They go to a temp dir, NOT into
// public/art/parts — 46 of them is ~40MB of debris one `git add .` away from the
// repo. Having them around means the cutout can be re-tuned and re-applied with
// no GPU cost at all, which is how the shadow thresholds above were settled.
const KEEP_RAW = argv.includes('--keep-raw');
const RAW_DIR = join(tmpdir(), 'chimera-bake-raw');
const KEY_MODE = String(flag('--key', 'flood'));     // 'flood' (default) | 'magenta'
const RETRIES = Number(flag('--retries', 2));        // seed rerolls when clipped
const MAX_RING = Number(flag('--max-ring', 0.45));   // above this = framed icon
// Backdrop-distance thresholds, set from a measured histogram rather than by eye.
// Sampling the bottom strip of a body render (where the cast shadow lives) gives
// three well-separated populations:
//     ~20   backdrop          (178k px)
//    ~160   the cast shadow   (17k px)
//    ~240+  the sprite itself (outline, then body)
// So there is a clean empty gap between 175 and 240 to put the cut in. Earlier
// values of 110/155 stopped the flood BELOW the shadow, which is why it kept
// surviving as a grey ghost no matter how the negative prompt was worded.
const HARD = Number(flag('--key-hard', 185));        // ≤ this from backdrop → fully cut
const SOFT = Number(flag('--key-soft', 220));        // ≥ this → subject, flood stops
const positional = argv.filter((a) => !a.startsWith('--') && PART_SUBJECT[a]);

// Which parts to bake, and in what order (bodies ALWAYS first so refs exist).
// Identical planning rules to the RD script.
function plan() {
  if (PROBE) return ['body-beast', 'head-beast'];    // a body + a head that refs it
  if (BODIES_ONLY) return [...BODY_PART_IDS];
  const want = positional.length ? positional : allRigParts();
  const bodies = BODY_PART_IDS.filter((b) => want.includes(b));
  const rest = want.filter((p) => !p.startsWith('body-'));
  return [...new Set([...bodies, ...rest])];
}

function allRigParts() {
  const src = readFileSync(join(ROOT, 'src', 'data', 'partsRig.js'), 'utf8');
  return [...src.matchAll(/\{ id: '([\w-]+)'/g)].map((m) => m[1]).filter((id) => PART_SUBJECT[id]);
}

// ── manifest ──────────────────────────────────────────────────────────────────
const loadManifest = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {});
const saveManifest = (m) => writeFileSync(MANIFEST, `${JSON.stringify(m, null, 2)}\n`);

// ── the STYLE LOCK ────────────────────────────────────────────────────────────
// Coherence is the whole point of this bake, so every part is generated through
// ONE unchanging style clause. Nothing here may vary per part — the only thing
// that changes between requests is PART_SUBJECT[id].
//
// PROMPT ORDER IS LOad-BEARING. SDXL's text encoder works in 77-token chunks and
// the first chunk dominates; a first draft that led with the style block pushed
// the SUBJECT into a later chunk and produced two near-identical full-body ogres
// for `body-beast` AND `head-beast`. Subject first, always.
const STYLE = 'pixel art, 16-bit sprite, bold dark outline, flat cel shading, limited palette';

// FRAMING — the fix for "cut off / not stampable". Diffusion fills the canvas by
// default; we only need the shape UNCLIPPED (the tight crop + margin is applied
// in post), so this asks for whole-object visibility rather than "tiny".
// Scale is pulled DOWN from the negative side only ("close-up", "filling the
// frame"). It is tempting to push "wide shot / zoomed out" in the positive, but
// that reads as *show the whole animal* and turned `head-beast` into a full-body
// creature — the framing words and the subject words fight each other. Keep this
// clause about ISOLATION; let the negative handle zoom.
const FRAMING = 'isolated single object, centered, whole shape fully visible, empty margin on all sides';

// The backdrop.
//
// This asked for magenta at first — the classic chroma-key colour, and what the
// old AGY sprite pipeline used. On SDXL it backfired badly: a saturated colour
// word bleeds into the SUBJECT, and the probe came back with a magenta lion on a
// magenta field, i.e. subject ≈ backdrop, the single worst case for keying.
//
// Plain white is safe here for a structural reason: the style lock mandates a
// BOLD DARK OUTLINE around every sprite, so the border flood always halts on that
// outline no matter what colour the interior is. Even bone-white parts (`teeth`,
// `shell`) stay intact, and white is SDXL's natural product-shot backdrop so it
// tints nothing.
const BACKDROP = 'on a plain solid white background';

// Heads need a predictable seam so they stamp onto the body's neck.
const isHead = (id) => id.startsWith('head-');
const NECK = 'with a short flat neck stump at the bottom centre';

// KNOWN LIMITATION — bodies come back WITH a head.
//
// PART_SUBJECT asks for a HEADLESS torso, and three escalating attempts failed to
// get one: a plain "head" negative, a weighted "(head:1.8), (face:1.6)" negative,
// and a positive clause describing the neck ending in a cut stump. SDXL treats a
// head as obligatory on a quadruped. Worth knowing: the paid Retro Diffusion
// reference has exactly the same trait — the shipped body-beast.png is a full
// beast WITH a head — so this is a property of the model class, not of going
// local, and the rig already accounts for it (BODY_ANCHORS puts the head slot
// right on top of the body's own head, which covers most of it).
//
// The STUMP clause is deliberately NOT applied: it did not remove the head AND it
// dragged the body's palette off the locked style, which then desynced every head
// generated against the previous body. Left here as a record so it is not retried.

const NEGATIVE_BASE = 'photograph, photorealistic, 3d render, smooth gradient, blurry, soft focus, '
  + 'text, watermark, signature, multiple subjects, duplicate, '
  + 'cropped, cut off, close-up, extreme close-up, macro, zoomed in, filling the frame, '
  + 'drop shadow, cast shadow, shadow, ground, floor, scenery, '
  + 'background detail, full body, full creature, character, scene, '
  // "isolated single object / 16-bit sprite" reads to SDXL as ICON, and a large
  // slice of the first full batch came back as a subject inside a rounded-rect
  // card border. Plain "border, frame" was already present and lost; these need
  // emphasis and the whole UI-asset family named explicitly.
  + '(border:1.5), (frame:1.5), (rounded rectangle:1.4), picture frame, card, '
  + 'icon, badge, sticker, button, UI element, inventory slot, item box, tooltip';

// SCOPED negatives. An earlier version put "person, warrior, tree, plant" in the
// base negative to stop the model completing a fragment into a whole organism.
// It did not fix those parts AND it wrecked the palette: suppressing "tree,
// plant" globally drains green, so the locked sage-green house style drifted to
// brown-and-white across all 46 parts at once. "tree" is also self-contradictory
// for `roots`, which genuinely IS part of a plant.
//
// So these now apply only where the failure actually occurs.
const WEAPON_NEG = '(person:1.4), man, warrior, soldier, knight, armour, '
  + 'hand, arm, holding, wielding, whole figure';

/**
 * Diffusion models cannot follow a negation inside a positive prompt — asking for
 * "a HEADLESS torso, NO head" reliably renders a head, which is exactly what the
 * first probe did. PART_SUBJECT is the shared source of truth (the browser studio
 * and the RD script read the same strings), so rather than fork the text we LIFT
 * its negations out mechanically and re-file them where they actually work: the
 * negative prompt.
 *
 *   'a HEADLESS ... torso ..., NO head and NO neck'  →  negative: 'head, neck'
 *
 * @returns {string} extra negative terms for this part, '' when it has none
 */
export function negationsFrom(subject) {
  const out = new Set();
  for (const m of subject.matchAll(/\bno\s+([a-z]+)/gi)) out.add(m[1].toLowerCase());
  if (/\bheadless\b/i.test(subject)) { out.add('head'); out.add('face'); }
  // "detached" is the tell that this part is a FRAGMENT, and fragments are what
  // the model keeps completing into the whole organism (`beak` → an entire bird,
  // `wings` → a flying bird, `hooves` → a whole deer). Scoped to these parts on
  // purpose: the same terms in the global negative drained the palette.
  if (/\bdetached\b/i.test(subject)) {
    out.add('body'); out.add('creature');
    out.add('whole animal'); out.add('full figure'); out.add('standing animal');
  }
  return [...out].join(', ');
}

// A plain mention is not enough to suppress a part the model considers obligatory
// — an unweighted "head" still rendered a head on every four-legged body, because
// "beast body" pulls a head in hard. These get emphasis so the negative can win.
const EMPHATIC = { head: 1.8, face: 1.6, body: 1.3, creature: 1.3 };
const weigh = (t) => (EMPHATIC[t] ? `(${t}:${EMPHATIC[t]})` : t);

export function promptFor(partId) {
  const subject = PART_SUBJECT[partId];
  // Strip the negated clauses from the positive text — they only ever act as
  // suggestions of the thing we do not want.
  const positive = subject
    .replace(/,?\s*\bno\s+[a-z]+\s+and\s+no\s+[a-z]+/gi, '')
    .replace(/,?\s*\bno\s+[a-z]+/gi, '')
    .replace(/\bHEADLESS\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return [
    positive,
    isHead(partId) ? NECK : '',
    FRAMING,
    BACKDROP,
    STYLE,
  ].filter(Boolean).join(', ');
}

export function negativeFor(partId) {
  let terms = negationsFrom(PART_SUBJECT[partId]).split(', ').filter(Boolean);
  // A head's subject text says "no neck" meaning no NECK-AND-BODY below it — but
  // the rig needs the short stump the NECK scaffold asks for, so negating "neck"
  // here would fight our own positive prompt. "body" still carries the intent.
  if (isHead(partId)) terms = terms.filter((t) => t !== 'neck');
  const parts = [
    terms.map(weigh).join(', '),
    partId.startsWith('w-') ? WEAPON_NEG : '',
    NEGATIVE_BASE,
  ].filter(Boolean);
  return parts.join(', ');
}

// ── ComfyUI graph ─────────────────────────────────────────────────────────────
/**
 * Build the API-format prompt graph for one part.
 * @param {string} partId
 * @param {string|null} refImage  a filename already in ComfyUI's input dir; when
 *   present an IP-Adapter pass conditions the model on that body sprite so the
 *   palette + line weight carry across the whole set (replaces RD reference_images).
 */
function buildGraph(partId, refImage, seed = SEED) {
  const g = {
    ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CKPT } },
    lora: {
      class_type: 'LoraLoader',
      inputs: {
        model: ['ckpt', 0], clip: ['ckpt', 1],
        lora_name: LORA, strength_model: LORA_W, strength_clip: LORA_W,
      },
    },
    pos: { class_type: 'CLIPTextEncode', inputs: { text: promptFor(partId), clip: ['lora', 1] } },
    neg: { class_type: 'CLIPTextEncode', inputs: { text: negativeFor(partId), clip: ['lora', 1] } },
    latent: { class_type: 'EmptyLatentImage', inputs: { width: GEN, height: GEN, batch_size: 1 } },
    sampler: {
      class_type: 'KSampler',
      inputs: {
        seed, steps: STEPS, cfg: CFG,
        sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,
        model: ['lora', 0], positive: ['pos', 0], negative: ['neg', 0], latent_image: ['latent', 0],
      },
    },
    vae: { class_type: 'VAEDecode', inputs: { samples: ['sampler', 0], vae: ['ckpt', 2] } },
    save: { class_type: 'SaveImage', inputs: { images: ['vae', 0], filename_prefix: `chimera/${partId}` } },
  };

  if (refImage) {
    // IP-Adapter: the model half of `lora` is re-routed through the adapter so the
    // sampler sees a model already conditioned on the reference body sprite.
    g.refimg = { class_type: 'LoadImage', inputs: { image: refImage } };
    g.ipmodel = { class_type: 'IPAdapterModelLoader', inputs: { ipadapter_file: IPA_FILE } };
    g.clipvis = { class_type: 'CLIPVisionLoader', inputs: { clip_name: CLIPVIS_FILE } };
    g.ipa = {
      class_type: 'IPAdapterAdvanced',
      inputs: {
        model: ['lora', 0], ipadapter: ['ipmodel', 0], image: ['refimg', 0], clip_vision: ['clipvis', 0],
        weight: REF_W, weight_type: 'style transfer', combine_embeds: 'concat',
        start_at: 0.0, end_at: 1.0, embeds_scaling: 'V only',
      },
    };
    g.sampler.inputs.model = ['ipa', 0];
  }
  return g;
}

// Filled in by detectRefSupport(); null when IP-Adapter isn't installed.
let IPA_FILE = null;
let CLIPVIS_FILE = null;

// ── ComfyUI HTTP ──────────────────────────────────────────────────────────────
const CLIENT_ID = `chimera-bake-${process.pid}`;

async function api(path, init) {
  const r = await fetch(`${HOST}${path}`, init);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r;
}

/** Is a ComfyUI reachable, and does it have the nodes/models we need? */
async function detectRefSupport() {
  const info = await (await api('/object_info')).json();
  const hasNodes = info.IPAdapterAdvanced && info.IPAdapterModelLoader && info.CLIPVisionLoader;
  if (!hasNodes) return false;
  const ipaOpts = info.IPAdapterModelLoader?.input?.required?.ipadapter_file?.[0] ?? [];
  const cvOpts = info.CLIPVisionLoader?.input?.required?.clip_name?.[0] ?? [];
  // Prefer the SDXL ViT-H adapter; any SDXL adapter beats none.
  IPA_FILE = ipaOpts.find((f) => /sdxl.*vit-h/i.test(f)) || ipaOpts.find((f) => /sdxl/i.test(f)) || null;
  CLIPVIS_FILE = cvOpts.find((f) => /vit-h|h14|bigG/i.test(f)) || cvOpts[0] || null;
  return Boolean(IPA_FILE && CLIPVIS_FILE);
}

/** Upload a local PNG into ComfyUI's input dir so LoadImage can reference it. */
async function uploadImage(buf, name) {
  const fd = new FormData();
  fd.append('image', new Blob([buf], { type: 'image/png' }), name);
  fd.append('overwrite', 'true');
  const r = await api('/upload/image', { method: 'POST', body: fd });
  return (await r.json()).name;
}

async function queue(graph) {
  const r = await api('/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: CLIENT_ID }),
  });
  const data = await r.json();
  if (!data.prompt_id) throw new Error(`queue rejected: ${JSON.stringify(data).slice(0, 300)}`);
  return data.prompt_id;
}

/** Poll /history until the prompt finishes; returns its first output image ref. */
async function awaitImage(promptId, { timeoutMs = 15 * 60_000 } = {}) {
  const started = Date.now();
  for (;;) {
    const hist = await (await api(`/history/${promptId}`)).json();
    const entry = hist[promptId];
    if (entry) {
      const status = entry.status ?? {};
      if (status.status_str === 'error' || status.completed === false) {
        const msg = (entry.status?.messages ?? []).flat().find((m) => typeof m === 'object');
        throw new Error(`generation failed: ${JSON.stringify(msg ?? status).slice(0, 300)}`);
      }
      for (const out of Object.values(entry.outputs ?? {})) {
        if (out.images?.length) return out.images[0];
      }
      if (status.completed) throw new Error('finished with no image output');
    }
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for ComfyUI');
    await new Promise((res) => setTimeout(res, 750));
  }
}

async function fetchImage({ filename, subfolder, type }) {
  const q = new URLSearchParams({ filename, subfolder: subfolder ?? '', type: type ?? 'output' });
  const r = await api(`/view?${q}`);
  return Buffer.from(await r.arrayBuffer());
}

// ── cutout ────────────────────────────────────────────────────────────────────
/**
 * Knock out the backdrop by FLOOD FILL from the border, not by colour alone.
 *
 * Why not just keyMagenta(): that is a per-pixel colour test, and this part list
 * contains subjects that are legitimately magenta-adjacent — `tentacle`,
 * `miasma`, `ichor`, `shard`, anything Void-attuned. A global key punches holes
 * straight through them, and the very first test render came back a purple beast
 * head on a pink field, which a colour key would have half-dissolved.
 *
 * The backdrop's real defining property is topological, not chromatic: it is the
 * flat region CONNECTED TO THE BORDER. Flooding inward from the edges keeps any
 * enclosed pixel safe at any hue, so a purple tentacle survives on a magenta
 * field. It also makes the key colour-agnostic — if a future style lock swaps the
 * backdrop to green, nothing here changes.
 *
 * Edges get a soft band: pixels the flood reached but which have drifted toward
 * the subject get partial alpha plus a despill that pulls the backdrop's hue out,
 * so no pink halo survives the downscale.
 *
 * @returns {{cleared:number, bg:number[]}}
 */
// Thresholds are generous on purpose. The model keeps drawing a soft grey CAST
// SHADOW under grounded parts despite the negative prompt, and at a tight
// threshold that shadow survived as a ghost blob at ~30% alpha. Because the flood
// is topological it can afford to be greedy: it physically cannot reach an
// interior highlight, since the style's bold dark outline stops it at the
// silhouette. So anything the flood DOES reach and that is anywhere near the
// backdrop is safe to erase — shadow included.
export function floodKey(img, { hard = HARD, soft = SOFT } = {}) {
  const { width: w, height: h, data } = img;

  // Backdrop reference = median of the four corner patches (robust to a stray
  // dark pixel in one corner in a way a plain mean is not).
  const S = 10, samples = [[], [], []];
  for (const [cx, cy] of [[0, 0], [w - S, 0], [0, h - S], [w - S, h - S]]) {
    for (let y = cy; y < cy + S; y++) {
      for (let x = cx; x < cx + S; x++) {
        const i = (y * w + x) * 4;
        samples[0].push(data[i]); samples[1].push(data[i + 1]); samples[2].push(data[i + 2]);
      }
    }
  }
  const bg = samples.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (seen[p]) return;
    if (dist(p * 4) >= soft) return;                 // clearly subject — stop the flood
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  let cleared = 0;
  for (let p = 0; p < w * h; p++) {
    if (!seen[p]) continue;                          // enclosed → always keep
    const i = p * 4, d = dist(i);
    if (d <= hard) { data[i + 3] = 0; cleared++; continue; }
    // Soft edge: feather alpha and pull the backdrop hue back out of the pixel.
    const t = (d - hard) / (soft - hard);            // 0 = backdrop, 1 = subject
    data[i + 3] = Math.round(255 * t);
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - bg[c] * (1 - t)) / t)));
    }
  }
  return { cleared, bg };
}

/**
 * Raw 1024px PNG off the GPU → the tight, transparent, ≤SIZE sprite the rig
 * expects. Crop bounds + the quality read come from the repo's OWN cutout module
 * (src/lab/cutout.js), so a sprite baked here and one cut in the browser Parts
 * Studio stay interchangeable.
 */
function cutout(rawPng) {
  const img = decodePNG(rawPng);
  // --key magenta reproduces the browser studio's exact per-pixel algorithm;
  // the default flood key is strictly safer on magenta-adjacent subjects.
  if (KEY_MODE === 'magenta') keyMagenta(img.data);   // src/lab/cutout.js
  else floodKey(img);

  const quality = assessCut(img.data, img.width, img.height);
  if (quality.empty) throw new Error('nothing but background — the subject keyed away');

  const b = alphaBounds(img.data, img.width, img.height);
  let out = cropRGBA(img, b);

  // Downscale so the LONGEST edge (incl. the margin we are about to add) ≤ SIZE.
  const pad = Math.max(2, Math.round(SIZE * 0.05));       // small margin, per the contract
  const budget = SIZE - pad * 2;
  if (Math.max(out.width, out.height) > budget) {
    const s = budget / Math.max(out.width, out.height);
    out = resizeRGBA(out, Math.max(1, Math.round(out.width * s)), Math.max(1, Math.round(out.height * s)));
  }
  out = padRGBA(out, pad);
  return {
    png: encodePNG(out), width: out.width, height: out.height,
    quality, ring: borderRing(out),
  };
}

/**
 * Fraction of a rectangular ring just inside the sprite's bounds that is opaque.
 *
 * SDXL likes to answer "isolated single object, 16-bit sprite" with a FRAMED ICON
 * — the subject inside a rounded-rect card border. The cutout keeps the frame,
 * correctly, because the frame genuinely is the outermost enclosed shape; the rig
 * then gets a box instead of a part. Coverage does not separate these (a thin
 * frame around a small subject scores low), but tracing the ring does: a frame
 * lights up nearly every ring pixel while an organic silhouette touches few.
 *
 * Measured over a real batch the two populations are far apart —
 *   framed:  0.66 … 0.92   (head-humanoid, breath, w-sword, w-dagger, carapace…)
 *   organic: 0.00 … 0.30   (bodies, heads, most weapons)
 * so the cut sits at 0.45, comfortably inside the gap.
 */
export function borderRing(img) {
  const { width: w, height: h, data } = img;
  const m = Math.round(Math.min(w, h) * 0.06);
  if (w - 2 * m < 3 || h - 2 * m < 3) return 0;
  let hit = 0, total = 0;
  const at = (x, y) => { total++; if (data[(y * w + x) * 4 + 3] > 8) hit++; };
  for (let x = m; x < w - m; x++) { at(x, m); at(x, h - 1 - m); }
  for (let y = m; y < h - m; y++) { at(m, y); at(w - 1 - m, y); }
  return total ? hit / total : 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const parts = plan();

  let refOk = false;
  try {
    refOk = !NO_REF && (await detectRefSupport());
  } catch (e) {
    console.error(`✗ cannot reach ComfyUI at ${HOST} — is it running?\n  ${e.message}`);
    process.exit(1);
  }

  console.log(`Plan: ${parts.length} part(s) · ${CKPT} + ${LORA}@${LORA_W} · ${GEN}px → ≤${SIZE}px · seed ${SEED}`);
  console.log(`  reference-lock: ${refOk ? `IP-Adapter ${IPA_FILE} @ ${REF_W}` : 'OFF (style/seed lock only)'}`);
  console.log(`  ${parts.join(', ')}\n`);

  mkdirSync(OUT_DIR, { recursive: true });
  if (KEEP_RAW) { mkdirSync(RAW_DIR, { recursive: true }); console.log(`  raw renders → ${RAW_DIR}\n`); }
  const manifest = loadManifest();

  // ── reference strategy (two tiers) ────────────────────────────────────────
  // The brief asks each part to reference "the relevant body". Taken literally
  // that means head-humanoid→body-humanoid etc., but on its own it would produce
  // THREE style islands, because the three bodies are generated independently and
  // nothing ties them to each other. So:
  //
  //   tier 1  the first body baked becomes the STYLE ANCHOR (it references
  //           nothing — it is what defines the house style), and the other two
  //           bodies reference it, pulling all three onto one palette.
  //   tier 2  a head prefers its OWN body type when that body has been baked;
  //           every other attachment falls back to the anchor.
  //
  // Net effect: one locked style across the whole set, with heads additionally
  // matched to the torso they will actually sit on.
  const uploaded = {};              // partId → filename inside ComfyUI's input dir
  let anchorRef = null;

  const registerRef = async (id, buf) => {
    if (!refOk) return;
    uploaded[id] = await uploadImage(buf, `chimera-ref-${id}.png`);
    anchorRef ??= uploaded[id];
  };
  const refFor = (partId) => {
    if (!refOk) return null;
    if (isHead(partId)) return uploaded[`body-${partId.slice(5)}`] ?? anchorRef;
    return anchorRef;
  };

  // Bodies ALREADY on disk seed the references, so re-baking one head still
  // matches the committed body without paying to regenerate it (as the RD script
  // did). Anchor first so it wins the ??= above.
  if (refOk) {
    const onDisk = BODY_PART_IDS.filter(
      (id) => existsSync(join(OUT_DIR, `${id}.png`)) && !parts.includes(id),
    );
    for (const id of onDisk) await registerRef(id, readFileSync(join(OUT_DIR, `${id}.png`)));
    if (onDisk.length) console.log(`  (style reference: ${onDisk.join(', ')} already on disk)\n`);
  }

  let ok = 0;
  const times = [];
  for (const p of parts) {
    process.stdout.write(`  bake   ${p.padEnd(16)} …`);
    const t0 = Date.now();
    try {
      const ref = refFor(p);

      // Two failure modes are worth spending a seed reroll on, because neither can
      // be repaired after the fact:
      //   touchesEdge — the subject was CLIPPED; those pixels are simply gone and
      //     the part would stamp into the rig with a flat sawn-off side.
      //   ring        — the render came back as a FRAMED ICON; see borderRing().
      // Framing varies enough between seeds that a reroll usually lands clean.
      let cut = null, raw = null;
      for (let attempt = 0; attempt <= RETRIES; attempt++) {
        const image = await awaitImage(await queue(buildGraph(p, ref, SEED + attempt * 1013)));
        raw = await fetchImage(image);
        cut = cutout(raw);
        if (!cut.quality.touchesEdge && cut.ring <= MAX_RING) break;
        if (attempt < RETRIES) process.stdout.write(' ↻');
      }
      if (KEEP_RAW) writeFileSync(join(RAW_DIR, `${p}.raw.png`), raw);
      writeFileSync(join(OUT_DIR, `${p}.png`), cut.png);
      manifest[p] = `art/parts/${p}.png`;
      saveManifest(manifest);                            // persist per part (crash-safe)

      // Every baked body joins the reference pool; the first also becomes the
      // anchor that the other bodies and all attachments inherit.
      if (p.startsWith('body-')) await registerRef(p, cut.png);

      const secs = (Date.now() - t0) / 1000;
      times.push(secs);
      ok++;
      const warn = (cut.quality.touchesEdge ? ' ⚠ touches edge' : '')
        + (cut.ring > MAX_RING ? ` ⚠ ring ${cut.ring.toFixed(2)} (framed?)` : '');
      console.log(` ✓  ${cut.width}×${cut.height}  ${secs.toFixed(1)}s${warn}`);
    } catch (e) {
      console.log(` ✗  ${e.message}`);
    }
  }

  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  console.log(`\nDone. ${ok}/${parts.length} baked, avg ${avg.toFixed(1)}s/image (free — local GPU).`);
  console.log('Wrote PNGs to public/art/parts/ and updated src/data/partsBaked.json.');
  console.log('Preview: npm run dev → /lab.html → 🧬 Fuse tab, then commit the PNGs + manifest.');
}

// Only bake when RUN as a script. Without this guard, importing anything from
// this file (a test reaching for negationsFrom, say) kicks off a full 46-part
// bake as an import side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('✗', e.message); process.exit(1); });
}
