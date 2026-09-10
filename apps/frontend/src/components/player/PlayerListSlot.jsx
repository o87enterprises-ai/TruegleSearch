import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Check, X, Loader2, ListMusic, Play, ChevronRight, Search as SearchIcon, Flag } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { useChannelFeed } from '../../hooks/useChannelFeed';
import { parsePlayerQuery, toHandle, sourceColour, sourceProviderLabel } from '../../utils/playerQuery';
import { hasTaste, forgetTaste } from '../../utils/taste';
import { hasRetention, forgetRetention } from '../../utils/retention';
import { isPlaylistUrl, importPlaylist, importMessage } from '../../utils/playlistImport';
import { reportBroken, useBrokenFlag, useBrokenVersion, withoutBroken } from '../../utils/broken';
import { useMediaMeta, formatDuration } from '../../utils/mediaMeta';
import { resolveTitles } from '../../utils/resolveTitles';
import { publishedLabel } from '../../utils/published';
import { SORTS, sortResults, fetchScores, datedCount } from '../../utils/resultSort';
import PlayerLibrary from './PlayerLibrary';
import { useWatchHistory, clearWatchHistory } from '../../utils/watchHistory';

// The list that lives under the player — the same one in all three
// presentations.
//
// It shows the up-next queue by default. The moment the user starts typing it
// becomes search results instead, and it stays on results while they keep
// adding things. Ten seconds after the last add it reverts to up-next, so the
// list settles back to "what's coming" without anyone having to dismiss it.
//
// That timer is deliberately reset by each add rather than each keystroke:
// people add several things in a row, and a keystroke-based timer would snap
// the list away mid-choice.
const REVERT_MS = 10000;

// Up next / History / Lists. Tabs rather than three stacked sections: the slot
// is already the shortest thing on a phone screen, and stacking would push the
// queue — the one people look at most — off the bottom.
const TABS = [
  { id: 'queue', label: 'Up next' },
  { id: 'history', label: 'History' },
  { id: 'lists', label: 'Lists' },
];

// "This doesn't play." One press removes it from your lists immediately and
// tells the platform anonymously; enough reports and nobody is offered it
// again. Deliberately small and last in the row — it is the rarest action
// here, and a prominent one invites mis-taps that hide working videos.
function BrokenFlag({ source }) {
  const flagged = useBrokenFlag(source);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); reportBroken(source); }}
      disabled={flagged}
      title={flagged ? 'Reported — it will stop appearing' : "Doesn't play? Report it"}
      aria-label={flagged ? 'Already reported as unplayable' : `Report ${source.title || 'this'} as unplayable`}
      className={`shrink-0 flex items-center justify-center w-7 h-8 rounded-lg transition-colors ${
        flagged ? 'text-amber-400/70' : 'text-white/20 hover:text-amber-300 hover:bg-white/10'
      }`}
    >
      <Flag size={12} />
    </button>
  );
}

