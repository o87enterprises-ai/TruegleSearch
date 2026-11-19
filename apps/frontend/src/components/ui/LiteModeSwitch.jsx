import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { isLiteActive, onLiteChange, setLitePref } from '../../utils/liteMode';

// One-tap Lite mode switch (utils/liteMode.js), shown in several places at once: under the
// clock ('chip'), in the hamburger drawer ('row') — and Settings keeps the full
// Automatic / Lite / Full control. All of them read the same event, so flipping one updates
// the rest. Tapping sets an explicit on/off (it leaves Automatic).
export function useLiteActive() {
  const [on, setOn] = useState(isLiteActive);
  useEffect(() => onLiteChange(setOn), []);
  return on;
}

export default function LiteModeSwitch({ variant = 'chip' }) {
  const on = useLiteActive();
  const toggle = () => setLitePref(on ? 'off' : 'on');

  if (variant === 'row') {
    return (
      <button
        type="button"
        data-lite-switch="row"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors border-t border-white/10 mt-2"
      >
        <Zap size={14} className={on ? 'text-cyan-300' : 'text-white/40'} />
        <span className="flex-1 text-left">
          Lite mode
          <span className="block text-[11px] font-normal text-white/40">Faster on slow devices — no blur or motion</span>
        </span>
        <span className={`relative inline-block w-9 h-5 rounded-full transition-colors ${on ? 'bg-cyan-500' : 'bg-white/20'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-lite-switch="chip"
      role="switch"
      aria-checked={on}
      aria-label="Lite mode"
      title={on ? 'Lite mode on — tap for full effects' : 'Lite mode off — tap for faster, simpler pages'}
      onClick={toggle}
      className={`fixed top-[52px] right-3 z-[9997] flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border shadow-lg select-none ${
        on ? 'bg-cyan-600/90 border-cyan-300/40 text-white' : 'bg-[#13131f]/90 border-white/15 text-white/60 hover:text-white'
      }`}
    >
      <Zap size={11} />
      Lite {on ? 'on' : 'off'}
    </button>
  );
}
