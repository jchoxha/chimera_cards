// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/EditorHub — the unified Editor (admin tool). A tab strip     ║
// ║ switches between the CARDS page (the old Card Forge / collections) and    ║
// ║ the CREATURES page (every creature in the game: per-creature collection   ║
// ║ state + the custom-creature builder). App owns the pools + all            ║
// ║ save/delete/collection handlers; this just routes.                        ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useState } from 'react';
import { CardEditor } from '../editor/CardEditor.jsx';
import MonsterEditor from './MonsterEditor.jsx';
import './editorHub.css';

export default function EditorHub({ onMenu, monsterProps }) {
  const [tab, setTab] = useState('cards');
  const tabs = (
    <span className="ehTabs">
      <button className={`ehTab${tab === 'cards' ? ' on' : ''}`} onClick={() => setTab('cards')}>🃏 Cards</button>
      <button className={`ehTab${tab === 'creatures' ? ' on' : ''}`} onClick={() => setTab('creatures')}>🐉 Creatures</button>
    </span>
  );

  if (tab === 'creatures') return <MonsterEditor {...monsterProps} onMenu={onMenu} tabs={tabs} />;
  return <CardEditor onMenu={onMenu} tabs={tabs} />;
}
