import React from 'react';
import { createRoot } from 'react-dom/client';
import { CardEditor } from './CardEditor.jsx';
import './editor.css';

createRoot(document.getElementById('root')).render(<CardEditor />);
