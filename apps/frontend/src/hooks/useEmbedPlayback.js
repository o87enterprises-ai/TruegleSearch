import { useCallback, useEffect, useRef, useState } from 'react';

// Knowing when a PLATFORM EMBED finishes, without loading a vendor SDK.
//
// The player's auto-advance hung on an `ended` event, which only a native
// <audio>/<video> fires. Everything people actually queue — YouTube, Vimeo —
// is an iframe, so nothing ever ended, so the queue never advanced by itself.
//
// The fix is the wire protocol underneath those SDKs rather than the SDKs
// themselves: both YouTube and Vimeo talk postMessage to their own iframe. We
// already have that iframe on the page, so we can speak to it directly. No
// third-party script is loaded, nothing new executes in our page, and the
// sandbox is unchanged — this is strictly two windows exchanging JSON.
//
// SECURITY: a message handler that trusts anything is an open door. Every
// message is checked to have come from THIS iframe's contentWindow AND from
// the exact origin we embedded, before a single field is read.
const YT_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
const VIMEO_ORIGIN = 'https://player.vimeo.com';

export function useEmbedPlayback({ frameRef, source, onEnded, onUnplayable }) {
  const [progress, setProgress] = useState({ time: 0, duration: 0 });
  // Kept in a ref so a changing callback identity doesn't tear down the
  // listener mid-track.
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  // The embed telling us it cannot play this. YouTube's error codes are the
  // only fully reliable signal we get for "removed / embedding disabled /
  // region locked", and they are worth far more than a person noticing: the
  // player finds out on the FIRST play, before anyone has to press a flag.
  //   2   malformed id
  //   5   HTML5 player error
  //   100 removed or private
  //   101/150 the uploader disallowed embedding
  const deadRef = useRef(onUnplayable);
  deadRef.current = onUnplayable;

  const kind = source?.kind;
  const src = source?.src;

  useEffect(() => {
    setProgress({ time: 0, duration: 0 });
    if (kind !== 'youtube' && kind !== 'vimeo') return undefined;
    const frame = frameRef?.current;
    if (!frame) return undefined;

    const origins = kind === 'youtube' ? YT_ORIGINS : [VIMEO_ORIGIN];
    let done = false;

    const onMessage = (e) => {
      if (e.source !== frame.contentWindow) return;      // not our iframe
      if (!origins.includes(e.origin)) return;           // not the host we embedded
      let data = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== 'object') return;

      if (kind === 'youtube') {
        const info = data.info;
        // 0 = ended. Guarded so a replay can't fire it twice.
        if (info && typeof info === 'object') {
          if (typeof info.currentTime === 'number' || typeof info.duration === 'number') {
            setProgress((p) => ({
              time: typeof info.currentTime === 'number' ? info.currentTime : p.time,
              duration: typeof info.duration === 'number' && info.duration > 0 ? info.duration : p.duration,
            }));
          }
          if (info.playerState === 0 && !done) { done = true; endedRef.current?.(); }
          if (typeof info.errorCode === 'number') deadRef.current?.(info.errorCode);
        }
        if (data.event === 'onStateChange' && data.info === 0 && !done) {
          done = true;
          endedRef.current?.();
        }
        // 101 and 150 mean the same thing (embedding disallowed); the pair is
        // a YouTube quirk, not two different faults.
        if (data.event === 'onError') {
          const code = typeof data.info === 'number' ? data.info : Number(data.info);
          if ([2, 5, 100, 101, 150].includes(code)) deadRef.current?.(code);
        }
      } else {
        if (data.event === 'ended' && !done) { done = true; endedRef.current?.(); }
        if (data.event === 'timeupdate' && data.data) {
          setProgress({ time: data.data.seconds || 0, duration: data.data.duration || 0 });
        }
      }
    };

    window.addEventListener('message', onMessage);

    // The handshake. YouTube starts pushing state once it hears "listening";
    // Vimeo needs an explicit subscription per event. The iframe may not have
    // booted yet, so say it a few times rather than once and hope.
    const hello = () => {
      const win = frame.contentWindow;
      if (!win) return;
      try {
        if (kind === 'youtube') {
          win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
        } else {
          win.postMessage(JSON.stringify({ method: 'addEventListener', value: 'ended' }), '*');
          win.postMessage(JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }), '*');
        }
      } catch { /* frame not ready */ }
    };
    hello();
    frame.addEventListener('load', hello);
    const retries = [400, 1200, 2500].map((d) => setTimeout(hello, d));

    return () => {
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('load', hello);
      retries.forEach(clearTimeout);
    };
    // playToken changes when the SAME track is replayed, which remounts the
    // iframe — the handshake has to be redone against the new window.
  }, [kind, src, source?.playToken, frameRef]);

  // ── REAL pause, instead of unmounting ──────────────────────────────────
  // Pausing used to mean setting the source to null, which unmounts the
  // iframe — so resuming started the track over, and in full screen ANY tap
  // (which toggles pause) reset the video. The postMessage channel is already
  // open for progress and `ended`; it takes commands too. Nothing extra is
  // loaded, no vendor SDK, no second connection.
  const command = useCallback((action) => {
    const frame = frameRef?.current;
    if (!frame?.contentWindow) return false;
    try {
      if (kind === 'youtube') {
        frame.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: action === 'pause' ? 'pauseVideo' : 'playVideo',
          args: [],
        }), '*');
        return true;
      }
      if (kind === 'vimeo') {
        frame.contentWindow.postMessage(JSON.stringify({ method: action }), VIMEO_ORIGIN);
        return true;
      }
      if (kind === 'soundcloud') {
        // SoundCloud's widget speaks the same shape on its own origin.
        frame.contentWindow.postMessage(JSON.stringify({
          method: action === 'pause' ? 'pause' : 'play',
        }), 'https://w.soundcloud.com');
        return true;
      }
    } catch { /* frame gone or cross-origin refused */ }
    return false;
  }, [kind, frameRef]);

  // Which embeds can be paused in place. Everything else still has to unmount,
  // which is a worse experience but an honest one — and it is now confined to
  // the platforms that genuinely give us no control channel.
  const canCommand = kind === 'youtube' || kind === 'vimeo' || kind === 'soundcloud';

  return { ...progress, command, canCommand };
}

export default useEmbedPlayback;
