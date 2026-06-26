// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: editor/CardEditor — the Card Forge. Cards are authored into     ║
// ║ COLLECTIONS (data/collections) layered over the read-only Default game   ║
// ║ cards; the archetype-file split is hidden (archetype is just a filter +  ║
// ║ a card field). Enabled collections merge into the gameplay pools. The    ║
// ║ effect form is driven by engine/cards/effectRegistry metadata.           ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useEffect, useMemo, useState } from 'react';
import {
  EFFECT_OPS, OP_TYPES, CARD_TYPES, PASSIVES, TRIGGER_EVENTS, DURATIONS, KEYWORDS,
  CONDITION_EVENTS, CONDITION_VERBS, CONDITION_WINDOWS, validateCard, defaultScope,
} from '../engine/cards/cardSpec.js';

// Trigger options shown per effect op (onPlay = immediate; 'passive' is power-only).
const OP_TRIGGERS = ['onPlay', ...TRIGGER_EVENTS.filter((e) => e !== 'onPlay' && e !== 'passive')];
import { describeCard } from '../engine/cards/cardText.js';
import { cardArtScene } from '../data/cardArtPrompt.js';
import MoveCard from '../ui/combat/MoveCard.jsx';
import { APP_VERSION } from '../version.js';
import { STANCES } from '../engine/combat/stances.js';
import { TARGET_SCOPES, RARITIES } from '../engine/types.js';
import { ATTUNEMENT_BASES, CLASS_BASES, BIOLOGY_BASES } from '../data/synthesis.js';
import {
  detectDevWrite, persist, loadGitHubSettings, saveGitHubSettings, downloadJSON,
  listArt, saveArt, resolveArt,
} from './persistence.js';
import {
  ARCHETYPES, ARCHETYPE_FILE, BASE_FILES, baseCard, archetypeOf,
  listCollections, getCollection, createCollection, deleteCollection, renameCollection,
  saveCollection, setEnabled, getEditId, setEditId, putCard, removeCard, restoreCard, resolveView,
} from '../data/collections.js';
import '../ui/combat/combat.css';
import './editor.css';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ── dot-path get/set (ops have shallow nesting: bonusIf.stance, shift.dir) ─────
function getIn(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setIn(obj, path, val) {
  const keys = path.split('.');
  const root = { ...obj };
  let node = root;
  for (let i = 0; i < keys.length - 1; i++) { node[keys[i]] = { ...(node[keys[i]] || {}) }; node = node[keys[i]]; }
  const last = keys[keys.length - 1];
  const empty = val === undefined || val === '' || (typeof val === 'number' && Number.isNaN(val));
  if (empty) delete node[last]; else node[last] = val;
  if (keys.length > 1 && root[keys[0]] && Object.keys(root[keys[0]]).length === 0) delete root[keys[0]];
  return root;
}

function Field({ label, children }) {
  return <label className="fld"><span>{label}</span>{children}</label>;
}

// One control for one registry field descriptor.
function FieldControl({ field, op, onChange }) {
  const v = getIn(op, field.path);
  const set = (val) => onChange(setIn(op, field.path, val));
  switch (field.type) {
    case 'number':
      return <input type="number" value={v ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'bool':
      return <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked || undefined)} />;
    case 'enum':
      return (
        <select value={v ?? ''} onChange={(e) => set(e.target.value || undefined)}>
          {!field.options.includes('') && <option value="">(none)</option>}
          {field.options.map((o) => <option key={o} value={o}>{o === '' ? '(static)' : o}</option>)}
        </select>
      );
    case 'stance':
      return (
        <select value={v ?? ''} onChange={(e) => set(e.target.value || undefined)}>
          <option value="">(none)</option>{STANCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    case 'scope':
      return (
        <select value={v ?? ''} onChange={(e) => set(e.target.value || undefined)}>
          <option value="">(default: {defaultScope(op)})</option>
          {TARGET_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    case 'text':
    default:
      return <input value={v ?? ''} onChange={(e) => set(e.target.value || undefined)} />;
  }
}

function OpRow({ op, onChange, onRemove, onMove }) {
  const def = EFFECT_OPS[op.op];
  return (
    <div className="op">
      <div className="opHead">
        <select value={op.op} onChange={(e) => onChange({ ...EFFECT_OPS[e.target.value].default })}>
          {OP_TYPES.map((t) => <option key={t} value={t}>{t} — {EFFECT_OPS[t].label}</option>)}
        </select>
        <div className="opBtns">
          <button onClick={() => onMove(-1)} title="move up">↑</button>
          <button onClick={() => onMove(1)} title="move down">↓</button>
          <button onClick={onRemove} title="remove" className="del">✕</button>
        </div>
      </div>
      <div className="opFields">
        {(def?.fields ?? []).map((f) => (
          <Field key={f.path} label={f.label}><FieldControl field={f} op={op} onChange={onChange} /></Field>
        ))}
        <Field label="fires">
          <select value={op.trigger || 'onPlay'} onChange={(e) => onChange(setIn(op, 'trigger', e.target.value === 'onPlay' ? undefined : e.target.value))}>
            {OP_TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {op.trigger && op.trigger !== 'onPlay' && (
          <Field label="duration">
            <select value={typeof op.duration === 'string' ? op.duration : (op.duration ? 'turns' : 'thisCombat')}
              onChange={(e) => onChange(setIn(op, 'duration', e.target.value === 'thisCombat' ? undefined : e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        )}
        <Field label="only if">
          <select value={op.condition?.event || ''} onChange={(e) => {
            if (!e.target.value) { const { condition: _drop, ...rest } = op; onChange(rest); }
            else onChange({ ...op, condition: { verb: '>=', threshold: 1, window: 'thisTurn', ...(op.condition || {}), event: e.target.value } });
          }}>
            <option value="">(always)</option>
            {CONDITION_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </Field>
        {op.condition?.event && (
          <>
            <Field label="verb"><select value={op.condition.verb || '>='} onChange={(e) => onChange(setIn(op, 'condition.verb', e.target.value))}>{CONDITION_VERBS.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
            <Field label="count"><input type="number" value={op.condition.threshold ?? ''} onChange={(e) => onChange(setIn(op, 'condition.threshold', e.target.value === '' ? undefined : Number(e.target.value)))} /></Field>
            <Field label="window"><select value={op.condition.window || 'thisTurn'} onChange={(e) => onChange(setIn(op, 'condition.window', e.target.value))}>{CONDITION_WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
          </>
        )}
        <Field label="scale by">
          <select value={op.scaleBy?.event || ''} onChange={(e) => {
            if (!e.target.value) { const { scaleBy: _drop, ...rest } = op; onChange(rest); }
            else onChange({ ...op, scaleBy: { per: 1, window: 'thisTurn', ...(op.scaleBy || {}), event: e.target.value } });
          }}>
            <option value="">(no scaling)</option>
            {CONDITION_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </Field>
        {op.scaleBy?.event && (
          <>
            <Field label="× per"><input type="number" value={op.scaleBy.per ?? ''} onChange={(e) => onChange(setIn(op, 'scaleBy.per', e.target.value === '' ? undefined : Number(e.target.value)))} /></Field>
            <Field label="window"><select value={op.scaleBy.window || 'thisTurn'} onChange={(e) => onChange(setIn(op, 'scaleBy.window', e.target.value))}>{CONDITION_WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
          </>
        )}
      </div>
    </div>
  );
}

function OpList({ ops, onChange }) {
  const list = ops ?? [];
  const upd = (i, op) => onChange(list.map((o, j) => (j === i ? op : o)));
  const rm = (i) => onChange(list.filter((_, j) => j !== i));
  const move = (i, d) => {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const copy = list.slice(); [copy[i], copy[j]] = [copy[j], copy[i]]; onChange(copy);
  };
  return (
    <div className="ops">
      {list.map((op, i) => <OpRow key={i} op={op} onChange={(o) => upd(i, o)} onRemove={() => rm(i)} onMove={(d) => move(i, d)} />)}
      <button className="addOp" onClick={() => onChange([...list, { ...EFFECT_OPS.damage.default }])}>+ add effect</button>
    </div>
  );
}

/**
 * One gallery entry: the real combat card (shared MoveCard, so it looks EXACTLY
 * like an in-hand card) plus editor affordances (delete, validation flag). The
 * delete button is a sibling overlay — never nested inside MoveCard's <button>.
 */
function GalleryTile({ c, bad, origin, onClick, onDelete }) {
  // A card override-art (lib:/key) wins; otherwise MoveCard resolves placeholder/gen art.
  const ov = c.art && resolveArt(c.art);
  const display = ov ? { ...c, art: ov } : c;
  return (
    <div className={`gtile${bad ? ' bad' : ''} o-${origin || 'base'}`}>
      <MoveCard c={display} onClick={onClick} />
      {onDelete && <button className="gDel" title="Delete / hide card" onClick={onDelete}>✕</button>}
      {bad && <span className="gBad" title="This card has validation errors">⚠</span>}
      {origin && origin !== 'base' && <span className={`gOrigin ${origin}`}>{origin === 'new' ? 'NEW' : 'EDITED'}</span>}
    </div>
  );
}

export function CardEditor({ onMenu } = {}) {
  const [cols, setCols] = useState(() => listCollections());
  const [colId, setColId] = useState(() => { const id = getEditId(); return getCollection(id) ? id : null; });
  const [stamp, setStamp] = useState(0);                   // bump to re-read collections
  const [editId, setEditId2] = useState(null);             // card id being edited
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawErr, setRawErr] = useState('');
  const [devAvailable, setDevAvailable] = useState(false);
  const [gh, setGh] = useState(loadGitHubSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState('');
  const [artLib, setArtLib] = useState(() => listArt());
  // Gallery filters.
  const [q, setQ] = useState('');
  const [fArch, setFArch] = useState(() => new Set());
  const [fTypes, setFTypes] = useState(() => new Set());
  const [fRarities, setFRarities] = useState(() => new Set());
  const [fCosts, setFCosts] = useState(() => new Set());
  const [sortAZ, setSortAZ] = useState(false);

  const refresh = () => { setCols(listCollections()); setStamp((s) => s + 1); };
  useEffect(() => { detectDevWrite().then(setDevAvailable); }, []);
  useEffect(() => { setEditId(colId); }, [colId]);   // persist the edit target
  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setEditing(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const col = colId ? getCollection(colId) : null;        // null = Default (read-only)
  const readOnly = !colId;
  const collName = col ? col.name : 'Default Collection';

  // The effective card list for the current collection (base overlaid), tagged.
  const viewAll = useMemo(() => resolveView(colId), [colId, stamp]);
  const rowById = useMemo(() => Object.fromEntries(viewAll.map((r) => [r.card.id, r])), [viewAll]);
  const editRow = editId ? rowById[editId] : null;
  const card = editRow?.card || null;
  const errors = useMemo(() => (card ? validateCard(card) : []), [card]);

  const archetypes = ARCHETYPES;
  const costKey = (c) => (c.cost === -1 ? 'X' : (c.cost ?? 0) >= 3 ? '3+' : String(c.cost ?? 0));
  const view = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let v = viewAll.filter(({ card: c }) => {
      if (ql && !(c.name || '').toLowerCase().includes(ql) && !(c.id || '').toLowerCase().includes(ql)) return false;
      if (fArch.size && !fArch.has(archetypeOf(c))) return false;
      if (fTypes.size && !fTypes.has(c.type)) return false;
      if (fRarities.size && !fRarities.has(c.rarity || 'common')) return false;
      if (fCosts.size && !fCosts.has(costKey(c))) return false;
      return true;
    });
    if (sortAZ) v = [...v].sort((a, b) => (a.card.name || '').localeCompare(b.card.name || ''));
    return v;
  }, [viewAll, q, fArch, fTypes, fRarities, fCosts, sortAZ]);

  const toggleIn = (setFn, val) => setFn((s) => { const n = new Set(s); if (n.has(val)) n.delete(val); else n.add(val); return n; });

  useEffect(() => { if (card) { setRawText(JSON.stringify(card, null, 2)); setRawErr(''); } }, [editId, raw, card]);

  // ── collection management ──
  function ensureCollection() {
    if (colId) return colId;
    const name = prompt('Editing happens inside a collection (the Default game cards are read-only).\n\nName your new collection:', 'My Cards');
    if (!name) { setStatus('Create a collection to edit.'); return null; }
    const c = createCollection(name);
    setCols(listCollections()); setColId(c.id);
    setStatus(`created collection "${c.name}"`);
    return c.id;
  }
  function newCollection() {
    const name = prompt('Name your new collection:', 'My Cards');
    if (!name) return;
    const c = createCollection(name);
    setCols(listCollections()); setColId(c.id); setStatus(`created collection "${c.name}"`);
  }
  function removeCollection(id) {
    const c = getCollection(id);
    if (!c || !confirm(`Delete collection "${c.name}"? Its card changes are lost (the base game is untouched).`)) return;
    deleteCollection(id); if (colId === id) setColId(null); refresh();
  }
  function doRename(id) {
    const c = getCollection(id); if (!c) return;
    const name = prompt('Rename collection:', c.name);
    if (name) { renameCollection(id, name); refresh(); }
  }
  function toggleEnabled(id) {
    const c = getCollection(id); if (!c) return;
    setEnabled(id, !c.enabled); refresh();
  }
  function exportCollection() {
    if (!col) { setStatus('Select a collection to export.'); return; }
    downloadJSON(`${slug(col.name) || 'collection'}.chimera.json`, col);
    setStatus(`exported "${col.name}"`);
  }
  function importCollection(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        const c = createCollection(obj.name || 'Imported');
        const full = { ...getCollection(c.id), cards: obj.cards || {}, deleted: obj.deleted || [] };
        saveCollection(full);
        setCols(listCollections()); setColId(c.id); setStatus(`imported "${full.name}"`);
      } catch (err) { setStatus(`✗ import failed: ${err.message || err}`); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── card editing (writes to the active collection) ──
  function updateCard(patch) {
    if (readOnly || !card) { if (readOnly) setStatus('Pick or create a collection to edit.'); return; }
    const next = { ...card, ...patch };
    if (patch.id && patch.id !== card.id && editRow.origin === 'new') { removeCard(colId, card.id); setEditId2(next.id); }
    putCard(colId, next); refresh();
  }
  function applyRaw() {
    if (readOnly || !card) return;
    try {
      const parsed = JSON.parse(rawText); setRawErr('');
      if (parsed.id !== card.id && editRow.origin === 'new') { removeCard(colId, card.id); setEditId2(parsed.id); }
      putCard(colId, parsed); refresh();
    } catch (e) { setRawErr(String(e.message || e)); }
  }
  function addCard() {
    const cid = ensureCollection(); if (!cid) return;
    const arch = [...fArch][0] || archetypes[0];
    const base = `${slug(arch) || 'card'}_new`;
    let id = base, n = 1; const existing = new Set(resolveView(cid).map((r) => r.card.id));
    while (existing.has(id)) id = `${base}_${++n}`;
    const blank = { id, name: 'New Card', class: arch, attunement: 'Physical', type: 'attack', cost: 1, rarity: 'common', keywords: [], effects: [{ ...EFFECT_OPS.damage.default }] };
    putCard(cid, blank); refresh();
    setEditId2(id); setRaw(false); setEditing(true);
  }
  function deleteCard(cardId) {
    if (readOnly) { setStatus('Editing requires a collection — base cards can only be hidden from within one.'); return; }
    const c = rowById[cardId]?.card;
    if (!confirm(`${baseCard(cardId) ? 'Hide' : 'Delete'} "${c?.name}" in "${collName}"? (The base game is untouched.)`)) return;
    removeCard(colId, cardId); refresh();
    if (editId === cardId) { setEditing(false); }
  }
  function openCardForEdit(cardId) { setEditId2(cardId); setRaw(false); setEditing(true); }
  function regenId() { if (card && editRow.origin === 'new') updateCard({ id: `${slug(card.class || 'card')}_${slug(card.name)}` }); }
  function restoreToDefault() {
    if (readOnly || !card) return;
    restoreCard(colId, card.id); refresh(); setEditing(false);
    setStatus(`restored "${card.name}" to default`);
  }

  // ── advanced: publish the active collection into the base game files (dev/GitHub) ──
  async function publishToBase() {
    if (!col) { setStatus('Select a collection to publish.'); return; }
    if (!confirm(`Publish "${col.name}" INTO the base game files? This bakes its changes into the bundled cards.`)) return;
    try {
      setStatus('publishing…');
      // Group the collection's effective cards by archetype, rebuild each touched file.
      const touched = new Set();
      for (const c of Object.values(col.cards)) touched.add(archetypeOf(c));
      for (const id of col.deleted) { const b = baseCard(id); if (b) touched.add(archetypeOf(b)); }
      for (const arch of touched) {
        const file = ARCHETYPE_FILE[arch]; if (!file) continue;
        const baseObj = BASE_FILES[file] || { class: arch, version: 1, cards: [] };
        const deleted = new Set(col.deleted);
        const cards = (baseObj.cards || []).filter((c) => !deleted.has(c.id)).map((c) => col.cards[c.id] || c);
        for (const c of Object.values(col.cards)) if (archetypeOf(c) === arch && !cards.some((x) => x.id === c.id)) cards.push(c);
        const res = await persist(file, { ...baseObj, cards }, { devAvailable, gh });
        setStatus(res.via === 'dev' ? `✓ published to disk (${file})` : res.via === 'github' ? `✓ committed (${file})` : `✓ downloaded ${file}`);
      }
    } catch (e) { setStatus(`✗ ${e.message || e}`); }
  }

  function handleArtUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (saveArt(file.name, reader.result)) { setArtLib(listArt()); updateCard({ art: `lib:${file.name}` }); setStatus(`art "${file.name}" added`); }
      else setStatus('✗ art too large for browser storage');
    };
    reader.readAsDataURL(file);
  }

  const backend = devAvailable ? 'dev-write (disk)' : gh.token ? 'GitHub commit' : 'download / localStorage';
  const enabledCount = cols.filter((c) => c.enabled).length;

  return (
    <div className="ed">
      <header className="edHead">
        {onMenu && <button onClick={onMenu} title="Back to menu">≡ Menu</button>}
        <strong>🃏 Chimera Card Forge</strong>
        <span className="edVer">{APP_VERSION}</span>
        <span className={`badge ${devAvailable ? 'ok' : gh.token ? 'gh' : 'warn'}`}>{backend}</span>
        <span className="grow" />
        <button onClick={exportCollection} disabled={!col} title="Export this collection as a shareable pack">Export</button>
        <label className="impBtn" title="Import a collection pack">Import<input type="file" accept=".json,application/json" onChange={importCollection} hidden /></label>
        <button onClick={() => setShowSettings((s) => !s)}>⚙ Advanced</button>
      </header>

      {/* Collections bar — Default (read-only) + your packs + new */}
      <div className="colBar">
        <span className="t2label">Collection:</span>
        <button className={`colChip${!colId ? ' on' : ''}`} onClick={() => setColId(null)} title="The base game cards — read-only">
          Default Collection <span className="colRO">read-only</span>
        </button>
        {cols.map((c) => (
          <span key={c.id} className={`colChip wrap${colId === c.id ? ' on' : ''}`}>
            <button className="colName" onClick={() => setColId(c.id)} onDoubleClick={() => doRename(c.id)} title="Click to edit · double-click to rename">{c.name}</button>
            <label className="colEnable" title={c.enabled ? 'Enabled in-game' : 'Disabled'}><input type="checkbox" checked={!!c.enabled} onChange={() => toggleEnabled(c.id)} /></label>
            {colId === c.id && <button className="colDel" title="Delete collection" onClick={() => removeCollection(c.id)}>✕</button>}
          </span>
        ))}
        <button className="colNew" onClick={newCollection} title="New collection">+ new</button>
      </div>

      <div className="colHint">
        {readOnly
          ? <>Viewing the <b>Default</b> game cards (read-only). To change or add cards, pick or create a collection.</>
          : <>Editing <b>{collName}</b>{col?.enabled ? '' : ' (disabled in-game)'} — changes overlay the base game; the base is never touched. {enabledCount} collection{enabledCount === 1 ? '' : 's'} enabled in-game.</>}
      </div>

      {showSettings && (
        <div className="settings">
          <p>Advanced: bake the active collection into the base game files (for the developer), or set a GitHub PAT to commit. Players don’t need this — collections already apply in-game.</p>
          <div className="row">
            <Field label="owner"><input value={gh.owner} onChange={(e) => setGh({ ...gh, owner: e.target.value })} /></Field>
            <Field label="repo"><input value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value })} /></Field>
            <Field label="branch"><input value={gh.branch} onChange={(e) => setGh({ ...gh, branch: e.target.value })} /></Field>
            <Field label="token"><input type="password" value={gh.token} onChange={(e) => setGh({ ...gh, token: e.target.value })} /></Field>
          </div>
          <div className="row">
            <button onClick={() => { saveGitHubSettings(gh); setStatus('GitHub settings saved'); }}>Save settings</button>
            <button onClick={publishToBase} disabled={!col}>⬆ Publish collection to base game</button>
          </div>
        </div>
      )}

      {status && <div className="statusbar">{status}</div>}

      <div className="galleryWrap">
        <aside className="filters">
          <div className="fSearch">
            <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="fClear" onClick={() => setQ('')} title="Clear">✕</button>}
          </div>
          <button className="addCard fAdd" onClick={addCard}>+ add card</button>

          <div className="fGroup">
            <div className="fLabel">Archetype</div>
            {archetypes.map((a) => (
              <label key={a} className="fCheck"><input type="checkbox" checked={fArch.has(a)} onChange={() => toggleIn(setFArch, a)} /> {a}</label>
            ))}
          </div>

          <div className="fGroup">
            <div className="fLabel">Card Type</div>
            <div className="fRow">
              {CARD_TYPES.map((t) => (
                <button key={t} className={`fChip ${fTypes.has(t) ? 'on' : ''}`} onClick={() => toggleIn(setFTypes, t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className="fGroup">
            <div className="fLabel">Rarity</div>
            {RARITIES.map((r) => (
              <label key={r} className="fCheck"><input type="checkbox" checked={fRarities.has(r)} onChange={() => toggleIn(setFRarities, r)} /> {r}</label>
            ))}
          </div>

          <div className="fGroup">
            <div className="fLabel">Cost</div>
            <div className="fRow">
              {['0', '1', '2', '3+', 'X'].map((c) => (
                <button key={c} className={`fCost ${fCosts.has(c) ? 'on' : ''}`} onClick={() => toggleIn(setFCosts, c)}>{c}</button>
              ))}
            </div>
          </div>

          <button className={`fSort ${sortAZ ? 'on' : ''}`} onClick={() => setSortAZ((s) => !s)}>A–Z sort {sortAZ ? '✓' : ''}</button>
          <div className="fCount">{view.length} / {viewAll.length} cards</div>
        </aside>

        <div className="gallery">
          {view.map(({ card: c, origin }) => (
            <GalleryTile key={c.id} c={c} origin={origin} bad={validateCard(c).length > 0}
              onClick={() => openCardForEdit(c.id)} onDelete={readOnly ? undefined : () => deleteCard(c.id)} />
          ))}
          {view.length === 0 && <p className="empty">No cards match these filters.</p>}
        </div>
      </div>

      {editing && card && (
        <div className="editModal" onClick={() => setEditing(false)}>
          <div className="editPanel" onClick={(e) => e.stopPropagation()}>
            <button className="editClose" title="Close (Esc)" onClick={() => setEditing(false)}>✕</button>
            <main className="form">
              <div className="formTop">
                <h2>{card.name}</h2>
                {!readOnly && <label className="rawToggle"><input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} /> raw JSON</label>}
              </div>
              {readOnly && (
                <div className="errs roBanner">This is a base game card (read-only). <button onClick={() => { const id = ensureCollection(); if (id) setStatus(`now editing in "${getCollection(id).name}"`); }}>Edit it in a collection →</button></div>
              )}
              {errors.length > 0 && <div className="errs">{errors.map((e, i) => <div key={i}>⚠ {e}</div>)}</div>}

              {raw && !readOnly ? (
                <div className="rawEd">
                  <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} spellCheck={false} />
                  {rawErr && <div className="errs"><div>⚠ {rawErr}</div></div>}
                  <button onClick={applyRaw}>Apply JSON</button>
                </div>
              ) : (
                <fieldset className="formFields" disabled={readOnly} style={readOnly ? { opacity: 0.85 } : undefined}>
                  <div className="grid">
                    <Field label="name"><input value={card.name || ''} onChange={(e) => updateCard({ name: e.target.value })} /></Field>
                    <Field label="id"><div className="idrow"><input value={card.id || ''} disabled={editRow.origin !== 'new'} onChange={(e) => updateCard({ id: e.target.value })} />{editRow.origin === 'new' && <button onClick={regenId} title="regenerate from name">⟳</button>}</div></Field>
                    <Field label="type"><select value={card.type} onChange={(e) => updateCard({ type: e.target.value })}>{CARD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                    <Field label="cost"><input type="number" value={card.cost ?? 0} onChange={(e) => updateCard({ cost: Number(e.target.value) })} /><small>-1 = X</small></Field>
                    <Field label="attunement"><select value={card.attunement} onChange={(e) => updateCard({ attunement: e.target.value })}>{ATTUNEMENT_BASES.map((a) => <option key={a}>{a}</option>)}</select></Field>
                    <Field label="archetype (class)"><select value={card.class || ''} onChange={(e) => updateCard({ class: e.target.value || undefined })}><option value="">(none)</option>{CLASS_BASES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                    <Field label="biology"><select value={card.biology || ''} onChange={(e) => updateCard({ biology: e.target.value || undefined })}><option value="">(none)</option>{BIOLOGY_BASES.map((b) => <option key={b}>{b}</option>)}</select></Field>
                    <Field label="rarity"><select value={card.rarity || 'common'} onChange={(e) => updateCard({ rarity: e.target.value })}>{RARITIES.map((r) => <option key={r}>{r}</option>)}</select></Field>
                    <Field label="replay count"><input type="number" value={card.replayCount ?? ''} onChange={(e) => updateCard({ replayCount: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                    <Field label="art (key/URL)"><input value={card.art || ''} onChange={(e) => updateCard({ art: e.target.value || undefined })} /></Field>
                    <Field label="imbue (attune status stacks)"><input type="number" min="0" value={card.imbue ?? ''} placeholder="0 = off" onChange={(e) => updateCard({ imbue: e.target.value === '' || Number(e.target.value) === 0 ? undefined : Number(e.target.value) })} /></Field>
                  </div>
                  <Field label="keywords">
                    <div className="kwrow">
                      {KEYWORDS.map((kw) => (
                        <label key={kw} className="kw">
                          <input type="checkbox" checked={(card.keywords || []).includes(kw)} onChange={(e) => {
                            const set = new Set(card.keywords || []);
                            if (e.target.checked) set.add(kw); else set.delete(kw);
                            updateCard({ keywords: [...set] });
                          }} /> {kw}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="auto text (shown in-game)"><div className="autoText">{describeCard(card) || '(define effects to generate text)'}</div></Field>
                  <Field label="text override (optional)"><textarea className="cardtext" value={card.text || ''} placeholder="(leave blank — the auto text above is used)" onChange={(e) => updateCard({ text: e.target.value || undefined })} /></Field>
                  <Field label="art prompt (fed to the image generator)">
                    <textarea className="cardtext" value={card.artPrompt || ''}
                      placeholder={cardArtScene({ ...card, artPrompt: undefined })}
                      onChange={(e) => updateCard({ artPrompt: e.target.value || undefined })} />
                    <small>Describe the scene for AI art. Blank = the auto-derived prompt shown faded above.</small>
                  </Field>

                  <div className="artRow">
                    <Field label="art library">
                      <select value={(card.art || '').startsWith('lib:') ? card.art.slice(4) : ''} onChange={(e) => updateCard({ art: e.target.value ? `lib:${e.target.value}` : undefined })}>
                        <option value="">(none / use the art field above)</option>
                        {artLib.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label="upload art"><input type="file" accept="image/*" onChange={handleArtUpload} /></Field>
                    {resolveArt(card.art) && <img className="artPreview" src={resolveArt(card.art)} alt="card art" />}
                  </div>

                  <h3>Effects</h3>
                  <OpList ops={card.effects} onChange={(ops) => updateCard({ effects: ops })} />

                  <h3>Upgrade (+) <small style={{ color: '#8a7a5e', fontWeight: 400 }}>— applied at campfires / on upgraded copies</small></h3>
                  <div className="grid">
                    <Field label="upgrade cost (optional)">
                      <input type="number" value={card.upgrade?.cost ?? ''} placeholder="(unchanged)"
                        onChange={(e) => updateCard({ upgrade: { ...(card.upgrade || {}), cost: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                    </Field>
                    {card.upgrade && <button style={{ alignSelf: 'end' }} onClick={() => updateCard({ upgrade: undefined })}>clear upgrade</button>}
                  </div>
                  <OpList ops={card.upgrade?.effects} onChange={(ops) => updateCard({ upgrade: { ...(card.upgrade || {}), effects: ops } })} />

                  {card.type === 'power' && (
                    <>
                      <h3>Power: passive &amp; trigger</h3>
                      <div className="grid">
                        <Field label="passive (rule-modifier)">
                          <select value={card.passive || ''} onChange={(e) => updateCard({ passive: e.target.value || undefined })}>
                            <option value="">(none)</option>
                            {Object.keys(PASSIVES).map((p) => <option key={p} value={p}>{p} — {PASSIVES[p].label}</option>)}
                          </select>
                        </Field>
                        <Field label="trigger on">
                          <select value={card.trigger?.on || ''} onChange={(e) => updateCard({ trigger: e.target.value ? { on: e.target.value, effects: card.trigger?.effects || [] } : undefined })}>
                            <option value="">(no trigger)</option>
                            {TRIGGER_EVENTS.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        </Field>
                      </div>
                      {card.trigger?.on && (
                        <>
                          <h4>Trigger effects (fire on {card.trigger.on})</h4>
                          <OpList ops={card.trigger?.effects} onChange={(ops) => updateCard({ trigger: { on: card.trigger?.on || 'turnStart', effects: ops } })} />
                        </>
                      )}
                    </>
                  )}

                  {!readOnly && (editRow.origin === 'override' || baseCard(card.id)) && (
                    <button className="restoreBtn" onClick={restoreToDefault}>⟲ Restore this card to default (drop my changes)</button>
                  )}
                </fieldset>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
