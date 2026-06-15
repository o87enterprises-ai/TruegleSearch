import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Chrome } from 'lucide-react';
import { FaApple } from 'react-icons/fa';
import TruegleLogo from '../components/ui/TruegleLogo';
import MolecularBackground from '../components/backgrounds/MolecularBackground';
import CursorGlow from '../components/ui/CursorGlow';
import NeonButton from '../components/ui/NeonButton';
import AnonymousSearchLink from '../components/ui/AnonymousSearchLink';
import authService from '../services/authService';
import { useToast } from '../components/ui/ToastProvider';
import { OAUTH_ENABLED } from '../config/access';

export default function SignInPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const { login } = useAuth(); // Get the login function from auth context

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
    const fromOSINT = location.state?.fromOSINT;
    const fromBiased = location.state?.fromBiased;

    if (fromOSINT) {
      navigate('/search?mode=ocean');
    } else if (fromBiased) {
      navigate('/search?mode=purple');
    } else {
      const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';
      navigate(isRedPillMode ? '/search?mode=red' : '/search');
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

        // Priority 1: honour explicit redirectTo (set by ProtectedRoute)
        if (redirectTo) {
          navigate(redirectTo);
          return;
        }

        // Priority 2: anonymous navigation state flags
        if (fromOSINT || location.state?.fromOSINT) {
          navigate('/search?mode=ocean');
          return;
        }
        if (fromBiased || location.state?.fromBiased) {
          navigate('/search?mode=purple');
          return;
        }

        // Priority 3: fall back to universal search, preserving pill mode
        const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';
        navigate(isRedPillMode ? '/search?mode=red' : '/search');
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
    if (provider === 'Google') {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://backend-seven-khaki-60.vercel.app';
      window.location.href = `${backendUrl}/api/auth/google`;
    }
  };

  // Social sign-in is hidden until the Google OAuth consent screen is published
  // (it's in "Testing" mode, which blocks non-test users). Flip
  // VITE_SOCIAL_AUTH_ENABLED=true once OAuth is live. Email/password is unaffected.
  const socialAuthEnabled =
    OAUTH_ENABLED && import.meta.env.VITE_SOCIAL_AUTH_ENABLED === 'true';

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 overflow-y-auto">
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

          {/* Social Auth — hidden until Google OAuth consent is published (VITE_SOCIAL_AUTH_ENABLED) */}
          {socialAuthEnabled && (
            <>
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
            </>
          )}

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
