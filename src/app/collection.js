// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/collection — the player's creature COLLECTION.              ║
// ║ Two layers, persisted to localStorage:                                  ║
// ║  • discovered: Record<species, sizes[]> — which (species, size) has been ║
// ║    SEEN (Codex face-up). A set; you don't nickname a sighting.           ║
// ║  • owned: OwnedInstance[] — the creatures you actually HOLD. Each is a   ║
// ║    distinct instance ({iid, species, form, nickname}); you can own many  ║
// ║    of the same species+size, each with its own nickname. Team assembly   ║
// ║    lists these; the team references instance ids (iid).                  ║
// ║ Capturing implies discovering. Fresh app → empty → starter pick. A       ║
// ║ legacy save (team, no collection) is seeded with the roster at native    ║
// ║ sizes. Old set-shaped saves ({captured:{id:[forms]}}) migrate on load.   ║
// ║ UPDATE WHEN: gameplay discovery/capture events land — route them through  ║
// ║ addDiscovered / addOwned (addCaptured).                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

const KEY = 'chimera.collection';

/** @typedef {{ iid:string, species:string, form:string, nickname:string }} OwnedInstance */
/** @typedef {{ discovered: Record<string,string[]>, owned: OwnedInstance[], seq:number }} Collection */

export const emptyCollection = () => ({ discovered: {}, owned: [], seq: 0 });

export function hasStoredCollection() {
  try { return localStorage.getItem(KEY) != null; } catch { return false; }
}

/** Normalise any stored/legacy shape into the current instance model. */
function normalize(v) {
  if (!v || typeof v !== 'object') return null;
  const discovered = v.discovered || {};
  if (Array.isArray(v.owned)) {
    // already the new shape — just re-seat seq above the max used
    let seq = Number(v.seq) || 0;
    for (const o of v.owned) { const n = Number(String(o.iid || '').split('~').pop()); if (Number.isFinite(n) && n >= seq) seq = n + 1; }
    return { discovered, owned: v.owned.map((o) => ({ iid: o.iid, species: o.species, form: o.form || 'regular', nickname: o.nickname || '' })), seq };
  }
  // migrate old set shape: captured:{species:[forms]} → one owned instance each
  const owned = []; let seq = 0;
  const captured = v.captured || {};
  for (const species of Object.keys(captured)) {
    for (const form of captured[species] || []) owned.push({ iid: `${species}~${seq++}`, species, form, nickname: '' });
  }
  return { discovered, owned, seq };
}

/** @returns {Collection|null} null when nothing stored (fresh app). */
export function loadCollection() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch { return null; }
}

export function saveCollection(col) {
  try { localStorage.setItem(KEY, JSON.stringify(col)); } catch { /* ignore */ }
}

// ── discovered (set of species×size) ──────────────────────────────────────
const withForm = (map, id, form) => {
  const cur = map[id] || [];
  return cur.includes(form) ? map : { ...map, [id]: [...cur, form] };
};
const withoutForm = (map, id, form) => {
  const cur = map[id] || [];
  if (!cur.includes(form)) return map;
  const next = cur.filter((f) => f !== form);
  const out = { ...map }; if (next.length) out[id] = next; else delete out[id];
  return out;
};
export const discoveredForms = (col, id) => col?.discovered?.[id] || [];
export const isDiscovered = (col, id) => discoveredForms(col, id).length > 0;
export function addDiscovered(col, id, form) {
  return { ...col, discovered: withForm(col.discovered, id, form) };
}
export function removeDiscovered(col, id, form) {
  // un-discovering a size also releases every owned instance of it
  return { ...col, discovered: withoutForm(col.discovered, id, form),
    owned: (col.owned || []).filter((o) => !(o.species === id && o.form === form)) };
}

// ── owned instances ───────────────────────────────────────────────────────
export const ownedInstances = (col) => col?.owned || [];
export const ownedOf = (col, iid) => (col?.owned || []).find((o) => o.iid === iid) || null;
export const ownedForSpecies = (col, id) => (col?.owned || []).filter((o) => o.species === id);
export const ownedCountOf = (col, id, form) => (col?.owned || []).filter((o) => o.species === id && o.form === form).length;
/** Distinct sizes owned of a species (compat with the old per-(id,size) surface). */
export const capturedForms = (col, id) => [...new Set(ownedForSpecies(col, id).map((o) => o.form))];
export const isCaptured = (col, id) => ownedForSpecies(col, id).length > 0;

/** Add ONE owned instance (auto-discovers its size). Pure. */
export function addOwned(col, species, form, nickname = '') {
  const seq = col.seq || 0;
  const inst = { iid: `${species}~${seq}`, species, form, nickname };
  return { discovered: withForm(col.discovered, species, form), owned: [...(col.owned || []), inst], seq: seq + 1 };
}
export function removeOwned(col, iid) {
  return { ...col, owned: (col.owned || []).filter((o) => o.iid !== iid) };
}
export function renameOwned(col, iid, nickname) {
  return { ...col, owned: (col.owned || []).map((o) => (o.iid === iid ? { ...o, nickname } : o)) };
}

/** "Capture" = ensure at least one owned instance of (species, form) + discover.
 *  Idempotent at the size level (won't pile up duplicates); use addOwned for
 *  intentional duplicates. Kept for the starter pick + seed + editor bulk. */
export function addCaptured(col, species, form) {
  if (ownedCountOf(col, species, form) > 0) return addDiscovered(col, species, form);
  return addOwned(col, species, form);
}
/** Release EVERY owned instance of (species, form) (keeps the sighting). */
export function removeCaptured(col, species, form) {
  return { ...col, owned: (col.owned || []).filter((o) => !(o.species === species && o.form === form)) };
}

/** Seed for a LEGACY save (team but no collection): one owned instance per roster
 *  creature at its native size — preserves exactly what those players could field. */
export function seedFullCollection(rosterEntries) {
  let col = emptyCollection();
  for (const r of rosterEntries) col = addCaptured(col, r.id, r.size || 'regular');
  return col;
}

/** The starter trio offered on a fresh app (roster ids). */
export const STARTER_IDS = ['emberwisp', 'voltfang', 'thornroot'];
