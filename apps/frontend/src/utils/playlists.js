import { useSyncExternalStore } from 'react';
import { mediaKey } from './videoEmbed';

// Lists the user BUILT, kept apart from the queue.
//
// WHY THIS IS NOT THE QUEUE: the queue is scratch space. Things are pushed onto
// it, consumed off it, shuffled, and cleared — next() literally removes what it
// plays. So "the queue" could never be a playlist: playing it destroyed it, and
// because it is also what the player falls back to on launch, whatever happened
// to be left in it from a previous session became the default thing to play.
// That is the "queued videos are the default playback choice even when the
// queue has been wiped" report — the queue was being asked to be two things.
//
// A playlist here is named, ordered, additive, and consumed by COPYING into the
// queue (see enqueueMany), so playing one never empties it.
//
// Device-local, like the taste profile and the watch history. No account, no
// sync, no row on a server with someone's viewing habits in it.
const KEY = 'truegle_playlists_v1';
const CAP_LISTS = 50;
const CAP_ITEMS = 300;

const trim = (s) => ({
  key: mediaKey(s),
  src: s.src,
  kind: s.kind,
  title: s.title || '',
  pageUrl: s.pageUrl || '',
  poster: s.poster || '',
  channel: s.channel || '',
});

// An object URL is only valid inside the document that created it, so a device
// file cannot be saved to a list that is supposed to outlive the tab.
export const playlistable = (s) => !!s && typeof s.src === 'string' && !s.src.startsWith('blob:');

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p) => p && typeof p.id === 'string')
      .map((p) => ({
        id: p.id,
        name: typeof p.name === 'string' ? p.name : 'Untitled',
        createdAt: Number(p.createdAt) || Date.now(),
        items: Array.isArray(p.items) ? p.items.filter(playlistable).slice(0, CAP_ITEMS) : [],
      }))
      .slice(0, CAP_LISTS);
  } catch {
    return [];
  }
}

let lists = read();
let version = 0;
const listeners = new Set();

function commit(next) {
  lists = next.slice(0, CAP_LISTS);
  version += 1;
  try { localStorage.setItem(KEY, JSON.stringify(lists)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

const uid = () => `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** @returns the new playlist's id, or null if the name was blank. */
export function createPlaylist(name, items = []) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) return null;
  const id = uid();
  commit([...lists, { id, name: clean, createdAt: Date.now(), items: items.filter(playlistable).map(trim) }]);
  return id;
}

export function renamePlaylist(id, name) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) return;
  commit(lists.map((p) => (p.id === id ? { ...p, name: clean } : p)));
}

export function deletePlaylist(id) {
  commit(lists.filter((p) => p.id !== id));
}

/**
 * Add to a list, ignoring something already in it — a playlist with the same
 * track twice is nearly always a mis-tap, not an intention.
 * @returns true if it was added.
 */
export function addToPlaylist(id, source) {
  if (!playlistable(source)) return false;
  const list = lists.find((p) => p.id === id);
  if (!list) return false;
  const k = mediaKey(source);
  if (list.items.some((i) => i.key === k)) return false;
  commit(lists.map((p) => (p.id === id ? { ...p, items: [...p.items, trim(source)].slice(0, CAP_ITEMS) } : p)));
  return true;
}

export function removeFromPlaylist(id, index) {
  commit(lists.map((p) => (p.id === id ? { ...p, items: p.items.filter((_, i) => i !== index) } : p)));
}

/** Move an item one slot up or down. The whole of reordering, for two buttons. */
export function movePlaylistItem(id, index, delta) {
  commit(lists.map((p) => {
    if (p.id !== id) return p;
    const to = index + delta;
    if (to < 0 || to >= p.items.length) return p;
    const items = [...p.items];
    [items[index], items[to]] = [items[to], items[index]];
    return { ...p, items };
  }));
}

export const playlists = () => lists;
export const playlistById = (id) => lists.find((p) => p.id === id) || null;

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getVersion = () => version;
const serverVersion = () => 0;

/** Re-renders on any playlist change. */
export function usePlaylists() {
  useSyncExternalStore(subscribe, getVersion, serverVersion);
  return lists;
}
