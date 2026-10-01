// THE SEARCH BAR'S HISTORY — one list, in this browser only.
//
// It lived inside SearchBar as a 10-entry list of which five were ever shown,
// with no way to remove one entry or empty it from the bar. "I hate retyping
// over and over" (owner, 2026-10-01): the dropdown now offers all of it, and
// each entry can be removed.
//
// Same storage key and shape as before (an array of strings, newest first), so
// history people already have is still there, and Settings' "clear history"
// still empties it. Never sent anywhere.
const KEY = 'truegle_recent_searches';
export const HISTORY_MAX = 50;

const settingsAllowHistory = () => {
  try { return JSON.parse(localStorage.getItem('truegle_settings') || '{}').saveHistory !== false; } catch { return true; }
};

export function getHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch { /* private mode */ } };

/** Remember a search. Respects "save search history: off"; never keeps a pasted link. */
export function addHistory(query) {
  const q = String(query || '').trim();
  if (q.length < 2 || !settingsAllowHistory()) return;
  // A link is something to open, not a search worth offering back — and a long
  // tracking-laden URL is the last thing to leave in a dropdown.
  if (/^(https?:\/\/|www\.)/i.test(q)) return;
  write([q, ...getHistory().filter((s) => s.toLowerCase() !== q.toLowerCase())]);
}

export function removeHistory(query) {
  const q = String(query || '').toLowerCase();
  write(getHistory().filter((s) => s.toLowerCase() !== q));
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
