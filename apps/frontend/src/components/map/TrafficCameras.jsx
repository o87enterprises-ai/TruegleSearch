import { useState, useEffect, useCallback } from 'react';
import { Camera, X, MapPin, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraView from './CameraView';
import { fetchCamerasNearLocation } from './services/dotCameraService';

/**
 * TrafficCameras Component
 * Finds and displays live traffic camera feeds near the user's location
 */
export default function TrafficCameras({ userLocation, isOpen, onClose }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState(null);

  const fetchNearbyTrafficCams = useCallback(async (lat, lng) => {
    setLoading(true);
    setError(null);

    try {
      // Validate coordinates
      if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('Invalid location coordinates. Please enable location services or select a location on the map.');
      }

      console.log('🎥 Fetching traffic cameras for location:', { lat, lng });

      // Fetch cameras near location (within 150 miles, max 15 cameras)
      // Increased radius to cover border states and rural areas where coverage may be sparse
      const nearbyCameras = await fetchCamerasNearLocation({ lat, lng }, 150, 15);

      if (nearbyCameras && nearbyCameras.length > 0) {
        setCameras(nearbyCameras);
        console.log(`✅ Loaded ${nearbyCameras.length} cameras near location`);
      } else {
        // No cameras found — the OpenTrafficCamMap dataset only covers ~10 US
        // states, so outside those this is genuine absence, not an error.
        console.log(`⚠️ No cameras available within 150 miles of this location`);
        setCameras([]);
        setError(
          'No live cameras within 150 miles. Public camera coverage is currently ' +
          'limited to parts of the US (AL, AK, AZ, CA, CO, DE, GA, IN, KY, OH).'
        );
      }

    } catch (err) {
      console.error('❌ Error fetching traffic cameras:', err);
      setError(err.message);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);


  // Fetch cameras when panel opens OR when user location changes (e.g., after permissions granted)
  useEffect(() => {
    if (isOpen && userLocation?.lat && userLocation?.lng) {
      console.log('🎥 Location detected, fetching nearby traffic cameras...');
      fetchNearbyTrafficCams(userLocation.lat, userLocation.lng);
    }
  }, [isOpen, userLocation, fetchNearbyTrafficCams]);

  const handleRefresh = () => {
    if (userLocation?.lat && userLocation?.lng) {
      fetchNearbyTrafficCams(userLocation.lat, userLocation.lng);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 h-full w-96 bg-gradient-to-br from-neutral-900 to-neutral-800 shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700/50 bg-gradient-to-r from-cyan-900/20 to-blue-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Camera size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Live Traffic Cameras</h2>
            <p className="text-xs text-cyan-400">
              {cameras.length} cameras nearby
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh cameras"
          >
            <RefreshCw size={18} className={`text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="m-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Camera List */}
      <div className="overflow-y-auto h-[calc(100%-80px)] p-4 space-y-3">
        {loading && cameras.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw size={32} className="text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-white/60">Finding nearby cameras...</p>
            </div>
          </div>
        ) : cameras.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Camera size={32} className="text-white/30 mx-auto mb-3" />
              <p className="text-white/60">No cameras found nearby</p>
            </div>
          </div>
        ) : (
          cameras.map((camera) => (
            <motion.div
              key={camera.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden border border-neutral-700/50 hover:border-cyan-500/50 transition-all cursor-pointer"
              onClick={() => setSelectedCamera(camera)}
            >
              {/* Camera Preview Image */}
              <div className="relative h-32 bg-neutral-800">
                {/* Stills poll; HLS cameras play. The old <img> rendered a
                    null src for every video camera and swapped in a "Camera
                    Offline" placeholder — 2,926 live cameras calling
                    themselves dead. Tiles do not autoplay: a grid of thirty
                    simultaneous HLS streams is not a preview, it is a
                    download. */}
                <CameraView camera={camera} autoPlay={false} />
                {camera.isLive && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-600 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-white">LIVE</span>
                  </div>
                )}
              </div>

              {/* Camera Info */}
              <div className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
                      {camera.name}
                    </h3>
                    <p className="text-xs text-cyan-400">{camera.roadName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/60 ml-2">
                    <MapPin size={12} />
                    <span>{camera.distance} mi</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-white/60">
                    <span>Direction: {camera.direction}</span>
                    <span className="text-cyan-400">{camera.source}</span>
                  </div>
                  {camera.streamUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(camera.streamUrl, '_blank');
                      }}
                      className="p-1 hover:bg-cyan-500/20 rounded"
                    >
                      <ExternalLink size={14} className="text-cyan-400" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Selected Camera Modal */}
      <AnimatePresence>
        {selectedCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm z-10 flex items-center justify-center p-4"
            onClick={() => setSelectedCamera(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl overflow-hidden max-w-2xl w-full border border-cyan-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-700/50">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedCamera.name}</h3>
                  <p className="text-sm text-cyan-400">{selectedCamera.roadName}</p>
                </div>
                <button
                  onClick={() => setSelectedCamera(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4">
                {/* Opened deliberately, so this one does play. */}
                <CameraView camera={selectedCamera} className="w-full aspect-video rounded-lg overflow-hidden mb-4" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-white/60">Direction:</span>
                    <span className="text-white ml-2">{selectedCamera.direction}</span>
                  </div>
                  <div>
                    <span className="text-white/60">Distance:</span>
                    <span className="text-white ml-2">{selectedCamera.distance} mi</span>
                  </div>
                  <div>
                    <span className="text-white/60">Location:</span>
                    <span className="text-white ml-2">{selectedCamera.city}, {selectedCamera.state}</span>
                  </div>
                  <div>
                    <span className="text-white/60">Source:</span>
                    <span className="text-white ml-2">{selectedCamera.source}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-white/60">Last Updated:</span>
                    <span className="text-white ml-2">
                      {new Date(selectedCamera.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* The stream is playing above now, so this is an escape
                    hatch rather than the only way to watch. It used to be the
                    latter, and it handed the browser a raw .m3u8 — which
                    Chrome downloads as a file instead of playing. */}
                {selectedCamera.streamUrl && (
                  <button
                    onClick={() => window.open(selectedCamera.streamUrl, '_blank')}
                    className="w-full mt-4 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-white/70 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Open stream in your own player
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
