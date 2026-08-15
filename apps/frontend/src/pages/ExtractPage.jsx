// PARKED — kept, not deleted, and no longer linked from anywhere.
//
// The yellow pill and the hamburger drawer point at /feed now; this page's
// route still resolves so an old direct link does not 404. The extraction tool
// itself is waiting to be folded into Tube rather than living on its own page
// (docs/PRE-PRODUCTION-BACKLOG.md), which is also why nothing here has been
// brought onto the house layout — it is going somewhere else.
//
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, FileText, Image, Copy, Download, Sparkles, Clock,
  Play, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Lock,
  ArrowLeft, Search,
} from 'lucide-react';
import TruegleLogo from '../components/ui/TruegleLogo';
import AdSlot from '../components/AdSlot';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const FREE_SPINS = 3;
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
function saveSpins(state) { localStorage.setItem('truegle_extract_spins', JSON.stringify(state)); }
function getSpinState() {
  const saved = loadSpins();
  const now = Date.now();
  if (!saved || now > saved.resetAt) return { remaining: FREE_SPINS, resetAt: now + SPIN_WINDOW_MS };
  return saved;
}
function msUntilReset(resetAt) {
  const ms = Math.max(0, resetAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── Yellow-tinted star canvas background ──────────────────────────────────────
function YellowStarfield() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const n = window.innerWidth < 768 ? 100 : 200;
    const stars = Array.from({ length: n }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.8 + 0.2,
      b: Math.random() * 0.5 + 0.5,
      ps: Math.random() * 0.015 + 0.004,
      pd: Math.random() > 0.5 ? 1 : -1,
      tp: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.025 + 0.008,
      // yellow bias: 0 = pure white, 1 = deep gold
      gold: Math.random() * 0.7 + 0.2,
    }));
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        s.tp += s.ts;
        const tw = (Math.sin(s.tp) + 1) * 0.3 + 0.7;
        s.b += s.ps * s.pd;
        if (s.b > 1 || s.b < 0.3) { s.pd *= -1; s.b = Math.max(0.3, Math.min(1, s.b)); }
        const fb = s.b * tw;
        const cx = s.x * canvas.width;
        const cy = s.y * canvas.height;
        // Interpolate between white and gold based on s.gold
        const r = Math.round(255);
        const g = Math.round(255 - s.gold * 60);  // slight green reduction
        const gb = Math.round(255 - s.gold * 160); // strong blue reduction → gold
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.r * 3);
        grd.addColorStop(0, `rgba(${r},${g},${gb},${fb})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, s.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    // Clear to black first
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />;
}

// ── Pill mode toggle with yellow pill ────────────────────────────────────────
const PILL_MODES = [
  { id: 'blue',    label: 'Smart',    active: 'bg-blue-500/30 border-blue-400 text-blue-200',   inactive: 'text-white/40' },
  { id: 'green',   label: 'Green',    active: 'bg-green-500/30 border-green-400 text-green-200', inactive: 'text-white/40' },
  { id: 'red',     label: 'Red Pill', active: 'bg-red-500/30 border-red-400 text-red-200',       inactive: 'text-white/40' },
  { id: 'yellow',  label: 'Extract',  active: 'bg-yellow-500/30 border-yellow-400 text-yellow-200', inactive: 'text-white/40' },
];

function PillModeBar({ activeMode, onChange }) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/10">
      {PILL_MODES.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
            activeMode === p.id ? p.active : `border-transparent ${p.inactive} hover:text-white/60`
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExtractPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [extractMode, setExtractMode] = useState('transcript'); // 'transcript' | 'images'
  const [pillMode, setPillMode] = useState('yellow');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [spinState, setSpinState] = useState(() => getSpinState());
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => { setSpinState(getSpinState()); }, []);

  const spendSpin = useCallback(() => {
    setSpinState((prev) => {
      const next = { ...prev, remaining: Math.max(0, prev.remaining - 1) };
      saveSpins(next);
      return next;
    });
  }, []);

  const handleExtract = async () => {
    if (!url.trim()) return;
    if (spinState.remaining <= 0) return;
    setLoading(true); setError(''); setResult(null); setShowFull(false);
    try {
      const endpoint = extractMode === 'transcript' ? '/api/extract/transcript' : '/api/extract/images';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Extraction failed');
      setResult(data);
      spendSpin();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // Pill mode → return-to-search destination
  const returnToSearch = () => {
    const modeMap = { blue: '', green: '?mode=green', red: '?mode=red', yellow: '' };
    navigate(`/search${modeMap[pillMode] || ''}`);
  };

  // Pill switch: non-yellow modes navigate away
  const handlePillChange = (mode) => {
    if (mode === 'yellow') { setPillMode('yellow'); return; }
    const modeMap = { blue: '/search', green: '/search?mode=green', red: '/search?mode=red' };
    navigate(modeMap[mode] || '/search');
  };

  const getOutputText = () => (result?.transcript || '') + WATERMARK;
  const handleCopy = () => {
    if (!result?.transcript) return;
    navigator.clipboard.writeText(getOutputText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const handleDownload = () => {
    if (!result?.transcript) return;
    const blob = new Blob([getOutputText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `transcript-${result.videoId || 'extract'}.txt`; a.click();
  };
  const preview = result?.transcript ? result.transcript.slice(0, 600) + (result.transcript.length > 600 ? '…' : '') : '';

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      {/* Yellow-tinted starfield */}
      <YellowStarfield />

      {/* Subtle yellow ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-yellow-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur-sm">
          <PillModeBar activeMode={pillMode} onChange={handlePillChange} />
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/40 text-yellow-200 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Extract
            </button>
            <button
              onClick={returnToSearch}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-semibold transition-all"
            >
              <ArrowLeft size={13} />
              Return to Search
            </button>
          </div>
        </div>

        {/* ── Logo + hero ── */}
        <div className="flex flex-col items-center pt-10 pb-6 px-4">
          <TruegleLogo size="medium" onClick={() => navigate('/')} />
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-4 text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
              Content Extractor
            </h1>
            <p className="text-white/40 text-sm mt-1 max-w-md">
              Paste any URL to pull a full transcript or extract images — no account required.
            </p>
          </motion.div>
        </div>

        {/* ── Ad top ── */}
        <div className="max-w-3xl w-full mx-auto px-4 mb-4">
          <AdSlot size="large" />
        </div>

        {/* ── URL input + mode toggle ── */}
        <div className="max-w-3xl w-full mx-auto px-4">
          {/* Transcript / Images toggle */}
          <div className="flex gap-2 mb-3">
            {[
              { id: 'transcript', icon: FileText, label: 'Transcript' },
              { id: 'images',     icon: Image,    label: 'Images' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setExtractMode(id); setResult(null); setError(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  extractMode === id
                    ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-200'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* URL bar */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-yellow-400/50 transition-colors">
              <Link2 size={16} className="text-white/30 shrink-0" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                placeholder={extractMode === 'transcript' ? 'https://youtube.com/watch?v=…' : 'https://example.com/article'}
                className="flex-1 bg-transparent text-white placeholder-white/25 text-sm outline-none"
              />
            </div>
            <button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold transition-colors flex items-center gap-2 shrink-0"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Extract
            </button>
          </div>

          {/* Hint + spin counter row */}
          <div className="flex items-center justify-between px-1 mb-6">
            <p className="text-xs text-white/30">
              {extractMode === 'transcript'
                ? 'YouTube videos with captions. Auto-generated captions work too.'
                : 'Extracts all images found on the page at the given URL.'}
            </p>
            <div className="flex items-center gap-3 text-xs text-white/40 shrink-0">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-yellow-400" />
                <span className="text-white font-semibold">{spinState.remaining}</span> left today
              </span>
              <span className="flex items-center gap-1"><Clock size={11} />resets {msUntilReset(spinState.resetAt)}</span>
            </div>
          </div>

          {/* ── Error ── */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 bg-red-950/60 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />{error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Result — Transcript ── */}
          <AnimatePresence>
            {result?.transcript && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-white/5 border border-yellow-400/20 rounded-2xl overflow-hidden mb-6">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <CheckCircle size={14} className="text-green-400" />
                    <span className="text-white font-medium">{result.wordCount.toLocaleString()} words</span>
                    <span>· {result.segmentCount} segments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white transition-all">
                      {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-xs text-yellow-300 hover:text-yellow-200 transition-all">
                      <Download size={12} />.txt
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                    {showFull ? result.transcript : preview}
                  </p>
                  {result.transcript.length > 600 && (
                    <button onClick={() => setShowFull(!showFull)}
                      className="mt-3 flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors">
                      {showFull ? <><ChevronUp size={12} />Show less</> : <><ChevronDown size={12} />Show full transcript</>}
                    </button>
                  )}
                </div>
                <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/20">
                    Extracted via <a href="https://truegle.info" className="text-white/30 hover:text-white/50 underline underline-offset-2">Truegle</a>
                  </span>
                  <span className="text-xs text-white/20 flex items-center gap-1"><Lock size={10} />Remove watermark with Premium</span>
                </div>
              </motion.div>
            )}

            {/* Result — Images */}
            {result?.images && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-white/5 border border-yellow-400/20 rounded-2xl overflow-hidden mb-6">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 text-sm">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-white font-medium">{result.images.length} images</span>
                  <span className="text-white/40">found at {new URL(result.url).hostname}</span>
                </div>
                <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {result.images.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                      className="group relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-yellow-400/40 transition-all">
                      <img src={src} alt="" loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </a>
                  ))}
                </div>
                <div className="px-5 py-2.5 border-t border-white/5">
                  <span className="text-xs text-white/20">Extracted via <a href="https://truegle.info" className="text-white/30 hover:text-white/50 underline underline-offset-2">Truegle</a></span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── No spins teaser ── */}
          {spinState.remaining === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-2 p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-center mb-6">
              <p className="text-amber-300 text-sm font-medium mb-3">You've used all your free extractions for today.</p>
              <a href="/pricing"
                className="inline-block px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-300 text-sm font-medium transition-all">
                Go Premium · unlimited
              </a>
            </motion.div>
          )}

          {/* ── Bottom ad — first-party house ad (active Adsterra zones are
              adult-enabled at the network level; never render them ungated) ── */}
          <div className="mb-8">
            <AdSlot size="large" className="max-w-4xl mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
