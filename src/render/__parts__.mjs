// Validates the Cassette-Beasts-style PARTS RIG: part selection from taxonomy,
// anchor placement, paint order, mirroring, and the fusion body/head rule.
// Pure — no DOM, no assets. Run: test:parts

import { readFileSync } from 'fs';
import { composeCreature, resolveParts } from './composeCreature.js';
import { PARTS, SLOTS, BODY_ANCHORS, COVERED_FACTORS } from '../data/partsRig.js';

// partShapes is JSX (node can't import it), so read the implemented shape ids out
// of the source. This still catches the failure that matters: a rig part naming a
// `draw` that nobody implemented, which would render an invisible layer.
const SHAPE_SRC = readFileSync(new URL('./partShapes.jsx', import.meta.url), 'utf8');
const SHAPES = Object.fromEntries(
  [...SHAPE_SRC.matchAll(/\n {2}(\w+): \(/g)].map((m) => [m[1], true]),
);

let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error('  ✗', m)));

const BEAST = {
  id: 'b1', name: 'Voltfang', biology: ['Beast'], family: 'Mammalian',
  attunement: ['Energy'], anatomy: ['Teeth', 'Claws', 'Tail'],
};
const KNIGHT = {
  id: 'h1', name: 'Ironhide', biology: ['Humanoid'], class: ['Warrior'],
  attunement: ['Physical'], weapons: ['Hammer', 'Shield'],
};
const DRAGON = {
  id: 'd1', name: 'Emberdrake', biology: ['Beast'], family: 'Draconic',
  attunement: ['Fire'], anatomy: ['Wings', 'Horns', 'Breath'],
};

console.log('Rig integrity:');
{
  for (const p of PARTS) {
    ok(!!SLOTS[p.slot], `${p.id}: slot "${p.slot}" exists in SLOTS`);
    ok(p.draw || p.file, `${p.id}: has procedural art or a baked file`);
    if (p.draw) ok(!!SHAPES[p.draw], `${p.id}: draw "${p.draw}" is implemented`);
    ok(Array.isArray(p.pivot) && p.pivot.length === 2, `${p.id}: has a pivot`);
    ok(typeof p.scale === 'number' && p.scale > 0, `${p.id}: has a scale`);
  }
  ok(new Set(PARTS.map((p) => p.id)).size === PARTS.length, 'part ids are unique');
  for (const bt of ['Humanoid', 'Beast', 'Aberration']) {
    const a = BODY_ANCHORS[bt];
    ok(!!a, `${bt}: has anchors`);
    for (const slot of Object.keys(SLOTS)) {
      if (slot === 'body') continue;
      ok(Array.isArray(a[slot]), `${bt}: anchor for slot "${slot}"`);
    }
  }
}

console.log('Selection from taxonomy:');
{
  const r = resolveParts(BEAST);
  ok(r.body?.id === 'body-beast', `beast picks the beast body (got ${r.body?.id})`);
  ok(r.head?.id === 'head-beast', `beast picks the beast head (got ${r.head?.id})`);
  const ids = r.attachments.map((a) => a.id);
  ok(ids.includes('teeth') && ids.includes('claws') && ids.includes('tail'),
    `every drawable factor becomes an attachment (got ${ids.join(',')})`);
  ok(r.attachments.length === 3, 'no spurious attachments');

  const k = resolveParts(KNIGHT);
  ok(k.body?.id === 'body-humanoid', 'humanoid body');
  ok(k.attachments.some((a) => a.id === 'w-hammer'), 'a weapon becomes a held part');
  ok(k.attachments.some((a) => a.id === 'w-shield'), 'both weapons appear');

  // a kit-specific part must beat the body-type default
  ok(resolveParts(DRAGON).head?.id === 'head-draconic', 'Draconic gets its own head, not the generic beast head');

  // unknown factors are simply skipped, never crash
  const weird = resolveParts({ ...BEAST, anatomy: ['Teeth', 'NotARealTag'] });
  ok(weird.attachments.length === 1, 'unknown factor tags are ignored');
  ok(resolveParts({}).body, 'a creature with no taxonomy still gets a body');
}

