import { useState } from 'react';
import { ListPlus, Check, Play } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

// The TWO things you can do with any playable link on the page:
//
//   Play          → play it, in the player.
//   Add to queue  → append; whatever is playing is not interrupted at all.
//
// THERE USED TO BE THREE, and that was the complaint. "Play here" mounted a
// second embed inside the result card, "Play now" sent it to the player, and
// "Pop out" did roughly what Play did while also being a window control — three
// doors onto one intention, each behaving slightly differently, none of them
// named after what the person actually wanted. Play here is gone with the
// card's embed; Pop out is a property of the player, not of a link, and happens
// on its own off the Tube page.
//
// WHAT "PLAY" DOES DEPENDS ON THE QUEUE, and deliberately so — it is one
// button, not one behaviour:
//
//   queue armed (you built it, you are following it)
//     → jump the queue. What was playing goes to the FRONT, so when this
//       finishes the player drops straight back in and carries on down the
//       list. Your place is kept, which is what somebody following a list
//       wants and would lose if Play simply replaced the current track.
//   otherwise
//     → just play it. There is no list to keep your place in, and pushing the
//       last thing you watched onto a queue you never asked for is how a queue
//       ends up full of things nobody chose.
//
// One component, so every surface that lists playable media (search results,
// the video grid, chat citations, the shorts feed, a creator page) offers the
// same pair without each one re-deciding what to show.
export default function QueueButton({
  source,
  className = '',
  showLabel = false,
  onAdded,
  showPlayNow = true,
}) {
  const { current, enqueue, playNow, play, queueArmed, queue } = usePlayer();
  const [added, setAdded] = useState(false);
  const [started, setStarted] = useState(false);
  if (!source?.src) return null;

  const playing = !!current;
  // Following a list → keep the place in it. See the note above.
  const followingQueue = queueArmed && queue.length > 0;
  const QueueIcon = added ? Check : ListPlus;
  const btn = 'flex items-center gap-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors';

  return (
    <>
      {showPlayNow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (followingQueue) playNow(source); else play(source);
            setStarted(true);
            setTimeout(() => setStarted(false), 1400);
          }}
          title={followingQueue
            ? 'Play — plays this next, then carries on down your queue from where you were'
            : 'Play'}
          aria-label="Play"
          className={`${btn} ${started ? 'text-green-400' : ''} ${className}`}
        >
          {started ? <Check size={15} /> : <Play size={15} />}
          {showLabel && <span className="text-xs">{started ? 'Playing' : 'Play'}</span>}
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
          : 'Add to queue — line it up without starting it'}
        aria-label="Add to queue"
        className={`${btn} ${added ? 'text-green-400' : ''} ${className}`}
      >
        <QueueIcon size={15} />
        {showLabel && <span className="text-xs">{added ? 'Added' : 'Add to queue'}</span>}
      </button>
    </>
  );
}
