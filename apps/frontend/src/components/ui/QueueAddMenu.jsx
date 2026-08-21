import { useState, useRef, useEffect, useCallback } from 'react';
import { HardDrive, Link2, Search, Loader2, Plus, Check } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { getPlayable } from '../../utils/videoEmbed';
import { resolveShareInput, titleFromUrl } from '../../utils/playerLink';
import { isPlaylistUrl, importPlaylist, importMessage } from '../../utils/playlistImport';

// The queue's "+" panel: three ways to feed the player.
//   Device — a local file, played from an object URL. Never uploaded.
//   Link   — a Truegle player link, or any URL the player can host.
//   Search — live search, filtered down to results that actually play in here.
//
// Nothing in here closes the panel. Building a queue means adding several
// things in a row, and auto-closing after the first one both broke that flow
// and caused a real bug: the panel unmounted under the user's finger, so the
// click that followed landed on whatever result card was underneath and
// navigated the page away — taking the in-memory queue with it. Adds are
// confirmed with a tick instead, and the queue now survives navigation
// (see PlayerContext).
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TABS = [
  { id: 'device', label: 'Device', icon: HardDrive },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'search', label: 'Search', icon: Search },
];

export default function QueueAddMenu() {
  const { enqueueMany } = usePlayer();
  const [tab, setTab] = useState('search');
  const [linkText, setLinkText] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(null);   // src of the last thing added
  // Pasting a whole playlist. Recognised HERE as well as in the list slot: the
  // "+" panel's Link tab is where somebody who has a URL in their clipboard
  // actually goes, and it used to answer a playlist link with "that link can't
  // play in here yet" — a refusal for something the app can, in fact, import.
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  // One place to add + confirm, so every path behaves identically and none of
  // them unmount the panel.
  const addSources = useCallback((sources, key) => {
    if (!sources.length) return;
    enqueueMany(sources);
    setAdded(key ?? sources[0].src);
    setTimeout(() => setAdded(null), 1600);
  }, [enqueueMany]);

  // ── Device ──────────────────────────────────────────────────────────────
  // Object URLs are deliberately not revoked while the session lives: the
  // queue may still hold the item. They die with the tab.
  const onFiles = (e) => {
    const picked = [...(e.target.files || [])];
    const sources = picked.map((f) => {
      const kind = f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : null;
      return kind ? { kind, src: URL.createObjectURL(f), title: f.name, local: true } : null;
    }).filter(Boolean);
    if (!sources.length) { setError('No playable audio or video in that selection.'); return; }
    addSources(sources);
    setError('');
  };

  // ── Link ────────────────────────────────────────────────────────────────
  const pastedPlaylist = isPlaylistUrl(linkText) ? linkText.trim() : '';
  useEffect(() => { setImported(null); }, [pastedPlaylist]);

  // A playlist becomes a LIST, not a queue full of loose tracks. That is the
  // difference the two things exist to draw: a list is yours and survives being
  // played, a queue is consumed.
  const addPlaylist = useCallback(async () => {
    if (!pastedPlaylist) return;
    setImporting(true);
    setError('');
    const result = await importPlaylist(pastedPlaylist);
    setImported(result);
    setImporting(false);
    if (result.ok) setLinkText('');
  }, [pastedPlaylist]);

  const addLink = () => {
    // A playlist URL that also names a video (…watch?v=X&list=Y) is genuinely
    // both. Import wins: the person pasted a list, and the single video is one
    // press away inside it.
    if (pastedPlaylist) { addPlaylist(); return; }
    const sources = resolveShareInput(linkText);
    if (!sources.length) {
      setError("That link can't play in here yet — YouTube, Vimeo, SoundCloud, a direct audio/video file, or a Truegle player link.");
      return;
    }
    addSources(sources);
    setLinkText('');
    setError('');
  };

  // ── Search ──────────────────────────────────────────────────────────────
  // Live: results propagate as you type. Debounced so a fast typist fires one
  // request instead of ten, and the previous request is aborted so a slow
  // early response can't overwrite a newer one.
  const runSearch = useCallback((q) => {
    abortRef.current?.abort();
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, filters: { category: 'videos', bias: 'all', dateRange: 'any', perPage: 20 } }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        // Only surface what the player can actually host — a search result
        // the queue can't play is noise.
        const playable = (d.results || []).map((r) => {
          const base = getPlayable(r.url);
          return base ? { ...base, title: r.title || titleFromUrl(r.url), pageUrl: r.url, poster: r.image } : null;
        }).filter(Boolean);
        setResults(playable);
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('Search is unreachable right now.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const q = query.trim();
    const id = setTimeout(() => runSearch(q), 300);
    return () => clearTimeout(id);
  }, [query, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const inputCls = 'flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/60';
  const goCls = 'px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs hover:bg-cyan-500/30 transition-colors';

  return (
    <div className="border-t border-white/10 bg-black/40">
      {/* Tabs — 44px-tall rows so they're thumb-sized on a phone */}
      <div className="flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-[11px] border-b-2 transition-colors ${
              tab === t.id ? 'border-cyan-400 text-white bg-white/5' : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-2.5">
        {tab === 'device' && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*"
              multiple
              onChange={onFiles}
              className="hidden"
            />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full min-h-[44px] rounded-lg border border-dashed border-white/25 text-xs text-white/70 hover:text-white hover:border-white/50 transition-colors">
              Choose audio or video from this device
            </button>
            <p className="mt-1.5 text-[10px] text-white/35 leading-tight">
              Plays straight off your device. Nothing is uploaded and nothing leaves this tab.
            </p>
          </div>
        )}

        {tab === 'link' && (
          <div>
            <div className="flex gap-1.5">
              <input
                value={linkText}
                onChange={(e) => { setLinkText(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }}
                placeholder="Paste a link or a Truegle player link"
                inputMode="url"
                className={inputCls}
              />
              <button type="button" onClick={addLink} disabled={importing} className={goCls}>
                {importing ? <Loader2 size={12} className="animate-spin" /> : (pastedPlaylist ? 'Import' : 'Add')}
              </button>
            </div>
            {/* Say what will happen BEFORE the press, not after. A playlist and
                a single video look alike in an address bar, and "Add" doing two
                different things without saying so is how the import came as a
                surprise the first time. */}
            {pastedPlaylist && !imported && (
              <p className="mt-1.5 text-[10px] text-cyan-200/70 leading-tight">
                That&apos;s a playlist — it will be saved as a list of its own, not
                poured into the queue.
              </p>
            )}
            {imported && (
              <p className={`mt-1.5 text-[10px] leading-tight ${imported.ok ? 'text-emerald-300/80' : 'text-amber-200/80'}`}>
                {importMessage(imported)}
              </p>
            )}
            <p className="mt-1.5 text-[10px] text-white/35 leading-tight">
              YouTube, Vimeo, SoundCloud, direct audio/video files, playlists, and any truegle.info/w link.
            </p>
          </div>
        )}

        {tab === 'search' && (
          <div>
            {/* No submit button: results arrive as you type. */}
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Start typing — results appear as you go"
                aria-label="Search for something to play"
                className={`${inputCls} w-full pr-8`}
              />
              {loading && (
                <Loader2 size={14} className="animate-spin text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {results && results.length === 0 && !loading && (
              <p className="mt-2 text-[11px] text-white/40">Nothing in those results can play in the Truegle player.</p>
            )}

            {results && results.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto -mx-1">
                {results.map((r) => (
                  <div key={r.pageUrl} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-white/5 transition-colors">
                    {r.poster
                      ? <img src={r.poster} alt="" className="w-10 h-7 rounded object-cover shrink-0"
                          onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                      : <span className="w-10 h-7 rounded bg-white/10 shrink-0" />}
                    <span className="text-[11px] text-white/75 line-clamp-2 flex-1 min-w-0">{r.title}</span>
                    {/* An explicit Add: the row itself is not a click target, so
                        there is nothing here that can be mistaken for "open
                        this result". stopPropagation keeps the tap inside the
                        player. */}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); addSources([r], r.src); }}
                      title="Add to queue"
                      className={`shrink-0 flex items-center gap-1 pl-1.5 pr-2 h-8 rounded-lg border text-[11px] transition-colors ${
                        added === r.src
                          ? 'border-green-400/50 bg-green-400/10 text-green-300'
                          : 'border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {added === r.src ? <Check size={13} /> : <Plus size={13} />}
                      {added === r.src ? 'Added' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {added && tab !== 'search' && (
          <p className="mt-2 flex items-center gap-1 text-[10px] text-green-300">
            <Check size={11} /> Added to the queue.
          </p>
        )}
        {error && <p className="mt-2 text-[10px] text-amber-300/90 leading-tight">{error}</p>}
      </div>
    </div>
  );
}
