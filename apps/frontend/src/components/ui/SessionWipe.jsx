/**
 * SessionWipe Component ("Nuclear Option")
 * Provides immediate session data wipe capability
 * Part of P1 Core Foundation - Session Wipe Feature
 */
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    caches: false,
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

  // Clear the Cache Storage API — the service worker's caches.
  //
  // THIS WAS THE GAP. The button's own description promises "cached results",
  // and this is where cached responses actually live; wiping localStorage and
  // IndexedDB left every cached page and API response sitting on disk. So the
  // one storage the copy explicitly named was the one nothing touched.
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    results.caches = true;
  } catch (error) {
    // Blocked in some private modes, and absent over plain http. Neither is a
    // failure of the wipe — there is simply no cache to clear.
    console.error('Failed to clear Cache Storage:', error);
    results.caches = true;
  }

  return results;
}

/**
 * Call the server to wipe ephemeral data.
 *
 * NO TOKEN IS REQUIRED, and that is the fix. This used to be skipped entirely
 * when the visitor was signed out — and the modal still showed the success
 * screen, so someone with no account was told their server-side ephemeral logs
 * were gone when nothing had ever been asked to delete them. Truegle works
 * without an account, so that was most of the people pressing the button.
 *
 * The endpoint is public now (see routes/session.js for why that is safe). A
 * token is still SENT when there is one, because it is the key the
 * session-scoped rows are stored under — but its absence no longer means
 * "don't bother asking".
 */
async function wipeServerData(token) {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/session/wipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Only when we actually have one. Sending `Bearer null` would be a
        // string the server then looks rows up under, which finds nothing and
        // reads like a bug in the logs.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Server wipe failed (${response.status})`);
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
// Medium for page footers and cards, large where it is the point of the
// section. Owner, 2026-10-08: a "medium to large" button in every footer, so
// it reads as something that can be pressed at will from any page.
const SIZES = {
  sm: 'px-4 py-2 text-sm gap-2',
  md: 'px-5 py-2.5 text-base gap-2',
  lg: 'px-7 py-3.5 text-lg gap-2.5',
};

export function NuclearOptionButton({ onWipeComplete, token, className = '', size = 'sm', asterisk = false }) {
  const [showModal, setShowModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState(null);

  const handleWipe = useCallback(async () => {
    setIsWiping(true);
    setWipeResult(null);

    try {
      // Clear client-side storage first
      const clientResults = await clearClientStorage();

      // Then wipe server-side data. ALWAYS — signed in or not. See
      // wipeServerData: skipping this for signed-out visitors is what made the
      // success screen a lie for most of the people who saw it.
      const serverResults = await wipeServerData(token ?? (() => { try { return localStorage.getItem('truegle_token'); } catch { return null; } })());

      // The client legs decide success. A server that is unreachable does not
      // make "your data was cleared from this device" untrue, and the result
      // below reports the two halves separately rather than collapsing them.
      const success = clientResults.localStorage &&
                     clientResults.sessionStorage &&
                     clientResults.indexedDB &&
                     clientResults.caches;

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
        type="button"
        data-nuclear-option=""
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className={`
          inline-flex items-center justify-center ${SIZES[size] || SIZES.sm}
          bg-gradient-to-r from-red-600 to-red-700
          hover:from-red-500 hover:to-red-600
          text-white font-semibold rounded-lg
          transition-all duration-200
          shadow-lg shadow-red-500/20
          hover:shadow-red-500/40
          ${className}
        `}
      >
        <Trash2 size={size === 'lg' ? 22 : 18} />
        <span>Nuclear Option{asterisk ? '*' : ''}</span>
      </button>

      {/* Confirmation Modal — portalled to <body>: the button now lives inside
          animated landing cards, and a transformed ancestor turns
          position:fixed into "fixed to the card". */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); if (!isWiping) setShowModal(false); }}
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
                      {/* TWO HALVES, REPORTED SEPARATELY. "All session data has
                          been deleted" was one sentence covering two outcomes
                          that can differ — and it was printed even when the
                          server leg had never run at all. The device is always
                          truthful here because we just did it; the server line
                          says what actually came back. */}
                      <p className="text-gray-400 text-sm mb-1">
                        This device is clear — local storage, session storage and
                        cached results are gone.
                      </p>
                      <p className="text-gray-500 text-xs mb-4">
                        {wipeResult.server?.success === false
                          ? 'The server could not be reached, so its ephemeral logs were left alone. They expire on their own within 24 hours.'
                          : wipeResult.server?.authenticated
                            ? 'Server-side ephemeral logs and cached session rows were deleted too.'
                            : 'Server-side ephemeral logs for your connection were deleted too.'}
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
                      const wiped = wipeResult?.success;
                      setShowModal(false);
                      setWipeResult(null);
                      // What was wiped can still be held in memory by the page
                      // (sign-in, settings, the player's queue). Start fresh.
                      if (wiped && !onWipeComplete) window.location.assign('/');
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
      </AnimatePresence>,
      document.body)}
    </>
  );
}

/**
 * The Nuclear Option as it sits at the foot of every page: the button, and a
 * pointer to what it does (explained at the bottom of the landing page).
 */
export function NuclearStrip({ size = 'md', className = '' }) {
  return (
    <div data-nuclear-strip="" className={`flex flex-col items-center gap-1.5 ${className}`}>
      <NuclearOptionButton size={size} asterisk />
      <a href="/#nuclear-option" className="text-[11px] text-white/40 hover:text-white/70 underline-offset-2 hover:underline">
        *What this does — wipe everything Truegle has on this device, from any page
      </a>
    </div>
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
