// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/bake_parts_rd.mjs — bake creature PART sprites with the Retro      ║
// ║ Diffusion API. Zero-dependency Node (global fetch), runs on YOUR machine   ║
// ║ so the key never touches the repo or the browser.                          ║
// ║                                                                            ║
// ║   RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs --probe                 ║
// ║   RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs --bodies                ║
// ║   RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs wings tail claws        ║
// ║                                                                            ║
// ║ Why RD solves what Pollinations could not (all NATIVE API features):       ║
// ║   reference_images  — bodies generated first, then every other part refs   ║
// ║                       them → one coherent style across the whole set.      ║
// ║   remove_bg         — transparent PNG straight from the API (NO chroma-key,║
// ║                       NO cutout step at all).                              ║
// ║   check_cost        — FREE dry run; we price EVERY request before spending.║
// ║                                                                            ║
// ║ SPEND SAFETY (matters — a small prepaid balance):                          ║
// ║   • every request is priced with check_cost FIRST;                         ║
// ║   • the summed price must fit --budget (default $0.40) AND the account's   ║
// ║     real remaining balance, or the run aborts having spent NOTHING;        ║
// ║   • RD auto-refunds a failed generation.                                   ║
// ║ UPDATE WHEN: the RD request shape or the part list changes.                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PART_SUBJECT, BODY_PART_IDS } from '../src/data/partSubjects.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const OUT_DIR = join(ROOT, 'public', 'art', 'parts');
const MANIFEST = join(ROOT, 'src', 'data', 'partsBaked.json');
const API = 'https://api.retrodiffusion.ai/v1/inferences';
const BALANCE_API = 'https://api.retrodiffusion.ai/v1/inferences/credits';

const KEY = process.env.RD_API_KEY;
const HEADERS = { 'Content-Type': 'application/json', 'X-RD-Token': KEY };

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : def;
};
const BUDGET = Number(flag('--budget', 0.40));
const STYLE = String(flag('--style', 'rd_pro__default'));
// RD Pro is FLAT-priced ($0.18/img regardless of size), so 256px costs the same
// as 128px — take the free resolution. (RD Pro caps at 256.)
const SIZE = Number(flag('--size', 256));
const PROBE = argv.includes('--probe');
const BODIES_ONLY = argv.includes('--bodies');
const positional = argv.filter((a) => !a.startsWith('--') && PART_SUBJECT[a]);

