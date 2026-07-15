// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/battle/kitDeck — build a creature's COMBAT-V2 starter deck from   ║
// ║ its real biology/typing KIT (the v1 generator: pools.potentialPool + run.        ║
// ║ starterDeck), then ADAPT each v1 CardSpec into a v2 card the round resolver       ║
// ║ understands. The v2 engine (round.js) supports only damage · block · heal ·       ║
// ║ debuff · buff, so richer v1 ops (draw/energy/…) are dropped and the card keeps    ║
// ║ whatever functional effects remain. Attunement is reskinned by the generator, so  ║
// ║ a Fire creature's strikes deal Fire, a Nature beast applies Poison, etc. Cards    ║
// ║ are OWNED per creature (Option A) — this is where each creature's identity enters ║
// ║ combat. Falls back to a generic starter if a creature has no kit.                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { potentialPool } from '../../app/pools.js';
import { starterDeck } from '../run/state.js';

const V2_OPS = new Set(['damage', 'block', 'heal', 'debuff', 'buff']);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// v1 scope tokens (per-effect) → v2 card scope. Most kit attacks are single-target.
function scopeFor(card, offensive) {
  const scopes = (card.effects || []).map((e) => e.scope).filter(Boolean);
  if (scopes.some((s) => /whole|all|field|everyone/i.test(s))) return 'field';
  if (scopes.some((s) => /squad/i.test(s))) return 'squad';
  if (scopes.some((s) => /any|reach|back/i.test(s))) return 'targeted';
  return offensive ? 'front' : 'self';
}

function deriveText(effects, element) {
  const parts = [];
  for (const e of effects) {
    if (e.op === 'damage') parts.push(`Deal ${e.value} ${element} damage.`);
    else if (e.op === 'block') parts.push(`Gain ${e.value} Block.`);
    else if (e.op === 'heal') parts.push(`Heal ${e.value} HP.`);
    else if (e.op === 'debuff') parts.push(`Apply ${e.value} ${cap(e.status || 'debuff')}.`);
    else if (e.op === 'buff') parts.push(`Gain ${e.value} ${cap(e.status || 'buff')}.`);
  }
  return parts.join(' ');
}

/** Adapt one v1 CardSpec → a v2 card, or null if it has NO effect the v2 engine can run. */
export function kitCardToV2(card) {
  const element = (Array.isArray(card.attunement) ? card.attunement[0] : card.attunement) || 'Physical';
  const effects = [];
  for (const e of card.effects || []) {
    if (!V2_OPS.has(e.op)) continue;                        // drop draw/energy/… (unsupported in v2)
    const o = { op: e.op, value: e.value ?? (e.op === 'damage' ? 6 : e.op === 'block' ? 5 : 1) };
    if (e.op === 'debuff' || e.op === 'buff') o.status = e.status || (e.op === 'buff' ? 'strength' : 'weak');
    effects.push(o);
  }
  if (!effects.length) return null;
  const offensive = effects.some((e) => e.op === 'damage' || e.op === 'debuff');
  const scope = scopeFor(card, offensive);
  const baseId = String(card.id || 'kit').split('#')[0];
  return {
    id: baseId, name: card.name || cap(baseId), cost: card.cost ?? 1,
    type: card.type || (offensive ? 'attack' : 'skill'), element, rarity: card.rarity,
    priority: (card.type === 'skill' && !offensive) ? 2 : 0,
    scope, reachesBack: scope === 'targeted',
    effects, text: deriveText(effects, element),
  };
}

/** A creature's per-creature starter deck as v2 card DEFS (no iid/owner yet), built from its kit.
 *  `max` caps the deck; falls back to a generic starter for creatures without a kit. */
export function kitDeckFor(creature, max = 8) {
  const c = creature || {};
  const atts = (Array.isArray(c.attunement) && c.attunement.length) ? c.attunement : ['Physical'];
  let v2 = [];
  try {
    const pool = potentialPool({ class: c.class ? [c.class] : undefined, klass: c.class, biology: c.biology, attunement: atts, family: c.family, anatomy: c.anatomy, weapons: c.weapons, subtypes: c.subtypes, signatureCards: c.signatureCards });
    const starter = starterDeck(pool, atts, max);
    v2 = starter.map(kitCardToV2).filter(Boolean);
  } catch { v2 = []; }
  if (v2.length < 4) {
    // fallback generic starter (element-flavoured), so a kit-less creature still fights
    const el = atts[0];
    v2 = [
      { id: 'kit_strike', name: 'Strike', cost: 1, type: 'attack', element: el, priority: 0, scope: 'front', effects: [{ op: 'damage', value: 6 }], text: `Deal 6 ${el} damage.` },
      { id: 'kit_strike', name: 'Strike', cost: 1, type: 'attack', element: el, priority: 0, scope: 'front', effects: [{ op: 'damage', value: 6 }], text: `Deal 6 ${el} damage.` },
      { id: 'kit_strike', name: 'Strike', cost: 1, type: 'attack', element: el, priority: 0, scope: 'front', effects: [{ op: 'damage', value: 6 }], text: `Deal 6 ${el} damage.` },
      { id: 'kit_defend', name: 'Defend', cost: 1, type: 'skill', element: el, priority: 2, scope: 'self', effects: [{ op: 'block', value: 6 }], text: 'Gain 6 Block.' },
      { id: 'kit_defend', name: 'Defend', cost: 1, type: 'skill', element: el, priority: 2, scope: 'self', effects: [{ op: 'block', value: 6 }], text: 'Gain 6 Block.' },
      { id: 'kit_cleave', name: 'Cleave', cost: 2, type: 'attack', element: el, priority: 0, scope: 'targeted', reachesBack: true, effects: [{ op: 'damage', value: 10 }], text: `Deal 10 ${el} damage to any one creature.` },
    ];
  }
  return v2.slice(0, max);
}
