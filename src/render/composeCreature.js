// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: render/composeCreature — turn a creature's TAXONOMY into an       ║
// ║ ordered list of positioned art layers. This is the deterministic half of  ║
// ║ the Cassette-Beasts-style parts system: no art, no DOM, no randomness —   ║
// ║ just "which parts, where, in what order, what colour".                    ║
// ║                                                                           ║
// ║ Everything is NORMALISED (0..1 of a square canvas) so one composition     ║
// ║ renders at any size. The renderer (ui/PartsPortrait) only has to scale.   ║
// ║                                                                           ║
// ║ FUSION follows CB's rule: the BODY comes from the primary and never       ║
// ║ swaps; the HEAD comes from the secondary. fuseCreatures() records that as ║
// ║ `creature.parts = { bodyFrom, headFrom }`; absent it, both come from the  ║
// ║ creature's own kit.                                                       ║
// ║ PURE → node-testable (npm run test:parts).                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { SLOTS, BODY_ANCHORS, PARTS } from '../data/partsRig.js';
import { ATTUNEMENT_COLOR } from '../data/axisIcons.js';

const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

/** The kit names a creature carries (archetype ∪ family ∪ manifestation). */
function kitsOf(c) {
  return [...list(c?.class), ...list(c?.family), ...list(c?.manifestation)];
}
/** The factor tags a creature carries (weapons ∪ anatomy ∪ features). */
function factorsOf(c) {
  return [...list(c?.weapons), ...list(c?.anatomy), ...list(c?.features)];
}

/** Does this part's `match` apply to the creature? */
function matches(part, { bodies, kits, factors }) {
  const m = part.match ?? {};
  if (m.body && !bodies.includes(m.body)) return false;
  if (m.kit && !kits.includes(m.kit)) return false;
  if (m.factor && !factors.includes(m.factor)) return false;
  return true;
}

/**
 * Choose the parts that make up a creature.
 * - exactly ONE body and ONE head (a kit-specific match beats the body-type default)
 * - one attachment per factor tag that the rig can draw
 * @returns {{body:object|null, head:object|null, attachments:object[], bodyType:string}}
 */
export function resolveParts(creature, parts = PARTS) {
  const bodies = list(creature?.biology);
  const kits = kitsOf(creature);
  const factors = factorsOf(creature);

  // A fusion may pin body/head to a specific parent (CB: body never swaps).
  const hint = creature?.parts ?? {};
  const bodyType = hint.bodyFrom ?? bodies[0] ?? 'Beast';
  const headKits = hint.headFrom ? [hint.headFrom] : kits;
  const headBodies = hint.headBody ? [hint.headBody] : bodies;

  const ctx = { bodies: [bodyType, ...bodies], kits, factors };

  const bodyCandidates = parts.filter((p) => p.slot === 'body' && matches(p, ctx));
  // prefer a kit-specific body, else the body-type default
  const body = bodyCandidates.find((p) => p.match?.kit) ?? bodyCandidates[0] ?? null;

  const headCtx = { bodies: headBodies, kits: headKits, factors };
  const headCandidates = parts.filter((p) => p.slot === 'head' && matches(p, headCtx));
  const head = headCandidates.find((p) => p.match?.kit) ?? headCandidates[0] ?? null;

  // one attachment per factor, in the creature's own factor order (stable)
  const attachments = [];
  const used = new Set();
  for (const f of factors) {
    const part = parts.find((p) => p.match?.factor === f && p.slot !== 'body' && p.slot !== 'head');
    if (part && !used.has(part.id)) { used.add(part.id); attachments.push(part); }
  }

  return { body, head, attachments, bodyType };
}

/**
 * Place one part against its slot's anchor on the body.
 * @returns {{x,y,w,h}} normalised box (x,y = top-left)
 */
function place(part, anchors) {
  const slot = part.slot;
  const anchor = anchors[slot] ?? anchors.surface ?? [0.5, 0.5];
  const w = part.scale ?? 0.3;
  const h = w;                      // parts are authored square; art can letterbox inside
  const [px, py] = part.pivot ?? [0.5, 0.5];
  return { x: anchor[0] - px * w, y: anchor[1] - py * h, w, h };
}

/**
 * Compose a creature into ordered, positioned layers.
 *
 * @param {object} creature
 * @param {{parts?: object[], tint?: string|null, baked?: Record<string,string>,
 *          anchorOverride?: Record<string, Record<string, [number,number]>>}} [opts]
 *   `baked` maps partId → a cut-out PNG path (src/data/partsBaked.json). A baked
 *   file always wins over the procedural shape, so real art phases in one part at
 *   a time with NO code change — drop the PNG, add the manifest entry, done.
 * @returns {{layers: Array<{id,partId,slot,z,x,y,w,h,draw,file,flip,tint,opacity}>,
 *            tint: string, bodyType: string, missingArt: string[]}}
 *   `missingArt` lists parts still rendering procedurally — i.e. the bake queue.
 */
export function composeCreature(creature, opts = {}) {
  const parts = opts.parts ?? PARTS;
  const { body, head, attachments, bodyType } = resolveParts(creature, parts);
  // The anchor editor passes `anchorOverride` (a full BODY_ANCHORS-shaped map) so
  // edits preview live; absent it, the committed defaults are used.
  const anchorMap = opts.anchorOverride ?? BODY_ANCHORS;
  const anchors = anchorMap[bodyType] ?? BODY_ANCHORS[bodyType] ?? BODY_ANCHORS.Beast;
  const tint = opts.tint ?? ATTUNEMENT_COLOR[list(creature?.attunement)[0]] ?? '#c9a66b';

  const layers = [];
  const missingArt = [];

  const emit = (part, extra = {}) => {
    if (!part) return;
    const box = place(part, anchors);
    const slot = SLOTS[part.slot] ?? { z: 50 };
    const file = opts.baked?.[part.id] ?? part.file ?? null;
    if (!file) missingArt.push(part.id);
    layers.push({
      id: `${part.id}${extra.flip ? '-m' : ''}`,
      partId: part.id, slot: part.slot, z: slot.z,
      ...box, ...extra,
      draw: part.draw ?? null,
      file,
      tint,
      opacity: part.opacity ?? 1,
    });
    // a mirrored twin (wings, arms, horns) reflected across the body's centre
    if (part.mirror && !extra.flip) {
      const mBox = place(part, anchors);
      emit({ ...part, mirror: false }, { flip: true, x: 1 - mBox.x - mBox.w });
    }
  };

  emit(body);
  emit(head);
  for (const a of attachments) emit(a);

  // stable paint order: z, then the order parts were resolved
  layers.forEach((l, i) => { l._i = i; });
  layers.sort((a, b) => a.z - b.z || a._i - b._i);
  layers.forEach((l) => { delete l._i; });

  return { layers, tint, bodyType, missingArt: [...new Set(missingArt)] };
}
