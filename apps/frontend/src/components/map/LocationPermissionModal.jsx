import { useState } from 'react';
import { MapPin, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { requestPosition } from '../../utils/geolocation';

/**
 * LocationPermissionModal Component
 * Asks for user's location permission and handles the result
 */
export default function LocationPermissionModal({ isOpen, onClose, onLocationGranted, onLocationDenied }) {
  const [status, setStatus] = useState('idle'); // idle, requesting, granted, failed
  // The whole diagnosis, not just a sentence — see utils/geolocation.
  const [problem, setProblem] = useState(null);

  const requestLocation = async () => {
    setStatus('requesting');
    setProblem(null);

    const result = await requestPosition();

    if (result.ok) {
      setStatus('granted');
      onLocationGranted?.(result.position);
      setTimeout(() => onClose(), 1500);
      return;
    }

    // ONE failure state, not two, and never labelled "denied" by default.
    // The old code set status='denied' for every error, so a GPS timeout and a
    // switched-off device both told the user they had refused a permission
    // they had in fact granted. What the failure IS now lives in `problem`.
    setStatus('failed');
    setProblem(result);
    onLocationDenied?.(result.message);
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
                    status === 'failed' ? 'bg-amber-500/20' :
                    'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}>
                    {status === 'granted' ? (
                      <CheckCircle size={24} className="text-green-400" />
                    ) : status === 'failed' ? (
                      <AlertCircle size={24} className="text-amber-400" />
                    ) : status === 'requesting' ? (
                      <Loader2 size={24} className="text-white animate-spin" />
                    ) : (
                      <MapPin size={24} className="text-white" />
                    )}
                  </div>
                  <div>
                    {/* The heading NAMES the actual problem. "Permission
                        Denied" over a switched-off phone toggle is not just
                        unhelpful, it is wrong, and it sends people to a
                        browser setting that was never the obstacle. */}
                    <h2 className="text-xl font-bold text-white">
                      {status === 'granted' ? 'Location Granted' :
                       status === 'failed' ? (problem?.title || 'Couldn’t get a location') :
                       status === 'requesting' ? 'Getting Location...' :
                       'Enable Location'}
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1">
                      {status === 'granted' ? 'Successfully got your location' :
                       status === 'failed' ? 'Here’s what to check' :
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

              {status === 'failed' && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-200/90">{problem?.message}</p>
                  </div>

                  {/* Browser steps ONLY when the browser is the obstacle. They
                      used to show for every failure, which is how someone with
                      a switched-off phone toggle ended up repeatedly setting an
                      already-correct browser permission. */}
                  {problem?.kind === 'browser-denied' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white">To enable location access:</p>
                      <ol className="text-xs text-white/70 space-y-1 list-decimal list-inside">
                        <li>Tap the icon at the left of the address bar</li>
                        <li>Find &quot;Location&quot; in the permissions list</li>
                        <li>Change it to &quot;Allow&quot;</li>
                        <li>Refresh this page and try again</li>
                      </ol>
                    </div>
                  )}

                  {problem?.kind === 'device-off' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white">Where to turn it on:</p>
                      <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
                        <li><strong>Android:</strong> Settings → Location</li>
                        <li><strong>iPhone:</strong> Settings → Privacy &amp; Security → Location Services</li>
                        <li><strong>Windows:</strong> Settings → Privacy → Location</li>
                        <li><strong>macOS:</strong> System Settings → Privacy &amp; Security → Location Services</li>
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-white/40">
                    You can also just type a place name into the search box — the map works
                    without knowing where you are.
                  </p>
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

              {status === 'failed' && (
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
