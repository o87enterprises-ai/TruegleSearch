import { useNavigate } from 'react-router-dom';

// The search-mode selector that sits under the feed's search bar.
//
// WHAT IT IS FOR: on /feed the search bar searches THE FEEDS, not the web.
// That is the right default here and the wrong one about a third of the time,
// so rather than overloading one bar with a hidden meaning, the meaning is
// visible and switchable. Picking a mode is a navigation, because each mode
// genuinely is a different page with a different search bar behind it — Web
// has categories and lenses, Chat has chat lenses, Tube has the player. Faking
// all four inside one bar is how the search page reached 2600 lines.
//
// `feed` is the only one that does not navigate: it is already here.

const MODES = [
  { id: 'feed', label: 'Feed', to: null },
  { id: 'tube', label: 'Tube', to: '/feed/tube' },
  { id: 'web', label: 'Web', to: '/search' },
  { id: 'chat', label: 'Chat', to: '/chat' },
];

export default function FeedModeSelector({ active = 'feed', query = '' }) {
  const navigate = useNavigate();

  const go = (m) => {
    if (!m.to) return;
    // Carry the query across. Losing what you typed because you changed your
    // mind about where to search it is the most annoying possible outcome of
    // pressing one of these.
    const q = query.trim();
    navigate(q ? `${m.to}?q=${encodeURIComponent(q)}` : m.to);
  };

  return (
    <div
      className="flex items-center gap-1"
      role="tablist"
      aria-label="Search mode"
      data-feed-mode-selector=""
    >
      {MODES.map((m) => {
        const on = m.id === active;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-feed-mode={m.id}
            onClick={() => go(m)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              on
                ? 'text-white border-white/30 bg-white/[0.08]'
                : 'text-white/50 border-transparent hover:text-white/80 hover:border-white/15'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
