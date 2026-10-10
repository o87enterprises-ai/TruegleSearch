import { Search, MessageSquare } from 'lucide-react';

// The ONE fast choice, next to the bar — Google and DuckDuckGo both put a
// single Search/Chat decision beside the box rather than inside a menu, and
// that is the whole idea here. Owner, 2026-10-10: "launches on mainstream
// search by default... a toggle to the right of the search bar that says
// 'search' / 'chat'."
//
// This does NOT replace the pill row above (SmartPill still offers Green /
// Rabbit Hole / Wonderland / Privacy / Feed / Tube, and keeps its own query-
// detection countdown exactly as it was). It is the fast path for the two
// everybody actually reaches for first, and it SYNCS with the pill rather
// than owning separate state: `chat` is active exactly when the pill is
// black, `search` whenever it is anything else — so picking a colour on the
// full pill row moves this toggle too, and this toggle moving the pill is
// indistinguishable from picking it there by hand.
//
// THE GLOW is the one thing that is new chrome rather than reused: a slow
// pulse on the active segment, in that segment's own colour, so a first-time
// visitor's eye finds the one choice that actually matters before it finds
// anything else on the page. It never competes for attention with alerts —
// index.css's ad-glow keyframes are red/amber on purpose; this is a soft,
// slow brand pulse, not a warning.
export default function SearchChatToggle({ mode, onSearch, onChat, className = '' }) {
  const seg = (on) => `relative flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors ${
    on ? 'bg-white text-black toggle-pulse-glow' : 'text-white/60 hover:text-white'}`;
  // The glow's colour follows the active segment — blue for Search (the
  // Mainstream pill's own colour), a soft neutral for Chat.
  const style = (glow) => ({ '--toggle-glow': glow });
  return (
    <div
      role="group"
      aria-label="Search or Chat"
      data-search-chat-toggle={mode}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-black/50 border border-white/15 backdrop-blur-sm shrink-0 ${className}`}
    >
      <button
        type="button"
        data-toggle-to="search"
        aria-pressed={mode === 'search'}
        onClick={mode === 'search' ? undefined : onSearch}
        style={mode === 'search' ? style('rgba(59,130,246,0.55)') : undefined}
        className={seg(mode === 'search')}
      >
        <Search size={13} /> Search
      </button>
      <button
        type="button"
        data-toggle-to="chat"
        aria-pressed={mode === 'chat'}
        onClick={mode === 'chat' ? undefined : onChat}
        style={mode === 'chat' ? style('rgba(229,231,235,0.55)') : undefined}
        className={seg(mode === 'chat')}
      >
        <MessageSquare size={13} /> Chat
      </button>
    </div>
  );
}
