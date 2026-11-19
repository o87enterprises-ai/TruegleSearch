import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import {
  installGlobalErrorHandlers,
  renderEmergencyFallback,
} from './utils/globalErrorHandler';
import { initAnalytics } from './utils/analytics';
import { initInstallPrompt } from './utils/installPrompt';
import { applyLite } from './utils/liteMode';

// Install the framework-agnostic crash safety net BEFORE we try to mount, so a
// fatal error during bundle eval / mount still shows a friendly screen instead
// of a blank white page.
installGlobalErrorHandlers();

// Lite mode class goes on <html> before first paint so heavy effects never flash on.
applyLite();

// STALE TAB AFTER A DEPLOY. Pages are lazy chunks with hashed names; a tab opened before a deploy
// still points at the old names, so opening a page it had not loaded yet fails ("This page hit
// a snag"). Vite fires this event when such a chunk will not load: fetch the fresh app once.
// The timestamp guard stops a reload loop if the file is genuinely missing.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('tg_chunk_reload') || 0);
    if (Date.now() - last < 15000) return;       // already tried a moment ago: show the normal error
    sessionStorage.setItem('tg_chunk_reload', String(Date.now()));
  } catch { /* storage blocked: one reload attempt is still the right call */ }
  e.preventDefault();
  window.location.reload();
});

// Cookieless, no-fingerprint page-view counts. Inert unless VITE_CF_BEACON_TOKEN
// is set, and skipped entirely for visitors sending DNT / GPC.
initAnalytics();

// Catch the browser's install hand-off before any page mounts — it can fire
// that early and is lost if nobody is listening (see utils/installPrompt).
initInstallPrompt();


function dismissLoader() {
  const loader = document.getElementById('truegle-loader');
  if (!loader) return;
  loader.style.opacity = '0';
  loader.style.pointerEvents = 'none';
  setTimeout(() => loader.remove(), 450);
}

try {
  createRoot(document.getElementById('root')).render(<App />);
  // Give React one tick to paint before fading out the loader
  requestAnimationFrame(dismissLoader);
} catch (err) {
  console.error('Fatal: app failed to mount', err);
  dismissLoader();
  renderEmergencyFallback(err?.message || 'App failed to start');
}

// PRODUCTION ONLY. A service worker caching Vite's dev-server responses is a
// stale-code generator, not a feature — every "why isn't my change showing
// up" report in a project with one starts here. `after load` so registering
// it never competes with the app's own first paint for the network.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline shell this session — the app still works with a
      // connection, which is the only thing that was ever guaranteed.
    });
  });
}
