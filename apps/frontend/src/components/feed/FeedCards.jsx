import { ArrowUp, MessageCircle, ExternalLink, Code, Star, GitFork } from 'lucide-react';

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

/** Pick the right card for a row. An unknown platform renders nothing rather
 *  than a broken half-card — the feed is merged from several sources and a new
 *  one appearing before its card exists should be invisible, not ugly. */
export default function FeedCard({ post }) {
  const Card = BY_PLATFORM[post?.platform];
  return Card ? <Card post={post} /> : null;
}
