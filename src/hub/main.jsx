// Entry for the Dev Hub (index.html / the base URL): a landing page listing
// every build/version + all design docs (rendered from Markdown at build time).
import React from 'react';
import { createRoot } from 'react-dom/client';
import Hub from './Hub.jsx';

createRoot(document.getElementById('root')).render(<Hub />);
