import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useRewards } from '../context/RewardsContext';
import AdsterraBanner from './ads/AdsterraBanner';
import { formatMicros } from '../utils/rewardsFormat';

// Non-adult Adsterra formats only — a reward-eligible slot must always be
// able to render, so it can't depend on the adult gate (auth+safe-search-off
// +adult-query+session-consent). Mirrors AdSlot's size->format intent.
const sizeToFormat = {
  small: 'banner320x50',
  medium: 'banner300x250',
  large: 'banner468x60',
  leaderboard: 'banner468x60',
  sidebar: 'banner300x250',
};

const POLL_MS = 500;

/*
 * Reward-eligible ad slot. Renders a real AdsterraBanner — the reward-eligible
 * event (an honest view, or a detected click) is the exact same event that
 * earns Truegle real Adsterra revenue, so this is a genuine revenue-share,
 * not an arbitrary number.
 *
 * For users not opted into the Rewards Program, this is just a normal
 * AdsterraBanner: no session calls, no extra tracking. Every earn is still
 * verified server-side against real wall-clock time (see routes/rewards.js),
 * so a tampered client can never claim more than honest viewing/clicking
 * would allow.
 *
 * Click detection: Adsterra's ad renders inside a cross-origin iframe, so we
 * can't read click events inside it directly. Instead we use the standard
 * ad-click heuristic — if the window loses focus while the cursor is over the
 * ad, that's very likely a click into the iframe. It's an approximation, not
 * ground truth, which is why the click reward is set conservatively below
 * the observed average revenue-per-click (see RewardsService.js).
 */
const RewardAdSlot = ({ position, size = 'medium', searchContext = null, className = '' }) => {
  const { settings } = useSettings();
  const { optedIn, config, startImpressionSession, earn } = useRewards();

  const adHidden = !settings.adPersonalization && settings.cookiePreference === 'necessary';
  const zone = sizeToFormat[size] || sizeToFormat[position] || 'banner320x50';
  const adId = zone; // Adsterra format doubles as the ad identifier for this slot.

  const containerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const sessionPendingRef = useRef(false);
  const visibleSinceRef = useRef(null);
  const accumulatedMsRef = useRef(0);
  const hoveringRef = useRef(false);
  const earnedRef = useRef(false);
  const [earnedKind, setEarnedKind] = useState(null);

  const minVisibleMs = config?.minVisibleMs ?? 4000;
  // Guards against opening a session for an ad that AdsterraBanner itself
  // won't render (e.g. consent revoked) — no session means no reward.
  const trackingEnabled = optedIn && !adHidden && window.__truegle_ad_consent !== false;

  useEffect(() => {
    if (!trackingEnabled || !containerRef.current) return;
    let cancelled = false;

    const ensureSession = () => {
      if (sessionIdRef.current || sessionPendingRef.current) return;
      sessionPendingRef.current = true;
      startImpressionSession(adId, zone).then((result) => {
        sessionPendingRef.current = false;
        if (!cancelled && result.success) sessionIdRef.current = result.sessionId;
      });
    };

    const liveMs = () =>
      accumulatedMsRef.current + (visibleSinceRef.current ? Date.now() - visibleSinceRef.current : 0);

    const claimClick = async () => {
      if (earnedRef.current || !sessionIdRef.current) return;
      earnedRef.current = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      const result = await earn(sessionId, liveMs(), true);
      if (!cancelled && result.success) setEarnedKind('click');
      else if (!cancelled) earnedRef.current = false; // didn't qualify — allow the view trickle to still fire
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting && document.visibilityState === 'visible';
        if (isVisible) {
          if (!visibleSinceRef.current) visibleSinceRef.current = Date.now();
          ensureSession();
        } else if (visibleSinceRef.current) {
          accumulatedMsRef.current += Date.now() - visibleSinceRef.current;
          visibleSinceRef.current = null;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(containerRef.current);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' && visibleSinceRef.current) {
        accumulatedMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Click heuristic: cursor over the ad + window loses focus = likely clicked into the iframe.
    const onWindowBlur = () => {
      if (hoveringRef.current) claimClick();
    };
    window.addEventListener('blur', onWindowBlur);

    const interval = setInterval(async () => {
      if (cancelled || earnedRef.current || !sessionIdRef.current) return;
      if (liveMs() >= minVisibleMs) {
        earnedRef.current = true;
        const sessionId = sessionIdRef.current;
        sessionIdRef.current = null;
        const result = await earn(sessionId, liveMs(), false);
        if (!cancelled && result.success) setEarnedKind('impression');
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      clearInterval(interval);
    };
  }, [trackingEnabled, adId, zone, minVisibleMs, startImpressionSession, earn]);

  if (adHidden) return null;

  const earnedMicros = earnedKind === 'click' ? config?.microsPerClick : config?.microsPerImpression;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => { hoveringRef.current = true; }}
      onMouseLeave={() => { hoveringRef.current = false; }}
    >
      <AdsterraBanner format={zone} searchContext={searchContext} className={className} />
      {trackingEnabled && earnedKind && (
        <span className="absolute -top-2 -right-2 z-10 text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow">
          +{formatMicros(earnedMicros)} earned
        </span>
      )}
    </div>
  );
};

export default RewardAdSlot;
