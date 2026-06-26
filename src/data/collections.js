// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/collections — card "collections" (mod packs) layered over   ║
// ║ an immutable base. The bundled archetype JSONs form the read-only        ║
// ║ DEFAULT collection; players author named collections that OVERRIDE base  ║
// ║ cards, ADD new ones, or HIDE base cards. Enabled collections merge into  ║
// ║ the gameplay card pools. The archetype-file split is an internal storage ║
// ║ detail — the UI works on a unified card list (filter by archetype).      ║
// ║ UPDATE WHEN: the collection shape or resolution rules change.            ║
// ╚══════════════════════════════════════════════════════════════════╝

// Bundled base cards (the Default collection). Each card already carries `class`
// (its archetype); we don't need the filename split beyond listing archetypes.
const BUNDLE = import.meta.glob('./cards/*.json', { eager: true });
const BASE_ENTRIES = Object.entries(BUNDLE).map(([p, m]) => [p.split('/').pop(), (m.default ?? m)]);
export const BASE_FILES = Object.fromEntries(BASE_ENTRIES);
export const ARCHETYPES = BASE_ENTRIES.map(([, f]) => f.class).filter(Boolean);
/** archetype → its bundled filename (for the advanced "publish to base" path). */
export const ARCHETYPE_FILE = Object.fromEntries(BASE_ENTRIES.map(([file, f]) => [f.class, file]));

const clone = (o) => JSON.parse(JSON.stringify(o));
export const BASE_CARDS = BASE_ENTRIES.flatMap(([, f]) => (f.cards || []).map(clone));
const BASE_BY_ID = Object.fromEntries(BASE_CARDS.map((c) => [c.id, c]));
export const baseCard = (id) => BASE_BY_ID[id] || null;
export const archetypeOf = (c) => (Array.isArray(c?.class) ? c.class[0] : c?.class) || 'Other';

// ── storage ───────────────────────────────────────────────────────────────────
const LS = 'chimera:collections';
const LS_EDIT = 'chimera:collections:edit';
function read() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } }
function write(map) { try { localStorage.setItem(LS, JSON.stringify(map)); } catch { /* quota */ } }
let _seq = 0;
function newId() { return `col_${Date.now().toString(36)}_${(_seq++).toString(36)}`; }

/** @returns {{id,name,cards:Object,deleted:string[],enabled:boolean,created:number}[]} created-order */
export function listCollections() { return Object.values(read()).sort((a, b) => (a.created || 0) - (b.created || 0)); }
export function getCollection(id) { return read()[id] || null; }
export function createCollection(name) {
  const m = read(); const id = newId();
  const col = { id, name: (name && name.trim()) || 'New Collection', cards: {}, deleted: [], enabled: true, created: Date.now() };
  m[id] = col; write(m); return col;
}
export function saveCollection(col) { const m = read(); m[col.id] = col; write(m); }
export function deleteCollection(id) { const m = read(); delete m[id]; write(m); if (getEditId() === id) setEditId(null); }
export function renameCollection(id, name) { const m = read(); if (m[id]) { m[id].name = name; write(m); } }
export function setEnabled(id, on) { const m = read(); if (m[id]) { m[id].enabled = !!on; write(m); } }

export function getEditId() { try { return localStorage.getItem(LS_EDIT) || null; } catch { return null; } }
export function setEditId(id) { try { id ? localStorage.setItem(LS_EDIT, id) : localStorage.removeItem(LS_EDIT); } catch { /* noop */ } }

// ── editing a collection (override / add / delete / restore) ───────────────────
/** Write a full card def into a collection (override of a base card, or a new card). */
export function putCard(colId, card) {
  const m = read(); const col = m[colId]; if (!col) return;
  col.cards[card.id] = clone(card);
  col.deleted = (col.deleted || []).filter((id) => id !== card.id);
  write(m);
}
/** Remove a card: hide a base card (→ deleted) or drop a collection-only new card. */
export function removeCard(colId, cardId) {
  const m = read(); const col = m[colId]; if (!col) return;
  delete col.cards[cardId];
  if (BASE_BY_ID[cardId]) col.deleted = [...new Set([...(col.deleted || []), cardId])];
  write(m);
}
/** Restore a card to its base/default state within a collection (drop override/deletion). */
export function restoreCard(colId, cardId) {
  const m = read(); const col = m[colId]; if (!col) return;
  delete col.cards[cardId];
  col.deleted = (col.deleted || []).filter((id) => id !== cardId);
  write(m);
}

// ── resolution ─────────────────────────────────────────────────────────────────
/**
 * The cards a collection shows in the editor = base, with this collection's
 * overrides/new cards/deletions applied. Returns tagged rows.
 * @returns {{card:Object, origin:'base'|'override'|'new', baseId:?string}[]}
 */
export function resolveView(colId) {
  const col = colId ? getCollection(colId) : null;
  const deleted = new Set(col?.deleted || []);
  const overrides = col?.cards || {};
  const out = [];
  for (const c of BASE_CARDS) {
    if (deleted.has(c.id)) continue;
    out.push({ card: overrides[c.id] || c, origin: overrides[c.id] ? 'override' : 'base', baseId: c.id });
  }
  for (const [id, c] of Object.entries(overrides)) {
    if (!BASE_BY_ID[id]) out.push({ card: c, origin: 'new', baseId: null });
  }
  return out;
}

/** Effective gameplay cards = base overlaid by ALL enabled collections (in order). */
export function resolveCards() {
  const byId = Object.fromEntries(BASE_CARDS.map((c) => [c.id, c]));
  for (const col of listCollections()) {
    if (!col.enabled) continue;
    for (const id of (col.deleted || [])) delete byId[id];
    for (const [id, c] of Object.entries(col.cards || {})) byId[id] = c;
  }
  return Object.values(byId);
}

/** Gameplay pools grouped by archetype (drop-in for the old per-file POOLS). */
export function resolvePools() {
  const pools = {};
  for (const c of resolveCards()) { const a = archetypeOf(c); (pools[a] ||= []).push(c); }
  // ensure every base archetype exists even if a collection emptied it
  for (const a of ARCHETYPES) pools[a] ||= [];
  return pools;
}

// A small version stamp so consumers can refresh when collections change.
export function collectionsStamp() {
  const cols = listCollections();
  return cols.map((c) => `${c.id}:${c.enabled ? 1 : 0}:${Object.keys(c.cards).length}:${(c.deleted || []).length}`).join('|');
}
