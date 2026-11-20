// MULTI-HOP BLUETOOTH RELAY — phones carry each other's sealed messages onward.
//
// A message is end-to-end encrypted (seal.js) before it leaves the sender, so every phone that
// carries it sees only: a random message id, a hash of the destination name, a hop counter and
// scrambled bytes. Relays cannot read it, change it, or tell who sent it.
//
// Only phones running the Truegle app can relay. A message is flooded to every phone in range with a
// hop limit, and kept ("store and carry") for 24 hours so it can be handed to phones that come into
// range later — which is how it reaches someone who is not connected to anyone right now.
//
// BLE packet (<= 180 bytes):  [0x52][msg id 6][index 1][total 1][ttl 1][payload ...]
// Reassembled payload:        [destination hash 8][sealed envelope bytes]

import { meshOn, meshSendChunks } from './native';
import { b64u, unb64u } from './seal';
import { getHandle, openForMe, sealFor } from './identity';
import { addIncoming } from './mailbox';

export const RELAY_MAGIC = 0x52;
export const HEADER = 10;
export const MAX_PACKET = 180;
export const DATA_PER_PACKET = MAX_PACKET - HEADER; // 170
export const MAX_TTL = 6;
export const CARRY_TTL_MS = 24 * 60 * 60 * 1000;
export const CARRY_MAX = 50;
export const MAX_ENVELOPE_BYTES = 900;       // refuse to relay bigger blobs (keeps every hop quick and cheap)
const REASSEMBLE_MS = 60 * 1000;
const SEEN_MAX = 400;
const PEER_FRESH_MS = 45 * 1000;
const LS = { on: 'truegle_relay_on', carry: 'truegle_relay_carry' };

const readLs = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeLs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };

export const relayEnabled = () => readLs(LS.on, false) === true;
export const setRelayEnabled = (v) => writeLs(LS.on, !!v);

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────────────────

/** 8-byte hash of a handle, so relays can route without learning who it is for. */
export async function handleHash(handle) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`truegle-dest:${handle}`));
  return new Uint8Array(d).slice(0, 8);
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Splits a payload into BLE packets. @returns {Uint8Array[]} */
export function packetize(msgId, ttl, payload) {
  const total = Math.max(1, Math.ceil(payload.length / DATA_PER_PACKET));
  if (total > 255) throw new Error('too big to relay');
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const part = payload.subarray(i * DATA_PER_PACKET, (i + 1) * DATA_PER_PACKET);
    const p = new Uint8Array(HEADER + part.length);
    p[0] = RELAY_MAGIC; p.set(msgId, 1); p[7] = i; p[8] = total; p[9] = ttl;
    p.set(part, HEADER);
    out.push(p);
  }
  return out;
}

export const isRelayPacket = (u8) => !!u8 && u8.length > HEADER && u8[0] === RELAY_MAGIC;
const idKey = (u8) => b64u(u8.slice(1, 7));

/**
 * Reassembles packets into messages. `feed()` returns { id, ttl, payload } once the last piece
 * arrives, else null. Incomplete messages are dropped after REASSEMBLE_MS.
 */
export function makeAssembler(now = () => Date.now()) {
  const parts = new Map();
  return {
    feed(u8) {
      if (!isRelayPacket(u8)) return null;
      const key = idKey(u8); const index = u8[7]; const total = u8[8]; const ttl = u8[9];
      if (total === 0 || index >= total) return null;
      const t = now();
      for (const [k, v] of parts) if (t - v.at > REASSEMBLE_MS) parts.delete(k);
      let e = parts.get(key);
      if (!e) { e = { at: t, total, ttl, got: new Map() }; parts.set(key, e); }
      if (e.total !== total) return null;
      e.got.set(index, u8.slice(HEADER));
      if (e.got.size < e.total) return null;
      parts.delete(key);
      const chunks = [...e.got.keys()].sort((a, b) => a - b).map((i) => e.got.get(i));
      const payload = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let o = 0; for (const c of chunks) { payload.set(c, o); o += c.length; }
      return { id: key, ttl: e.ttl, payload };
    },
    size: () => parts.size,
  };
}

/** Decides what to do with a reassembled message. Pure. */
export function route({ ttl, destHash, myHash, seen, id }) {
  if (seen.has(id)) return 'drop';
  if (myHash && same(destHash, myHash)) return 'deliver';
  return ttl > 1 ? 'forward' : 'drop';
}

export const pruneCarry = (list, now = Date.now()) => list.filter((m) => now - m.at < CARRY_TTL_MS).slice(-CARRY_MAX);

// ── Runtime ──────────────────────────────────────────────────────────────────────────────

