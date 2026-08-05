// Validates the creature-art PROMPT LAYER (data/artStyle.js) and the image-URL
// builder (ai/imageProvider.js) — everything about live art generation EXCEPT the
// network hop, which needs a browser. Guards the SUBJECT+SIZE+STYLE contract and
// the sync between the JS style and scripts/gen_roster.py. Run: test:artprompt

import { readFileSync } from 'fs';
import { ART_STYLE_VARIANT_B, creatureArtSubject, creatureArtPrompt } from './artStyle.js';
import { pollinationsUrl, seedFor, PROVIDERS, DEFAULT_PROVIDER, creatureImageRequest } from '../ai/imageProvider.js';
import { FORM_ORDER } from './forms.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const IRONFANG = {
  id: 'fus_abc', name: 'Ironfang', biology: ['Humanoid', 'Beast'], class: ['Warrior'],
  family: 'Mammalian', attunement: ['Physical', 'Energy'], weapons: ['Hammer', 'Shield'],
  anatomy: ['Teeth'], subtypes: ['Giant'], size: 'regular',
};
const SPORE = {
  id: 'gen_x', name: 'Bramblebloom', biology: ['Aberration'], class: null,
  manifestation: 'Fungal', attunement: ['Nature'], anatomy: ['Spore', 'Cilia'], size: 'boss',
};

console.log('Subject is derived from the TAXONOMY (so generated/fused creatures are paintable):');
{
  const s = creatureArtSubject(IRONFANG);
  ok(s.includes('Ironfang'), 'names the creature');
  ok(/Chimera/.test(s), `reads its fused body type — got: ${s}`);
  ok(/warhammer/.test(s) && /shield/.test(s), 'factors become picture words, not raw tags');
  ok(!/\bHammer\b/.test(s), 'raw tag keys never leak into the prompt');
  const s2 = creatureArtSubject(SPORE);
  ok(/spore/i.test(s2), `aberrant features described — got: ${s2}`);
  ok(creatureArtSubject(null).length > 0, 'degenerate input still yields a subject');
}

console.log('Prompt = SUBJECT + SIZE + STYLE:');
{
  const p = creatureArtPrompt(IRONFANG);
  ok(p.startsWith('Subject:'), 'leads with the subject');
  ok(p.includes('Style:'), 'carries the style block');
  ok(p.includes(ART_STYLE_VARIANT_B), 'style is the canonical Variant B, verbatim');
  ok(/FULL-BLEED/.test(p), 'keeps the full-bleed clause (no white border)');
  // the size clause must actually change with the form
  const seen = new Set(FORM_ORDER.map((f) => creatureArtPrompt(IRONFANG, { form: f })));
  ok(seen.size === FORM_ORDER.length, `every form produces a distinct prompt (${seen.size}/${FORM_ORDER.length})`);
  ok(/BOSS|colossal|towering/i.test(creatureArtPrompt(SPORE, { form: 'boss' })), 'a boss reads as a boss');
  // an authored physical description wins over the derived subject
  const authored = creatureArtPrompt({ ...IRONFANG, description: 'a rusted iron wolf' });
  ok(authored.includes('rusted iron wolf'), 'authored description overrides the derived subject');
}

console.log('Style stays in sync with the dev baker (scripts/gen_roster.py):');
{
  const py = readFileSync(new URL('../../scripts/gen_roster.py', import.meta.url), 'utf8');
  // compare on letters only — the Python literal is wrapped across lines
  const norm = (s) => s.replace(/[^a-z]/gi, '').toLowerCase();
  const pyStyle = norm((py.match(/STYLE = \(([\s\S]*?)\)\n/) ?? [])[1] ?? '');
  ok(pyStyle.length > 200, 'found the STYLE literal in gen_roster.py');
  ok(pyStyle === norm(ART_STYLE_VARIANT_B),
    'gen_roster.py STYLE and ART_STYLE_VARIANT_B are the SAME text (drift guard)');
}

console.log('Image URL builder:');
{
  const url = pollinationsUrl({ prompt: 'a wolf, flat 2D', width: 384, height: 384, seed: 42 });
  ok(url.startsWith('https://image.pollinations.ai/prompt/'), 'hits the pollinations endpoint');
  ok(!/\s/.test(url), 'prompt is URL-encoded (no raw spaces)');
  ok(/[?&]seed=42(&|$)/.test(url), 'passes the seed');
  ok(/[?&]width=384(&|$)/.test(url) && /[?&]height=384(&|$)/.test(url), 'passes dimensions');
  ok(/[?&]nologo=true(&|$)/.test(url), 'asks for no watermark');
  ok(/[?&]model=flux(&|$)/.test(url), 'defaults to FLUX');
  // a prompt with characters that would break a URL
  const nasty = pollinationsUrl({ prompt: 'a "quoted" wolf & a #hash / slash?', seed: 1 });
  ok(!/["#]/.test(nasty.split('?')[0]), 'escapes quotes/# in the path');
  ok(nasty.split('?').length === 2, 'stray ? cannot inject a second query string');
  // over-long prompts are clamped rather than producing an unusable URL
  ok(pollinationsUrl({ prompt: 'x'.repeat(5000) }).length < 3000, 'over-long prompt is clamped');
}

console.log('Provider seam + determinism:');
{
  ok(PROVIDERS[DEFAULT_PROVIDER], 'the default provider exists');
  ok(PROVIDERS[DEFAULT_PROVIDER].needsKey === false,
    'the DEFAULT provider needs NO key — the site is public and static');
  for (const [id, p] of Object.entries(PROVIDERS)) {
    ok(typeof p.build === 'function', `${id}: implements build()`);
    ok(typeof p.label === 'string' && p.label.length > 0, `${id}: has a label`);
  }
  ok(PROVIDERS.none.build({}).url === null, 'the "off" provider yields no url');

  ok(seedFor('ironfang') === seedFor('ironfang'), 'seed is deterministic');
  ok(seedFor('ironfang') !== seedFor('voltfang'), 'different creatures get different seeds');
  const a = creatureImageRequest(IRONFANG), b = creatureImageRequest(IRONFANG);
  ok(a.url === b.url, 'the same creature always requests the SAME portrait');
  ok(creatureImageRequest(SPORE).url !== a.url, 'a different creature requests a different portrait');
  ok(a.prompt.includes('Ironfang'), 'the request carries the composed prompt');
}

console.log(`art-prompt: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
