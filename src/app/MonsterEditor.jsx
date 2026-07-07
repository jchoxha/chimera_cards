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
import { CardFace, creatureToFace } from '../ui/combat/creatureVisuals.jsx';
import MonsterPage from '../ui/MonsterPage.jsx';
import Modal from '../ui/Modal.jsx';
import {
  emptyCollection, seedFullCollection, addDiscovered, addCaptured,
  removeDiscovered, discoveredForms, capturedForms,
  ownedForSpecies, ownedCountOf, addOwned, removeOwned, renameOwned,
} from './collection.js';
import { CreatureFilterBar, matchesFilter, emptyFilter } from './CreatureFilter.jsx';
import '../ui/combat/combat.css';
import './creator.css';
import './admin.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

function emptyDef(classes, biologies) {
  return { id: null, name: '', lore: '', description: '', class: [classes[0] || 'Warrior'],
    biology: [biologies[0] || 'Humanoid'], attunement: ['Physical'], size: 'regular',
    family: null, anatomy: [], weapons: [], subtypes: [], customDeck: null };
}

export default function MonsterEditor({ defs = [], classes = [], biologies = [], attunements = [], subtypeOptions = [], legalFor, buildPool, families = [], onSave, onDelete, onMenu, tabs,
  rosterCreatures = [], customCreatures = [], collection, onCollectionChange, onCollectionReset, sizeVariant }) {
  const [editing, setEditing] = useState(null); // a def being edited, or null = list
  const [building, setBuilding] = useState(false);
  const [openId, setOpenId] = useState(null);   // creature whose collection modal is open
  const [openForm, setOpenForm] = useState(null); // the size variation being viewed in the modal
  const [filter, setFilter] = useState(emptyFilter);

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

  // ── Unified CREATURES grid: every creature is its own card (like the Cards
  //    tab). Clicking a card opens its collection modal (discovered/captured ×
  //    size) — plus Edit/Delete for customs. ──
  const col = collection || emptyCollection();
  const setCol = (next) => onCollectionChange?.(next);
  const bulk = (fn) => { let c = col; for (const r of rosterCreatures) for (const f of FORM_ORDER) c = fn(c, r.id, f); setCol(c); };

  // Every creature as a card: built-in roster + your custom monsters.
  const allCreatures = [...rosterCreatures, ...customCreatures];
  const shownCreatures = allCreatures.filter((c) => matchesFilter(c, filter));
  const open = openId ? allCreatures.find((c) => c.id === openId) : null;
  const openDef = open?.custom ? defs.find((d) => d.id === open.id) : null;
  const nativeForm = open ? (open.meta?.form ?? open.size ?? 'regular') : 'regular';
  const viewForm = openForm || nativeForm;
  // The creature rebuilt at the size being viewed (roster only; customs are single-size).
  const viewCreature = (!open || open.custom || viewForm === nativeForm || !sizeVariant)
    ? open : (sizeVariant(open.baseId || open.id, viewForm) || open);
  const openCreature = (id) => { setOpenId(id); setOpenForm(null); };

  // Status pill for a tile: captured/discovered counts (customs are always yours).
  const statusOf = (c) => {
    if (c.custom) return { cls: 'capt', tone: 'good', txt: 'Custom' };
    const capt = capturedForms(col, c.id).length;
    const disc = discoveredForms(col, c.id).length;
    if (capt) return { cls: 'capt', tone: 'good', txt: `✔ ${capt}` };
    if (disc) return { cls: 'disc', tone: 'info', txt: `👁 ${disc}` };
    return { cls: 'none', tone: 'muted', txt: 'Locked' };
  };

  return (
    <div className="creator meList">
      <header className="crHead meHead">
        {onMenu && <button className="selBtn ghost" onClick={onMenu}>≡ Menu</button>}
        {tabs}
        <h1>🛠 Editor — Creatures</h1>
      </header>
      <div className="adBody">
        <p className="uiHint ceIntro">Every creature in the game, as its card — click one to view it, switch between its sizes, manage which you own, and edit your custom creatures.</p>
        <CreatureFilterBar creatures={allCreatures} filter={filter} onChange={setFilter} placeholder="Search creatures…" />
        <details className="ceBulk">
          <summary>⚙ Collection bulk actions <span className="uiHint">(dev)</span></summary>
          <div className="ceBulkRow">
            <button className="uiBtn sm" onClick={() => bulk(addDiscovered)}>👁 Discover everything</button>
            <button className="uiBtn sm" onClick={() => setCol(seedFullCollection(rosterCreatures))}>✔ Capture all (native sizes)</button>
            <button className="uiBtn sm" onClick={() => bulk(addCaptured)}>✔✔ Capture ALL sizes</button>
            <button className="uiBtn sm danger" onClick={() => { if (confirm('Reset the collection to a FRESH state? You will pick a starter again.')) onCollectionReset?.(); }}>♻ Reset to fresh</button>
          </div>
        </details>

        <div className="uiCardGrid">
          <button className="uiCardTile ceCreate" onClick={() => setEditing(emptyDef(classes, biologies))}>
            <div className="ceCreatePlus">＋</div>
            <div className="ceCreateName">New Custom Creature</div>
            <div className="ceCreateSub">Author its typings, size &amp; (optionally) a hand-built deck.</div>
          </button>
          {shownCreatures.map((c) => {
            const st = statusOf(c);
            return (
              <div key={c.id} role="button" tabIndex={0}
                className={`uiCardTile${st.cls === 'none' ? ' locked' : ''}`}
                style={{ '--gl': creatureColor(c) }}
                onClick={() => openCreature(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openCreature(c.id); }}>
                <CardFace f={creatureToFace(c)} side="ally" />
                <span className={`ceStatus uiPill ${st.tone}`}>{st.txt}</span>
              </div>
            );
          })}
          {shownCreatures.length === 0 && <p className="uiHint" style={{ gridColumn: '1 / -1', padding: '20px' }}>No creatures match your filters.</p>}
        </div>
      </div>

      {/* Per-creature modal — CREATURE-FIRST: the card + its page (at the viewed
          SIZE), custom edit/delete, and the SIZES section (switch + manage). */}
      {open && (
        <Modal onClose={() => setOpenId(null)} size="lg" className="ceModal">
          <div className="ceModalCols">
            <div className="ceModalCard"><CardFace f={creatureToFace(viewCreature)} side="ally" /></div>
            <div className="ceModalInfo">
              <MonsterPage creature={viewCreature} />
              {open.custom && (
                <div className="ceActRow">
                  <button className="uiBtn go" onClick={() => { const d = openDef; setOpenId(null); if (d) setEditing({ ...emptyDef(classes, biologies), ...d, lore: d.lore || '', description: d.description || '', size: d.size || 'regular' }); }}>✎ Edit creature</button>
                  <button className="uiBtn danger" onClick={() => { if (confirm(`Delete "${open.name}"?`)) { onDelete(open.id); setOpenId(null); } }}>🗑 Delete</button>
                </div>
              )}
            </div>
          </div>

          {/* SIZES — switch the variation being viewed + manage the collection at it. */}
          {!open.custom && (() => {
            const discHere = discoveredForms(col, open.id).includes(viewForm);
            const owned = ownedForSpecies(col, open.id).filter((o) => o.form === viewForm);
            return (
              <div className="ceSizes">
                <div className="ceSizesHead"><Icon icon="game-icons:resize" /> Size variations</div>
                <div className="ceSizeChips">
                  {FORM_ORDER.map((f) => {
                    const disc = discoveredForms(col, open.id).includes(f);
                    const owns = ownedCountOf(col, open.id, f);
                    return (
                      <button key={f} className={`ceSizeChip${viewForm === f ? ' on' : ''}${owns ? ' owns' : disc ? ' disc' : ''}`}
                        onClick={() => setOpenForm(f)}
                        title={`${FORMS[f].label}${owns ? ` — own ${owns}` : disc ? ' — discovered' : ' — not discovered'}`}>
                        {FORMS[f].badge ? `${FORMS[f].badge} ` : ''}{FORMS[f].label}
                        {owns > 0 && <span className="ceSizeN">{owns}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="ceSizeManage uiPanel">
                  <div className="ceSizeRow">
                    <b>{FORMS[viewForm].label}</b>
                    <label className="ceSizeToggle">
                      <input type="checkbox" checked={discHere}
                        onChange={() => setCol(discHere ? removeDiscovered(col, open.id, viewForm) : addDiscovered(col, open.id, viewForm))} />
                      Discovered (Codex)
                    </label>
                    <button className="uiBtn sm go" onClick={() => setCol(addOwned(col, open.id, viewForm))}>＋ Capture one</button>
                  </div>
                  {owned.length === 0
                    ? <p className="uiHint">You own none of this size. “Capture one” adds an instance you can nickname.</p>
                    : (
                      <div className="ceOwnedList">
                        {owned.map((o, i) => (
                          <div className="ceOwnedRow" key={o.iid}>
                            <span className="ceOwnedN">#{i + 1}</span>
                            <input className="ceNick" value={o.nickname} placeholder={open.speciesName || open.name} maxLength={24}
                              onChange={(e) => setCol(renameOwned(col, o.iid, e.target.value))} />
                            <button className="uiBtn sm danger" title="Release this one" onClick={() => setCol(removeOwned(col, o.iid))}>🗑</button>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
