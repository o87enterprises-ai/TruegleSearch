import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RotateCw } from 'lucide-react';
import { tiktokRetryWaitMs } from '../../utils/tiktokBlock';

// TIKTOK IS BEING REFUSED STEADILY: OPEN ON TIKTOK, BY DEFAULT (plan step 6,
// docs/TIKTOK-429-PLAN.md; owner, 2026-11-10: "429 Too Many Requests").
//
// After the full player has failed on three clips in half an hour (and nobody has
// said the card works here), TikToks stop loading in the player at all: no frame,
// no request to TikTok, no raw error page. This panel stands in their place, with
// Open on TikTok as the main action. The failures age out after 30 minutes, so the
// player tries again by itself — and "Try anyway" tries it now, for this clip only
// (at most once every 30 s). If it works, the failures are forgotten at once.
//
// IN A STREAM (plan step 4) the panel moves on after a few seconds, so a run of
// TikToks does not stall the queue; nothing is loading, so there is nothing to wait
// for. The countdown only runs while the tab is visible and the player is not paused.
export default function TikTokBlockedPanel({ pageUrl, poster, title, autoAdvanceMs = 0, onAdvance, active = true, onTryAnyway }) {
  const [wait, setWait] = useState(() => tiktokRetryWaitMs());
  const [left, setLeft] = useState(autoAdvanceMs);
  const advanced = useRef(false);
  const counting = autoAdvanceMs > 0;

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setInterval(() => setWait(tiktokRetryWaitMs()), 1000);
    return () => clearInterval(t);
  }, [wait > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!counting) return undefined;
    const t = setInterval(() => {
      if (!active || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
      setLeft((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [counting, active]);
  useEffect(() => {
    if (counting && left <= 0 && !advanced.current) { advanced.current = true; onAdvance?.(); }
  }, [counting, left, onAdvance]);

  const safeUrl = /^https:\/\/([a-z0-9-]+\.)?tiktok\.com\//i.test(pageUrl || '') ? pageUrl : null;
  const safePoster = /^https:\/\//i.test(poster || '') ? poster : null;
  return (
    <div data-tiktok-blocked="" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 px-4 py-6 bg-black/90 text-center text-white">
      {safePoster && <img src={safePoster} alt="" referrerPolicy="no-referrer" className="max-h-28 rounded-lg object-cover opacity-80" />}
      {title && <p className="max-w-xs text-sm font-semibold leading-snug line-clamp-2">{title}</p>}
      <p className="max-w-xs text-xs text-white/70 leading-snug">
        TikTok has stopped playing in Truegle for now, so TikToks open on TikTok.
      </p>
      {safeUrl && (
        <a data-tiktok-open="" href={safeUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90">
          <ExternalLink size={14} /> Open on TikTok
        </a>
      )}
      <button type="button" data-tiktok-try="" disabled={wait > 0}
        onClick={() => { onTryAnyway?.(); setWait(tiktokRetryWaitMs()); }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold disabled:opacity-50 disabled:hover:bg-white/15">
        <RotateCw size={12} /> {wait > 0 ? `Try anyway in ${Math.ceil(wait / 1000)}s` : 'Try anyway'}
      </button>
      {counting && <p data-tiktok-countdown="" className="text-[11px] text-white/50">Moving on in {Math.ceil(left / 1000)}s</p>}
    </div>
  );
}
