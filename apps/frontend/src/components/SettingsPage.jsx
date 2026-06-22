import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import AdSlot from './AdSlot';
import { useSettings } from '../context/SettingsContext';
import { useRewards } from '../context/RewardsContext';
import { NuclearOptionButton } from './ui/SessionWipe';

const { FiSettings, FiShield, FiEye, FiDollarSign, FiGlobe, FiLock, FiCookie, FiClock, FiTrash2 } =
  FiIcons;

const formatCents = (cents) => `$${(Math.max(0, cents || 0) / 100).toFixed(2)}`;

const SettingsPage = () => {
  const { settings, updateSetting, canDisableSafeSearch } = useSettings();
  const {
    optedIn: rewardsOptedIn,
    balanceCents: rewardsBalanceCents,
    loading: rewardsLoading,
    optIn: rewardsOptIn,
    optOut: rewardsOptOut,
    fetchStatus: fetchRewardsStatus,
  } = useRewards();
  const [showCookieDialog, setShowCookieDialog] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  const handleRewardsToggle = async () => {
    const result = rewardsOptedIn ? await rewardsOptOut() : await rewardsOptIn();
    if (result.success) {
      await fetchRewardsStatus();
    }
  };

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Cookie Preference Dialog */}
      {showCookieDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <SafeIcon icon={FiCookie} className="mr-2 text-yellow-600" />
              <h3 className="text-xl font-semibold">Cookie Preferences</h3>
            </div>

            <p className="text-gray-600 mb-4">
              You've opted out of personalized ads. Please choose your cookie
              preference:
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleCookiePreference('all')}
                className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg text-left hover:bg-blue-100 transition-colors"
              >
                <div className="font-medium text-blue-900">
                  Allow All Cookies
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  Essential cookies plus analytics and functionality cookies
                </div>
              </button>

              <button
                onClick={() => handleCookiePreference('necessary')}
                className="w-full p-4 bg-green-50 border border-green-200 rounded-lg text-left hover:bg-green-100 transition-colors"
              >
                <div className="font-medium text-green-900">
                  Necessary Cookies Only
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Only essential cookies required for the site to function
                </div>
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Your choice helps us provide the best experience while respecting
              your privacy.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center mb-8">
        <SafeIcon icon={FiSettings} className="mr-3 text-blue-600" size={24} />
        <h1 className="text-3xl font-bold text-gray-900">Truegle Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Top Ad Slot */}
        <div className="w-full">
          <AdSlot
            position="settings-top"
            size="leaderboard"
            className="mx-auto"
          />
        </div>

        {/* Privacy Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiShield} className="mr-2 text-green-600" />
            <h2 className="text-xl font-semibold">Privacy & Security</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Safe Search</h3>
                <p className="text-sm text-gray-600">
                  Filter explicit content — Safe hides it, Blur obscures imagery, Off shows everything
                </p>
                {!canDisableSafeSearch && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <SafeIcon icon={FiLock} size={11} />
                    "Off" requires signing in with Google
                  </p>
                )}
              </div>
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                {[
                  { value: 'safe', label: 'Safe' },
                  { value: 'blur', label: 'Blur' },
                  { value: 'off', label: 'Off', locked: !canDisableSafeSearch },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSettingChange('safeSearch', opt.value)}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                      settings.safeSearch === opt.value
                        ? 'bg-green-600 text-white'
                        : opt.locked
                        ? 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {opt.locked && <SafeIcon icon={FiLock} size={10} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Data Collection</h3>
                <p className="text-sm text-gray-600">
                  Allow anonymous usage analytics
                </p>
              </div>
              <button
                onClick={() =>
                  handleSettingChange(
                    'dataCollection',
                    !settings.dataCollection
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.dataCollection ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    settings.dataCollection ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">VPN Auto-Connect</h3>
                <p className="text-sm text-gray-600">
                  Automatically enable VPN protection
                </p>
              </div>
              <button
                onClick={() =>
                  handleSettingChange(
                    'vpnAutoConnect',
                    !settings.vpnAutoConnect
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.vpnAutoConnect ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    settings.vpnAutoConnect ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Middle Ad Slot */}
        <div className="w-full">
          <AdSlot
            position="settings-middle"
            size="medium"
            className="mx-auto"
          />
        </div>

        {/* Search Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiEye} className="mr-2 text-blue-600" />
            <h2 className="text-xl font-semibold">Search Preferences</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Perspective Filter
              </label>
              <select
                value={settings.defaultFilters}
                onChange={(e) =>
                  handleSettingChange('defaultFilters', e.target.value)
                }
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Perspectives</option>
                <option value="unbiased">Unbiased Only</option>
                <option value="mainstream">Mainstream</option>
                <option value="nonpartisan">Nonpartisan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Results Per Page
              </label>
              <select
                value={settings.resultsPerPage}
                onChange={(e) =>
                  handleSettingChange(
                    'resultsPerPage',
                    parseInt(e.target.value)
                  )
                }
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>10 results</option>
                <option value={25}>25 results</option>
                <option value={50}>50 results</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ad Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiDollarSign} className="mr-2 text-yellow-600" />
            <h2 className="text-xl font-semibold">Ad Preferences</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Ad Personalization</h3>
                <p className="text-sm text-gray-600">
                  Show relevant ads based on search topics
                </p>
              </div>
              <button
                onClick={() =>
                  handleSettingChange(
                    'adPersonalization',
                    !settings.adPersonalization
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.adPersonalization ? 'bg-yellow-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    settings.adPersonalization
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Current Cookie Preference */}
            {!settings.adPersonalization && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <SafeIcon
                    icon={FiCookie}
                    className="mr-2 text-blue-600"
                    size={16}
                  />
                  <h4 className="font-medium text-blue-900">
                    Current Cookie Preference
                  </h4>
                </div>
                <p className="text-sm text-blue-800">
                  {settings.cookiePreference === 'all'
                    ? 'All cookies allowed (essential + analytics + functionality)'
                    : 'Necessary cookies only (essential functionality only)'}
                </p>
                <button
                  onClick={() => setShowCookieDialog(true)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Change preference
                </button>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Truegle uses minimal, privacy-respecting
                ads to keep the service free. We never sell your data or track
                you across websites.
              </p>
            </div>
          </div>
        </div>

        {/* Rewards Program */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiDollarSign} className="mr-2 text-emerald-600" />
            <h2 className="text-xl font-semibold">Rewards Program</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Earn cash for ads you view</h3>
              <p className="text-sm text-gray-600">
                Opt in to get paid a small cash reward for ads you genuinely view while waiting
                on search results. Honestly measured server-side — nothing simulated.
              </p>
            </div>
            <button
              onClick={handleRewardsToggle}
              disabled={rewardsLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                rewardsOptedIn ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                  rewardsOptedIn ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {rewardsOptedIn && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-emerald-800">
                Current balance: <strong>{formatCents(rewardsBalanceCents)}</strong>
              </p>
              <Link
                to="/rewards"
                className="text-sm text-emerald-700 hover:text-emerald-900 underline font-medium"
              >
                View Rewards dashboard →
              </Link>
            </div>
          )}
        </div>

        {/* Bottom Ad Slot */}
        <div className="w-full">
          <AdSlot
            position="settings-bottom"
            size="leaderboard"
            className="mx-auto"
          />
        </div>

        {/* Privacy & Data */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiLock} className="mr-2 text-emerald-600" />
            <h2 className="text-xl font-semibold">Privacy &amp; Data</h2>
          </div>

          {/* Save search history toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-start gap-2">
              <SafeIcon icon={FiClock} className="mt-1 text-gray-500" size={16} />
              <div>
                <h3 className="font-medium">Save search history</h3>
                <p className="text-sm text-gray-600">
                  Store recent searches on this device only. Turn off for no local history.
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('saveHistory', !settings.saveHistory)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                settings.saveHistory ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                  settings.saveHistory ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Clear search history */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <h3 className="font-medium">Clear search history</h3>
              <p className="text-sm text-gray-600">Remove recent searches saved on this device.</p>
            </div>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <SafeIcon icon={FiTrash2} size={14} />
              {historyCleared ? 'Cleared' : 'Clear'}
            </button>
          </div>

          {/* Nuclear option: wipe everything */}
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="font-medium">Clear all data on this device</h3>
              <p className="text-sm text-gray-600">
                Wipe local storage, session data, and cached results, plus server-side ephemeral logs.
              </p>
            </div>
            <NuclearOptionButton token={localStorage.getItem('truegle_token')} />
          </div>

          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-800">
              Truegle does not store your search queries server-side. History is kept only on
              this device when enabled, and never synced or sold.
            </p>
          </div>
        </div>

        {/* About */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiGlobe} className="mr-2 text-purple-600" />
            <h2 className="text-xl font-semibold">About Truegle</h2>
          </div>

          <div className="text-gray-700 space-y-2">
            <p>Version 1.0.0</p>
            <p>Committed to unbiased, transparent search results</p>
            <p>No tracking • No data selling • No algorithmic manipulation</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
