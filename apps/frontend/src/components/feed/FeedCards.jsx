import { useMemo, useState } from 'react';
import { ArrowUp, MessageCircle, ExternalLink, Code, Star, GitFork, Play } from 'lucide-react';
import { PROVIDERS } from '../../config/socialProviders';
import { getPlayable } from '../../utils/videoEmbed';
import { usePlayer } from '../../context/PlayerContext';
import FeedCardActions from './FeedCardActions';
import ExternalSiteWarning from './ExternalSiteWarning';
import { gatedSite } from '../../utils/externalSites';

// One post, one card, per platform.
//
// LIFTED, NOT REWRITTEN. These were defined inside MultimediaInterface.jsx —
// which is 1100 lines and about something else — and the Feed page needs the
// identical thing. Copying them would have produced two Reddit cards that
// drift apart the first time either is touched, which is exactly how this
// codebase ended up with five dead forks of the search page. Both consumers
// import from here.
//
// They all take the ONE normalised shape /api/social/feed emits, whatever
// platform it came from:
//
//   { id, platform, title, url, permalink, snippet, author, subreddit,
//     date, score, comments, thumbnail, flair }
//
// The polymorphic fields are deliberately overloaded per platform and the
// cards are where that gets translated back into words: on GitHub `score` is
// stars, `comments` is open issues and `flair` is the repo's language.

/** 1200 → 1.2k. Returns null for null so a missing count renders nothing at
 *  all rather than "0", which would be a claim rather than a gap. */
