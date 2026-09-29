import { ListMusic, PictureInPicture2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CARD_ACCENT } from './cardTheme';

// Tube, past its tile's pitch: three short points and the way in. "No ads
// ever" stays in the tile's pitch on purpose (owner, 2026-09-25): it is the one
// thing every visitor should learn about the player at a glance.
const POINTS = [
  { icon: ListMusic, label: 'Queue anything' },
  { icon: PictureInPicture2, label: 'Plays while you search' },
  { icon: ShieldCheck, label: 'Sandboxed' },
];

export default function TubeBody({ onOpen }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-tube-body="">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {POINTS.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-white/50">
            <Icon size={12} className="text-white/40" />
            {label}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => (onOpen ? onOpen() : navigate('/tube'))}
        className="self-start text-xs font-semibold"
        style={{ color: CARD_ACCENT.tube }}
      >
        Open Tube →
      </button>
    </div>
  );
}
