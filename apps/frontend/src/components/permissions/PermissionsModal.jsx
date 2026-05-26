import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '../../utils/cn';
import PermissionToggle from './PermissionToggle';
import usePermissions, { usePermissions as usePermissionsHook } from '../../hooks/permissions/usePermissions';
import BROWSER_API from '../../api/browserSettings';

const PermissionsModal = ({ isOpen, onClose, onFirstSearch }) => {
  const {
    permissions,
    togglePermission,
    acceptPermissions,
    dismissModal,
    browserInfo
  } = usePermissionsHook();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showFallback, setShowFallback] = useState(false);

  const permissionOptions = [
    {
      key: 'searchEngine',
      label: 'Set as Default Search Engine',
      benefit: 'Get instant results without switching tabs'
    },
    {
      key: 'homepage',
      label: 'Set as Homepage',
      benefit: 'Start every browsing session with Truegle'
    },
    {
      key: 'aiAssistant',
      label: 'Set as AI Assistant Default',
      benefit: 'Quick AI answers from your keyboard'
    }
  ];

  const handleAcceptAll = async () => {
    setLoading(true);
    setResult(null);

    if (!browserInfo.supportsAPI) {
      setShowFallback(true);
      setLoading(false);
      return;
    }

    const result = await acceptPermissions(permissions);
    setResult(result);
    setLoading(false);

    if (result.success) {
      onFirstSearch?.();
      setTimeout(() => onClose(), 1500);
    }
  };

  const handleDismiss = () => {
    dismissModal();
    onFirstSearch?.();
    onClose();
  };

  const instructions = BROWSER_API.getInstructions(browserInfo.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="permissions-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative w-full max-w-lg rounded-2xl',
              'bg-gradient-to-br from-neutral-900/95 to-neutral-800/95',
              'backdrop-blur-xl border border-white/10',
              'shadow-2xl shadow-black/50',
              'overflow-hidden'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDismiss}
              disabled={loading}
              className={cn(
                'absolute top-4 right-4 w-8 h-8 flex items-center justify-center',
                'rounded-full transition-colors duration-150',
                'text-neutral-400 hover:text-neutral-200 hover:bg-white/5',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    'bg-gradient-to-br from-cyan-500/20 to-purple-500/20'
                  )}>
                    <div className={cn(
                      'w-8 h-8 rounded-full',
                      'bg-gradient-to-br from-cyan-500 to-purple-500'
                    )} />
                  </div>
                  <div>
                    <h2
                      id="permissions-title"
                      className="text-xl font-semibold text-white mb-1"
                    >
                      Make Truegle Your Default
                    </h2>
                    <p className="text-sm text-neutral-400">
                      Enable faster access to your search results
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {permissionOptions.map((option) => (
                  <PermissionToggle
                    key={option.key}
                    checked={permissions[option.key]}
                    onChange={() => togglePermission(option.key)}
                    label={option.label}
                    benefit={option.benefit}
                    disabled={loading}
                  />
                ))}
              </div>

              {result?.success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg mb-4',
                    'bg-green-500/10 border border-green-500/30'
                  )}
                >
                  <CheckCircle size={20} className="text-green-400" />
                  <span className="text-sm text-green-400">
                    Permissions set successfully!
                  </span>
                </motion.div>
              )}

              {result?.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg mb-4',
                    'bg-red-500/10 border border-red-500/30'
                  )}
                >
                  <AlertCircle size={20} className="text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400 mb-1">
                      Unable to set permissions automatically
                    </p>
                    <button
                      onClick={() => setShowFallback(true)}
                      className="text-xs text-neutral-300 underline hover:text-white"
                    >
                      View manual setup instructions
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={handleDismiss}
                  disabled={loading}
                  className={cn(
                    'px-5 py-3 rounded-lg text-sm font-medium',
                    'text-neutral-300 hover:text-neutral-100',
                    'bg-neutral-800 hover:bg-neutral-700',
                    'border border-white/10',
                    'transition-colors duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Skip for now
                </button>

                <button
                  onClick={handleAcceptAll}
                  disabled={loading || Object.values(permissions).every(v => !v)}
                  className={cn(
                    'px-5 py-3 rounded-lg text-sm font-medium',
                    'bg-gradient-to-r from-cyan-500 to-purple-500',
                    'hover:from-cyan-400 hover:to-purple-400',
                    'text-white',
                    'shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60',
                    'transition-all duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Setting defaults...
                    </>
                  ) : (
                    'Accept Selected'
                  )}
                </button>
              </div>
            </div>

            {showFallback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="border-t border-white/10 p-6 sm:p-8"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <ExternalLink size={20} className="text-cyan-400" />
                  Manual Setup for {browserInfo.name}
                </h3>

                <ol className="space-y-3 mb-6">
                  {instructions.steps.map((step, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm"
                    >
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center',
                        'flex-shrink-0 text-xs font-bold',
                        'bg-cyan-500/20 text-cyan-400'
                      )}>
                        {index + 1}
                      </span>
                      <span className="text-neutral-300 leading-relaxed">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFallback(false)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium',
                      'text-neutral-300 hover:text-neutral-100',
                      'bg-neutral-800 hover:bg-neutral-700',
                      'border border-white/10',
                      'transition-colors duration-150'
                    )}
                  >
                    Back
                  </button>

                  <a
                    href="https://truegle.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium',
                      'text-center',
                      'bg-gradient-to-r from-cyan-500 to-purple-500',
                      'hover:from-cyan-400 hover:to-purple-400',
                      'text-white',
                      'transition-all duration-150',
                      'flex items-center justify-center gap-2'
                    )}
                  >
                    Visit Truegle
                  </a>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PermissionsModal;