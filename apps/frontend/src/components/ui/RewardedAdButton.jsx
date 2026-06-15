import React, { useState } from 'react';
import { Play, Heart, Loader2 } from 'lucide-react';
import { showRewardedAd } from '../../utils/adNetworks';
import { hasRewardedAds } from '../../config/ads';

/**
 * RewardedAdButton — opt-in "watch a quick ad to support us" button.
 *
 * In free-access (pre-production) everything is already free, so this is framed
 * as voluntary support: users choose to watch a rewarded ad, you earn revenue,
 * nobody is forced. Hidden entirely until a Monetag rewarded zone is configured
 * (no dead button). On completion it calls onReward (e.g. grant tokens / unlock)
 * and shows a thank-you state.
 *
 * Props:
 *   onReward?  - called after the user completes the ad
 *   label?     - button text (default "Support us — watch a quick ad")
 *   className?
 */
const RewardedAdButton = ({
  onReward,
  label = 'Support us — watch a quick ad',
  className = '',
}) => {
  const [state, setState] = useState('idle'); // idle | loading | done | error

  if (!hasRewardedAds()) return null;

  const handleClick = async () => {
    if (state === 'loading') return;
    setState('loading');
    try {
      await showRewardedAd();
      setState('done');
      onReward?.();
      setTimeout(() => setState('idle'), 4000);
    } catch (err) {
      console.warn('Rewarded ad unavailable:', err?.message);
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
        state === 'done'
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          : 'bg-gradient-to-r from-cyan-500/15 to-purple-500/15 hover:from-cyan-500/25 hover:to-purple-500/25 border-cyan-400/30 text-cyan-200'
      } ${className}`}
    >
      {state === 'loading' ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Loading ad…
        </>
      ) : state === 'done' ? (
        <>
          <Heart size={16} className="fill-emerald-400 text-emerald-400" />
          Thank you for supporting Truegle!
        </>
      ) : state === 'error' ? (
        <>No ad available right now — thanks anyway!</>
      ) : (
        <>
          <Play size={15} />
          {label}
        </>
      )}
    </button>
  );
};

export default RewardedAdButton;
