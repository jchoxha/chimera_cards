// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/statProfile — a creature's stat identity from its  ║
// ║ KIT + FACTOR (locked 2026-07-15, Jeton — replaces the retired BODY_PROFILE ║
// ║ body-type stat model). Stats now compose from:                             ║
// ║   KIT_PROFILE   (Archetype ×8 / Family ×7 / Manifestation ×6) — the base   ║
// ║                 stat SHAPE (the "class"); hybrids AVERAGE their kits.       ║
// ║   FACTOR_PROFILE(Weapon ×12 / Anatomy ×13 / Feature ×9) — small nudges,    ║
// ║                 the "equipment slots" (a creature holds 2–3).              ║
// ║ Body type and SUBTYPE contribute NO stats (body = kit selector only;       ║
// ║ subtypes = wild-card passives). See docs/card-pool-composition.md §4/§5.   ║
// ║ Multipliers center on 1.0 (might/guard/focus/resolve/hp); speed + eva are  ║
// ║ small ADDITIVES. Pure + node-testable. Numbers are REVIEW/tunable.         ║
// ║ UPDATE WHEN: the kit/factor stat leans or the composition change.          ║
// ╚══════════════════════════════════════════════════════════════════╝

/** KIT stat profiles — the base stat SHAPE. hp/might/guard/focus/resolve are
 *  MULTIPLIERS (centered 1.0); speed + eva are small ADDITIVES. Grounded in the
 *  §4 stat leans (HP·ATK·DEF·FOC·RES·EVA·SPD → hp·might·guard·focus·resolve·eva·speed). */
export const KIT_PROFILE = Object.freeze({
  // Archetypes (Humanoid)
  Warrior:  { hp: 1.15, might: 1.10, guard: 1.15, focus: 0.85, resolve: 1.00, speed: 0,  eva: -2 },
  Rogue:    { hp: 0.85, might: 1.10, guard: 0.85, focus: 1.00, resolve: 0.90, speed: 1,  eva: 6  },
  Mage:     { hp: 0.85, might: 1.05, guard: 0.85, focus: 1.20, resolve: 1.00, speed: 0,  eva: 0  },
  Warlock:  { hp: 1.10, might: 1.00, guard: 0.90, focus: 1.15, resolve: 1.00, speed: 0,  eva: 0  },
  Priest:   { hp: 1.10, might: 0.85, guard: 1.00, focus: 1.10, resolve: 1.20, speed: 0,  eva: 0  },
  Shaman:   { hp: 1.00, might: 0.95, guard: 1.00, focus: 1.15, resolve: 1.15, speed: 0,  eva: 0  },
  Ranger:   { hp: 0.90, might: 1.10, guard: 0.90, focus: 1.00, resolve: 0.95, speed: 1,  eva: 2  },
  Engineer: { hp: 1.15, might: 0.95, guard: 1.25, focus: 1.05, resolve: 1.00, speed: -1, eva: -2 },
  // Families (Beast)
  Mammalian: { hp: 1.00, might: 1.10, guard: 0.95, focus: 1.00, resolve: 0.95, speed: 1,  eva: 2  },
  Reptilian: { hp: 1.15, might: 1.05, guard: 1.15, focus: 0.95, resolve: 1.00, speed: -1, eva: -2 },
  Avian:     { hp: 0.85, might: 1.00, guard: 0.85, focus: 1.00, resolve: 0.95, speed: 1,  eva: 8  },
  Piscine:   { hp: 1.10, might: 0.95, guard: 1.00, focus: 1.15, resolve: 1.05, speed: 0,  eva: 0  },
  Insectoid: { hp: 0.80, might: 1.00, guard: 0.85, focus: 1.00, resolve: 0.90, speed: 1,  eva: 4  },
  Amphibian: { hp: 1.00, might: 0.95, guard: 1.00, focus: 1.10, resolve: 1.15, speed: 0,  eva: 2  },
  Draconic:  { hp: 1.40, might: 1.10, guard: 1.15, focus: 1.00, resolve: 1.05, speed: -1, eva: -2 },
  // Manifestations (Aberration)
  Eldritch:    { hp: 1.00, might: 1.00, guard: 0.90, focus: 1.20, resolve: 1.05, speed: 0,  eva: 2  },
  Construct:   { hp: 1.15, might: 0.95, guard: 1.25, focus: 1.00, resolve: 1.00, speed: -1, eva: -4 },
  Ooze:        { hp: 1.20, might: 0.85, guard: 1.00, focus: 1.00, resolve: 1.10, speed: -1, eva: 0  },
  Flora:       { hp: 1.10, might: 0.90, guard: 1.05, focus: 1.15, resolve: 1.05, speed: -1, eva: 0  },
  Crystalline: { hp: 0.90, might: 1.00, guard: 1.20, focus: 1.00, resolve: 1.15, speed: 0,  eva: -2 },
  Formless:    { hp: 0.90, might: 0.95, guard: 0.85, focus: 1.05, resolve: 1.00, speed: 1,  eva: 10 },
});

