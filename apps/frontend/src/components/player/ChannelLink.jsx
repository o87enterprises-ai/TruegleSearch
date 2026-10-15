import { ArrowLeft, Loader2 } from 'lucide-react';
import { toHandle } from '../../utils/playerQuery';

// The channel name on a result card, as a way INTO that channel.
//
// It used to be plain text sitting inside the card's play button, so pressing a
// creator's name played the video (and queued the rest of the results behind
// it) — the opposite of what pressing a name means. Here the name opens the
// channel's own feed, newest upload first, and does NOT start anything: the
// clip that is playing keeps playing, and nothing new is launched until a card
// is pressed.
//
// YouTube only, deliberately — /creators/resolve speaks YouTube channel ids and
// nothing else, so on a SoundCloud or Reddit row a button would always fail.
// Those keep plain text.
export function ChannelLink({ row, name, onOpen, className = '' }) {
  if (!name) return null;
  if (row?.kind !== 'youtube') return <span className={`truncate ${className}`}>{name}</span>;
  return (
    <button
      type="button"
      data-open-channel={name}
      // Not the card's press: stop it before it reaches the play target, and
      // before the deck's hold-to-preview sees a pointer-down.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(toHandle(name, 'youtube'), name); }}
      title={`Show ${name}'s videos — latest first`}
      className={`truncate max-w-full text-left hover:text-white hover:underline transition-colors ${className}`}
    >
      {name}
    </button>
  );
}

// The bar that says you are looking at one channel, and the way back.
export function ChannelBar({ handle, loading, onBack, className = '' }) {
  return (
    <div data-channel-bar="" className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        data-channel-back=""
        onClick={onBack}
        className="flex items-center gap-1 px-2 h-7 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white shrink-0 transition-colors"
      >
        <ArrowLeft size={12} /> Results
      </button>
      <span className="text-[11px] uppercase tracking-wider text-white/60 truncate">
        {loading ? 'Opening the channel…' : `@${handle} — newest first`}
      </span>
      {loading && <Loader2 size={12} className="animate-spin text-white/50 shrink-0" />}
    </div>
  );
}
