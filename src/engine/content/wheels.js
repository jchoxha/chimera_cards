// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/wheels — the SPINNING-WHEEL generation core.       ║
// ║ Pure + seedable + node-testable (no JSON kit imports, no DOM): the wheel  ║
// ║ definitions, a weighted spin, and the mapping from a spin RESULT onto the ║
// ║ numbers a creature is built with (HP, how many factors, how many          ║
// ║ subtypes, its evolution line).                                            ║
// ║                                                                           ║
// ║ The UI layer (src/lab/) owns the ANIMATION and the kit vocabularies; this ║
// ║ module owns the odds and the maths so both stay testable. Numbers are     ║
// ║ REVIEW/tunable.                                                           ║
// ║ UPDATE WHEN: the rarity ladder, form ladder, or generation odds change.   ║
// ╚══════════════════════════════════════════════════════════════════╝

import { RARITIES, RARITY_POINTS } from '../types.js';
import { FORM_ORDER, TERMINAL_FORMS } from '../../data/forms.js';
import { ATTUNEMENT_BASES, BODY_TYPES } from '../../data/synthesis.js';
import { makeRng, hashSeed } from '../run/rng.js';

/** A wheel segment: what it lands on + how likely it is. */
const seg = (value, weight, label = null) => ({ value, weight, label: label ?? String(value) });

/**
 * The wheels. Each is an ordered list of weighted segments — order is also the
 * visual order around the wheel, so keep the good stuff spread out rather than
 * bunched (a wheel with all the jackpots adjacent reads as rigged).
 */
export const WHEELS = Object.freeze({
  // Rarity — the 7-tier ladder. Steeply weighted: godly is a genuine event.
  rarity: RARITIES.filter((r) => r !== 'basic').map((r) => {
    const w = [40, 26, 16, 9, 5, 3, 1][RARITY_POINTS[r] - 1] ?? 1;
    return seg(r, w);
  }),

  // Generated form/size. `regular` is the norm; boss is rare and terminal.
  form: FORM_ORDER.map((f) => seg(f, { baby: 12, young: 20, regular: 40, elite: 18, boss: 10 }[f] ?? 10)),

  // How many stages this creature's evolution line has (1 = standalone).
  evolutions: [seg(1, 30, '1 — standalone'), seg(2, 40, '2 stages'), seg(3, 25, '3 stages'), seg(4, 5, '4 stages')],

  // Element + body type, for when you want the wheel (not a prompt) to decide.
  attunement: ATTUNEMENT_BASES.map((a) => seg(a, 1)),
  body: BODY_TYPES.map((b) => seg(b, 1)),
});

/**
 * Spin a wheel. Weighted pick; returns the landed segment plus its INDEX so the
 * UI can animate the pointer to exactly that wedge.
 * @param {{value:any,weight:number,label:string}[]} segments
 * @param {() => number} rng  a 0..1 source (seedable — see makeRng)
 * @returns {{index:number, value:any, label:string}}
 */
export function spinWheel(segments, rng = Math.random) {
  const segs = (segments ?? []).filter((s) => s && (s.weight ?? 0) > 0);
  if (!segs.length) return { index: 0, value: null, label: '' };
  const total = segs.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng() * total;
  for (const s of segs) {
    roll -= s.weight;
    if (roll <= 0) {
      const index = segments.indexOf(s);
      return { index, value: s.value, label: s.label };
    }
  }
  const last = segs[segs.length - 1];
  return { index: segments.indexOf(last), value: last.value, label: last.label };
}

/**
 * A rarity's build budget: rarer creatures are bigger and carry more of the
 * taxonomy (more factors = more visible parts + a wider card pool).
 * @param {string} rarity
 * @returns {{points:number, baseHp:number, factors:number, subtypes:number}}
 */
export function rarityProfile(rarity) {
  const points = RARITY_POINTS[rarity] ?? 1;
  return {
    points,
    baseHp: 46 + points * 5,                       // common 51 … godly 81
    factors: Math.min(4, 2 + Math.floor(points / 3)), // 2 … 4
    subtypes: points >= 6 ? 2 : points >= 3 ? 1 : 0,  // epic+ start picking up overlays
  };
}

/**
 * The evolution LINE a generated creature sits in: `stages` long, with this
 * creature at `stage`. Terminal forms (elite/boss) can't evolve further, so a
 * creature generated at one is placed at the END of its line.
 * @param {number} stages  1–4
 * @param {string} form    the generated form/size
 * @returns {{stages:number, stage:number, isFinal:boolean}}
 */
export function evolutionLine(stages, form) {
  const n = Math.max(1, Math.min(4, Math.round(stages || 1)));
  const terminal = TERMINAL_FORMS.includes(form);
  // Small forms start early in the line; a terminal form is by definition the end.
  const stage = terminal ? n : ({ baby: 1, young: Math.min(2, n) }[form] ?? Math.min(n, Math.ceil(n / 2)));
  return { stages: n, stage, isFinal: stage >= n };
}

/**
 * Spin every wheel at once (used by "SPIN ALL" and by the node tests).
 * @param {{seed?:number|string, only?:string[]}} opts
 * @returns {Record<string, {index:number,value:any,label:string}>}
 */
export function spinAll({ seed, only } = {}) {
  // makeRng returns a generator OBJECT — spinWheel wants a bare 0..1 function.
  const rng = seed == null ? Math.random : makeRng(typeof seed === 'number' ? seed : hashSeed(seed)).next;
  const keys = only ?? Object.keys(WHEELS);
  const out = {};
  for (const k of keys) if (WHEELS[k]) out[k] = spinWheel(WHEELS[k], rng);
  return out;
}
