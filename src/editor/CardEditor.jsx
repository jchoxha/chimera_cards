// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: editor/CardEditor — the in-engine card editor UI. The effect  ║
// ║ form is driven by engine/cards/effectRegistry metadata, so any new op  ║
// ║ appears automatically. Persists via the dual backend. See              ║
// ║ docs/card-editor.md.                                                  ║
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
  detectDevWrite, persist, loadDraft, saveDraft, clearDraft,
  loadGitHubSettings, saveGitHubSettings, downloadJSON,
  listPresets, savePreset, loadPreset, deletePreset,
  listArt, saveArt, resolveArt,
} from './persistence.js';
import '../ui/combat/combat.css';
import './editor.css';

const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Bundle the on-disk card files as the base content.
const BUNDLE = import.meta.glob('../data/cards/*.json', { eager: true });
const BASE_FILES = Object.fromEntries(
  Object.entries(BUNDLE).map(([path, mod]) => [path.split('/').pop(), (mod.default ?? mod)]),
);

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
function GalleryTile({ c, bad, onClick, onDelete }) {
  // A card override-art (lib:/key) wins; otherwise MoveCard resolves placeholder/gen art.
  const ov = c.art && resolveArt(c.art);
  const display = ov ? { ...c, art: ov } : c;
  return (
    <div className={`gtile${bad ? ' bad' : ''}`}>
      <MoveCard c={display} onClick={onClick} />
      <button className="gDel" title="Delete card" onClick={onDelete}>✕</button>
      {bad && <span className="gBad" title="This card has validation errors">⚠</span>}
    </div>
  );
}

