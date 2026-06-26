// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/EditorHub — the unified Editor (admin tool). A tab strip     ║
// ║ switches between the CARDS page (the old Card Forge / collections) and   ║
// ║ the MONSTERS page (custom-creature builder w/ hand-built decks). App     ║
// ║ owns the pools + the monster save/delete handlers; this just routes.     ║
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
      <button className={`ehTab${tab === 'monsters' ? ' on' : ''}`} onClick={() => setTab('monsters')}>🐉 Monsters</button>
    </span>
  );

  if (tab === 'monsters') return <MonsterEditor {...monsterProps} onMenu={onMenu} tabs={tabs} />;
  return <CardEditor onMenu={onMenu} tabs={tabs} />;
}
