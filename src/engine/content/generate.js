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
import { formOf } from '../../data/forms.js';

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
export function makeCreature({ id, name, class: klass, biology, attunement, family = null, anatomy = null, weapons = null, subtypes = null, pool = [], baseHp = 55, deckSize = 10, size = 'regular' }) {
  const cls = Array.isArray(klass) ? klass : [klass].filter(Boolean);
  const bio = Array.isArray(biology) ? biology : [biology].filter(Boolean);
  const att = Array.isArray(attunement) ? attunement : [attunement].filter(Boolean);

  const subs = Array.isArray(subtypes) ? subtypes.filter(Boolean) : subtypes ? [subtypes] : [];
  const { hpMult, stats } = biologyStats(bio, subs, family);
  // The Giant subtype GATES size: a Giant creature is at least Large.
  if (subs.includes('Giant') && (formOf(size).order ?? 2) < formOf('large').order) size = 'large';
  // SIZE (form) scales HP and adds a flat Might bonus on top of biology.
  const form = formOf(size);
  const maxHp = Math.max(1, Math.round(baseHp * hpMult * form.hpMult));
  const statLine = { ...stats, might: Math.max(0, (stats.might ?? 1) + form.str) };
  const deck = starterDeck(reskinDeck(pool, att), att, deckSize);

  return {
    id: id || slug(name) || 'creature',
    name: name || 'Creature',
    class: cls.length ? cls : null,
    biology: bio.length ? bio : null,
    attunement: att.length ? att : ['Physical'],
    family: family || null, anatomy: anatomy || null,   // Beast kit axis-2 + special factors
    weapons: weapons || null,                            // Humanoid special factors
    subtypes: subs.length ? subs : null,                 // descriptive subtypes (Mechanical/Giant/…)
    size: form.id, stats: statLine, maxHp, hp: maxHp, deck,
    meta: { form: form.id },
  };
}
