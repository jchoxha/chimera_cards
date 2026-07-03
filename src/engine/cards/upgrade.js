// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/upgrade — AUTO-DERIVED card upgrades. Hand-authored ║
// ║ `card.upgrade` payloads always win; for the hundreds of kit/attunement/   ║
// ║ subtype cards without one, deriveUpgrade() synthesizes a fair "+" version ║
// ║ (StS-style: bigger numbers, or cheaper when there's nothing to grow), so  ║
// ║ the campfire upgrade works for EVERY card. Pure + node-testable.          ║
// ║ UPDATE WHEN: the upgrade recipe or op vocabulary changes.                ║
// ╚══════════════════════════════════════════════════════════════════╝

const NUM_BUMP = {
  damage: (v, op) => v + ((op.hits && op.hits !== 1) ? 2 : 3),  // multi-hit grows less per swing
  block: (v) => v + 3,
  heal: (v) => v + 3,
  buff: (v) => v + 1,
  debuff: (v) => v + 1,
  draw: (v) => v + 1,
};

/** Upgrade one op list; returns { ops, changed }. */
function bumpOps(ops) {
  let changed = false;
  const out = (ops || []).map((op) => {
    const bump = NUM_BUMP[op.op];
    if (bump && typeof op.value === 'number' && op.value > 0) {
      changed = true;
      return { ...op, value: bump(op.value, op) };
    }
    return { ...op };
  });
  return { ops: out, changed };
}

/**
 * Derive a "+" upgrade patch for a card with no hand-authored `upgrade`.
 * Recipe: grow every numeric effect (damage +3 / multi-hit +2, block/heal +3,
 * status +1, draw +1) — in the card's own effects AND its power trigger. If
 * nothing numeric grew and the card costs ≥1, it upgrades to cost −1 instead.
 * Returns a patch shaped like the hand-authored payloads ({effects}/{trigger}/
 * {cost}), or null if the card genuinely can't upgrade (nothing to improve).
 * @param {Object} card CardSpec
 * @returns {Object|null}
 */
export function deriveUpgrade(card) {
  if (!card) return null;
  const patch = {};
  let changed = false;

  if (Array.isArray(card.effects) && card.effects.length) {
    const { ops, changed: c } = bumpOps(card.effects);
    if (c) { patch.effects = ops; changed = true; }
  }
  if (card.trigger && Array.isArray(card.trigger.effects)) {
    const { ops, changed: c } = bumpOps(card.trigger.effects);
    if (c) { patch.trigger = { ...card.trigger, effects: ops }; changed = true; }
  }
  if (!changed) {
    if (typeof card.cost === 'number' && card.cost >= 1) return { cost: card.cost - 1 };
    return null;
  }
  return patch;
}

/** The upgrade a card will actually get: its authored payload, else the derived one. */
export function upgradeFor(card) {
  return (card && card.upgrade) || deriveUpgrade(card);
}

/** A preview copy of the upgraded card (renamed "Name+"), or null if un-upgradable. */
export function upgradedPreview(card) {
  const up = upgradeFor(card);
  if (!up) return null;
  return { ...card, ...up, name: card.name.endsWith('+') ? card.name : `${card.name}+`, upgraded: true };
}
