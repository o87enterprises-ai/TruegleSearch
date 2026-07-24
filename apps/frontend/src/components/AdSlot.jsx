import React from 'react';
import { useSettings } from '../context/SettingsContext';
import AdsterraBanner from './ads/AdsterraBanner';

// Map the legacy size prop to an Adsterra format. The 728x90/160x300/160x600
// zones were formerly adult-locked, but the account-level adult toggle is now
// OFF (owner-confirmed 2026-07-24), so they serve normal creative and are the
// higher-CPM formats — preferred here over the near-$0 300x250/468x60 zones per
// the per-zone revenue data. (Monitor for adult creative; two prior leaks.)
const sizeToFormat = {
  small: 'banner320x50',     // $0.10 CPM
  medium: 'nativeBanner',    // $0.151 CPM (was dead 300x250)
  large: 'banner728x90',     // $0.441 CPM, top payer (was dead 468x60)
  leaderboard: 'banner728x90',
  sidebar: 'banner160x600',  // proper skyscraper fit, now unlocked
};

const AdSlot = ({ position, size = 'medium', className = '' }) => {
  const { settings } = useSettings();

  // Don't show ads if ad personalization is off and user chose necessary cookies only
  if (
    !settings.adPersonalization &&
    settings.cookiePreference === 'necessary'
  ) {
    return null;
  }

  const format = sizeToFormat[size] || sizeToFormat[position] || 'banner320x50';

  return <AdsterraBanner format={format} className={className} />;
};

export default AdSlot;
