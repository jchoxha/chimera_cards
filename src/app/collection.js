// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/collection — the player's creature COLLECTION: which        ║
// ║ creatures (and which SIZES of each) have been DISCOVERED (visible in    ║
// ║ the Codex) and CAPTURED (pickable in team assembly). Persisted to       ║
// ║ localStorage. Capturing implies discovering. A fresh app has an EMPTY   ║
// ║ collection → the shell shows the starter pick; a legacy save (a team    ║
// ║ but no collection) is seeded with the whole roster at native sizes so   ║
// ║ existing players lose nothing. The Admin panel edits this directly.     ║
// ║ UPDATE WHEN: discovery events are added to gameplay (encounters,        ║
// ║ evolutions, captures) — route them through addDiscovered/addCaptured.   ║
// ╚══════════════════════════════════════════════════════════════════╝

const KEY = 'chimera.collection';

/** @typedef {{ discovered: Record<string,string[]>, captured: Record<string,string[]> }} Collection */

export const emptyCollection = () => ({ discovered: {}, captured: {} });

export function hasStoredCollection() {
  try { return localStorage.getItem(KEY) != null; } catch { return false; }
}

/** @returns {Collection|null} null when nothing stored (fresh app). */
export function loadCollection() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return { discovered: v.discovered || {}, captured: v.captured || {} };
  } catch { /* corrupted → treat as fresh */ }
  return null;
}

export function saveCollection(col) {
  try { localStorage.setItem(KEY, JSON.stringify(col)); } catch { /* ignore */ }
}

const withForm = (map, id, form) => {
  const cur = map[id] || [];
  return cur.includes(form) ? map : { ...map, [id]: [...cur, form] };
};
const withoutForm = (map, id, form) => {
  const cur = map[id] || [];
  if (!cur.includes(form)) return map;
  const next = cur.filter((f) => f !== form);
  const out = { ...map };
  if (next.length) out[id] = next; else delete out[id];
  return out;
};

export const discoveredForms = (col, id) => col?.discovered?.[id] || [];
export const capturedForms = (col, id) => col?.captured?.[id] || [];
export const isDiscovered = (col, id) => discoveredForms(col, id).length > 0;
export const isCaptured = (col, id) => capturedForms(col, id).length > 0;

/** Mark (id, form) discovered. Pure — returns a new collection. */
export function addDiscovered(col, id, form) {
  return { ...col, discovered: withForm(col.discovered, id, form) };
}
/** Mark (id, form) captured (capture implies discovery). Pure. */
export function addCaptured(col, id, form) {
  return { discovered: withForm(col.discovered, id, form), captured: withForm(col.captured, id, form) };
}
export function removeDiscovered(col, id, form) {
  // un-discovering also un-captures (can't hold what you haven't seen)
  return { discovered: withoutForm(col.discovered, id, form), captured: withoutForm(col.captured, id, form) };
}
export function removeCaptured(col, id, form) {
  return { ...col, captured: withoutForm(col.captured, id, form) };
}

/** Seed for a LEGACY save (a saved team but no collection yet): the whole roster
 *  captured at its native size — preserves exactly what those players could do. */
export function seedFullCollection(rosterEntries) {
  let col = emptyCollection();
  for (const r of rosterEntries) col = addCaptured(col, r.id, r.size || 'regular');
  return col;
}

/** The starter trio offered on a fresh app (roster ids). */
export const STARTER_IDS = ['emberwisp', 'voltfang', 'thornroot'];
