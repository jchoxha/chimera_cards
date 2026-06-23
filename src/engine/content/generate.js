// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/generate — the (triple → playable creature)     ║
// ║ generator core (synthesis §7). Pure: the archetype card POOL is injected ║
// ║ (keeps this JSON-free / node-testable). Biology → stats+HP; attunement   ║
// ║ re-skins the pool (§14.3); starterDeck builds the ≤10 starting deck.     ║
// ║ The full potential pool (+ attunement-own cards) is assembled in the     ║
// ║ app/reward layer where JSON imports are fine.                            ║
// ║ UPDATE WHEN: the creature shape, stat derivation, or deck recipe change. ║
// ╚══════════════════════════════════════════════════════════════════╝

import { biologyStats } from './biology.js';
import { reskinDeck } from '../cards/reskin.js';
import { starterDeck } from '../run/state.js';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Build a run-party creature from a triple + its archetype card pool.
 * @param {Object} a
 * @param {string} [a.id] @param {string} a.name
 * @param {string|string[]} a.class       archetype base(s)
 * @param {string|string[]} a.biology
 * @param {string|string[]} a.attunement
 * @param {Object[]} a.pool                the archetype's CardSpec pool (e.g. warrior.json cards)
 * @param {number} [a.baseHp]              base HP before the biology multiplier (default 55)
 * @param {number} [a.deckSize]            starter size (default 10)
 * @returns {Object} run party member { id,name,class,biology,attunement,stats,maxHp,hp,deck }
 */
export function makeCreature({ id, name, class: klass, biology, attunement, pool = [], baseHp = 55, deckSize = 10 }) {
  const cls = Array.isArray(klass) ? klass : [klass].filter(Boolean);
  const bio = Array.isArray(biology) ? biology : [biology].filter(Boolean);
  const att = Array.isArray(attunement) ? attunement : [attunement].filter(Boolean);

  const { hpMult, stats } = biologyStats(bio);
  const maxHp = Math.round(baseHp * hpMult);
  const deck = starterDeck(reskinDeck(pool, att), deckSize);

  return {
    id: id || slug(name) || 'creature',
    name: name || 'Creature',
    class: cls.length ? cls : null,
    biology: bio.length ? bio : null,
    attunement: att.length ? att : ['Physical'],
    stats, maxHp, hp: maxHp, deck,
  };
}
