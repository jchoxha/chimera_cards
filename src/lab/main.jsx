// Entry for the Creature Lab (lab.html) — the generation + fusion testbed.
// CardFace draws its frame/art styling from combat.css, so that is loaded here
// alongside the shared design tokens (theme.css must come FIRST).
import React from 'react';
import { createRoot } from 'react-dom/client';
import Lab from './Lab.jsx';
import '../ui/theme.css';
import '../ui/combat/combat.css';
import './lab.css';

createRoot(document.getElementById('root')).render(<Lab />);
