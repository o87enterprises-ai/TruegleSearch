import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, FileText, Image, Copy, Download, Sparkles, Clock,
  Play, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const FREE_SPINS = 3;
const AD_BONUS_SPINS = 3;
const SPIN_WINDOW_MS = 24 * 60 * 60 * 1000;
const WATERMARK = '\n\n---\nExtracted via Truegle · truegle.info';

// ── Spin persistence ──────────────────────────────────────────────────────────
function loadSpins() {
  try {
    const raw = localStorage.getItem('truegle_extract_spins');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveSpins(state) {
  localStorage.setItem('truegle_extract_spins', JSON.stringify(state));
}

function getSpinState() {
  const saved = loadSpins();
  const now = Date.now();
  if (!saved || now > saved.resetAt) {
    return { remaining: FREE_SPINS, resetAt: now + SPIN_WINDOW_MS, adUsed: false };
  }
  return saved;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function msUntilReset(resetAt) {
  const ms = Math.max(0, resetAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/i.test(url);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExtractPage() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('transcript'); // 'transcript' | 'images'
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [spinState, setSpinState] = useState(() => getSpinState());
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [adDone, setAdDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const adTimerRef = useRef(null);

  // Refresh spin state from storage on mount
  useEffect(() => {
    setSpinState(getSpinState());
  }, []);

  const spendSpin = useCallback(() => {
    setSpinState((prev) => {
      const next = { ...prev, remaining: Math.max(0, prev.remaining - 1) };
      saveSpins(next);
      return next;
    });
  }, []);

  const handleExtract = async () => {
    if (!url.trim()) return;
    if (spinState.remaining <= 0) { setShowAdModal(true); return; }

    setLoading(true);
    setError('');
    setResult(null);
    setShowFullTranscript(false);

    try {
      const endpoint = mode === 'transcript' ? '/api/extract/transcript' : '/api/extract/images';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Extraction failed');
      setResult(data);
      spendSpin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Ad flow ──────────────────────────────────────────────────────────────
  const startAd = () => {
    setAdDone(false);
    setAdCountdown(5);
    adTimerRef.current = setInterval(() => {
      setAdCountdown((c) => {
        if (c <= 1) {
          clearInterval(adTimerRef.current);
          setAdDone(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const claimAdSpins = () => {
    setSpinState((prev) => {
      const next = { ...prev, remaining: prev.remaining + AD_BONUS_SPINS, adUsed: true };
      saveSpins(next);
      return next;
    });
    setShowAdModal(false);
    setAdDone(false);
  };

  useEffect(() => () => clearInterval(adTimerRef.current), []);

  // ── Copy / Download ───────────────────────────────────────────────────────
  const getOutputText = () => {
    if (!result) return '';
    return result.transcript + WATERMARK;
  };

  const handleCopy = () => {
    if (!result?.transcript) return;
    navigator.clipboard.writeText(getOutputText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!result?.transcript) return;
    const blob = new Blob([getOutputText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-${result.videoId || 'extract'}.txt`;
    a.click();
  };

  const previewTranscript = result?.transcript
    ? result.transcript.slice(0, 600) + (result.transcript.length > 600 ? '…' : '')
    : '';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-white/40 hover:text-white text-sm transition-colors">Truegle</a>
        <span className="text-white/20">/</span>
        <span className="text-white/80 text-sm font-medium">Extract</span>
        <span className="ml-2 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wide">Beta</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Content Extractor
          </h1>
          <p className="text-white/50 text-sm">
            Paste a URL to pull transcripts or images — no account required.
          </p>
        </motion.div>

        {/* Spin counter */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Sparkles size={14} className="text-cyan-400" />
            <span>
              <span className="text-white font-semibold">{spinState.remaining}</span> free {spinState.remaining === 1 ? 'extraction' : 'extractions'} left today
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <Clock size={12} />
            Resets in {msUntilReset(spinState.resetAt)}
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'transcript', icon: FileText, label: 'Transcript' },
            { id: 'images', icon: Image, label: 'Images' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setResult(null); setError(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                mode === id
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* URL input */}
        <div className="flex gap-2 mb-6">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-cyan-500/50 transition-colors">
            <Link2 size={16} className="text-white/30 shrink-0" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
              placeholder={mode === 'transcript' ? 'https://youtube.com/watch?v=...' : 'https://example.com/article'}
              className="flex-1 bg-transparent text-white placeholder-white/25 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleExtract}
            disabled={loading || !url.trim()}
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2 shrink-0"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Extract
          </button>
        </div>

        {/* Mode hint */}
        {mode === 'transcript' && (
          <p className="text-xs text-white/30 mb-6 -mt-3 px-1">
            YouTube videos with captions enabled. Auto-generated captions work too.
          </p>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-3 bg-red-950/60 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result — Transcript */}
        <AnimatePresence>
          {result?.transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              {/* Result header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-white font-medium">{result.wordCount.toLocaleString()} words</span>
                  <span>· {result.segmentCount} segments</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white transition-all"
                  >
                    {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-xs text-cyan-300 hover:text-cyan-200 transition-all"
                  >
                    <Download size={12} />
                    .txt
                  </button>
                </div>
              </div>

              {/* Transcript body */}
              <div className="p-5">
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {showFullTranscript ? result.transcript : previewTranscript}
                </p>
                {result.transcript.length > 600 && (
                  <button
                    onClick={() => setShowFullTranscript(!showFullTranscript)}
                    className="mt-3 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {showFullTranscript
                      ? <><ChevronUp size={12} /> Show less</>
                      : <><ChevronDown size={12} /> Show full transcript</>}
                  </button>
                )}
              </div>

              {/* Watermark footer */}
              <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-white/20">
                  Extracted via{' '}
                  <a href="https://truegle.info" className="text-white/30 hover:text-white/50 underline underline-offset-2">
                    Truegle
                  </a>
                </span>
                <span className="text-xs text-white/20 flex items-center gap-1">
                  <Lock size={10} />
                  Remove watermark with Premium
                </span>
              </div>
            </motion.div>
          )}

          {/* Result — Images */}
          {result?.images && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 text-sm">
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-white font-medium">{result.images.length} images</span>
                <span className="text-white/40">found at {new URL(result.url).hostname}</span>
              </div>
              <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {result.images.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                    className="group relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all">
                    <img src={src} alt="" loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </a>
                ))}
              </div>
              <div className="px-5 py-2.5 border-t border-white/5">
                <span className="text-xs text-white/20">
                  Extracted via{' '}
                  <a href="https://truegle.info" className="text-white/30 hover:text-white/50 underline underline-offset-2">
                    Truegle
                  </a>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No spins — teaser */}
        {spinState.remaining === 0 && !showAdModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-6 p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-center"
          >
            <p className="text-amber-300 text-sm font-medium mb-3">You've used all your free extractions for today.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowAdModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-sm font-medium transition-all"
              >
                Watch ad · get 3 more
              </button>
              <a href="/pricing"
                className="px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-medium transition-all">
                Go Premium · unlimited
              </a>
            </div>
          </motion.div>
        )}
      </div>

      {/* Ad modal */}
      <AnimatePresence>
        {showAdModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4"
            onClick={(e) => { if (e.target === e.currentTarget && !adTimerRef.current) setShowAdModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-2xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Play size={22} className="text-amber-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">Watch a short ad</h3>
              <p className="text-white/50 text-sm mb-6">You'll get 3 more extractions valid for the next 24 hours.</p>

              {!adDone && adCountdown === 5 && (
                <button
                  onClick={startAd}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors"
                >
                  Start watching
                </button>
              )}

              {!adDone && adCountdown < 5 && (
                <div className="py-3">
                  <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin mx-auto mb-3" />
                  <p className="text-amber-300 text-sm">Ad playing… {adCountdown}s</p>
                </div>
              )}

              {adDone && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                    <CheckCircle size={20} />
                    <span className="text-sm font-medium">Done! 3 extractions ready.</span>
                  </div>
                  <button
                    onClick={claimAdSpins}
                    className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-colors"
                  >
                    Claim & continue
                  </button>
                </motion.div>
              )}

              {!adDone && adCountdown === 5 && (
                <button
                  onClick={() => setShowAdModal(false)}
                  className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
