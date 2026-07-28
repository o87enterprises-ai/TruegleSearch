import React from 'react';
import { useSettings } from '../context/SettingsContext';
import AdsterraBanner from './ads/AdsterraBanner';

/*
 * Reward-adjacent ad slot. Renders a real (geo-targeted, highest-CPM) native
 * Adsterra banner.
 *
 * Rewards are now OFFER/CONVERSION based, not view/click based — Adsterra pays
 * the publisher on completed offers, so there is nothing honest to credit for a
 * mere view. The old IntersectionObserver dwell-timer + window-blur "click"
 * heuristic and its /impression-session + /earn calls have been removed; users
 * earn by completing offers via their personalized offer link (see
 * RewardsDashboard + RewardsService.recordConversion). This slot just shows the
 * real inventory that funds the program.
 */
const RewardAdSlot = ({ searchContext = null, className = '' }) => {
  const { settings } = useSettings();

  // Respect the necessary-cookies-only / no-personalization choice.
  if (!settings.adPersonalization && settings.cookiePreference === 'necessary') {
    return null;
  }

  return (
    <div className="relative">
      <AdsterraBanner format="nativeBanner" searchContext={searchContext} className={className} />
    </div>
  );
};

export default RewardAdSlot;
