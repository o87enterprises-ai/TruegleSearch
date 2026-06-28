import { useEffect, useRef } from 'react';

const REVIVE_BASE = 'https://ads.truegle.info/www/delivery';

// Zone configs for each placement
export const ZONES = {
  display300x250a: { id: 1, w: 300, h: 250 },
  display300x250b: { id: 2, w: 300, h: 250 },
  leaderboard728x90: { id: 3, w: 728, h: 90 },
  overlayRichMedia: { id: 4, w: '100%', h: '100%' },
  videoInline: { id: 5, w: '100%', h: '100%' },
};

/**
 * Embeds a Revive Adserver zone via iframe invocation.
 * zone: key from ZONES, or a custom { id, w, h } object.
 * className: container class.
 * style: container style.
 */
const ReviveAd = ({ zone, className = '', style = {} }) => {
  const cbRef = useRef(Math.floor(Math.random() * 99999999999));
  const config = typeof zone === 'string' ? ZONES[zone] : zone;

  if (!config) return null;

  const src = `${REVIVE_BASE}/ai.php?zoneid=${config.id}&cb=${cbRef.current}`;
  const fallbackHref = `${REVIVE_BASE}/ck.php?cb=${cbRef.current}`;

  return (
    <div className={className} style={style}>
      <iframe
        src={src}
        width={config.w}
        height={config.h}
        scrolling="no"
        frameBorder="0"
        title="Advertisement"
        style={{
          border: 0,
          width: config.w,
          height: config.h,
          display: 'block',
        }}
      >
        <a href={fallbackHref} target="_blank" rel="noopener noreferrer">
          <img
            src={`${REVIVE_BASE}/avw.php?zoneid=${config.id}&cb=${cbRef.current}`}
            border="0"
            alt=""
          />
        </a>
      </iframe>
    </div>
  );
};

export default ReviveAd;
