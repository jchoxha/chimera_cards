import * as Tone from "tone";
const SFX = {
  muted: false,
  _ready: false,
  async _ensure() {
    if (this._ready || this.muted) return this._ready;
    try {
      await Tone.start();
      this._synth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 } }).toDestination();
      this._synth.volume.value = -10;
      this._noise = new Tone.NoiseSynth({ envelope: { attack: 0.002, decay: 0.09, sustain: 0 } }).toDestination();
      this._noise.volume.value = -16;
      this._ready = true;
    } catch {}
    return this._ready;
  },
  async _notes(seq, gap = 0.09) {
    if (this.muted || !(await this._ensure())) return;
    const now = Tone.now();
    seq.forEach(([n, d], i) => this._synth.triggerAttackRelease(n, d || 0.09, now + i * gap));
  },
  async hit(big) { if (this.muted || !(await this._ensure())) return; this._noise.triggerAttackRelease(big ? 0.16 : 0.08); if (big) this._synth.triggerAttackRelease("C2", 0.12); },
  card() { this._notes([["G5", 0.04]], 0); },
  block() { this._notes([["C3", 0.08]], 0); },
  heal() { this._notes([["E5"], ["G5"]], 0.07); },
  step() { if (this.muted || !this._ready) return; this._noise.triggerAttackRelease(0.03); },
  victory() { this._notes([["C5"], ["E5"], ["G5"], ["C6", 0.22]]); },
  defeat() { this._notes([["E4"], ["C4"], ["A3", 0.3]], 0.16); },
  capture() { this._notes([["G4"], ["C5"], ["E5"], ["G5", 0.25]], 0.11); },
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/claude — API access, art + JSON generation
// ║ UPDATE WHEN: API contract changes; new AI features (forge/fuse/evolve prompts live with their systems)
// ╚══════════════════════════════════════════════════════════════════╝

export { SFX };
