import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

// ── BEFORE SIGN-IN: 18+ AND THE TERMS, AGREED, NOT ASSUMED ───────────────────
//
// Owner, 2026-10-08. An account exists to let an adult turn Safe Search off,
// so the sign-in page opens on this and nothing below it is reachable until
// the visitor says they are 18+ and agrees. "No" goes back to searching, with
// Safe Search still on.
//
// TRUTHFULNESS: the owner's brief said "we store no personal info". The one
// thing Truegle's server does keep for an account is the email address the
// code is sent to — that IS the account (routes/auth.js, users.email). So this
// says that, and nothing more: no name, no searches, no history. The device
// list below mirrors what the app really keeps in the browser; if something
// new is stored there, add it here.
export const DEVICE_ITEMS = [
  'Your sign-in — a key that keeps you signed in (only if you choose to stay signed in)',
  'Your settings — Safe Search level, search modes, and whether to keep a search history',
  'Your recent searches — only if you leave search history on',
  'Your player — queue, saved lists, and the 👍/👎 that shape your recommendations',
  'Small "already seen" flags, so tips and tutorials don\'t repeat',
];

export default function AgeGate({ onAccept, onDecline }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div data-age-gate="" className="relative z-10 w-full max-w-lg mx-auto mt-6 mb-10 p-6 rounded-2xl bg-gray-950/90 border border-cyan-500/40 backdrop-blur-xl text-white shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="text-cyan-400" size={22} />
        <h1 className="text-xl font-bold">Are you 18 or older?</h1>
      </div>

      <div className="space-y-3 text-sm text-white/75 leading-relaxed">
        <p>
          <strong className="text-white">Truegle protects children from harmful content.</strong> Safe Search is
          on for everyone, and only a signed-in adult can turn it off. Parental guidance is suggested for
          parents of minors on the internet.
        </p>
        <p>
          <strong className="text-white">If you turn Safe Search off, you accept all liability</strong> for the
          content you choose to see.
        </p>
        <p>
          A <strong className="text-white">one-time activation code</strong> is sent to the email address of your
          choice. We keep that email address — it is your account — and <strong className="text-white">nothing
          else: no name, no search history tied to you, no profile.</strong>
        </p>
        <div>
          <p className="mb-1.5">Everything else stays <strong className="text-white">on this device</strong>, in your browser:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/65">
            {DEVICE_ITEMS.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="mt-1.5 text-white/55 text-xs">
            The red Nuclear Option button, at the bottom of every page, erases all of it at any time.
          </p>
        </div>
        <p>
          As soon as you enter your activation code you&apos;ll be taken to <strong className="text-white">Settings</strong>,
          where you choose how your search storage is handled.
        </p>
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          data-age-agree=""
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-cyan-500"
        />
        <span>I am 18 or older, and I agree to the above.</span>
      </label>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          data-age-yes=""
          disabled={!agreed}
          onClick={onAccept}
          className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors"
        >
          Yes, I&apos;m 18+ — continue
        </button>
        <button
          type="button"
          data-age-no=""
          onClick={onDecline}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 transition-colors"
        >
          No, I&apos;m under 18
        </button>
      </div>
      <p className="mt-3 text-[11px] text-white/40">
        Under 18? You can keep using Truegle without an account — Safe Search stays on.
      </p>
    </div>
  );
}
