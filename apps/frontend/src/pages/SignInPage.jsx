import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Chrome, Shield } from 'lucide-react';
import { FaApple } from 'react-icons/fa';
import TruegleLogo from '../components/ui/TruegleLogo';
import MolecularBackground from '../components/backgrounds/MolecularBackground';
import CursorGlow from '../components/ui/CursorGlow';
import NeonButton from '../components/ui/NeonButton';
import AnonymousSearchLink from '../components/ui/AnonymousSearchLink';
import authService from '../services/authService';
import { useToast } from '../components/ui/ToastProvider';

export default function SignInPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const { login } = useAuth(); // Get the login function from auth context

  // Debug message on mount
  useEffect(() => {
    console.log('SignInPage mounted - admin login available');
  }, []);

  // Check if coming from media interfaces to show freemium message
  const showFreemiumMessage = location.state?.showFreemiumMessage || false;
  const [showFullScreenAnnouncement, setShowFullScreenAnnouncement] = useState(showFreemiumMessage);
  // Check if there's a redirect URL after successful login
  const redirectTo = location.state?.redirectTo || null;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberMeFreemium, setRememberMeFreemium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLoginCount, setAdminLoginCount] = useState(0);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Admin login keyboard shortcut - Multiple activation methods
  useEffect(() => {
    let clickCount = 0;
    let clickTimer;

    const handleKeyDown = (e) => {
      console.log('🔑 Key pressed:', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        which: e.which,
        keyCode: e.keyCode
      });

      // Try multiple key combinations for cross-platform/browser compatibility
      const isAdminShortcut =
        // Mac/PC standard
        (e.ctrlKey && e.shiftKey && e.key === 'A') ||
        (e.metaKey && e.shiftKey && e.key === 'A') ||
        // Alt combinations
        (e.altKey && e.key === 'A') ||
        // Firefox specific
        (e.altKey && e.shiftKey && e.key === 'A') ||
        // Direct key code checks
        (e.keyCode === 65 && (e.ctrlKey || e.metaKey) && e.shiftKey);

      if (isAdminShortcut) {
        e.preventDefault();
        console.log('🎯 Admin shortcut detected!');
        setAdminLoginCount(prev => {
          const newCount = prev + 1;
          console.log('📊 Admin login count:', newCount);
          if (newCount >= 3) {
            console.log('✅ Showing admin login button');
            setShowAdminLogin(true);
          }
          return newCount;
        });
      }
    };

    const handleTripleClick = (e) => {
      clickCount++;
      clearTimeout(clickTimer);

      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 500);

      if (clickCount === 3) {
        console.log('🎯 Triple-click detected - activating admin login');
        setShowAdminLogin(true);
        clickCount = 0;
      }
    };

    const handleLogoTripleClick = (e) => {
      // Check if clicking on Truegle logo area
      if (e.target.closest('[data-logo]') || e.target.textContent?.includes('Truegle')) {
        console.log('🎯 Logo triple-click detected');
        setShowAdminLogin(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleTripleClick);
    window.addEventListener('click', handleLogoTripleClick);

    console.log('🎮 Admin login listeners added - Try:');
    console.log('   • Ctrl+Shift+A (or Cmd+Shift+A on Mac)');
    console.log('   • Alt+A');
    console.log('   • Triple-click anywhere');
    console.log('   • Triple-click on Truegle logo');

    return () => {
      console.log('🧹 Admin login listeners removed');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleTripleClick);
      window.removeEventListener('click', handleLogoTripleClick);
      clearTimeout(clickTimer);
    };
  }, []);

  // Admin login function that bypasses normal authentication
  const handleAdminLogin = async () => {
    setIsLoading(true);

    try {
      // Create fake admin user session
      const adminUser = {
        id: 'admin_12345',
        email: 'admin@truegle.com',
        name: 'Truegle Admin',
        role: 'admin',
        isVerified: true,
        tokenBalance: 999,
        isPremium: true,
      };

      const adminToken = 'admin_bypass_token_' + Date.now();

      // Log in admin user by calling login function from AuthContext
      login({
        user: adminUser,
        token: adminToken
      }, true);

      toast.success('Admin Login', 'Welcome back, Administrator!', { pageTheme: 'landing' });

      // Navigate to admin dashboard or main search
      const redirectTo = location.state?.redirectTo || '/search-portal';
      navigate(redirectTo);

    } catch (error) {
      console.error('Admin login error:', error);
      toast.error('Admin Login Failed', 'Unable to log in as admin', { pageTheme: 'landing' });
      setErrors({ general: 'Admin login failed' });
      console.error('Admin login error:', error);
      toast.error('Admin Login Failed', 'Unable to log in as admin', { pageTheme: 'landing' });
      setErrors({ general: 'Admin login failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnonymousNavigation = () => {
    // Check for anonymous navigation state
    const fromOSINT = location.state?.fromOSINT;
    const fromBiased = location.state?.fromBiased;

    if (fromOSINT) {
      navigate('/osint/tools');
    } else if (fromBiased) {
      navigate('/biased');
    } else {
      // Check for OSINT mode first
      const isOSINTMode = localStorage.getItem('isOSINTMode') === 'true';
      if (isOSINTMode) {
        navigate('/osint/tools');
      } else {
        // Check for pill mode in localStorage for anonymous navigation
        const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';

        if (isRedPillMode) {
          // Red Pill Mode: Navigate to search results
          navigate('/search-results');
        } else {
          // Blue Pill Mode (default): Navigate to search portal
          navigate('/search-portal');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Call the actual authentication service to log in user
      const result = await authService.login(formData.email, formData.password);

      if (result.success) {
        toast.success('Welcome Back!', `Successfully logged in as ${result.user.name}`, { pageTheme: 'landing' });

        // Log user in by calling login function from AuthContext
        // Pass rememberMe to persist session across browser restarts
        login({
          user: result.user,
          token: result.token
        }, rememberMe);

        // Check for anonymous navigation state
        const fromOSINT = location.state?.fromOSINT;
        const fromBiased = location.state?.fromBiased;
        const anonymous = location.state?.anonymous;

        // Handle anonymous navigation if specified
        if (anonymous) {
          if (fromOSINT) {
            navigate('/osint/tools');
          } else if (fromBiased) {
            navigate('/biased');
          } else {
            // Check for OSINT mode first
            const isOSINTMode = localStorage.getItem('isOSINTMode') === 'true';
            if (isOSINTMode) {
              navigate('/osint/tools');
            } else {
              // Check for pill mode in localStorage for anonymous navigation
              const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';

              if (isRedPillMode) {
                // Red Pill Mode: Navigate to search results
                navigate('/search-results');
              } else {
                // Blue Pill Mode (default): Navigate to search portal
                navigate('/search-portal');
              }
            }
          }
        } else {
          // Navigate to redirect URL if specified, otherwise to search results
          if (redirectTo) {
            // If redirectTo is for search functionality, use the correct search results route
            if (redirectTo.startsWith('/search?')) {
              // Extract query parameter and redirect to new search results page
              navigate('/search-results' + redirectTo.substring('/search'.length));
            } else if (redirectTo.startsWith('/search-results?')) {
              // Redirect to search results with query parameters
              navigate(redirectTo);
            } else {
              navigate(redirectTo);
            }
          } else {
            // Check for OSINT mode first
            const isOSINTMode = localStorage.getItem('isOSINTMode') === 'true';
            if (isOSINTMode) {
              navigate('/osint/tools');
            } else {
              // Check for pill mode in localStorage
              const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';

              if (isRedPillMode) {
                // Red Pill Mode: Navigate to search results
                navigate('/search-results');
              } else {
                // Blue Pill Mode (default): Navigate to search portal
                navigate('/search-portal');
              }
            }
          }
        }
      } else {
        toast.error('Login Failed', result.error || 'Invalid email or password', { pageTheme: 'landing' });
        setErrors({ general: result.error || 'Invalid email or password' });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Login Error', 'An unexpected error occurred. Please try again.', { pageTheme: 'landing' });
      setErrors({ general: 'Invalid email or password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = (provider) => {
    console.log(`Authenticating with ${provider}...`);
    alert(`${provider} authentication would happen here`);
  };

  // Simple backup admin trigger (click bottom-right corner of screen)
  const handleCornerClick = (e) => {
    // Only trigger if clicking in bottom-right corner
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const isBottomRight = x > rect.width * 0.8 && y > rect.height * 0.8;

    if (isBottomRight) {
      console.log('Corner click detected - activating admin login');
      setShowAdminLogin(true);
    }
  };

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 overflow-y-auto"
      onClick={handleCornerClick}
    >
      {/* Molecular Background */}
      <MolecularBackground />

      {/* Cursor Glow */}
      <CursorGlow />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-[90%] sm:max-w-sm"
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-3 sm:mb-4 md:mb-6 cursor-pointer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          data-logo="true"
          onClick={() => console.log('Logo clicked - triple-click for admin')}
          title="Triple-click for admin login"
        >
          <button onClick={() => navigate('/')} className="inline-block group">
            <motion.div
              animate={{
                filter: [
                  'drop-shadow(0 0 20px rgba(0,229,255,0.4)) drop-shadow(0 0 40px rgba(139,92,246,0.3))',
                  'drop-shadow(0 0 30px rgba(0,229,255,0.5)) drop-shadow(0 0 50px rgba(139,92,246,0.4))',
                  'drop-shadow(0 0 20px rgba(0,229,255,0.4)) drop-shadow(0 0 40px rgba(139,92,246,0.3))',
                ],
              }}
              whileHover={{
                filter: [
                  'drop-shadow(0 0 40px rgba(0,229,255,0.8)) drop-shadow(0 0 60px rgba(139,92,246,0.6))',
                  'drop-shadow(0 0 50px rgba(139,92,246,0.8)) drop-shadow(0 0 70px rgba(255,107,0,0.6))',
                  'drop-shadow(0 0 40px rgba(0,229,255,0.8)) drop-shadow(0 0 60px rgba(139,92,246,0.6))',
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className="scale-[1.3] sm:scale-[1.6] md:scale-[2.0]">
                <TruegleLogo size="xlarge" animated={true} />
              </div>
            </motion.div>
          </button>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl max-h-[65vh] overflow-y-auto custom-scrollbar"
          style={{
            background:
              'linear-gradient(135deg, rgba(15, 15, 35, 0.95) 0%, rgba(25, 25, 45, 0.9) 50%, rgba(15, 15, 35, 0.95) 100%)',
            border: '1px solid rgba(0, 229, 255, 0.2)',
          }}
          data-feature-card="true"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 font-display tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">
                Welcome Back
              </span>
            </h1>
            <p className="text-sm sm:text-base text-gray-400 font-body">
              Sign in to continue searching
            </p>
          </div>

          {/* Social Auth */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocialAuth('Google')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-cyan-500/50 rounded-xl transition-all font-medium"
            >
              <Chrome size={20} />
              <span className="font-body">Google</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocialAuth('Apple')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-cyan-500/50 rounded-xl transition-all font-medium"
            >
              <FaApple size={20} />
              <span className="font-body">Apple</span>
            </motion.button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-900/50 text-gray-500 font-body">
                or sign in with email
              </span>
            </div>
          </div>

          {/* Freemium Message - Shown when coming from media interfaces */}
          {showFreemiumMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mb-6 p-6 rounded-2xl bg-gradient-to-r from-cyan-700/20 via-purple-700/20 to-cyan-700/20 backdrop-blur-xl border-2 border-cyan-500/50"
            >
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30 blur opacity-50 animate-pulse"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-center text-cyan-400 mb-4">
                  🎉 Premium Features Free!
                </h2>
                <p className="text-white text-center text-lg">
                  Here, use our premium features for free. If you want to give us money, of course we'll accept it. But we won't make you pay us to use our service. We'll let the advertisers pay for that 🤣. Truegle. Truly Freemium.
                </p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 font-body">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className={`w-full pl-12 pr-4 py-2.5 sm:py-3 bg-black/30 text-white placeholder-gray-500 border rounded-xl focus:outline-none focus:ring-2 transition-all font-body ${
                    errors.email
                      ? 'border-red-500 focus:ring-red-500/50'
                      : focusedField === 'email'
                        ? 'border-cyan-500 focus:ring-cyan-500/50'
                        : 'border-gray-700 hover:border-gray-600'
                  }`}
                  placeholder="your@email.com"
                  autoFocus
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-400 font-body"
                >
                  {errors.email}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 font-body">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className={`w-full pl-12 pr-12 py-2.5 sm:py-3 bg-black/30 text-white placeholder-gray-500 border rounded-xl focus:outline-none focus:ring-2 transition-all font-body ${
                    errors.password
                      ? 'border-red-500 focus:ring-red-500/50'
                      : focusedField === 'password'
                        ? 'border-cyan-500 focus:ring-cyan-500/50'
                        : 'border-gray-700 hover:border-gray-600'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-400 font-body"
                >
                  {errors.password}
                </motion.p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-black/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <label
                  htmlFor="remember"
                  className="text-xs sm:text-sm text-gray-400 font-body"
                >
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={() => alert('Password reset would happen here')}
                className="text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-body"
              >
                Forgot password?
              </button>
            </div>

            {/* General Error */}
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-3"
              >
                <p className="text-sm text-red-400 font-body">
                  {errors.general}
                </p>
              </motion.div>
            )}

            {/* Submit Button */}
            <NeonButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full mt-6"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
                  Signing In...
                </>
              ) : (
                <>
                  Enter
                  <ArrowRight className="inline ml-2" size={20} />
                </>
              )}
            </NeonButton>
           </form>

           {/* Debug Panel Toggle */}
           <div className="mt-4 text-center">
             <button
               onClick={() => setShowDebugPanel(!showDebugPanel)}
               className="text-xs text-gray-500 hover:text-gray-400 transition-colors underline"
             >
               {showDebugPanel ? 'Hide' : 'Show'} Admin Debug Panel
             </button>
           </div>

           {/* Debug Panel */}
           {showDebugPanel && (
             <motion.div
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               exit={{ opacity: 0, height: 0 }}
               className="mt-4 p-4 bg-black/30 rounded-xl border border-gray-700"
             >
               <h3 className="text-sm font-bold text-white mb-3 text-center">🔧 Admin Login Debug Panel</h3>

               <div className="space-y-2 text-xs">
                 <div className="grid grid-cols-2 gap-2">
                   <div className="text-gray-400">Status:</div>
                   <div className={showAdminLogin ? 'text-green-400' : 'text-yellow-400'}>
                     {showAdminLogin ? '✅ Active' : '⏳ Waiting'}
                   </div>

                   <div className="text-gray-400">Progress:</div>
                   <div className="text-white">{adminLoginCount}/3</div>
                 </div>

                 <div className="mt-3">
                   <div className="text-gray-400 mb-2">Activation Methods:</div>
                   <div className="space-y-1 text-gray-300">
                     <div>• <kbd className="bg-gray-700 px-1 rounded text-xs">Ctrl+Shift+A</kbd> (PC) or <kbd className="bg-gray-700 px-1 rounded text-xs">Cmd+Shift+A</kbd> (Mac)</div>
                     <div>• <kbd className="bg-gray-700 px-1 rounded text-xs">Alt+A</kbd> (Alternative)</div>
                     <div>• Triple-click anywhere on page</div>
                     <div>• Triple-click on Truegle logo</div>
                     <div>• Inspect element → Find button with id="admin-trigger"</div>
                   </div>
                 </div>

                 <div className="mt-3 pt-3 border-t border-gray-700">
                   <button
                     onClick={() => {
                       console.log('🔧 Debug: Force activating admin login');
                       setShowAdminLogin(true);
                     }}
                     className="w-full py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 rounded text-red-400 text-xs transition-colors"
                   >
                     🚀 Force Activate Admin Login
                   </button>
                 </div>
               </div>
             </motion.div>
           )}

           {/* Admin Login Progress Indicator */}
            {adminLoginCount > 0 && adminLoginCount < 3 && (
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  Admin login: {adminLoginCount}/3
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  Try: Ctrl+Shift+A, Alt+A, or triple-click anywhere
                </p>
                <div className="flex justify-center gap-1 mt-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i <= adminLoginCount ? 'bg-red-500 animate-pulse' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Admin Trigger (for inspect element access) */}
            <button
              id="admin-trigger"
              className="hidden"
              onClick={() => {
                console.log('🎯 Hidden admin trigger clicked');
                setShowAdminLogin(true);
              }}
              title="Admin Login Trigger"
            >
              ADMIN
            </button>

            {/* Admin Login Button - Hidden until activated */}
            {showAdminLogin && (
             <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="mt-4"
             >
               <NeonButton
                 type="button"
                 onClick={handleAdminLogin}
                 variant="secondary"
                 size="md"
                 disabled={isLoading}
                 className="w-full bg-gradient-to-r from-red-600 to-purple-600 border-red-500"
               >
                 <Shield className="inline mr-2" size={16} />
                 Admin Login (Bypass)
               </NeonButton>
                <div className="text-xs text-gray-500 text-center mt-2 space-y-1">
                  <p>🎯 Admin access granted!</p>
                  <p>Activated via: Keyboard shortcut, triple-click, or inspect element</p>
                  <p className="text-gray-400">Check console for debug info</p>
                </div>
             </motion.div>
           )}

           {/* Sign Up Link */}
           <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm font-body">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/auth/signup', { state: { redirectTo, showFreemiumMessage } })}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Sign up
              </button>
            </p>
          </div>
        </motion.div>

        {/* Footer Links */}
        <div className="mt-6 flex justify-center">
          <AnonymousSearchLink />
        </div>

        <div className="mt-4 text-center">
          <div className="flex justify-center gap-6 text-sm text-gray-500 font-body">
            <a href="/terms" className="hover:text-cyan-400 transition-colors">
              Terms
            </a>
            <a
              href="/privacy"
              className="hover:text-cyan-400 transition-colors"
            >
              Privacy
            </a>
            <a
              href="/contact"
              className="hover:text-cyan-400 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </motion.div>

      {/* Full-Screen Premium Features Announcement - Shown when coming from media interfaces */}
      {showFullScreenAnnouncement && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-xl rounded-2xl border-2 border-cyan-500 p-8 text-center"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 blur-xl animate-pulse"></div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-cyan-400 mb-6">
                🎉 Premium Features Free!
              </h2>
              <p className="text-white text-lg mb-6 max-w-2xl mx-auto">
                Here, use our premium features for free. If you want to give us money, of course we'll accept it. But we won't make you pay us to use our service. We'll let the advertisers pay for that 🤣. Truegle. Truly Freemium.
              </p>

              {/* Remember Me Checkbox */}
              <label className="flex items-center justify-center gap-3 mb-6 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMeFreemium}
                  onChange={(e) => setRememberMeFreemium(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-cyan-500/50 bg-black/50 text-cyan-500
                    focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-0
                    checked:bg-cyan-600 checked:border-cyan-600
                    cursor-pointer transition-all"
                />
                <span className="text-white/80 text-sm group-hover:text-white transition-colors">
                  Remember me on this device
                </span>
              </label>

              <button
                onClick={() => {
                  // Save preference if remember me is checked
                  if (rememberMeFreemium) {
                    try {
                      localStorage.setItem('truegle_remember_freemium', 'true');
                    } catch {
                      // Ignore localStorage errors
                    }
                  }
                  setShowFullScreenAnnouncement(false);
                }}
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold rounded-xl hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/30"
              >
                CONTINUE
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
