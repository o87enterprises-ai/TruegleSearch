import { PROVIDERS, SEARCH_SCOPES, channelLabel } from '../../utils/playerQuery';

// The two questions a search has to answer before it can be sharp: WHERE, and
// WHAT KIND. They are separate axes, so they get separate rows — one row mixing
// "YouTube" with "Artist" reads as one list of alternatives when it is two.
//
// Row 1, where. Row 2, what kind — and the Channel chip is RENAMED by row 1,
// because "the channel" is a different address on every platform. On Reddit it
// is a subreddit and it is spelled r/, on SoundCloud it is an artist and has no
// prefix at all. A chip that says "Channel" while the provider is Reddit is
// telling the user something untrue about what the box wants.
//
// One component, used by both bars — the Tube page's and the popped-out
// player's — because a search that behaves differently depending on which box
// you typed it into is the bug this replaces.
export default function PlayerScopeChips({
  provider = 'all',
  scope = 'all',
  onProvider,
  onScope,
  compact = false,
  className = '',
}) {
  const h = compact ? 'h-6' : 'h-7';
  const pad = compact ? 'px-2.5' : 'px-3';
  const text = compact ? 'text-[10px]' : 'text-[11px]';
  const chip = (on) => `shrink-0 ${pad} ${h} rounded-full ${text} font-semibold border transition-colors ${
    on ? 'bg-white/15 border-white/30 text-white' : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white/80'
  }`;

  return (
    <div className={className}>
      <div className={`flex gap-1.5 overflow-x-auto ${compact ? 'px-2 pt-1.5' : 'px-2 pt-2'}`}>
        <span className={`shrink-0 self-center ${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider text-white/25 pr-0.5`}>
          Where
        </span>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onProvider?.(p.id)}
            aria-pressed={provider === p.id}
            className={chip(provider === p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={`flex gap-1.5 overflow-x-auto ${compact ? 'px-2 py-1.5' : 'px-2 py-2'}`}>
        <span className={`shrink-0 self-center ${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider text-white/25 pr-0.5`}>
          What
        </span>
        {SEARCH_SCOPES.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => onScope?.(sc.id)}
            aria-pressed={scope === sc.id}
            className={chip(scope === sc.id)}
          >
            {sc.id === 'channel' ? channelLabel(provider) : sc.label}
          </button>
        ))}
      </div>
    </div>
  );
}
