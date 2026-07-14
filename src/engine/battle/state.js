// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/battle/state — the COMBAT-V2 SQUAD board model            ║
// ║ (docs/combat-v2-spec.md §3). A side fields up to 10 squads; a squad is    ║
// ║ 1–3 creatures = 1 front Vanguard (memberIds[frontIndex]) + up to 2 rear   ║
// ║ Support, with its own energy + (later) shared deck/hand. Units carry the  ║
// ║ 7-stat line + hp/block(temp HP)/statuses. Helpers resolve the live front  ║
// ║ (auto-promoting when the Vanguard falls) and reachability (back row is    ║
// ║ hittable only by `reachesBack` cards). Pure; the round resolver           ║
// ║ (round.js) mutates these. Backward-compatible: a flat `{unitsById}` with  ║
// ║ no squads treats each unit as its own solo squad.                          ║
// ║ UPDATE WHEN: the squad/side board shape or front/reach rules change.      ║
// ╚══════════════════════════════════════════════════════════════════╝

/** A single battle creature. Step-2/3 unit. */
export function makeUnit({ id, side, squadId = id, stats, hp, maxHp, block = 0, statuses = [] }) {
  // baseStats = the creature's own line; `stats` is the EFFECTIVE line (base + formation auras,
  // recomputed each round by applyFormationAuras). They start equal.
  return { id, side, squadId, baseStats: { ...stats }, stats: { ...stats }, hp: hp ?? maxHp, maxHp: maxHp ?? hp, block, statuses: [...statuses] };
}

/** A squad: an ordered member list (index 0 default front), per-squad energy. */
export function makeSquad({ id, side, memberIds, frontIndex = 0, energy = 3, maxEnergy = 3 }) {
  return { id, side, memberIds: [...memberIds], frontIndex, energy, maxEnergy };
}

/**
 * Build a full squad board from a spec:
 *   { p: [{ id, members:[unit,…], energy? }, …], e: [ … ] }
 * Returns { sides:{p:[squadId…],e:[squadId…]}, squadsById, unitsById }.
 */
export function buildState(spec) {
  const squadsById = {}; const unitsById = {}; const sides = { p: [], e: [] };
  for (const side of ['p', 'e']) {
    for (const sq of spec[side] || []) {
      const memberIds = [];
      for (const u of sq.members) { u.side = side; u.squadId = sq.id; unitsById[u.id] = u; memberIds.push(u.id); }
      squadsById[sq.id] = makeSquad({ id: sq.id, side, memberIds, energy: sq.energy, maxEnergy: sq.energy });
      sides[side].push(sq.id);
    }
  }
  return { sides, squadsById, unitsById };
}

const alive = (u) => !!u && u.hp > 0;
export const isAlive = alive;

/** The squad a unit belongs to (null in legacy flat state). */
export function unitSquad(state, unit) {
  return unit && state.squadsById ? state.squadsById[unit.squadId] || null : null;
}

/** The squad's effective FRONT unit: the Vanguard if alive, else the first alive
 *  member (support auto-promotes). Null if the whole squad is down. */
export function liveFrontUnit(state, squad) {
  if (!squad) return null;
  const front = state.unitsById[squad.memberIds[squad.frontIndex]];
  if (alive(front)) return front;
  for (const id of squad.memberIds) { const u = state.unitsById[id]; if (alive(u)) return u; }
  return null;
}

/** Is `unit` reachable by `card`? Front row always; back row only via reachesBack. */
export function reachable(state, unit, card) {
  if (!alive(unit)) return false;
  const squad = unitSquad(state, unit);
  if (!squad) return true;                              // legacy solo unit
  const front = liveFrontUnit(state, squad);
  return unit === front || !!card?.reachesBack;
}

/** Move `unit` to the front of its squad (auto-swap / reposition). */
export function setFront(state, unit) {
  const squad = unitSquad(state, unit);
  if (!squad) return false;
  const idx = squad.memberIds.indexOf(unit.id);
  if (idx < 0 || idx === squad.frontIndex) return false;
  squad.frontIndex = idx;
  return true;
}

/** The first live front across all of `enemySide`'s squads (for `adaptive` retargeting). */
export function anyLiveEnemyFront(state, ownerSide) {
  if (!state.sides) return null;
  const enemy = ownerSide === 'p' ? 'e' : 'p';
  for (const sqId of state.sides[enemy] || []) {
    const f = liveFrontUnit(state, state.squadsById[sqId]);
    if (f) return f;
  }
  return null;
}

/** Every living unit on a side (or the whole board if side omitted). */
export function liveUnits(state, side = null) {
  return Object.values(state.unitsById).filter((u) => alive(u) && (!side || u.side === side));
}

/** Living members of a squad. */
export function squadLiveMembers(state, squad) {
  return squad ? squad.memberIds.map((id) => state.unitsById[id]).filter(alive) : [];
}
