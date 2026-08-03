import { useState } from 'react';
import { PictureInPicture2, ListPlus, Check } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

// One button for every playable link on the page. Its job changes with the
// player's state, because the same dispatch means two different things to a
// user:
//   • nothing playing → "Pop out" (starts the persistent player)
//   • already playing → "Add to queue" (appends, playback is uninterrupted)
// Same behavior the reducer always had; the affordance was just invisible,
// so nobody knew they could keep stacking media while they scrolled.
export default function QueueButton({ source, className = '', showLabel = false, onAdded }) {
  const { current, enqueue } = usePlayer();
  const [added, setAdded] = useState(false);
  if (!source?.src) return null;

  const playing = !!current;
  const label = playing ? 'Add to queue' : 'Pop out';
  const Icon = added ? Check : playing ? ListPlus : PictureInPicture2;

  return (
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
      aria-label={label}
      className={`flex items-center gap-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors ${added ? 'text-green-400' : ''} ${className}`}
    >
      <Icon size={15} />
      {showLabel && <span className="text-xs">{added ? 'Added' : label}</span>}
    </button>
  );
}
