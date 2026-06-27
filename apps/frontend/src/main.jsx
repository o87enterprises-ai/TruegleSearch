import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import {
  installGlobalErrorHandlers,
  renderEmergencyFallback,
} from './utils/globalErrorHandler';

// Install the framework-agnostic crash safety net BEFORE we try to mount, so a
// fatal error during bundle eval / mount still shows a friendly screen instead
// of a blank white page.
installGlobalErrorHandlers();

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
