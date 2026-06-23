// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/content/biology — biology → stat profile (synthesis     ║
// ║ §7.1). Biology sets a creature's HP multiplier + its 5-stat vector      ║
// ║ (Might/Guard/Focus/Resolve/Speed), so the same archetype+attunement      ║
// ║ plays differently per body. Pure data + helpers (node-testable).         ║
// ║ Passive traits (Undying/Lifesteal/Construct…) are a later pass.          ║
// ║ UPDATE WHEN: the biology profiles or the stat model change.            ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Per-biology { hp multiplier, stat multipliers (Speed is a flat add) }.
 *  Adapted from synthesis-matrix-spec §7.1 onto the 5-stat model. REVIEW/tunable. */
export const BIOLOGY_PROFILE = Object.freeze({
  Beast:      { hp: 0.9, might: 1.15, guard: 0.9, focus: 1.0,  resolve: 0.9, speed: 1 },
  Humanoid:   { hp: 1.0, might: 1.0,  guard: 1.0, focus: 1.0,  resolve: 1.0, speed: 1 },
  Undead:     { hp: 1.1, might: 1.0,  guard: 1.0, focus: 1.0,  resolve: 1.1, speed: 0 },
  Dragonkin:  { hp: 1.3, might: 1.2,  guard: 1.1, focus: 1.0,  resolve: 1.0, speed: 0 },
  Elemental:  { hp: 1.0, might: 1.0,  guard: 1.0, focus: 1.15, resolve: 1.0, speed: 0 },
  Demon:      { hp: 1.0, might: 1.15, guard: 0.9, focus: 1.05, resolve: 1.0, speed: 0 },
  Mechanical: { hp: 1.1, might: 1.0,  guard: 1.4, focus: 1.0,  resolve: 1.0, speed: 0 },
  Giant:      { hp: 1.6, might: 1.2,  guard: 1.1, focus: 0.9,  resolve: 1.0, speed: -1 },
  Aberration: { hp: 1.0, might: 1.0,  guard: 1.0, focus: 1.1,  resolve: 1.0, speed: 0 },
});

const NEUTRAL = { hp: 1.0, might: 1.0, guard: 1.0, focus: 1.0, resolve: 1.0, speed: 0 };
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Resolve a creature's HP multiplier + stat line from its biology (1–2 bases,
 * averaged — A2 equal weight). Returns { hpMult, stats:{might,guard,focus,resolve,speed} }.
 * @param {string[]|string} biology
 */
export function biologyStats(biology) {
  const bases = (Array.isArray(biology) ? biology : [biology]).filter(Boolean);
  const profs = bases.map((b) => BIOLOGY_PROFILE[b]).filter(Boolean);
  if (!profs.length) return { hpMult: 1, stats: { might: 1, guard: 1, focus: 1, resolve: 1, speed: 0 } };
  const avg = (k) => profs.reduce((s, p) => s + p[k], 0) / profs.length;
  return {
    hpMult: round2(avg('hp')),
    stats: {
      might: round2(avg('might')), guard: round2(avg('guard')), focus: round2(avg('focus')),
      resolve: round2(avg('resolve')), speed: Math.round(avg('speed')),
    },
  };
}

export { NEUTRAL };
