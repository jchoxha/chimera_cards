// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/partsRig — the CUTOUT RIG for building a creature portrait   ║
// ║ out of parts, Cassette-Beasts style.                                      ║
// ║                                                                           ║
// ║ CB designs every monster twice: once bespoke, once as a modular rig whose ║
// ║ fusion config names parts + coordinates. On fusion the BODY always comes  ║
// ║ from the primary and never swaps, while the head/"helmet" details come    ║
// ║ from the other parent. We get the decomposition for free because our      ║
// ║ parts are TAXONOMY TAGS, not per-species art:                             ║
// ║     body   ← body type (+ family/manifestation)   — the silhouette        ║
// ║     head   ← family/manifestation                                         ║
// ║     attach ← FACTORS (Wings, Claws, Horns, Tentacle, Hammer…)             ║
// ║     tint   ← attunement · overlay ← subtype                               ║
// ║ ~38 shared part sprites therefore cover EVERY creature and every fusion,  ║
// ║ where CB needed 120 bespoke rigs.                                         ║
// ║                                                                           ║
// ║ All geometry is in a NORMALISED 0..1 square, so one rig renders at any    ║
// ║ size (card art, 3D billboard, a 32px roster chip).                        ║
// ║ Plain JS, not JSON, so node tests can import it (see test:parts).         ║
// ║ UPDATE WHEN: a new slot, body type, or part is added.                     ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Draw order. Lower z paints first. Anything below the body's z sits BEHIND the
 * silhouette (wings, tail, aura), which is what sells the depth.
 */
export const SLOTS = Object.freeze({
  aura: { z: 0, behind: true },
  wing: { z: 10, behind: true },
  tail: { z: 15, behind: true },
  body: { z: 30 },
  surface: { z: 35 },   // subtype overlay, clipped to the body
  limb: { z: 40 },      // claws / pseudopods
  head: { z: 45 },
  face: { z: 55 },      // eyes, maw
  horn: { z: 50 },
  held: { z: 60 },      // weapons
  fx: { z: 70 },
});

/**
 * Where things attach ON THE BODY, per body type, in the rig's 0..1 space.
 * A part's pivot is placed exactly on its slot's anchor.
 */
export const BODY_ANCHORS = Object.freeze({
  Humanoid: {
    head: [0.50, 0.29], wing: [0.50, 0.44], tail: [0.50, 0.78],
    limb: [0.26, 0.56], held: [0.80, 0.52], horn: [0.50, 0.14],
    face: [0.50, 0.29], surface: [0.50, 0.55], aura: [0.50, 0.52], fx: [0.50, 0.5],
  },
  Beast: {
    head: [0.24, 0.36], wing: [0.56, 0.34], tail: [0.86, 0.46],
    limb: [0.40, 0.80], held: [0.24, 0.62], horn: [0.22, 0.18],
    face: [0.22, 0.36], surface: [0.52, 0.58], aura: [0.50, 0.55], fx: [0.50, 0.5],
  },
  Aberration: {
    head: [0.50, 0.30], wing: [0.50, 0.46], tail: [0.50, 0.80],
    limb: [0.28, 0.62], held: [0.74, 0.56], horn: [0.50, 0.18],
    face: [0.50, 0.31], surface: [0.50, 0.56], aura: [0.50, 0.54], fx: [0.50, 0.5],
  },
});

/** A body type's fallback when a family has no bespoke body art yet. */
export const DEFAULT_BODY = Object.freeze({
  Humanoid: 'body-humanoid', Beast: 'body-beast', Aberration: 'body-aberration',
});

/**
 * THE PART LIBRARY.
 *
 * Every entry is selected by a `match` against the creature's taxonomy:
 *   { body: 'Beast' }        — this body type
 *   { kit: 'Draconic' }      — this family / manifestation / archetype
 *   { factor: 'Wings' }      — this anatomy / weapon / feature tag
 *
 * Rendering source is either `draw` (a procedural shape id — ships today, needs
 * NO assets) or `file` (a baked cut-out PNG, added by scripts/gen_parts.py).
 * When a part has both, the baked file wins — that is how real art phases in
 * incrementally without touching this rig.
 *
 * `pivot`  the point IN THE PART that lands on the body anchor (0..1 of the part)
 * `scale`  the part's width as a fraction of the canvas
 * `mirror` also draw a mirrored copy on the other side of the body (wings, arms)
 */
