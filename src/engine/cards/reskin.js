// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/reskin — convert a creature's ARCHETYPE cards to   ║
// ║ its own attunement (§14.3 variant access). An Energy Warrior should      ║
// ║ mostly deal Energy: ~75% of its archetype cards convert to its primary    ║
// ║ attunement, ~25% keep their native element (deterministic per card, so a  ║
// ║ given creature is stable). Attunement-OWN cards are already on-element     ║
// ║ and should NOT be passed through this. Returns clones; never mutates.     ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Stable FNV-1a hash for the deterministic keep/convert split. */
function hash(s) {
  let h = 2166136261; const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Keep roughly 1-in-4 cards native (a few stay Physical for the Warrior). */
const KEEP_NATIVE = (id) => hash(id) % 4 === 0;

/**
 * Re-skin archetype cards to the creature's PRIMARY attunement.
 * @param {Object[]} cards         archetype CardSpec[] (e.g. warrior.json).
 * @param {string|string[]} attunement  the creature's attunement (1–2 bases).
 * @returns {Object[]} clones, ~75% converted to the primary attunement.
 */
export function reskinDeck(cards, attunement) {
  const primary = Array.isArray(attunement) ? attunement[0] : attunement;
  return (cards || []).map((c) => {
    const clone = { ...c, effects: Array.isArray(c.effects) ? c.effects.map((o) => ({ ...o })) : c.effects };
    if (primary && c.attunement !== primary && !KEEP_NATIVE(c.id)) clone.attunement = primary;
    return clone;
  });
}
