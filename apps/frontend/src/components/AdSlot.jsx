import React from 'react';
import { useSettings } from '../context/SettingsContext';
import AdsterraBanner from './ads/AdsterraBanner';

// Highest-CPM only: every size renders the native banner (the low-CPM fixed
// display zones were retired — see config/ads.js). AdsterraBanner coerces any
// format to native regardless, so this map is just for clarity.
const sizeToFormat = {
  small: 'nativeBanner',
  medium: 'nativeBanner',
  large: 'nativeBanner',
  leaderboard: 'nativeBanner',
  sidebar: 'nativeBanner',
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
