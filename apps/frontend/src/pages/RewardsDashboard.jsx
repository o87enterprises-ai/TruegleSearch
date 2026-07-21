import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRewards } from '../context/RewardsContext';
import { useAuth } from '../context/AuthContext';
import { rewardsAPI } from '../services/api';
import RewardAdSlot from '../components/RewardAdSlot';
import TruegleLogo from '../components/ui/TruegleLogo';
import LandingBackground from '../components/LandingBackground';
import { formatMicros } from '../utils/rewardsFormat';

/*
 * /rewards — the Rewards Program dashboard.
 *
 * Opt in/out, see your balance and history, and request a cash-out. This is
 * deliberately honest about the current state of payouts: requests queue for
 * manual processing until an automated payout method (e.g. Stripe Connect) is
 * configured, rather than pretending a transfer happened.
 */
const RewardsDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { optedIn, balanceMicros, lifetimeEarnedMicros, config, loading, fetchStatus, optIn, optOut } = useRewards();
  const [ledger, setLedger] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutMethod, setPayoutMethod] = useState('paypal');
  const [destination, setDestination] = useState('');
  const [payoutMessage, setPayoutMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toggleError, setToggleError] = useState(null);

  const PAYOUT_METHODS = {
    paypal:  { label: 'PayPal',          field: 'PayPal email address' },
    cashapp: { label: 'Cash App',        field: '$Cashtag (e.g. $yourname)' },
    venmo:   { label: 'Venmo',           field: '@Username (e.g. @yourname)' },
    zelle:   { label: 'Zelle',           field: 'Phone number or email' },
    chime:   { label: 'Chime',           field: 'Chime $tag or email' },
    fbpay:   { label: 'Meta Pay',        field: 'Facebook account email' },
    bank:    { label: 'Bank / ACH',      field: 'Routing number, Account number (comma-separated)' },
  };

  const loadHistory = useCallback(async () => {
    if (!optedIn) return;
    try {
      const [ledgerRes, payoutsRes] = await Promise.all([
        rewardsAPI.getLedger(50),
        rewardsAPI.getPayouts(),
      ]);
      setLedger(ledgerRes.data.data || []);
      setPayouts(payoutsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load rewards history:', error);
    }
  }, [optedIn]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleToggle = async () => {
    setToggleError(null);
    const result = optedIn ? await optOut() : await optIn();
    if (result.success) {
      await fetchStatus();
    } else {
      setToggleError(result.message || 'Something went wrong — please try again.');
    }
  };

  const handlePayoutRequest = async (e) => {
    e.preventDefault();
    if (!destination.trim()) return;
    setSubmitting(true);
    setPayoutMessage(null);
    try {
      const response = await rewardsAPI.requestPayout(payoutMethod, destination.trim());
      setPayoutMessage({ type: 'success', text: response.data.data.message });
      setDestination('');
      await fetchStatus();
      await loadHistory();
    } catch (error) {
      setPayoutMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to request payout',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const minPayoutMicros = config?.minPayoutMicros ?? 1_000_000;
  const maxPayoutMicros = config?.maxPayoutMicros ?? 50_000_000;
  const feePercent = config?.processingFeePercent ?? 0.10;
  const grossMicros = Math.min(balanceMicros, maxPayoutMicros);
  const feeMicros = Math.round(grossMicros * feePercent);
  const netMicros = grossMicros - feeMicros;
  const canRequestPayout = optedIn && balanceMicros >= minPayoutMicros;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Same cinematic hero background as the search pages */}
      <LandingBackground />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12">
        {/* Hero — big logo, then the opt-in message (first-time / not-opted-in
            only), then the Rewards pill. Matches the search page's layout. */}
        <div className="flex flex-col items-center text-center mb-8">
          <button onClick={() => navigate('/')} className="mb-3" aria-label="Home">
            <div className="scale-90 sm:scale-100">
              <TruegleLogo size="xlarge" animated />
            </div>
          </button>

          {/* Opt-in message: below the logo, above the pill — shown only to
              users who haven't opted in yet; hidden for returning members. */}
          {!optedIn && (
            <div className="max-w-xl mt-3 mb-5">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Get paid for the ads you already see</h1>
              <p className="text-white/70 text-sm">
                Opt in and Truegle pays you a small cash reward for ads you genuinely view — no extra
                ads, no extra tracking beyond what this program requires. Honestly measured
                server-side; nothing is simulated.
              </p>
            </div>
          )}

          {/* Rewards pill (mode indicator, mirrors the search page's pill) */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold select-none">
              Rewards
            </span>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: '#f97316' }}
            >
              <span className="w-2 h-2 rounded-full bg-white/90 flex-shrink-0" />
              Rewards
            </div>
          </div>
        </div>

        {/* Status card */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm text-white/60 mb-1">Program status</div>
              <div className="text-lg font-semibold">
                {optedIn ? (
                  <span className="text-orange-400">Opted in</span>
                ) : (
                  <span className="text-white/60">Not opted in</span>
                )}
              </div>
            </div>
            {isAuthenticated ? (
              <button
                onClick={handleToggle}
                disabled={loading}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                  optedIn
                    ? 'bg-white/10 hover:bg-white/20 border border-white/20'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90'
                }`}
              >
                {optedIn ? 'Opt out' : 'Opt in to Rewards'}
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth/login', { state: { redirectTo: '/rewards' } })}
                className="px-5 py-2.5 rounded-xl font-semibold transition-all bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90"
              >
                Sign in to opt in
              </button>
            )}
          </div>

          {!isAuthenticated && (
            <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3">
              Rewards are a real cash payout, so opting in requires a signed-in account — you can browse this page without one, but you'll need to sign in to actually opt in.
            </p>
          )}

          {toggleError && (
            <p className="text-sm text-red-400 mt-3">{toggleError}</p>
          )}

          {optedIn && (
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <div className="text-sm text-white/60 mb-1">Current balance</div>
                <div className="text-2xl font-bold text-orange-400">{formatMicros(balanceMicros)}</div>
              </div>
              <div>
                <div className="text-sm text-white/60 mb-1">Lifetime earned</div>
                <div className="text-2xl font-bold">{formatMicros(lifetimeEarnedMicros)}</div>
              </div>
            </div>
          )}

          {!optedIn && (
            <p className="text-sm text-white/50 mt-4">
              Opting in lets us record which ads you actually viewed (duration only — never which
              sites you searched) so we can pay you for them. See our{' '}
              <Link to="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>{' '}
              and{' '}
              <Link to="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>{' '}
              for details. You can opt out at any time.
            </p>
          )}
        </div>

        {optedIn && (
          <>
            {/* Payout request */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
              <h2 className="text-lg font-semibold mb-3">Request a payout</h2>

              {!config?.payoutsAutomated && (
                <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                  Payouts are processed manually (3–5 business days). Submitting queues your request — money moves after manual review.
                </p>
              )}

              {/* Balance / fee summary */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="bg-black/30 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-white/50 mb-1">Your balance</div>
                  <div className="font-bold text-white">{formatMicros(balanceMicros)}</div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-white/50 mb-1">10% fee</div>
                  <div className="font-bold text-red-400">−{formatMicros(feeMicros)}</div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 border border-orange-500/30">
                  <div className="text-xs text-white/50 mb-1">You receive</div>
                  <div className="font-bold text-orange-400">{formatMicros(netMicros)}</div>
                </div>
              </div>

              <p className="text-xs text-white/40 mb-4">
                Min: {formatMicros(minPayoutMicros)} · Max per request: {formatMicros(maxPayoutMicros)} · Excess stays in your balance
              </p>

              <form onSubmit={handlePayoutRequest} className="space-y-3">
                {/* Method selector */}
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Payout method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(PAYOUT_METHODS).map(([key, { label }]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setPayoutMethod(key); setDestination(''); }}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                          payoutMethod === key
                            ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                            : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">
                    {PAYOUT_METHODS[payoutMethod]?.field || 'Destination'}
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={PAYOUT_METHODS[payoutMethod]?.field}
                    disabled={!canRequestPayout || submitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-orange-400 disabled:opacity-50 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canRequestPayout || submitting || !destination.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-semibold hover:opacity-90 transition-all disabled:opacity-40 text-sm"
                >
                  {submitting ? 'Submitting…' : `Request ${formatMicros(netMicros)} via ${PAYOUT_METHODS[payoutMethod]?.label}`}
                </button>
              </form>

              {payoutMessage && (
                <p className={`text-sm mt-3 ${payoutMessage.type === 'success' ? 'text-orange-400' : 'text-red-400'}`}>
                  {payoutMessage.text}
                </p>
              )}
            </div>

            {/* Payout history */}
            {payouts.length > 0 && (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
                <h2 className="text-lg font-semibold mb-3">Payout requests</h2>
                <div className="space-y-2">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                      <span className="text-white/70">{new Date(p.requested_at).toLocaleDateString()}</span>
                      <span className="font-medium">{formatMicros(p.amount_micros)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'paid'
                            ? 'bg-orange-500/20 text-orange-400'
                            : p.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ledger */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold mb-3">Activity</h2>
              {ledger.length === 0 ? (
                <p className="text-sm text-white/50">
                  No activity yet — watch ads while a search is loading to start earning.
                </p>
              ) : (
                <div className="space-y-2">
                  {ledger.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                      <span className="text-white/70">{new Date(entry.created_at).toLocaleString()}</span>
                      <span className="text-white/60 capitalize">{entry.entry_type.replace(/_/g, ' ')}</span>
                      <span className={`font-medium ${entry.amount_micros >= 0 ? 'text-orange-400' : 'text-white/80'}`}>
                        {entry.amount_micros >= 0 ? '+' : ''}{formatMicros(entry.amount_micros)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Real Adsterra inventory only on this page — no house/affiliate ads,
            so every ad shown here is one you can actually get paid for. Every
            zone renders by default (no search query needed). Any slot whose
            Adsterra key isn't currently live (e.g. zones pulled for safety)
            simply renders nothing — see config/ads.js. */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-orange-400/80 mb-3 font-mono">
            Advertisement
          </div>
          <div className="flex flex-col items-center gap-4">
            <RewardAdSlot size="leaderboard" />
            <RewardAdSlot size="medium" />
            <RewardAdSlot size="native" />
            <RewardAdSlot size="large" />
            <RewardAdSlot size="small" />
            <RewardAdSlot size="sidebar" />
          </div>
          <p className="text-white/30 text-xs text-center mt-4">
            Every live ad zone loads here automatically. The three legacy
            adult-locked zones stay hidden until Adsterra clears them.
          </p>
        </div>

        <div className="mt-8 text-sm text-white/50">
          <Link to="/settings" className="hover:text-white/80">← Back to Settings</Link>
        </div>
      </div>
    </div>
  );
};

export default RewardsDashboard;
