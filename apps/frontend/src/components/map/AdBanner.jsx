import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * AdBanner Component
 *
 * Displays banner advertisements at top or bottom of map
 * Supports placeholder content for ad integration
 *
 * @param {string} position - 'top' or 'bottom'
 * @param {string} className - Additional CSS classes
 * @param {boolean} isDismissible - Whether ad can be dismissed
 */
export default function AdBanner({
  position = 'top',
  className = '',
  isDismissible = false,
  onDismiss = null
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={`ad-banner ad-banner-${position} ${className}`}
      style={{
        width: '100%',
        minHeight: '60px',
        maxHeight: '90px',
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(10px)',
        borderTop: position === 'bottom' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
        borderBottom: position === 'top' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        zIndex: 5
      }}
    >
      {/* Ad Content Placeholder */}
      <div
        className="ad-content"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px'
        }}
      >
        {/* Placeholder - Replace with actual ad integration */}
        <div
          style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '10px', letterSpacing: '2px' }}>
            ADVERTISEMENT
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>
            {position === 'top' ? '728x90 Banner Ad' : '970x90 Leaderboard Ad'}
          </div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'rgba(255, 255, 255, 0.2)' }}>
            Replace with: Google AdSense, Media.net, or custom ad network
          </div>
        </div>
      </div>

      {/* Dismiss Button */}
      {isDismissible && (
        <button
          onClick={handleDismiss}
          className="ad-dismiss-btn"
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            padding: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
          title="Dismiss ad"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/**
 * Usage Example:
 *
 * // Top banner (non-dismissible)
 * <AdBanner position="top" />
 *
 * // Bottom banner (dismissible)
 * <AdBanner
 *   position="bottom"
 *   isDismissible={true}
 *   onDismiss={() => console.log('Ad dismissed')}
 * />
 *
 * // Integration with ad networks:
 *
 * 1. Google AdSense:
 *    Replace ad-content div with:
 *    <ins className="adsbygoogle"
 *         style={{ display: 'block' }}
 *         data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
 *         data-ad-slot="XXXXXXXXXX"
 *         data-ad-format="horizontal"
 *         data-full-width-responsive="true"></ins>
 *
 * 2. Media.net:
 *    <div id="XXXXXXXXX"></div>
 *    <script>window._mNHandle.queue.push(...);</script>
 *
 * 3. Custom HTML ads:
 *    <a href="https://example.com" target="_blank">
 *      <img src="/ad-banner.jpg" alt="Advertisement" />
 *    </a>
 */
