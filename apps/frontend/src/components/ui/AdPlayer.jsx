import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Volume2, VolumeX, Clock, CheckCircle, X } from 'lucide-react';
import AdsterraBanner from '../ads/AdsterraBanner';

const AD_DURATION = 30; // seconds

/**
 * AdPlayer Component
 * Plays video ads with skip prevention and completion tracking
 */
const AdPlayer = ({
  onComplete,
  onClose,
  onSessionStart,
  adId = 'demo-ad-001',
  sessionId = null,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(AD_DURATION);
  const [isComplete, setIsComplete] = useState(false);
  const [showCompleteMessage, setShowCompleteMessage] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  // Start the countdown timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Handle video play
  const handlePlay = () => {
    setIsPlaying(true);
    onSessionStart?.();
    startTimer();
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked, continue with timer anyway
      });
    }
  };

  // Handle completion
  useEffect(() => {
    if (isComplete) {
      setShowCompleteMessage(true);
      setTimeout(() => {
        onComplete?.(sessionId, adId);
      }, 1500);
    }
  }, [isComplete, sessionId, adId, onComplete]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm ${className}`}
    >
      <div className="relative w-full max-w-2xl mx-4">
        {/* Ad Container */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-b border-gray-700">
            <span className="text-sm text-gray-300">Sponsored Content</span>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-mono text-white">
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>

          {/* Video Area */}
          <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-blue-900">
            {!isPlaying ? (
              // Play overlay
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">
                    Watch to earn 1 token
                  </h3>
                  <p className="text-gray-300 text-sm">
                    {AD_DURATION} second video advertisement
                  </p>
                </div>
                <motion.button
                  onClick={handlePlay}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-purple-500/30 transition-shadow"
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                  Watch Ad
                </motion.button>
              </div>
            ) : showCompleteMessage ? (
              // Complete message
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-green-900/80 to-emerald-900/80"
              >
                <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">
                  Token Earned!
                </h3>
                <p className="text-green-300">+1 token added to your balance</p>
              </motion.div>
            ) : (
              // Playing state — Adsterra creative
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <AdsterraBanner format="banner728x90" />
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                    initial={{ width: '0%' }}
                    animate={{
                      width: `${((AD_DURATION - timeRemaining) / AD_DURATION) * 100}%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          {isPlaying && !showCompleteMessage && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50">
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
              <p className="text-sm text-gray-400">
                Please watch the entire ad to earn your token
              </p>
              <div className="w-10" /> {/* Spacer for balance */}
            </div>
          )}
        </div>

        {/* Close button (only before playing) */}
        {!isPlaying && (
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors border border-gray-600"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default AdPlayer;
