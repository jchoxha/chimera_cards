// Unified app entry (app.html): a main menu connecting the Card Editor (Forge)
// and the playtest Combat screen (Proving Pit). CombatScreen imports its own
// combat.css; the editor's styles are pulled in here.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../editor/editor.css';

createRoot(document.getElementById('root')).render(<App />);
