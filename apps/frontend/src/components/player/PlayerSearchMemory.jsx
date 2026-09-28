import { useState } from 'react';
import { History, TrendingUp } from 'lucide-react';
import { searchMemory, clearSearchMemory } from '../../utils/playerSearchMemory';

// The drop-down under the player's search bar: the last five searches and the
// five most-searched, for one-tap re-queries. While typing it narrows to the
// remembered searches that contain what's typed. Device-local only.
export default function PlayerSearchMemory({ text = '', onPick }) {
  const [, bump] = useState(0);
  const { recent, top } = searchMemory();
  const needle = text.trim().toLowerCase();
  const keep = (q) => !needle || (q.toLowerCase().includes(needle) && q.toLowerCase() !== needle);
  const recentShown = recent.filter(keep);
  const recentKeys = new Set(recentShown.map((q) => q.toLowerCase()));
  const topShown = top.filter(keep).filter((q) => !recentKeys.has(q.toLowerCase()));

  if (!recentShown.length && !topShown.length) return null;

  const row = (q, Icon) => (
    <button
      key={q}
      type="button"
      // Keep focus in the input until the pick lands (see the blur delay).
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(q)}
      className="flex items-center gap-2 w-full px-2.5 py-2 text-left text-xs text-white/75 hover:text-white hover:bg-white/10 transition-colors"
    >
      <Icon size={12} className="shrink-0 text-white/35" />
      <span className="truncate">{q}</span>
    </button>
  );

  return (
    <div
      data-player-search-memory=""
      className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-lg border border-white/15 bg-[#0d0d14] shadow-xl"
    >
      {recentShown.length > 0 && (
        <>
          <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-white/35">Recent</p>
          {recentShown.map((q) => row(q, History))}
        </>
      )}
      {topShown.length > 0 && (
        <>
          <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-white/35 border-t border-white/5">Top searches</p>
          {topShown.map((q) => row(q, TrendingUp))}
        </>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { clearSearchMemory(); bump((n) => n + 1); }}
        className="w-full px-2.5 py-1.5 text-left text-[10px] text-white/35 hover:text-white/70 border-t border-white/5"
      >
        Clear search history
      </button>
    </div>
  );
}
