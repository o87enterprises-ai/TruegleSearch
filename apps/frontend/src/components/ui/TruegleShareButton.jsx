import { useState, useRef, useEffect } from 'react';
import { Share2, X, Check, Copy, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PLATFORMS = [
  {
    id: 'twitter',
    label: 'Twitter / X',
    color: 'bg-black border-white/20 hover:border-white/50',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    compose: ({ title, url, query, mode }) => {
      const modeTag = mode === 'red' ? '#RedPill' : mode === 'purple' ? '#AllPerspectives' : mode === 'ocean' ? '#OSINT' : '';
      const text = `📌 Posted on Truegle\n\n"${title}"\n\nFound this searching for "${query}" on @TruegleSearch ${modeTag}\n\n`;
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    },
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    color: 'bg-[#0085ff]/10 border-[#0085ff]/30 hover:border-[#0085ff]/70',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#0085ff]">
        <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
      </svg>
    ),
    compose: ({ title, url, query }) => {
      const text = `📌 Posted on Truegle\n\n"${title}"\n\nFound searching "${query}" on Truegle\n\n${url}`;
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: 'bg-[#0077b5]/10 border-[#0077b5]/30 hover:border-[#0077b5]/60',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#0077b5]">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    compose: ({ url }) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    color: 'bg-[#ff4500]/10 border-[#ff4500]/30 hover:border-[#ff4500]/60',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#ff4500]">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    ),
    compose: ({ title, url }) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(`[Posted on Truegle] ${title}`)}`,
  },
];

export default function TruegleShareButton({ result, query, mode = 'blue', compact = false }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sharePayload = {
    title: result.title || 'Found on Truegle',
    url: result.url,
    query: query || '',
    mode,
  };

  const handleCopyLink = () => {
    const text = `📌 Posted on Truegle\n\n"${sharePayload.title}"\n\n${result.url}\n\nFound with Truegle — the unbiased search engine → truegle.info`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePlatform = (platform) => {
    const url = platform.compose(sharePayload);
    window.open(url, '_blank', 'width=580,height=460,noopener');
    setOpen(false);
  };

  if (!isAuthenticated) {
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
            <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Post on Truegle</span>
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white">
              <X size={12} />
            </button>
          </div>

          <div className="p-1">
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
