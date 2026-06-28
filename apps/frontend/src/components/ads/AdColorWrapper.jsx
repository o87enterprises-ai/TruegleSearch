import React from 'react';

const BADGE = {
  claim:  { bg: 'bg-yellow-400',   text: 'text-black',  label: 'Ad Spot' },
  cpm:    { bg: 'bg-[#AAFF00]',    text: 'text-black',  label: 'Sponsored' },
  adult:  { bg: 'bg-red-600',      text: 'text-white',  label: '18+ Ad' },
  reward: { bg: 'bg-red-600',      text: 'text-white',  label: 'Watch & Earn' },
};

/**
 * Wraps an ad with its color-coded border/glow identity.
 *
 * type:
 *   'claim'  — yellow  (empty inventory / "claim this spot" house ads)
 *   'cpm'    — neon apple-green (paid CPM / affiliate — Adsterra, Revive)
 *   'adult'  — red↔blue pulsing (adult-gated Adsterra)
 *   'reward' — pulsing red + white border (Watch & Earn slots)
 */
export default function AdColorWrapper({ type = 'cpm', children, className = '' }) {
  const badge = BADGE[type];
  if (!badge) return children;

  return (
    <div className={`relative ${className}`}>
      <div className={`ad-${type} overflow-hidden`}>
        {children}
      </div>
      <span
        className={`absolute -top-2 -right-2 z-10 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    </div>
  );
}
