// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/AdminPanel — the testing console for the COLLECTION: pick   ║
// ║ which creatures and which SIZES are discovered (Codex-visible) and      ║
// ║ captured (team-assembly-pickable). Each cell cycles none → discovered   ║
// ║ → captured; bulk rows/buttons for whole-roster states; reset returns    ║
// ║ the app to the fresh starter-pick state. Admin-only, but harmless to    ║
// ║ ship — it only edits the local collection.                              ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';
import { FORM_ORDER, FORMS } from '../data/forms.js';
import {
  emptyCollection, seedFullCollection, addDiscovered, addCaptured,
  removeDiscovered, discoveredForms, capturedForms,
} from './collection.js';
import './admin.css';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

/** none → discovered → captured → none */
function cycle(col, id, form) {
  const disc = discoveredForms(col, id).includes(form);
  const capt = capturedForms(col, id).includes(form);
  if (!disc) return addDiscovered(col, id, form);
  if (!capt) return addCaptured(col, id, form);
  return removeDiscovered(col, id, form);   // also un-captures
}

export default function AdminPanel({ rosterEntries = [], collection, onChange, onReset, onMenu }) {
  const col = collection || emptyCollection();
  const set = (next) => onChange?.(next);

  const allCaptured = () => {
    let c = col;
    for (const r of rosterEntries) for (const f of FORM_ORDER) c = addCaptured(c, r.id, f);
    set(c);
  };
  const nativeCaptured = () => set(seedFullCollection(rosterEntries));
  const allDiscovered = () => {
    let c = col;
    for (const r of rosterEntries) for (const f of FORM_ORDER) c = addDiscovered(c, r.id, f);
    set(c);
  };

  return (
    <div className="adminScreen">
      <div className="adBar">
        <button className="adBack" onClick={onMenu}><Icon icon="game-icons:hamburger-menu" /> Menu</button>
        <h1><Icon icon="game-icons:gears" /> Admin — Collection</h1>
      </div>
      <p className="adIntro">
        Set which creatures — and which <b>sizes</b> of each — are <b>discovered</b> (visible in the Codex)
        and <b>captured</b> (pickable in team assembly). Tap a cell to cycle:
        <span className="adLegend"><i className="adCell none">·</i> none → <i className="adCell disc"><Icon icon="game-icons:semi-closed-eye" /></i> discovered → <i className="adCell capt"><Icon icon="game-icons:catch" /></i> captured</span>
      </p>
      <div className="adBulk">
        <button className="adBtn" onClick={allDiscovered}>👁 Discover everything</button>
        <button className="adBtn" onClick={nativeCaptured}>✔ Capture all (native sizes)</button>
        <button className="adBtn" onClick={allCaptured}>✔✔ Capture ALL sizes</button>
        <button className="adBtn danger" onClick={() => { if (confirm('Reset the collection to a FRESH state? You will pick a starter again.')) onReset?.(); }}>
          ♻ Reset to fresh (starter pick)
        </button>
      </div>
      <div className="adTableWrap">
        <table className="adTable">
          <thead>
            <tr>
              <th>Creature</th>
              {FORM_ORDER.map((f) => <th key={f} title={FORMS[f].label}>{FORMS[f].badge || '—'}<span className="adFormLbl">{FORMS[f].label}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rosterEntries.map((r) => (
              <tr key={r.id}>
                <td className="adName">{r.name}<span className="adNative">native: {FORMS[r.size || 'regular'].label}</span></td>
                {FORM_ORDER.map((f) => {
                  const disc = discoveredForms(col, r.id).includes(f);
                  const capt = capturedForms(col, r.id).includes(f);
                  const cls = capt ? 'capt' : disc ? 'disc' : 'none';
                  const label = capt ? 'captured' : disc ? 'discovered' : 'not discovered';
                  return (
                    <td key={f}>
                      <button className={`adCell ${cls}`} title={`${r.name} (${FORMS[f].label}) — ${label}. Tap to cycle.`}
                        onClick={() => set(cycle(col, r.id, f))}>
                        {capt ? <Icon icon="game-icons:catch" /> : disc ? <Icon icon="game-icons:semi-closed-eye" /> : '·'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
