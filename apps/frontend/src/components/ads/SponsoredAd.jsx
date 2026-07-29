import { useState, useEffect, useRef } from 'react';
import AdsterraBanner from './AdsterraBanner';

/**
 * The single, consistent ad unit used across search + chat: a native Adsterra
 * banner in an orange-outlined box with a "Sponsored" label.
 *
 * Self-collapsing: Adsterra fills a given native zone only ONCE per page, so a
 * page with several of these would otherwise show empty boxes for the slots
 * that didn't fill. Each slot listens (via a per-instance nonce) for whether
 * its ad actually drew and renders NOTHING if it didn't — so in-feed slots
 * (every 3rd result / video) never leave a hollow "placeholder" box. If nothing
 * reports in time we assume unfilled and collapse.
 */
export default function SponsoredAd({ searchContext = null, className = '' }) {
  const [status, setStatus] = useState('pending'); // 'pending' | 'ok' | 'empty'
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(
      () => setStatus((s) => (s === 'pending' ? 'empty' : s)),
      6000
    );
    return () => clearTimeout(timerRef.current);
  }, []);

  if (status === 'empty') return null;

  return (
    <div
      className={`relative rounded-xl border border-orange-500/50 bg-orange-500/[0.03] overflow-hidden ${className}`}
    >
      <div className="px-2 pt-1 text-[9px] font-bold uppercase tracking-widest text-orange-400/80 select-none">
        Sponsored
      </div>
      <AdsterraBanner
        format="nativeBanner"
        searchContext={searchContext}
        onRendered={(ok) => setStatus(ok ? 'ok' : 'empty')}
      />
    </div>
  );
}
