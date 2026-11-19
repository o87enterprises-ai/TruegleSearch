import { useState } from 'react';
import { getLitePref, setLitePref } from '../../utils/liteMode';

const OPTIONS = [
  ['auto', 'Automatic'],
  ['on', 'Lite'],
  ['off', 'Full effects'],
];

// Settings → performance. Lite drops glass blur and decorative motion; nothing is removed.
export default function LiteModeToggle() {
  const [pref, setPref] = useState(getLitePref);
  const choose = (p) => { setLitePref(p); setPref(p); };
  return (
    <div data-lite-mode="" className="mb-6 p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-cyan-500/20 shadow-xl">
      <h2 className="text-lg font-semibold mb-1">Performance</h2>
      <p className="text-sm text-white/60 mb-3">
        Lite mode turns off blur effects and background animation so pages, search and the player feel faster
        on slower phones and computers. Every feature stays. Automatic uses Lite on phones and weaker devices.
      </p>
      <div role="radiogroup" aria-label="Performance mode" className="flex flex-wrap gap-2">
        {OPTIONS.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={pref === id} onClick={() => choose(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${pref === id ? 'bg-cyan-600' : 'bg-white/10 hover:bg-white/20'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