const state = {
  peers: new Map(),   // fingerprint -> last seen ms
  seen: [],           // message ids already handled (ring)
  asm: makeAssembler(),
  stops: [],
  myHash: null,
  listeners: new Set(),
};
export const onRelayChange = (f) => { state.listeners.add(f); return () => state.listeners.delete(f); };
const emit = () => state.listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });

const markSeen = (id) => { state.seen = [...state.seen.filter((x) => x !== id), id].slice(-SEEN_MAX); };
const getCarry = () => pruneCarry(readLs(LS.carry, []));
const setCarry = (c) => writeLs(LS.carry, pruneCarry(c));
export const relayStats = () => ({ carrying: getCarry().length, peers: [...state.peers.values()].filter((t) => Date.now() - t < PEER_FRESH_MS).length });

const freshPeers = () => [...state.peers.entries()].filter(([, t]) => Date.now() - t < PEER_FRESH_MS).map(([fp]) => fp);

async function sendPackets(fp, id, ttl, payload) {
  const packets = packetize(unb64u(id), ttl, payload);
  try { await meshSendChunks(fp, packets); return true; } catch { return false; }
}

/** Hands a carried message to peers that have not got it yet (and are in range now). */
async function pushCarry() {
  const carry = getCarry();
  let dirty = false;
  for (const m of carry) {
    if (m.ttl <= 0) continue;
    for (const fp of freshPeers()) {
      if (m.sentTo?.includes(fp)) continue;
      if (await sendPackets(fp, m.id, m.ttl, unb64u(m.payload))) { m.sentTo = [...(m.sentTo || []), fp]; dirty = true; }
    }
  }
  if (dirty) setCarry(carry);
}

async function onPackets(bytes) {
  const done = state.asm.feed(bytes);
  if (!done) return;
  const { id, ttl, payload } = done;
  if (payload.length <= 8 || payload.length > 8 + MAX_ENVELOPE_BYTES) return;
  const verdict = route({ ttl, destHash: payload.slice(0, 8), myHash: state.myHash, seen: new Set(state.seen), id });
  if (verdict === 'drop') return;
  markSeen(id);
  if (verdict === 'deliver') {
    try {
      const o = await openForMe(b64u(payload.slice(8)));
      addIncoming(o.from, { id: o.id, from: o.from, x: o.text, at: o.at || Date.now(), via: 'relay' });
      emit();
    } catch { /* forged or corrupt: dropped */ }
    return;
  }
  // forward: carry it for 24 h and hand it to everyone in range now
  const carry = getCarry();
  carry.push({ id, ttl: ttl - 1, payload: b64u(payload), at: Date.now(), sentTo: [] });
  setCarry(carry);
  emit();
  pushCarry();
}

/** Sends `text` to `toHandle` through whatever phones are in range. @returns the message id */
export async function sendViaRelay(toHandle, text, sealed) {
  const { envelope, id: msgId } = sealed || await sealFor(toHandle, text);
  const env = unb64u(envelope);
  if (env.length > MAX_ENVELOPE_BYTES) throw new Error('That message is too long to relay over Bluetooth.');
  const hash = await handleHash(toHandle.toLowerCase());
  const payload = new Uint8Array(8 + env.length);
  payload.set(hash, 0); payload.set(env, 8);
  const rid = b64u(globalThis.crypto.getRandomValues(new Uint8Array(6)));
  markSeen(rid);
  const carry = getCarry();
  carry.push({ id: rid, ttl: MAX_TTL, payload: b64u(payload), at: Date.now(), sentTo: [], own: msgId });
  setCarry(carry);
  await pushCarry();
  emit();
  return msgId;
}

/** Starts listening for relay packets and peers. Safe to call repeatedly. Returns stop(). */
export async function startRelay() {
  if (state.stops.length) return stopRelay;
  state.myHash = getHandle() ? await handleHash(getHandle()) : null;
  const offData = await meshOn('data', (d) => { if (isRelayPacket(d.bytes)) onPackets(d.bytes); });
  const offPeer = await meshOn('peer', (p) => {
    const fresh = !state.peers.has(p.peer) || Date.now() - state.peers.get(p.peer) > PEER_FRESH_MS;
    state.peers.set(p.peer, Date.now());
    if (fresh) pushCarry(); // a phone just came into range: give it what we are carrying
  });
  const timer = setInterval(() => { setCarry(getCarry()); emit(); }, 60000);
  state.stops = [offData, offPeer, () => clearInterval(timer)];
  return stopRelay;
}
export function stopRelay() {
  state.stops.forEach((s) => { try { s(); } catch { /* ignore */ } });
  state.stops = [];
}
