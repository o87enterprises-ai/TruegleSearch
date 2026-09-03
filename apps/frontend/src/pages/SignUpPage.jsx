import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
// import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'; // premium pay flow — coming soon
import {
  Mail, Phone, ArrowRight, Check, Sparkles, Zap, Eye,
  Clock, CreditCard, Lock,
} from 'lucide-react';
import TruegleLogo from '../components/ui/TruegleLogo';
import MolecularBackground from '../components/backgrounds/MolecularBackground';
import CursorGlow from '../components/ui/CursorGlow';

// const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'; // premium pay flow — coming soon
// const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb';      // premium pay flow — coming soon

// ── Premium pricing tiers (displayed as Coming Soon, all inputs disabled) ────
const PREMIUM_TIERS = [
  {
    id: 'monthly',
    icon: Sparkles,
    label: 'Standard',
    badge: 'Most Popular',
    badgeColor: 'yellow',
    price: '$4.99',
    period: '/mo',
    strikethrough: '$9.99',
    discount: '50% off launch price',
    description: 'Supports the project. Billed monthly. (Nothing here is ad-supported.)',
    ctaLabel: 'Subscribe — $4.99/mo',
    input: null,
  },
  {
    id: 'prepaid6',
    icon: CreditCard,
    label: '6-Month Prepay',
    badge: 'Best Value',
    badgeColor: 'emerald',
    price: '$12.47',
    period: '/6 mo',
    strikethrough: '$49.99',
    discount: '75% off',
    description: 'Pay once for 6 months and save the most.',
    ctaLabel: 'Prepay 6 months — $12.47',
    input: null,
  },
  {
    id: 'monthly3',
    icon: Clock,
    label: '3-Month Special',
    badge: '50% off × 3',
    badgeColor: 'blue',
    price: '$2.50',
    period: '/mo for 3 mo',
    strikethrough: '$4.99',
    discount: '50% off, month-to-month',
    description: 'Half price for your first 3 months, cancel anytime.',
    ctaLabel: 'Start at $2.50/mo',
    input: null,
  },
];

