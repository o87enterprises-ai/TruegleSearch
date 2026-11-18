import { lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Gamepad2, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { vaultFound, findVault } from '../utils/vault';
import { GUIDE_NAME, GUIDE_PATH, PLAY_URL, guideUnlocked } from '../utils/guideAccess';

const Encyclopedia = lazy(() => import('../components/Encyclopedia'));

// /guide — the guide's own, linkable address (landing footer, menu, Settings).
// Unlocked by a real account or by an earlier unlock on this device; both are kept
// in localStorage, so it stays unlocked indefinitely and works with no network.
export default function GuidePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Re-evaluated every render, so an account that finishes loading after first paint
  // still opens the guide rather than leaving the gate up.
  let token = '';
  try { token = localStorage.getItem('truegle_token') || ''; } catch { /* private mode */ }
  const open = guideUnlocked(user, token, vaultFound, findVault);

  if (open) {
    return (
      <Suspense fallback={<div className="fixed inset-0 z-[100] bg-[#0d0f12]" />}>
        <Encyclopedia onClose={() => navigate('/')} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0e14] p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-300">
            <BookOpen size={22} />
          </span>
          <div>
            <h1 className="text-base font-bold text-white">Free Post-Apocalyptic / Pioneer guide</h1>
            <p className="text-[12px] text-white/50">{GUIDE_NAME}</p>
          </div>
        </div>
        <p className="text-xs text-white/65 leading-relaxed mb-4">
          Free two ways: sign in, or finish a run of Trail. Once unlocked it stays unlocked on this
          device and reads offline.
        </p>
        <div className="space-y-2">
          <button type="button" onClick={() => navigate('/auth/login', { state: { redirectTo: GUIDE_PATH } })}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400">
            <LogIn size={18} /> Sign in — get it free
          </button>
          <button type="button" onClick={() => navigate(PLAY_URL)}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-sm font-semibold text-white hover:border-white/30">
            <Gamepad2 size={18} /> Play Trail instead
          </button>
        </div>
        <Link to="/" className="block mt-4 text-center text-xs text-white/40 hover:text-white/70">Back to Truegle</Link>
      </div>
    </div>
  );
}
