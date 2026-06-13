// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/save — persistence adapter (artifact storage or
// ║ localStorage). UPDATE WHEN: any new persistent state is added to
// ║ app/main — add it to serializeSave AND hydrateSave or it silently
// ║ won't survive a refresh.
// ╚══════════════════════════════════════════════════════════════════╝
const SAVE_KEY = "chimera_save_v1";
async function storeSet(val) {
  const json = JSON.stringify(val);
  try {
    if (typeof window !== "undefined" && window.storage) { await window.storage.set(SAVE_KEY, json); return true; }
  } catch (e) {}
  try { localStorage.setItem(SAVE_KEY, json); return true; } catch (e) {}
  return false;
}
async function storeGet() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(SAVE_KEY);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) {}
  try { const j = localStorage.getItem(SAVE_KEY); if (j) return JSON.parse(j); } catch (e) {}
  return null;
}
async function storeClear() {
  try { if (typeof window !== "undefined" && window.storage) await window.storage.delete(SAVE_KEY); } catch (e) {}
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/sfx — procedural sound via tone.js. UPDATE WHEN:
// ║ new game moments deserve audio (call SFX.<x>() at the trigger).
// ║ Audio starts on first user gesture; SFX.muted toggles globally.
// ╚══════════════════════════════════════════════════════════════════╝

export { SAVE_KEY, storeSet, storeGet, storeClear };
