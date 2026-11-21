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
const PARTIALS = 'partials'; // one row per unfinished download: { origin, title, got, total, type, modified }
const PARTS = 'parts';       // the downloaded pieces, keyed `${origin}\u0000${seq}` — stored as Blobs, so never held in memory
export const LOCAL_PREFIX = 'tglocal:';

export const isLocalSrc = (src) => typeof src === 'string' && src.startsWith(LOCAL_PREFIX);

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no storage')); return; }
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PARTIALS)) db.createObjectStore(PARTIALS, { keyPath: 'origin' });
      if (!db.objectStoreNames.contains(PARTS)) db.createObjectStore(PARTS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Runs `fn(transaction)` over one or more stores; resolves with fn's returned request's result. */
async function txm(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const out = fn(t);
    t.oncomplete = () => { db.close(); resolve(out?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}
const tx = (mode, fn, store = STORE) => txm(store, mode, (t) => fn(t.objectStore(store)));

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
export async function saveLocalFile(file, { origin } = {}) {
  const kind = localKind(file);
  if (!kind) throw new Error('That is not an audio or video file.');
  const id = uid();
  try {
    await tx('readwrite', (s) => s.put({
      id, name: file.name, type: file.type, size: file.size, kind, addedAt: Date.now(), blob: file,
      ...(origin ? { origin } : {}),
    }));
  } catch (e) {
    if (e?.name === 'QuotaExceededError') throw new FullError();
    throw e;
  }
  // Ask the browser not to evict it under storage pressure. A no-op where unsupported.
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  return { kind, src: LOCAL_PREFIX + id, title: file.name.replace(/\.[^.]+$/, ''), local: true };
}

export class FullError extends Error {
  constructor() { super('Not enough free space on this device. Remove some files and try again.'); this.name = 'FullError'; }
}

/** How full this browser's storage is. Fields are null where the browser can't say. */
export async function storageStatus() {
  let usage = null; let quota = null; let persisted = null;
  try { ({ usage, quota } = await navigator.storage.estimate()); } catch { /* unsupported */ }
  try { persisted = await navigator.storage.persisted(); } catch { /* unsupported */ }
  const free = usage != null && quota != null ? Math.max(0, quota - usage) : null;
  return { usage, quota, free, persisted };
}

// Keep a little room back so the browser (and the rest of the app) never hits a hard wall.
const HEADROOM = 20e6;
async function assertRoom(bytes) {
  const { free } = await storageStatus();
  if (free != null && bytes && bytes > free - HEADROOM) throw new FullError();
}

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\?|#|$)/i;

const FLUSH_AT = 4e6; // write a piece to disk every ~4 MB, so progress survives a cancel, a crash or a dropped connection
const partKey = (origin, seq) => `${origin}\u0000${String(seq).padStart(6, '0')}`;
const partRange = (origin) => IDBKeyRange.bound(`${origin}\u0000`, `${origin}\u0000\uffff`);

const getPartial = (origin) => tx('readonly', (s) => s.get(origin), PARTIALS).catch(() => null);

/** Downloads that were started but not finished — they can be resumed. */
export async function listPartials() {
  const rows = await tx('readonly', (s) => s.getAll(), PARTIALS).catch(() => []);
  return (rows || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Throws a half-finished download away and frees its space. */
export async function discardPartial(origin) {
  await txm([PARTIALS, PARTS], 'readwrite', (t) => {
    t.objectStore(PARTIALS).delete(origin);
    return t.objectStore(PARTS).delete(partRange(origin));
  }).catch(() => {});
  window.dispatchEvent(new Event('truegle-local-media'));
}

/**
 * Downloads `src` in pieces kept on disk. If a partial exists it asks the server for just the rest
 * (`Range: bytes=N-`, a header browsers allow cross-site without a permission round-trip). If the
 * server ignores that, or the file changed since, it starts over. Returns the finished Blob.
 */
async function download(src, title, { signal, onProgress }) {
  let part = await getPartial(src);
  const start = part?.got || 0;
  let res;
  try { res = await fetch(src, { mode: 'cors', signal, ...(start ? { headers: { Range: `bytes=${start}-` } } : {}) }); }
  catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new Error('That site does not allow saving its media to this device.');
  }
  if (!res.ok) throw new Error('The source refused the download.');
  const len = Number(res.headers.get('content-length')) || 0;
  const modified = res.headers.get('last-modified') || '';
  const resumed = start > 0 && res.status === 206 && len > 0 && start + len === part.total && (!part.modified || !modified || part.modified === modified);
  if (start && !resumed) { await discardPartial(src); part = null; } // restart cleanly
  const base = resumed ? start : 0;
  const total = resumed ? part.total : len;
  await assertRoom(resumed ? len : total);
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }

  const type = (res.headers.get('content-type') || '').split(';')[0];
  const meta = { origin: src, title, got: base, total, type, modified, updatedAt: Date.now() };
  let seq = resumed ? (await txm(PARTS, 'readonly', (t) => t.objectStore(PARTS).count(partRange(src)))) : 0;
  let pending = []; let pendingBytes = 0; let got = base;
  let free = (await storageStatus()).free;
  const flush = async () => {
    if (!pendingBytes) return;
    const blob = new Blob(pending, { type });
    meta.got = got; meta.updatedAt = Date.now();
    pending = []; pendingBytes = 0;
    try {
      await txm([PARTIALS, PARTS], 'readwrite', (t) => {
        t.objectStore(PARTS).put(blob, partKey(src, seq++));
        return t.objectStore(PARTIALS).put(meta);
      });
    } catch (e) { throw e?.name === 'QuotaExceededError' ? new FullError() : e; }
  };

  if (!res.body?.getReader) { // old browser: no streaming, so no progress or resume
    const blob = await res.blob();
    onProgress?.(blob.size, blob.size);
    return blob;
  }
  const reader = res.body.getReader();
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      pending.push(value); pendingBytes += value.byteLength; got += value.byteLength;
      if (!total && free != null && got - base > free - HEADROOM) throw new FullError(); // size unknown: watch as it grows
      onProgress?.(got, total);
      if (pendingBytes >= FLUSH_AT) await flush();
    }
    await flush();
  } catch (e) {
    reader.cancel().catch(() => {});
    if (e?.name === 'FullError') { await discardPartial(src); throw e; } // no room: don't keep hogging what little there is
    await flush().catch(() => {});                                       // cancel / lost connection: keep what arrived
    window.dispatchEvent(new Event('truegle-local-media'));
    throw e;
  }
  if (total && got !== total) throw new Error('The download stopped early. Try again to continue it.');
  // Join the stored pieces. They are Blob references, so this does not copy the file into memory.
  const rows = await txm(PARTS, 'readonly', (t) => t.objectStore(PARTS).getAll(partRange(src)));
  return new Blob(rows, { type });
}

/**
 * Keeps a copy of a DIRECT audio/video link (an .mp3, .mp4, a podcast or archive file…) on this
 * device so it plays with no connection. Embedded players (YouTube, Vimeo, TikTok…) can't be
 * saved by any app — they only exist inside the provider's own player — and some hosts forbid
 * cross-site downloads; both come back as a plain message.
 *
 * `onProgress(received, total)` drives a meter (total is 0 when the host doesn't say); `signal`
 * pauses it, and calling this again for the same link CONTINUES from where it stopped. A file
 * that won't fit is refused up front; a link already saved is returned as-is.
 */
export async function saveRemoteMedia(src, title = 'Saved media', { signal, onProgress } = {}) {
  const existing = await findByOrigin(src);
  if (existing) return { kind: existing.kind, src: LOCAL_PREFIX + existing.id, title, local: true, already: true };
  const blob = await download(src, title, { signal, onProgress });
  const guess = AUDIO_EXT.test(src) ? 'audio/mpeg' : 'video/mp4';
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guess;
  if (!type.startsWith('audio/') && !type.startsWith('video/')) {
    await discardPartial(src);
    throw new Error('That link is not an audio or video file.');
  }
  const ext = type.startsWith('audio/') ? 'mp3' : 'mp4';
  const clean = String(title).replace(/[^\w .()-]+/g, '').trim().slice(0, 80) || 'Saved media';
  const saved = await saveLocalFile(new File([blob], `${clean}.${ext}`, { type }), { origin: src });
  await discardPartial(src); // fires the refresh event too
  return saved;
}

/**
 * Saves a whole list of tracks, one at a time, until it runs out of free space.
 * `onProgress({ index, count, title, received, total })`; `signal` cancels between/within files.
 * @returns {{ saved, already, failed, skipped, full, cancelled }} counts
 */
export async function saveManyRemote(items, { signal, onProgress } = {}) {
  const todo = items.filter((it) => (it.kind === 'audio' || it.kind === 'video') && it.src && !isLocalSrc(it.src));
  const out = { saved: 0, already: 0, failed: 0, skipped: items.length - todo.length, full: false, cancelled: false };
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    try {
      const r = await saveRemoteMedia(it.src, it.title, {
        signal,
        onProgress: (received, total) => onProgress?.({ index: i + 1, count: todo.length, title: it.title, received, total }),
      });
      if (r.already) out.already++; else out.saved++;
    } catch (e) {
      if (e?.name === 'AbortError') { out.cancelled = true; break; }
      if (e?.name === 'FullError') { out.full = true; out.skipped += todo.length - i; break; }
      out.failed++;
    }
  }
  return out;
}

