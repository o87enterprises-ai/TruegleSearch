import { PlaySquare, Smartphone } from 'lucide-react';

// The one switch between True Tube and Reels — two distinct feeds, one tap
// apart, the way YouTube's Home / Shorts tabs are. The same control sits on
// the Tube search bar and on the Reels top bar, lit on whichever side you are,
// so going back and forth is always the same thumb movement.
export default function TubeReelsToggle({ active = 'tube', onTube, onReels, className = '' }) {
  const seg = (on) => `flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
    on ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`;
  return (
    <div
      role="group"
      aria-label="Switch between Tube and Reels"
      data-tube-reels-toggle={active}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-sm ${className}`}
    >
      <button type="button" data-toggle-to="tube" aria-pressed={active === 'tube'} onClick={active === 'tube' ? undefined : onTube} className={seg(active === 'tube')}>
        <PlaySquare size={12} /> Tube
      </button>
      <button type="button" data-toggle-to="reels" aria-pressed={active === 'reels'} onClick={active === 'reels' ? undefined : onReels} className={seg(active === 'reels')}>
        <Smartphone size={12} /> Reels
      </button>
    </div>
  );
}
