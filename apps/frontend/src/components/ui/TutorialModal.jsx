import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Search, Sparkles, Leaf, TrendingUp, Zap, Lock } from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Truegle',
    subtitle: 'No Bias. No Tracking. No Censorship.',
    icon: Search,
    iconColor: 'from-cyan-500 to-blue-500',
    content: (
      <p className="text-white/70 text-sm leading-relaxed">
        Truegle is a search engine built on one principle: <strong className="text-white">you deserve the full picture.</strong>{' '}
        We pull results from multiple sources, label their bias, and let you decide what to believe.
        No filter bubbles. No data collection.
      </p>
    ),
  },
  {
    id: 'blue',
    title: 'Blue Pill — Standard Search',
    subtitle: 'Clean, fast, unbiased results',
    icon: Search,
    iconColor: 'from-blue-500 to-blue-700',
    pillDot: 'bg-blue-500',
    content: (
      <p className="text-white/70 text-sm leading-relaxed">
        The default search mode. Results come from multiple sources and are ranked by relevance.
        Smart summaries are <em>available but optional</em> — you control whether they appear.
        Great for everyday searching.
      </p>
    ),
  },
  {
    id: 'green',
    title: 'Green Pill — Zero Smart Features',
    subtitle: 'Pure results, no processing',
    icon: Leaf,
    iconColor: 'from-green-600 to-emerald-700',
    pillDot: 'bg-green-500',
    content: (
      <p className="text-white/70 text-sm leading-relaxed">
        For users who want <strong className="text-white">completely unprocessed results</strong>.
        Green Pill disables summaries, the chat assistant, and all smart features.
        Raw search data direct from the source — nothing added, nothing removed.
      </p>
    ),
  },
  {
    id: 'red',
    title: 'Red Pill — Deep Dive',
    subtitle: 'Explore every perspective',
    icon: Search,
    iconColor: 'from-red-600 to-red-800',
    pillDot: 'bg-red-500',
    content: (
      <div className="space-y-2 text-sm text-white/70 leading-relaxed">
        <p>
          Red Pill mode surfaces content from <strong className="text-white">across the political and ideological spectrum</strong> — left, right, center, independent, and fringe.
          Results are labeled with their bias so you can see who's saying what and why.
        </p>
        <p className="text-yellow-400/80 text-xs">
          Free tier: 10 tokens per session (searches + chat). Watch a rewarded ad or subscribe to Premium for unlimited access.
        </p>
      </div>
    ),
  },
  {
    id: 'biased',
    title: 'Biased Search',
    subtitle: 'Filter by perspective',
    icon: TrendingUp,
    iconColor: 'from-purple-600 to-violet-700',
    pillDot: 'bg-purple-500',
    authGated: true,
    content: (
      <div className="space-y-2 text-sm text-white/70 leading-relaxed">
        <p>
          Biased Search lets you <strong className="text-white">intentionally filter results by political lean</strong> — see only left-leaning, right-leaning, or centrist coverage on any topic.
          Great for media literacy and understanding how different outlets frame the same story.
        </p>
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Lock size={12} className="text-purple-400 shrink-0" />
          <span className="text-purple-300/80 text-xs">Requires a free account to access.</span>
        </div>
      </div>
    ),
  },
  {
    id: 'osint',
    title: 'OSINT Mode',
    subtitle: 'Open-source intelligence tools',
    icon: Zap,
    iconColor: 'from-cyan-600 to-teal-700',
    pillDot: 'bg-cyan-500',
    authGated: true,
    content: (
      <div className="space-y-2 text-sm text-white/70 leading-relaxed">
        <p>
          OSINT mode provides <strong className="text-white">ethical digital forensics</strong> — search usernames, emails, phone numbers, and domains across open-source data.
          Built for researchers, journalists, and security professionals.
        </p>
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <Lock size={12} className="text-cyan-400 shrink-0" />
          <span className="text-cyan-300/80 text-xs">Requires a Premium account to access.</span>
        </div>
      </div>
    ),
  },
  {
    id: 'summary',
    title: 'Search Summaries',
    subtitle: 'You are in control',
    icon: Sparkles,
    iconColor: 'from-purple-500 to-cyan-500',
    content: (
      <div className="space-y-2 text-sm text-white/70 leading-relaxed">
        <p>
          After each search, a thin banner will appear offering you a <strong className="text-white">Search Summary</strong>.
          You can choose to show it or dismiss it — your choice is saved for the session.
        </p>
        <p>
          Expand the summary for deeper analysis or click <em>"Ask follow-up"</em> to open the Smart Search Assistant.
        </p>
      </div>
    ),
  },
];

export default function TutorialModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  // Just close without marking done — user can see it again
  const handleClose = () => {
    onClose();
  };

  // "Don't show again" — close and persist the preference
  const handleDontShowAgain = () => {
    try {
      localStorage.setItem('truegle_tutorial_done', 'true');
    } catch {
      // ignore
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 22 }}
            className="bg-gradient-to-br from-[#0d0d1a] to-[#111827] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close (just dismiss, not "don't show again") */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
              title="Close (will show again next visit)"
            >
              <X size={18} />
            </button>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mb-6 pr-8">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-cyan-400 flex-1'
                      : i < step
                      ? 'bg-cyan-400/40 w-4'
                      : 'bg-white/10 w-4'
                  }`}
                />
              ))}
            </div>

            {/* Icon + content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${current.iconColor} flex items-center justify-center mb-4 shadow-lg`}>
                  <current.icon size={22} className="text-white" />
                </div>

                {current.pillDot && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${current.pillDot}`} />
                    <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
                      {current.authGated ? 'Feature Mode' : 'Pill Mode'}
                    </span>
                  </div>
                )}

                <h2 className="text-xl font-bold text-white mb-1">{current.title}</h2>
                <p className="text-xs text-white/40 mb-4">{current.subtitle}</p>

                <div className="mb-6">{current.content}</div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={isFirst}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all disabled:opacity-0 disabled:pointer-events-none"
              >
                <ChevronLeft size={16} />
                Back
              </button>

              <span className="text-xs text-white/30">
                {step + 1} / {STEPS.length}
              </span>

              {isLast ? (
                <button
                  onClick={handleDontShowAgain}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20"
                >
                  Let's go
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 transition-all"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              )}
            </div>

            {/* Don't show again — available from step 1 onward */}
            {!isFirst && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleDontShowAgain}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors underline underline-offset-2"
                >
                  Don't show again
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
