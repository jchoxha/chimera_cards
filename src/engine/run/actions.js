// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/actions — the run ACTION registry. Each action is  ║
// ║ a pure-ish mutator (state, props) → void|state, applied on a fresh    ║
// ║ clone by the ActionManager (so past/future undo works). Serializable. ║
// ║ UPDATE WHEN: new run-level transitions (rooms, economy) are added.    ║
// ╚══════════════════════════════════════════════════════════════════╝

import { reachableFrom, nodeById } from './map.js';

const member = (s, id) => s.party.find((p) => p.id === id) || s.party[0] || null;

export const ACTIONS = {
  // ── economy ──
  gainGold: (s, { amount = 0 }) => { s.gold += amount; },
  spendGold: (s, { amount = 0 }) => { if (s.gold >= amount) s.gold -= amount; },

  // ── inventory ──
  addRelic: (s, { relic }) => { if (relic) s.relics.push(relic); },
  addPotion: (s, { potion }) => { if (potion) s.potions.push(potion); },
  usePotion: (s, { index }) => { if (index >= 0 && index < s.potions.length) s.potions.splice(index, 1); },

  // ── deck building ──
  addCardToDeck: (s, { memberId, card }) => { const m = member(s, memberId); if (m && card) m.deck.push({ ...card }); },
  removeCard: (s, { memberId, cardId }) => {
    const m = member(s, memberId); if (!m) return;
    const i = m.deck.findIndex((c) => c.id === cardId); if (i !== -1) m.deck.splice(i, 1);
  },
  upgradeCard: (s, { memberId, cardId, patch }) => {
    const m = member(s, memberId); if (!m) return;
    const c = m.deck.find((x) => x.id === cardId); if (c) Object.assign(c, patch, { upgraded: true });
  },

  // ── party / health ──
  healParty: (s, { amount, pct }) => {
    for (const p of s.party) {
      if (p.hp <= 0) continue;
      const heal = pct != null ? Math.round(p.maxHp * pct) : (amount ?? 0);
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
  },
  healMember: (s, { memberId, amount = 0 }) => { const m = member(s, memberId); if (m && m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + amount); },

  // ── combat result fold-back ──
  applyCombatResult: (s, { hpById = {}, won }) => {
    for (const p of s.party) if (hpById[p.id] != null) p.hp = Math.max(0, hpById[p.id]);
    if (won === false) s.status = 'lost';
  },

  // ── navigation / lifecycle ──
  /** Move to a reachable node, marking it visited. No-op if unreachable. */
  travel: (s, { nodeId }) => {
    if (!reachableFrom(s.map, s.position).includes(nodeId)) return;
    s.position = nodeId;
    const n = nodeById(s.map, nodeId);
    if (n) { s.floor = n.floor; n.visited = true; }
  },
  setPosition: (s, { nodeId }) => { s.position = nodeId; },
  setFloor: (s, { floor }) => { s.floor = floor; },
  setStatus: (s, { status }) => { s.status = status; },
  nextAct: (s) => { s.act += 1; s.floor = 0; },
};
