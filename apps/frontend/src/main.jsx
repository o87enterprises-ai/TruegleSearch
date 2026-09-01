import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import {
  installGlobalErrorHandlers,
  renderEmergencyFallback,
} from './utils/globalErrorHandler';
import { initAnalytics } from './utils/analytics';

// Install the framework-agnostic crash safety net BEFORE we try to mount, so a
// fatal error during bundle eval / mount still shows a friendly screen instead
// of a blank white page.
installGlobalErrorHandlers();

// Cookieless, no-fingerprint page-view counts. Inert unless VITE_CF_BEACON_TOKEN
// is set, and skipped entirely for visitors sending DNT / GPC.
initAnalytics();


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
