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
// TikTok's EMBED PLAYER (www.tiktok.com/player/v1/<id>), not the old /embed/v2
// card. The card had no control channel at all: it autoplayed muted and nothing
// outside it could unmute, pause or play it — owner, 2026-10-06: "no audio
// plays out loud upon start and there's no way to push play or pause once the
// video begins". The v1 player speaks postMessage, documented at
// developers.tiktok.com/doc/embed-player: every message, both ways, is an
// object tagged 'x-tiktok-player': true with a `type` and a `value`.
export const TIKTOK_ORIGIN = 'https://www.tiktok.com';
const tiktokMsg = (type, value) => ({ 'x-tiktok-player': true, type, ...(value === undefined ? {} : { value }) });

// A SILENT EMBED IS A DEAD ONE. Some clips (region-blocked news, "This content
// isn't available") never start YouTube's player API at all: the frame shows
// its own error page and posts NOT ONE message — a working video posts its
// first within a second or two. Those clips have no error code to react to, so
// without this the player sat on a dead frame forever (seen on the live site,
// 2026-09-29, on news clips). After this long with nothing heard from a frame
// on a visible tab, the clip is reported unplayable and the run moves on.
//
// THE CLOCK STARTS WHEN THE FRAME HAS LOADED, NOT WHEN IT WAS MOUNTED. It used
// to start at mount, and on a phone connection YouTube's player can take well
// over fifteen seconds just to download — so good videos were skipped every
// fifteen seconds, which is what "Tube changes tracks at random" was
// (2026-10-01, reproduced at phone speed). A dead clip's error page loads
// quickly, so it is still caught; a slow network only delays the load, and
// a frame that never loads is never judged.
//
// 25s, measured not guessed: on a throttled phone profile the real YouTube
// player posted its first message about 23 seconds after the frame mounted —
// far past the 10s this used to be, which skipped a healthy clip 10 seconds
// into the Feed (owner, 2026-10-01: "glitched forward about 10 secs after
// starting the video; played fine the second time"). The price is that a
// truly dead, silent clip now takes 25s to move on; clips that report an
// error (the common dead kind) are still skipped at once.
export const SILENT_EMBED_MS = 25000;
// How often to repeat the handshake until the frame answers. YouTube's own
// iframe API does the same: its player only hears "listening" once it has
// booted, and on a slow phone that is long after any fixed retry schedule.
export const HELLO_EVERY_MS = 1000;

/**
 * The wire messages that set the volume on a given platform.
 *
 * Pure and exported so the exact shape can be tested without a browser: this is
 * a wire protocol, the platforms are unforgiving about it, and a typo here
 * fails silently — the embed simply ignores a message it does not recognise,
 * which looks identical to the control not being wired up at all.
 *
 * `level` is 0..1 for every caller; the per-platform scale is this function's
 * problem, not the player's.
 */
