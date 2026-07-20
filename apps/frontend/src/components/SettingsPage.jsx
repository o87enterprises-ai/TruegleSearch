import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import AdSlot from './AdSlot';
import Toggle from './ui/Toggle';
import { useSettings } from '../context/SettingsContext';
import { useRewards } from '../context/RewardsContext';
import { NuclearOptionButton } from './ui/SessionWipe';
import { formatMicros } from '../utils/rewardsFormat';

const { FiSettings, FiShield, FiEye, FiDollarSign, FiGlobe, FiLock, FiCookie, FiClock, FiTrash2 } =
  FiIcons;

const SettingsPage = () => {
  const { settings, updateSetting, canDisableSafeSearch } = useSettings();
  const { optedIn: rewardsOptedIn, balanceMicros: rewardsBalanceMicros } = useRewards();
  const [showCookieDialog, setShowCookieDialog] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('truegle_recent_searches');
    } catch {
      // ignore storage errors
    }
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2500);
  };

  const handleSettingChange = (key, value) => {
    updateSetting(key, value);

    // Show cookie dialog when ad personalization is turned off
    if (key === 'adPersonalization' && !value) {
      setShowCookieDialog(true);
    }
  };

  const handleCookiePreference = (preference) => {
    updateSetting('cookiePreference', preference);
    setShowCookieDialog(false);
  };

  const selectClass =
    'w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-emerald-400 transition-colors';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Cookie Preference Dialog */}
        {showCookieDialog && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-[rgba(15,15,35,0.95)] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6">
              <div className="flex items-center mb-4">
                <SafeIcon icon={FiCookie} className="mr-2 text-yellow-400" />
                <h3 className="text-xl font-semibold">Cookie Preferences</h3>
              </div>

              <p className="text-white/60 mb-4">
                You've opted out of personalized ads. Please choose your cookie
                preference:
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleCookiePreference('all')}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-colors"
                >
                  <div className="font-medium text-white">Allow All Cookies</div>
                  <div className="text-sm text-white/50 mt-1">
                    Essential cookies plus analytics and functionality cookies
                  </div>
                </button>

                <button
                  onClick={() => handleCookiePreference('necessary')}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-colors"
                >
                  <div className="font-medium text-white">Necessary Cookies Only</div>
                  <div className="text-sm text-white/50 mt-1">
                    Only essential cookies required for the site to function
                  </div>
                </button>
              </div>

              <div className="text-xs text-white/30">
                Your choice helps us provide the best experience while respecting
                your privacy.
              </div>
            </div>
          </div>
        )}

        <div className="mb-10">
          <div className="inline-block text-xs uppercase tracking-widest text-emerald-400/80 mb-3">
            Settings
          </div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <SafeIcon icon={FiSettings} className="text-emerald-400" size={28} />
            Truegle Settings
          </h1>
        </div>

        <div className="space-y-6">
          {/* Top Ad Slot */}
          <AdSlot position="settings-top" size="leaderboard" className="mx-auto" />

          {/* Privacy & Security */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiShield} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Privacy &amp; Security</h2>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-medium text-white">Safe Search</h3>
                  <p className="text-sm text-white/60">
                    Filter explicit content — Safe hides it, Blur obscures imagery, Off shows everything
                  </p>
                  {!canDisableSafeSearch && (
                    <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                      <SafeIcon icon={FiLock} size={11} />
                      "Off" requires signing in with Google
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
                      onClick={() => handleSettingChange('safeSearch', opt.value)}
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
                  onChange={(v) => handleSettingChange('dataCollection', v)}
                  label="Data Collection"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-white">VPN Auto-Connect</h3>
                  <p className="text-sm text-white/60">Automatically enable VPN protection</p>
                </div>
                <Toggle
                  checked={settings.vpnAutoConnect}
                  onChange={(v) => handleSettingChange('vpnAutoConnect', v)}
                  label="VPN Auto-Connect"
                />
              </div>
            </div>
          </div>

          {/* Middle Ad Slot */}
          <AdSlot position="settings-middle" size="medium" className="mx-auto" />

          {/* Search Preferences */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiEye} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Search Preferences</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Default Perspective Filter</label>
                <select
                  value={settings.defaultFilters}
                  onChange={(e) => handleSettingChange('defaultFilters', e.target.value)}
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
                  onChange={(e) => handleSettingChange('resultsPerPage', parseInt(e.target.value))}
                  className={selectClass}
                >
                  <option value={10}>10 results</option>
                  <option value={25}>25 results</option>
                  <option value={50}>50 results</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ad Preferences */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiDollarSign} className="mr-2 text-emerald-400" />
              <h2 className="text-lg font-semibold">Ad Preferences</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-white">Ad Personalization</h3>
                  <p className="text-sm text-white/60">Show relevant ads based on search topics</p>
                </div>
                <Toggle
                  checked={settings.adPersonalization}
                  onChange={(v) => handleSettingChange('adPersonalization', v)}
                  label="Ad Personalization"
                />
              </div>

              {!settings.adPersonalization && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    <SafeIcon icon={FiCookie} className="mr-2 text-emerald-400" size={16} />
                    <h4 className="font-medium text-white">Current Cookie Preference</h4>
                  </div>
                  <p className="text-sm text-white/60">
                    {settings.cookiePreference === 'all'
                      ? 'All cookies allowed (essential + analytics + functionality)'
                      : 'Necessary cookies only (essential functionality only)'}
                  </p>
                  <button
                    onClick={() => setShowCookieDialog(true)}
                    className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Change preference
                  </button>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-sm text-white/60">
                  <strong className="text-white/80">Note:</strong> Truegle uses minimal, privacy-respecting
                  ads to keep the service free. We never sell your data or track you across websites.
                </p>
              </div>
            </div>
          </div>

          {/* Rewards Program — status + link; the working opt-in control lives on /rewards */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
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

          {/* Bottom Ad Slot */}
          <AdSlot position="settings-bottom" size="leaderboard" className="mx-auto" />

          {/* Privacy & Data */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
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
                <p className="text-sm text-white/60">
                  Wipe local storage, session data, and cached results, plus server-side ephemeral logs.
                </p>
              </div>
              <NuclearOptionButton token={localStorage.getItem('truegle_token')} />
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm text-white/60">
                Truegle does not store your search queries server-side. History is kept only on
                this device when enabled, and never synced or sold.
              </p>
            </div>
          </div>

          {/* About */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
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
    </div>
  );
};

export default SettingsPage;
