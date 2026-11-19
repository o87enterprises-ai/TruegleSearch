import { useSyncExternalStore } from 'react';

/**
 * True while the device can actually reach the internet.
 *
 * `navigator.onLine` alone is not enough: it only means "there is a network interface", and
 * Android's WebView often keeps saying true in airplane mode or with no service. So on top of it
 * this checks reachability for real — a tiny request for Truegle's own static manifest (no
 * backend, no cookies, nothing about the visitor), every 20 s while the app is visible and
 * whenever the connection changes. It takes two failed tries in a row to count as offline, so a
 * single slow request never flips the app into offline mode.
 */
const PROBE = 'manifest.webmanifest';
const probeUrl = () => {
  try {
    // On truegle.info stay same-origin (the site's content-security-policy allows it); the Android
    // app and local dev have another origin, so they ask the live site.
    if (/(^|\.)truegle\.info$/.test(window.location.hostname)) return `/${PROBE}`;
  } catch { /* fall through */ }
  return `https://truegle.info/${PROBE}`;
};

let reachable = true;
let started = false;
const subs = new Set();
const set = (v) => { if (v !== reachable) { reachable = v; subs.forEach((f) => f()); } };

async function ping() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    await fetch(`${probeUrl()}?_=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}

async function check() {
  if (navigator.onLine === false) { set(false); return; }
  let ok = await ping();
  if (!ok) { await new Promise((r) => setTimeout(r, 2500)); ok = await ping(); }
  set(ok);
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', check);
  window.addEventListener('offline', () => set(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(() => { if (!document.hidden) check(); }, 20000);
  check();
}

const subscribe = (fn) => { start(); subs.add(fn); return () => subs.delete(fn); };
const snapshot = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false && reachable);

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}

export default useOnlineStatus;
