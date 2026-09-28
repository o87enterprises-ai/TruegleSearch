import { useSyncExternalStore } from 'react';

// The browser's own "install this app" hand-off, caught at boot.
//
// Chromium browsers (Chrome, Edge, Samsung Internet, Opera, Brave) fire
// `beforeinstallprompt` once they judge the site installable — often before
// any page component has mounted — and the event is gone if nobody was
// listening. Holding it here is what lets Truegle's own Install button call
// the real installer later. Without this, the only prompt anyone ever saw was
// the browser's mini-banner, which each browser shows on its own schedule and
// then hides for months once dismissed.
//
// Safari, Firefox and iOS never fire it: they get written steps instead (see
// InstallTruegle.jsx). Nothing here is sent anywhere.

let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function initInstallPrompt() {
  if (typeof window === 'undefined') return;
  installed = isStandalone();
  // Fired before this module loaded? index.html's inline listener kept it.
  if (window.__truegleInstall) { deferred = window.__truegleInstall; window.__truegleInstall = null; }
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own mini-banner from racing ours; our button calls
    // the same installer.
    e.preventDefault();
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

/** Opens the browser's real installer. Resolves 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null; // single use, per the spec
  emit();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

let snap = '';
const snapshot = () => {
  const next = `${deferred ? 1 : 0}${installed ? 1 : 0}`;
  if (next !== snap) snap = next;
  return snap;
};
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useInstallState() {
  const s = useSyncExternalStore(subscribe, snapshot, () => '00');
  return { canPrompt: s[0] === '1', installed: s[1] === '1' };
}
