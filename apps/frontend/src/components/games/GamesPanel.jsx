import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Joystick } from 'lucide-react';
import { GAMEBOY_LIBRARY } from '../../data/gameboyLibrary';
import GameBoyPlayer from './GameBoyPlayer';

// The Games search category: a horizontally scrollable strip of
// touch-only emulator games (no keyboard/controller required — see
// GameBoyPlayer). Mirrors the shopping ("As Seen On") panel's shell so
// it lands in the same place in the results flow.
export default function GamesPanel({ onClose }) {
  const [activeGame, setActiveGame] = useState(null);

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-violet-500/50 shadow-lg shadow-violet-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
            <Joystick size={20} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Games</h3>
            <p className="text-sm text-violet-300/70">Free homebrew Game Boy games — playable with touch only</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {GAMEBOY_LIBRARY.map((game) => (
          <motion.button
            key={game.id}
            type="button"
            onClick={() => setActiveGame(game)}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex-shrink-0 w-40 rounded-xl border border-white/10 bg-black/30 hover:border-violet-400/50 text-left overflow-hidden transition-colors"
          >
            <div
              className="h-20 flex items-center justify-center text-4xl"
              style={{ backgroundColor: `${game.color}22` }}
            >
              {game.icon}
            </div>
            <div className="p-3">
              <div className="text-sm font-semibold text-white truncate">{game.name}</div>
              <div className="text-[11px] text-white/50 mt-0.5 line-clamp-2">{game.tagline}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {activeGame && (
          <GameBoyPlayer game={activeGame} onClose={() => setActiveGame(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
