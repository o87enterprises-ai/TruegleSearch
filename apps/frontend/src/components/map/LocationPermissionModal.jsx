import { useState } from 'react';
import { MapPin, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LocationPermissionModal Component
 * Asks for user's location permission and handles the result
 */
export default function LocationPermissionModal({ isOpen, onClose, onLocationGranted, onLocationDenied }) {
  const [status, setStatus] = useState('idle'); // idle, requesting, granted, denied, error
  const [errorMessage, setErrorMessage] = useState('');

  const requestLocation = async () => {
    setStatus('requesting');
    setErrorMessage('');

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser');
      if (onLocationDenied) {
        onLocationDenied('Geolocation not supported');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setStatus('granted');

        if (onLocationGranted) {
          onLocationGranted(location);
        }

        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 1500);
      },
      (error) => {
        setStatus('denied');
        let message = 'Unable to retrieve your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
          default:
            message = 'An unknown error occurred.';
        }

        setErrorMessage(message);

        if (onLocationDenied) {
          onLocationDenied(message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && status !== 'requesting') {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl max-w-md w-full border border-neutral-700/50 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-neutral-700/50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    status === 'granted' ? 'bg-green-500/20' :
                    status === 'denied' || status === 'error' ? 'bg-red-500/20' :
                    'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}>
                    {status === 'granted' ? (
                      <CheckCircle size={24} className="text-green-400" />
                    ) : status === 'denied' || status === 'error' ? (
                      <AlertCircle size={24} className="text-red-400" />
                    ) : status === 'requesting' ? (
                      <Loader2 size={24} className="text-white animate-spin" />
                    ) : (
                      <MapPin size={24} className="text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {status === 'granted' ? 'Location Granted' :
                       status === 'denied' ? 'Permission Denied' :
                       status === 'error' ? 'Location Error' :
                       status === 'requesting' ? 'Getting Location...' :
                       'Enable Location'}
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1">
                      {status === 'granted' ? 'Successfully got your location' :
                       status === 'denied' || status === 'error' ? 'Could not access location' :
                       status === 'requesting' ? 'Accessing your device location' :
                       'We need your location for directions'}
                    </p>
                  </div>
                </div>
                {status !== 'requesting' && (
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {status === 'idle' && (
                <div className="space-y-4">
                  <p className="text-white/80 text-sm">
                    To provide you with accurate directions, live traffic updates, and nearby places, we need access to your current location.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                      <div>
                        <p className="text-sm font-medium text-white">Turn-by-turn directions</p>
                        <p className="text-xs text-white/60 mt-0.5">Get accurate routes from your location</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5"></div>
                      <div>
                        <p className="text-sm font-medium text-white">Live traffic updates</p>
                        <p className="text-xs text-white/60 mt-0.5">See real-time traffic conditions near you</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5"></div>
                      <div>
                        <p className="text-sm font-medium text-white">Nearby places</p>
                        <p className="text-xs text-white/60 mt-0.5">Find restaurants, stores, and services around you</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-400">
                      🔒 Your location is only used during your session and is not stored or shared.
                    </p>
                  </div>
                </div>
              )}

              {status === 'requesting' && (
                <div className="py-8 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-white/80 text-sm">Requesting your location...</p>
                  <p className="text-white/60 text-xs mt-1">This may take a few seconds</p>
                </div>
              )}

              {status === 'granted' && (
                <div className="py-8 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <CheckCircle size={32} className="text-green-400" />
                  </div>
                  <p className="text-white font-medium">Location access granted!</p>
                  <p className="text-white/60 text-sm mt-1">You can now use all location features</p>
                </div>
              )}

              {(status === 'denied' || status === 'error') && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{errorMessage}</p>
                  </div>

                  {status === 'denied' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white">To enable location access:</p>
                      <ol className="text-xs text-white/70 space-y-1 list-decimal list-inside">
                        <li>Click the lock icon in your browser's address bar</li>
                        <li>Find "Location" in the permissions list</li>
                        <li>Change it to "Allow"</li>
                        <li>Refresh this page and try again</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-neutral-700/50 flex gap-3">
              {status === 'idle' && (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Not Now
                  </button>
                  <button
                    onClick={requestLocation}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <MapPin size={16} />
                    Allow Location
                  </button>
                </>
              )}

              {(status === 'denied' || status === 'error') && (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={requestLocation}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all"
                  >
                    Try Again
                  </button>
                </>
              )}

              {status === 'granted' && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-lg transition-all"
                >
                  Continue
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
