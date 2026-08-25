import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const parts = ['📌 Answered by TrueGLE\n', message.content.trim()];

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
// Above the early-access banner (z-60/70) and the Reels surface (z-80), below
// PageClock (z-9997) and the nav button (z-9998) — those two stay on top on
// purpose everywhere else, so a share menu should not be the one thing that
// covers the clock.
const MENU_Z = 9990;
const MENU_W = 224;   // w-56
const GAP = 8;
const MARGIN = 8;     // keep clear of the screen edge on a narrow phone

export default function ChatShareButton({ message }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);

  /* WHY THIS MENU IS PORTALLED, and why bumping z-index could never fix it.
   *
   * It used to be `absolute … z-50` inside the message bubble, and it rendered
   * UNDERNEATH later messages. The reason is not the number: each message is a
   * framer-motion div animating `opacity` and `y`, and BOTH of those create a
   * stacking context. z-50 therefore only ranks the menu against its own
   * bubble's children — against a sibling message it does not compete at all,
   * because the whole bubble is one layer and later siblings paint over it.
   * z-[9999] inside that same box would have changed nothing.
   *
   * The only fix is to leave the ancestor. A portal to <body> puts the menu in
   * the root stacking context where its z-index is finally meaningful, and it
   * also escapes any `overflow: hidden` on the way up — which would have
   * clipped it even if the layering had been right. */
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 0;
    // Prefer opening upward (the original design), but flip below when there
    // is not room above — near the top of the thread it would be off-screen.
    const openUp = menuH === 0 ? true : r.top > menuH + GAP;
    const top = openUp ? Math.max(MARGIN, r.top - menuH - GAP) : r.bottom + GAP;
    // Clamp horizontally so a button near the right edge does not push the
    // menu off a phone screen.
    const left = Math.min(
      Math.max(MARGIN, r.left),
      Math.max(MARGIN, window.innerWidth - MENU_W - MARGIN),
    );
    setPos({ top, left });
  }, []);

  // Measure once mounted (offsetHeight is 0 before the first paint), then keep
  // it pinned to the trigger while the thread scrolls underneath.
  useEffect(() => {
    if (!open) { setPos(null); return undefined; }
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);  // capture: inner scrollers too
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  useEffect(() => {
    // The menu now lives outside `ref`'s subtree, so "outside" has to mean
    // outside BOTH the trigger and the portalled menu — checking only the
    // trigger would close it on its own buttons.
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    if (open) {
      // pointerdown, not mousedown: touch does not always emulate mouse events
      // reliably, and this menu is mostly used on a phone.
      document.addEventListener('pointerdown', onDown);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
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
      text: `📌 Answered by TrueGLE\n\n${short}${message.content.length > 240 ? '…' : ''}`,
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

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Share answer"
          className="fixed w-56 bg-[#0d0d1a] border border-white/15 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
          style={{
            zIndex: MENU_Z,
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            // Hidden until measured. Without this the menu paints once at 0,0
            // and visibly jumps into place — offsetHeight is not knowable until
            // after the first render.
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
