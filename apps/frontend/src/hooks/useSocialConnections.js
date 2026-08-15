import { useCallback, useSyncExternalStore } from 'react';
import { isConnectable } from '../config/socialProviders';

// Which providers this browser has connected.
//
// IT LIVES IN THE BROWSER, and for the demo that is the whole story: no Truegle
// account, no row anywhere, nothing on our side that says who you are. Reading
// your own feed should not require being identifiable to us.
//
// THIS IS THE PART THAT MOVES when real OAuth arrives. A demo connection is a
// name and a timestamp — there is nothing here worth protecting. A real one
// carries an access token and a refresh token, and those cannot live in
// localStorage: they go server-side, encrypted, and hang off an account. The
// shape below is deliberately the shape the server will hand back, so the swap
// is a change of source rather than a change of everything downstream.
//
// A module store rather than component state because two places need it (the
// page and the callback route) and they must not disagree.

const KEY = 'truegle_feed_connections';

let cache = null;
const listeners = new Set();

function read() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    // Filtered on the way IN: a provider that has since been switched off, or
    // a hand-edited key, must not put the page into a state with no pill.
    cache = Array.isArray(raw)
      ? raw.filter((c) => c && typeof c.provider === 'string' && isConnectable(c.provider))
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode — this session still works */ }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
// Server snapshot: there is no server, and returning a fresh [] here would
// loop — useSyncExternalStore compares snapshots by identity.
const EMPTY = [];

export function connect({ provider, handle }) {
  if (!isConnectable(provider)) return read();
  const next = [
    ...read().filter((c) => c.provider !== provider),
    { provider, handle: handle || null, connectedAt: new Date().toISOString() },
  ];
  write(next);
  return next;
}

export function disconnect(provider) {
  write(read().filter((c) => c.provider !== provider));
}

export function useSocialConnections() {
  const connections = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    connections,
    ids: connections.map((c) => c.provider),
    has: useCallback((id) => connections.some((c) => c.provider === id), [connections]),
    connect,
    disconnect,
  };
}
