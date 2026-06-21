// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: editor/CardEditor — the in-engine card editor UI. Edits the  ║
// ║ data-driven CardSpec (src/data/cards/*.json), persists via the dual   ║
// ║ backend (dev-write / GitHub / export). See docs/card-editor.md.      ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useEffect, useMemo, useState } from 'react';
import {
  OP_TYPES, CARD_TYPES, BUFF_STATUSES, DEBUFF_STATUSES, validateCard, defaultScope,
} from '../engine/cards/cardSpec.js';
import { STANCES } from '../engine/combat/stances.js';
import { TARGET_SCOPES } from '../engine/types.js';
import { ATTUNEMENT_BASES, CLASS_BASES, BIOLOGY_BASES } from '../data/synthesis.js';
import {
  detectDevWrite, persist, loadDraft, saveDraft, clearDraft,
  loadGitHubSettings, saveGitHubSettings, downloadJSON,
} from './persistence.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Bundle the on-disk card files as the base content.
const BUNDLE = import.meta.glob('../data/cards/*.json', { eager: true });
const BASE_FILES = Object.fromEntries(
  Object.entries(BUNDLE).map(([path, mod]) => [path.split('/').pop(), (mod.default ?? mod)]),
);

const NEW_OP_DEFAULTS = {
  damage: { op: 'damage', value: 6 },
  block: { op: 'block', value: 5 },
  buff: { op: 'buff', status: 'strength', value: 1 },
  debuff: { op: 'debuff', status: 'vulnerable', value: 2 },
  heal: { op: 'heal', value: 5 },
  draw: { op: 'draw', value: 1 },
  energy: { op: 'energy', value: 1 },
  pay: { op: 'pay', block: 0, hp: 0 },
  stance: { op: 'stance', set: 'Balanced' },
};

function Field({ label, children }) {
  return (
    <label className="fld"><span>{label}</span>{children}</label>
  );
}

