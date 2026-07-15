// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/matchups — combat damage matchups for the    ║
// ║ 3-axis Synthesis taxonomy. SINGLE source of truth (consolidates the  ║
// ║ old duplicated element matrices in systems/elements.jsx and          ║
// ║ combat/VanguardManager.js). See docs/synthesis-matrix-spec.md §4.    ║
// ║ UPDATE WHEN: matchup relationships, magnitudes, or the layering /     ║
// ║ override rules change. Class has NO matchup effect (locked 2026-06-21).║
// ╚══════════════════════════════════════════════════════════════════╝
//
// TWO layers, BOTH keyed on attunement (locked 2026-06-21):
//   1. Attunement → attunement: attacker's element vs the defender's element(s).
//   2. Biology → attunement: the defender's biology is innately weak/resistant to
//      certain incoming ELEMENTS (its "elemental constitution").
//
// OVERRIDE: if the defender is itself attuned to the incoming element, its biology
// relationship to that element is cancelled (a Fire Beast is NOT weak to fire) and
// attunement self-resist applies instead.
//
// Tables flagged REVIEW are provisional v0 (balance-tunable) — the ENGINE
// (layering, override, self-resist, clamp) is locked; the NUMBERS are not.

// ── Magnitudes (locked B1) ───────────────────────────────────────────────────
export const MAG = Object.freeze({
  ATTUNE_STRONG: 1.5,
  ATTUNE_WEAK: 0.66,
  BIO_WEAK: 1.25,    // defender takes MORE from this element
  BIO_RESIST: 0.8,   // defender takes LESS
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

// ── Layer 2: constitution → attunement (REVIEW v0, §4.2 + §9 re-key) ─────────
// Which incoming ELEMENTS a defender is WEAK to (takes x1.25) or RESISTS (x0.8),
// keyed by the IDENTITY axis: its BODY TYPE(s) + descriptive SUBTYPES. The KIT axis
// (Beast FAMILY / Aberration MANIFESTATION) is the archetype-equivalent and has NO
// matchup effect — parity with Class — EXCEPT `Draconic`, the one stat-relevant family
// (dragon bulk + fire constitution). Every body type + every subtype has a row
// (guarded by test:typing). Legacy 9-biology names keep their rows so old saves resolve.
export const BIOLOGY_ATTUNEMENT = Object.freeze({
  // body types (the FORM)
  Beast:      { weak: ['Fire', 'Mind'],      resist: ['Physical', 'Nature'] },
  Humanoid:   { weak: ['Shadow', 'Mind'],    resist: ['Physical'] },
  Aberration: { weak: ['Holy'],              resist: ['Void', 'Arcane'] },
  // descriptive subtypes (composition/affliction) — also the legacy-name rows
  Undead:     { weak: ['Holy', 'Fire'],      resist: ['Shadow', 'Void', 'Frost'] },
  Elemental:  { weak: ['Void'],              resist: ['Physical'] },
  Mechanical: { weak: ['Energy', 'Water'],   resist: ['Physical'] },
  Giant:      { weak: ['Mind', 'Air'],       resist: ['Physical', 'Stone'] },
  Demonic:    { weak: ['Holy'],              resist: ['Fire', 'Shadow'] },
  Hallowed:   { weak: ['Shadow', 'Void'],    resist: ['Holy'] },
  Spectral:   { weak: ['Holy', 'Arcane'],    resist: ['Physical'] },
  Cursed:     { weak: ['Holy'],              resist: ['Shadow'] },
  Feral:      { weak: ['Mind', 'Frost'],     resist: ['Physical', 'Nature'] }, // wild frenzy — tough but undisciplined
  Ancient:    { weak: ['Void', 'Nature'],    resist: ['Arcane', 'Physical'] }, // primordial endurance, eroded by entropy/time
  Swarm:      { weak: ['Fire', 'Air'],       resist: ['Physical', 'Shadow'] }, // burned/scattered by AoE; no single body to strike
  // stat-relevant family (Dragonkin fold-in) + legacy names
  Draconic:   { weak: ['Frost', 'Arcane'],   resist: ['Fire', 'Physical'] },
  Dragonkin:  { weak: ['Frost', 'Arcane'],   resist: ['Fire', 'Physical'] },
  Demon:      { weak: ['Holy'],              resist: ['Fire', 'Shadow'] },
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
/** @param {any} f */
export function biologiesOf(f) {
  const v = Array.isArray(f?.biology) ? f.biology : f?.axes?.biology;
  return Array.isArray(v) ? v.filter(Boolean) : [];
}
/** All the keys a defender's CONSTITUTION reads from: body type(s) + descriptive
 *  subtypes + a stat-relevant family (Draconic). De-duped; reads Fighter,
 *  snapshot (`axes.*`), or creature shapes. @param {any} f */
export function constitutionKeysOf(f) {
  const rawSubs = Array.isArray(f?.subtypes) ? f.subtypes : f?.axes?.subtypes;
  const subs = Array.isArray(rawSubs) ? rawSubs.filter(Boolean) : [];
  const fam = f?.family ?? f?.axes?.family;
  return [...new Set([...biologiesOf(f), ...subs, ...(fam ? [fam] : [])])];
}
/** @param {any} f */
export function classesOf(f) {
  return Array.isArray(f?.class) ? f.class.filter(Boolean) : [];
}

// ── Per-element multiplier helpers ───────────────────────────────────────────
function attunePair(atk, def) {
  const e = ATTUNEMENT_MATCHUP[atk];
  if (!e) return 1;
  if (e.strong.includes(def)) return MAG.ATTUNE_STRONG;
  if (e.weak.includes(def)) return MAG.ATTUNE_WEAK;
  return 1;
}
function bioVsElement(bio, atk) {
  const b = BIOLOGY_ATTUNEMENT[bio];
  if (!b) return 1;
  if (b.weak.includes(atk)) return MAG.BIO_WEAK;
  if (b.resist.includes(atk)) return MAG.BIO_RESIST;
  return 1;
}

/**
 * Compute the combat damage multiplier of an attack against a defender, with a
 * full breakdown for the live UI readout (spec §9/B3).
 *
 * Convention: evaluate each of the attacker's attunements fully (attunement layer
 * × biology layer) and take the BEST (max), then clamp.
 *
 * @param {{ attunement?: string[], types?: any[] }} attacker
 * @param {{ attunement?: string[], types?: any[], biology?: string[] }} defender
 * @returns {{ total: number, best: string|null, attune: number, biology: number,
 *            selfResisted: boolean, overridden: string[], label: string }}
 */
export function computeMatchup(attacker, defender) {
  const atkEls = attunementsOf(attacker);
  const defEls = attunementsOf(defender);
  const defBios = constitutionKeysOf(defender);

  if (atkEls.length === 0) {
    return { total: 1, best: null, attune: 1, biology: 1, selfResisted: false, overridden: [], label: '' };
  }

  let best = { total: -Infinity, el: null, attune: 1, biology: 1, selfResisted: false, overridden: [] };

  for (const a of atkEls) {
    // Layer 1 — attunement vs the defender's attunement(s) + self-resist.
    let mAtt = 1;
    for (const d of defEls) mAtt *= attunePair(a, d);
    const selfResisted = defEls.includes(a);
    if (selfResisted) mAtt *= MAG.SELF_RESIST;

    // Layer 2 — biology constitution vs the incoming element, UNLESS the defender
    // is itself attuned to this element (own-attunement override).
    let mBio = 1;
    const overridden = [];
    if (!selfResisted) {
      for (const b of defBios) mBio *= bioVsElement(b, a);
    } else {
      for (const b of defBios) if (bioVsElement(b, a) !== 1) overridden.push(b);
    }

    const total = mAtt * mBio;
    if (total > best.total) best = { total, el: a, attune: mAtt, biology: mBio, selfResisted, overridden };
  }

  const clamped = Math.max(MAG.CLAMP_MIN, Math.min(MAG.CLAMP_MAX, best.total));
  return {
    total: clamped,
    best: best.el,
    attune: best.attune,
    biology: best.biology,
    selfResisted: best.selfResisted,
    overridden: best.overridden,
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
