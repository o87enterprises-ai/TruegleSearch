import React from 'react';
import { ADSTERRA_BANNER_KEY, hasDisplayAds } from '../../config/ads';

/**
 * AdSlot — a real display ad (Adsterra banner) rendered inside a sandboxed
 * iframe so the network's document.write / globals can't interfere with the
 * SPA. Renders nothing until VITE_ADSTERRA_BANNER_KEY is configured, so there
 * are never empty/broken ad boxes in pre-production.
 *
 * Default 300x250 (medium rectangle) — the highest-fill display size.
 */
const AdSlot = ({ width = 300, height = 250, className = '', label = true }) => {
  if (!hasDisplayAds()) return null;

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script type="text/javascript">atOptions={'key':'${ADSTERRA_BANNER_KEY}','format':'iframe','height':${height},'width':${width},'params':{}};</script><script type="text/javascript" src="//www.highperformanceformat.com/${ADSTERRA_BANNER_KEY}/invoke.js"></script></body></html>`;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
          Sponsored
        </span>
      )}
      <iframe
        title="Sponsored content"
        srcDoc={srcDoc}
        width={width}
        height={height}
        scrolling="no"
        loading="lazy"
        style={{ border: 0, overflow: 'hidden', borderRadius: 12 }}
      />
    </div>
  );
};

export default AdSlot;
