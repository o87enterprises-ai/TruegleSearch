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

try {
  createRoot(document.getElementById('root')).render(<App />);
} catch (err) {
  console.error('Fatal: app failed to mount', err);
  renderEmergencyFallback(err?.message || 'App failed to start');
}
