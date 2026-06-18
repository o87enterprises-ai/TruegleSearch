import React from 'react';
import { useSettings } from '../context/SettingsContext';
import HouseAd from './ui/HouseAd';

// Map the legacy size prop to an ad zone (see config/houseAds.js AD_ZONES).
const sizeToZone = {
  small: 'search-inline',
  medium: 'settings-medium',
  large: 'results-leaderboard',
  leaderboard: 'results-leaderboard',
  sidebar: 'search-sidebar',
};

const AdSlot = ({ position, size = 'medium', category, adId, className = '', compact = false }) => {
  const { settings } = useSettings();

  // Don't show ads if ad personalization is off and user chose necessary cookies only
  if (
    !settings.adPersonalization &&
    settings.cookiePreference === 'necessary'
  ) {
    return null;
  }

  // Slots now serve first-party house ads (our own projects) instead of a
  // static placeholder. Same API — `position`/`size`/`className` still work.
  // `adId` pins a specific ad to this slot (otherwise weighted-random).
  return (
    <HouseAd
      zone={sizeToZone[size] || position || 'unknown'}
      category={category}
      adId={adId}
      className={className}
      compact={compact}
    />
  );
};

export default AdSlot;
