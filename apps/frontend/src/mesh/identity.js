// THIS DEVICE'S ANONYMOUS IDENTITY for Nearby and the relay.
//
//   • two key pairs (see seal.js) kept in this browser's IndexedDB as NON-EXTRACTABLE keys —
//     the private halves can sign/decrypt but can never be read out, not even by our own code;
//   • a handle (e.g. "calm-otter-4821") the device generates, which you can change to any free
//     screen name; it is linked to nothing but the two public keys;
//   • contacts looked up by exact handle (or opt-in prefix search).
//
// Nothing here uses your Truegle account, email or any device id. Fetch uses plain `fetch` with
// no credentials on purpose: the shared axios client would overwrite the Authorization header
// that carries the handle signature.

import { generateIdentityKeys, publicJwk, authHeader, generateHandle, cleanHandle, HANDLE_RE, seal, open, newMessageId } from './seal';

const DB = 'truegle-identity';
const STORE = 'keys';
const LS = { handle: 'truegle_handle', searchable: 'truegle_handle_searchable', contacts: 'truegle_handle_contacts' };

const base = () => {
  const b = import.meta.env.VITE_BACKEND_URL;
  return b && b !== 'http://localhost:3001' ? `${b}/api` : '/api';
};

// ── Key storage ──────────────────────────────────────────────────────────────────────────

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no storage')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

let cached = null;
/** The device's key pairs, created on first use. */
export async function getKeys() {
  if (cached) return cached;
  let k = null;
  try { k = await idb('readonly', (s) => s.get('main')); } catch { /* fall through to create */ }
  if (!k) {
    k = await generateIdentityKeys();
    try { await idb('readwrite', (s) => s.put(k, 'main')); } catch { /* memory-only this session */ }
  }
  cached = k;
  return k;
}

const readLs = (key, d) => { try { return JSON.parse(localStorage.getItem(key)) ?? d; } catch { return d; } };
const writeLs = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* blocked */ } };

export const getHandle = () => readLs(LS.handle, '');
export const isSearchable = () => readLs(LS.searchable, false) === true;

// ── Server calls ─────────────────────────────────────────────────────────────────────────

async function call(method, path, { body, auth } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const keys = await getKeys();
    headers.Authorization = await authHeader({ handle: auth, signPrivate: keys.sign.privateKey, method, path: `/api${path}` });
  }
  const res = await fetch(`${base()}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store' });
  let data = null;
  try { data = await res.json(); } catch { /* 204 */ }
  return { status: res.status, ok: res.ok, data };
}

export async function checkAvailable(handle) {
  const h = cleanHandle(handle);
  if (!HANDLE_RE.test(h)) return { valid: false, available: false, handle: h };
  const r = await call('GET', `/handles/available/${h}`);
  if (!r.ok) throw new Error('Handles are unavailable right now.');
  return { ...r.data, handle: h };
}

async function claim(handle, searchable) {
  const keys = await getKeys();
  const r = await call('POST', '/handles', {
    body: { handle, ecdh: await publicJwk(keys.ecdh.publicKey), sign: await publicJwk(keys.sign.publicKey), searchable },
  });
  return r;
}

/**
 * Makes sure this device has a registered handle, generating and claiming a random one on first
 * use (retrying on the rare collision). Returns the handle.
 */
export async function ensureHandle() {
  const have = getHandle();
  if (have) return have;
  for (let i = 0; i < 6; i += 1) {
    const h = generateHandle();
    const r = await claim(h, false);
    if (r.status === 201) { writeLs(LS.handle, h); writeLs(LS.searchable, false); return h; }
    if (r.status !== 409) throw new Error(r.data?.error || 'Could not create a handle.');
  }
  throw new Error('Could not find a free handle. Try again.');
}

/** Switch to a screen name of the user's choice (must be free). Releases the old handle. */
export async function changeHandle(wanted) {
  const h = cleanHandle(wanted);
  if (!HANDLE_RE.test(h)) throw new Error('Use 3-24 letters, numbers and single hyphens, starting with a letter.');
  const old = getHandle();
  if (h === old) return h;
  const r = await claim(h, isSearchable());
  if (r.status === 409) throw new Error('That name is taken.');
  if (r.status !== 201) throw new Error(r.data?.error || 'Could not claim that name.');
  writeLs(LS.handle, h);
  if (old) call('DELETE', `/handles/${old}`, { auth: old }).catch(() => {});
  return h;
}

export async function setSearchable(on) {
  const h = await ensureHandle();
  const r = await call('PATCH', `/handles/${h}`, { body: { searchable: !!on }, auth: h });
  if (!r.ok) throw new Error('Could not change that setting.');
  writeLs(LS.searchable, !!on);
}

/** Exact lookup: the person's public keys, or null. Cached on this device. */
export async function lookupHandle(handle) {
  const h = cleanHandle(handle);
  if (!HANDLE_RE.test(h)) return null;
  const contacts = readLs(LS.contacts, {});
  if (contacts[h]) return contacts[h];
  const r = await call('GET', `/handles/${h}`);
  if (!r.ok || !r.data?.ecdh) return null;
  contacts[h] = { handle: h, ecdh: r.data.ecdh, sign: r.data.sign };
  writeLs(LS.contacts, contacts);
  return contacts[h];
}

/** Only people who chose to be searchable. Needs 3+ letters. */
export async function searchHandles(prefix) {
  const q = cleanHandle(prefix);
  if (q.length < 3) return [];
  const r = await call('GET', `/handles/search?q=${encodeURIComponent(q)}`);
  return r.ok ? r.data.results || [] : [];
}

// ── Messages ─────────────────────────────────────────────────────────────────────────────

/** Encrypts `text` for `to` and signs it as this device. @returns {{envelope, id}} */
export async function sealFor(to, text) {
  const me = await ensureHandle();
  const peer = await lookupHandle(to);
  if (!peer) throw new Error('No one with that name.');
  const keys = await getKeys();
  return seal({ text, from: me, to: peer.handle, signPrivate: keys.sign.privateKey, toEcdh: peer.ecdh });
}

/** Decrypts an envelope addressed to this device; verifies the sender. */
export async function openForMe(envelope) {
  const me = getHandle();
  const keys = await getKeys();
  return open(envelope, { ecdhPrivate: keys.ecdh.privateKey, me, lookupSign: async (h) => (await lookupHandle(h))?.sign || null });
}

/** A raw signed fetch (for streaming). The caller reads the Response itself. */
export async function signedFetch(method, path, { body, signal } = {}) {
  const handle = await ensureHandle();
  const keys = await getKeys();
  const headers = { Authorization: await authHeader({ handle, signPrivate: keys.sign.privateKey, method, path: `/api${path}` }) };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(`${base()}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store', signal });
}

export { newMessageId, authHeader };
export const signedCall = (method, path, handle, body) => call(method, path, { body, auth: handle });
