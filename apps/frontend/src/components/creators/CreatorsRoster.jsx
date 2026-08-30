import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Users, ChevronRight, Star } from 'lucide-react';
import { CREATORS } from '../../content/creators';

/*
 * The creators roster grid — factored out of CreatorsPage so the landing
 * page's Creators pill can show the IDENTICAL list inline, under the search
 * bar, rather than becoming a second copy that drifts from the real one.
 * CreatorsPage's own file comment explains why that pattern keeps getting
 * killed in this repo; this is the fix applied to itself.
 */

// The circled initial, used wherever a creator has no avatar on file (which is
// all of them right now — `avatar: null` across the roster). A letter on brand
// colour reads as deliberate; a broken <img> reads as a bug.
function CreatorMark({ name, featured }) {
  return (
    <div
      className={`flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 text-lg font-bold border ${
        featured
          ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-200'
          : 'bg-white/5 border-white/15 text-white/70'
      }`}
      aria-hidden="true"
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function CreatorCard({ creator, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        to={`/creator/${creator.slug}`}
        className="group flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-yellow-400/50 hover:bg-black/60 transition-colors"
      >
        <CreatorMark name={creator.name} featured={creator.featured} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate group-hover:text-yellow-200 transition-colors">
              {creator.name}
            </span>
            {creator.featured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-400/40 text-[10px] uppercase tracking-wider text-yellow-200">
                <Star size={9} /> Featured
              </span>
            )}
          </div>
          {/* Taglines are blank by design in the roster — the creator's own
              words or nothing, never a guess on their behalf. So this line
              falls back to what is true rather than inventing a bio. */}
          <p className="truegle-selectable text-sm text-white/50 truncate mt-0.5">
            {creator.tagline || 'Latest uploads, played on Truegle'}
          </p>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 group-hover:text-white group-hover:border-white/25 transition-colors">
          <Play size={12} /> Watch
        </span>
        <ChevronRight size={18} className="text-white/30 group-hover:text-white/70 transition-colors" />
      </Link>
    </motion.div>
  );
}

// Featured first, then roster order. Sorting a copy — CREATORS is module
// state shared with CreatorHeader's next-creator rotation and PlayerStarters,
// and sorting it in place would quietly reorder both.
export function filterCreators(query) {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? CREATORS.filter((c) => c.name.toLowerCase().includes(needle)
      || c.slug.includes(needle)
      || (c.tagline || '').toLowerCase().includes(needle))
    : CREATORS;
  return [...matches].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
}

/**
 * @param {string} [query] - live filter text (e.g. the shared search bar's value)
 * @param {() => void} [onClearFilter] - shown on the empty-results state when provided
 * @param {boolean} [compact] - drop the intro paragraph, for tight spots like the landing page
 * @param {'h1'|'h2'} [titleTag] - CreatorsPage is this roster's only heading and needs an
 *   h1; the landing page already has its own h1 ("Truegle"), so it passes h2 instead.
 */
export default function CreatorsRoster({ query = '', onClearFilter, compact = false, titleTag = 'h2' }) {
  const roster = useMemo(() => filterCreators(query), [query]);
  const Title = titleTag;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-1">
        <Users size={16} className="text-yellow-300/80" />
        <Title className="text-sm uppercase tracking-widest text-white/50 font-semibold">
          Creators on Truegle
        </Title>
        <span className="ml-auto text-xs text-white/30 tabular-nums">
          {roster.length} {roster.length === 1 ? 'channel' : 'channels'}
        </span>
      </div>

      {/* The honest version of what a creator page is. Truegle plays their
          uploads through the provider's OWN embed, so the creator keeps the
          view and the revenue — worth saying out loud on the page that asks
          people to watch here instead of there. */}
      {!compact && (
        <p className="truegle-selectable text-sm text-white/45 mb-6 px-1 leading-relaxed">
          Their uploads, played on Truegle through the provider&rsquo;s own embed — so every
          view still counts for them. No account, no tracking, no cookies.
        </p>
      )}

      {roster.length === 0 ? (
        <div className="p-8 rounded-2xl bg-black/40 border border-white/10 text-center">
          <p className="text-white/60 text-sm">No creator matches &ldquo;{query.trim()}&rdquo;.</p>
          {onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="mt-3 text-xs text-yellow-300 hover:text-yellow-200"
            >
              Clear the filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {roster.map((c, i) => <CreatorCard key={c.slug} creator={c} index={i} />)}
        </div>
      )}
    </div>
  );
}
