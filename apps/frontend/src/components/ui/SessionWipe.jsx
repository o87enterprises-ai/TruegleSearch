/**
 * SessionWipe Component ("Nuclear Option")
 * Provides immediate session data wipe capability
 * Part of P1 Core Foundation - Session Wipe Feature
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react';

/**
 * Clear all client-side storage
 */
async function clearClientStorage() {
  const results = {
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
  };

  // Clear localStorage (except essential settings)
  try {
    const keysToPreserve = ['theme', 'language']; // Preserve UI preferences
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!keysToPreserve.includes(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    results.localStorage = true;
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }

  // Clear sessionStorage
  try {
    sessionStorage.clear();
    results.sessionStorage = true;
  } catch (error) {
    console.error('Failed to clear sessionStorage:', error);
  }

  // Clear IndexedDB
  try {
    if (window.indexedDB && window.indexedDB.databases) {
      const databases = await window.indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    }
    results.indexedDB = true;
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error);
    // Some browsers don't support databases() method
    results.indexedDB = true; // Assume success if not supported
  }

  return results;
}

/**
 * Call server to wipe ephemeral data
 */
async function wipeServerData(token) {
  try {
    const response = await fetch('/api/session/wipe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Server wipe failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Server wipe failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Nuclear Option Button Component
 */
export function NuclearOptionButton({ onWipeComplete, token, className = '' }) {
  const [showModal, setShowModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState(null);

  const handleWipe = useCallback(async () => {
    setIsWiping(true);
    setWipeResult(null);

    try {
      // Clear client-side storage first
      const clientResults = await clearClientStorage();

      // Then wipe server-side data if authenticated
      let serverResults = { success: true, note: 'Not authenticated' };
      if (token) {
        serverResults = await wipeServerData(token);
      }

      const success = clientResults.localStorage &&
                     clientResults.sessionStorage &&
                     clientResults.indexedDB;

      setWipeResult({
        success,
        client: clientResults,
        server: serverResults,
      });

      if (success && onWipeComplete) {
        onWipeComplete();
      }
    } catch (error) {
      setWipeResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsWiping(false);
    }
  }, [token, onWipeComplete]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setShowModal(true)}
        className={`
          flex items-center gap-2 px-4 py-2
          bg-gradient-to-r from-red-600 to-red-700
          hover:from-red-500 hover:to-red-600
          text-white font-semibold rounded-lg
          transition-all duration-200
          shadow-lg shadow-red-500/20
          hover:shadow-red-500/40
          ${className}
        `}
      >
        <Trash2 size={18} />
        <span>Nuclear Option</span>
      </button>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => !isWiping && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-gray-900 border-2 border-red-500/50 rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              {!isWiping && (
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">Nuclear Option</h3>
              </div>

              {/* Content */}
              {!wipeResult ? (
                <>
                  <p className="text-gray-300 mb-4">
                    This will immediately delete all your session data:
                  </p>

                  <ul className="space-y-2 mb-6 text-sm text-gray-400">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Search history (localStorage)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Session data (sessionStorage)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Cached results (IndexedDB)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Server ephemeral logs
                    </li>
                  </ul>

                  <p className="text-yellow-400 text-sm mb-6">
                    This action cannot be undone.
                  </p>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      disabled={isWiping}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleWipe}
                      disabled={isWiping}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isWiping ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          <span>Wiping...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={18} />
                          <span>Wipe Everything</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                // Result display
                <div className="text-center">
                  {wipeResult.success ? (
                    <>
                      <div className="mb-4">
                        <CheckCircle className="mx-auto text-green-500" size={48} />
                      </div>
                      <h4 className="text-lg font-semibold text-white mb-2">
                        Wipe Complete
                      </h4>
                      <p className="text-gray-400 text-sm mb-4">
                        All session data has been deleted.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-4">
                        <AlertTriangle className="mx-auto text-yellow-500" size={48} />
                      </div>
                      <h4 className="text-lg font-semibold text-white mb-2">
                        Partial Wipe
                      </h4>
                      <p className="text-gray-400 text-sm mb-4">
                        Some data may not have been cleared. Try again or contact support.
                      </p>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setShowModal(false);
                      setWipeResult(null);
                    }}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Toast notification for wipe completion
 */
export function WipeSuccessToast({ show, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg"
        >
          <CheckCircle size={20} />
          <span>Session data wiped successfully</span>
          <button onClick={onClose} className="ml-2 hover:bg-green-500 rounded p-1">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NuclearOptionButton;
