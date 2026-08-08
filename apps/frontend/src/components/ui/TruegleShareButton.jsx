import { useState, useRef, useEffect } from 'react';
import { Share2, X, Check, Copy, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PLATFORMS } from '../../config/sharePlatforms';
import { getPlayable } from '../../utils/videoEmbed';
import { buildShareLink } from '../../utils/playerLink';
import { copyText } from '../../utils/clipboard';

export default function TruegleShareButton({ result, query, mode = 'blue', compact = false }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPlayer, setCopiedPlayer] = useState(false);
  const ref = useRef(null);
  // Media we can host ourselves gets a second, better share option: a link
  // that opens in Truegle's sandboxed player instead of the source site.
  // Every result gets a Truegle link now — /w for media, /l for everything
  // else — so a shared link always lands the recipient back on Truegle.
  const playerLink = buildShareLink({ url: result.url, title: result.title });
  const isMedia = !!getPlayable(result.url);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const title = result.title || 'Found on Truegle';
  const modeTag = mode === 'red' ? '#RedPill' : mode === 'purple' ? '#AllPerspectives' : mode === 'ocean' ? '#OSINT' : '';
  const sharePayload = {
    title,
    url: playerLink || result.url,
    // Body the shared platform composers fold in ({ title, text, url }).
    text: `📌 Posted on Truegle\n\n"${title}"\n\nFound searching "${query || ''}" on Truegle${modeTag ? ` ${modeTag}` : ''}`,
  };

  // Both of these used a bare .then() with no .catch(). A rejected write left
  // the clipboard holding the PREVIOUS link and said nothing — see
  // utils/clipboard.js. The tick now only appears when the copy really landed.
  const handleCopyLink = async () => {
    const text = `📌 Posted on Truegle\n\n"${title}"\n\n${playerLink || result.url}\n\nFound with Truegle — the unbiased search engine → truegle.info`;
    if (!(await copyText(text))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPlayerLink = async () => {
    if (!playerLink) return;
    if (!(await copyText(playerLink))) return;
    setCopiedPlayer(true);
    setTimeout(() => setCopiedPlayer(false), 2000);
  };

  const handlePlatform = (platform) => {
    const url = platform.compose(sharePayload);
    window.open(url, '_blank', 'width=580,height=460,noopener');
    setOpen(false);
  };

  // Signed-out users still get the player link — a link into our own sandboxed
  // player costs nothing to hand out and is the whole point of the format. Only
  // the social composers (which post as the user) stay behind the sign-in.
  if (!isAuthenticated && !playerLink) {
    return (
      <a
        href="/auth/signup"
        title="Sign in to share"
        className="text-white/25 hover:text-white/50 transition-colors flex items-center gap-1 text-xs"
      >
        <Share2 size={12} />
        {!compact && <span>Share</span>}
      </a>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Share this result"
        className="flex items-center gap-1 text-xs text-white/40 hover:text-cyan-400 transition-colors"
      >
        <Share2 size={12} />
        {!compact && <span>Share</span>}
      </button>

      {open && (
        <div className="absolute bottom-6 right-0 z-50 w-52 bg-[#0d0d1a] border border-white/15 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">{isAuthenticated ? 'Post on Truegle' : 'Share'}</span>
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white">
              <X size={12} />
            </button>
          </div>

          <div className="p-1">
            {playerLink && (
              <button
                onClick={handleCopyPlayerLink}
                title={isMedia
                  ? "A link that opens inside Truegle's sandboxed player — it can't redirect whoever you send it to"
                  : 'A Truegle link — it lands on Truegle showing where it goes, instead of sending people straight off-site'}
                className="w-full flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-left text-xs text-cyan-100 hover:bg-cyan-500/20 transition-all"
              >
                {copiedPlayer ? <Check size={14} className="text-green-400" /> : <ShieldCheck size={14} />}
                <span>{copiedPlayer ? 'Truegle link copied!' : isMedia ? 'Copy safe player link' : 'Copy safe Truegle link'}</span>
              </button>
            )}
            {isAuthenticated ? (
              <>
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePlatform(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs text-white/80 hover:text-white transition-all ${p.color}`}
                  >
                    <p.icon />
                    <span>{p.label}</span>
                  </button>
                ))}

                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/10 hover:border-white/30 text-left text-xs text-white/60 hover:text-white transition-all"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy post text'}</span>
                </button>
              </>
            ) : (
              <a
                href="/auth/signup"
                className="block px-3 py-2 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                Sign in to post this straight to social →
              </a>
            )}
          </div>

          <div className="px-3 py-2 border-t border-white/10">
            <p className="text-[9px] text-white/25 leading-tight">
              Each post auto-tags "Posted on Truegle" so your followers can find the source.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
