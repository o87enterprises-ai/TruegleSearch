// Nearby's local storage: your device name, saved devices, conversations (threads), and the
// outbox of messages waiting for someone to come back in range. All on this device; nothing is
// sent anywhere except directly to a phone over Bluetooth.

const K = {
  name: 'truegle_nearby_name',
  contacts: 'truegle_nearby_contacts', // { fp: { name, alias, last } }  name = what they call themselves, alias = what you call them
  threads: 'truegle_nearby_threads',   // { tid: { id, members:[fp], intro:{fp:true}, updated, unread } }  tid = 'dm:<fp>' or a group id
  chats: 'truegle_nearby_chats',       // { tid: [ { id, from:'me'|fp, x, at, s:{fp:'queued'|'delivered'|'expired'} } ] }
  outbox: 'truegle_nearby_outbox',     // [ { id, tid, to, x, at } ]
  hideGuide: 'truegle_nearby_hide_guide',
  offlineSince: 'truegle_offline_since',
};

export const NAME_MAX = 16;
export const CHAT_MAX = 200;
export const GROUP_MAX = 5;                         // other people in one conversation (6 phones total)
export const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000;   // queued messages are dropped after 24 h

const read = (k, d) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; }
};
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full/blocked */ } };

export const cleanName = (s) => Array.from(String(s || '')).filter((c) => c.charCodeAt(0) >= 32).join('').trim().slice(0, NAME_MAX);

export const getName = () => cleanName(read(K.name, ''));
export const saveName = (n) => write(K.name, cleanName(n));
export const getContacts = () => read(K.contacts, {});
export const saveContacts = (c) => write(K.contacts, c);
export const getThreads = () => read(K.threads, {});
export const saveThreads = (t) => write(K.threads, t);
export const getChats = () => read(K.chats, {});
export const saveChats = (c) => write(K.chats, c);
export const getOutbox = () => read(K.outbox, []);
export const saveOutbox = (o) => write(K.outbox, o);
export const getHideGuide = () => read(K.hideGuide, false) === true;
export const saveHideGuide = (v) => write(K.hideGuide, !!v);

// How long this device has been offline (survives leaving and reopening the page).
export const getOfflineSince = () => read(K.offlineSince, null);
export const saveOfflineSince = (t) => {
  try { if (t == null) localStorage.removeItem(K.offlineSince); else localStorage.setItem(K.offlineSince, JSON.stringify(t)); } catch { /* ignore */ }
};

export const newId = () => Math.random().toString(36).slice(2, 10);
export const dmId = (fp) => `dm:${fp}`;
export const membersKey = (m) => [...m].sort().join(',');

// BLE writes are small: keep each packet <= 180 bytes (the native limit).
export const MAX_PACKET = 180;
const enc = new TextEncoder();
export const byteLen = (s) => enc.encode(s).length;
export function maxTextBytes(name) {
  return MAX_PACKET - byteLen(JSON.stringify({ t: 'm', f: '0'.repeat(16), n: cleanName(name), i: '0'.repeat(8), g: 'g' + '0'.repeat(8), x: '' }));
}
export function fitText(s, max) {
  let t = s;
  while (t && byteLen(t) > max) t = t.slice(0, -1);
  return t;
}

// Signal strength (dBm) -> a friendly distance label and 1-4 bars.
export function proximity(rssi) {
  if (typeof rssi !== 'number') return { bars: 0, label: 'Unknown' };
  if (rssi >= -55) return { bars: 4, label: 'Very close' };
  if (rssi >= -67) return { bars: 3, label: 'Close' };
  if (rssi >= -80) return { bars: 2, label: 'Near' };
  return { bars: 1, label: 'Far' };
}
