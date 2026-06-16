// Entry for the standalone engine combat demo (combat.html).
// Kept separate from the main app (index.html → src/main.jsx) so the new engine
// can be played & deployed without disturbing the React prototype.
import React from 'react';
import { createRoot } from 'react-dom/client';
import CombatScreen from '../ui/combat/CombatScreen.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CombatScreen />
  </React.StrictMode>,
);
