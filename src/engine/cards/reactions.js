// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/reactions — the §5.2 status × attunement REACTION ║
// ║ engine (docs/mechanics.md §2–§4). A reaction fires when an ATTACK HIT  ║
// ║ of element X lands on a target carrying a status X reacts with. Rules:  ║
// ║ keyed on the CARD's element; symmetric; every relevant status reacts    ║
// ║ (most-recently-applied first); consumption is per-cell. Reactions are   ║
// ║ PURE UPSIDE — statuses stand alone, so this never gates a status's value.║
// ║                                                                          ║
// ║ DATA-DRIVEN + SWAPPABLE: the whole matrix is the `REACTIONS` table       ║
// ║ ({element:{statusId:cell}}). Add/tune a cell = edit one entry. NUMBERS   ║
// ║ ARE FIRST-PASS / REVIEW (per the doc) — tune freely.                     ║
// ║ UPDATE WHEN: a matrix cell / a status's reaction behavior changes.       ║
// ╚══════════════════════════════════════════════════════════════════╝

import { addStatus, stackingFor, applyDamage, applyHeal } from '../combat/resolve.js';

const sideOf = (state, f) => (state.player.fighters.includes(f) ? state.player : state.enemy);
/** Primary element of the card (a re-skinned creature reacts with its converted element). */
export const primaryElement = (att) => (Array.isArray(att) ? att[0] : att) || null;

/**
 * A reaction cell receives a `ctx` of bound helpers so the table reads declaratively.
 * Helpers (all no-ops when not meaningful):
 *   ctx.stacks            current amount of the primer status
 *   ctx.dmg(n)            deal n reaction damage to the target (bypasses Block — a burst)
 *   ctx.add(id,n)         add status n to the target
 *   ctx.selfAdd(id,n)     add status n to the attacker
 *   ctx.set(n)            set the primer's amount (0 = consume)
 *   ctx.consume()         consume the primer (set to 0)
 *   ctx.heal(n)           heal the attacker n
 *   ctx.others()          living units on the target's side except the target
 *   ctx.spread(id,n,k)    apply status n to up to k other units on the target's side
 */
function makeCtx(state, attacker, target, status, emit, rng) {
  const tSide = sideOf(state, target);
  const stat = (unit, id, n) => {
    if (n <= 0 || !unit || unit.hp <= 0) return;
    addStatus(unit.statuses, { id, amount: n, stacking: stackingFor(id) });
    emit?.('status', { targetId: unit.id, id, amount: unit.statuses.find((s) => s.id === id)?.amount ?? n });
  };
  return {
    state, attacker, target, status, rng,
    stacks: status.amount,
    dmg: (n) => { if (n > 0) applyDamage(target, Math.round(n), emit, true, tSide); },
    add: (id, n) => stat(target, id, n),
    selfAdd: (id, n) => stat(attacker, id, n),
    set: (n) => { status.amount = Math.max(0, n); emit?.('status', { targetId: target.id, id: status.id, amount: status.amount }); },
    consume: () => { status.amount = 0; emit?.('status', { targetId: target.id, id: status.id, amount: 0 }); },
    heal: (n) => { if (n > 0) applyHeal(attacker, Math.round(n), emit); },
    others: () => tSide.fighters.filter((f) => f.hp > 0 && f !== target),
    spread: (id, n, k = 1) => {
      const pool = tSide.fighters.filter((f) => f.hp > 0 && f !== target);
      for (let i = 0; i < k && i < pool.length; i++) stat(pool[i], id, n);
    },
  };
}

/**
 * The reaction matrix. `REACTIONS[element][statusId] = { verb, react(ctx) }`.
 * Only the logically-meaningful cells exist; everything else = no reaction.
 *
 * TWO DESIGN AXES (locked 2026-06-24):
 *   • Consumption — DETONATE consumes its primer (a one-shot burst; re-apply to
 *     fire again); AMPLIFY/SPREAD leaves or grows the primer (a standing engine).
 *   • Magnitude — scales with the PRIMER's stacks (`c.stacks`), so building a big
 *     DoT/debuff before popping it pays off (bigger primer → bigger reaction).
 * Soak stays a per-cell primer (its own Steam/Bloom/Freeze/Electrocute cells); it
 * is NOT a universal amplifier of unrelated reactions.
 * (Subset of docs/mechanics.md §4 — numbers are first-pass / REVIEW, tune freely.)
 */
