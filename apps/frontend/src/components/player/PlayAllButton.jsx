import { Loader2, ListVideo } from 'lucide-react';
import { usePlayAll } from '../../hooks/usePlayAll';

/**
 * The one button a playlist link gets: Play All. Saves it to Lists, replaces
 * the queue with it and plays track one — see usePlayAll. Used by the pasted-
 * link card, chat, the player's list and the player's viewport, so the wording
 * and the behaviour are the same wherever a playlist turns up.
 */
export default function PlayAllButton({ url, className = '', size = 14, onDone }) {
  const { playAll, busy, message } = usePlayAll();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        data-play-all=""
        disabled={busy}
        onClick={async (e) => {
          e.stopPropagation();
          const r = await playAll(url);
          if (r.ok) onDone?.(r);
        }}
        className={`inline-flex items-center gap-2 font-semibold transition-colors disabled:opacity-60 ${className}`}
      >
        {busy ? <Loader2 size={size} className="animate-spin" /> : <ListVideo size={size} />}
        {busy ? 'Loading playlist…' : 'Play All'}
      </button>
      {message && <span data-play-all-message="" className="text-[11px] text-white/55 leading-snug max-w-xs">{message}</span>}
    </span>
  );
}
