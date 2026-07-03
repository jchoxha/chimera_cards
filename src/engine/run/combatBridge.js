// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/combatBridge — bridges the RUN layer and the       ║
// ║ in-place VanguardManager combat. Builds Fighters from the run party    ║
// ║ (per-monster decks/stats/HP), runs a combat as a sub-process, and      ║
// ║ folds the outcome (surviving HP, win/loss) back as a run action.       ║
// ║ UPDATE WHEN: party→fighter mapping or outcome shape changes.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createFighter } from '../combat/state.js';
import { VanguardManager } from '../combat/VanguardManager.js';
import { applyCardSpec } from '../combat/interpret.js';
import { makeRng } from './rng.js';

/**
 * Build one combat Fighter from a generated creature (carrying current HP + deck
 * + stats + axes + portrait). Used for both the player party and roster enemies.
 * @param {Object} m   generated creature ({id,name,class,biology,attunement,stats,maxHp,hp,deck,portrait})
 * @param {{ id?:string, hp?:number, maxHp?:number }} [over]  field overrides (e.g. a fresh enemy id / scaled HP)
 */
export function creatureToFighter(m, over = {}) {
  const maxHp = over.maxHp ?? m.maxHp;
  const f = createFighter({
    id: over.id ?? m.id,
    name: m.name,
    types: (m.attunement ?? ['Physical']).map((a) => ({ type: a, weight: 1 })),
    hp: over.hp ?? m.hp,
    maxHp,
    stats: m.stats,
  });
  if (m.class) f.class = m.class;
  if (m.biology) f.biology = m.biology;
  if (m.attunement) f.attunement = m.attunement;
  if (m.family) f.family = m.family;       // Beast kit: family (axis-2) + anatomy (special factors)
  if (m.anatomy) f.anatomy = m.anatomy;
  if (m.weapons) f.weapons = m.weapons;    // Humanoid special factors (weapons)
  if (m.subtypes) f.subtypes = m.subtypes; // descriptive subtypes (Mechanical/Giant/…)
  applySubtypeTraits(f, m.subtypes);        // innate trait powers (show as pips)
  if (m.portrait) f.meta = { ...f.meta, portrait: m.portrait };
  // carry the creature's SIZE (form) so the combat card shows its size badge
  const form = over.form || m.size || m.meta?.form;
  if (form) f.meta = { ...f.meta, form };
  f.deck.drawPile = (m.deck ?? []).map((c) => ({ ...c }));
  return f;
}

/** Build combat Fighters from the LIVING run party (carrying current HP + deck + stats + axes). */
export function partyToFighters(party) {
  return party.filter((m) => m.hp > 0).map((m) => creatureToFighter(m));
}

/**
 * Start a combat for the current run node. Combat RNG is forked deterministically
 * from the run's RNG state + floor (so a given run/floor replays the same), but is
 * NOT threaded back — the run's own rngState advances via map/reward draws.
 * @param {Object} runState
 * @param {import('../types.js').Fighter[]} enemyFighters
 * @param {{ room?: string }} [opts]
 * @returns {VanguardManager}
 */
export function startRunCombat(runState, enemyFighters, { room = 'combat' } = {}) {
  const combatRng = makeRng((runState.rngState ^ (runState.floor * 0x9e3779b1)) >>> 0);
  // Difficulty ramp: early normal fights play forgivingly (`basic`), deeper ones
  // sharpen to `normal`; elites/bosses derive `sharp`/`expert` from their room (null).
  const aiSkill = room === 'combat' ? ((runState.floor ?? 0) <= 3 ? 'basic' : 'normal') : null;
  const vm = new VanguardManager({
    playerFighters: partyToFighters(runState.party),
    enemyFighters,
    room,
    rarity: { offset: -0.05, ascension7: false },
    config: { aiSkill },
    rng: () => combatRng.next(),
  });
  vm.startCombat();
  applyRelics(vm, runState.relics);
  return vm;
}

// ── Innate subtype TRAITS (docs/biology-kits.md §9.2 — mechanical depth) ──────
// Each descriptive subtype grants a small always-on trait power (rendered as a
// persistent pip), so a Mechanical/Undead/Demonic/Elemental/Giant creature FEELS
// different beyond its card package. Numbers REVIEW/tunable.
const SUBTYPE_TRAITS = Object.freeze({
  Mechanical: { source: 'mechanical_plating', on: 'turnStart', effects: [{ op: 'block', value: 2 }] },                                  // armor reknits each turn
  Undead: { source: 'undead_deathless', on: 'onDamageTaken', effects: [{ op: 'buff', status: 'regen', value: 1 }] },                     // the dead knit back together
  Demonic: { source: 'demonic_dread', on: 'turnStart', effects: [{ op: 'debuff', status: 'weak', value: 1, scope: 'enemyActiveTarget' }] }, // dread presence
  Elemental: { source: 'elemental_overflow', on: 'turnEnd', effects: [{ op: 'damage', value: 2, scope: 'enemyActiveTarget' }] },         // elemental discharge
});

/** Register each subtype's innate trait power; Giant instead starts combats with
 *  a slab of braced Block (its colossal frame). */
function applySubtypeTraits(f, subtypes = []) {
  for (const s of subtypes || []) {
    const t = SUBTYPE_TRAITS[s];
    if (t) {
      f.powers = f.powers ?? [];
      f.powers.push({ source: t.source, on: t.on, effects: t.effects.map((o) => ({ ...o })), duration: null, attunement: null });
    }
    if (s === 'Giant') f.bracedBlock = (f.bracedBlock ?? 0) + 6;
  }
}

/**
 * Inject the run's relics into a started combat. A relic with `onCombatStart`
 * (an effect op-list) runs it on the player Vanguard; one with `passive` registers
 * that passive on the Vanguard. (Reuses the card effect system — relics are just
 * run-long effect sources. Side-global relics are a later refinement.)
 */
export function applyRelics(vm, relics = []) {
  const s = vm.state;
  const v = s.player.fighters[s.player.vanguardIndex];
  if (!v) return;
  for (const relic of relics) {
    if (relic.passive) { v.powers = v.powers ?? []; v.powers.push({ source: relic.id, on: null, effects: [], duration: null, passive: relic.passive, attunement: null }); }
    if (Array.isArray(relic.onCombatStart) && relic.onCombatStart.length) {
      applyCardSpec(s, 'player', v, { id: relic.id, name: relic.name, type: 'skill', cost: 0, attunement: 'Physical', effects: relic.onCombatStart }, { emit: vm._emit.bind(vm), rng: vm.rng });
    }
  }
}

/** Read a finished combat's outcome for fold-back. */
export function combatOutcome(vm) {
  const won = vm.state.phase === 'victory';
  const hpById = {};
  for (const f of vm.state.player.fighters) hpById[f.id] = f.hp;
  return { won, hpById };
}