export const REACTIONS = {
  Fire: {
    burn: { verb: 'Flare-up', react: (c) => c.add('burn', 2) },                 // amplify: stoke the fire
    weak: { verb: 'Melt', react: (c) => { const v = c.stacks; c.consume(); c.dmg(4 * v); } },   // detonate
    poison: { verb: 'Combust', react: (c) => { const v = c.stacks; c.consume(); c.dmg(v * 2); } },
    soak: { verb: 'Steam', react: (c) => { const s = c.stacks; c.consume(); c.dmg(3 + 2 * s); c.add('weak', 1); } },
  },
  Water: {
    burn: { verb: 'Quench', react: (c) => { c.consume(); c.add('weak', 1); } }, // detonate: steam → Weak
    poison: { verb: 'Spread', react: (c) => c.spread('poison', c.stacks, 1) },  // amplify: copy toxin
    shock: { verb: 'Conduct', react: (c) => c.spread('shock', c.stacks, 2) },   // amplify: electrify the wet
  },
  Nature: {
    burn: { verb: 'Wildfire', react: (c) => c.spread('burn', c.stacks, 1) },    // amplify: fire spreads
    poison: { verb: 'Fester', react: (c) => c.set(c.stacks * 2) },              // amplify: toxin doubles
    soak: { verb: 'Bloom', react: (c) => { const s = c.stacks; c.consume(); c.add('poison', 2 + s); } },
  },
  Void: {
    burn: { verb: 'Devour', react: (c) => { const v = c.stacks; c.consume(); c.heal(v); } },
    bleed: { verb: 'Devour', react: (c) => { const v = c.stacks; c.consume(); c.heal(v); } },
    decay: { verb: 'Collapse', react: (c) => c.set(c.stacks * 2) },             // amplify: entropy feeds entropy
  },
  Physical: {
    bleed: { verb: 'Rend', react: (c) => { c.dmg(c.stacks); c.add('bleed', 1); } },   // amplify: dmg = wound, deepen it
    vulnerable: { verb: 'Exploit', react: (c) => c.add('vulnerable', 1) },
    shock: { verb: 'Ground', react: (c) => { const v = c.stacks; c.consume(); c.dmg(3 * v); } },   // detonate
    expose: { verb: 'Smash', react: (c) => { c.dmg(2 * c.stacks); c.add('expose', 1); } },         // amplify
  },
  Energy: {
    soak: { verb: 'Electrocute', react: (c) => { const s = c.stacks; c.consume(); c.add('shock', 1); c.spread('shock', 1, s); } },
  },
  Frost: {
    soak: { verb: 'Freeze', react: (c) => { const s = c.stacks; c.consume(); c.add('expose', 1 + s); } },   // detonate
    bleed: { verb: 'Frostbite', react: (c) => c.add('bleed', 1) },              // amplify: entrench the wound
  },
  Holy: {
    poison: { verb: 'Purge-Smite', react: (c) => { const v = c.stacks; c.consume(); c.dmg(v); } },
    decay: { verb: 'Restore', react: (c) => { const v = c.stacks; c.consume(); c.dmg(v); } },
  },
  Shadow: {
    vulnerable: { verb: 'Sunder', react: (c) => c.add('vulnerable', 2) },       // amplify: deepen the breach
    strength: { verb: 'Corrupt', react: (c) => { c.set(c.stacks - 1); c.add('weak', 1); } },
    regen: { verb: 'Corrupt', react: (c) => { c.set(c.stacks - 1); c.add('poison', 1); } },
  },
  Arcane: {
    poison: { verb: 'Transmute', react: (c) => { const v = c.stacks; c.consume(); c.add('decay', v); } },
    confuse: { verb: 'Transmute', react: (c) => { const v = c.stacks; c.consume(); c.add('weak', 1 + v); } },   // detonate
    vulnerable: { verb: 'Transmute', react: (c) => c.add('weak', 1) },
  },
  Air: {
    expose: { verb: 'Gale', react: (c) => { c.consume(); c.dmg(c.stacks); } },  // detonate: blow the breach open
    burn: { verb: 'Backdraft', react: (c) => { const v = c.stacks; c.consume(); c.dmg(v); c.spread('burn', Math.ceil(v / 2), 1); } },
  },
};

