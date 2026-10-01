import { Clock, X } from 'lucide-react';

/**
 * A search-history dropdown for boxes that are not SearchBar (Chat's input).
 * Same data as the search bar (utils/searchHistory) and the same promise: every
 * entry can be taken out, and the whole list can be emptied. `placement`
 * decides which way it opens — Chat's box sits at the bottom of the screen, so
 * it opens upward.
 */
export default function SearchHistoryList({ items, onPick, onRemove, onClear, query = '', placement = 'up', borderClass = 'border-white/15' }) {
  if (!items.length) return null;
  const place = placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2';
  return (
    <div
      data-search-history=""
      role="listbox"
      aria-label="Search history"
      className={`absolute left-0 right-0 ${place} z-50 rounded-xl border ${borderClass} bg-neutral-900/98 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden`}
    >
      <div className="max-h-[min(50vh,360px)] overflow-y-auto overscroll-contain">
        {items.map((text) => (
          <div key={text} className="flex items-stretch border-b border-neutral-800/50 last:border-b-0 hover:bg-neutral-800/80 text-neutral-200">
            <button
              type="button"
              role="option"
              aria-selected="false"
              data-suggestion="recent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(text)}
              className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left"
            >
              <Clock size={16} className="text-neutral-500 flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm">{text}</span>
            </button>
            <button
              type="button"
              data-history-remove=""
              aria-label={`Remove "${text}" from search history`}
              title="Remove from history"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRemove(text)}
              className="px-3 flex items-center text-neutral-500 hover:text-neutral-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {!query.trim() && (
        <button
          type="button"
          data-history-clear=""
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          className="w-full px-4 py-2 text-xs text-left text-neutral-500 hover:text-neutral-200 border-t border-neutral-800/60"
        >
          Clear search history
        </button>
      )}
    </div>
  );
}