async function findByOrigin(origin) {
  const rows = await tx('readonly', (s) => s.getAll()).catch(() => []);
  return (rows || []).find((r) => r.origin === origin) || null;
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

const safeName = (n) => String(n).replace(/[\\/:*?"<>|]+/g, '_');

/**
 * A backup copy of everything saved here, because a browser storage clear erases it with no undo.
 * Writes into a folder you pick where the browser allows it; otherwise downloads the files one by one.
 * Reads one file at a time so a big library never has to sit in memory together.
 * @returns {Promise<{count:number, method:'folder'|'downloads'}>}
 */
export async function exportLocalFiles(onProgress) {
  const files = await listLocalFiles();
  if (!files.length) return { count: 0, method: 'downloads' };
  let dir = null;
  if (typeof window.showDirectoryPicker === 'function') {
    try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); }
    catch (e) { if (e?.name === 'AbortError') throw e; /* blocked: fall back to downloads */ }
  }
  const used = new Set();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const row = await tx('readonly', (s) => s.get(f.id));
    if (!row?.blob) continue;
    let name = safeName(f.name); let n = 1;
    while (used.has(name)) name = safeName(f.name).replace(/(\.[^.]*)?$/, ` (${++n})$1`);
    used.add(name);
    onProgress?.(i + 1, files.length, name);
    if (dir) {
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await w.write(row.blob); await w.close();
    } else {
      const url = URL.createObjectURL(row.blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      await new Promise((r) => setTimeout(r, 400)); // let the browser start each download
      URL.revokeObjectURL(url);
    }
  }
  return { count: files.length, method: dir ? 'folder' : 'downloads' };
}

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