const BADGE_COLORS = {
  yellow:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  blue:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
  purple:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cyan:    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('main'); // 'main' | 'confirmed'
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySaved, setNotifySaved] = useState(false);

  // Nothing to enrol in any more — the daily token quota this used to seed died
  // with the freemium meter. The button now only advances the page.
  const startFree = () => setStep('confirmed');

  const saveNotifyEmail = (e) => {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    // TODO: POST to waitlist endpoint when premium launches
    // await fetch(`${BACKEND}/api/waitlist`, { method: 'POST', body: JSON.stringify({ email: notifyEmail }) });
    setNotifySaved(true);
  };

  // ── PREMIUM PAY FLOW — commented out until payment processing is live ─────
  // const handleContactSubmit = async (e) => { ... }  // registers pending user + creates PayPal order
  // const createOrder = () => paypalOrderId;
  // const onApprove = async (data) => { ... }         // captures order, returns access code
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen relative bg-[#060e1a] overflow-hidden">
      <MolecularBackground />
      <CursorGlow />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-start px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <TruegleLogo size="medium" />
            <p className="text-white/50 text-sm mt-2">private search, your rules</p>
          </div>

          <AnimatePresence mode="wait">

            {/* ── Main view ──────────────────────────────────────────────── */}
            {step === 'main' && (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                {/* ── Free-access hero card (primary / active) ──────────── */}
                <div className="bg-gradient-to-br from-white/8 to-white/4 border border-white/15 rounded-2xl p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={18} className="text-cyan-400" />
                    <span className="text-white font-bold text-lg">Start Searching — Free</span>
                  </div>
                  <p className="text-white/55 text-sm mb-5">
                    No account, no credit card, no cookies, no ads. Search as much as you
                    like — there is no meter and nothing to top up.
                  </p>

                  <ul className="space-y-2 mb-6">
                    {[
                      'Core web, image & news search',
                      'Unlimited searches — no daily cap',
                      'Quick Answer cards & AI snippets',
                      'No ads, no cookies, no tracking',
                      'One free OSINT investigation — an account lifts the limit',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                        <Check size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={startFree}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40"
                  >
                    <Zap size={16} />
                    Start Searching Free
                    <ArrowRight size={16} />
                  </button>

                  <p className="text-center text-white/30 text-xs mt-3">
                    Already have an access code?{' '}
                    <button
                      onClick={() => navigate('/auth/login', { state: { showCodeEntry: true } })}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Sign in
                    </button>
                  </p>
                </div>

                {/* ── Premium — Coming Soon ──────────────────────────────── */}
                <div className="relative">
                  {/* Coming Soon overlay label */}
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <div className="flex-1 h-px bg-white/10" />
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-yellow-400" />
                      <span className="text-yellow-400/90 text-xs font-semibold uppercase tracking-widest">
                        Premium — Coming Soon
                      </span>
                      <Sparkles size={13} className="text-yellow-400" />
                    </div>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <p className="text-white/40 text-xs text-center mb-4 px-2">
                    Premium is launching soon at <span className="line-through text-white/25">$9.99/mo</span>{' '}
                    <span className="text-yellow-300 font-semibold">$4.99/mo</span> — 50% off for early adopters.
                    Preview the plans below. Enter your email to be notified at launch.
                  </p>

                  {/* Notify-me email (no backend call yet) */}
                  <form onSubmit={saveNotifyEmail} className="flex gap-2 mb-5">
                    <input
                      type="email"
                      id="notify-email"
                      name="notify-email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="you@example.com — notify me at launch"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/40 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={notifySaved}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white text-sm rounded-xl transition-all disabled:opacity-60 flex-shrink-0"
                    >
                      {notifySaved ? <Check size={15} className="text-emerald-400" /> : 'Notify me'}
                    </button>
                  </form>
                  {notifySaved && (
                    <p className="text-emerald-400 text-xs text-center mb-3">
                      You're on the list — we'll email you at launch.
                    </p>
                  )}

                  {/* Premium tier cards — all disabled */}
                  <div className="space-y-3">
                    {PREMIUM_TIERS.map((tier) => {
                      const Icon = tier.icon;
                      return (
                        <div
                          key={tier.id}
                          className="relative bg-white/[0.03] border border-white/8 rounded-2xl p-5 backdrop-blur-xl opacity-60 cursor-not-allowed select-none"
                        >
                          {/* Lock overlay */}
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-full px-2 py-1">
                            <Lock size={10} className="text-white/40" />
                            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Coming Soon</span>
                          </div>

                          {/* Header row */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                              <Icon size={17} className="text-white/50" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/80 font-semibold text-sm">{tier.label}</span>
                                {tier.badge && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${BADGE_COLORS[tier.badgeColor]}`}>
                                    {tier.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-white/40 text-xs mt-0.5">{tier.description}</p>
                            </div>
                          </div>

                          {/* Pricing row */}
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-white/80 font-bold text-xl">{tier.price}</span>
                            <span className="text-white/40 text-sm">{tier.period}</span>
                            {tier.strikethrough && (
                              <span className="text-white/25 text-sm line-through">{tier.strikethrough}</span>
                            )}
                            <span className="ml-auto text-white/40 text-xs">{tier.discount}</span>
                          </div>

                          {/* Optional input (grayed) */}
                          {tier.input && (
                            <input
                              type="text"
                              placeholder={tier.input.placeholder}
                              disabled
                              className="w-full mb-3 px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-white/30 placeholder-white/20 text-sm cursor-not-allowed"
                            />
                          )}

                          {/* CTA button (grayed) */}
                          <button
                            disabled
                            className="w-full py-2.5 bg-white/8 border border-white/10 text-white/30 text-sm font-semibold rounded-xl cursor-not-allowed"
                          >
                            {tier.ctaLabel}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-center text-white/25 text-xs mt-4">
                    All premium plans are disabled while payment processing is being set up.
                    Free access is fully functional now.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Free access confirmed ──────────────────────────────────── */}
            {step === 'confirmed' && (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.15, stiffness: 220 }}
                  className="w-16 h-16 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4"
                >
                  <Eye size={28} className="text-cyan-400" />
                </motion.div>

                <h2 className="text-xl font-bold text-white mb-1">You're in.</h2>
                <p className="text-white/55 text-sm mb-6">
                  Search as much as you like — there is no daily limit and nothing to buy.
                  An account only lifts the one-investigation limit on OSINT.
                </p>

                <button
                  onClick={() => navigate('/search')}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Zap size={16} />
                  Start searching
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => setStep('main')}
                  className="mt-3 w-full py-2 text-white/35 hover:text-white/60 text-sm transition-colors"
                >
                  ← Back
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
