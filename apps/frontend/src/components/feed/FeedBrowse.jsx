import { useMemo } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { CATEGORIES, platformsForCategory } from '../../config/feedCategories';
import { useSocialFeed } from '../../hooks/useSocialFeed';
import FeedCard from './FeedCards';
import { useFeedCursor } from '../../hooks/useFeedCursor';

// Browse — the categories, stacked, each one a horizontal preview.
//
// ── ONE ROW, ONE FEED HOOK ──────────────────────────────────────────────────
//
// Every row is an independent useSocialFeed. That looks wasteful next to one
// request returning everything, and it is the right shape anyway: the rows have
// different source sets and different seed topics, they fail independently, and
// a row whose sources are all switched off must render as absent rather than as
// an error. Sharing one request would couple all five to the slowest and the
// most broken of them.
//
// Rows fetch ONE page and stop. A horizontal strip is a preview, not a feed —
// paging it would load content nobody scrolled to, on a page showing five rows
// at once.
//
// ── SWITCHED-OFF SOURCES DISAPPEAR HERE TOO ─────────────────────────────────
//
// A category names its sources optimistically (Soc contains Reddit whether or
// not Reddit is on). platformsForCategory intersects that with what Servers has
// enabled, so switching a source off switches it off everywhere. Otherwise the
// dropdown would be decoration on this page.

function CategoryRow({ category, enabledIds, onOpen }) {
  const platforms = useMemo(
    () => platformsForCategory(category, enabledIds),
    [category, enabledIds.join(',')],
  );

  const feed = useSocialFeed({
    query: category.topic || '',
    platforms,
    enabled: platforms.length > 0,
    interleave: true,
    // NOT remembered. The persistent seen-ledger belongs to the main timeline,
    // where "never show me this twice" is the promise. A preview row that
    // suppressed everything already scrolled past would be empty for anyone who
    // has used the feed at all — and it is a shop window, not a feed.
    rememberSeen: false,
  });

  const rows = useMemo(() => feed.items.slice(0, 12), [feed.items]);
  // Each row is its own run: playing a card plays on into the rest of the row
  // (and parks the queue), rather than one clip and then straight back into
  // the queue.
  const { beginFrom } = useFeedCursor(rows);

  // A category with every source switched off is not an error and not empty —
  // it is absent. Rendering an empty row with a heading would imply the
  // category is broken rather than switched off.
  if (!platforms.length) return null;

  return (
    <section className="mb-7" data-browse-row={category.id}>
      <button
        type="button"
        data-browse-open={category.id}
        onClick={() => onOpen(category.id)}
        className="group flex items-baseline gap-2 mb-2 text-left"
      >
        <h2 className="text-white/90 text-base font-semibold">{category.label}</h2>
        <span className="text-white/35 text-xs">{category.blurb}</span>
        <ChevronRight
          size={15}
          className="text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all"
        />
      </button>

      {feed.loading && !rows.length && (
        <div className="flex items-center gap-2 py-6 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading {category.label}…
        </div>
      )}

      {/* The upstream's own words, per row. A row that is empty because three
          platforms refused is a different situation from one with nothing to
          show, and only the first is worth reporting. */}
      {!feed.loading && !rows.length && (feed.platformErrors || []).length > 0 && (
        <p className="py-4 text-amber-200/60 text-xs">
          {feed.platformErrors.map((e) => e.platform).join(', ')} didn&apos;t answer.
        </p>
      )}

      {!!rows.length && (
        // Horizontal scroll with snap, and the scrollbar hidden — a strip of
        // cards that stops mid-card reads as broken rather than as scrollable.
        <div
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {rows.map((post) => (
            <div key={post._key} className="snap-start shrink-0 w-[260px] sm:w-[300px]">
              <FeedCard post={post} onPlay={() => beginFrom(post)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function FeedBrowse({ enabledIds = [], onOpen }) {
  return (
    <div className="max-w-4xl mx-auto" data-feed-browse="">
      {CATEGORIES.map((c) => (
        <CategoryRow key={c.id} category={c} enabledIds={enabledIds} onOpen={onOpen} />
      ))}
    </div>
  );
}
