import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  // Temporarily removed StrictMode for debugging
  // <StrictMode>
    <App />
  // </StrictMode>
);
