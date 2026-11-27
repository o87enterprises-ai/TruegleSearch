import { useState } from 'react';
import { Search, X } from 'lucide-react';

// The Truegle search bar's look, without the search bar's behaviour.
//
// SearchBar (ui/SearchBar.jsx) is the web-search box: it records what you type
// in search history, offers "<query> news" style suggestions, and carries the
// draft from page to page. All correct for searching the web, all wrong for a
// filter box inside an offline reference — typing "snare" into the encyclopedia
// must not land in the search history, and must not need a network or the
// search bar's bundle (maps, voice, camera) to work.
//
// So this is only the shell: the blue gradient ring that brightens on hover and
// animates on focus (`gradient-shift`, styles/search-components.css), the glow,
// the tilting search icon, the dark pill. Same tokens as SearchBar's 'blue'
// theme so the two read as one instrument. Controlled, no side effects.
const GLOW = {
  focused: '0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(59,130,246,0.15), inset 0 0 30px rgba(59,130,246,0.08)',
  hovered: '0 0 25px rgba(59,130,246,0.25), inset 0 0 15px rgba(59,130,246,0.05)',
  idle: '0 0 15px rgba(59,130,246,0.12)',
};

export default function TruegleSearchField({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel = 'Search',
  autoFocus = false,
  className = '',
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const ring = focused
    ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 p-[2px] opacity-100'
    : hovered
      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 p-[2px] opacity-80'
      : 'bg-blue-700/40 p-[1px] opacity-60';
  const icon = focused ? 'text-blue-300' : hovered ? 'text-blue-400' : 'text-blue-500/80';

  return (
    <div
      className={`relative w-full rounded-2xl transition-shadow duration-300 ease-out ${className}`}
      style={{ boxShadow: focused ? GLOW.focused : hovered ? GLOW.hovered : GLOW.idle }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-2xl transition-all duration-300 ease-out ${ring}`}
        style={{
          backgroundSize: focused ? '200% 200%' : '100% 100%',
          animation: focused ? 'gradient-shift 3s ease infinite' : 'none',
        }}
      >
        <div className="w-full h-full rounded-2xl bg-neutral-900/95" />
      </div>

      <Search
        size={18}
        strokeWidth={2.5}
        aria-hidden="true"
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none
                    transition-all duration-200 ease-out ${icon}
                    ${focused ? 'scale-110 -rotate-12' : ''}`}
      />

      <input
        type="search"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="relative z-[5] block w-full rounded-2xl bg-neutral-900/90 border-0
                   pl-12 pr-11 py-3 text-[15px] font-medium tracking-wide text-neutral-50
                   placeholder:text-neutral-400 placeholder:font-normal
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900
                   selection:bg-blue-500/30
                   [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange({ target: { value: '' } })}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center
                     w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400
                     hover:text-neutral-200 transition-colors"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