console.log('Composition — placement, order, mirroring:');
{
  const { layers, missingArt } = composeCreature(DRAGON);
  ok(layers.length > 0, 'produces layers');

  // paint order must be non-decreasing in z
  const zs = layers.map((l) => l.z);
  ok(zs.every((z, i) => i === 0 || z >= zs[i - 1]), `layers are z-sorted (${zs.join(',')})`);

  // wings sit BEHIND the body, held/face in front
  const zOf = (slot) => layers.find((l) => l.slot === slot)?.z;
  ok(zOf('wing') < zOf('body'), 'wings paint behind the body');
  ok(zOf('horn') > zOf('body'), 'horns paint in front of the body');

  // mirrored parts produce exactly two layers, reflected about x=0.5
  const wings = layers.filter((l) => l.partId === 'wings');
  ok(wings.length === 2, `mirrored part emits a twin (got ${wings.length})`);
  const [a, b] = wings;
  ok(Math.abs((a.x + a.w / 2) + (b.x + b.w / 2) - 1) < 1e-9, 'the twin is mirrored about the centre line');
  ok(a.flip !== b.flip, 'exactly one of the pair is flipped');

  // everything stays on-canvas-ish and is finite
  for (const l of layers) {
    ok(Number.isFinite(l.x) && Number.isFinite(l.y) && l.w > 0 && l.h > 0, `${l.id}: finite geometry`);
    ok(l.x > -0.6 && l.x < 1.4 && l.y > -0.6 && l.y < 1.4, `${l.id}: placed near the canvas`);
  }

  ok(Array.isArray(missingArt) && missingArt.length > 0,
    'missingArt reports the bake queue while parts are still procedural');
  ok(layers.every((l) => l.tint), 'every layer carries the attunement tint');
  ok(composeCreature(BEAST).tint !== composeCreature(DRAGON).tint, 'tint follows the attunement');
}

console.log('Determinism:');
{
  const a = JSON.stringify(composeCreature(DRAGON).layers);
  const b = JSON.stringify(composeCreature(DRAGON).layers);
  ok(a === b, 'composition is deterministic');
}

console.log('FUSION — body from the primary, head from the secondary (the CB rule):');
{
  // a fused creature whose parts hint pins body/head to different parents
  const fused = {
    id: 'f1', name: 'Ironfang', biology: ['Humanoid', 'Beast'], class: ['Warrior'],
    family: 'Mammalian', attunement: ['Physical'], weapons: ['Hammer'], anatomy: ['Teeth'],
    parts: { bodyFrom: 'Humanoid', headFrom: 'Mammalian', headBody: 'Beast' },
  };
  const r = resolveParts(fused);
  ok(r.body?.id === 'body-humanoid', `body comes from the PRIMARY (got ${r.body?.id})`);
  ok(r.head?.id === 'head-beast', `head comes from the SECONDARY (got ${r.head?.id})`);
  const ids = r.attachments.map((a) => a.id);
  ok(ids.includes('w-hammer') && ids.includes('teeth'), 'factors from BOTH parents are visible');

  // without a hint it falls back to the creature's own kit
  const noHint = resolveParts({ ...fused, parts: undefined });
  ok(noHint.body?.id === 'body-humanoid', 'no hint → body from its own first body type');

  // anchors follow the BODY's type, not the head's
  const { bodyType } = composeCreature(fused);
  ok(bodyType === 'Humanoid', 'anchors keyed to the body donor');

  // REGRESSION: the body part must be the ONE for bodyType, never whichever body
  // part sorts first in the union of both fused body types. A Beast-primary fusion
  // was picking body-humanoid (and so ignoring baked body-beast art).
  const beastPrimary = {
    id: 'f2', name: 'X', biology: ['Beast', 'Humanoid'], class: ['Warrior'], family: 'Mammalian',
    attunement: ['Physical'], anatomy: ['Teeth'],
    parts: { bodyFrom: 'Beast', headFrom: 'Warrior', headBody: 'Beast' },
  };
  const rp = resolveParts(beastPrimary);
  ok(rp.body?.id === 'body-beast', `Beast-primary fusion uses the BEAST body (got ${rp.body?.id})`);
  ok(rp.head?.id === 'head-beast', `head from the secondary's body (got ${rp.head?.id})`);
  // and a baked body-beast file must actually attach
  const baked = { 'body-beast': 'art/parts/body-beast.png' };
  const composed = composeCreature(beastPrimary, { baked });
  ok(composed.layers.some((l) => l.partId === 'body-beast' && l.file === 'art/parts/body-beast.png'),
    'baked body art is applied to the fused body');
}

console.log('Coverage:');
{
  ok(COVERED_FACTORS.length >= 25, `rig covers ${COVERED_FACTORS.length} factor tags`);
  for (const f of ['Wings', 'Claws', 'Teeth', 'Horns', 'Tail', 'Tentacle', 'Carapace', 'Spore', 'Hammer', 'Shield']) {
    ok(COVERED_FACTORS.includes(f), `covers "${f}"`);
  }
}

console.log(`parts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
