import { useState } from 'react';
import { PictureInPicture2, ListPlus, Check, Play } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

// The two things you can do with any playable link on the page, side by side,
// because they are genuinely different intentions:
//
//   Play now      → jump the queue. What was playing goes to the FRONT of the
//                   queue, so when this finishes the player drops straight back
//                   into it and carries on down the list. Nothing is dropped,
//                   nothing behind it is reordered, and your place is kept.
//   Add to queue  → append; whatever is playing is not interrupted at all.
//
// With nothing playing yet, "Play now" simply starts the player — same button,
// no special case to explain.
//
// Both live in one component so every surface that lists playable media (search
// results, the video grid, chat citations, the shorts feed, a creator page)
// offers the same pair without each one re-deciding what to show.
export default function QueueButton({
  source,
  className = '',
  showLabel = false,
  onAdded,
  showPlayNow = true,
}) {
  const { current, enqueue, playNow } = usePlayer();
  const [added, setAdded] = useState(false);
  const [started, setStarted] = useState(false);
  if (!source?.src) return null;

  const playing = !!current;
  const queueLabel = playing ? 'Add to queue' : 'Pop out';
  const QueueIcon = added ? Check : playing ? ListPlus : PictureInPicture2;
  const btn = 'flex items-center gap-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors';

  return (
    <>
      {showPlayNow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playNow(source);
            setStarted(true);
            setTimeout(() => setStarted(false), 1400);
          }}
          title={playing
            ? 'Play now — plays this next, then goes back to what you were on and carries on down the queue'
            : 'Play now'}
          aria-label="Play now"
          className={`${btn} ${started ? 'text-green-400' : ''} ${className}`}
        >
          {started ? <Check size={15} /> : <Play size={15} />}
          {showLabel && <span className="text-xs">{started ? 'Playing' : 'Play now'}</span>}
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          enqueue(source);
          setAdded(true);
          setTimeout(() => setAdded(false), 1400);
          onAdded?.();
        }}
        title={playing
          ? 'Add to queue — keeps playing while you keep scrolling'
          : 'Pop out — keep playing while you browse'}
        aria-label={queueLabel}
        className={`${btn} ${added ? 'text-green-400' : ''} ${className}`}
      >
        <QueueIcon size={15} />
        {showLabel && <span className="text-xs">{added ? 'Added' : queueLabel}</span>}
      </button>
    </>
  );
}
