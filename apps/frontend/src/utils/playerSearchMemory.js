// The player search bar's memory: the last query (kept until the user erases
// it), the last five searches, and the five most-searched. Device-local only —
// localStorage, never sent anywhere — like every other history on Truegle.

const KEY = 'truegle_player_search_v1';
const KEEP = 5;
// Enough history to rank "top" honestly without the counts growing forever.
const MAX_COUNTED = 40;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return {
      last: typeof raw?.last === 'string' ? raw.last : '',
      recent: Array.isArray(raw?.recent) ? raw.recent.filter((q) => typeof q === 'string') : [],
      counts: raw?.counts && typeof raw.counts === 'object' ? raw.counts : {},
    };
  } catch {
    return { last: '', recent: [], counts: {} };
  }
}

function save(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode — memory just won't stick */ }
}

const norm = (q) => String(q || '').trim().replace(/\s+/g, ' ');

// The same "Save search history" switch in Settings that the page's search bar
// honours. Off means nothing is remembered — not the last query, not the lists.
const historyOff = () => {
  try { return JSON.parse(localStorage.getItem('truegle_settings') || '{}').saveHistory === false; } catch { return false; }
};

export function lastQuery() {
  return load().last;
}

/** Remember what is in the box right now; '' means the user erased it. */
export function setLastQuery(q) {
  if (historyOff()) return;
  const m = load();
  const next = String(q || '');
  if (m.last === next) return;
  save({ ...m, last: next });
}

/** A search the user actually made — feeds both lists. */
export function recordSearch(q) {
  const query = norm(q);
  if (query.length < 2 || historyOff()) return;
  const m = load();
  const key = query.toLowerCase();
  const recent = [query, ...m.recent.filter((r) => r.toLowerCase() !== key)].slice(0, KEEP);
  const counts = { ...m.counts, [key]: { q: query, n: (m.counts[key]?.n || 0) + 1 } };
  const ranked = Object.entries(counts).sort((a, b) => b[1].n - a[1].n);
  save({ ...m, recent, counts: Object.fromEntries(ranked.slice(0, MAX_COUNTED)) });
}

export function searchMemory() {
  const m = load();
  const recent = m.recent.slice(0, KEEP);
  const top = Object.values(m.counts)
    .sort((a, b) => b.n - a.n)
    .map((c) => c.q)
    .slice(0, KEEP);
  return { recent, top };
}

export function clearSearchMemory() {
  const m = load();
  save({ ...m, recent: [], counts: {} });
}
