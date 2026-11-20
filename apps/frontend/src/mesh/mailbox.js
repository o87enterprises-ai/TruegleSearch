// INTERNET MESSAGES through the ciphertext mailbox (backend routes/mailbox.js).
//
// Send: the text is sealed (end-to-end encrypted + signed) ON THIS DEVICE, then dropped in the
// recipient's mailbox. If we are offline the sealed envelope waits in an outbox and goes out as
// soon as the connection is back (7 days at most). Receive: while the app is open a live stream
// delivers new envelopes at once; if the stream is unavailable we poll. Everything is opened and
// verified here — the server only ever holds scrambled bytes.

import { sealFor, openForMe, signedCall, signedFetch, getHandle, ensureHandle } from './identity';

const K = { outbox: 'truegle_inet_outbox', chats: 'truegle_inet_chats', seen: 'truegle_inet_seen' };
export const OUTBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CHAT_MAX = 300;
const SEEN_MAX = 500;
const POLL_MS = 20000;

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full/blocked */ } };

export const getChats = () => read(K.chats, {});
const saveChats = (c) => write(K.chats, c);
export const getOutbox = () => read(K.outbox, []);
const saveOutbox = (o) => write(K.outbox, o);

const listeners = new Set();
const changed = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
export const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };

/** Drops outbox entries older than the TTL. Pure. */
export const pruneOutbox = (items, now = Date.now()) => items.filter((m) => now - m.at < OUTBOX_TTL_MS);

/** Incremental Server-Sent-Events parser. Pure: returns the parsed events and the unconsumed rest. */
export function parseSse(buffer) {
  const events = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop();
  for (const block of parts) {
    let event = 'message'; let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (data || event !== 'message') events.push({ event, data });
  }
  return { events, rest };
}

function addToChat(peer, entry) {
  const chats = getChats();
  const list = chats[peer] || [];
  if (list.some((m) => m.id === entry.id)) return false;
  chats[peer] = [...list, entry].slice(-CHAT_MAX);
  saveChats(chats);
  return true;
}
function setStatus(peer, id, s) {
  const chats = getChats();
  chats[peer] = (chats[peer] || []).map((m) => (m.id === id ? { ...m, s } : m));
  saveChats(chats);
}

/** A message that arrived by another route (the Bluetooth relay). Returns false for a duplicate. */
export function addIncoming(peer, entry) {
  if (seenIds().has(entry.id)) return false;
  const added = addToChat(peer, entry);
  markSeen(entry.id);
  if (added) changed();
  return added;
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/** Seals `text` for `to`, shows it in the chat at once, and sends (or queues) it. */
export async function sendText(to, text, sealed) {
  const t = String(text || '').trim();
  if (!t) return null;
  // `sealed` lets the caller reuse ONE envelope for several routes (internet + Bluetooth relay); the
  // recipient de-duplicates by its message id.
  const { envelope, id } = sealed || await sealFor(to, t); // throws "No one with that name." for unknown handles
  const peer = to.toLowerCase();
  addToChat(peer, { id, from: 'me', x: t, at: Date.now(), s: 'queued' });
  saveOutbox([...getOutbox(), { id, to: peer, envelope, at: Date.now() }]);
  changed();
  flushOutbox();
  return id;
}

let flushing = false;
/** Sends everything waiting. Stops at the first network failure; drops anything the server rejects for good. */
export async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  try {
    saveOutbox(pruneOutbox(getOutbox()));
    for (const m of [...getOutbox()]) {
      let r;
      try {
        r = await fetchDrop(m);
      } catch { break; } // offline: keep the rest queued
      const keep = r.status >= 500 || r.status === 429; // try again later
      if (r.ok) setStatus(m.to, m.id, 'sent');
      else if (!keep) setStatus(m.to, m.id, 'failed');
      if (!keep) saveOutbox(getOutbox().filter((x) => x.id !== m.id));
      else break;
    }
  } finally { flushing = false; changed(); }
}

function fetchDrop(m) {
  const b = import.meta.env.VITE_BACKEND_URL;
  const base = b && b !== 'http://localhost:3001' ? `${b}/api` : '/api';
  return fetch(`${base}/mailbox/${encodeURIComponent(m.to)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
    body: JSON.stringify({ id: m.id, blob: m.envelope }),
  });
}

const seenIds = () => new Set(read(K.seen, []));
function markSeen(id) { const s = [...seenIds(), id].slice(-SEEN_MAX); write(K.seen, s); }

/** Fetches, opens and acknowledges everything waiting in our mailbox. Returns how many were new. */
export async function receive() {
  const me = getHandle() || await ensureHandle();
  const r = await signedCall('GET', '/mailbox', me);
  if (!r.ok) return 0;
  const msgs = r.data?.messages || [];
  const seen = seenIds();
  let added = 0;
  for (const m of msgs) {
    if (seen.has(m.id)) continue;
    try {
      const o = await openForMe(m.blob);
      if (addToChat(o.from, { id: m.id, from: o.from, x: o.text, at: o.at || Date.now() })) added += 1;
    } catch { /* not for us / forged / corrupt: drop it */ }
    markSeen(m.id);
  }
  if (msgs.length) signedCall('DELETE', '/mailbox', me, { ids: msgs.map((m) => m.id) }).catch(() => {});
  if (added) changed();
  return added;
}

// ── Live connection ──────────────────────────────────────────────────────────────────────

let stopFn = null;
/** Starts live delivery (stream with polling fallback) and outbox flushing. Idempotent. Returns stop(). */
export function startMailbox() {
  if (stopFn) return stopFn;
  let alive = true;
  let abort = null;
  let poll = null;
  let backoff = 2000;

  const tick = () => { if (isOnline()) { flushOutbox(); receive().catch(() => {}); } };

  async function stream() {
    while (alive) {
      if (!isOnline()) { await new Promise((r) => setTimeout(r, 3000)); continue; }
      abort = new AbortController();
      const startedAt = Date.now();
      try {
        const res = await signedFetch('GET', '/mailbox/stream', { signal: abort.signal });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        backoff = 2000;
        await receive().catch(() => {}); // catch up on anything that arrived while disconnected
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const p = parseSse(buf); buf = p.rest;
          if (p.events.some((e) => e.event === 'msg')) receive().catch(() => {});
        }
      } catch { /* fall through to backoff */ }
      if (!alive) return;
      // A stream that dies at once (e.g. a host without long connections) backs off; polling covers it.
      if (Date.now() - startedAt < 5000) backoff = Math.min(backoff * 2, 60000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  poll = setInterval(tick, POLL_MS);
  tick();
  stream();
  stopFn = () => {
    alive = false; abort?.abort(); clearInterval(poll); window.removeEventListener('online', tick);
    stopFn = null;
  };
  return stopFn;
}
