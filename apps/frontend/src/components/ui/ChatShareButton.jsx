import { useState, useRef, useEffect } from 'react';
import { Share2, X, Check, Copy } from 'lucide-react';
import { PLATFORMS } from '../../config/sharePlatforms';

const CHAT_URL = 'https://truegle.info/chat';

// Flatten a chat message's citations into plain lists for the shared text.
function citationLines(citations) {
  if (!citations) return { links: [], pics: [], vids: [] };
  const toUrl = (r) => r.url;
  return {
    links: (citations.links || []).map((r) => `• ${r.title || r.domain || r.url}\n  ${toUrl(r)}`),
    pics: (citations.pics || []).map((r) => `• ${r.image || r.url}`),
    vids: (citations.vids || citations.videos || []).map((r) => `• ${r.title || r.url}\n  ${toUrl(r)}`),
  };
}

/**
 * Build the FULL shareable text for a chat answer: the answer body plus every
 * cited link, image, and video. Used for "Copy full answer" and (trimmed) for
 * the social platform intents.
 */
export function buildShareText(message, { full = true } = {}) {
  const { links, pics, vids } = citationLines(message.citations);
  const parts = ['📌 Answered by Nephesh on Truegle\n', message.content.trim()];

  if (full) {
    if (links.length) parts.push(`\nSources:\n${links.join('\n')}`);
    if (pics.length) parts.push(`\nImages:\n${pics.join('\n')}`);
    if (vids.length) parts.push(`\nVideos:\n${vids.join('\n')}`);
  }
  parts.push(`\nAsk your own question → ${CHAT_URL}`);
  return parts.join('\n');
}

/**
 * Share control for a Truegle Chat assistant message. "Copy full answer"
 * copies the entire response plus all media/links; the platform buttons open
 * a share intent with a trimmed body (platforms cap length) that always points
 * back to /chat.
 */
export default function ChatShareButton({ message }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildShareText(message, { full: true })).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePlatform = (platform) => {
    // Trimmed body for social (link lists blow past char limits); the copy
    // action carries the full media/link set.
    const short = message.content.trim().slice(0, 240);
    const url = platform.compose({
      title: short.split('\n')[0].slice(0, 90) || 'Truegle Chat',
      text: `📌 Answered by Nephesh on Truegle\n\n${short}${message.content.length > 240 ? '…' : ''}`,
      url: CHAT_URL,
    });
    window.open(url, '_blank', 'width=580,height=460,noopener');
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Share this answer"
        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors"
      >
        <Share2 size={12} /> Share
      </button>

      {open && (
        <div className="absolute bottom-6 left-0 z-50 w-56 bg-[#0d0d1a] border border-white/15 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Share answer</span>
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="p-1">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/10 hover:border-white/30 text-left text-xs text-white/70 hover:text-white transition-all mb-1"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied full answer!' : 'Copy full answer + links'}</span>
            </button>
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
          </div>
          <div className="px-3 py-2 border-t border-white/10">
            <p className="text-[9px] text-white/25 leading-tight">
              "Copy full answer" includes every source, image, and video link.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
