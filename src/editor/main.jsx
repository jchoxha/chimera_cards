import React from 'react';
import { createRoot } from 'react-dom/client';
import { CardEditor } from './CardEditor.jsx';
import '../ui/theme.css';        // design tokens + shared UI primitives — load FIRST
import './editor.css';

createRoot(document.getElementById('root')).render(<CardEditor />);
