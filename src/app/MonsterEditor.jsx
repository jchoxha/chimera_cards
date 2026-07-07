// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/MonsterEditor — the Editor's CREATURES page (admin tool).    ║
// ║ ONE unified list of EVERY creature in the game (built-in roster + your    ║
// ║ custom monsters). Per creature you set its COLLECTION state — which SIZES ║
// ║ are discovered (Codex) / captured (team-assembly) — by cycling each size  ║
// ║ cell; custom creatures are always yours and add Edit/Delete + a New       ║
// ║ button that opens the full builder (typings, size, optional hand-built    ║
// ║ deck). Persisted as `chimera.custom` defs + the `chimera.collection`.     ║
// ║ Presentational: App owns the pools, save/delete, and collection handlers. ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import DeckBuilder from '../ui/deck/DeckBuilder.jsx';
import { deckToCounts } from '../engine/deck/budget.js';
import { FORM_ORDER, FORMS, formLabel } from '../data/forms.js';
import { anatomyForFamily } from '../engine/cards/beastPool.js';
import { weaponsForArchetype } from '../engine/cards/humanoidPool.js';
import { ABERRATION_FAMILIES, anatomyForAberrationFamily } from '../engine/cards/aberrationPool.js';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../data/axisIcons.js';
import { sizedPortrait } from '../data/sizeArt.js';
import {
  emptyCollection, seedFullCollection, addDiscovered, addCaptured,
  removeDiscovered, discoveredForms, capturedForms,
} from './collection.js';
import './creator.css';
import './admin.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

/** Collection cell cycle: none → discovered → captured → none. */
function cycleCell(col, id, form) {
  const disc = discoveredForms(col, id).includes(form);
  const capt = capturedForms(col, id).includes(form);
  if (!disc) return addDiscovered(col, id, form);
  if (!capt) return addCaptured(col, id, form);
  return removeDiscovered(col, id, form);   // also un-captures
}

function emptyDef(classes, biologies) {
  return { id: null, name: '', lore: '', description: '', class: [classes[0] || 'Warrior'],
    biology: [biologies[0] || 'Humanoid'], attunement: ['Physical'], size: 'regular',
    family: null, anatomy: [], weapons: [], subtypes: [], customDeck: null };
}

