import { useCallback, useMemo, useRef, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { getPlayable } from '../utils/videoEmbed';

// Turns the feed's own already-loaded rows into the player's feed-follow
// cursor. PlayerContext already has one — `feed`/`feedActive`, built for
// "the results are what plays next, ahead of the queue" (see startFeed/
// feedNext/appendFeed there, and `goNext` in TrueglePlayer.jsx, which already
// prefers a running feed over the queue and over discovery). This hook is
// the feed page's adapter onto that mechanism, not a second one: reusing it
// is what makes the fullscreen player's swipe-to-next double as the feed
// itself, with no new player code.
//
// STARTS ONLY ON EXPLICIT PLAY. Registering the cursor passively — on
// mount, or every time more rows load — would mean a feed page that isn't
// even playing anything hijacks whatever the mini-player already has
// going elsewhere in the app. The same reason Tube's own results-autoplay
// is gated behind an explicit toggle (see UniversalSearch.jsx). This hook
// only ever calls into PlayerContext as a direct result of `beginFrom`.
// WHAT PLAYS FROM A FEED POST — the one answer the card's Play badge, its
// buttons and this cursor all use. They used to ask separately: the card
// tried the permalink, then the url; the cursor tried only `permalink || url`.
// A Lemmy or Hacker News post's permalink is the discussion page and its url
// is the video, so the card showed Play while the cursor found nothing — the
// tap either did nothing or opened an empty full-screen player.
//
// A pre-classified row (Community, run through MediaService.classifyMedia()
// at submit time) is trusted as-is. Otherwise the permalink is preferred: a
// Reddit post's `url` can point at whatever the post links to, but its
// permalink is the post itself, which is what the embed needs.
export function feedSource(post) {
  if (!post) return null;
  const link = post.permalink || post.url;
  const p = (post.src && post.kind)
    ? { kind: post.kind, src: post.src, ...(post.vertical ? { vertical: true } : {}) }
    : (getPlayable(post.permalink) || getPlayable(post.url));
  if (!p) return null;
  // pageUrl is the card's identity (FeedCard's "this one is live" marker).
  return {
    ...p, title: post.title || link, pageUrl: link, poster: post.thumbnail || null, channel: post.author || undefined,
  };
}

export function useFeedCursor(rows) {
  const { feedActive, startFeed, appendFeed } = usePlayer();
  const startedRef = useRef(false);

  // One playable entry per feed row that actually has one, in display
  // order. A row nothing in videoEmbed.js recognises is simply absent —
  // swiping only ever lands on something that can play.
  const playable = useMemo(() => (rows || [])
    .map((r) => {
      const s = feedSource(r);
      return s ? { ...s, _rowKey: r._key } : null;
    })
    .filter(Boolean), [rows]);

  // Tops up a running feed as more rows load — a full re-derive would
  // re-trigger startFeed's "start where you already are" jump on every
  // page load, which is what appendFeed exists to avoid.
  const prevLenRef = useRef(playable.length);
  useEffect(() => {
    const grew = playable.length - prevLenRef.current;
    prevLenRef.current = playable.length;
    if (grew > 0 && startedRef.current && feedActive) {
      appendFeed(playable.slice(-grew));
    }
  }, [playable, feedActive, appendFeed]);

  // The cursor stops being this page's the moment the feed ends, however it
  // ended — stop, close, a fresh startFeed from elsewhere. A later beginFrom
  // is what re-arms it, never a passive effect.
  useEffect(() => {
    if (!feedActive) startedRef.current = false;
  }, [feedActive]);

  // Start (or resume) the feed at a specific row — the centered card's play
  // button, or "Open in app" from the action sheet. Returns false when the
  // row itself is not playable, so the caller can fall back honestly.
  const beginFrom = useCallback((row) => {
    const idx = playable.findIndex((p) => p._rowKey === row?._key);
    let from = idx >= 0 ? playable.slice(idx) : null;
    if (!from) {
      // A clip that is not in this list — e.g. a link to one that has since
      // scrolled off the shelf — plays first with the list lined up behind it.
      const s = feedSource(row);
      from = s ? [s, ...playable.filter((p) => p.pageUrl !== s.pageUrl)] : [];
    }
    if (!from.length) return false;
    startedRef.current = true;
    // ONE PLAYER. The feed run parks the queue on standby (see startFeed and
    // resumeQueue in PlayerContext) rather than joining or consuming it, and
    // plays the rest of the timeline in order when each clip ends.
    startFeed(from);
    return true;
  }, [playable, startFeed]);

  return { beginFrom };
}

export default useFeedCursor;
