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

export default function SignUpPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const { login } = useAuth(); // Get the login function from auth context

  // Check if coming from media interfaces to show freemium message
  const showFreemiumMessage = location.state?.showFreemiumMessage || false;
  const [showFullScreenAnnouncement, setShowFullScreenAnnouncement] = useState(showFreemiumMessage);
  // Check if there's a redirect URL after successful signup
  const redirectTo = location.state?.redirectTo || null;
  
  // Check localStorage for remember me preference
  const hasRememberedFreemium = localStorage.getItem('truegle_remember_freemium') === 'true';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMeFreemium, setRememberMeFreemium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Very Weak', color: 'bg-red-500' },
      { score: 2, label: 'Weak', color: 'bg-orange-500' },
      { score: 3, label: 'Fair', color: 'bg-yellow-500' },
      { score: 4, label: 'Good', color: 'bg-green-500' },
      { score: 5, label: 'Strong', color: 'bg-cyan-500' },
    ];

    return levels[score];
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Call the actual authentication service to register user
      const result = await authService.register(formData.email, formData.password, formData.name);

      if (result.success) {
        toast.success('Account Created', `Welcome to Truegle, ${result.user.name}!`, { pageTheme: 'landing' });

        // Log user in by calling login function from AuthContext
        // Default rememberMe to true for new signups
        login({
          user: result.user,
          token: result.token
        }, true, true);

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
        if (fromOSINT) {
          navigate('/search?mode=ocean');
          return;
        }
        if (fromBiased) {
          navigate('/search?mode=purple');
          return;
        }

        // Priority 3: fall back to universal search, preserving pill mode
        const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';
        navigate(isRedPillMode ? '/search?mode=red' : '/search');
      } else {
        toast.error('Registration Failed', result.error || 'Failed to create account', { pageTheme: 'landing' });
        setErrors({ general: result.error || 'Failed to create account. Please try again.' });
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Registration Error', 'An unexpected error occurred. Please try again.', { pageTheme: 'landing' });
      setErrors({ general: 'Failed to create account. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = (provider) => {
    console.log(`Authenticating with ${provider}...`);
    alert(`${provider} authentication would happen here`);
  };

  // Hidden until social OAuth is wired + the Google consent screen is published.
  // Flip VITE_SOCIAL_AUTH_ENABLED=true to show. Email/password is unaffected.
  // Also force-hidden while OAUTH_ENABLED is false (pre-production bypass).
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
          className="text-center mb-3 sm:mb-4 md:mb-6"
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
            <h1 className="text-headline-medium mb-2">
              <span className="gradient-cyan-purple">Join Truegle</span>
            </h1>
            <p className="text-body-large text-gray-400">
              Start searching without bias
            </p>
          </div>

          {/* Social Auth — hidden until social OAuth is wired (VITE_SOCIAL_AUTH_ENABLED) */}
          {socialAuthEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSocialAuth('Google')}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-cyan-500/50 rounded-xl transition-all text-label-large"
                >
                  <Chrome size={20} />
                  <span>Google</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSocialAuth('Apple')}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-cyan-500/50 rounded-xl transition-all text-label-large"
                >
                  <FaApple size={20} />
                  <span>Apple</span>
                </motion.button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-gray-900/50 text-body-small text-gray-500">
                    or sign up with email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Full-Screen Premium Features Announcement - Shown when coming from media interfaces */}
          {(!hasRememberedFreemium && showFreemiumMessage) && (
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Email */}
            <div>
              <label className="block text-label-medium text-gray-300 mb-2">
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
                  className={`w-full pl-12 pr-4 py-2.5 sm:py-3 bg-black/30 text-white placeholder-gray-500 border rounded-xl focus:outline-none focus:ring-2 transition-all text-body-medium ${
                    errors.email
                      ? 'border-red-500 focus:ring-red-500/50'
                      : focusedField === 'email'
                        ? 'border-cyan-500 focus:ring-cyan-500/50'
                        : 'border-gray-700 hover:border-gray-600'
                  }`}
                  placeholder="your@email.com"
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-body-small text-red-400"
                >
                  {errors.email}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-label-medium text-gray-300 mb-2">
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
                  className={`w-full pl-12 pr-12 py-2.5 sm:py-3 bg-black/30 text-white placeholder-gray-500 border rounded-xl focus:outline-none focus:ring-2 transition-all text-body-medium ${
                    errors.password
                      ? 'border-red-500 focus:ring-red-500/50'
                      : focusedField === 'password'
                        ? 'border-cyan-500 focus:ring-cyan-500/50'
                        : 'border-gray-700 hover:border-gray-600'
                  }`}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              {/* Password Strength */}
              {formData.password && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3"
                >
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          level <= passwordStrength.score
                            ? passwordStrength.color
                            : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength.label && (
                    <p className="text-label-small text-gray-400">
                      Password strength:{' '}
                      <span
                        className={
                          passwordStrength.score >= 4
                            ? 'text-green-400'
                            : 'text-orange-400'
                        }
                      >
                        {passwordStrength.label}
                      </span>
                    </p>
                  )}
                </motion.div>
              )}

              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-body-small text-red-400"
                >
                  {errors.password}
                </motion.p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-label-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  className={`w-full pl-12 pr-12 py-2.5 sm:py-3 bg-black/30 text-white placeholder-gray-500 border rounded-xl focus:outline-none focus:ring-2 transition-all text-body-medium ${
                    errors.confirmPassword
                      ? 'border-red-500 focus:ring-red-500/50'
                      : focusedField === 'confirmPassword'
                        ? 'border-cyan-500 focus:ring-cyan-500/50'
                        : 'border-gray-700 hover:border-gray-600'
                  }`}
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-body-small text-red-400"
                >
                  {errors.confirmPassword}
                </motion.p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-700 bg-black/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
              />
              <label htmlFor="terms" className="text-body-small text-gray-400">
                I agree to the{' '}
                <a
                  href="/terms"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  Privacy Policy
                </a>
              </label>
            </div>
            {errors.terms && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-body-small text-red-400"
              >
                {errors.terms}
              </motion.p>
            )}

            {/* General Error */}
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-3"
              >
                <p className="text-body-small text-red-400">{errors.general}</p>
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
                  Creating Account...
                </>
              ) : (
                <>
                  Enter
                  <ArrowRight className="inline ml-2" size={20} />
                </>
              )}
            </NeonButton>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-body-medium text-gray-400">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/auth/login', { state: { redirectTo, showFreemiumMessage } })}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </motion.div>

        {/* Footer Links */}
        <div className="mt-6 flex justify-center">
          <AnonymousSearchLink />
        </div>

        <div className="mt-4 text-center">
          <div className="flex justify-center gap-6 text-body-small text-gray-500">
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
    </div>
  );
}