/** FACTOR stat nudges — the "equipment slots". Small multiplier deltas (default 1)
 *  + small additives (speed/eva default 0). A creature holds 2–3 factors, so these
 *  compound gently on top of the kit base. Grounded in the §5 factor stat nudges. */
export const FACTOR_PROFILE = Object.freeze({
  // Weapons (Humanoid)
  Sword:    { might: 1.06 },
  Axe:      { might: 1.08, guard: 0.98 },
  Dagger:   { might: 1.04, speed: 1, eva: 3 },
  Bow:      { might: 1.06 },
  Crossbow: { might: 1.08 },
  Spear:    { might: 1.06, guard: 1.02 },
  Mace:     { might: 1.06, guard: 1.02 },
  Hammer:   { might: 1.12, guard: 1.02, speed: -1 },
  Staff:    { focus: 1.08 },
  Wand:     { focus: 1.06, speed: 1 },
  Shield:   { guard: 1.10, hp: 1.05, eva: -2 },
  Fist:     { might: 1.03, speed: 1, eva: 2 },
  // Anatomy (Beast)
  Claws:  { might: 1.06, eva: 1 },
  Teeth:  { might: 1.07 },
  Beak:   { might: 1.05 },
  Horns:  { might: 1.07, guard: 1.02 },
  Tail:   { eva: 4 },
  Hooves: { might: 1.02, speed: 1 },
  Wings:  { hp: 0.98, speed: 1, eva: 6 },
  Quills: { guard: 1.06 },
  Venom:  { focus: 1.08 },
  Hide:   { hp: 1.06, guard: 1.06 },
  Shell:  { guard: 1.10, speed: -1 },
  Roar:   { focus: 1.06, resolve: 1.02 },
  Breath: { focus: 1.08 },
  // Features (Aberration)
  Tentacle:  { might: 1.05, eva: 1 },
  Eye:       { focus: 1.07 },
  Maw:       { might: 1.08 },
  Pseudopod: { guard: 0.98, eva: 4 },
  Spore:     { focus: 1.08 },
  Shard:     { might: 1.04, guard: 1.04 },
  Miasma:    { focus: 1.07 },
  Roots:     { guard: 1.08, speed: -1 },
  Mandible:  { might: 1.07 },
});

const NEUTRAL = { hp: 1.0, might: 1.0, guard: 1.0, focus: 1.0, resolve: 1.0, speed: 0, eva: 0 };
const MULT_KEYS = ['hp', 'might', 'guard', 'focus', 'resolve'];
const round2 = (n) => Math.round(n * 100) / 100;
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

/** The KIT names a creature carries: its Archetype(s) (class) ∪ Family/Manifestation. */
export function kitsOf(c) {
  return [...arr(c?.class), ...arr(c?.family), ...arr(c?.manifestation)];
}
/** The FACTOR tags a creature carries: Weapons ∪ Anatomy ∪ Features. */
export function factorsOf(c) {
  return [...arr(c?.weapons), ...arr(c?.anatomy), ...arr(c?.features)];
}

/**
 * Compose a creature's stat identity from its kit(s) + factor(s).
 * Kit = averaged base SHAPE; factors = compounding nudges.
 * @param {{ kits?: string[], factors?: string[] }} sel
 * @returns {{ hpMult:number, stats:{ might, guard, focus, resolve, speed, eva } }}
 */
export function statProfile({ kits = [], factors = [] } = {}) {
  const kitRows = arr(kits).map((k) => KIT_PROFILE[k]).filter(Boolean);
  // base = average of the kit rows (hybrid = average of both), else neutral.
  const base = kitRows.length
    ? Object.fromEntries(Object.keys(NEUTRAL).map((k) => [k, kitRows.reduce((s, r) => s + (r[k] ?? NEUTRAL[k]), 0) / kitRows.length]))
    : { ...NEUTRAL };

  // layer factor nudges: multipliers compound, speed/eva add.
  for (const f of arr(factors)) {
    const row = FACTOR_PROFILE[f];
    if (!row) continue;
    for (const k of MULT_KEYS) if (row[k] != null) base[k] *= row[k];
    base.speed += row.speed ?? 0;
    base.eva += row.eva ?? 0;
  }

  return {
    hpMult: round2(base.hp),
    stats: {
      might: round2(base.might), guard: round2(base.guard), focus: round2(base.focus),
      resolve: round2(base.resolve), speed: Math.round(base.speed), eva: Math.round(base.eva),
    },
  };
}

/** Convenience: compose straight from a creature-like object. */
export function creatureStatProfile(c) {
  return statProfile({ kits: kitsOf(c), factors: factorsOf(c) });
}
