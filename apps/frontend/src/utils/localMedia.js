// YOUR OWN MEDIA, KEPT ON THIS DEVICE.
//
// Pick an audio or video file once (the paperclip in the Tube bar) and it stays in the
// player: the file is stored in this browser's IndexedDB, and the queue, lists and
// history refer to it by a small id — `tglocal:<id>` — instead of a URL that dies with
// the tab. It plays from the device every time, works offline, and is never uploaded
// or reported anywhere (the player skips its diagnostics for local items).
//
// If a file can no longer be read (removed from the library, or the browser cleared its
// storage) `resolveLocal` says so and the player shows a plain message rather than a
// dead frame.

const DB = 'truegle-media';
const STORE = 'files';
export const LOCAL_PREFIX = 'tglocal:';

export const isLocalSrc = (src) => typeof src === 'string' && src.startsWith(LOCAL_PREFIX);

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no storage')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** @returns 'audio' | 'video' | null */
export function localKind(file) {
  const t = file?.type || '';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(file?.name || '')) return 'audio';
  if (/\.(mp4|m4v|webm|mov|mkv|ogv)$/i.test(file?.name || '')) return 'video';
  return null;
}

/**
 * Stores a picked file and returns the player source for it.
 * @returns {Promise<{kind, src, title, local: true}>}
 */
export async function saveLocalFile(file) {
  const kind = localKind(file);
  if (!kind) throw new Error('That is not an audio or video file.');
  const id = uid();
  await tx('readwrite', (s) => s.put({
    id, name: file.name, type: file.type, size: file.size, kind, addedAt: Date.now(), blob: file,
  }));
  // Ask the browser not to evict it under storage pressure. A no-op where unsupported.
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  return { kind, src: LOCAL_PREFIX + id, title: file.name.replace(/\.[^.]+$/, ''), local: true };
}

/**
 * Keeps a copy of a DIRECT audio/video link (an .mp3, .mp4, a podcast or archive file…) on this
 * device so it plays with no connection. Embedded players (YouTube, Vimeo, TikTok…) can't be
 * saved by any app — they only exist inside the provider's own player — and some hosts forbid
 * cross-site downloads; both come back as a plain message.
 */
export async function saveRemoteMedia(src, title = 'Saved media') {
  let res;
  try { res = await fetch(src, { mode: 'cors' }); } catch { throw new Error('That site does not allow saving its media to this device.'); }
  if (!res.ok) throw new Error('The source refused the download.');
  const blob = await res.blob();
  const guess = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\?|#|$)/i.test(src) ? 'audio/mpeg' : 'video/mp4';
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guess;
  if (!type.startsWith('audio/') && !type.startsWith('video/')) throw new Error('That link is not an audio or video file.');
  const ext = type.startsWith('audio/') ? 'mp3' : 'mp4';
  const clean = String(title).replace(/[^\w .()-]+/g, '').trim().slice(0, 80) || 'Saved media';
  const saved = await saveLocalFile(new File([blob], `${clean}.${ext}`, { type }));
  window.dispatchEvent(new Event('truegle-local-media'));
  return saved;
}

export async function listLocalFiles() {
  const rows = await tx('readonly', (s) => s.getAll());
  return (rows || []).map(({ blob: _blob, ...meta }) => meta).sort((a, b) => b.addedAt - a.addedAt);
}

export async function removeLocalFile(src) {
  const id = String(src).slice(LOCAL_PREFIX.length);
  await tx('readwrite', (s) => s.delete(id));
  const url = urls.get(id);
  if (url) { URL.revokeObjectURL(url); urls.delete(id); }
}

const urls = new Map();

/** A playable object URL for a stored file, or null if it is gone. */
export async function resolveLocal(src) {
  const id = String(src).slice(LOCAL_PREFIX.length);
  if (urls.has(id)) return urls.get(id);
  let row = null;
  try { row = await tx('readonly', (s) => s.get(id)); } catch { return null; }
  if (!row?.blob) return null;
  const url = URL.createObjectURL(row.blob);
  urls.set(id, url);
  return url;
}
