// src/main.tsx — the application's entry.
//
// The whole app is the starter shell (src/App.tsx) reading the page list in src/routes.tsx, wrapped
// in the session the backend owns: one http-only cookie, so the same account follows a traveller
// between a phone browser and a desktop browser.
//
// The stylesheets load in the one order that matters: the template's own first, then what the
// approved design needed that the template does not provide.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import './styles/theme.css';
import './styles/mockup-additions.css';
import './styles/mockup-frames.css';
import { SessionProvider } from './session/index.js';
import { App } from './App';

const container = document.getElementById('root');
if (container === null) throw new Error('index.html is missing its #root element.');

createRoot(container).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
