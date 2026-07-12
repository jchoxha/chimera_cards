// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/forms — creature SIZES (a.k.a. forms): the evolution-stage  ║
// ║ body scale from Baby up to Boss. Each size scales HP (hpMult), adds a    ║
// ║ flat Might bonus (str), scales the art, and shows a badge top-left of    ║
// ║ the card. Pure data so the engine (generator/combat) can import it.      ║
// ║ UPDATE WHEN: the size ladder or its multipliers change.                  ║
// ╚══════════════════════════════════════════════════════════════════╝

/** @type {Record<string,{id:string,label:string,badge:string,hpMult:number,str:number,order:number,art:number}>} */
export const FORMS = {
  baby:    { id: 'baby',    label: 'Baby',    badge: '🍼', hpMult: 0.5,  str: -1, order: 0, art: 0.74 },
  young:   { id: 'young',   label: 'Young',   badge: '🌱', hpMult: 0.75, str: 0,  order: 1, art: 0.86 },
  regular: { id: 'regular', label: 'Regular', badge: '',   hpMult: 1.0,  str: 0,  order: 2, art: 1.0  },
  elite:   { id: 'elite',   label: 'Elite',   badge: '⭐', hpMult: 1.6,  str: 2,  order: 3, art: 1.32 },
  boss:    { id: 'boss',    label: 'Boss',    badge: '👑', hpMult: 2.0,  str: 3,  order: 4, art: 1.5  },
};

/** Legacy size ids from before Large was removed / Small was renamed to Young.
 *  Keeps old saves & content valid: small→young, large→regular. */
export const FORM_ALIAS = { small: 'young', large: 'regular' };
const canonForm = (id) => FORM_ALIAS[id] || id || 'regular';

/** The size ladder, smallest → biggest. Evolution advances along it. */
export const FORM_ORDER = ['baby', 'young', 'regular', 'elite', 'boss'];
/** Elite & Boss are terminal — a creature there can't evolve further. */
export const TERMINAL_FORMS = ['elite', 'boss'];

export const formOf = (id) => FORMS[canonForm(id)] || FORMS.regular;
export const formHpMult = (id) => formOf(id).hpMult;
export const formAllowsEvolution = (id) => !TERMINAL_FORMS.includes(canonForm(id));
/** The next size up the ladder (null if terminal/top). */
export function nextForm(id) {
  const i = FORM_ORDER.indexOf(canonForm(id));
  return formAllowsEvolution(id) && i >= 0 && i < FORM_ORDER.length - 1 ? FORM_ORDER[i + 1] : null;
}
/** Badge + label for display (empty for Regular — the default needs no badge). */
export function formLabel(id) { const f = formOf(id); return f && f.badge ? `${f.badge} ${f.label}` : ''; }
