import { useState, useRef, useCallback } from 'react';
import { HardDrive, Link2, Search, Loader2, Plus } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { getPlayable } from '../../utils/videoEmbed';
import { resolveShareInput, titleFromUrl } from '../../utils/playerLink';

// The queue's "+" panel: three ways to feed the player.
//   Device — a local file, played from an object URL. Never uploaded.
//   Link   — a Truegle player link, or any URL the player can host.
//   Search — text search filtered down to results that actually play in here.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TABS = [
  { id: 'device', label: 'Device', icon: HardDrive },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'search', label: 'Search', icon: Search },
];

export default function QueueAddMenu({ onClose }) {
  const { enqueue, enqueueMany } = usePlayer();
  const [tab, setTab] = useState('search');
  const [linkText, setLinkText] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

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
    enqueueMany(sources);
    setError('');
    onClose?.();
  };

  // ── Link ────────────────────────────────────────────────────────────────
  const addLink = () => {
    const sources = resolveShareInput(linkText);
    if (!sources.length) {
      setError("That link can't play in here yet — YouTube, Vimeo, SoundCloud, a direct audio/video file, or a Truegle player link.");
      return;
    }
    enqueueMany(sources);
    setLinkText('');
    setError('');
    onClose?.();
  };

  // ── Search ──────────────────────────────────────────────────────────────
  const runSearch = useCallback((e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResults(null);
    fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, filters: { category: 'videos', bias: 'all', dateRange: 'any', perPage: 20 } }),
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
      .catch(() => setError('Search is unreachable right now.'))
      .finally(() => setLoading(false));
  }, [query]);

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
              <button type="button" onClick={addLink} className={goCls}>Add</button>
            </div>
            <p className="mt-1.5 text-[10px] text-white/35 leading-tight">
              YouTube, Vimeo, SoundCloud, direct audio/video files, and any truegle.info/w link.
            </p>
          </div>
        )}

        {tab === 'search' && (
          <div>
            <form onSubmit={runSearch} className="flex gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for something to play"
                className={inputCls}
              />
              <button type="submit" className={goCls} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Go'}
              </button>
            </form>

            {results && results.length === 0 && (
              <p className="mt-2 text-[11px] text-white/40">Nothing in those results can play in the Truegle player.</p>
            )}

            {results && results.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto -mx-1">
                {results.map((r) => (
                  <button
                    key={r.pageUrl}
                    type="button"
                    onClick={() => { enqueue(r); onClose?.(); }}
                    className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
                  >
                    {r.poster
                      ? <img src={r.poster} alt="" className="w-10 h-7 rounded object-cover shrink-0"
                          onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                      : <span className="w-10 h-7 rounded bg-white/10 shrink-0" />}
                    <span className="text-[11px] text-white/75 line-clamp-2 flex-1 min-w-0">{r.title}</span>
                    <Plus size={14} className="text-white/40 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-[10px] text-amber-300/90 leading-tight">{error}</p>}
      </div>
    </div>
  );
}