// `strength`/`regen` Corrupt cells reference status keys that may live on either side;
// they fire when the TARGET carries that (buff) status — used vs buffed foes.

/**
 * Fire all reactions for one attack hit of `element` against `target`.
 * Evaluates EVERY status on the target, most-recently-applied first (array order
 * is reversed — addStatus appends, so the tail is the freshest). Returns the list
 * of reaction names that fired (for logging / the UI readout).
 * @returns {string[]} verbs that fired
 */
export function fireReactions(state, attacker, target, element, { emit, rng } = {}) {
  const el = primaryElement(element);
  if (!el || !REACTIONS[el] || !target || target.hp <= 0) return [];
  const cells = REACTIONS[el];
  const fired = [];
  // Snapshot the status ids present BEFORE reactions mutate them (freshest first).
  const ids = target.statuses.filter((s) => s.amount > 0).map((s) => s.id).reverse();
  for (const id of ids) {
    const cell = cells[id];
    if (!cell) continue;
    const status = target.statuses.find((s) => s.id === id);
    if (!status || status.amount <= 0) continue;   // consumed by an earlier reaction this hit
    const ctx = makeCtx(state, attacker, target, status, emit, rng);
    cell.react(ctx);
    fired.push(cell.verb);
    emit?.('reaction', { attackerId: attacker.id, targetId: target.id, element: el, status: id, verb: cell.verb });
  }
  return fired;
}

/**
 * NON-MUTATING value estimate of the reactions an attack of `element` would
 * trigger against `target` — used by the AI planner to SEEK reactions (prefer a
 * reacting element, and set up its own primers). Pure: it runs the same cells
 * against a throwaway stack-bookkeeping ctx, accumulating an HP-equivalent worth.
 * `extraStatuses` (statusId→amount) folds in primers an earlier action in the same
 * planned turn will have already applied, so a setup→detonate chain is valued.
 * @returns {{ damage:number, heal:number, score:number }}
 */
export function previewReactions(target, element, extraStatuses = {}) {
  const el = primaryElement(element);
  if (!el || !REACTIONS[el] || !target || target.hp <= 0) return { damage: 0, heal: 0, score: 0 };
  const cells = REACTIONS[el];
  // Working primer stacks (freshest-last in `order`); extras count as freshest.
  const work = {};
  for (const s of target.statuses || []) if (s.amount > 0) work[s.id] = (work[s.id] || 0) + s.amount;
  for (const [id, n] of Object.entries(extraStatuses)) if (n > 0) work[id] = (work[id] || 0) + n;

  let damage = 0, heal = 0, statusVal = 0;
  // Freshest-first: extra (just-applied) primers, then the existing stack tail→head.
  const order = [...Object.keys(extraStatuses), ...(target.statuses || []).map((s) => s.id).reverse()];
  const seen = new Set();
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const cell = cells[id];
    if (!cell || !(work[id] > 0)) continue;
    const ctx = {
      stacks: work[id],
      rng: () => 0.5,
      dmg: (n) => { if (n > 0) damage += n; },
      heal: (n) => { if (n > 0) heal += n; },
      add: (i, n) => { if (n > 0) statusVal += n; },
      selfAdd: () => {},
      set: (n) => { work[id] = Math.max(0, n); },
      consume: () => { work[id] = 0; },
      others: () => [],
      spread: (i, n, k = 1) => { if (n > 0) statusVal += n * Math.max(1, k) * 0.5; },
    };
    cell.react(ctx);
  }
  // Direct damage is worth face value; self-heal and applied statuses are softer.
  const score = damage + heal * 0.8 + statusVal * 1.2;
  return { damage, heal, score };
}
