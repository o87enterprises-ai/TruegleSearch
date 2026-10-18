import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';

// A page opened "In app": a frame with a header bar, and a way to take it full
// screen and back — the same flow the search results' "Open in app" has had
// since 2026-10-10, now in chat's Sources too (owner, 2026-10-17).
//
//   Full screen  → the frame covers the whole viewport
//   Minimize     → back to the small frame, where you were, nothing lost
//   Escape       → the same as Minimize; it always works, keyboard or not
//   ✕            → closes the preview altogether (full screen included)
//
// A CSS overlay in a portal rather than the browser's Fullscreen API: it works
// in a cross-origin iframe, on mobile Safari and under test automation, where
// requestFullscreen() is flaky or refused. It is portalled to <body> because a
// chat bubble sits inside transformed (animated) ancestors, which would turn
// `position: fixed` into "fixed to the bubble".
//
// No onLoad sniffing for a refusal: contentDocument is null for every
// cross-origin frame, framable or not. Known refusals are handled before this
// opens (utils/embeddable.js), and the bar always carries an Open link, so a
// frame that stays blank still has a way out.
//
// z-[10000]: above the page's own fixed chrome — the clock chip (9997) and the
// menu button (9998), which otherwise float over the bar and hide its buttons —
// and below the share link's play door (10001).
export default function PagePreview({ url, title, linkClass = 'text-cyan-400', frameClass = 'h-64', onClose }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', onKey);
    // The page behind must not scroll under a finger or a wheel.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const close = () => { setFull(false); onClose?.(); };
  const frame = (cls) => (
    <iframe
      key={url}
      src={url}
      className={cls}
      title={title || 'Preview'}
      sandbox="allow-scripts allow-same-origin"
    />
  );
  const btn = 'p-1 text-white/60 hover:text-white transition-colors';

  const bar = (
    <div className={`flex items-center justify-between gap-2 px-3 ${full ? 'py-2 bg-black/80' : 'py-1.5 bg-black/40'} border-b border-white/10`}>
      <span className="text-xs text-white/50 truncate flex-1">{url}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer" className={`text-xs ${linkClass} flex items-center gap-1 px-1`}>
          <ExternalLink size={11} /> Open link
        </a>
        <button
          type="button"
          data-viewer-fullscreen=""
          onClick={() => setFull((v) => !v)}
          title={full ? 'Minimize (Esc)' : 'Full screen'}
          aria-label={full ? 'Minimize' : 'Full screen'}
          className={btn}
        >
          {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button type="button" data-viewer-close="" onClick={close} title="Close" aria-label="Close preview" className={btn}>
          <X size={14} />
        </button>
      </div>
    </div>
  );

  if (full) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={title || 'Page preview'} data-viewer-fullscreen-open="">
        {bar}
        {frame('flex-1 w-full bg-white')}
      </div>,
      document.body,
    );
  }
  return (
    <div data-viewer-inline="">
      {bar}
      {frame(`w-full bg-white ${frameClass}`)}
    </div>
  );
}