export const PARTS = Object.freeze([
  // ── bodies (the silhouette; on a fusion this always comes from the PRIMARY) ──
  { id: 'body-humanoid', slot: 'body', match: { body: 'Humanoid' }, draw: 'bodyHumanoid', pivot: [0.5, 0.5], scale: 0.66 },
  { id: 'body-beast', slot: 'body', match: { body: 'Beast' }, draw: 'bodyBeast', pivot: [0.5, 0.5], scale: 0.86 },
  { id: 'body-aberration', slot: 'body', match: { body: 'Aberration' }, draw: 'bodyAberration', pivot: [0.5, 0.5], scale: 0.74 },

  // ── heads (on a fusion this comes from the SECONDARY — CB's head/helmet swap) ──
  { id: 'head-humanoid', slot: 'head', match: { body: 'Humanoid' }, draw: 'headRound', pivot: [0.5, 0.62], scale: 0.30 },
  { id: 'head-beast', slot: 'head', match: { body: 'Beast' }, draw: 'headSnout', pivot: [0.5, 0.6], scale: 0.40 },
  { id: 'head-aberration', slot: 'head', match: { body: 'Aberration' }, draw: 'headBlob', pivot: [0.5, 0.6], scale: 0.36 },
  { id: 'head-draconic', slot: 'head', match: { kit: 'Draconic' }, draw: 'headSnout', pivot: [0.5, 0.6], scale: 0.44 },
  { id: 'head-avian', slot: 'head', match: { kit: 'Avian' }, draw: 'headBeak', pivot: [0.5, 0.6], scale: 0.34 },

  // ── attachments, keyed to FACTOR tags ──
  { id: 'wings', slot: 'wing', match: { factor: 'Wings' }, draw: 'wing', pivot: [0.92, 0.5], scale: 0.40, mirror: true },
  { id: 'tail', slot: 'tail', match: { factor: 'Tail' }, draw: 'tail', pivot: [0.06, 0.4], scale: 0.34 },
  { id: 'claws', slot: 'limb', match: { factor: 'Claws' }, draw: 'claw', pivot: [0.5, 0.2], scale: 0.16, mirror: true },
  { id: 'horns', slot: 'horn', match: { factor: 'Horns' }, draw: 'horn', pivot: [0.5, 0.95], scale: 0.20, mirror: true },
  { id: 'teeth', slot: 'face', match: { factor: 'Teeth' }, draw: 'fangs', pivot: [0.5, 0.3], scale: 0.13 },
  { id: 'maw', slot: 'face', match: { factor: 'Maw' }, draw: 'maw', pivot: [0.5, 0.35], scale: 0.17 },
  { id: 'eye', slot: 'face', match: { factor: 'Eye' }, draw: 'eyes', pivot: [0.5, 0.5], scale: 0.16 },
  { id: 'beak', slot: 'face', match: { factor: 'Beak' }, draw: 'beak', pivot: [0.4, 0.4], scale: 0.13 },
  { id: 'quills', slot: 'wing', match: { factor: 'Quills' }, draw: 'quills', pivot: [0.5, 0.85], scale: 0.34 },
  { id: 'shell', slot: 'surface', match: { factor: 'Shell' }, draw: 'shell', pivot: [0.5, 0.5], scale: 0.40 },
  { id: 'carapace', slot: 'surface', match: { factor: 'Carapace' }, draw: 'shell', pivot: [0.5, 0.5], scale: 0.44 },
  { id: 'tentacle', slot: 'limb', match: { factor: 'Tentacle' }, draw: 'tentacle', pivot: [0.5, 0.1], scale: 0.22, mirror: true },
  { id: 'pseudopod', slot: 'limb', match: { factor: 'Pseudopod' }, draw: 'tentacle', pivot: [0.5, 0.1], scale: 0.18, mirror: true },
  { id: 'roots', slot: 'limb', match: { factor: 'Roots' }, draw: 'roots', pivot: [0.5, 0.1], scale: 0.30 },
  { id: 'spore', slot: 'fx', match: { factor: 'Spore' }, draw: 'motes', pivot: [0.5, 0.5], scale: 0.80 },
  { id: 'miasma', slot: 'aura', match: { factor: 'Miasma' }, draw: 'cloud', pivot: [0.5, 0.5], scale: 0.92 },
  { id: 'shard', slot: 'horn', match: { factor: 'Shard' }, draw: 'shard', pivot: [0.5, 0.95], scale: 0.18, mirror: true },
  { id: 'mandible', slot: 'face', match: { factor: 'Mandible' }, draw: 'mandible', pivot: [0.5, 0.3], scale: 0.16 },
  { id: 'cilia', slot: 'surface', match: { factor: 'Cilia' }, draw: 'cilia', pivot: [0.5, 0.5], scale: 0.44 },
  { id: 'membrane', slot: 'wing', match: { factor: 'Membrane' }, draw: 'wing', pivot: [0.92, 0.5], scale: 0.34, mirror: true },
  { id: 'ichor', slot: 'fx', match: { factor: 'Ichor' }, draw: 'drips', pivot: [0.5, 0.5], scale: 0.5 },
  { id: 'venom', slot: 'fx', match: { factor: 'Venom' }, draw: 'drips', pivot: [0.5, 0.5], scale: 0.45 },
  { id: 'hide', slot: 'surface', match: { factor: 'Hide' }, draw: 'plates', pivot: [0.5, 0.5], scale: 0.42 },
  { id: 'hooves', slot: 'limb', match: { factor: 'Hooves' }, draw: 'hoof', pivot: [0.5, 0.1], scale: 0.13, mirror: true },
  { id: 'roar', slot: 'face', match: { factor: 'Roar' }, draw: 'maw', pivot: [0.5, 0.35], scale: 0.18 },
  { id: 'breath', slot: 'fx', match: { factor: 'Breath' }, draw: 'breath', pivot: [0.5, 0.5], scale: 0.5 },

  // ── held weapons ──
  { id: 'w-sword', slot: 'held', match: { factor: 'Sword' }, draw: 'sword', pivot: [0.5, 0.9], scale: 0.13 },
  { id: 'w-axe', slot: 'held', match: { factor: 'Axe' }, draw: 'axe', pivot: [0.5, 0.9], scale: 0.15 },
  { id: 'w-hammer', slot: 'held', match: { factor: 'Hammer' }, draw: 'hammer', pivot: [0.5, 0.9], scale: 0.16 },
  { id: 'w-mace', slot: 'held', match: { factor: 'Mace' }, draw: 'hammer', pivot: [0.5, 0.9], scale: 0.14 },
  { id: 'w-spear', slot: 'held', match: { factor: 'Spear' }, draw: 'spear', pivot: [0.5, 0.9], scale: 0.11 },
  { id: 'w-staff', slot: 'held', match: { factor: 'Staff' }, draw: 'staff', pivot: [0.5, 0.9], scale: 0.11 },
  { id: 'w-wand', slot: 'held', match: { factor: 'Wand' }, draw: 'staff', pivot: [0.5, 0.9], scale: 0.08 },
  { id: 'w-dagger', slot: 'held', match: { factor: 'Dagger' }, draw: 'sword', pivot: [0.5, 0.9], scale: 0.09 },
  { id: 'w-bow', slot: 'held', match: { factor: 'Bow' }, draw: 'bow', pivot: [0.5, 0.5], scale: 0.16 },
  { id: 'w-crossbow', slot: 'held', match: { factor: 'Crossbow' }, draw: 'bow', pivot: [0.5, 0.5], scale: 0.15 },
  { id: 'w-shield', slot: 'held', match: { factor: 'Shield' }, draw: 'shield', pivot: [0.5, 0.5], scale: 0.18 },
  { id: 'w-fist', slot: 'held', match: { factor: 'Fist' }, draw: 'fist', pivot: [0.5, 0.5], scale: 0.10 },
]);

/** Index for quick lookup + so tooling can enumerate what still needs art. */
export const PART_BY_ID = Object.freeze(Object.fromEntries(PARTS.map((p) => [p.id, p])));

/** Every factor tag the rig can currently draw (used by tests + the bake script). */
export const COVERED_FACTORS = Object.freeze(
  [...new Set(PARTS.map((p) => p.match?.factor).filter(Boolean))],
);
