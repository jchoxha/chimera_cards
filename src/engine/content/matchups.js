// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/matchups — combat damage matchups for the    ║
// ║ 3-axis Synthesis taxonomy. SINGLE source of truth (consolidates the  ║
// ║ old duplicated element matrices in systems/elements.jsx and          ║
// ║ combat/VanguardManager.js). See docs/synthesis-matrix-spec.md §4.    ║
// ║ UPDATE WHEN: matchup relationships, magnitudes, or the self-resist /  ║
// ║ clamp rules change.                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// ATTUNEMENT-ONLY matchups (locked 2026-07-15, Jeton — the biology "constitution"
// Layer 2 is RETIRED). A creature's resistances/weaknesses/advantages come SOLELY
// from its own attunement(s):
//   1. Attunement → attunement: attacker's element vs the defender's element(s).
//   2. Self-resist: a creature attuned to the incoming element resists it (×0.75).
// Body type, subtype, and family (except via the KIT/FACTOR STAT model, not here)
// have NO matchup effect. This keeps matchups readable ("what element am I, what
// element are they") and moves identity-stats onto the kit+factor axis.
//
// Tables flagged REVIEW are provisional v0 (balance-tunable) — the ENGINE
// (self-resist, best-of, clamp) is locked; the NUMBERS are not.

// ── Magnitudes (locked B1) ───────────────────────────────────────────────────
export const MAG = Object.freeze({
  ATTUNE_STRONG: 1.5,
  ATTUNE_WEAK: 0.66,
  SELF_RESIST: 0.75, // attunement-only (B4): resist your own element
  CLAMP_MIN: 0.25,
  CLAMP_MAX: 4.0,
});

// ── Layer 1: attunement → attunement (REVIEW v0, §4.1 — Jeton: "looks good") ──
// Each base lists what it is STRONG against (x1.5) and WEAK against (x0.66).
// Asymmetric by design. Anything unlisted is neutral (x1.0).
export const ATTUNEMENT_MATCHUP = Object.freeze({
  Physical: { strong: ['Mind', 'Nature'],   weak: ['Stone', 'Arcane'] },
  Fire:     { strong: ['Frost', 'Nature'],  weak: ['Water', 'Stone'] },
  Frost:    { strong: ['Nature', 'Air'],    weak: ['Fire', 'Energy'] },
  Nature:   { strong: ['Water', 'Stone'],   weak: ['Fire', 'Frost'] },
  Water:    { strong: ['Fire', 'Stone'],    weak: ['Nature', 'Energy'] },
  Air:      { strong: ['Energy', 'Nature'], weak: ['Stone', 'Frost'] },
  Energy:   { strong: ['Water', 'Frost'],   weak: ['Stone', 'Air'] },
  Stone:    { strong: ['Fire', 'Air'],      weak: ['Water', 'Nature'] },
  Arcane:   { strong: ['Physical', 'Void'], weak: ['Shadow', 'Mind'] },
  Shadow:   { strong: ['Arcane', 'Mind'],   weak: ['Holy', 'Fire'] },
  Holy:     { strong: ['Shadow', 'Void'],   weak: ['Physical', 'Mind'] },
  Void:     { strong: ['Holy', 'Energy'],   weak: ['Arcane', 'Mind'] },
  Mind:     { strong: ['Holy', 'Physical'], weak: ['Shadow', 'Arcane'] },
});

// ── Attunement signature statuses (spec §5.1) — the "imbue" rider ─────────────
// A card flagged `imbue` inflicts the CASTER creature's attunement signature
// status (in addition to its explicit damage element, which drives the matchup).
//   • target 'enemy' → a debuff on the hit target; 'self' → a buff on the caster.
//   • live → the status has working behavior, so `imbue` grants it. 12 of 13 are
//     now live (§5). **Stone is the deliberate exception**: its signature is
//     Fortify — a slot-bound Block AURA, not a creature status — so Stone's
//     defensive identity comes from its Block cards, not an imbue rider.
export const ATTUNEMENT_STATUS = Object.freeze({
  Physical: { id: 'bleed',      target: 'enemy', live: true  },
  Fire:     { id: 'burn',       target: 'enemy', live: true  },
  Frost:    { id: 'weak',       target: 'enemy', live: true  },  // "chill"
  Nature:   { id: 'poison',     target: 'enemy', live: true  },
  Shadow:   { id: 'vulnerable', target: 'enemy', live: true  },
  Holy:     { id: 'regen',      target: 'self',  live: true  },
  Water:    { id: 'soak',       target: 'enemy', live: true  },
  Air:      { id: 'expose',     target: 'enemy', live: true  },
  Energy:   { id: 'shock',      target: 'enemy', live: true  },
  Stone:    { id: 'fortify',    target: 'self',  live: false }, // slot aura, not a status (see above)
  Arcane:   { id: 'amplify',    target: 'self',  live: true  },
  Void:     { id: 'decay',      target: 'enemy', live: true  },
  Mind:     { id: 'confuse',    target: 'enemy', live: true  },
});

