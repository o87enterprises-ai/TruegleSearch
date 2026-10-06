import { X, Camera } from 'lucide-react';
import CameraView from './CameraView';

// "Watch all in view" — the god's-eye wall: every live camera on screen at
// once, nearest the middle first, capped at twelve so a phone is not asked to
// pull fifty feeds. Tap one to open it full size.
export default function CameraWall({ cameras, onOpen, onClose }) {
  const shown = cameras.slice(0, 12);
  return (
    <div
      data-camera-wall=""
      className="absolute inset-0 z-[72] bg-black/85 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-3 py-2 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold flex items-center gap-2"><Camera size={15} className="text-amber-400" /> {shown.length} live camera{shown.length === 1 ? '' : 's'} in view</p>
        <button type="button" onClick={onClose} aria-label="Close the camera wall" className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 content-start" onClick={(e) => e.stopPropagation()}>
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            data-camera-tile={c.id}
            onClick={() => onOpen(c)}
            className="text-left rounded-lg overflow-hidden border border-amber-400/30 bg-neutral-900 hover:border-amber-300"
          >
            <div className="aspect-video bg-black">
              <CameraView camera={c} autoPlay={false} className="w-full h-full object-cover" />
            </div>
            <p className="px-1.5 py-1 text-[10px] text-white/80 truncate">{c.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
