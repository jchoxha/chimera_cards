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
  addRelic: (s, { relic }) => { if (relic && !s.relics.some((r) => r.id === relic.id)) s.relics.push(relic); },
  addPotion: (s, { potion }) => { if (potion) s.potions.push(potion); },
  usePotion: (s, { index }) => { if (index >= 0 && index < s.potions.length) s.potions.splice(index, 1); },

  // ── shop (atomic gold check + grant) ──
  buyCard: (s, { memberId, card, cost = 0 }) => { if (s.gold >= cost && card) { s.gold -= cost; const m = member(s, memberId); if (m) m.deck.push({ ...card }); } },
  buyRelic: (s, { relic, cost = 0 }) => { if (s.gold >= cost && relic && !s.relics.some((r) => r.id === relic.id)) { s.gold -= cost; s.relics.push(relic); } },
  buyPotion: (s, { potion, cost = 0 }) => { if (s.gold >= cost && potion) { s.gold -= cost; s.potions.push(potion); } },

  // ── deck building ──
  addCardToDeck: (s, { memberId, card }) => { const m = member(s, memberId); if (m && card) m.deck.push({ ...card }); },
  removeCard: (s, { memberId, cardId }) => {
    const m = member(s, memberId); if (!m) return;
    const i = m.deck.findIndex((c) => c.id === cardId); if (i !== -1) m.deck.splice(i, 1);
  },
  /** Upgrade a card via an explicit `patch`, else the card's own `upgrade` payload. */
  upgradeCard: (s, { memberId, cardId, patch }) => {
    const m = member(s, memberId); if (!m) return;
    const c = m.deck.find((x) => x.id === cardId); if (!c || c.upgraded) return;
    const up = patch ?? c.upgrade;
    if (up) Object.assign(c, up);
    c.upgraded = true;
    if (!c.name.endsWith('+')) c.name = `${c.name}+`;
  },

  // ── card rewards (offered after a victory; choose adds to a deck, or skip) ──
  // `offers` = per-member option groups [{memberId,name,cards}]; `cards` = a flat
  // legacy list (still accepted). pendingReward stores whichever was provided.
  offerReward: (s, { offers = null, cards = [], loot = null, rngState }) => { s.pendingReward = offers ?? cards; s.pendingLoot = loot; if (rngState != null) s.rngState = rngState; },
  chooseReward: (s, { memberId, card }) => { const m = member(s, memberId); if (m && card) m.deck.push({ ...card }); s.pendingReward = null; s.pendingLoot = null; },
  skipReward: (s) => { s.pendingReward = null; s.pendingLoot = null; },

  // ── party / health ──
  healParty: (s, { amount, pct }) => {
    for (const p of s.party) {
      if (p.hp <= 0) continue;
      const heal = pct != null ? Math.round(p.maxHp * pct) : (amount ?? 0);
      p.hp = Math.max(0, Math.min(p.maxHp, p.hp + heal));
    }
  },
  healMember: (s, { memberId, amount = 0 }) => { const m = member(s, memberId); if (m && m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + amount); },

  // Permanently change max HP (events: sacrifice / blessing). `memberId` omitted → all
  // living members. maxHp never drops below 1; current HP is clamped (and follows gains).
  modifyMaxHp: (s, { memberId, amount = 0 }) => {
    const targets = memberId ? [member(s, memberId)] : s.party.filter((p) => p.hp > 0);
    for (const m of targets) {
      if (!m) continue;
      m.maxHp = Math.max(1, m.maxHp + amount);
      if (amount > 0) m.hp += amount;          // a blessing also heals what it adds
      m.hp = Math.max(1, Math.min(m.maxHp, m.hp));
    }
  },

  // ── combat result fold-back ──
  applyCombatResult: (s, { hpById = {}, won }) => {
    for (const p of s.party) if (hpById[p.id] != null) p.hp = Math.max(0, hpById[p.id]);
    if (won === false) s.status = 'lost';
  },

  // ── navigation / lifecycle ──
  /** Move to a reachable node. Non-combat rooms are marked visited on arrival;
   *  combat/elite/boss nodes are marked visited only once WON (markVisited), so
   *  abandoning a fight mid-way and resuming re-enters it instead of skipping it. */
  travel: (s, { nodeId }) => {
    if (!reachableFrom(s.map, s.position).includes(nodeId)) return;
    s.position = nodeId;
    const n = nodeById(s.map, nodeId);
    if (n) { s.floor = n.floor; if (!['combat', 'elite', 'boss'].includes(n.type)) n.visited = true; }
  },
  /** Mark the current (or given) node visited — used to commit a won combat. */
  markVisited: (s, { nodeId } = {}) => { const n = nodeById(s.map, nodeId ?? s.position); if (n) n.visited = true; },
  setPosition: (s, { nodeId }) => { s.position = nodeId; },
  setFloor: (s, { floor }) => { s.floor = floor; },
  setStatus: (s, { status }) => { s.status = status; },
  nextAct: (s) => { s.act += 1; s.floor = 0; },
};
