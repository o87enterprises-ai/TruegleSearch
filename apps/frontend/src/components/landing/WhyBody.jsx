import { Lock } from 'lucide-react';

// "Why Truegle?" — the three promises (bias, tracking, censorship). Its tile's
// pitch says the same thing in a line; this is the detail behind it.
//
// The Censorship item is not just a claim — it is a real, working control.
// Toggling it flips the SAME Safe Search setting Settings edits, so a visitor
// never finds Settings disagreeing with what this told them. The state lives in
// the landing page (it also navigates to sign-in), so it comes in as props.
// "Surf Without..." heads each promise. On a phone the three stack, and a bare
// "Bias / Tracking / Censorship" read as a list of things Truegle HAS; the
// lead-in turns each into what you get to do without it (owner, 2026-10-02).
// It replaced the round "(-)" icon that used to sit here. That icon was also
// the Censorship toggle's button — the same toggle is the "+18 safe mode"
// line below, which is now the one control (and carries the sign-in hint).
function SurfWithout({ tone }) {
  return (
    <span data-surf-without="" className={`text-xs tracking-wide font-semibold ${tone}`}>
      Surf Without...
    </span>
  );
}

export default function WhyBody({ safeModeOff, canDisableSafeSearch, toggleSafeMode }) {
  return (
    <div data-why-body="">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        <div className="flex flex-col items-center text-center gap-1.5 py-3 sm:py-0 sm:px-4">
          <SurfWithout tone="text-purple-300/80" />
          <span className="font-bold text-base text-purple-400">Bias</span>
          <span className="text-white/80 text-sm">All perspectives welcome</span>
        </div>
        <div className="flex flex-col items-center text-center gap-1.5 py-3 sm:py-0 sm:px-4">
          <SurfWithout tone="text-green-300/80" />
          <span className="font-bold text-base text-green-400">Tracking</span>
          <span className="text-white/80 text-sm">0 ads, 0 user data, 0 digital ID</span>
        </div>
        {/* Censorship: the one item on this card that is not just a
            claim — it is a real, working control. Toggling it
            flips the SAME Safe Search setting Settings edits, so a
            visitor never finds Settings disagreeing with what this
            card told them. */}
        <div className="flex flex-col items-center text-center gap-1.5 py-3 sm:py-0 sm:px-4">
          <SurfWithout tone="text-red-300/80" />
          <span className="font-bold text-base text-red-400">Censorship</span>
          <button
            type="button"
            onClick={toggleSafeMode}
            aria-pressed={safeModeOff}
            title={canDisableSafeSearch ? 'Toggle +18 safe mode' : 'Sign in to turn off Safe Search'}
            className="inline-flex items-center gap-1.5 text-white/80 text-sm hover:text-white transition-colors"
          >
            {!canDisableSafeSearch && <Lock size={12} className="text-white/60 flex-shrink-0" aria-hidden="true" />}
            <span>+18 safe mode {safeModeOff ? 'off' : 'on'} — tap to toggle*</span>
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-white/35">
        *Turning safe mode off needs a verified sign-in.
      </p>
    </div>
  );
}
