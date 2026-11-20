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

import { computeBudget, fits, formatBytes, partitionList } from './offlineBudget';

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
export async function saveLocalFile(file, origin = '') {
  const kind = localKind(file);
  if (!kind) throw new Error('That is not an audio or video file.');
  // Ask the browser not to evict it under storage pressure. A no-op where unsupported.
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  const budget = await storageBudget();
  if (!fits(file.size, budget.usable)) throw new NoSpaceError(file.size, budget);
  const id = uid();
  try {
    await tx('readwrite', (s) => s.put({
      id, name: file.name, type: file.type, size: file.size, kind, addedAt: Date.now(), blob: file,
      ...(origin ? { origin } : {}),
    }));
  } catch (e) {
    if (e?.name === 'QuotaExceededError') throw new NoSpaceError(file.size, budget);
    throw e;
  }
  if (origin) offlineIndex.set(origin, LOCAL_PREFIX + id);
  return { kind, src: LOCAL_PREFIX + id, title: file.name.replace(/\.[^.]+$/, ''), local: true };
}

// ── Storage budget ───────────────────────────────────────────────────────────────────────

export class NoSpaceError extends Error {
  constructor(size, budget) {
    super(`Not enough free space on this device${budget?.known ? ` (${formatBytes(budget.usable)} usable, this needs ${formatBytes(size)})` : ''}.`);
    this.name = 'NoSpaceError';
    this.noSpace = true;
  }
}

/** Bytes this browser may still spend on saved media. Unknown storage reports Infinity. */
export async function storageBudget() {
  try { return computeBudget(await navigator.storage?.estimate?.()); }
  catch { return computeBudget(undefined); }
}

/** Total bytes of media kept for offline play, and how many files. */
export async function offlineUsage() {
  let files = [];
  try { files = await listLocalFiles(); } catch { /* no storage */ }
  return { count: files.length, bytes: files.reduce((n, f) => n + (f.size || 0), 0) };
}

// ── Remote link → local copy ─────────────────────────────────────────────────────────────
// A list item keeps its original URL (so a shared list still works for other people). When a
// copy exists on this device, the player is pointed at it instead — see `offlineSrc`.

const offlineIndex = new Map(); // origin URL → tglocal:<id>
let indexLoaded = false;
let indexLoading = false;

export async function refreshOfflineIndex() {
  indexLoading = true;
  try {
    const rows = await tx('readonly', (s) => s.getAll());
    offlineIndex.clear();
    for (const r of rows || []) if (r.origin) offlineIndex.set(r.origin, LOCAL_PREFIX + r.id);
    indexLoaded = true;
  } catch { /* no storage */ }
  try { window.dispatchEvent(new Event('truegle-offline-index')); } catch { /* ssr */ }
}

/** The on-device copy of `src` if there is one, else `src` unchanged. Sync, so it is safe in render. */
export function offlineSrc(src) {
  if (!indexLoaded && !indexLoading) refreshOfflineIndex();
  return offlineIndex.get(src) || src;
}

export const hasOfflineCopy = (src) => offlineIndex.has(src);
export const offlineOrigins = () => new Set(offlineIndex.keys());

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
  // Refuse before downloading a file that cannot fit, when the host tells us its size.
  const announced = Number(res.headers.get('content-length'));
  const budget = await storageBudget();
  if (announced && !fits(announced, budget.usable)) { try { res.body?.cancel(); } catch { /* ignore */ } throw new NoSpaceError(announced, budget); }
  const blob = await res.blob();
  const guess = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\?|#|$)/i.test(src) ? 'audio/mpeg' : 'video/mp4';
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guess;
  if (!type.startsWith('audio/') && !type.startsWith('video/')) throw new Error('That link is not an audio or video file.');
  const ext = type.startsWith('audio/') ? 'mp3' : 'mp4';
  const clean = String(title).replace(/[^\w .()-]+/g, '').trim().slice(0, 80) || 'Saved media';
  const saved = await saveLocalFile(new File([blob], `${clean}.${ext}`, { type }), src);
  window.dispatchEvent(new Event('truegle-local-media'));
  window.dispatchEvent(new Event('truegle-offline-index'));
  return saved;
}

