import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import SearchPageShell from './layout/SearchPageShell';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import Toggle from './ui/Toggle';
import { useSettings } from '../context/SettingsContext';
import { useRewards } from '../context/RewardsContext';
import { useAuth } from '../context/AuthContext';
import { NuclearOptionButton } from './ui/SessionWipe';
import AccountCodeModal from './ui/AccountCodeModal';
import authService from '../services/authService';
import { formatMicros } from '../utils/rewardsFormat';
import { clearHistory } from '../utils/searchHistory';

const { FiSettings, FiShield, FiEye, FiDollarSign, FiGlobe, FiLock, FiClock, FiTrash2, FiKey } =
  FiIcons;

const SettingsPage = () => {
  const { settings, updateSetting, canDisableSafeSearch } = useSettings();
  const { optedIn: rewardsOptedIn, balanceMicros: rewardsBalanceMicros } = useRewards();
  const { isAuthenticated } = useAuth();
  const [historyCleared, setHistoryCleared] = useState(false);
  const [acctCode, setAcctCode] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  // Just signed in (SignInPage sends ?welcome=1&next=…#search-storage): land
  // on the storage choices, say why, and offer the way on.
  const location = useLocation();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const next = (() => {
    const n = params.get('next') || '/search';
    return n.startsWith('/') && !n.startsWith('//') ? n : '/search';   // same-site only
  })();
  useEffect(() => {
    const id = { '#search-storage': 'search-storage', '#safe-search': 'safe-search' }[location.hash];
    if (!id) return undefined;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [location.hash]);

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    const res = await authService.regenerateAccountCode(localStorage.getItem('truegle_token'));
    setRegenerating(false);
    if (res.success) setAcctCode(res.accountCode);
  };

  const handleClearHistory = () => {
    try {
      clearHistory();
    } catch {
      // ignore storage errors
    }
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2500);
  };

  const selectClass =
    'w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-emerald-400 transition-colors';

  return (
    // THE BRAND LAYOUT, like every other page.
    //
    // Settings was one of the last two pages rendering as a bare
    // `min-h-screen bg-black` — no logo, no background, no way home except the
    // browser's back button. It read as a different site. The shell supplies
    // the logo (which routes to the landing page) and the mode background;
    // it is handed no search bar and no pill row, because there is nothing to
    // search for here and no mode to switch to. Same call as the Trail page.
    <SearchPageShell mode="green">
      <div className="max-w-3xl mx-auto text-white">
        {/* A section label, not a second wordmark — the shell above already
            says whose settings these are. */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <SafeIcon icon={FiSettings} className="text-emerald-400" size={18} />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-emerald-400/80">
            Settings
          </h1>
        </div>

        <div className="space-y-6">

          {/* Privacy & Security */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-emerald-500/20 shadow-xl">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiShield} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Privacy &amp; Security</h2>
            </div>

            <div className="space-y-5">
              <div id="safe-search" className="scroll-mt-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-medium text-white">Safe Search</h3>
                  <p className="text-sm text-white/60">
                    Filter explicit content — Safe hides it, Blur obscures imagery, Off shows everything
                  </p>
                  {!canDisableSafeSearch && (
                    <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                      <SafeIcon icon={FiLock} size={11} />
                      "Off" requires signing in
                    </p>
                  )}
                </div>
                <div className="inline-flex gap-2">
                  {[
                    { value: 'safe', label: 'Safe' },
                    { value: 'blur', label: 'Blur' },
                    { value: 'off', label: 'Off', locked: !canDisableSafeSearch },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateSetting('safeSearch', opt.value)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                        settings.safeSearch === opt.value
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      {opt.locked && <SafeIcon icon={FiLock} size={10} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-white">Data Collection</h3>
                  <p className="text-sm text-white/60">Allow anonymous usage analytics</p>
                </div>
                <Toggle
                  checked={settings.dataCollection}
                  onChange={(v) => updateSetting('dataCollection', v)}
                  label="Data Collection"
                />
              </div>

              {/* "VPN Auto-Connect" removed 2026-08-25. It stored a boolean
                  nothing read, over a VPN that did not exist. A privacy switch
                  that does nothing is worse than no switch: it tells someone
                  they are protected while they are not. */}
            </div>
          </div>


          {/* Search Preferences */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-emerald-500/20 shadow-xl">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiEye} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Search Preferences</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Default Perspective Filter</label>
                <select
                  value={settings.defaultFilters}
                  onChange={(e) => updateSetting('defaultFilters', e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All Perspectives</option>
                  <option value="unbiased">Unbiased Only</option>
                  <option value="mainstream">Mainstream</option>
                  <option value="nonpartisan">Nonpartisan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">Results Per Page</label>
                <select
                  value={settings.resultsPerPage}
                  onChange={(e) => updateSetting('resultsPerPage', parseInt(e.target.value))}
                  className={selectClass}
                >
                  <option value={10}>10 results</option>
                  <option value={25}>25 results</option>
                  <option value={50}>50 results</option>
                </select>
              </div>
            </div>
          </div>

          {/* REWARDS FEATURE: disabled — it was funded by ad revenue, and ads
              were removed on 2026-08-24. Rewards status + dashboard link stay
              hidden from Settings.
          <div className="p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-emerald-500/20 shadow-xl">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiDollarSign} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Rewards Program</h2>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm text-white/60 mb-1">Program status</div>
                <div className="font-semibold">
                  {rewardsOptedIn ? (
                    <span className="text-emerald-400">{`Opted in — ${formatMicros(rewardsBalanceMicros)} balance`}</span>
                  ) : (
                    <span className="text-white/60">Not opted in</span>
                  )}
                </div>
              </div>
              <Link
                to="/rewards"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium transition-all"
              >
                Manage in Rewards dashboard →
              </Link>
            </div>
          </div>
          */}

          {/* Account code — durable sign-in credential */}
          {isAuthenticated && (
            <div className="p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-emerald-500/20 shadow-xl">
              <div className="flex items-center mb-4">
                <SafeIcon icon={FiKey} className="mr-2 text-emerald-400" />
                <h2 className="text-lg font-semibold">Account code</h2>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Your account code signs you in on any device — no waiting for an email. If you've
                lost it or want a new one, regenerate it here. The old code stops working immediately.
              </p>
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium transition-all disabled:opacity-50"
              >
                {regenerating ? 'Generating…' : 'Regenerate account code'}
              </button>
            </div>
          )}


          {/* Privacy & Data */}
          <div id="search-storage" data-search-storage="" className="scroll-mt-6 p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-emerald-500/20 shadow-xl">
            {welcome && (
              <div data-welcome-storage="" className="mb-5 p-4 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
                <p className="text-sm font-semibold text-cyan-200">You&apos;re signed in.</p>
                <p className="text-sm text-white/70 mt-1">
                  Choose how your searches are stored on this device — keep a history here, or none at all.
                  You can change this, or wipe everything with the Nuclear Option, at any time.
                </p>
                <Link to={next} data-welcome-continue="" className="inline-block mt-3 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold">
                  Done — continue
                </Link>
              </div>
            )}
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiLock} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Privacy &amp; Data</h2>
            </div>

            <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10">
              <div className="flex items-start gap-2">
                <SafeIcon icon={FiClock} className="mt-1 text-white/40" size={16} />
                <div>
                  <h3 className="font-medium text-white">Save search history</h3>
                  <p className="text-sm text-white/60">
                    Store recent searches on this device only. Turn off for no local history.
                  </p>
                </div>
              </div>
              <Toggle
                checked={settings.saveHistory}
                onChange={(v) => updateSetting('saveHistory', v)}
                label="Save search history"
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10">
              <div>
                <h3 className="font-medium text-white">Clear search history</h3>
                <p className="text-sm text-white/60">Remove recent searches saved on this device.</p>
              </div>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
              >
                <SafeIcon icon={FiTrash2} size={14} />
                {historyCleared ? 'Cleared' : 'Clear'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <h3 className="font-medium text-white">Clear all data on this device</h3>
                {/* This sentence was aspirational until 2026-08-25: cached
                    results were never touched (Cache Storage was skipped), and
                    the server leg was gated behind a login so most visitors
                    never got it. Both are real now — hence the last clause. */}
                <p className="text-sm text-white/60">
                  Wipe local storage, session data, and cached results, plus server-side
                  ephemeral logs. No account needed.
                </p>
              </div>
              <NuclearOptionButton token={localStorage.getItem('truegle_token')} />
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm text-white/60">
                Truegle keeps no search history tied to you. History is kept only on this device
                when enabled, and never synced or sold. Server-side, an ordinary search is kept
                as an anonymous line — no account or IP — for at most 7 days, for trending only.
              </p>
            </div>
          </div>

          {/* About */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-emerald-500/20 shadow-xl">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiGlobe} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">About Truegle</h2>
            </div>

            <div className="text-white/60 space-y-2 text-sm">
              <p>Version 1.0.0</p>
              <p>Committed to unbiased, transparent search results</p>
              <p>No tracking • No data selling • No algorithmic manipulation</p>
            </div>
          </div>
        </div>
      </div>

      {acctCode && (
        <AccountCodeModal code={acctCode} onClose={() => setAcctCode(null)} />
      )}
    </SearchPageShell>
  );
};

export default SettingsPage;
