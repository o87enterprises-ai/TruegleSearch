import { ArrowLeft, Search, Shuffle, Loader2 } from 'lucide-react';
import TubeReelsToggle from './TubeReelsToggle';

// The bar over both reel views: back to where you came from, a search that
// fills the reels feed, Shuffle for a fresh draw from your likes, and the
// Tube/Reels switch.
//
// Placed below the site's own fixed furniture — the nav button (top left,
// z-9998) and the clock (top right, z-9997) sit ABOVE this surface on purpose,
// so a bar at the very top would be a bar nobody could press.
export default function ReelsTopBar({
  value, onChange, onSubmit, onShuffle, onBack, onTube, loading = false, accent = '#f43f5e',
}) {
  const icon = 'shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-black/60 border border-white/15 backdrop-blur-sm text-white/85 hover:text-white';
  return (
    <div
      data-reels-topbar=""
      className="absolute inset-x-0 z-30 flex items-center gap-1.5 px-2.5"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
    >
      <button type="button" data-reels-back="" onClick={onBack} aria-label="Back" title="Back" className={icon}>
        <ArrowLeft size={18} />
      </button>
      <form
        role="search"
        className="flex-1 min-w-0 flex items-center gap-1.5 h-9 px-3 rounded-full bg-black/60 border border-white/15 backdrop-blur-sm focus-within:border-white/40"
        onSubmit={(e) => { e.preventDefault(); e.currentTarget.querySelector('input')?.blur(); onSubmit?.(value); }}
      >
        {loading
          ? <Loader2 size={14} className="shrink-0 animate-spin text-white/50" />
          : <Search size={14} className="shrink-0 text-white/50" />}
        <input
          data-reels-search=""
          type="search"
          enterKeyHint="search"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Search reels"
          aria-label="Search reels"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder-white/40 outline-none"
        />
      </form>
      <button
        type="button"
        data-reels-shuffle=""
        onClick={onShuffle}
        aria-label="Shuffle reels"
        title="Shuffle — fresh reels from what you like"
        className={icon}
        style={{ color: accent }}
      >
        <Shuffle size={16} />
      </button>
      <TubeReelsToggle active="reels" onTube={onTube} />
    </div>
  );
}