/**
 * Saves every directly-playable item of a list that is not already on the device, in list order,
 * until the storage budget runs out. Embeds are counted as online-only, never attempted.
 * @param {Array} items list items ({src, kind, title})
 * @param {(p: {done: number, total: number, title: string}) => void} [onProgress]
 * @returns {Promise<{saved: number, already: number, online: number, failed: number, noSpace: number}>}
 */
export async function saveListOffline(items, onProgress) {
  await refreshOfflineIndex();
  const { todo, already, online } = partitionList(items, offlineOrigins());
  const out = { saved: 0, already: already.length, online: online.length, failed: 0, noSpace: 0 };
  for (let i = 0; i < todo.length; i += 1) {
    const it = todo[i];
    onProgress?.({ done: i, total: todo.length, title: it.title || it.src });
    try {
      await saveRemoteMedia(it.src, it.title);
      out.saved += 1;
    } catch (e) {
      if (e?.noSpace) { out.noSpace = todo.length - i; break; } // later files will not fit either
      out.failed += 1;
    }
  }
  onProgress?.({ done: todo.length, total: todo.length, title: '' });
  return out;
}

/** One plain sentence describing a `saveListOffline` result. */
export function describeSave(r) {
  const bits = [];
  if (r.saved) bits.push(`${r.saved} saved`);
  if (r.already) bits.push(`${r.already} already on this device`);
  if (r.online) bits.push(`${r.online} online-only (embedded players can't be saved)`);
  if (r.failed) bits.push(`${r.failed} couldn't be saved`);
  if (r.noSpace) bits.push(`${r.noSpace} left out — out of space`);
  return bits.length ? `${bits.join(', ')}.` : 'Nothing to save.';
}

/**
 * Desktop browsers that support the File System Access API can ALSO write the saved songs into a
 * folder the user picks, together with a tiny index.html that plays them with no connection — an
 * "offline media page" the user owns. Returns false where the API is missing or the picker is
 * cancelled; the in-browser copy is unaffected either way.
 */
export const canSaveToFolder = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function saveToFolder(title = 'Truegle offline') {
  if (!canSaveToFolder()) return false;
  let dir;
  try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch { return false; }
  const files = await tx('readonly', (s) => s.getAll());
  const entries = [];
  for (const row of files || []) {
    if (!row.blob) continue;
    const ext = (row.name.match(/\.[^.]+$/) || [''])[0] || (row.kind === 'audio' ? '.mp3' : '.mp4');
    const fname = `${row.id}${ext}`;
    const fh = await dir.getFileHandle(fname, { create: true });
    const w = await fh.createWritable();
    await w.write(row.blob);
    await w.close();
    entries.push({ fname, name: row.name.replace(/\.[^.]+$/, ''), kind: row.kind });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = entries.map((e) => `<li><p>${esc(e.name)}</p><${e.kind === 'video' ? 'video' : 'audio'} controls preload="none" src="${esc(e.fname)}"></${e.kind === 'video' ? 'video' : 'audio'}></li>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px system-ui;background:#0b0b0f;color:#eee;max-width:640px;margin:2rem auto;padding:0 1rem}li{list-style:none;margin:1rem 0}audio,video{width:100%}</style>
<h1>${esc(title)}</h1><ul>${rows}</ul>`;
  const ih = await dir.getFileHandle('index.html', { create: true });
  const iw = await ih.createWritable();
  await iw.write(html);
  await iw.close();
  return entries.length;
}

export async function listLocalFiles() {
  const rows = await tx('readonly', (s) => s.getAll());
  return (rows || []).map(({ blob: _blob, ...meta }) => meta).sort((a, b) => b.addedAt - a.addedAt);
}

export async function removeLocalFile(src) {
  const id = String(src).slice(LOCAL_PREFIX.length);
  await tx('readwrite', (s) => s.delete(id));
  for (const [k, v] of offlineIndex) if (v === LOCAL_PREFIX + id) offlineIndex.delete(k);
  try { window.dispatchEvent(new Event('truegle-offline-index')); } catch { /* ssr */ }
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
