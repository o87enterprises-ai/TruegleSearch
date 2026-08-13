import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

// The Unhinged gate, in one place.
//
// Unhinged now appears in EVERY chat-mode selector (landing row, search page
// row, /chat's own pills), and each of those needs the same three behaviours:
// know whether the gate is open, send a locked tap to the same modal Safe
// Search uses, and strip the mode again if the gate closes underneath a stored
// preference. Written out three times that would drift; here it cannot.
//
// This is UI, not security. `routes/ai.js` re-derives the gate from the session
// on every request and strips `unhinged` from `modes` for anyone who has not
// passed it, so a hand-crafted request gains nothing.
export function useUnhingedGate(activeModes, setModes) {
  const { settings } = useSettings();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Gated exactly like Safe Search "off", because it unlocks the same class of
  // content: a signed-in account (the passwordless email-code flow proves
  // control of an inbox) AND Safe Search actually switched off.
  const unhingedAllowed = isAuthenticated && settings.safeSearch === 'off';
  const unhinged = Array.isArray(activeModes) && activeModes.includes('unhinged');

  // The gate can close underneath a stored preference — sign out, or turn Safe
  // Search back on. WAIT FOR AUTH FIRST: isAuthenticated is false until the
  // session check returns, so without the guard every reload stripped the mode
  // before it was known whether the user was signed in.
  useEffect(() => {
    if (authLoading || !setModes) return;
    if (unhinged && !unhingedAllowed) {
      setModes((prev) => {
        const next = prev.filter((m) => m !== 'unhinged');
        return next.length ? next : ['blue'];
      });
    }
  }, [authLoading, unhinged, unhingedAllowed, setModes]);

  // Same modal and same flow as Safe Search; it only needs to know which of the
  // two gates stopped you, or a signed-out user is sent to the login page.
  const onLockedUnhinged = () => {
    window.dispatchEvent(new CustomEvent('truegle:safesearch-locked', {
      detail: { reason: isAuthenticated ? 'safesearch' : 'signin', feature: 'Unhinged mode' },
    }));
  };

  return { unhingedAllowed, unhinged, onLockedUnhinged };
}

export default useUnhingedGate;
