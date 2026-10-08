import { NuclearStrip } from '../components/ui/SessionWipe';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowRight, Phone, Zap } from 'lucide-react';
import TruegleLogo from '../components/ui/TruegleLogo';
import MolecularBackground from '../components/backgrounds/MolecularBackground';
import CursorGlow from '../components/ui/CursorGlow';
import NeonButton from '../components/ui/NeonButton';
import AnonymousSearchLink from '../components/ui/AnonymousSearchLink';
import AccountCodeModal from '../components/ui/AccountCodeModal';
import AgeGate from '../components/auth/AgeGate';
import authService from '../services/authService';
import { useToast } from '../components/ui/ToastProvider';

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

  // Passwordless sign-in state. Two ways in: type your saved account code, or
  // email yourself a one-time code — both go in the same field.
  const [codeContact, setCodeContact] = useState('');
  const [codeContactType, setCodeContactType] = useState('email');
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSentNote, setCodeSentNote] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [rememberMeFreemium, setRememberMeFreemium] = useState(false);
  // Keep me signed in — ticked unless the person unticks it (a shared or
  // public computer). See REMEMBER ME in the backend's routes/auth.js.
  const [remember, setRemember] = useState(() => {
    try { return localStorage.getItem('truegle_remember_me') !== 'false'; } catch { return true; }
  });
  const [revealedCode, setRevealedCode] = useState(null); // one-time account-code reveal
  // 18+ and the terms, agreed before anything else on this page (AgeGate.jsx).
  const [ageAgreed, setAgeAgreed] = useState(false);

  const goAfterSignIn = () => {
    // STRAIGHT TO SETTINGS, to choose how search storage is handled (owner,
    // 2026-10-08 — and the age gate promised it). Where they were headed is
    // carried along: Settings offers to continue there.
    const next = redirectTo
      || (location.state?.fromOSINT ? '/search?mode=ocean' : null)
      || (location.state?.fromBiased ? '/search?mode=purple' : null)
      || (localStorage.getItem('isRedPillMode') === 'true' ? '/red' : '/search');
    return navigate(`/settings?welcome=1&next=${encodeURIComponent(next)}#search-storage`);
  };

  const handleSendCode = async () => {
    setCodeError('');
    setCodeSentNote('');

    if (codeContactType === 'phone') {
      setCodeError("SMS isn't wired up yet — please use email for now.");
      return;
    }
    if (!codeContact.trim() || !/\S+@\S+\.\S+/.test(codeContact)) {
      setCodeError('Enter a valid email address');
      return;
    }

    setSendingCode(true);
    try {
      const result = await authService.requestCode(codeContact.trim());
      if (result.success) {
        setCodeSentNote('Code sent — check your email, then enter it below.');
        toast.success('Code sent', 'Check your email for your sign-in code.', { pageTheme: 'landing' });
      } else {
        setCodeError(result.error);
      }
    } catch {
      setCodeError('Network error. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setCodeError('');
    if (!codeContact.trim()) { setCodeError('Enter your email'); return; }
    if (!accessCode.trim() || accessCode.trim().length < 6) { setCodeError('Enter your code'); return; }

    setCodeLoading(true);
    try {
      const result = await authService.verifyCode(
        codeContactType === 'email'
          ? { email: codeContact.trim(), code: accessCode.trim(), remember }
          : { phone: codeContact.trim(), code: accessCode.trim(), remember }
      );

      if (!result.success) {
        setCodeError(result.error);
        return;
      }

      toast.success('Welcome!', 'Signed in.', { pageTheme: 'landing' });
      login({ user: result.user, token: result.token }, remember);

      // First-ever sign-in reveals a durable account code once — hold
      // navigation until the user has seen and saved it.
      if (result.accountCode) {
        setRevealedCode(result.accountCode);
        return;
      }

      goAfterSignIn();
    } catch {
      setCodeError('Network error. Please try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  // No account is needed for anything except a second OSINT investigation, so
  // this button is just a way past the form. It used to seed a localStorage
  // token quota for the freemium meter; the meter is gone and so is the quota.
  const continueWithoutAccount = () => navigate('/search');

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
        className={`relative z-10 w-full max-w-[94%] ${ageAgreed ? 'sm:max-w-sm' : 'sm:max-w-lg'}`}
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

        {/* 18+ and the terms first (AgeGate.jsx); the form only after. */}
        {!ageAgreed && (
          <AgeGate onAccept={() => setAgeAgreed(true)} onDecline={() => navigate('/search')} />
        )}

        {/* Form Card */}
        {ageAgreed && (
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
          <div className="text-center mb-5">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 font-display tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">
                Welcome Back
              </span>
            </h1>
            <p className="text-sm sm:text-base text-gray-400 font-body">
              Sign in with a one-time code — no password needed
            </p>
          </div>

          {/* Shown when arriving from a media interface that used to imply a paywall. */}
          {showFreemiumMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mb-6 p-6 rounded-2xl bg-gradient-to-r from-cyan-700/20 via-purple-700/20 to-cyan-700/20 backdrop-blur-xl border-2 border-cyan-500/50"
            >
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30 blur opacity-50 animate-pulse"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-center text-cyan-400 mb-4">
                  Free, and not paid for by ads
                </h2>
                <p className="text-white text-center text-lg">
                  Everything is free, and there is no paid tier to upsell you to. No ads, no cookies, no tracking — Truegle is not run for profit. An account only exists so your settings and investigations follow you between devices.
                </p>
              </div>
            </motion.div>
          )}

          {/* Access Code sign-in form — one field for both a saved account
              code and an emailed one-time code. */}
          <form onSubmit={handleCodeSubmit} className="space-y-3 mb-4">
            {/* contact type toggle */}
            <div className="flex gap-2">
              {[{ key: 'email', label: 'Email', icon: Mail }, { key: 'phone', label: 'Phone', icon: Phone }].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCodeContactType(key); setCodeError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs border transition-all ${
                    codeContactType === key
                      ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>

            {codeContactType === 'phone' && (
              <p className="text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-xs">
                SMS sign-in isn't available yet — switch to email to get a code today.
              </p>
            )}

            <input
              type={codeContactType === 'email' ? 'email' : 'tel'}
              value={codeContact}
              onChange={(e) => { setCodeContact(e.target.value); setCodeSentNote(''); }}
              placeholder={codeContactType === 'email' ? 'your@email.com' : '+1 (555) 000-0000'}
              className="w-full px-4 py-2.5 bg-black/30 border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm"
            />

            <div className="relative">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Your code"
                maxLength={10}
                className="w-full px-4 py-2.5 pr-28 bg-black/30 border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm font-mono tracking-widest"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sendingCode}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-cyan-300 text-xs font-medium transition-all disabled:opacity-50"
              >
                {sendingCode ? 'Sending…' : 'Email me one'}
              </button>
            </div>

            <p className="text-white/40 text-[11px] leading-snug">
              Have your account code? Enter it to sign in on any device. New here or lost it? Tap
              <span className="text-cyan-400"> Email me one</span> for a fresh code.
            </p>

            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                data-remember-me=""
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-white/30 bg-black/40 accent-cyan-500"
              />
              Keep me signed in on this device
              <span className="text-white/35">(untick on a shared computer)</span>
            </label>

            {codeSentNote && <p className="text-emerald-400 text-xs">{codeSentNote}</p>}
            {codeError && <p className="text-red-400 text-xs">{codeError}</p>}

            <NeonButton type="submit" variant="primary" size="lg" disabled={codeLoading} className="w-full">
              {codeLoading ? 'Signing in…' : <>Sign In <ArrowRight className="inline ml-2" size={16} /></>}
            </NeonButton>

            <button
              type="button"
              onClick={continueWithoutAccount}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-sm rounded-xl transition-all"
            >
              <Zap size={14} />
              Continue without an account
            </button>
          </form>

          <p className="text-center text-gray-500 text-xs">
            No account yet?{' '}
            <button type="button" onClick={() => navigate('/auth/signup')} className="text-cyan-400 hover:text-cyan-300">
              Create one — free
            </button>
          </p>
        </motion.div>
        )}

        {/* Footer Links */}
        <div className="mt-6 flex justify-center">
          <AnonymousSearchLink />
        </div>

        <NuclearStrip className="mt-8" />

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
                Free, and not paid for by ads
              </h2>
              <p className="text-white text-lg mb-6 max-w-2xl mx-auto">
                Everything is free, and there is no paid tier to upsell you to. No ads, no cookies, no tracking — Truegle is not run for profit. An account only exists so your settings and investigations follow you between devices.
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

      {/* One-time account-code reveal on first sign-in */}
      {revealedCode && (
        <AccountCodeModal
          code={revealedCode}
          onClose={() => { setRevealedCode(null); goAfterSignIn(); }}
        />
      )}
    </div>
  );
}
