import { useEffect, useMemo, useRef } from 'react';
import { pickHouseAd, getAdById } from '../../config/houseAds';

/** Fire-and-forget signal that opens the global advertiser contact modal. */
export function openAdvertiseModal() {
  window.dispatchEvent(new CustomEvent('truegle:open-advertise'));
}

/*
 * Renders a single first-party "house ad" (one of our own projects).
 *
 * No external scripts, no third-party pixels — impression/click counts are kept
 * locally in localStorage so we can prove inventory value to advertisers without
 * tracking the user. Export the counts later via getAdStats() for the media kit.
 */

const STORAGE_KEY = 'truegle.adStats.v1';

function readStats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function bump(adId, field) {
  try {
    const stats = readStats();
    const row = stats[adId] || { impressions: 0, clicks: 0 };
    row[field] += 1;
    stats[adId] = row;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage unavailable (private mode / blocked) — counts are best-effort.
  }
}

/** Aggregate local ad stats — handy for the /advertise media kit and debugging. */
export function getAdStats() {
  return readStats();
}

const variantStyles = {
  yellow: 'from-[#FFEB3B]/25 to-[#FFC107]/25 border-yellow-400/60',
  blue: 'from-blue-500/25 to-cyan-500/25 border-blue-400/60',
  purple: 'from-purple-500/25 to-pink-500/25 border-purple-400/60',
  green: 'from-emerald-500/25 to-green-500/25 border-emerald-400/60',
};

const buttonStyles = {
  yellow: 'from-orange-500 to-red-500',
  blue: 'from-blue-500 to-cyan-500',
  purple: 'from-purple-500 to-pink-500',
  green: 'from-emerald-500 to-green-500',
};

/**
 * @param {Object} props
 * @param {string} [props.category]  contextual hint (e.g. search mode)
 * @param {string} [props.zone]      ad zone id, recorded with stats
 * @param {Object} [props.ad]        force a specific ad (otherwise auto-picked)
 * @param {string} [props.className]
 * @param {boolean} [props.compact]  smaller padding/type — for tight spots like next to the AI summary
 */
const HouseAd = ({ category, zone = 'unknown', adId, ad: forcedAd, className = '', compact = false }) => {
  // Pinned slot (adId) → that exact ad; otherwise pick once per mount.
  const ad = useMemo(
    () => forcedAd || (adId ? getAdById(adId) : null) || pickHouseAd({ category }),
    [forcedAd, adId, category]
  );
  const counted = useRef(false);

  useEffect(() => {
    if (ad && !counted.current) {
      counted.current = true;
      bump(ad.id, 'impressions');
    }
  }, [ad]);

  if (!ad) return null;

  const accent = variantStyles[ad.variant] || variantStyles.blue;
  const btn = buttonStyles[ad.variant] || buttonStyles.blue;
  const label = ad.label || (ad.sponsor ? 'Sponsored' : 'From our projects');
  const isContact = ad.action === 'contact';

  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-white/60 mb-1">
          {label}
        </div>
        <div className={`font-semibold text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>{ad.title}</div>
        {ad.description && !compact && (
          <div className="text-xs text-white/80">{ad.description}</div>
        )}
      </div>
      <span
        className={`shrink-0 rounded-xl bg-gradient-to-r ${btn} text-white font-semibold whitespace-nowrap shadow-lg ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
      >
        {ad.cta || 'Learn More'}
      </span>
    </div>
  );

  const cardClass = `block w-full text-left rounded-2xl bg-gradient-to-br ${accent} backdrop-blur-xl border-2 shadow-lg transition-all duration-300 hover:scale-[1.02] no-underline ${compact ? 'p-2.5' : 'p-4'} ${className}`;

  // Contact-action ad → button that opens the advertiser modal (no navigation).
  if (isContact) {
    return (
      <button
        type="button"
        onClick={() => { bump(ad.id, 'clicks'); openAdvertiseModal(); }}
        data-ad-zone={zone}
        data-ad-id={ad.id}
        className={cardClass}
      >
        {inner}
      </button>
    );
  }

  return (
    <a
      href={ad.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={() => bump(ad.id, 'clicks')}
      data-ad-zone={zone}
      data-ad-id={ad.id}
      className={cardClass}
    >
      {inner}
    </a>
  );
};

export default HouseAd;
