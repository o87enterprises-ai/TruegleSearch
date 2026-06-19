import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useRewards } from '../context/RewardsContext';
import { rewardsAPI } from '../services/api';

const formatCents = (cents) => `$${(Math.max(0, cents || 0) / 100).toFixed(2)}`;

/*
 * /rewards — the Rewards Program dashboard.
 *
 * Opt in/out, see your balance and history, and request a cash-out. This is
 * deliberately honest about the current state of payouts: requests queue for
 * manual processing until an automated payout method (e.g. Stripe Connect) is
 * configured, rather than pretending a transfer happened.
 */
const RewardsDashboard = () => {
  const { optedIn, balanceCents, lifetimeEarnedCents, config, loading, fetchStatus, optIn, optOut } = useRewards();
  const [ledger, setLedger] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [destination, setDestination] = useState('');
  const [payoutMessage, setPayoutMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    const result = optedIn ? await optOut() : await optIn();
    if (result.success) {
      await fetchStatus();
    }
  };

  const handlePayoutRequest = async (e) => {
    e.preventDefault();
    if (!destination.trim()) return;
    setSubmitting(true);
    setPayoutMessage(null);
    try {
      const response = await rewardsAPI.requestPayout('manual_review', destination.trim());
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

  const minPayoutCents = config?.minPayoutCents ?? 500;
  const canRequestPayout = optedIn && balanceCents >= minPayoutCents;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="inline-block text-xs uppercase tracking-widest text-emerald-400/80 mb-3">
            Rewards Program
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Get paid for the ads you already see</h1>
          <p className="text-white/70 max-w-2xl">
            Opt in and Truegle pays you a small cash reward for ads you genuinely view while
            waiting on search results — no extra ads, no extra tracking beyond what this program
            requires. Everything here is honestly measured server-side; nothing is simulated.
          </p>
        </div>

        {/* Status card */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm text-white/60 mb-1">Program status</div>
              <div className="text-lg font-semibold">
                {optedIn ? (
                  <span className="text-emerald-400">Opted in</span>
                ) : (
                  <span className="text-white/60">Not opted in</span>
                )}
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                optedIn
                  ? 'bg-white/10 hover:bg-white/20 border border-white/20'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90'
              }`}
            >
              {optedIn ? 'Opt out' : 'Opt in to Rewards'}
            </button>
          </div>

          {optedIn && (
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <div className="text-sm text-white/60 mb-1">Current balance</div>
                <div className="text-2xl font-bold text-emerald-400">{formatCents(balanceCents)}</div>
              </div>
              <div>
                <div className="text-sm text-white/60 mb-1">Lifetime earned</div>
                <div className="text-2xl font-bold">{formatCents(lifetimeEarnedCents)}</div>
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
                  Payouts are currently processed manually while we set up automated cash transfers.
                  Submitting a request queues it for review — it does not move money instantly.
                </p>
              )}
              <p className="text-sm text-white/60 mb-4">
                Minimum payout: {formatCents(minPayoutCents)}. Your balance: {formatCents(balanceCents)}.
              </p>
              <form onSubmit={handlePayoutRequest} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="PayPal email or payout destination"
                  disabled={!canRequestPayout || submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!canRequestPayout || submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-semibold hover:opacity-90 transition-all disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Request payout'}
                </button>
              </form>
              {payoutMessage && (
                <p className={`text-sm mt-3 ${payoutMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
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
                      <span className="font-medium">{formatCents(p.amount_cents)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-400'
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
                      <span className={`font-medium ${entry.amount_cents >= 0 ? 'text-emerald-400' : 'text-white/80'}`}>
                        {entry.amount_cents >= 0 ? '+' : ''}{formatCents(entry.amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-8 text-sm text-white/50">
          <Link to="/settings" className="hover:text-white/80">← Back to Settings</Link>
        </div>
      </div>
    </div>
  );
};

export default RewardsDashboard;
