import { useEffect, useRef } from 'react';
import { posterFor } from '../utils/postShape';

// BLUETOOTH, HEADSET, CAR AND LOCK-SCREEN CONTROLS → THE TRUEGLE PLAYER
// (owner, 2026-11-08: "make sure Bluetooth controls make it to the player").
//
// Every one of those buttons arrives in the browser as a Media Session action
// (play, pause, previoustrack, nexttrack). Until now only NATIVE audio/video
// files registered for them. A YouTube, Vimeo or Rumble clip — nearly
// everything that plays here — plays inside a cross-origin iframe whose media
// belongs to that iframe, so a headset's next/previous button never reached
// Truegle's queue at all, and the lock screen showed the embed's own title.
//
// WHAT THIS DOES
//   • Native audio/video: unchanged — the handlers drive the element directly.
//   • Everything else: the handlers drive the PLAYER'S STATE (setPaused, the
//     queue's next/previous), which is what the on-screen buttons already do;
//     TrueglePlayer carries that out to the embed. So a headset press and a
//     tap on the player are the same event.
//   • The lock screen shows OUR title, channel and picture, and the right
//     paused/playing state.
//
// THE KEEP-ALIVE. A browser only routes those buttons to the page that owns
// the media session, and for an embed the audible media is in the iframe, not
// in this document. So while an embed is playing, the page plays a looping,
// perfectly silent audio element of its own (a few hundred bytes, inline). It
// is paused whenever the player is, and removed when the player closes, so it
// never makes a paused or empty tab look like it is playing. It costs nothing
// to hear — it is silence — and it is what lets this document hold the
// session.
//
// WHAT THIS CANNOT PROMISE. Which of the page and the iframe a given browser
// or phone hands the buttons to is that platform's call and differs between
// Chrome, Safari and each OS's lock screen. This registers everything the page
// can legitimately register; it cannot be proven from a laptop, only on a
// handset with a headset.

// 1 second of 8 kHz, 8-bit mono silence as a WAV, built once.
function silentWav() {
  const samples = 8000;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); view.setUint32(4, 36 + samples, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); str(36, 'data'); view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is 128, not 0
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const isNativeKind = (c) => !!c && (c.kind === 'audio' || c.kind === 'video');

export function useMediaSessionBridge({ current, paused, canPrev, onPrev, onNext, setPaused, nativeRef }) {
  const keepRef = useRef(null);
  const wantPlay = useRef(false);

  // ── what the lock screen shows, and what the buttons do ───────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    const set = (act, fn) => { try { ms.setActionHandler(act, fn); } catch { /* action not supported here */ } };
    const clear = () => { ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((a) => set(a, null)); };
    if (!current) {
      try { ms.metadata = null; } catch { /* noop */ }
      clear();
      return undefined;
    }

    const native = isNativeKind(current);
    try {
      const poster = posterFor({ thumbnail: current.poster }, current);
      ms.metadata = new window.MediaMetadata({
        title: current.title || 'Truegle',
        artist: current.channel || 'Truegle',
        artwork: poster ? [{ src: poster }] : [],
      });
    } catch { /* MediaMetadata unsupported */ }

    set('play', () => { if (native) nativeRef?.current?.play?.(); else setPaused(false); });
    set('pause', () => { if (native) nativeRef?.current?.pause?.(); else setPaused(true); });
    set('previoustrack', canPrev ? onPrev : null);
    set('nexttrack', onNext);
    return clear;
  }, [current, canPrev, onPrev, onNext, setPaused, nativeRef]);

  // The state the lock screen draws the play/pause button from.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = !current ? 'none' : (paused ? 'paused' : 'playing'); } catch { /* noop */ }
  }, [current, paused]);

  // ── the keep-alive: only for embeds, only while they play ────────────────
  const needsKeepAlive = !!current && !isNativeKind(current);
  wantPlay.current = needsKeepAlive && !paused;

  useEffect(() => {
    if (typeof document === 'undefined' || typeof Audio === 'undefined') return undefined;
    if (!needsKeepAlive) { keepRef.current?.pause(); return undefined; }

    let el = keepRef.current;
    if (!el) {
      el = new Audio(silentWav());
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('data-media-keepalive', '');
      el.style.display = 'none';
      document.body.appendChild(el);
      keepRef.current = el;
    }

    const events = ['pointerdown', 'touchend', 'keydown', 'click'];
    let armed = false;
    const retry = () => {
      events.forEach((e) => document.removeEventListener(e, retry, true));
      armed = false;
      if (wantPlay.current) el.play().catch(() => {});
    };
    if (paused) {
      el.pause();
    } else {
      el.play().catch(() => {
        // A browser that wants a tap before it will play any sound (iOS, and
        // Chrome before the first interaction): try again on the next one.
        if (armed) return;
        armed = true;
        events.forEach((e) => document.addEventListener(e, retry, true));
      });
    }
    return () => { events.forEach((e) => document.removeEventListener(e, retry, true)); };
  }, [needsKeepAlive, paused]);

  // Gone with the player, so nothing is left holding the tab's audio.
  useEffect(() => () => {
    const el = keepRef.current;
    if (el) { el.pause(); el.remove(); keepRef.current = null; }
  }, []);
}

export default useMediaSessionBridge;
