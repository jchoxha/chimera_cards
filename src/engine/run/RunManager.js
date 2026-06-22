// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/run/RunManager — Slay-the-Web-style action manager for ║
// ║ the run layer: an action-descriptor queue applied on immutable state  ║
// ║ snapshots, with past/future undo/redo. Combat runs as a sub-process   ║
// ║ whose result is folded back via the `applyCombatResult` action.       ║
// ║ UPDATE WHEN: the dispatch/undo contract or action application changes.║
// ╚══════════════════════════════════════════════════════════════════╝

import { ACTIONS } from './actions.js';

const cloneState = (s) => (typeof structuredClone === 'function' ? structuredClone(s) : JSON.parse(JSON.stringify(s)));

export class RunManager {
  /** @param {Object} state initial run state (from createRunState). */
  constructor(state) {
    this.state = state;
    this.past = [];
    this.future = [];
    this.queue = [];
  }

  /** Queue an action descriptor `{ type, ...props }`. */
  enqueue(action) { this.queue.push(action); return this; }

  /** Apply the next queued action; returns the new state (or current if empty). */
  dequeue() {
    const action = this.queue.shift();
    if (!action) return this.state;
    return this._apply(action);
  }

  /** Convenience: enqueue + apply one action immediately. */
  dispatch(type, props = {}) { return this.enqueue({ type, ...props }).dequeue(); }

  _apply(action) {
    const fn = ACTIONS[action.type];
    if (!fn) throw new Error(`Unknown run action: ${JSON.stringify(action.type)}`);
    this.past.push(this.state);            // snapshot (current state is immutable to callers)
    const next = cloneState(this.state);
    const ret = fn(next, action);
    this.state = ret || next;
    this.future = [];                      // a new action invalidates the redo stack
    return this.state;
  }

  undo() { if (!this.past.length) return this.state; this.future.push(this.state); this.state = this.past.pop(); return this.state; }
  redo() { if (!this.future.length) return this.state; this.past.push(this.state); this.state = this.future.pop(); return this.state; }
  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }

  /** Serialize / restore the full run (save/load). History is not persisted. */
  serialize() { return JSON.stringify(this.state); }
  static deserialize(json) { return new RunManager(JSON.parse(json)); }
}
