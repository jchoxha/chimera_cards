// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: store/runStore — Zustand orchestrator for the RUN/meta layer. ║
// ║ Owns a RunManager (action-queue + undo) and drives combat through the  ║
// ║ combatStore for fights, folding results back. Handles map navigation,  ║
// ║ rooms, rewards, save/load, and win/lose. UI reads `snap` + `view`.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { create } from 'zustand';
import { RunManager } from '../engine/run/RunManager.js';
import { createRun } from '../engine/run/state.js';
import { currentNode, reachableFrom } from '../engine/run/map.js';
import { enemyForNode } from '../engine/run/encounters.js';
import { combatOutcome } from '../engine/run/combatBridge.js';
import { makeRng } from '../engine/run/rng.js';
import { useCombat } from './combatStore.js';

const SAVE_KEY = 'chimera:run:save';

function rewardCards(vm) {
  try { return vm.generateReward(3); } catch { return []; }
}

export const useRun = create((set, get) => ({
  /** @type {RunManager|null} */ rm: null,
  snap: null,
  version: 0,
  view: 'map', // 'map' | 'combat' | 'reward' | 'room' | 'over'

  _publish() { const { rm } = get(); set((s) => ({ snap: { ...rm.state }, version: s.version + 1 })); get()._save(); },
  _save() { try { const { rm } = get(); if (rm) localStorage.setItem(SAVE_KEY, rm.serialize()); } catch { /* quota */ } },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } },
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ } },

  startRun({ party, seed }) {
    const rm = new RunManager(createRun({ party, seed, floors: 10 }));
    set({ rm, snap: { ...rm.state }, version: 1, view: 'map' });
    get()._save();
  },
  loadSaved() {
    try {
      const j = localStorage.getItem(SAVE_KEY);
      if (!j) return false;
      const rm = RunManager.deserialize(j);
      set({ rm, snap: { ...rm.state }, version: 1, view: rm.state.status === 'active' ? 'map' : 'over' });
      return true;
    } catch { return false; }
  },

  dispatch(type, props = {}) { get().rm.dispatch(type, props); get()._publish(); },
  undo() { get().rm.undo(); get()._publish(); },
  canUndo() { return !!get().rm?.canUndo(); },

  /** Click a reachable node on the map. */
  goTo(nodeId) {
    const { rm } = get();
    if (!reachableFrom(rm.state.map, rm.state.position).includes(nodeId)) return;
    rm.dispatch('travel', { nodeId });
    const node = currentNode(rm.state);
    get()._publish();
    if (!node) return;
    if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') get()._beginCombat(node);
    else set({ view: 'room' });
  },

  _beginCombat(node) {
    const { rm } = get();
    const rng = makeRng((rm.state.rngState ^ (rm.state.floor * 0x9e3779b1)) >>> 0);
    const enemies = enemyForNode(node, rng);
    useCombat.getState().startRunFight({ party: rm.state.party, enemyFighters: enemies, relics: rm.state.relics });
    set({ view: 'combat' });
  },

  /** Called when the embedded combat reports victory/defeat. */
  resolveCombat() {
    const { rm } = get();
    const vm = useCombat.getState().vm;
    if (!vm) return;
    const out = combatOutcome(vm);
    rm.dispatch('applyCombatResult', out);
    const node = currentNode(rm.state);
    if (!out.won) { rm.dispatch('setStatus', { status: 'lost' }); get()._publish(); set({ view: 'over' }); return; }
    rm.dispatch('gainGold', { amount: node.type === 'boss' ? 100 : node.type === 'elite' ? 40 : 25 });
    if (node.type === 'boss') { rm.dispatch('setStatus', { status: 'won' }); get().clearSave(); get()._publish(); set({ view: 'over' }); return; }
    rm.dispatch('offerReward', { cards: rewardCards(vm) });
    get()._publish();
    set({ view: 'reward' });
  },

  chooseReward(card) {
    const { rm } = get();
    rm.dispatch('chooseReward', { memberId: rm.state.party[0]?.id, card });
    get()._publish(); set({ view: 'map' });
  },
  skipReward() { get().rm.dispatch('skipReward'); get()._publish(); set({ view: 'map' }); },

  /** Finish a non-combat room → back to the map. */
  finishRoom() { set({ view: 'map' }); get()._publish(); },
}));
