import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Users, Zap, AlertCircle } from 'lucide-react';
import { SMARTLINK_URL } from '../config/ads';

const COST_ITEMS = [
  { label: 'Cloudflare Pages (hosting)',  monthly: 0,   note: 'Free tier' },
  { label: 'Vercel (backend)',            monthly: 0,   note: 'Free tier' },
  { label: 'Domain (truegle.info)',       monthly: 1,   note: '~$12/yr' },
  { label: 'Backend compute (if needed)', monthly: 10,  note: 'AWS t3.micro or Fly.io' },
  { label: 'Adsterra (no fee)',           monthly: 0,   note: 'Revenue share only' },
];

const MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000];

const CPM_SCENARIOS = [
  { label: 'Conservative',    cpm: 0.20, adultCpm: 5.00,  color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  { label: 'Mainstream',      cpm: 0.50, adultCpm: 8.00,  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { label: 'Optimistic',      cpm: 1.20, adultCpm: 12.00, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  { label: 'Anti-AdBlock CNAME', cpm: 2.00, adultCpm: 15.00, color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30' },
];

function fmt(n, dec = 2) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(dec)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(dec)}K`;
  return `$${n.toFixed(dec)}`;
}

function fmtPlain(n) {
  return n >= 1e6
    ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
    ? `${(n / 1e3).toFixed(1)}K`
    : String(n);
}

export default function RevenueCalculator() {
  const [dailyViews, setDailyViews] = useState(5000);
  const [adsPerPage, setAdsPerPage] = useState(6);
  const [adultPct, setAdultPct] = useState(5);
  const [rewardPct, setRewardPct] = useState(10);

  const totalMonthlyCost = useMemo(
    () => COST_ITEMS.reduce((s, c) => s + c.monthly, 0),
    [],
  );

  const calcRevenue = (views, cpm, adultCpmVal, adsCount, adultPctVal) => {
    const totalImpressions = views * adsCount;
    const adultImpressions = totalImpressions * (adultPctVal / 100);
    const mainImpressions  = totalImpressions - adultImpressions;
    const daily = (mainImpressions / 1000) * cpm + (adultImpressions / 1000) * adultCpmVal;
    return { daily, monthly: daily * 30, annual: daily * 365 };
  };

  const smartlinkEst = useMemo(() => {
    const clickRate = 0.002;
    const cpc = 0.08;
    const daily = dailyViews * clickRate * cpc;
    return { daily, monthly: daily * 30 };
  }, [dailyViews]);

  const rewardBoost = (base) => base * (1 + rewardPct / 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/30 to-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Revenue Calculator
          </h1>
          <p className="text-white/60 text-sm">Truegle.info · Ad monetization model · {new Date().getFullYear()}</p>
        </motion.div>

        {/* Sliders */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2"><Users size={18} /> Traffic &amp; Layout</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Daily pageviews</span>
              <span className="font-bold text-white">{fmtPlain(dailyViews)}</span>
            </div>
            <input type="range" min="100" max="200000" step="100" value={dailyViews}
              onChange={e => setDailyViews(Number(e.target.value))}
              className="w-full accent-cyan-500" />
            <div className="flex justify-between text-xs text-white/30">
              <span>100</span><span>200K</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Ads per page</span>
              <span className="font-bold text-white">{adsPerPage}</span>
            </div>
            <input type="range" min="1" max="20" step="1" value={adsPerPage}
              onChange={e => setAdsPerPage(Number(e.target.value))}
              className="w-full accent-cyan-500" />
            <div className="flex justify-between text-xs text-white/30">
              <span>1</span><span>20</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Adult queries %</span>
                <span className="font-bold text-white">{adultPct}%</span>
              </div>
              <input type="range" min="0" max="50" step="1" value={adultPct}
                onChange={e => setAdultPct(Number(e.target.value))}
                className="w-full accent-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Reward ad boost</span>
                <span className="font-bold text-white">+{rewardPct}%</span>
              </div>
              <input type="range" min="0" max="50" step="5" value={rewardPct}
                onChange={e => setRewardPct(Number(e.target.value))}
                className="w-full accent-green-500" />
            </div>
          </div>
        </motion.div>

        {/* CPM Scenario Cards */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="space-y-4">
          <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2"><TrendingUp size={18} /> CPM Scenarios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CPM_SCENARIOS.map((s) => {
              const rev = calcRevenue(dailyViews, s.cpm, s.adultCpm, adsPerPage, adultPct);
              const boosted = rewardBoost(rev.monthly) + smartlinkEst.monthly;
              return (
                <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-5 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-base ${s.color}`}>{s.label}</span>
                    <div className="text-right text-xs text-white/50">
                      <div>Main CPM: ${s.cpm.toFixed(2)}</div>
                      <div>Adult CPM: ${s.adultCpm.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-white/50">Daily</div>
                      <div className={`font-bold text-sm ${s.color}`}>{fmt(rev.daily)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50">Monthly</div>
                      <div className={`font-bold text-sm ${s.color}`}>{fmt(rev.monthly)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50">Annual</div>
                      <div className={`font-bold text-sm ${s.color}`}>{fmt(rev.annual)}</div>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-2 text-xs text-white/50 flex justify-between">
                    <span>+Smartlink +Rewards</span>
                    <span className="text-green-400 font-semibold">{fmt(boosted)}/mo</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Smartlink */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2 mb-3"><Zap size={18} /> Smartlink (ETP-resistant click revenue)</h2>
          <p className="text-white/50 text-sm mb-3">Plain anchor link — Firefox Enhanced Tracking Protection cannot block it. Estimated at 0.2% CTR × $0.08 CPC.</p>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-xs text-white/50">Daily</div>
              <div className="text-blue-400 font-bold">{fmt(smartlinkEst.daily)}</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-xs text-white/50">Monthly</div>
              <div className="text-blue-400 font-bold">{fmt(smartlinkEst.monthly)}</div>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-2">Smartlink: <span className="font-mono break-all">{SMARTLINK_URL?.slice(0, 60)}…</span></p>
        </motion.div>

        {/* Break-even / P&L */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2"><DollarSign size={18} /> Break-even &amp; P&amp;L at Traffic Milestones</h2>

          {/* Cost summary */}
          <div className="space-y-1">
            {COST_ITEMS.map((c) => (
              <div key={c.label} className="flex justify-between text-sm">
                <span className="text-white/60">{c.label} <span className="text-white/30 text-xs">({c.note})</span></span>
                <span className={c.monthly === 0 ? 'text-green-400' : 'text-white'}>${c.monthly}/mo</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2 mt-2">
              <span>Total monthly cost</span>
              <span className="text-red-400">${totalMonthlyCost}/mo</span>
            </div>
          </div>

          {/* Milestone table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-left py-2">Daily views</th>
                  {CPM_SCENARIOS.map(s => (
                    <th key={s.label} className={`text-right py-2 ${s.color}`}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MILESTONES.map((views) => (
                  <tr key={views} className={`border-b border-white/5 ${views === dailyViews ? 'bg-cyan-500/10' : ''}`}>
                    <td className="py-2 text-white/70 font-mono">{fmtPlain(views)}</td>
                    {CPM_SCENARIOS.map(s => {
                      const rev = calcRevenue(views, s.cpm, s.adultCpm, adsPerPage, adultPct);
                      const boosted = rewardBoost(rev.monthly) + smartlinkEst.monthly * (views / dailyViews);
                      const profit = boosted - totalMonthlyCost;
                      return (
                        <td key={s.label} className="text-right py-2">
                          <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {profit >= 0 ? '+' : ''}{fmt(profit)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-white/30 text-xs mt-2">Monthly P&amp;L after costs (includes +{rewardPct}% reward boost &amp; Smartlink). Highlighted row = current slider.</p>
          </div>
        </motion.div>

        {/* Dashboard action checklist */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 space-y-3">
          <h2 className="text-base font-semibold text-orange-300 flex items-center gap-2"><AlertCircle size={16} /> Dashboard Actions to Unlock Better CPM</h2>
          <ul className="text-sm text-white/70 space-y-2 list-disc list-inside">
            <li><strong className="text-white">CNAME anti-adblock</strong> — Adsterra dashboard → Anti-AdBlock → get CNAME target → add <code className="text-cyan-300">cdn CNAME [target]</code> in Cloudflare DNS → set <code className="text-cyan-300">VITE_AD_DOMAIN=cdn.truegle.info</code> in Pages env vars → redeploy. Unlocks &quot;Anti-AdBlock CNAME&quot; CPM row above.</li>
            <li><strong className="text-white">Adult toggle OFF</strong> for small zones (320×50, 300×250, 468×60, native) in Adsterra dashboard. Leave adult ON for large zones (728×90, 160×600, 160×300).</li>
            <li><strong className="text-white">Activate Smartlink</strong> — wait for Adsterra approval, then ensure <code className="text-cyan-300">VITE_SMARTLINK_URL</code> is set if the key changes.</li>
          </ul>
        </motion.div>

        <p className="text-center text-white/20 text-xs pb-8">
          CPM figures are estimates based on Adsterra network averages. Actual revenue varies by geography, device, and ad fill rate.
        </p>
      </div>
    </div>
  );
}
