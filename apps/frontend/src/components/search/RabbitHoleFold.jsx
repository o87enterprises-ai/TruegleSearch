import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import PerspectiveSelector from './PerspectiveSelector';
import { perspectiveLabel } from '../../config/perspectives';
import { readThroughLens, waysToReask } from '../../utils/perspectiveLens';

/**
 * The Rabbit Hole fold — Perspectives, folded into Red, on demand.
 *
 * Perspectives was a whole separate page with its own background, its own
 * search bar and its own copy of the layout, reachable from a pill most people
 * never cycled to. What it actually did — "show me this from another angle" —
 * is the same impulse that brings someone to the Rabbit Hole in the first
 * place. Two modes for one question is one mode too many, so this is a button
 * on Red rather than a destination of its own.
 *
 * THE FLOW, and the order matters:
 *
 *   1. CLOSED. One button. It counts how many angles are actually present in
 *      the results already on screen — "14 ways to re-ask this" — rather than
 *      advertising 27 perspectives when the page can only honour four.
 *
 *   2. REREAD (free, instant, no request). Pick lenses; the results on screen
 *      re-sort to that angle immediately. Nothing is fetched, nothing leaves
 *      the browser, and it is undoable with one press.
 *
 *   3. RERUN (only when asked). If the reread didn't surface what they were
 *      after, THEN the search goes back out with those perspectives applied
 *      server-side, which reaches sources this page never had.
 *
 * Doing the cheap step first is the point. The old page had only step 3, so
 * every angle cost a round trip even when the answer was already loaded.
 *
 * `/biased` and `?mode=purple` still resolve — they land on Red with this fold
 * already open, so nothing anyone bookmarked or shared goes dead.
 */
export default function RabbitHoleFold({
  results = [],
  selected = [],
  onSelect,
  onRerun,
  rerunning = false,
  startOpen = false,
}) {
  const [open, setOpen] = useState(startOpen);
  const [category, setCategory] = useState(0);
  // Set once a rerun has been fired for the current lens, so the bar stops
  // offering the same rerun again and says what it did instead.
  const [reran, setReran] = useState(false);

  const { counts, ways } = useMemo(() => waysToReask(results), [results]);
  const lens = useMemo(() => readThroughLens(results, selected), [results, selected]);

  const active = selected.filter((id) => id !== 'neutral');
  const lensNames = active.map(perspectiveLabel).join(' + ');

  const choose = (id) => {
    setReran(false); // a changed lens is a new question — the rerun offer comes back
    onSelect?.(id);
  };

  const clear = () => {
    setReran(false);
    active.forEach((id) => onSelect?.(id)); // toggle each one off
  };

  return (
    <div className="max-w-4xl mx-auto mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-950/60 border border-red-500/30 hover:bg-red-950/80 hover:border-red-500/50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <RotateCcw size={14} className="text-red-400 shrink-0" />
          <span className="text-sm text-white/80 truncate">
            {active.length
              ? <>Reading through <span className="text-red-300 font-semibold">{lensNames}</span></>
              : ways > 0
                ? <><span className="text-red-300 font-semibold">{ways} ways</span> to re-ask this</>
                : 'Re-ask this another way'}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
          <ChevronDown size={16} className="text-red-400" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <PerspectiveSelector
                accent="red"
                counts={counts}
                heading="Re-ask this"
                subheading="Pick an angle — the results below re-read instantly. Nothing is sent."
                selectedPerspectives={selected}
                onTogglePerspective={choose}
                activeCategoryIndex={category}
                onCategoryChange={setCategory}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The reread result, and the door to a rerun. Shown whenever a lens is
          on — including when the fold itself is closed, because a filter you
          can't see is a filter you'll mistake for missing results. */}
      {lens.active && (
        <div className="mt-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-red-500/20">
          <span className="text-xs text-white/60">
            {lens.count > 0
              ? <>Reread: <span className="text-red-300 font-semibold">{lens.count}</span> of {lens.total} results read this way.</>
              : <>Nothing in these {lens.total} results is written from that angle.</>}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {!reran && (
              <button
                type="button"
                disabled={rerunning}
                onClick={() => { setReran(true); onRerun?.(active); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 disabled:opacity-50 transition-colors"
              >
                <Search size={12} />
                {rerunning ? 'Searching…' : lens.count > 0 ? 'Not it — search again' : 'Search again for it'}
              </button>
            )}
            {reran && !rerunning && (
              <span className="text-[11px] text-white/40">Searched again with this lens.</span>
            )}
            <button
              type="button"
              onClick={clear}
              title="Drop the lens and show every result again"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
