import { useState, useEffect, useRef } from 'react';
import { X, Check, Copy, Share2, ShieldCheck, Smartphone } from 'lucide-react';
import { PLATFORMS } from '../../config/sharePlatforms';

// Share a reel out to the rest of the internet as a Truegle player link.
//
// HOW EACH DESTINATION IS ACTUALLY REACHED — this is the whole design:
//
//   • Instagram, TikTok, YouTube: via the device's NATIVE SHARE SHEET
//     (navigator.share). The OS hands the link to whichever app the user
//     picks, using the account they're already signed into. It is the only
//     route to those three that exists without Meta/TikTok app review and an
//     audited developer app, and it costs nothing. So it's the primary button.
//   • Facebook, X, Reddit, WhatsApp, Telegram, LinkedIn, Bluesky: public web
//     intents — a plain URL that opens their own composer in the user's
//     logged-in session. No API, no OAuth, nothing posted on their behalf.
//   • Anywhere else: copy the link.
//
// What travels is always the truegle.info/w link, never a re-uploaded video:
// the recipient lands in Truegle's own sandboxed player, and the link carries
// Truegle metadata (title, thumbnail, VideoObject schema) so the preview card
// is unmistakably ours wherever it's pasted.
export default function ReelShareSheet({ open, onClose, link, title, platform }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !link) return null;

  const text = `${title || 'Watch this'} — on Truegle`;

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'Watch on Truegle', text, url: link });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        copyLink();
      }
    } catch { /* user dismissed the sheet */ }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openIntent = (p) => {
    window.open(p.compose({ title: title || 'Watch on Truegle', text, url: link }), '_blank', 'width=580,height=520,noopener');
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
      <div ref={ref} className="w-full max-h-full overflow-y-auto rounded-2xl bg-[#0d0d14] border-t border-white/15 p-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={14} className="text-cyan-300 shrink-0" />
          <span className="text-xs text-white/80 font-medium">Share this reel</span>
          <button type="button" onClick={onClose} aria-label="Close share sheet"
            className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Primary: the only route to Instagram / TikTok / YouTube. */}
        <button
          type="button"
          onClick={nativeShare}
          className="w-full flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-cyan-500/20 border border-cyan-400/45 text-cyan-100 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
        >
          {shared ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
          {shared ? 'Shared' : 'Share to an app…'}
        </button>
        <p className="mt-1.5 mb-3 flex items-start gap-1.5 text-[10px] text-white/40 leading-tight">
          <Smartphone size={11} className="mt-px shrink-0" />
          <span>
            Instagram, TikTok and YouTube post through your phone&apos;s share sheet — pick the app
            and it uses the account you&apos;re already signed into. Truegle never posts for you.
          </span>
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openIntent(p)}
              className={`flex items-center gap-2 px-2.5 min-h-[40px] rounded-lg border text-left text-xs text-white/80 hover:text-white transition-all ${p.color}`}
            >
              <p.icon />
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="mt-1.5 w-full flex items-center gap-2 px-2.5 min-h-[40px] rounded-lg border border-white/12 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          <span>{copied ? 'Link copied' : 'Copy Truegle link'}</span>
        </button>

        <p className="mt-2 text-[10px] text-white/30 leading-tight">
          Shares a truegle.info link that opens {platform ? `this ${platform} clip` : 'the clip'} inside
          Truegle&apos;s sandboxed player — the original creator keeps their views, and the link
          can&apos;t redirect whoever you send it to.
        </p>
      </div>
    </div>
  );
}
