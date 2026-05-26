import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Navigation,
  Maximize2,
  Clock,
  Loader2,
  Building2,
  ExternalLink,
  Copy,
  Check,
  Star,
  DollarSign
} from 'lucide-react';
import { useMap } from './context/MapContext';
import { useState } from 'react';

const LocationDetailsPanel = ({ isOpen, onClose, onGetDirections }) => {
  const { state, actions } = useMap();
  const { selectedLocationDetails, locationDetailsLoading } = state;
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Auto-enrich location data when panel opens
  useEffect(() => {
    if (isOpen && selectedLocationDetails && !selectedLocationDetails.enriched) {
      actions.enrichLocationDetails(selectedLocationDetails);
    }
  }, [isOpen, selectedLocationDetails, actions]);

  const handleZoomLock = () => {
    if (selectedLocationDetails) {
      actions.flyTo(
        { lat: selectedLocationDetails.lat, lng: selectedLocationDetails.lng },
        17 // High zoom level for focused view
      );
    }
  };

  const handleGetDirections = () => {
    if (onGetDirections && selectedLocationDetails) {
      onGetDirections(selectedLocationDetails);
    }
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return '';
    // Display formatted phone number
    return phone.replace(/^\+1-/, '').replace(/-/g, ' ');
  };

  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const renderStars = (rating) => {
    if (!rating) return null;

    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} size={14} className="text-yellow-400 fill-yellow-400 opacity-50" />
        );
      } else {
        stars.push(<Star key={i} size={14} className="text-gray-600" />);
      }
    }

    return stars;
  };

  if (!selectedLocationDetails) return null;

  const location = selectedLocationDetails;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 h-screen w-96 bg-gradient-to-b from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl border-l border-neutral-700/50 shadow-2xl z-50 overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-neutral-700/50 bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white truncate max-w-[250px]">
                  {location.name}
                </h2>
                {location.category && (
                  <p className="text-xs text-purple-400 font-medium">
                    {location.category}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <X size={20} className="text-white" />
            </button>
          </div>

          {/* Loading State */}
          {locationDetailsLoading && (
            <div className="p-6 flex flex-col items-center justify-center">
              <Loader2 size={32} className="text-purple-400 animate-spin mb-3" />
              <p className="text-white/60 text-sm">Loading details...</p>
            </div>
          )}

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {location.isOpen !== null && location.isOpen !== undefined && (
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  location.isOpen
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {location.isOpen ? 'Open Now' : 'Closed'}
                </div>
              )}
              {location.priceRange && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/30">
                  <DollarSign size={12} className="text-green-400" />
                  <span className="text-xs font-semibold text-green-400">{location.priceRange}</span>
                </div>
              )}
              {location.formattedDistance && (
                <div className="px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <span className="text-xs font-semibold text-blue-400">{location.formattedDistance} away</span>
                </div>
              )}
            </div>

            {/* Rating */}
            {location.rating && (
              <div className="p-4 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-500/30">
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(location.rating)}</div>
                  <span className="text-sm text-white font-semibold">{location.rating.toFixed(1)}</span>
                  {location.reviewCount > 0 && (
                    <span className="text-xs text-white/60">({location.reviewCount} reviews)</span>
                  )}
                </div>
              </div>
            )}

            {/* Address */}
            {location.address && (
              <div className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/30">
                <MapPin size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-neutral-400 mb-1">Address</div>
                  <div className="text-sm text-white leading-relaxed">
                    {location.address}
                  </div>
                </div>
              </div>
            )}

            {/* Contact Information */}
            {location.enriched && (
              <div className="space-y-3 border-b border-neutral-700/50 pb-4">
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                  Contact Information
                </h3>

                {/* Phone */}
                {location.phone && (
                  <div className="group">
                    <a
                      href={`tel:${location.phone}`}
                      className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-700/50 transition-all border border-neutral-700/30 hover:border-green-500/30"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Phone size={16} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-neutral-400">Phone</div>
                        <div className="text-sm text-white font-medium">
                          {formatPhoneDisplay(location.phone)}
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-neutral-500 group-hover:text-green-400 transition-colors" />
                    </a>
                    <button
                      onClick={() => copyToClipboard(location.phone)}
                      className="mt-2 ml-11 flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
                    >
                      {copiedPhone ? (
                        <>
                          <Check size={12} className="text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy number</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Email */}
                {location.email && (
                  <a
                    href={`mailto:${location.email}`}
                    className="group flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-700/50 transition-all border border-neutral-700/30 hover:border-blue-500/30"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <Mail size={16} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-neutral-400">Email</div>
                      <div className="text-sm text-white font-medium truncate">
                        {location.email}
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-neutral-500 group-hover:text-blue-400 transition-colors" />
                  </a>
                )}

                {/* Website */}
                {location.website && (
                  <a
                    href={location.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-700/50 transition-all border border-neutral-700/30 hover:border-cyan-500/30"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <Globe size={16} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-neutral-400">Website</div>
                      <div className="text-sm text-white font-medium truncate">
                        {extractDomain(location.website)}
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-neutral-500 group-hover:text-cyan-400 transition-colors" />
                  </a>
                )}

                {/* Hours */}
                {location.hours && (
                  <div className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/30">
                    <Clock size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-neutral-400 mb-1">Hours</div>
                      <div className="text-sm text-white leading-relaxed">
                        {location.hours}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No Contact Info Message */}
            {!locationDetailsLoading && location.enriched === false && (
              <div className="p-4 bg-neutral-800/30 rounded-lg border border-neutral-700/30">
                <p className="text-sm text-neutral-400 text-center">
                  No additional contact information available for this location.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleGetDirections}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                <Navigation size={18} />
                Get Directions
              </button>

              <button
                onClick={handleZoomLock}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800/50 hover:bg-neutral-700/50 text-white font-medium rounded-lg border border-neutral-700/50 hover:border-neutral-600 transition-all"
              >
                <Maximize2 size={18} />
                Zoom & Lock
              </button>
            </div>

            {/* Data Source Attribution */}
            {location.sources && location.sources.length > 0 && (
              <div className="pt-4 border-t border-neutral-700/30">
                <p className="text-xs text-neutral-500 text-center">
                  Data from: {location.sources.join(', ')}
                </p>
                <p className="text-xs text-neutral-600 text-center mt-1">
                  Information from publicly available sources
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LocationDetailsPanel;
