import { Lock, ShieldCheck } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

// "Why Search Truegle?" — the three promises (bias, tracking, censorship), as
// the same one-line card as True Tube and Chat Modes.
//
// THE ONE CARD THAT OPENS ITSELF. On a phone it starts retracted and descends
// by itself as you scroll down to it (autoOpenOnScroll); the promise is the
// first thing a visitor should read and is short enough to earn that. On a
// wider screen, and for every other card, opening takes a hand.
//
// The Censorship item is not just a claim — it is a real, working control.
// Toggling it flips the SAME Safe Search setting Settings edits, so a visitor
// never finds Settings disagreeing with what this card told them. The state
// lives in the landing page (it also navigates to sign-in), so it comes in as
// props.
export default function WhyTruegleCard({ safeModeOff, canDisableSafeSearch, toggleSafeMode }) {
  return (
    <div className="mb-4 max-w-3xl mx-auto">
      <div className="w-full max-w-2xl mx-auto px-4">
        <CollapsibleCard
          data-why-card=""
          autoOpenOnScroll
          className="border-white/15 hover:border-purple-400/40"
          header={(
            <>
              <span className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center shadow-lg">
                <ShieldCheck size={16} className="text-white" />
              </span>
              <h2 className="min-w-0 truncate text-base sm:text-lg font-bold gradient-orange-purple bg-clip-text">Why Search Truegle?</h2>
            </>
          )}
        >
          <div className="pt-1">
<p className="text-center text-sm sm:text-base font-semibold tracking-[0.2em] uppercase text-white/70 mb-4">
        Search without…
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        <div className="flex flex-col items-center text-center gap-2 py-3 sm:py-0 sm:px-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg bg-purple-500 border-purple-300 shadow-purple-500/30">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="3" y1="7" x2="11" y2="7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-base text-purple-400">Bias</span>
          <span className="text-white/80 text-sm">All perspectives welcome</span>
        </div>
        <div className="flex flex-col items-center text-center gap-2 py-3 sm:py-0 sm:px-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg bg-green-500 border-green-300 shadow-green-500/30">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="3" y1="7" x2="11" y2="7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-base text-green-400">Tracking</span>
          <span className="text-white/80 text-sm">0 ads, 0 user data, 0 digital ID</span>
        </div>
        {/* Censorship: the one item on this card that is not just a
            claim — it is a real, working control. Toggling it
            flips the SAME Safe Search setting Settings edits, so a
            visitor never finds Settings disagreeing with what this
            card told them. */}
        <div className="flex flex-col items-center text-center gap-2 py-3 sm:py-0 sm:px-4">
          <button
            type="button"
            onClick={toggleSafeMode}
            aria-pressed={safeModeOff}
            title={canDisableSafeSearch ? 'Toggle +18 safe mode' : 'Sign in to turn off Safe Search'}
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg transition-colors ${
              safeModeOff
                ? 'bg-red-500 border-red-300 shadow-red-500/30'
                : 'bg-white/10 border-white/25 hover:border-red-300/60'
            }`}
          >
            {canDisableSafeSearch ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <line x1="3" y1="7" x2="11" y2="7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <Lock size={12} className="text-white/70" />
            )}
          </button>
          <span className="font-bold text-base text-red-400">Censorship</span>
          <button type="button" onClick={toggleSafeMode} className="text-white/80 text-sm hover:text-white transition-colors">
            +18 safe mode {safeModeOff ? 'off' : 'on'} — tap to toggle*
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-white/35">
        *Turning +18 safe mode off needs a verified sign-in (an email confirmation code) — the same bar every age-gated control on Truegle holds to.
      </p>

          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
}
