import { SearchFiltersBar } from '../ui/SearchBar';
import { normalizeFilters } from '../../utils/feedFilters';

// The mainstream search "Filters" control (Sort By · Order · Date), for the Feed.
// Same component, same look. It applies across every platform and category the
// feed shows. Sort By says what it can honestly sort on: the feed's own mix, the
// post's date, or its popularity (likes / votes / points where a platform shares
// them; there are no view counts).
const SORT = [
  { value: 'relevance', label: 'Default' },
  { value: 'date', label: 'Date' },
  { value: 'popularity', label: 'Popularity' },
];
const ORDER = {
  date: [{ value: 'desc', label: 'Newest first' }, { value: 'asc', label: 'Oldest first' }],
  popularity: [{ value: 'desc', label: 'High to Low' }, { value: 'asc', label: 'Low to High' }],
};

export default function FeedFilters({ filters, onChange }) {
  const f = normalizeFilters(filters);
  return (
    <div className="max-w-4xl mx-auto mb-3 px-1" data-feed-filters="">
      <SearchFiltersBar
        filters={f}
        onFiltersChange={(next) => onChange(normalizeFilters(next))}
        options={{ sortBy: SORT, order: ORDER[f.sortBy] || ORDER.date }}
        hideOrderOnRelevance
        themeColor="yellow"
      />
    </div>
  );
}