export default function MonsterEditor({ defs = [], classes = [], biologies = [], attunements = [], subtypeOptions = [], legalFor, buildPool, families = [], onSave, onDelete, onMenu, tabs,
  rosterCreatures = [], collection, onCollectionChange, onCollectionReset }) {
  const [editing, setEditing] = useState(null); // a def being edited, or null = list
  const [building, setBuilding] = useState(false);

  if (editing) {
    const isBeast = (editing.biology || []).includes('Beast');
    const isAberration = (editing.biology || []).includes('Aberration');
    const isHumanoid = (editing.biology || []).includes('Humanoid');
    // Archetype is HUMANOID-ONLY (docs/biology-kits.md): non-humanoids are
    // instinct-driven and carry no class; their attunements aren't class-gated.
    const klass = isHumanoid ? (editing.class?.[0] || classes[0] || 'Warrior') : null;
    const atts = (editing.attunement || []).filter(Boolean);
    const legal = isHumanoid && legalFor ? legalFor(klass) : attunements;
    const familyOpts = isBeast ? families : (isAberration ? ABERRATION_FAMILIES : []);
    const family = editing.family || familyOpts[0] || null;
    const allowedAnatomy = isBeast ? anatomyForFamily(family) : (isAberration ? anatomyForAberrationFamily(family) : []);
    const allowedWeapons = isHumanoid ? weaponsForArchetype(klass) : [];
    const preview = { class: klass ? [klass] : null, biology: [editing.biology[0]], attunement: atts.length ? atts : ['Physical'] };
    const color = creatureColor(preview);
    const set = (patch) => setEditing((e) => ({ ...e, ...patch }));
    const toggleIn = (key, tag) => set({
      [key]: (editing[key] || []).includes(tag) ? editing[key].filter((t) => t !== tag) : [...(editing[key] || []), tag],
      customDeck: null,
    });

    if (building) {
      return (
        <DeckBuilder
          pool={buildPool(editing)}
          title={`Build ${editing.name || klass || editing.biology[0]}'s deck`}
          subtitle={`${klass ? `${klass} · ` : ''}${editing.biology[0]} · ${atts.join(' / ') || 'Physical'}`}
          initial={editing.customDeck ? deckToCounts(editing.customDeck) : {}}
          onConfirm={(deck) => { set({ customDeck: deck }); setBuilding(false); }}
          onCancel={() => setBuilding(false)}
        />
      );
    }

    return (
      <div className="creator meEditor">
        <header className="crHead">
          <h1>{editing.id ? 'Edit Monster' : 'New Monster'}</h1>
          <button className="selBtn ghost" onClick={() => setEditing(null)}>Back to list</button>
        </header>
        <div className="crBody">
          <div className="crPreview" style={{ '--gl': color }}>
            <div className="crPortrait"><Icon icon={creatureIcon(preview)} style={{ color }} /></div>
            <div className="crPvName">{editing.name || 'Unnamed'}</div>
            <div className="crPvAxes">
              {klass && <span><Icon icon={ARCHETYPE_ICON[klass] || 'game-icons:gladius'} /> {klass}</span>}
              <span><Icon icon={BIOLOGY_ICON[editing.biology[0]] || 'game-icons:dna2'} /> {editing.biology[0]}</span>
              <span style={{ color: ATTUNEMENT_COLOR[atts[0]] }}><Icon icon={ATTUNEMENT_ICON[atts[0]] || 'game-icons:embrace-energy'} /> {atts.join(' / ') || 'Physical'}</span>
              <span>{formLabel(editing.size) || 'Regular'}</span>
            </div>
          </div>

          <div className="crForm">
            <label className="crFld"><span>Name</span>
              <input value={editing.name} placeholder="e.g. Cinderfang" onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="crFld"><span>Lore <em>(optional)</em></span>
              <textarea value={editing.lore} rows={3} placeholder="Backstory, personality, origin…" onChange={(e) => set({ lore: e.target.value })} />
            </label>
            <label className="crFld"><span>Physical description <em>(optional)</em></span>
              <textarea value={editing.description} rows={3} placeholder="What it looks like — used for move &amp; art generation." onChange={(e) => set({ description: e.target.value })} />
            </label>

            <div className="crAxes">
              {isHumanoid && (
                <label className="crFld"><span>Archetype <em>(Humanoids only)</em></span>
                  <select value={klass} onChange={(e) => set({ class: [e.target.value], weapons: [], customDeck: null })}>
                    {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
              <label className="crFld"><span>Body Type</span>
                <select value={editing.biology[0]} onChange={(e) => set({ biology: [e.target.value, editing.biology[1]].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i), family: null, anatomy: [], weapons: [], customDeck: null })}>
                  {biologies.map((bb) => <option key={bb} value={bb}>{bb}</option>)}
                </select>
              </label>
              <label className="crFld"><span>+ 2nd body type <em>(hybrid)</em></span>
                <select value={editing.biology[1] || ''} onChange={(e) => set({ biology: [editing.biology[0], e.target.value].filter(Boolean), customDeck: null })}>
                  <option value="">(none)</option>
                  {biologies.filter((bb) => bb !== editing.biology[0]).map((bb) => <option key={bb} value={bb}>{bb}</option>)}
                </select>
              </label>
              <label className="crFld"><span>Attunement</span>
                <select value={atts[0] || 'Physical'} onChange={(e) => set({ attunement: [e.target.value, atts[1]].filter(Boolean), customDeck: null })}>
                  {legal.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="crFld"><span>+ 2nd attunement</span>
                <select value={atts[1] || ''} onChange={(e) => set({ attunement: [atts[0] || 'Physical', e.target.value].filter(Boolean), customDeck: null })}>
                  <option value="">(none)</option>
                  {attunements.filter((a) => a !== atts[0]).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="crFld"><span>Size</span>
                <select value={editing.size || 'regular'} onChange={(e) => set({ size: e.target.value })}>
                  {FORM_ORDER.map((f) => <option key={f} value={f}>{FORMS[f].label}</option>)}
                </select>
              </label>
            </div>

            {(isBeast || isAberration) && (
              <div className="crAxes">
                <div className="crDeckHead">{isBeast ? 'Beast Kit' : 'Aberration Kit'}</div>
                <label className="crFld"><span>Family</span>
                  <select value={family || ''} onChange={(e) => set({ family: e.target.value, anatomy: [], customDeck: null })}>
                    {familyOpts.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <div className="crFld"><span>{isBeast ? 'Anatomy' : 'Aberrant features'} <em>(pick the parts that build its deck)</em></span>
                  <div className="beastAnatomy">
                    {allowedAnatomy.map((tag) => (
                      <label key={tag} className={`anatTag${(editing.anatomy || []).includes(tag) ? ' on' : ''}`}>
                        <input type="checkbox" checked={(editing.anatomy || []).includes(tag)} onChange={() => toggleIn('anatomy', tag)} />
                        {tag}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isHumanoid && (
              <div className="crAxes">
                <div className="crDeckHead">Weapons</div>
                <div className="crFld"><span>Weapons <em>(pick the arms that add to its deck — gated by archetype)</em></span>
                  <div className="beastAnatomy">
                    {allowedWeapons.map((tag) => (
                      <label key={tag} className={`anatTag${(editing.weapons || []).includes(tag) ? ' on' : ''}`}>
                        <input type="checkbox" checked={(editing.weapons || []).includes(tag)} onChange={() => toggleIn('weapons', tag)} />
                        {tag}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {subtypeOptions.length > 0 && (
              <div className="crAxes">
                <div className="crDeckHead">Descriptive Subtypes</div>
                <div className="crFld"><span>Subtypes <em>(composition/affliction overlays — any combination; e.g. Giant + Mechanical)</em></span>
                  <div className="beastAnatomy">
                    {subtypeOptions.map((tag) => (
                      <label key={tag} className={`anatTag${(editing.subtypes || []).includes(tag) ? ' on' : ''}`}>
                        <input type="checkbox" checked={(editing.subtypes || []).includes(tag)} onChange={() => toggleIn('subtypes', tag)} />
                        {tag}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="crAxes">
              <div className="crDeckHead">Deck</div>
              <div className="crDeckBuild">
                <button className="selBtn" onClick={() => setBuilding(true)}>
                  {editing.customDeck ? `Edit custom deck (${editing.customDeck.length} cards)` : 'Build a custom deck →'}
                </button>
                {editing.customDeck
                  ? <button className="selBtn ghost" onClick={() => set({ customDeck: null })}>Use auto deck</button>
                  : <span className="crHint">No custom deck — generated from typings.</span>}
              </div>
            </div>

            <button className="selBtn go crCreate" disabled={!editing.name.trim()}
              onClick={() => {
                const out = { ...editing, name: editing.name.trim() };
                out.class = klass ? [klass] : null;   // archetype is Humanoid-only
                if (isBeast || isAberration) { out.family = family; out.anatomy = (editing.anatomy || []).filter((t) => allowedAnatomy.includes(t)); }
                else { out.family = null; out.anatomy = []; }
                out.weapons = isHumanoid ? (editing.weapons || []).filter((t) => allowedWeapons.includes(t)) : [];
                onSave(out); setEditing(null);
              }}>
              {editing.id ? 'Save Changes ✓' : 'Create Monster ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Unified CREATURES list: every roster creature + your custom monsters,
  //    each with its collection (discovered/captured × size) controls. ──
  const col = collection || emptyCollection();
  const setCol = (next) => onCollectionChange?.(next);
  const bulk = (fn) => { let c = col; for (const r of rosterCreatures) for (const f of FORM_ORDER) c = fn(c, r.id, f); setCol(c); };

  const CollectionCells = ({ id }) => (
    <>
      {FORM_ORDER.map((f) => {
        const disc = discoveredForms(col, id).includes(f);
        const capt = capturedForms(col, id).includes(f);
        const cls = capt ? 'capt' : disc ? 'disc' : 'none';
        const label = capt ? 'captured' : disc ? 'discovered' : 'not discovered';
        return (
          <td key={f} className="adCellTd">
            <button className={`adCell ${cls}`} title={`${FORMS[f].label} — ${label}. Tap to cycle none → discovered → captured.`}
              onClick={() => setCol(cycleCell(col, id, f))}>
              {capt ? <Icon icon="game-icons:catch" /> : disc ? <Icon icon="game-icons:semi-closed-eye" /> : '·'}
            </button>
          </td>
        );
      })}
    </>
  );

  const rosterThumb = (c) => {
    const p = sizedPortrait(c.meta?.portrait || c.portrait, c.meta?.form ?? c.size);
    return p ? <img src={p} alt="" /> : <Icon icon={creatureIcon(c)} style={{ color: creatureColor(c) }} />;
  };

  return (
    <div className="creator meList">
      <header className="crHead meHead">
        {onMenu && <button className="selBtn ghost" onClick={onMenu}>≡ Menu</button>}
        {tabs}
        <h1>🛠 Editor — Creatures</h1>
      </header>
      <div className="adBody">
        <div className="meListHead">
          <p className="adIntro">
            Every creature in the game. Set which <b>sizes</b> each is <b>discovered</b> (Codex-visible)
            and <b>captured</b> (team-pickable) — tap a cell to cycle
            <span className="adLegend"><i className="adCell none">·</i> none → <i className="adCell disc"><Icon icon="game-icons:semi-closed-eye" /></i> discovered → <i className="adCell capt"><Icon icon="game-icons:catch" /></i> captured</span>
          </p>
          <button className="selBtn go" onClick={() => setEditing(emptyDef(classes, biologies))}>＋ New Custom Creature</button>
        </div>
        <div className="adBulk">
          <button className="adBtn" onClick={() => bulk(addDiscovered)}>👁 Discover everything</button>
          <button className="adBtn" onClick={() => setCol(seedFullCollection(rosterCreatures))}>✔ Capture all (native sizes)</button>
          <button className="adBtn" onClick={() => bulk(addCaptured)}>✔✔ Capture ALL sizes</button>
          <button className="adBtn danger" onClick={() => { if (confirm('Reset the collection to a FRESH state? You will pick a starter again.')) onCollectionReset?.(); }}>♻ Reset to fresh (starter pick)</button>
        </div>
        <div className="adTableWrap">
          <table className="adTable">
            <thead>
              <tr>
                <th className="adNameCol">Creature</th>
                {FORM_ORDER.map((f) => <th key={f} title={FORMS[f].label}>{FORMS[f].badge || '—'}<span className="adFormLbl">{FORMS[f].label}</span></th>)}
                <th className="adActCol"></th>
              </tr>
            </thead>
            <tbody>
              {rosterCreatures.map((c) => (
                <tr key={c.id}>
                  <td className="adName">
                    <span className="adThumb">{rosterThumb(c)}</span>
                    <span className="adNameTxt">{c.name}<span className="adNative">native: {FORMS[c.meta?.form ?? c.size ?? 'regular'].label}</span></span>
                  </td>
                  <CollectionCells id={c.id} />
                  <td className="adActCol" />
                </tr>
              ))}
              {defs.map((d) => {
                const preview = { class: d.class, biology: d.biology, attunement: d.attunement };
                const color = creatureColor(preview);
                return (
                  <tr key={d.id} className="adCustomRow">
                    <td className="adName">
                      <span className="adThumb">{d.portraitSvg ? <img src={d.portraitSvg} alt="" /> : <Icon icon={creatureIcon(preview)} style={{ color }} />}</span>
                      <span className="adNameTxt">{d.name}<span className="adNative">custom · {formLabel(d.size) || 'Regular'}{d.customDeck ? ` · ${d.customDeck.length}-card deck` : ''}</span></span>
                    </td>
                    <td className="adCustomNote" colSpan={FORM_ORDER.length}>Custom — always in your roster</td>
                    <td className="adActCol">
                      <button className="adBtn sm" onClick={() => setEditing({ ...emptyDef(classes, biologies), ...d, lore: d.lore || '', description: d.description || '', size: d.size || 'regular' })}>✎</button>
                      <button className="adBtn sm danger" onClick={() => { if (confirm(`Delete "${d.name}"?`)) onDelete(d.id); }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
