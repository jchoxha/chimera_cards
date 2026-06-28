// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/MonsterEditor — the Editor's MONSTERS page (admin tool).     ║
// ║ Create/edit/delete custom creatures: name, lore, physical description,   ║
// ║ matrix typings, size, and — unlike the end-user team-assembly creator —  ║
// ║ an optional HAND-BUILT deck (via the reskinned DeckBuilder). Persisted   ║
// ║ as the same `chimera.custom` defs the team-assembly creator uses, so     ║
// ║ monsters built here show up in your roster. Presentational: App owns the ║
// ║ pools + the save/delete handlers.                                        ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import DeckBuilder from '../ui/deck/DeckBuilder.jsx';
import { deckToCounts } from '../engine/deck/budget.js';
import { FORM_ORDER, FORMS, formLabel } from '../data/forms.js';
import { anatomyForFamily } from '../engine/cards/beastPool.js';
import { weaponsForArchetype } from '../engine/cards/humanoidPool.js';
import { ARCHETYPE_ICON, BIOLOGY_ICON, ATTUNEMENT_ICON, ATTUNEMENT_COLOR, creatureIcon, creatureColor } from '../data/axisIcons.js';
import './creator.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

function emptyDef(classes, biologies) {
  return { id: null, name: '', lore: '', description: '', class: [classes[0] || 'Warrior'],
    biology: [biologies[0] || 'Humanoid'], attunement: ['Physical'], size: 'regular',
    family: null, anatomy: [], weapons: [], customDeck: null };
}

export default function MonsterEditor({ defs = [], classes = [], biologies = [], attunements = [], legalFor, buildPool, families = [], onSave, onDelete, onMenu, tabs }) {
  const [editing, setEditing] = useState(null); // a def being edited, or null = list
  const [building, setBuilding] = useState(false);

  if (editing) {
    const klass = editing.class[0];
    const atts = (editing.attunement || []).filter(Boolean);
    const legal = legalFor ? legalFor(klass) : attunements;
    const isBeast = (editing.biology || []).includes('Beast');
    const isHumanoid = (editing.biology || []).includes('Humanoid');
    const family = editing.family || families[0] || null;
    const allowedAnatomy = isBeast ? anatomyForFamily(family) : [];
    const allowedWeapons = isHumanoid ? weaponsForArchetype(klass) : [];
    const preview = { class: [klass], biology: [editing.biology[0]], attunement: atts.length ? atts : ['Physical'] };
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
          title={`Build ${editing.name || klass}'s deck`}
          subtitle={`${klass} · ${editing.biology[0]} · ${atts.join(' / ') || 'Physical'}`}
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
              <span><Icon icon={ARCHETYPE_ICON[klass] || 'game-icons:gladius'} /> {klass}</span>
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
              <label className="crFld"><span>Archetype</span>
                <select value={klass} onChange={(e) => set({ class: [e.target.value], weapons: [], customDeck: null })}>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="crFld"><span>Biology</span>
                <select value={editing.biology[0]} onChange={(e) => set({ biology: [e.target.value], family: null, anatomy: [], weapons: [], customDeck: null })}>
                  {biologies.map((bb) => <option key={bb} value={bb}>{bb}</option>)}
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

            {isBeast && (
              <div className="crAxes">
                <div className="crDeckHead">Beast Kit</div>
                <label className="crFld"><span>Family</span>
                  <select value={family || ''} onChange={(e) => set({ family: e.target.value, anatomy: [], customDeck: null })}>
                    {families.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <div className="crFld"><span>Anatomy <em>(pick the body parts that build its deck)</em></span>
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
                if (isBeast) { out.family = family; out.anatomy = (editing.anatomy || []).filter((t) => allowedAnatomy.includes(t)); }
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

  return (
    <div className="creator meList">
      <header className="crHead meHead">
        {onMenu && <button className="selBtn ghost" onClick={onMenu}>≡ Menu</button>}
        {tabs}
        <h1>🛠 Editor — Monsters</h1>
      </header>
      <div className="meListBody">
        <div className="meListHead">
          <h2>Your Custom Monsters <span className="meCount">{defs.length}</span></h2>
          <button className="selBtn go" onClick={() => setEditing(emptyDef(classes, biologies))}>＋ New Monster</button>
        </div>
        {defs.length === 0 && <p className="crHint">No custom monsters yet. Create one — it will appear in your roster on the Assemble Team screen.</p>}
        <div className="meGrid">
          {defs.map((d) => {
            const preview = { class: d.class, biology: d.biology, attunement: d.attunement };
            const color = creatureColor(preview);
            return (
              <div key={d.id} className="meCard" style={{ '--gl': color }}>
                <div className="meCardPortrait"><Icon icon={creatureIcon(preview)} style={{ color }} /></div>
                <div className="meCardName">{d.name}</div>
                <div className="meCardAxes">{(d.biology || []).includes('Beast') && d.family ? `${d.family} · ` : ''}{(d.class || []).join('/')} · {(d.biology || []).join('/')} · {(d.attunement || []).join('/')}</div>
                <div className="meCardMeta">{formLabel(d.size) || 'Regular'}{d.customDeck ? ` · ${d.customDeck.length}-card deck` : ' · auto deck'}</div>
                <div className="meCardBtns">
                  <button className="selBtn" onClick={() => setEditing({ ...emptyDef(classes, biologies), ...d, lore: d.lore || '', description: d.description || '', size: d.size || 'regular' })}>✎ Edit</button>
                  <button className="selBtn rm" onClick={() => { if (confirm(`Delete "${d.name}"?`)) onDelete(d.id); }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
