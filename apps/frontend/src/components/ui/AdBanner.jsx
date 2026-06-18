import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import HouseAd from './HouseAd';

const { FiX } = FiIcons;

/*
 * AdBanner — now a thin wrapper around the first-party HouseAd system.
 *
 * Previously this rendered hard-coded mock "Sponsored" banners. It now serves
 * real house ads (our projects + the "Advertise here" CTA + affiliate offers),
 * so every place that used a mock banner (AI chat overlay, etc.) shows live
 * inventory. Legacy props (variant/title/description/ctaText/duration…) are
 * accepted and ignored so existing call sites keep working.
 *
 * Use `adId` to pin a specific ad (e.g. "github-profile", "advertise-cta").
 */
const AdBanner = ({
  adId,
  category,
  zone = 'banner',
  dismissible = false,
  className = '',
}) => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`relative ${className}`}
      >
        <HouseAd adId={adId} category={category} zone={zone} />
        {dismissible && (
          <button
            onClick={() => setVisible(false)}
            className="absolute top-2 right-2 text-white/60 hover:text-white transition-opacity p-1"
            aria-label="Dismiss ad"
          >
            <SafeIcon icon={FiX} size={14} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AdBanner;

export { AdBanner };