/**
 * The LIVE imbue statuses for a creature's attunement set (1–2 bases). One entry
 * per attunement whose signature status is implemented; others contribute nothing
 * yet (their element still drives the matchup). Supports dual attunement.
 * @param {string[]} attunements
 * @returns {{ id:string, target:'enemy'|'self' }[]}
 */
export function imbueStatusesFor(attunements) {
  const out = [];
  for (const a of attunements ?? []) {
    const s = ATTUNEMENT_STATUS[a];
    if (s && s.live) out.push({ id: s.id, target: s.target });
  }
  return out;
}

// ── Axis accessors (migration seam, spec §8/E1) ──────────────────────────────
// Read the new 3-axis fields, falling back to the legacy `types` attunement shape
// so this works before AND after the data-model migration.
/** @param {any} f */
export function attunementsOf(f) {
  if (Array.isArray(f?.attunement)) return f.attunement.filter(Boolean);
  if (Array.isArray(f?.types)) return f.types.map((t) => t?.type ?? t).filter(Boolean);
  return [];
}
/** Body type(s) of a unit/creature/snapshot. Retained as a general accessor (the
 *  matchup layer no longer reads it, but pools/specificity/UI still do). @param {any} f */
export function biologiesOf(f) {
  const v = Array.isArray(f?.biology) ? f.biology : f?.axes?.biology;
  return Array.isArray(v) ? v.filter(Boolean) : [];
}
/** @param {any} f */
export function classesOf(f) {
  return Array.isArray(f?.class) ? f.class.filter(Boolean) : [];
}

// ── Per-element multiplier helper ────────────────────────────────────────────
function attunePair(atk, def) {
  const e = ATTUNEMENT_MATCHUP[atk];
  if (!e) return 1;
  if (e.strong.includes(def)) return MAG.ATTUNE_STRONG;
  if (e.weak.includes(def)) return MAG.ATTUNE_WEAK;
  return 1;
}

/**
 * Compute the combat damage multiplier of an attack against a defender, with a
 * breakdown for the live UI readout (spec §9/B3). ATTUNEMENT-ONLY: the attacker's
 * element vs the defender's element(s), plus self-resist.
 *
 * Convention: evaluate each of the attacker's attunements and take the BEST (max),
 * then clamp.
 *
 * @param {{ attunement?: string[], types?: any[] }} attacker
 * @param {{ attunement?: string[], types?: any[] }} defender
 * @returns {{ total: number, best: string|null, attune: number,
 *            selfResisted: boolean, label: string }}
 */
export function computeMatchup(attacker, defender) {
  const atkEls = attunementsOf(attacker);
  const defEls = attunementsOf(defender);

  if (atkEls.length === 0) {
    return { total: 1, best: null, attune: 1, selfResisted: false, label: '' };
  }

  let best = { total: -Infinity, el: null, attune: 1, selfResisted: false };

  for (const a of atkEls) {
    // Attunement vs the defender's attunement(s) + self-resist.
    let mAtt = 1;
    for (const d of defEls) mAtt *= attunePair(a, d);
    const selfResisted = defEls.includes(a);
    if (selfResisted) mAtt *= MAG.SELF_RESIST;

    if (mAtt > best.total) best = { total: mAtt, el: a, attune: mAtt, selfResisted };
  }

  const clamped = Math.max(MAG.CLAMP_MIN, Math.min(MAG.CLAMP_MAX, best.total));
  return {
    total: clamped,
    best: best.el,
    attune: best.attune,
    selfResisted: best.selfResisted,
    label: effectivenessLabel(clamped),
  };
}

/** Coarse text label for a final multiplier (UI hint). */
export function effectivenessLabel(mult) {
  if (mult >= 1.5) return 'super effective!';
  if (mult > 1) return 'effective';
  if (mult === 1) return '';
  if (mult > 0.5) return 'not very effective…';
  return 'barely effective…';
}

/** Convenience: just the number. */
export function matchupMultiplier(attacker, defender) {
  return computeMatchup(attacker, defender).total;
}
