import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import TruegleLogo from '../components/ui/TruegleLogo';
import { vaultFound } from '../utils/vault';

// Lazy, and that is the whole point: someone who mistypes a URL, reads "404"
// and leaves downloads none of the game — and none of the encyclopedia, which
// is another forty kilobytes nobody asked for.
const TrailGame = lazy(() => import('../components/TrailGame'));
const Encyclopedia = lazy(() => import('../components/Encyclopedia'));

const NotFound = () => {
  const [playing, setPlaying] = useState(false);
  const [reading, setReading] = useState(false);
  // Read ONCE at mount rather than every render: the game writes this flag on
  // the arrival screen, and re-reading it mid-render would pop the link into
  // existence behind a full-screen game for no reason.
  const [found, setFound] = useState(() => vaultFound());
  // The hint stays away until you have been here long enough to be stuck.
  // Arriving on a 404 and being immediately offered a game reads as marketing;
  // finding one after a few seconds of "well, now what" reads as a discovery,
  // which is the only version of this worth building.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHint(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Stable, so the game is not handed a new prop on every render of this
  // page. The game guards against remounting on its own too — but a page
  // that re-renders should not be asking it to.
  const stopPlaying = useCallback(() => setPlaying(false), []);
  const stopReading = useCallback(() => setReading(false), []);
  // Arriving at the settlement. Close the game, open what they kept, and leave
  // the door unlocked from now on — winning a five-hundred-mile survival game
  // every time you want to look up how to purify water would be a joke at the
  // reader's expense.
  const openVault = useCallback(() => {
    setFound(true);
    setPlaying(false);
    setReading(true);
  }, []);

  if (playing) {
    return (
      <Suspense fallback={<div className="fixed inset-0 z-[100] bg-black" />}>
        <TrailGame onClose={stopPlaying} onFound={openVault} />
      </Suspense>
    );
  }

  if (reading) {
    return (
      <Suspense fallback={<div className="fixed inset-0 z-[100] bg-[#0d0f12]" />}>
        <Encyclopedia onClose={stopReading} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-8"
      >
        <TruegleLogo size="large" animated />

        <div>
          {/* The numerals ARE the door. No button, no badge — the thing already
              on the page turns out to do something. */}
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="404 — page not found. Press to play Trail."
            className="group cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-xl px-2"
          >
            <p className="text-7xl font-black text-white tracking-tight transition-colors group-hover:text-cyan-100">
              404<span className="text-cyan-400 group-hover:text-cyan-300">?!</span>
            </p>
          </button>
          <p className="mt-3 text-white/50 text-lg font-medium">Page Not Found</p>
          <p
            className={`mt-2 text-[11px] font-mono tracking-widest transition-opacity duration-1000 ${
              hint ? 'opacity-100 text-white/25' : 'opacity-0'
            }`}
          >
            THE NUMBERS DO SOMETHING
          </p>
        </div>

        <Link
          to="/"
          className="px-8 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors"
        >
          Return to Truegle
        </Link>

        {/* Hidden until it has been found, and then permanent. Plain text and
            a plain word: on the day somebody actually needs this, a puzzle
            would be an insult. */}
        {found && (
          <button
            type="button"
            onClick={() => setReading(true)}
            className="-mt-3 text-[11px] font-mono tracking-widest text-emerald-300/50
                       hover:text-emerald-300 transition-colors focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded px-2 py-1"
          >
            THE SURVIVOR&apos;S ENCYCLOPEDIA
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default NotFound;