function OpRow({ op, onChange, onRemove, onMove }) {
  const set = (patch) => onChange({ ...op, ...patch });
  const num = (v) => (v === '' ? undefined : Number(v));
  return (
    <div className="op">
      <div className="opHead">
        <select value={op.op} onChange={(e) => onChange({ ...NEW_OP_DEFAULTS[e.target.value] })}>
          {OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="opBtns">
          <button onClick={() => onMove(-1)} title="move up">↑</button>
          <button onClick={() => onMove(1)} title="move down">↓</button>
          <button onClick={onRemove} title="remove" className="del">✕</button>
        </div>
      </div>
      <div className="opFields">
        {(op.op === 'damage' || op.op === 'block') && (
          <Field label="value"><input type="number" value={op.value ?? ''} onChange={(e) => set({ value: num(e.target.value) })} /></Field>
        )}
        {(op.op === 'damage' || op.op === 'block') && (
          <Field label="valueFrom">
            <select value={op.valueFrom ?? ''} onChange={(e) => set({ valueFrom: e.target.value || undefined })}>
              <option value="">(static)</option><option value="selfBlock">selfBlock</option>
            </select>
          </Field>
        )}
        {op.op === 'damage' && (
          <Field label="hits"><input value={op.hits ?? ''} placeholder="1 or X" onChange={(e) => set({ hits: e.target.value === '' ? undefined : (e.target.value === 'X' ? 'X' : Number(e.target.value)) })} /></Field>
        )}
        {(op.op === 'damage' || op.op === 'debuff' || op.op === 'heal') && (
          <Field label="scope">
            <select value={op.scope ?? ''} onChange={(e) => set({ scope: e.target.value || undefined })}>
              <option value="">(default: {defaultScope(op)})</option>
              {TARGET_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        )}
        {(op.op === 'buff' || op.op === 'debuff') && (
          <Field label="status">
            <select value={op.status ?? ''} onChange={(e) => set({ status: e.target.value })}>
              {(op.op === 'buff' ? BUFF_STATUSES : DEBUFF_STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        )}
        {(op.op === 'buff' || op.op === 'debuff' || op.op === 'heal' || op.op === 'draw' || op.op === 'energy') && (
          <Field label="value"><input type="number" value={op.value ?? ''} onChange={(e) => set({ value: num(e.target.value) })} /></Field>
        )}
        {op.op === 'buff' && (
          <Field label="temporary"><input type="checkbox" checked={!!op.temporary} onChange={(e) => set({ temporary: e.target.checked || undefined })} /></Field>
        )}
        {op.op === 'block' && (
          <>
            <Field label="brace"><input type="checkbox" checked={!!op.brace} onChange={(e) => set({ brace: e.target.checked || undefined })} /></Field>
            <Field label="+/Dexterity"><input type="number" value={op.bonusPerDexterity ?? ''} onChange={(e) => set({ bonusPerDexterity: num(e.target.value) })} /></Field>
          </>
        )}
        {op.op === 'damage' && (
          <>
            <Field label="bonus ×"><input type="number" value={op.bonusMult ?? ''} onChange={(e) => set({ bonusMult: num(e.target.value) })} /></Field>
            <Field label="bonus +"><input type="number" value={op.bonusAdd ?? ''} onChange={(e) => set({ bonusAdd: num(e.target.value) })} /></Field>
            <Field label="bonusIf HP<%">
              <input type="number" step="0.1" value={op.bonusIf?.targetHpPctBelow ?? ''} onChange={(e) => set({ bonusIf: e.target.value === '' ? undefined : { ...op.bonusIf, targetHpPctBelow: Number(e.target.value) } })} />
            </Field>
            <Field label="bonusIf stance">
              <select value={op.bonusIf?.stance ?? ''} onChange={(e) => set({ bonusIf: e.target.value ? { ...op.bonusIf, stance: e.target.value } : undefined })}>
                <option value="">(none)</option>{STANCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </>
        )}
        {op.op === 'pay' && (
          <>
            <Field label="block"><input type="number" value={op.block ?? ''} onChange={(e) => set({ block: num(e.target.value) })} /></Field>
            <Field label="hp"><input type="number" value={op.hp ?? ''} onChange={(e) => set({ hp: num(e.target.value) })} /></Field>
          </>
        )}
        {op.op === 'stance' && (
          <>
            <Field label="set">
              <select value={op.set ?? ''} onChange={(e) => set({ set: e.target.value || undefined, shift: undefined })}>
                <option value="">(use shift)</option>{STANCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {!op.set && (
              <>
                <Field label="shift dir">
                  <select value={op.shift?.dir ?? 'offense'} onChange={(e) => set({ shift: { dir: e.target.value, steps: op.shift?.steps ?? 1 } })}>
                    <option value="offense">offense</option><option value="defense">defense</option>
                  </select>
                </Field>
                <Field label="steps"><input type="number" value={op.shift?.steps ?? 1} onChange={(e) => set({ shift: { dir: op.shift?.dir ?? 'offense', steps: Number(e.target.value) } })} /></Field>
              </>
            )}
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
      <button className="addOp" onClick={() => onChange([...list, { ...NEW_OP_DEFAULTS.damage }])}>+ add effect</button>
    </div>
  );
}

export function CardEditor() {
  const [files, setFiles] = useState(() => clone(BASE_FILES));
  const [activeFile, setActiveFile] = useState(() => Object.keys(BASE_FILES)[0] || 'warrior.json');
  const [working, setWorking] = useState(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawErr, setRawErr] = useState('');
  const [devAvailable, setDevAvailable] = useState(false);
  const [gh, setGh] = useState(loadGitHubSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => { detectDevWrite().then(setDevAvailable); }, []);

  // Load working copy when the active file changes (prefer an unsaved draft).
  useEffect(() => {
    const base = files[activeFile] || { class: slug(activeFile).replace('_json', ''), version: 1, cards: [] };
    const draft = loadDraft(activeFile);
    setWorking(draft || clone(base));
    setCardIdx(0);
  }, [activeFile, files]);

  // Autosave the working copy to localStorage.
  useEffect(() => { if (working) saveDraft(activeFile, working); }, [working, activeFile]);

  const cards = working?.cards ?? [];
  const card = cards[cardIdx] || null;
  const errors = useMemo(() => (card ? validateCard(card) : []), [card]);

  useEffect(() => { if (card) { setRawText(JSON.stringify(card, null, 2)); setRawErr(''); } }, [cardIdx, raw, card]);

  function updateCard(patch) {
    setWorking((w) => ({ ...w, cards: w.cards.map((c, i) => (i === cardIdx ? { ...c, ...patch } : c)) }));
  }
  function applyRaw() {
    try { const parsed = JSON.parse(rawText); setRawErr(''); setWorking((w) => ({ ...w, cards: w.cards.map((c, i) => (i === cardIdx ? parsed : c)) })); }
    catch (e) { setRawErr(String(e.message || e)); }
  }
  function addCard() {
    const cls = working.class || '';
    const blank = { id: `${slug(cls) || 'card'}_new_${cards.length + 1}`, name: 'New Card', class: cls || undefined, attunement: 'Physical', type: 'attack', cost: 1, rarity: 'common', keywords: [], text: '', effects: [{ ...NEW_OP_DEFAULTS.damage }] };
    setWorking((w) => ({ ...w, cards: [...w.cards, blank] }));
    setCardIdx(cards.length);
  }
  function deleteCard(i) {
    if (!confirm(`Delete "${cards[i]?.name}"?`)) return;
    setWorking((w) => ({ ...w, cards: w.cards.filter((_, j) => j !== i) }));
    setCardIdx((idx) => Math.max(0, Math.min(idx, cards.length - 2)));
  }
  function regenId() { updateCard({ id: `${slug(card.class || working.class || 'card')}_${slug(card.name)}` }); }

  async function doSave() {
    try {
      setStatus('saving…');
      const res = await persist(activeFile, working, { devAvailable, gh });
      setFiles((f) => ({ ...f, [activeFile]: clone(working) }));
      clearDraft(activeFile);
      setStatus(res.via === 'dev' ? `✓ saved to disk (${activeFile})`
        : res.via === 'github' ? `✓ committed to GitHub (${activeFile})`
        : `✓ downloaded ${activeFile} — drop it in src/data/cards/`);
    } catch (e) { setStatus(`✗ ${e.message || e}`); }
  }
  function newFile() {
    const cls = prompt('New class file — class name (e.g. Rogue):');
    if (!cls) return;
    const fn = `${slug(cls)}.json`;
    setFiles((f) => ({ ...f, [fn]: { class: cls, version: 1, cards: [] } }));
    setActiveFile(fn);
  }

  const backend = devAvailable ? 'dev-write (disk)' : gh.token ? 'GitHub commit' : 'download / localStorage';

  if (!working) return <div className="ed"><p style={{ padding: 20 }}>Loading…</p></div>;

  return (
    <div className="ed">
      <header className="edHead">
        <strong>🃏 Chimera Card Editor</strong>
        <select value={activeFile} onChange={(e) => setActiveFile(e.target.value)}>
          {Object.keys(files).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={newFile}>+ file</button>
        <span className={`badge ${devAvailable ? 'ok' : gh.token ? 'gh' : 'warn'}`}>{backend}</span>
        <span className="grow" />
        <button onClick={() => downloadJSON(activeFile, working)}>Export</button>
        <button onClick={() => setShowSettings((s) => !s)}>⚙ GitHub</button>
        <button className="save" onClick={doSave}>Save</button>
      </header>

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

      <div className="body">
        <aside className="list">
          <button className="addCard" onClick={addCard}>+ add card</button>
          {cards.map((c, i) => (
            <div key={c.id || i} className={`li ${i === cardIdx ? 'sel' : ''}`} onClick={() => { setCardIdx(i); setRaw(false); }}>
              <span className={`pip ${c.type}`}>{(c.type || '?')[0].toUpperCase()}</span>
              <span className="liName">{c.name || '(unnamed)'}</span>
              <span className="liCost">{c.cost === -1 ? 'X' : c.cost}</span>
              <button className="del" onClick={(e) => { e.stopPropagation(); deleteCard(i); }}>✕</button>
            </div>
          ))}
          {cards.length === 0 && <p className="empty">No cards yet. Add one.</p>}
        </aside>

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
                    <Field label="rarity"><select value={card.rarity || 'common'} onChange={(e) => updateCard({ rarity: e.target.value })}>{['basic', 'common', 'uncommon', 'rare'].map((r) => <option key={r}>{r}</option>)}</select></Field>
                    <Field label="keywords"><input value={(card.keywords || []).join(', ')} onChange={(e) => updateCard({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
                  </div>
                  <Field label="text"><textarea className="cardtext" value={card.text || ''} onChange={(e) => updateCard({ text: e.target.value })} /></Field>

                  <h3>Effects</h3>
                  <OpList ops={card.effects} onChange={(ops) => updateCard({ effects: ops })} />

                  {card.type === 'power' && (
                    <>
                      <h3>Trigger (power)</h3>
                      <Field label="on">
                        <select value={card.trigger?.on || 'turnStart'} onChange={(e) => updateCard({ trigger: { on: e.target.value, effects: card.trigger?.effects || [] } })}>
                          {['turnStart', 'turnEnd', 'onGainBlock', 'onAttack', 'passive'].map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <OpList ops={card.trigger?.effects} onChange={(ops) => updateCard({ trigger: { on: card.trigger?.on || 'turnStart', effects: ops } })} />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