export function volumeCommands(kind, level) {
  const v = Math.max(0, Math.min(1, Number(level) || 0));
  if (kind === 'youtube') {
    // MUTE STATE FIRST. A muted YouTube embed ignores setVolume outright, and
    // autoplayed clips start muted by browser policy — so without this, dragging
    // up from zero on the thing that just autoplayed did nothing whatsoever.
    return [
      { targetOrigin: '*', payload: { event: 'command', func: v > 0 ? 'unMute' : 'mute', args: [] } },
      { targetOrigin: '*', payload: { event: 'command', func: 'setVolume', args: [Math.round(v * 100)] } },
    ];
  }
  if (kind === 'vimeo') {
    return [{ targetOrigin: VIMEO_ORIGIN, payload: { method: 'setVolume', value: v } }];
  }
  if (kind === 'soundcloud') {
    return [{ targetOrigin: 'https://w.soundcloud.com', payload: { method: 'setVolume', value: Math.round(v * 100) } }];
  }
  if (kind === 'tiktok') {
    // TikTok takes mute/unMute only — no level. Sent as an object, not JSON.
    return [{ targetOrigin: TIKTOK_ORIGIN, payload: tiktokMsg(v > 0 ? 'unMute' : 'mute'), raw: true }];
  }
  return [];
}

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
  // The level the player last asked for, so a TikTok that boots after the
  // player's own retries (they stop at 2s) still gets it the moment it says
  // it is ready. null = never set = sound on, which is the point of the fix.
  const volumeRef = useRef(null);

  useEffect(() => {
    setProgress({ time: 0, duration: 0 });
    if (kind !== 'youtube' && kind !== 'vimeo' && kind !== 'tiktok') return undefined;
    const frame = frameRef?.current;
    if (!frame) return undefined;

    const origins = kind === 'youtube' ? YT_ORIGINS : kind === 'tiktok' ? [TIKTOK_ORIGIN] : [VIMEO_ORIGIN];
    let done = false;
    let heard = false;

    const onMessage = (e) => {
      if (e.source !== frame.contentWindow) return;      // not our iframe
      if (!origins.includes(e.origin)) return;           // not the host we embedded
      heard = true;                                       // the frame is alive
      let data = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== 'object') return;

      if (kind === 'tiktok') {
        if (data['x-tiktok-player'] !== true) return;
        const { type, value } = data;
        if (type === 'onPlayerReady') {
          // Sound on (or whatever the player's level is) and play. Autoplay in
          // a frame is muted by browser policy until told otherwise; the frame
          // has allow="autoplay" and the person already tapped to start this,
          // so the unmute is permitted.
          const vol = volumeRef.current;
          try {
            frame.contentWindow.postMessage(tiktokMsg(vol === 0 ? 'mute' : 'unMute'), TIKTOK_ORIGIN);
            frame.contentWindow.postMessage(tiktokMsg('play'), TIKTOK_ORIGIN);
          } catch { /* frame gone */ }
        }
        if (type === 'onStateChange' && value === 0 && !done) { done = true; endedRef.current?.(); }
        if (type === 'onCurrentTime' && value && typeof value === 'object') {
          setProgress((p) => ({
            time: typeof value.currentTime === 'number' ? value.currentTime : p.time,
            duration: typeof value.duration === 'number' && value.duration > 0 ? value.duration : p.duration,
          }));
        }
        if (type === 'onPlayerError') deadRef.current?.(value?.errorCode ?? 'tiktok');
        return;
      }

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

    // The silence watchdog, armed once the frame has LOADED (see the note on
    // SILENT_EMBED_MS). PlayerScreen stamps data-loaded from React's onLoad,
    // which is attached before the frame starts loading, so a load that beat
    // this effect is not missed. A hidden tab throttles frames, so a quiet
    // embed in the background proves nothing: re-arm instead of judging it.
    let watchdog = null;
    const arm = (ms) => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (heard || done) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') { arm(3000); return; }
        done = true;
        deadRef.current?.('silent');
      }, ms);
    };
    // Not for TikTok: its silence is not yet measured the way YouTube's was,
    // and a wrong guess here skips good clips. It reports real errors itself.
    const onLoad = () => { if (kind !== 'tiktok') arm(SILENT_EMBED_MS); };
    if (frame.dataset?.loaded) onLoad();
    frame.addEventListener('load', onLoad);

    // The handshake. YouTube starts pushing state once it hears "listening";
    // Vimeo needs an explicit subscription per event. The iframe may not have
    // booted yet, so keep saying it until something comes back.
    const hello = () => {
      const win = frame.contentWindow;
      if (!win || kind === 'tiktok') return; // TikTok announces itself (onPlayerReady)
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
    // Until it answers — then stop; the channel is open.
    const repeat = setInterval(() => { if (heard || done) clearInterval(repeat); else hello(); }, HELLO_EVERY_MS);

    return () => {
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('load', hello);
      frame.removeEventListener('load', onLoad);
      clearInterval(repeat);
      clearTimeout(watchdog);
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
      if (kind === 'tiktok') {
        frame.contentWindow.postMessage(tiktokMsg(action === 'pause' ? 'pause' : 'play'), TIKTOK_ORIGIN);
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

  // ── VOLUME, on the same channel ────────────────────────────────────────
  // WHY THE APP OWNS THE VOLUME. Every platform puts its own volume control
  // somewhere different, and inside a 9:16 reel or a docked strip half of them
  // are off-screen or too small to hit — so "turn it down" meant hunting for a
  // different control depending on what happened to be playing. One control in
  // one place, speaking the channel that is already open.
  //
  // The scale is 0..1 here and converted per platform, because that is the only
  // way callers do not have to know which platform is playing: YouTube counts
  // 0-100, Vimeo 0-1.
  const setVolume = useCallback((level) => {
    const frame = frameRef?.current;
    if (!frame?.contentWindow) return false;
    volumeRef.current = Math.max(0, Math.min(1, Number(level) || 0));
    const msgs = volumeCommands(kind, level);
    if (!msgs.length) return false;
    try {
      for (const m of msgs) frame.contentWindow.postMessage(m.raw ? m.payload : JSON.stringify(m.payload), m.targetOrigin);
      return true;
    } catch { /* frame gone or cross-origin refused */ }
    return false;
  }, [kind, frameRef]);

  // ── SEEK, on the same channel ──────────────────────────────────────────
  // Both platforms take an ABSOLUTE target, not a delta, so a relative jump
  // needs to know where we are. `progress.time` already does, because the
  // progress listener above is running for exactly these two kinds — no extra
  // subscription, no polling.
  //
  // Mirrored into a ref so `seek` keeps a stable identity: it is wired into a
  // gesture handler, and a callback that changes on every timeupdate would
  // rebind the touch listeners several times a second.
  const timeRef = useRef(0);
  timeRef.current = progress.time;
  const durationRef = useRef(0);
  durationRef.current = progress.duration;

  const seek = useCallback((delta) => {
    const frame = frameRef?.current;
    if (!frame?.contentWindow) return null;
    const dur = durationRef.current;
    // Clamp short of the end rather than at it: seeking exactly to duration
    // fires `ended` and advances the queue, which is not what "forward ten
    // seconds" means to anyone.
    const target = Math.max(0, dur > 0 ? Math.min(timeRef.current + delta, dur - 0.5) : timeRef.current + delta);
    try {
      if (kind === 'youtube') {
        frame.contentWindow.postMessage(JSON.stringify({
          event: 'command', func: 'seekTo', args: [target, true],
        }), '*');
      } else if (kind === 'vimeo') {
        frame.contentWindow.postMessage(JSON.stringify({
          method: 'setCurrentTime', value: target,
        }), VIMEO_ORIGIN);
      } else if (kind === 'tiktok') {
        frame.contentWindow.postMessage(tiktokMsg('seekTo', target), TIKTOK_ORIGIN);
      } else {
        return null;
      }
      // Move the play head now instead of waiting for the embed to report
      // back. The next timeupdate corrects it; without this the bar sits still
      // for a beat after a jump, which reads as the jump not working.
      setProgress((p) => ({ ...p, time: target }));
      return target;
    } catch { /* frame gone or cross-origin refused */ }
    return null;
  }, [kind, frameRef]);

  // Which embeds can be paused in place. Everything else still has to unmount,
  // which is a worse experience but an honest one — and it is now confined to
  // the platforms that genuinely give us no control channel.
  const canCommand = kind === 'youtube' || kind === 'vimeo' || kind === 'soundcloud' || kind === 'tiktok';
  // SoundCloud is deliberately absent: its widget can seek, but we never
  // subscribed to its progress, so we would be jumping from a position we do
  // not know. Better to offer no jump than a jump to the wrong place.
  const canSeek = kind === 'youtube' || kind === 'vimeo' || kind === 'tiktok';
  // Native <audio>/<video> are absent on purpose: they have a real `.volume`
  // and the player sets it on the element directly. This is only for the
  // embeds, which have no element to reach.
  const canSetVolume = canCommand;

  return { ...progress, command, canCommand, seek, canSeek, setVolume, canSetVolume };
}

export default useEmbedPlayback;
