import { useEffect, useState } from 'react';
import { ExternalLink, RotateCw, SkipForward } from 'lucide-react';
import { tiktokRetryWaitMs } from '../../utils/tiktokBlock';

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
const SHOW_AFTER_MS = 3000;

export default function TikTokHelp({ pageUrl, onRetry, onNext }) {
  const [shown, setShown] = useState(false);
  const [wait, setWait] = useState(() => tiktokRetryWaitMs());
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
  if (!shown) return null;

  const safeUrl = /^https:\/\/([a-z0-9-]+\.)?tiktok\.com\//i.test(pageUrl || '') ? pageUrl : null;
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 font-semibold disabled:opacity-50 disabled:hover:bg-white/15';
  return (
    <div data-tiktok-help="" className="absolute inset-x-0 bottom-14 z-30 flex justify-center px-2 pointer-events-none">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 max-w-full px-3 py-2 rounded-2xl bg-black/80 border border-white/15 text-white text-xs">
        <span className="font-semibold">Not playing? TikTok may be limiting playback right now.</span>
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