export function CardEditor({ onMenu } = {}) {
  const [files, setFiles] = useState(() => clone(BASE_FILES));
  const allFiles = Object.keys(files);
  // Multi-archetype: a SET of toggled files + a `focus` file for add/presets/revert.
  const [active, setActive] = useState(() => new Set([allFiles[0]].filter(Boolean)));
  const [focusFile, setFocusFile] = useState(() => allFiles[0] || 'warrior.json');
  const [workings, setWorkings] = useState({});           // file -> working draft
  const [edit, setEdit] = useState(null);                  // {file, idx} being edited
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawErr, setRawErr] = useState('');
  const [devAvailable, setDevAvailable] = useState(false);
  const [gh, setGh] = useState(loadGitHubSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState('');
  const [presets, setPresets] = useState(() => listPresets(focusFile));
  const [presetSel, setPresetSel] = useState('');
  const [artLib, setArtLib] = useState(() => listArt());
  // Gallery filters.
  const [q, setQ] = useState('');
  const [fTypes, setFTypes] = useState(() => new Set());
  const [fRarities, setFRarities] = useState(() => new Set());
  const [fCosts, setFCosts] = useState(() => new Set());
  const [sortAZ, setSortAZ] = useState(false);

  // Display name for a file = its archetype name (the file's `class`), never the filename.
  const nameOf = (file) => {
    const cls = workings[file]?.class ?? files[file]?.class;
    if (cls) return Array.isArray(cls) ? cls.join('/') : cls;
    return slug(file).replace(/_json$/, '').replace(/^\w/, (ch) => ch.toUpperCase());
  };

  useEffect(() => { detectDevWrite().then(setDevAvailable); }, []);
  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setEditing(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);
  useEffect(() => { setPresets(listPresets(focusFile)); setPresetSel(''); }, [focusFile]);

  // Load a working draft for every active file (and the focus file).
  useEffect(() => {
    setWorkings((prev) => {
      const next = { ...prev };
      for (const f of [...active, focusFile]) {
        if (!f || next[f]) continue;
        const base = files[f] || { class: slug(f).replace('_json', ''), version: 1, cards: [] };
        next[f] = loadDraft(f) || clone(base);
      }
      return next;
    });
  }, [active, focusFile, files]);

  // Keep focus on an active file.
  useEffect(() => {
    if (!active.has(focusFile)) { const first = [...active][0]; if (first) setFocusFile(first); }
  }, [active, focusFile]);

  // Persist drafts as they change.
  useEffect(() => { for (const [f, w] of Object.entries(workings)) if (w) saveDraft(f, w); }, [workings]);

  const setWorkingFile = (file, updater) => setWorkings((ws) => ({ ...ws, [file]: updater(ws[file]) }));

  const focusWorking = workings[focusFile];
  const editCard = edit && workings[edit.file]?.cards?.[edit.idx] || null;
  const card = editCard;   // alias used throughout the edit form
  const errors = useMemo(() => (editCard ? validateCard(editCard) : []), [editCard]);

  // Gallery aggregates cards from ALL active files, each tagged with its source file.
  const costKey = (c) => (c.cost === -1 ? 'X' : (c.cost ?? 0) >= 3 ? '3+' : String(c.cost ?? 0));
  const totalActive = useMemo(() => {
    let n = 0; for (const f of active) n += workings[f]?.cards?.length || 0; return n;
  }, [active, workings]);
  const view = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out = [];
    for (const f of allFiles) {
      if (!active.has(f)) continue;
      const w = workings[f]; if (!w) continue;
      w.cards.forEach((c, i) => {
        if (ql && !(c.name || '').toLowerCase().includes(ql) && !(c.id || '').toLowerCase().includes(ql)) return;
        if (fTypes.size && !fTypes.has(c.type)) return;
        if (fRarities.size && !fRarities.has(c.rarity || 'common')) return;
        if (fCosts.size && !fCosts.has(costKey(c))) return;
        out.push({ file: f, c, i });
      });
    }
    if (sortAZ) out.sort((a, b) => (a.c.name || '').localeCompare(b.c.name || ''));
    return out;
  }, [active, allFiles, workings, q, fTypes, fRarities, fCosts, sortAZ]);

  const toggleIn = (setFn, val) => setFn((s) => { const n = new Set(s); if (n.has(val)) n.delete(val); else n.add(val); return n; });
  const toggleArchetype = (file) => setActive((s) => {
    const n = new Set(s);
    if (n.has(file)) n.delete(file); else n.add(file);   // single click toggles; zero is allowed
    return n;
  });
  const openCardForEdit = (file, i) => { setEdit({ file, idx: i }); setFocusFile(file); setRaw(false); setEditing(true); };

  useEffect(() => { if (editCard) { setRawText(JSON.stringify(editCard, null, 2)); setRawErr(''); } }, [edit, raw, editCard]);

  function updateCard(patch) {
    if (!edit) return;
    setWorkingFile(edit.file, (w) => ({ ...w, cards: w.cards.map((c, i) => (i === edit.idx ? { ...c, ...patch } : c)) }));
  }
  function applyRaw() {
    if (!edit) return;
    try { const parsed = JSON.parse(rawText); setRawErr(''); setWorkingFile(edit.file, (w) => ({ ...w, cards: w.cards.map((c, i) => (i === edit.idx ? parsed : c)) })); }
    catch (e) { setRawErr(String(e.message || e)); }
  }
  function addCard() {
    const file = focusFile;
    const w = workings[file]; if (!w) return;
    const cls = w.class || '';
    const blank = { id: `${slug(cls) || 'card'}_new_${w.cards.length + 1}`, name: 'New Card', class: cls || undefined, attunement: 'Physical', type: 'attack', cost: 1, rarity: 'common', keywords: [], text: '', effects: [{ ...EFFECT_OPS.damage.default }] };
    const idx = w.cards.length;
    setWorkingFile(file, (w2) => ({ ...w2, cards: [...w2.cards, blank] }));
    setEdit({ file, idx });
    setRaw(false);
    setEditing(true);
  }
  function deleteCard(file, i) {
    const w = workings[file]; if (!w) return;
    if (!confirm(`Delete "${w.cards[i]?.name}"?`)) return;
    setWorkingFile(file, (w2) => ({ ...w2, cards: w2.cards.filter((_, j) => j !== i) }));
    if (edit && edit.file === file && edit.idx === i) { setEditing(false); setEdit(null); }
  }
  function regenId() { if (editCard) updateCard({ id: `${slug(editCard.class || workings[edit.file]?.class || 'card')}_${slug(editCard.name)}` }); }

  async function doSave() {
    try {
      setStatus(`saving ${active.size} archetype${active.size > 1 ? 's' : ''}…`);
      const saved = [];
      let via = 'download';
      for (const f of active) {
        const w = workings[f]; if (!w) continue;
        const res = await persist(f, w, { devAvailable, gh });
        setFiles((fs) => ({ ...fs, [f]: clone(w) }));
        clearDraft(f);
        saved.push(nameOf(f));
        via = res.via;
      }
      const where = via === 'dev' ? 'to disk' : via === 'github' ? 'to GitHub' : '— downloaded, drop into src/data/cards/';
      setStatus(`✓ saved ${saved.join(', ')} ${where}`);
    } catch (e) { setStatus(`✗ ${e.message || e}`); }
  }
  function newFile() {
    const cls = prompt('New archetype — name (e.g. Rogue):');
    if (!cls) return;
    const fn = `${slug(cls)}.json`;
    setFiles((f) => ({ ...f, [fn]: { class: cls, version: 1, cards: [] } }));
    setActive((s) => new Set([...s, fn]));
    setFocusFile(fn);
  }

  // ── Presets + revert-to-vanilla (operate on the focus archetype) ──
  function doSavePreset() {
    const name = prompt('Preset name:', presetSel || 'My preset');
    if (!name || !focusWorking) return;
    savePreset(focusFile, name, focusWorking);
    setPresets(listPresets(focusFile)); setPresetSel(name);
    setStatus(`✓ saved preset "${name}" for ${nameOf(focusFile)}`);
  }
  function doLoadPreset() {
    if (!presetSel) return;
    const obj = loadPreset(focusFile, presetSel);
    if (obj) { setWorkingFile(focusFile, () => clone(obj)); setStatus(`loaded preset "${presetSel}"`); }
  }
  function doDeletePreset() {
    if (!presetSel || !confirm(`Delete preset "${presetSel}"?`)) return;
    deletePreset(focusFile, presetSel); setPresets(listPresets(focusFile)); setPresetSel('');
    setStatus('preset deleted');
  }
  function revertFile() {
    if (!confirm(`Revert ALL ${nameOf(focusFile)} cards to the bundled (vanilla) version? Discards unsaved edits.`)) return;
    const base = BASE_FILES[focusFile];
    if (!base) { setStatus('no bundled version for this archetype'); return; }
    setWorkingFile(focusFile, () => clone(base)); clearDraft(focusFile);
    setStatus(`reverted ${nameOf(focusFile)} to vanilla`);
  }
  function revertCard() {
    if (!editCard) return;
    const base = (BASE_FILES[edit.file]?.cards || []).find((c) => c.id === editCard.id);
    if (!base) { setStatus('no bundled version for this card'); return; }
    setWorkingFile(edit.file, (w) => ({ ...w, cards: w.cards.map((c, i) => (i === edit.idx ? clone(base) : c)) }));
    setStatus(`reverted "${base.name}" to vanilla`);
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

  if (!focusWorking) return <div className="ed"><p style={{ padding: 20 }}>Loading…</p></div>;

  return (
    <div className="ed">
      <header className="edHead">
        {onMenu && <button onClick={onMenu} title="Back to menu">≡ Menu</button>}
        <strong>🃏 Chimera Card Editor</strong>
        <span className="edVer">{APP_VERSION}</span>
        <span className={`badge ${devAvailable ? 'ok' : gh.token ? 'gh' : 'warn'}`}>{backend}</span>
        <span className="grow" />
        <button onClick={() => downloadJSON(focusFile, focusWorking)} title={`Export ${nameOf(focusFile)}`}>Export</button>
        <button onClick={() => setShowSettings((s) => !s)}>⚙ GitHub</button>
        <button className="save" onClick={doSave} title="Save all toggled archetypes">Save</button>
      </header>

      <div className="archBar">
        <span className="t2label">Archetypes:</span>
        {allFiles.map((f) => (
          <button key={f}
            className={`archChip${active.has(f) ? ' on' : ''}${f === focusFile ? ' focus' : ''}`}
            title={active.has(f) ? 'Showing — click to hide' : 'Hidden — click to show'}
            onClick={() => { const willShow = !active.has(f); toggleArchetype(f); if (willShow) setFocusFile(f); }}>
            {nameOf(f)}
          </button>
        ))}
        <button className="archNew" onClick={newFile} title="New archetype">+ new</button>
      </div>

      <div className="toolbar2">
        <span className="t2label">Presets:</span>
        <select value={presetSel} onChange={(e) => setPresetSel(e.target.value)}>
          <option value="">(select)</option>
          {presets.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={doLoadPreset} disabled={!presetSel}>Load</button>
        <button onClick={doSavePreset}>Save preset</button>
        <button onClick={doDeletePreset} disabled={!presetSel}>Delete</button>
        <span className="grow" />
        <button onClick={revertCard}>⟲ Revert card</button>
        <button onClick={revertFile}>⟲ Revert file → vanilla</button>
      </div>

      {showSettings && (
        <div className="settings">
          <p>For saving from a phone / deployed editor: a GitHub <b>fine-grained PAT</b> with <code>Contents: read/write</code> on this repo. Stored only in this browser; never committed. The repo is public — don't paste a token with broad scopes.</p>
          <div className="row">
            <Field label="owner"><input value={gh.owner} onChange={(e) => setGh({ ...gh, owner: e.target.value })} /></Field>
            <Field label="repo"><input value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value })} /></Field>
            <Field label="branch"><input value={gh.branch} onChange={(e) => setGh({ ...gh, branch: e.target.value })} /></Field>
            <Field label="token"><input type="password" value={gh.token} onChange={(e) => setGh({ ...gh, token: e.target.value })} /></Field>
          </div>
          <button onClick={() => { saveGitHubSettings(gh); setStatus('GitHub settings saved'); }}>Save settings</button>
        </div>
      )}

      {status && <div className="statusbar">{status}</div>}

      <div className="galleryWrap">
        <aside className="filters">
          <div className="fSearch">
            <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="fClear" onClick={() => setQ('')} title="Clear">✕</button>}
          </div>
          {active.size > 1 && (
            <label className="fFocus"><span>New cards →</span>
              <select value={focusFile} onChange={(e) => setFocusFile(e.target.value)}>
                {allFiles.filter((f) => active.has(f)).map((f) => <option key={f} value={f}>{nameOf(f)}</option>)}
              </select>
            </label>
          )}
          <button className="addCard fAdd" onClick={addCard}>+ add card to {nameOf(focusFile)}</button>

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
          <div className="fCount">{view.length} / {totalActive} cards · {active.size} archetype{active.size > 1 ? 's' : ''}</div>
        </aside>

        <div className="gallery">
          {view.map(({ file, c, i }) => (
            <GalleryTile key={`${file}:${c.id || i}`} c={c} bad={validateCard(c).length > 0}
              onClick={() => openCardForEdit(file, i)} onDelete={() => deleteCard(file, i)} />
          ))}
          {view.length === 0 && <p className="empty">{totalActive ? 'No cards match these filters.' : 'No cards yet — add one.'}</p>}
        </div>
      </div>

      {editing && card && (
        <div className="editModal" onClick={() => setEditing(false)}>
          <div className="editPanel" onClick={(e) => e.stopPropagation()}>
            <button className="editClose" title="Close (Esc)" onClick={() => setEditing(false)}>✕</button>
            <main className="form">
              {!card ? <p className="empty">Select or add a card.</p> : (
            <>
              <div className="formTop">
                <h2>{card.name}</h2>
                <label className="rawToggle"><input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} /> raw JSON</label>
              </div>
              {errors.length > 0 && <div className="errs">{errors.map((e, i) => <div key={i}>⚠ {e}</div>)}</div>}

              {raw ? (
                <div className="rawEd">
                  <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} spellCheck={false} />
                  {rawErr && <div className="errs"><div>⚠ {rawErr}</div></div>}
                  <button onClick={applyRaw}>Apply JSON</button>
                </div>
              ) : (
                <>
                  <div className="grid">
                    <Field label="name"><input value={card.name || ''} onChange={(e) => updateCard({ name: e.target.value })} /></Field>
                    <Field label="id"><div className="idrow"><input value={card.id || ''} onChange={(e) => updateCard({ id: e.target.value })} /><button onClick={regenId} title="regenerate from name">⟳</button></div></Field>
                    <Field label="type"><select value={card.type} onChange={(e) => updateCard({ type: e.target.value })}>{CARD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                    <Field label="cost"><input type="number" value={card.cost ?? 0} onChange={(e) => updateCard({ cost: Number(e.target.value) })} /><small>-1 = X</small></Field>
                    <Field label="attunement"><select value={card.attunement} onChange={(e) => updateCard({ attunement: e.target.value })}>{ATTUNEMENT_BASES.map((a) => <option key={a}>{a}</option>)}</select></Field>
                    <Field label="class"><select value={card.class || ''} onChange={(e) => updateCard({ class: e.target.value || undefined })}><option value="">(none)</option>{CLASS_BASES.map((c) => <option key={c}>{c}</option>)}</select></Field>
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
                    <small>Describe the scene for AI art. Blank = the auto-derived prompt shown faded above. Generate with <code>python scripts/gen_cards.py</code>.</small>
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
                </>
              )}
            </>
          )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
