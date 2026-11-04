import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LeagueApp from './LeagueApp.jsx';
import './styles.css';

// /league is the online league (served by server/index.mjs); everything else is solo play.
const Root = window.location.pathname.startsWith('/league') ? LeagueApp : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
