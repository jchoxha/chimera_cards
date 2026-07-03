// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/biology — body/subtype → stat profile (synthesis ║
// ║ §7.1, reworked for the §9 Body-Type model). A creature's HP multiplier + ║
// ║ 5-stat vector (Might/Guard/Focus/Resolve/Speed) now composes from:       ║
// ║   BODY_PROFILE (Humanoid/Beast/Aberration, averaged for hybrids)          ║
// ║   × SUBTYPE_PROFILE per descriptive subtype (Giant/Mechanical/…)          ║
// ║   × FAMILY_PROFILE for stat-relevant families (Draconic bulk).            ║
// ║ Legacy 9-biology names still resolve (old saves / tests) via              ║
// ║ LEGACY_PROFILE. Pure data + helpers (node-testable). REVIEW/tunable.      ║
// ║ UPDATE WHEN: the profiles or the stat model change.                      ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Body Types (the FORM) — absolute base rows. Speed is a flat add. */
export const BODY_PROFILE = Object.freeze({
  Humanoid:   { hp: 1.0, might: 1.0,  guard: 1.0, focus: 1.0,  resolve: 1.0, speed: 1 },
  Beast:      { hp: 0.9, might: 1.15, guard: 0.9, focus: 1.0,  resolve: 0.9, speed: 1 },
  Aberration: { hp: 1.0, might: 1.0,  guard: 1.0, focus: 1.1,  resolve: 1.0, speed: 0 },
});

/** Descriptive subtypes — MULTIPLIERS layered onto the body base (speed adds).
 *  Tuned to preserve the old standalone-biology identities (Giant bulk, Mechanical
 *  guard, …). Backlog subtypes carry light provisional rows. */
export const SUBTYPE_PROFILE = Object.freeze({
  Giant:      { hp: 1.6,  might: 1.2,  guard: 1.1,  focus: 0.9,  resolve: 1.0,  speed: -1 },
  Mechanical: { hp: 1.1,  might: 1.0,  guard: 1.4,  focus: 1.0,  resolve: 1.0,  speed: 0 },
  Elemental:  { hp: 1.0,  might: 1.0,  guard: 1.0,  focus: 1.15, resolve: 1.0,  speed: 0 },
  Demonic:    { hp: 1.0,  might: 1.15, guard: 0.9,  focus: 1.05, resolve: 1.0,  speed: 0 },
  Undead:     { hp: 1.1,  might: 1.0,  guard: 1.0,  focus: 1.0,  resolve: 1.1,  speed: 0 },
  Hallowed:   { hp: 1.0,  might: 1.0,  guard: 1.0,  focus: 1.0,  resolve: 1.15, speed: 0 },
  Feral:      { hp: 0.95, might: 1.15, guard: 0.85, focus: 1.0,  resolve: 0.95, speed: 0 },
  Ancient:    { hp: 1.15, might: 1.0,  guard: 1.05, focus: 1.1,  resolve: 1.05, speed: -1 },
  Swarm:      { hp: 0.85, might: 1.0,  guard: 0.9,  focus: 1.0,  resolve: 0.95, speed: 1 },
  Cursed:     { hp: 1.0,  might: 1.0,  guard: 1.0,  focus: 1.1,  resolve: 0.9,  speed: 0 },
  Spectral:   { hp: 0.9,  might: 1.0,  guard: 0.85, focus: 1.05, resolve: 1.1,  speed: 0 },
});

/** Stat-relevant families (multipliers over the body base). Draconic carries the
 *  old Dragonkin bulk (a dragon is tougher + slower than a common beast). */
export const FAMILY_PROFILE = Object.freeze({
  Draconic: { hp: 1.45, might: 1.05, guard: 1.2, focus: 1.0, resolve: 1.1, speed: -1 },
});

/** Legacy 9-biology absolute rows — old saves / defs that still carry e.g.
 *  biology:['Giant'] resolve here so nothing breaks mid-migration. */
const LEGACY_PROFILE = Object.freeze({
  Undead:     { hp: 1.1, might: 1.0,  guard: 1.0, focus: 1.0,  resolve: 1.1, speed: 0 },
  Dragonkin:  { hp: 1.3, might: 1.2,  guard: 1.1, focus: 1.0,  resolve: 1.0, speed: 0 },
  Elemental:  { hp: 1.0, might: 1.0,  guard: 1.0, focus: 1.15, resolve: 1.0, speed: 0 },
  Demon:      { hp: 1.0, might: 1.15, guard: 0.9, focus: 1.05, resolve: 1.0, speed: 0 },
  Mechanical: { hp: 1.1, might: 1.0,  guard: 1.4, focus: 1.0,  resolve: 1.0, speed: 0 },
  Giant:      { hp: 1.6, might: 1.2,  guard: 1.1, focus: 0.9,  resolve: 1.0, speed: -1 },
});

/** Back-compat alias: the old per-biology table (body types + legacy rows). */
export const BIOLOGY_PROFILE = Object.freeze({ ...LEGACY_PROFILE, ...BODY_PROFILE });

const NEUTRAL = { hp: 1.0, might: 1.0, guard: 1.0, focus: 1.0, resolve: 1.0, speed: 0 };
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Resolve a creature's HP multiplier + stat line.
 * @param {string[]|string} biology   body type(s) (legacy 9-biology names also resolve)
 * @param {string[]} [subtypes]       descriptive subtypes (Giant/Mechanical/…)
 * @param {string|null} [family]      Beast/Aberration family (Draconic is stat-relevant)
 * @returns {{ hpMult:number, stats:{might:number,guard:number,focus:number,resolve:number,speed:number} }}
 */
export function biologyStats(biology, subtypes = [], family = null) {
  const bases = (Array.isArray(biology) ? biology : [biology]).filter(Boolean);
  const profs = bases.map((b) => BIOLOGY_PROFILE[b]).filter(Boolean);
  const base = profs.length
    ? Object.fromEntries(['hp', 'might', 'guard', 'focus', 'resolve', 'speed']
        .map((k) => [k, profs.reduce((s, p) => s + p[k], 0) / profs.length]))
    : { ...NEUTRAL };

  // layer subtype + family MODIFIERS (multiplicative; speed adds).
  const mods = [
    ...(Array.isArray(subtypes) ? subtypes : [subtypes]).filter(Boolean).map((s) => SUBTYPE_PROFILE[s]),
    FAMILY_PROFILE[family],
  ].filter(Boolean);
  for (const m of mods) {
    for (const k of ['hp', 'might', 'guard', 'focus', 'resolve']) base[k] *= m[k];
    base.speed += m.speed;
  }

  return {
    hpMult: round2(base.hp),
    stats: {
      might: round2(base.might), guard: round2(base.guard), focus: round2(base.focus),
      resolve: round2(base.resolve), speed: Math.round(base.speed),
    },
  };
}

export { NEUTRAL };
