// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/CreatureFilter — smart filtering shared by the team-assembly ║
// ║ collection grid AND the editor's Creatures catalog. Derives a creature's  ║
// ║ facets from its axes, indexes the facet values actually present (so only   ║
// ║ meaningful filters show), and matches a creature against active facets +   ║
// ║ a text query. `CreatureFilterBar` renders the search + facet chips.        ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';
import { FORMS, FORM_ORDER } from '../data/forms.js';

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

/** The facet values of one creature, keyed by facet. `c` may be a built creature
 *  (axes on the object) or a raw def (class/biology/... fields). */
export function creatureFacets(c) {
  const ax = c.axes || c;
  const form = c.meta?.form ?? c.size ?? c.form ?? 'regular';
  return {
    attunement: arr(ax.attunement),
    body: arr(ax.biology),
    subtype: arr(ax.subtypes),
    archetype: arr(ax.class),
    family: arr(ax.family),
    size: [form],
  };
}

export const FACET_DEFS = [
  { key: 'attunement', label: 'Element' },
  { key: 'body', label: 'Body' },
  { key: 'subtype', label: 'Subtype' },
  { key: 'archetype', label: 'Archetype' },
  { key: 'family', label: 'Family' },
  { key: 'size', label: 'Size' },
];

/** All facet values present across `creatures` (so we only show useful filters). */
export function facetIndex(creatures) {
  const idx = {}; FACET_DEFS.forEach((f) => { idx[f.key] = new Set(); });
  for (const c of creatures) {
    const fac = creatureFacets(c);
    for (const f of FACET_DEFS) for (const v of fac[f.key]) idx[f.key].add(v);
  }
  return idx;
}

export const emptyFilter = () => ({ q: '', sets: {} });

/** Does `c` pass the active filter? A facet with selected values requires the
 *  creature to have ≥1 of them (OR within a facet, AND across facets). */
export function matchesFilter(c, filter) {
  const q = (filter.q || '').trim().toLowerCase();
  if (q) {
    const hay = `${c.name || ''} ${c.speciesName || ''} ${c.nickname || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const fac = creatureFacets(c);
  for (const f of FACET_DEFS) {
    const sel = filter.sets?.[f.key];
    if (sel && sel.size && !fac[f.key].some((v) => sel.has(v))) return false;
  }
  return true;
}

const sortFacetValues = (key, vals) => (key === 'size'
  ? [...vals].sort((a, b) => FORM_ORDER.indexOf(a) - FORM_ORDER.indexOf(b))
  : [...vals].sort());
const facetLabel = (key, v) => (key === 'size' ? (FORMS[v]?.label || v) : v);

/** The filter bar: a search box + a chip row per facet that has ≥2 values. */
export function CreatureFilterBar({ creatures = [], filter, onChange, placeholder = 'Search…' }) {
  const idx = facetIndex(creatures);
  const set = (patch) => onChange({ ...filter, ...patch });
  const toggle = (key, v) => {
    const cur = new Set(filter.sets?.[key] || []);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    onChange({ ...filter, sets: { ...filter.sets, [key]: cur } });
  };
  const activeCount = Object.values(filter.sets || {}).reduce((n, s) => n + (s?.size || 0), 0) + (filter.q ? 1 : 0);
  return (
    <div className="cfBar uiPanel">
      <div className="cfTop">
        <input className="cfSearch" placeholder={placeholder} value={filter.q || ''} onChange={(e) => set({ q: e.target.value })} />
        {activeCount > 0 && <button className="uiBtn sm ghost" onClick={() => onChange(emptyFilter())}>Clear ({activeCount})</button>}
      </div>
      <div className="cfFacets">
        {FACET_DEFS.map((f) => {
          const vals = sortFacetValues(f.key, idx[f.key]);
          if (vals.length < 2) return null;   // only show filters that actually split the set
          return (
            <div className="cfGroup" key={f.key}>
              <span className="cfGroupLbl">{f.label}</span>
              {vals.map((v) => {
                const on = filter.sets?.[f.key]?.has(v);
                return (
                  <button key={v} className={`uiTab cfChip${on ? ' on' : ''}`} onClick={() => toggle(f.key, v)}>
                    {facetLabel(f.key, v)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
