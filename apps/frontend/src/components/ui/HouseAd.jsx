import { useEffect, useMemo, useRef } from 'react';
import { pickHouseAd, getAdById } from '../../config/houseAds';
import ClaimPremiumOffer from './ClaimPremiumOffer';

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

// Three visual tiers, picked by the `compact`/`featured` props. `standard` is
// the baseline every ad slot uses now — full description + room for a logo.
// `featured` is reserved for the pinned "Claim this spot" CTA, sized up just
// enough to stand out without breaking the grid. `compact` stays available
// for any future tight-spot placement even though nothing uses it today.
const sizing = {
  compact: {
    card: 'p-2.5',
    title: 'text-xs',
    description: null,
    button: 'px-3 py-1.5 text-xs',
    logo: 'w-8 h-8',
  },
  standard: {
    card: 'p-4',
    title: 'text-sm',
    description: 'text-xs',
    button: 'px-4 py-2 text-sm',
    logo: 'w-10 h-10',
  },
  featured: {
    card: 'p-5',
    title: 'text-base',
    description: 'text-sm',
    button: 'px-5 py-2.5 text-base',
    logo: 'w-12 h-12',
  },
};

/**
 * @param {Object} props
 * @param {string} [props.category]  contextual hint (e.g. search mode)
 * @param {string} [props.query]     the user's search query — matched against ad.keywords
 * @param {string} [props.zone]      ad zone id, recorded with stats
 * @param {Object} [props.ad]        force a specific ad (otherwise auto-picked)
 * @param {string} [props.className]
 * @param {boolean} [props.compact]  smaller padding/type — for tight spots like next to the AI summary
 * @param {boolean} [props.featured] slightly larger than standard — reserved for the pinned "Claim this spot" CTA
 */
const HouseAd = ({ category, query, zone = 'unknown', adId, ad: forcedAd, className = '', compact = false, featured = false }) => {
  // Pinned slot (adId) → that exact ad; otherwise pick once per mount.
  const ad = useMemo(
    () => forcedAd || (adId ? getAdById(adId) : null) || pickHouseAd({ category, query }),
    [forcedAd, adId, category, query]
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
  const tier = sizing[compact ? 'compact' : featured ? 'featured' : 'standard'];

  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {ad.logo && (
          <img src={ad.logo} alt="" className={`${tier.logo} shrink-0 rounded-lg object-contain`} />
        )}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-white/60 mb-1">
            {label}
          </div>
          <div className={`font-semibold text-white truncate ${tier.title}`}>{ad.title}</div>
          {ad.description && tier.description && (
            <div className={`${tier.description} text-white/80`}>{ad.description}</div>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-xl bg-gradient-to-r ${btn} text-white font-semibold whitespace-nowrap shadow-lg ${tier.button}`}
      >
        {ad.cta || 'Learn More'}
      </span>
    </div>
  );

  const cardClass = `block w-full text-left rounded-2xl bg-gradient-to-br ${accent} backdrop-blur-xl border-2 shadow-lg transition-all duration-300 hover:scale-[1.02] no-underline ${tier.card}`;

  // Contact-action ad → button that opens the advertiser modal (no navigation).
  if (isContact) {
    return (
      <button
        type="button"
        onClick={() => { bump(ad.id, 'clicks'); openAdvertiseModal(); }}
        data-ad-zone={zone}
        data-ad-id={ad.id}
        className={`${cardClass} ${className}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className}>
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
      {ad.affiliate && <ClaimPremiumOffer offerId={ad.id} offerTitle={ad.title} />}
    </div>
  );
};

export default HouseAd;
