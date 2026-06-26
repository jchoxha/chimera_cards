// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/DeckDropdown — an expandable deck list (collapsed by    ║
// ║ default) of MoveCards. Shared by the combat creature modal AND the team   ║
// ║ assembler's creature modal, so a creature's deck reads the same in both.  ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import MoveCard from './MoveCard.jsx';

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

export default function DeckDropdown({ cards = [], label = 'Deck', icon = 'game-icons:card-pickup', onCard, defaultOpen = false, empty = 'No cards.' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="deckDrop">
      <button className="deckDropHead" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon icon={icon} /> <span>{label} ({cards.length})</span>
        <span className="ddChev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (cards.length === 0
        ? <div className="ddEmpty">{empty}</div>
        : <div className="deckDropGrid">
            {cards.map((c, i) => <MoveCard key={`${c.id}-${i}`} c={c} onClick={onCard ? () => onCard(c) : undefined} />)}
          </div>)}
    </div>
  );
}