export function fmt(n) {
  if (n == null) return null;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export const RedditCard = ({ post }) => (
  <a
    href={post.permalink || post.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block p-4 rounded-xl bg-orange-950/20 border border-orange-500/20 hover:border-orange-400/40 transition-all group"
  >
    <div className="flex items-center gap-2 mb-2 text-xs text-orange-400/70">
      <span className="font-semibold">{post.subreddit}</span>
      <span className="text-white/30">·</span>
      <span>u/{post.author}</span>
      {post.date && <span className="ml-auto text-white/30">{new Date(post.date).toLocaleDateString()}</span>}
    </div>
    <p className="text-white/90 font-semibold text-sm leading-snug line-clamp-3 group-hover:text-white transition-colors mb-2">
      {post.title}
    </p>
    {post.snippet && <p className="text-white/50 text-xs line-clamp-2 mb-2">{post.snippet}</p>}
    <div className="flex items-center gap-3 text-xs text-white/40">
      {post.score != null && (
        <span className="flex items-center gap-1"><ArrowUp size={11} className="text-orange-400" />{fmt(post.score)}</span>
      )}
      {post.comments != null && (
        <span className="flex items-center gap-1"><MessageCircle size={11} />{fmt(post.comments)} comments</span>
      )}
      {post.flair && <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">{post.flair}</span>}
      <ExternalLink size={11} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </a>
);

export const HNCard = ({ post }) => (
  <a
    href={post.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block p-4 rounded-xl bg-yellow-950/20 border border-yellow-500/20 hover:border-yellow-400/40 transition-all group"
  >
    <p className="text-white/90 font-semibold text-sm leading-snug line-clamp-2 group-hover:text-white transition-colors mb-2">
      {post.title}
    </p>
    <div className="flex items-center gap-3 text-xs text-white/40">
      {post.score != null && (
        <span className="flex items-center gap-1"><ArrowUp size={11} className="text-yellow-400" />{fmt(post.score)} pts</span>
      )}
      {post.comments != null && (
        <span className="flex items-center gap-1"><MessageCircle size={11} />{fmt(post.comments)} comments</span>
      )}
      <span>by {post.author}</span>
      {post.date && <span className="ml-auto">{new Date(post.date).toLocaleDateString()}</span>}
    </div>
  </a>
);

export const GitHubCard = ({ post }) => (
  <a
    href={post.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block p-4 rounded-xl bg-slate-900/40 border border-slate-500/20 hover:border-slate-400/40 transition-all group"
  >
    <div className="flex items-start gap-3">
      {post.thumbnail && (
        <img src={post.thumbnail} alt={post.author} className="w-8 h-8 rounded-full shrink-0 opacity-80" />
      )}
      <div className="min-w-0">
        <p className="text-white/90 font-semibold text-sm group-hover:text-white transition-colors truncate">{post.title}</p>
        {post.snippet && <p className="text-white/50 text-xs mt-1 line-clamp-2">{post.snippet}</p>}
        <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
          {/* On GitHub these mean something else: language, stars, forks. */}
          {post.flair && <span className="flex items-center gap-1"><Code size={10} />{post.flair}</span>}
          {post.score != null && <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400" />{fmt(post.score)}</span>}
          {post.comments != null && <span className="flex items-center gap-1"><GitFork size={10} />{fmt(post.comments)}</span>}
          {post.date && <span className="ml-auto">{new Date(post.date).toLocaleDateString()}</span>}
        </div>
      </div>
    </div>
  </a>
);

const BY_PLATFORM = { Reddit: RedditCard, 'Hacker News': HNCard, GitHub: GitHubCard };

// Which provider a row came from, by its display name, so the generic card can
// find the colour. PROVIDERS is keyed by id ('hackernews') while a row carries
// a label ('Hacker News'), and the feed is merged from both — so match on
// either rather than assuming one.
const COLOUR_BY_PLATFORM = PROVIDERS.reduce((acc, p) => {
  acc[p.label.toLowerCase()] = p.colour;
  acc[p.id.toLowerCase()] = p.colour;
  return acc;
}, {});

const colourFor = (platform) => COLOUR_BY_PLATFORM[String(platform || '').toLowerCase()] || '#64748b';

/**
 * The card for any source without a hand-built one.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT `return null`.
 *
 * This dispatch used to render NOTHING for an unrecognised platform, on the
 * reasoning that invisible beats ugly. That was survivable while three sources
 * existed and all three had cards. The moment News, Community, Mastodon,
 * Bluesky and Lemmy were added to the fan-out, it became a silent hole: the
 * backend returned posts, the round-robin dealt them into the timeline, and the
 * page rendered blank rows for five of eight sources with no error anywhere.
 * A feed that drops posts quietly is unreportable — the only symptom is a
 * shorter list than there should be, and nobody can see what is missing.
 *
 * So: every row renders. A source without bespoke styling gets this, in its own
 * provider colour, which is also what the spec asks for — a container two-toned
 * to the provider it came from, saying where it is from without a logo.
 */
export const GenericCard = ({ post }) => {
  const colour = colourFor(post.platform);
  return (
    <a
      href={post.permalink || post.url}
      target="_blank"
      rel="noopener noreferrer"
      data-feed-card={post.platform}
      className="block rounded-xl border p-3 transition-colors"
      style={{
        // Two-toned: a wash of the provider's colour behind a border of the
        // same colour, so the card reads as belonging to that source.
        background: `${colour}14`,
        borderColor: `${colour}33`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${colour}66`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${colour}33`; }}
    >
      <div className="flex items-start gap-2.5">
        {post.thumbnail && (
          <img
            src={post.thumbnail}
            alt=""
            loading="lazy"
            className="w-14 h-14 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colour }} />
            <span className="text-[11px] font-medium" style={{ color: colour }}>{post.platform}</span>
            {/* THE WATERMARK. A community row was posted HERE, not read from
                somebody else's timeline, and a reader deserves to know which
                they are looking at — every other row in this feed is a window
                onto a platform, this one is Truegle's own.

                On the card, not over the media: the video is the original
                creator's and plays from their embed, so stamping a mark across
                it would be claiming something that is not ours. */}
            {post.community && (
              <span
                data-feed-watermark={post.anonymous ? 'anonymous' : 'attributed'}
                title={post.anonymous
                  ? 'Posted to Truegle anonymously — nothing is hosted here, it plays from the original platform'
                  : 'Posted to Truegle by a member — it plays from the original platform'}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-[10px] font-semibold text-yellow-200 shrink-0"
              >
                Truegle
                {post.anonymous && <span className="font-normal opacity-70">· anon</span>}
              </span>
            )}
            {post.subreddit && <span className="text-[11px] text-white/35 truncate">{post.subreddit}</span>}
          </div>
          <p className="text-sm text-white/90 leading-snug line-clamp-2">{post.title}</p>
          {post.snippet && post.snippet !== post.title && (
            <p className="text-xs text-white/45 mt-1 line-clamp-2">{post.snippet}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/35">
            {post.author && <span className="truncate">{post.author}</span>}
            {/* Rendered only where the source actually reports one. These are
                null rather than 0 for sources that do not publish a score, so
                a real zero and "no such number" stay distinguishable. */}
            {typeof post.score === 'number' && <span>▲ {fmt(post.score)}</span>}
            {typeof post.comments === 'number' && <span>{fmt(post.comments)} comments</span>}
          </div>
        </div>
      </div>
    </a>
  );
};

// ── playable media in the feed ───────────────────────────────────────────────
//
// "Resembles the vids tab": a playable post gets a small always-visible play
// badge, enlarges when it's the card centered on screen (see useFeedFocus),
// and — only while centered — a large center play button that starts
// playback immediately. Tapping anywhere else on a playable card opens
// FeedCardActions (Open in app / Add to queue / Open link). A NON-playable
// card is untouched: the exact same plain outbound `<a>` it has always been,
// no interception, no sheet — the chrome below only ever activates for a post
// something in videoEmbed.js actually recognises.
//
// NO CARD EVER HOLDS THE PICTURE. Not while scrolling past, and not while
// playing either: the media lives in the LENS, a fixed frame centred in the
// viewport that the feed scrolls behind (see MiniPlayer's lens note). A card
// is always the same card — poster, badge, play button — whatever is on.
//
// It was not always so, and the reason it changed is worth keeping: the
// playing card used to become `[data-player-slot]` and host the frame
// itself. Once the picture was portrait that made the card TALLER THAN THE
// VIEWPORT, which pushed its own controls under the page's fixed feedback
// bar where the clicks were swallowed, and moved the card's own centre so
// focus jumped to a neighbour and stopped the playback that had just
// started. A card that grows into a player chases itself out of focus.
//
// So: every play/queue action hands off to the one global player via
// usePlayer()/useFeedCursor, at most one decoder ever runs, and the feed
// stays a list of fixed-size cards no matter how many playable posts are in
// it.

/** Trust a pre-classified source (Community, from routes/social.js's
 *  normaliseCommunity) over re-deriving it — that row was already run
 *  through MediaService.classifyMedia() at submit time. Everything else
 *  falls back to running getPlayable() on the URLs the post already carries,
 *  permalink preferred: a Reddit post's `url` can point at whatever the post
 *  links to, but its `permalink` is always the post itself, which is what
 *  the embed actually needs. */
function classify(post) {
  if (!post) return null;
  if (post.src && post.kind) {
    return { kind: post.kind, src: post.src, vertical: !!post.vertical };
  }
  return getPlayable(post.permalink) || getPlayable(post.url) || null;
}

/** Pick the right card for a row. Anything without a bespoke card gets the
 *  generic one in its provider's colour — never nothing, because a dropped row
 *  is invisible and therefore unreportable.
 *
 *  `focused` — true when this is the card useFeedFocus has determined is
 *  nearest the vertical center of the viewport. Purely a rendering signal;
 *  the caller owns registering the wrapper element with that hook.
 *
 *  `onPlay` — starts playback via the caller's feed-follow cursor (see
 *  useFeedCursor), so the fullscreen player has this feed's own rows to
 *  swipe through afterwards. Optional: a caller with no cursor of its own
 *  (Browse's horizontal strips) omits it and gets the plain playNow this
 *  always did — FeedCardActions carries that fallback. */
export default function FeedCard({ post, focused = false, onPlay }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const { current, poppedOut, playNow } = usePlayer();

  const playable = useMemo(() => classify(post), [post]);
  // Facebook and Instagram cannot be read in-app at all, so following one
  // really does leave Truegle — said once, before it happens. See
  // utils/externalSites.js.
  const gated = gatedSite(post?.permalink || post?.url);

  if (!post?.platform) return null;
  const Card = BY_PLATFORM[post.platform] || GenericCard;

  if (!playable) {
    // Still enlarges on focus — that rhythm is a feed-wide thing, not a
    // video-only one — but no badge and no sheet: a plain link to wherever
    // the post points, same as it has always been. The ONE exception is a
    // gated site, where the click is intercepted to explain what following
    // it costs before it costs it.
    return (
      <div
        data-feed-focused={focused ? 'yes' : undefined}
        className={`transition-transform duration-200 ${focused ? 'z-10 scale-[1.02]' : ''}`}
        onClick={gated ? (e) => { e.preventDefault(); setWarnOpen(true); } : undefined}
      >
        <Card post={post} />
        {gated && (
          <ExternalSiteWarning
            open={warnOpen}
            site={gated}
            url={post.permalink || post.url}
            onClose={() => setWarnOpen(false)}
          />
        )}
      </div>
    );
  }

  const link = post.permalink || post.url;
  const source = {
    kind: playable.kind,
    src: playable.src,
    title: post.title,
    pageUrl: link,
    poster: post.thumbnail || null,
    ...(playable.vertical ? { vertical: true } : {}),
  };

  // THIS is the card whose media is loaded in the lens. `pageUrl` is the
  // identity: it's set to the same `link` here and in useFeedCursor's own
  // rows, so the comparison is exact by construction. It only dims the
  // card's own play affordance now — the picture itself is in the lens, not
  // in here (see the note above).
  const isLive = !poppedOut && current?.pageUrl === link;

  const openSheet = (e) => {
    // The inner card is still a real <a href>; without this the click would
    // both navigate away AND open the sheet on top of the navigation.
    e.preventDefault();
    setSheetOpen(true);
  };

  const playCenter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlay) onPlay(); else playNow(source, 'feed');
  };

  // THE CARD NEVER GROWS INTO A PLAYER. It used to: the playing card hosted
  // a [data-player-slot] and the frame docked into it, so the card became
  // the player. That could not survive the portrait rule, and it failed in
  // two ways at once, both measured rather than reasoned about:
  //
  //   · A 9:16 picture made the card TALLER THAN THE VIEWPORT, pushing its
  //     own controls down under the page's fixed feedback bar, which then
  //     swallowed the clicks.
  //   · Growing moved the card's own centre, which moved which card
  //     useFeedFocus considered centred, which stopped the playback that
  //     had just started. The card chased itself out of focus.
  //
  // The lens fixes both by not being in the feed at all: it is a fixed frame
  // in the viewport that the feed scrolls behind (see MiniPlayer's lens
  // mode). Cards stay cards — poster, badge, play button — at a constant
  // size, whatever is playing.

  return (
    <div
      data-feed-card-wrap={playable.kind}
      data-feed-focused={focused ? 'yes' : undefined}
      // Which card the lens is currently showing. Not a size or layout
      // change — the card must stay exactly the same shape whether it is
      // playing or not, which is the whole point of the lens being separate.
      data-feed-in-lens={isLive ? 'yes' : undefined}
      onClick={openSheet}
      className={`relative transition-transform duration-200 ${focused ? 'z-10 scale-[1.02] shadow-2xl shadow-black/40' : ''}`}
    >
      <Card post={post} />

      {/* The always-visible badge — playability has to read while scrolling
          past, not only once a card happens to be centered. */}
      <span
        aria-hidden="true"
        className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm pointer-events-none"
      >
        <Play size={11} className="text-white ml-0.5" fill="currentColor" />
      </span>

      {/* THE CENTER PLAY BUTTON — only while this card holds focus, and never
          on the card that is already playing. Clicking it skips the sheet
          entirely: "defaults to auto play in app".

          NOT ON THE LIVE CARD, for two reasons that arrived together. It is
          meaningless — the card is playing, that is what the lens above it is
          showing — and it is unreachable: the lens is fixed across the middle
          of the viewport, which is exactly where a centred card's own centre
          button sits, so the lens swallowed the click. Harmless while
          scrolling away stopped playback, since the lens was gone by the time
          another card centred; now that the card HOLDS (see FeedPage), the
          button was live, invisible under the lens, and pressing it did
          nothing. */}
      {focused && !isLive && (
        <button
          type="button"
          data-feed-action="play-center"
          aria-label="Play"
          onClick={playCenter}
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/75 transition-colors"
        >
          <Play size={24} className="ml-1" fill="currentColor" />
        </button>
      )}

      <FeedCardActions
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        source={source}
        link={link}
        title={post.title}
        onPlay={onPlay}
      />
    </div>
  );
}