export default function PlayerListSlot({ search, query = '', scope = 'all', provider = 'all', accent = '#f43f5e', onRevert, compact = false }) {
  const { current, queue, jump, removeFromQueue, enqueue, clearQueue, playNow } = usePlayer();
  const [tab, setTab] = useState('queue');
  const historyCount = useWatchHistory().length;
  // The host runs the search now — the viewport's browse deck shows the same
  // results, and two hooks on one query meant two identical requests per
  // keystroke. `own` is the standalone fallback for any caller that doesn't
  // supply one.
  const own = usePlayerSearch(search ? '' : query, scope, provider);
  const { results, loading, error, unsupported, trace, more, loadMore, loadingMore } = search || own;
  // ── ORDER ─────────────────────────────────────────────────────────────────
  // 'relevant' is what the search already produced, so it costs nothing and is
  // the default. The other two are asked for explicitly, and Popular only
  // fetches Truegle's own counts when somebody actually picks it — a request
  // per search for a sort nobody chose would be pure waste.
  const [sort, setSort] = useState('relevant');
  const [scores, setScores] = useState({});
  useEffect(() => {
    if (sort !== 'popular' || !results || results.length === 0) return undefined;
    const ac = new AbortController();
    fetchScores(results, ac.signal).then(setScores);
    return () => ac.abort();
  }, [sort, results]);
  // A new search is a new question; the order it is asked in is not sticky.
  useEffect(() => { setSort('relevant'); setScores({}); }, [query]);
  // Asking for a channel should be able to give you the CHANNEL, not a
  // scattering of its videos: one row to open its real feed, newest first.
  const intent = parsePlayerQuery(query, scope, provider);
  const feed = useChannelFeed();
  const feedRows = feed.videos;
  const [added, setAdded] = useState(null);
  const [forgetOpen, setForgetOpen] = useState(false);
  // ── PASTING A PLAYLIST ────────────────────────────────────────────────────
  // A playlist URL used to go through the ordinary pasted-link path, which
  // resolves the ONE video the link happens to point at (or nothing, for a
  // bare /playlist?list=… with no v=). The list itself — the actual thing
  // being pasted — was silently discarded. It is offered as an import now.
  const playlistPaste = isPlaylistUrl(query) ? query.trim() : '';
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  useEffect(() => { setImported(null); }, [playlistPaste]);
  const runImport = useCallback(async () => {
    if (!playlistPaste) return;
    setImporting(true);
    const result = await importPlaylist(playlistPaste);
    setImported(result);
    setImporting(false);
    // Land them on the list they just made rather than on a search that is now
    // beside the point.
    if (result.ok) { setShowingResults(false); setTab('lists'); onRevert?.(); }
  }, [playlistPaste, onRevert]);
  // Re-filter on every flag. usePlayerSearch drops known-dead rows when the
  // results ARRIVE; without this the row you just flagged would sit there
  // until the next search, which reads as the button not working.
  useBrokenVersion();
  // Durations and channels learned by actually playing things — see
  // utils/mediaMeta.js. Subscribing here is what makes a row fill in its
  // length the moment that track has been played once.
  const metaFor = useMediaMeta();

  // FILL IN THE TITLES A PACKED SHARE LINK COULD NOT CARRY.
  //
  // A queue arriving from /tube?p=… has ids and no titles, so it renders as
  // "youtube.com/watch" over and over. This asks our backend for the real ones
  // (never the provider directly — see utils/resolveTitles for why) and the
  // answers land in mediaMeta, which this row already reads.
  //
  // The visible window only, not the whole queue: one request naming every
  // track somebody was sent, before they have played any of them, is the
  // difference between looking up what is playing and enumerating a friend's
  // playlist.
  useEffect(() => {
    if (!queue || queue.length === 0) return;
    resolveTitles(queue.slice(0, 8));
  }, [queue]);
  const [showingResults, setShowingResults] = useState(false);
  const revertTimer = useRef(null);

  const typing = query.trim().length >= 2;
  // The search is debounced, so between a keystroke and the request there was
  // a stretch where nothing said anything was happening. `pending` covers it:
  // busy from the moment the text changes until results for THAT text land.
  const [ranFor, setRanFor] = useState('');
  useEffect(() => { if (results !== null || error) setRanFor(query); }, [results, error, query]);
  const pending = typing && ranFor !== query;

  // Typing switches the slot to results.
  useEffect(() => {
    if (typing) {
      clearTimeout(revertTimer.current);
      setShowingResults(true);
    }
  }, [typing]);

  // Ten seconds after the LAST add, fall back to the queue.
  const scheduleRevert = () => {
    clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => {
      setShowingResults(false);
      onRevert?.();
    }, REVERT_MS);
  };

  useEffect(() => () => clearTimeout(revertTimer.current), []);

  const add = (source) => {
    enqueue(source, { deck: 'tube' });
    setAdded(source.src);
    setTimeout(() => setAdded(null), 1500);
    scheduleRevert();
  };

  const rowH = compact ? 'min-h-[38px]' : 'min-h-[44px]';

  if (showingResults) {
    return (
      <div className="border-t border-white/10 bg-black/30">
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/40">
          <SearchIcon size={11} /> Results
          {(loading || pending) && <Loader2 size={11} className="animate-spin" />}
          {!feedRows && results && results.length > 1 && (
            <span className="ml-auto flex items-center gap-1">
              {SORTS.map((o) => {
                // Newest is offered only when the rows actually carry dates.
                // The index supplies one for some providers and not others, so
                // a Newest that silently reorders nothing would read as broken.
                const dead = o.id === 'newest' && datedCount(results) < 2;
                return (
                  <button
                    key={o.id}
                    type="button"
                    data-sort={o.id}
                    disabled={dead}
                    onClick={() => setSort(o.id)}
                    aria-pressed={sort === o.id}
                    title={o.id === 'popular'
                      ? "Most played and best rated ON TRUEGLE — our own anonymous counts, not the platform's view count"
                      : (dead ? 'These results carry no publish dates' : `Sort by ${o.label.toLowerCase()}`)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      dead ? 'text-white/15 cursor-not-allowed'
                        : sort === o.id ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/70'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </span>
          )}
        </div>
        {/* The channel itself, offered before its scattered videos. YouTube
            only: opening a real feed goes through /creators/resolve, which
            speaks YouTube channel ids and nothing else. Offering the row for a
            subreddit would be a button that always fails. */}
        {intent.channel && !feedRows && (!intent.platform || intent.platform === 'youtube') && (
          <button
            type="button"
            onClick={() => feed.open(toHandle(intent.channel, 'youtube'), intent.channel)}
            disabled={feed.loading}
            className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-left transition-colors disabled:opacity-60"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 shrink-0 text-[11px] font-bold text-white/70">
              {(intent.channel[0] || '@').toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-white/85 truncate">
                {toHandle(intent.channel, intent.platform || 'youtube')}
              </span>
              <span className="block text-[10px] text-white/40">
                {feed.loading ? 'Opening the channel…' : 'Open this channel — latest uploads first'}
              </span>
            </span>
            {feed.loading
              ? <Loader2 size={13} className="animate-spin text-white/40 shrink-0" />
              : <ChevronRight size={14} className="text-white/40 shrink-0" />}
          </button>
        )}
        {feed.error && !feedRows && (
          <p className="px-3 py-2 text-[11px] text-amber-300/90 border-b border-white/10">{feed.error}</p>
        )}
        {feedRows && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/10 bg-white/[0.04]">
            <span className="text-[10px] uppercase tracking-wider text-white/50 truncate flex-1">
              {`@${feed.handle}`} — newest first
            </span>
            <button type="button" onClick={feed.clear}
              className="text-[10px] uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors">
              Back to results
            </button>
          </div>
        )}

        <div className={`overflow-y-auto ${compact ? 'max-h-[min(11rem,26svh)]' : 'max-h-[min(16rem,32svh)]'}`}>
          {error && !feedRows && <p className="px-3 py-2 text-[11px] text-amber-300/90">{error}</p>}
          {/* Something to look at while the provider answers — it can take a
              couple of seconds and a retry, and a blank panel reads as broken. */}
          {(loading || pending) && !feedRows && (
            <div className="px-2 py-1.5 space-y-1.5" aria-live="polite">
              <span className="sr-only">Searching…</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex items-center gap-2 ${rowH}`}>
                  <span className="w-10 h-7 rounded bg-white/10 shrink-0 animate-pulse" />
                  <span className="h-3 rounded bg-white/10 flex-1 animate-pulse"
                    style={{ maxWidth: `${80 - i * 15}%` }} />
                </div>
              ))}
            </div>
          )}
          {/* A whole playlist was pasted. The single-video path below would
              resolve one entry of it at best, so offer the list. */}
          {playlistPaste && (
            <div className="px-3 py-2.5 border-b border-white/10">
              {/* Pasting a playlist link flips this panel into Results mode,
                  which is exactly the header that has no Up next / History /
                  Lists / Your taste — those live only in the OTHER header,
                  below. Without this, saving the pasted list to your Lists
                  or checking History meant deleting the link first just to
                  get the controls back. Shortcuts, not a second set of tabs:
                  each one exits Results and lands on the real tab, same as
                  finishing an import already does. */}
              <div className="flex items-center gap-2.5 mb-2 text-[10px] uppercase tracking-wider text-white/40">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setShowingResults(false); setTab(t.id); }}
                    className="hover:text-white/80 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
                {(hasTaste() || hasRetention()) && (
                  <button
                    type="button"
                    onClick={() => { setShowingResults(false); setForgetOpen(true); }}
                    className="hover:text-white/80 transition-colors"
                  >
                    Your taste
                  </button>
                )}
              </div>
              {imported ? (
                <p className={`text-[11px] leading-snug ${imported.ok ? 'text-emerald-300/90' : 'text-amber-300/90'}`}>
                  {importMessage(imported)}
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-white/60 leading-snug mb-1.5">
                    That is a playlist. Save the whole thing to your lists?
                  </p>
                  <button
                    type="button"
                    data-import-playlist
                    onClick={runImport}
                    disabled={importing}
                    className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-white/20 text-[11px] text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    {importing
                      ? <><Loader2 size={12} className="animate-spin" /> Fetching the playlist…</>
                      : <><ListMusic size={12} /> Import playlist</>}
                  </button>
                </>
              )}
            </div>
          )}
          {/* A link from somewhere we can't host. Not an error — a limit, and
              worth naming so it doesn't read as "your link is broken". */}
          {unsupported && (
            <p className="px-3 py-2.5 text-[11px] text-white/55 leading-snug">
              Sorry — Truegle can&apos;t play links from{' '}
              <span className="text-white/80 font-semibold">{unsupported}</span> yet.
              That platform doesn&apos;t let its videos play outside its own app.
              <br />
              <span className="text-white/35">
                YouTube, Vimeo, TikTok, SoundCloud, Dailymotion, Rumble, Odysee,
                Reddit posts and direct audio/video files all play here.
              </span>
            </p>
          )}
          {!feedRows && !unsupported && results && results.length === 0 && !loading && !pending && (
            <div className="px-3 py-2">
              <p className="text-[11px] text-white/40">Nothing here can play in the Truegle player.</p>
              {/* What was asked and what came back, in the UI rather than in a
                  console nobody can open on a phone. "social 0→0" means the
                  backend found nothing; "social 12→0" means it found plenty and
                  none of it was playable. Those are completely different
                  faults and the difference used to be invisible. */}
              {trace && (
                <p className="mt-1 text-[10px] text-white/25 leading-snug break-words">
                  asked: {trace.steps.join(' · ') || 'nothing'}
                  {trace.community ? ` · community ${trace.community}` : ''}
                  <br />
                  <span className="text-white/20">q: {trace.query}</span>
                </p>
              )}
            </div>
          )}
          {withoutBroken(feedRows || sortResults(results || [], sort, scores)).map((r) => (
            /* WHICH PLATFORM THIS CAME FROM, in colour. The Where chips are
               gone and a search now fans out across every provider at once, so
               a list mixing YouTube, Rumble, Odysee and SoundCloud had nothing
               left to tell them apart. The stripe is read off the row's own
               `kind` — what it genuinely IS, not what was asked for — and the
               title attribute names it for anyone who cannot use the colour. */
            <div
              key={r.pageUrl || r.src}
              data-provider={sourceProviderLabel(r)}
              title={sourceProviderLabel(r)}
              className={`flex items-center gap-2 pl-2 pr-2 ${rowH} hover:bg-white/5 border-l-2`}
              style={{ borderLeftColor: sourceColour(r) }}
            >
              {r.poster
                ? <img src={r.poster} alt="" className="w-10 h-7 rounded object-cover shrink-0"
                    onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                : <span className="w-10 h-7 rounded bg-white/10 shrink-0" />}
              {/* Title, then whatever we actually know: the channel if the
                  result carried one or playback taught us, and the length
                  once this track has been played once. The index never
                  supplies a duration, so an empty slot here is honest rather
                  than a gap waiting to be filled with a guess. */}
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] text-white/75 line-clamp-2">{r.title}</span>
                {(() => {
                  const m = metaFor(r) || {};
                  const channel = r.channel || m.c;
                  const length = formatDuration(r.duration || m.d);
                  // Absent unless genuinely known — see utils/published.js.
                  const when = publishedLabel(r.published);
                  if (!channel && !length && !when) return null;
                  // THE CHANNEL IS A WAY IN, not a label. Opening a creator's
                  // real upload list already existed — it was reachable only
                  // when the QUERY named a channel, so finding a video by
                  // someone and then wanting more of their work meant retyping
                  // their name and hoping the parser recognised it.
                  //
                  // YouTube only, and deliberately: /creators/resolve speaks
                  // YouTube channel ids and nothing else, so offering it on a
                  // SoundCloud or Reddit row would be a button that always
                  // fails. Those keep the plain text.
                  const openable = channel && r.kind === 'youtube';
                  return (
                    <span className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/35">
                      {openable ? (
                        <button
                          type="button"
                          data-open-channel={channel}
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            feed.open(toHandle(channel, 'youtube'), channel);
                          }}
                          title={`Open ${channel} — latest uploads first`}
                          className="truncate max-w-[10rem] text-left hover:text-white/80 hover:underline transition-colors"
                        >
                          {channel}
                        </button>
                      ) : (channel && <span className="truncate max-w-[10rem]">{channel}</span>)}
                      {channel && length && <span className="text-white/20">·</span>}
                      {length && <span className="tabular-nums shrink-0">{length}</span>}
                      {when && (channel || length) && <span className="text-white/20">·</span>}
                      {when && <span className="shrink-0 whitespace-nowrap">{when}</span>}
                    </span>
                  );
                })()}
              </span>
              {/* Play now: jumps the queue and comes back to what was on. */}
              <button
                type="button"
                // Choosing something to play is a selection, exactly like an
                // add — so it starts the same countdown back to the queue.
                // Without this the panel sat on results forever once you had
                // picked, and the up-next list (and everything under it) was
                // unreachable until you cleared the search.
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); playNow(r, 'tube'); scheduleRevert(); }}
                title="Play now — comes back to what you were on afterwards"
                aria-label={`Play ${r.title || 'this'} now`}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Play size={13} />
              </button>
              {/* Explicit add — the row is not a click target, so nothing here
                  can be mistaken for "open this result" and navigate away. */}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); add(r); }}
                title="Add to queue"
                aria-label={`Add ${r.title || 'this'} to the queue`}
                className={`shrink-0 flex items-center gap-1 pl-1.5 pr-2 h-8 rounded-lg border text-[11px] transition-colors ${
                  added === r.src
                    ? 'border-green-400/50 bg-green-400/10 text-green-300'
                    : 'border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {added === r.src ? <Check size={13} /> : <Plus size={13} />}
                {added === r.src ? 'Added' : 'Add'}
              </button>
              <BrokenFlag source={r} />
            </div>
          ))}

          {/* MORE. One ask of twenty rows used to be the entire search for a
              query — the backend has always paged, nothing ever asked it to.
              Offered only while a page came back full; a button that returns
              nothing is worse than no button. */}
          {!feedRows && more && (
            <button
              type="button"
              data-load-more
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-60"
            >
              {loadingMore
                ? <><Loader2 size={12} className="animate-spin" /> Finding more…</>
                : <>More results <ChevronRight size={12} /></>}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Three lists behind one header, because they answer three different
  // questions and only one of them was ever on screen: what's coming (the
  // queue), what I already watched (replay), and what I chose to keep (lists).
  const libraryTab = tab !== 'queue';

  return (
    <div className="border-t border-white/10 bg-black/30">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/40">
        <ListMusic size={11} className="shrink-0" />
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`uppercase tracking-wider transition-colors ${
              tab === t.id ? 'text-white/80' : 'text-white/30 hover:text-white/60'
            }`}
            style={tab === t.id ? { color: accent } : undefined}
          >
            {t.label}
          </button>
        ))}
        {tab === 'history' && historyCount > 0 && (
          <button type="button" onClick={clearWatchHistory} title="Clear watch history"
            className="ml-auto text-[10px] uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors">
            Clear
          </button>
        )}
        {tab === 'queue' && (hasTaste() || hasRetention()) && (
          <button
            type="button"
            onClick={() => setForgetOpen((v) => !v)}
            aria-pressed={forgetOpen}
            title="What the player has learned from you — and how to erase it"
            className={`${queue.length > 0 ? '' : 'ml-auto '}text-[10px] uppercase tracking-wider transition-colors ${
              forgetOpen ? 'text-white/70' : 'text-white/25 hover:text-white/60'
            }`}
          >
            Your taste
          </button>
        )}
        {tab === 'queue' && queue.length > 0 && (
          <>
            <span className="ml-auto px-1.5 rounded-full text-[9px] font-bold text-black" style={{ background: accent }}>
              {queue.length}
            </span>
            {/* The ONLY thing that empties the queue. Closing the player used
                to do it silently, which is why playlists looked like they
                vanished on their own. */}
            <button type="button" onClick={clearQueue} title="Clear the queue" aria-label="Clear the queue"
              className="text-[10px] uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors">
              Clear
            </button>
          </>
        )}
      </div>
      {libraryTab ? (
        <PlayerLibrary tab={tab} accent={accent} compact={compact} />
      ) : (
      <div className={`overflow-y-auto ${compact ? 'max-h-[min(11rem,26svh)]' : 'max-h-[min(16rem,32svh)]'}`}>
        {queue.length === 0 ? (
          <p className="px-3 py-3 text-[11px] text-white/40">
            {current ? 'Nothing queued yet — search above to line something up.' : 'Search above to start watching.'}
          </p>
        ) : (
          queue.map((q, i) => (
            <div key={`${q.src}-${i}`} className={`flex items-center gap-2 px-2 ${rowH} hover:bg-white/5`}>
              <span className="text-[10px] text-white/30 w-4 shrink-0">{i + 1}</span>
              <button type="button" onClick={() => jump(i)} title="Play now"
                className="text-[11px] text-white/70 hover:text-white truncate flex-1 text-left">
                {metaFor(q)?.t || q.title || q.src}
              </button>
              <button type="button" onClick={() => removeFromQueue(i)} title="Remove"
                className="flex items-center justify-center w-8 h-8 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>
      )}
      {/* A taste profile you can't delete is a dossier — and one you can only
          delete HALF of is still a dossier, which is why this clears the
          watching record as well as the thumbs. Both live in this browser and
          nowhere else. The anonymous platform counters carry nothing tying
          back to anyone, so there is nothing there to withdraw. */}
      {forgetOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/10">
          <span className="text-[10px] text-white/35 flex-1 leading-snug">
            What the player has learned from your 👍/👎 and from how far you watch — kept
            in this browser only, and never sent anywhere.
          </span>
          <button
            type="button"
            onClick={() => { forgetTaste(); forgetRetention(); setForgetOpen(false); }}
            className="shrink-0 px-2 h-6 rounded-md border border-white/15 text-[10px] uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            Forget it
          </button>
        </div>
      )}
    </div>
  );
}
