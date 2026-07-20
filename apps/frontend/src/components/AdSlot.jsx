import React from 'react';
import { useSettings } from '../context/SettingsContext';
import AdsterraBanner from './ads/AdsterraBanner';

// Map the legacy size prop to a confirmed non-adult Adsterra format. Never
// map to banner728x90/160x300/160x600 here — those are the OLD adult-locked
// zones and must stay behind the full adultGated + AdultConsentGate flow
// (see RewardAdSlot.jsx / config/ads.js), not a plain filler slot.
const sizeToFormat = {
  small: 'banner320x50',
  medium: 'banner300x250',
  large: 'banner468x60',
  leaderboard: 'banner468x60',
  sidebar: 'banner300x250',
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
