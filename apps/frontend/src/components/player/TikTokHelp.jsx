import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RotateCw, SkipForward } from 'lucide-react';
import { tiktokRetryWaitMs, tiktokStay, markTikTokStay } from '../../utils/tiktokBlock';

// A TIKTOK THAT MAY NOT BE PLAYING (owner, 2026-11-10: "429 Too Many Requests"
// inside the player — docs/TIKTOK-429-PLAN.md).
//
// Shown while a TikTok is in the CARD player. The card has no channel back to
// us, so we cannot tell a clip that is playing from TikTok's own error page —
// which is why this is a quiet strip with a way out, not an error message: it
// appears a few seconds in, and says "may".
//
//   Open on TikTok   — always works: the clip's own page.
//   Try the full player — asks for TikTok's controllable player again, at most
//                         once every 30 s (utils/tiktokBlock.js), so a throttled
//                         TikTok is not hammered.
//   Next             — moves on without calling the clip broken.
//
// IN A STREAM (plan step 4) the strip also COUNTS DOWN and moves on by itself, so
// a run of blocked TikToks does not stall the queue. We cannot see inside the card,
// so the person is the one who knows: "It's playing — stay" stops the countdown
// for this clip AND remembers, for this tab, that the card works here (a private
// window, say) — after which nothing is ever auto-skipped. The countdown only runs
// while the tab is visible and the player is not paused.
const SHOW_AFTER_MS = 3000;

export default function TikTokHelp({ pageUrl, onRetry, onNext, autoAdvanceMs = 0, onAdvance, active = true }) {
  const [shown, setShown] = useState(false);
  const [wait, setWait] = useState(() => tiktokRetryWaitMs());
  const [stayed, setStayed] = useState(() => tiktokStay());
  const counting = autoAdvanceMs > 0 && !stayed;
  const [left, setLeft] = useState(autoAdvanceMs);
  const advanced = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  // The retry button counts down; re-read the gap once a second while it is waiting.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setInterval(() => setWait(tiktokRetryWaitMs()), 1000);
    return () => clearInterval(t);
  }, [wait > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // The stream countdown: one tick a second, only while someone could be watching.
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

  if (!shown) return null;

  const safeUrl = /^https:\/\/([a-z0-9-]+\.)?tiktok\.com\//i.test(pageUrl || '') ? pageUrl : null;
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 font-semibold disabled:opacity-50 disabled:hover:bg-white/15';
  return (
    <div data-tiktok-help="" className="absolute inset-x-0 bottom-14 z-30 flex justify-center px-2 pointer-events-none">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 max-w-full px-3 py-2 rounded-2xl bg-black/80 border border-white/15 text-white text-xs">
        <span className="font-semibold">Not playing? TikTok may be limiting playback right now.</span>
        {counting && (
          <span data-tiktok-countdown="" className="text-white/70">Moving on in {Math.ceil(left / 1000)}s</span>
        )}
        {counting && (
          <button type="button" data-tiktok-stay="" onClick={() => { markTikTokStay(); setStayed(true); }} className={btn}>
            It's playing — stay
          </button>
        )}
        {safeUrl && (
          <a data-tiktok-open="" href={safeUrl} target="_blank" rel="noopener noreferrer" className={btn}>
            <ExternalLink size={12} /> Open on TikTok
          </a>
        )}
        <button type="button" data-tiktok-retry="" disabled={wait > 0}
          onClick={() => { onRetry?.(); setWait(tiktokRetryWaitMs()); }} className={btn}>
          <RotateCw size={12} /> {wait > 0 ? `Try the full player in ${Math.ceil(wait / 1000)}s` : 'Try the full player'}
        </button>
        {onNext && (
          <button type="button" data-tiktok-next="" onClick={onNext} className={btn}>
            <SkipForward size={12} /> Next
          </button>
        )}
      </div>
    </div>
  );
}
