// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/StarterPick — the fresh-app onboarding: choose ONE starter  ║
// ║ creature from a curated trio. Picking it CAPTURES it (collection) and   ║
// ║ makes it your team, so the assemble page starts with exactly one        ║
// ║ creature and the rest of the roster is earned (or admin-unlocked).      ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { CardFace, creatureToFace } from '../ui/combat/creatureVisuals.jsx';
import { creatureColor } from '../data/axisIcons.js';
import '../ui/combat/combat.css';
import './select.css';

export default function StarterPick({ starters = [], onPick }) {
  const [sel, setSel] = useState(null);
  const chosen = starters.find((c) => c.id === sel) || null;
  return (
    <div className="selScreen starterScreen">
      <header className="selHead">
        <h1>Choose Your Starter</h1>
        <p>Every tamer begins with one companion. Pick a creature to begin your collection — you’ll discover and capture more on your journeys.</p>
      </header>
      <div className="starterRow">
        {starters.map((c) => (
          <div key={c.id} role="button" tabIndex={0}
            className={`selCardWrap modalCardWrap starterCard${sel === c.id ? ' chosen' : ''}`}
            style={{ '--gl': creatureColor(c) }}
            onClick={() => setSel(c.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(c.id); }}>
            <CardFace f={creatureToFace(c)} side="ally" />
            {c.blurb && <p className="starterBlurb">{c.blurb}</p>}
          </div>
        ))}
      </div>
      <div className="starterActions">
        <button className="selBtn go big" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
          {chosen ? `Begin with ${chosen.name} ✓` : 'Pick a starter above'}
        </button>
      </div>
    </div>
  );
}
