import { useState } from 'react';
import { Search, X } from 'lucide-react';

// WHY THE FEED IS USEFUL, SAID ONCE (owner, 2026-11-08).
//
// The feed's real trick is that a creator's name is all it takes: type it and
// their posts come back from every platform at once, instead of opening six
// apps. Nothing on the page said so — it just looked like a timeline — so
// first-time visitors had no reason to try it.
//
// A NOTE, NOT A MODAL. It sits directly under the search bar it is about, never
// covers the page, and goes away on its own the moment someone starts typing
// (they have found the thing it points at). The close button is remembered, so
// it never comes back for someone who has already dismissed it.
//
// The sentence is true as shipped: a typed name is searched on every source at
// once. Depth varies by platform — X, Reddit, Lemmy and News answer with plenty,
// the Meta and TikTok pages with a post or two — which is the platforms'
// openness and not ours, and why the copy promises "their posts" and not "all
// of their posts".
const KEY = 'truegle_feed_creator_tip_v1';

const wasDismissed = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

/** @param {{show: boolean}} props show — false hides it without dismissing it */
export default function FeedCreatorTip({ show }) {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (!show || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it just returns next visit */ }
  };

  return (
    <div
      role="note"
      data-feed-creator-tip=""
      className="mt-3 flex items-start gap-3 rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] px-3.5 py-3"
    >
      <span className="mt-0.5 shrink-0 text-yellow-300" aria-hidden="true">
        <Search size={16} />
      </span>
      <p className="flex-1 text-sm leading-snug text-white/80">
        Type the name of your favorite creator, see their posts across all platforms
      </p>
      <button
        type="button"
        onClick={close}
        data-feed-creator-tip-close=""
        aria-label="Dismiss this tip"
        className="-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
      >
        <X size={16} />
      </button>
    </div>
  );
}
