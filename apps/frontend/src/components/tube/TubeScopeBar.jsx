import { useState } from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { SEARCH_SCOPES } from '../../utils/playerQuery';
import StationsPanel from './StationsPanel';

// The chip row on /tube. It replaces the full-search CategoryBar (Local, Maps,
// Finance, Shopping…) there: Tube only searches playable media, so the only
// axis worth offering is what KIND of media — the same SEARCH_SCOPES the
// landing page's Tube picker and the player's search already use, so a chip
// here means exactly what it means everywhere else. Styling mirrors
// CategoryBar's cyan chips so the row doesn't look like a different product.
//
// STATIONS is the last chip but not a scope: it opens the live-radio tuner
// under the row (StationsPanel) rather than changing what the search box looks
// for, so it toggles on its own and leaves the scope as it was.
const chip = (on) => `flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-[11px] transition-all backdrop-blur-sm whitespace-nowrap border ${
  on
    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-sm shadow-cyan-500/20'
    : 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400 hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-neutral-800/60'
}`;

export default function TubeScopeBar({ activeScope = 'all', onSelectScope }) {
  const [stations, setStations] = useState(false);
  return (
    <div className="relative w-full mt-2" data-tube-scope-bar="">
      <div className="overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex gap-1.5 min-w-max px-1">
          {SEARCH_SCOPES.map((s) => {
            const isActive = activeScope === s.id;
            return (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => onSelectScope(s.id)}
                aria-pressed={isActive}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className={chip(isActive)}
              >
                {s.label}
              </motion.button>
            );
          })}
          <motion.button
            type="button"
            onClick={() => setStations((v) => !v)}
            aria-pressed={stations}
            aria-expanded={stations}
            data-tube-stations-chip=""
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className={chip(stations)}
          >
            <Radio size={12} />
            Stations
          </motion.button>
        </div>
      </div>
      {stations && <StationsPanel />}
    </div>
  );
}