// Which parts to bake, and in what order (bodies ALWAYS first so refs exist).
function plan() {
  if (PROBE) return ['body-beast', 'head-beast'];   // 2 imgs: a body + a head that refs it
  if (BODIES_ONLY) return [...BODY_PART_IDS];
  const want = positional.length ? positional : allRigParts();
  // Bake exactly what's asked for; bodies IN the request go first so a same-run
  // body can be referenced by later parts. Bodies NOT requested are NOT added —
  // any already on disk are picked up as references (cheap iteration), and a
  // lone `head-beast` re-bake stays a single $0.18 image.
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

// ── RD requests ────────────────────────────────────────────────────────────────
// FRAMING — the fix for "cut off / not stampable". RD (pixel art) fills the
// canvas by default, cropping the subject at the edges. Force the whole part to
// sit SMALL and CENTERED with a wide transparent margin so nothing is clipped and
// the autocrop finds clean bounds.
const FRAMING = 'The subject is drawn SMALL and CENTERED with a wide empty margin of blank space '
  + 'on ALL FOUR sides — the entire shape fully visible, zoomed out, NOT cropped, NOT touching any edge.';

// Heads need a predictable seam so they stamp onto the body's neck: a short flat
// neck stump at the bottom-centre.
const isHead = (id) => id.startsWith('head-');
const NECK = 'A short flat neck stump at the BOTTOM-CENTRE where it will attach to a body.';

// When referencing the bodies, tell the model to MATCH them, not just be inspired.
const MATCH = 'Use the EXACT same colour palette, shading and outline style as the reference image.';

/** Build the /v1/inferences body for one part. `refs` = base64 body images. */
function reqBody(partId, refs) {
  const hasRefs = refs?.length && STYLE.startsWith('rd_pro');
  const prompt = [
    PART_SUBJECT[partId],
    isHead(partId) ? NECK : '',
    FRAMING,
    hasRefs ? MATCH : '',
  ].filter(Boolean).join(' ');

  const body = {
    prompt,
    prompt_style: STYLE,
    width: SIZE, height: SIZE,
    num_images: 1,
    remove_bg: true,          // transparent PNG straight from the API
    seed: 12345,              // stable so re-bakes are reproducible
  };
  // RD Pro styles accept up to 9 reference images; passing the bodies locks style.
  if (hasRefs) body.reference_images = refs.slice(0, 9);
  return body;
}

async function rd(bodyObj) {
  const r = await fetch(API, { method: 'POST', headers: HEADERS, body: JSON.stringify(bodyObj) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.detail?.message || (Array.isArray(data?.detail) ? data.detail[0]?.msg : '') || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Free dry run → dollars this request would cost. */
async function priceOf(partId) {
  const data = await rd({ ...reqBody(partId), check_cost: true });
  return Number(data.balance_cost ?? 0);
}

async function remainingBalance() {
  const r = await fetch(BALANCE_API, { headers: HEADERS });
  if (!r.ok) throw new Error(`balance check failed (HTTP ${r.status}) — is the key valid?`);
  return Number((await r.json()).balance ?? 0);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!KEY || !KEY.startsWith('rdpk-')) {
    console.error('Set your key first:  RD_API_KEY=rdpk-… node scripts/bake_parts_rd.mjs --probe');
    process.exit(1);
  }
  const parts = plan();
  console.log(`Plan: ${parts.length} part(s) · style ${STYLE} · ${SIZE}px · budget cap $${BUDGET.toFixed(2)}`);
  console.log(`  ${parts.join(', ')}\n`);

  // 1) balance + FREE price check for every part BEFORE spending anything.
  const balance = await remainingBalance();
  console.log(`Account balance: $${balance.toFixed(3)}`);
  let total = 0;
  const prices = {};
  for (const p of parts) {
    prices[p] = await priceOf(p);
    total += prices[p];
    console.log(`  price  ${p.padEnd(16)} $${prices[p].toFixed(3)}`);
  }
  console.log(`\nProjected total: $${total.toFixed(3)}`);

  if (total > BUDGET) {
    console.error(`✗ ABORT: $${total.toFixed(3)} exceeds --budget $${BUDGET.toFixed(2)}. Nothing was generated.`);
    console.error('  Lower the count, use --style rd_fast__game_asset (cheaper, but no reference-image coherence), or raise --budget.');
    process.exit(2);
  }
  if (total > balance) {
    console.error(`✗ ABORT: $${total.toFixed(3)} exceeds your balance $${balance.toFixed(3)}. Nothing was generated.`);
    process.exit(2);
  }

  // 2) generate, bodies first; collect body base64 to use as references.
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = loadManifest();
  let spent = 0;

  // Seed references from bodies ALREADY on disk, so you can re-bake just a head
  // ($0.18) and it still matches the committed body — no need to re-pay for the
  // body every iteration.
  const bodyRefs = [];
  for (const id of BODY_PART_IDS) {
    const f = join(OUT_DIR, `${id}.png`);
    if (existsSync(f) && !parts.includes(id)) bodyRefs.push(readFileSync(f).toString('base64'));
  }
  if (bodyRefs.length) console.log(`  (referencing ${bodyRefs.length} body sprite(s) already on disk)\n`);

  for (const p of parts) {
    process.stdout.write(`  bake   ${p.padEnd(16)} …`);
    try {
      const refs = p.startsWith('body-') ? [] : bodyRefs;
      const data = await rd(reqBody(p, refs));
      const b64 = data.base64_images?.[0];
      if (!b64) throw new Error('no image returned');
      writeFileSync(join(OUT_DIR, `${p}.png`), Buffer.from(b64, 'base64'));
      manifest[p] = `art/parts/${p}.png`;
      saveManifest(manifest);                       // persist after EACH part (crash-safe)
      spent += Number(data.balance_cost ?? prices[p]);
      if (p.startsWith('body-') && bodyRefs.length < 9) bodyRefs.push(b64);
      console.log(` ✓  ($${spent.toFixed(3)} spent, ~$${Number(data.remaining_balance ?? 0).toFixed(3)} left)`);
    } catch (e) {
      console.log(` ✗  ${e.message}`);
    }
  }

  console.log(`\nDone. Spent ~$${spent.toFixed(3)}. Wrote PNGs to public/art/parts/ and updated src/data/partsBaked.json.`);
  console.log('Preview in the Lab (Parts tab, or fuse two creatures), then commit the PNGs + manifest.');
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
