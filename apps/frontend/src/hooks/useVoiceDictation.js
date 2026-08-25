import { useCallback, useEffect, useRef, useState } from 'react';
import { compileSpelling, compileDictation, modeTrigger } from '../utils/spellingMode';

/* ── Speaking a search while something is playing ───────────────────────────
 *
 * "Holding down this button dims music (keeps playing in background and doesn't
 * lose place) while the user speaks what they want to hear next."
 *
 * WHAT IT RUNS ON, and why it costs nothing: the Web Speech API, which is built
 * into the browser. On Android Chrome and desktop Chrome/Edge it is present and
 * free. No key, no quota, no request of ours leaves the device for the
 * recognition itself. (The browser may use a cloud recogniser — that is the
 * platform's business and the user's platform choice; we neither send nor
 * receive it.) Safari/Firefox do not implement it, which is why `supported` is
 * part of the contract: a microphone button that does nothing is worse than no
 * microphone button, so the caller hides it rather than showing a dead control.
 *
 * DUCKING, not pausing. The ask is explicit — "keeps playing in background and
 * doesn't lose place" — so the volume drops and the media node is never
 * touched. Pausing an embed and resuming it is the thing that loses your place;
 * lowering a number does not. The previous volume is captured on the way in and
 * restored on the way out, including when recognition dies unexpectedly, or a
 * hold that ends badly would leave the music quiet forever.
 *
 * TWO MODES, one microphone. Plain dictation is right for "play some jazz";
 * spelling is right for an artist name a language model will confidently
 * improve into something else. Saying "spelling" switches, so the mode is
 * reachable with hands on a steering wheel — see utils/spellingMode.
 */

const DUCK_TO = 0.12;      // audible enough to know it is still there
const DUCK_MS = 180;       // fade, rather than a step, so it does not click

function getRecognition() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useVoiceDictation({
  // Called with the running text every time it changes, so the caller can show
  // it as it is spoken rather than only at the end.
  onText,
  // Called when the user says a control word: 'submit' | 'stop' | 'cancel'.
  onAction,
  // Volume control, so the music can duck. Both are supplied by the caller
  // because the player owns its own volume and this hook must not import it.
  getVolume,
  setVolume,
  lang = 'en-US',
} = {}) {
  const [listening, setListening] = useState(false);
  const [spelling, setSpelling] = useState(false);
  const [heard, setHeard] = useState('');     // the live partial, for display
  const [error, setError] = useState(null);
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  });

  const recRef = useRef(null);
  const textRef = useRef('');
  const duckedFrom = useRef(null);
  const spellingRef = useRef(false);
  const fadeRef = useRef(null);
  // Callbacks live in refs so the recognition handlers, which are bound once,
  // always see the current ones without the recogniser being torn down and
  // rebuilt on every render.
  const cbs = useRef({ onText, onAction, getVolume, setVolume });
  cbs.current = { onText, onAction, getVolume, setVolume };

  useEffect(() => { spellingRef.current = spelling; }, [spelling]);

  // ── Ducking ───────────────────────────────────────────────────────────────
  const fadeTo = useCallback((target) => {
    const { getVolume: gv, setVolume: sv } = cbs.current;
    if (!sv) return;
    cancelAnimationFrame(fadeRef.current);
    const from = typeof gv === 'function' ? (gv() ?? 1) : 1;
    const began = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - began) / DUCK_MS);
      sv(from + (target - from) * t);
      if (t < 1) fadeRef.current = requestAnimationFrame(step);
    };
    fadeRef.current = requestAnimationFrame(step);
  }, []);

  const duck = useCallback(() => {
    const { getVolume: gv } = cbs.current;
    // Only capture the level ONCE per hold. Capturing again mid-duck would
    // record the ducked value as "normal" and restore to a whisper.
    if (duckedFrom.current === null) {
      duckedFrom.current = typeof gv === 'function' ? (gv() ?? 1) : 1;
    }
    fadeTo(DUCK_TO);
  }, [fadeTo]);

  const unduck = useCallback(() => {
    if (duckedFrom.current === null) return;
    const back = duckedFrom.current;
    duckedFrom.current = null;
    fadeTo(back);
  }, [fadeTo]);

  // ── Start / stop ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      // Unbind before stopping: onend fires during stop() and would otherwise
      // re-enter this and unduck twice.
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.stop(); } catch { /* already dead */ }
    }
    setListening(false);
    unduck();
  }, [unduck]);

  const start = useCallback((initialText = '') => {
    if (!supported || recRef.current) return false;
    const rec = getRecognition();
    if (!rec) return false;

    textRef.current = initialText;
    setHeard('');
    setError(null);

    rec.lang = lang;
    rec.continuous = true;
    // Partial results are what make it feel alive: without them nothing appears
    // until the speaker stops, and a silent box reads as a broken microphone.
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (!result.isFinal) { setHeard(transcript); continue; }
        setHeard('');

        // "spelling" / "stop spelling" switch modes mid-utterance, so the mode
        // is reachable without a button — which is the entire point on a phone
        // mounted on a dashboard.
        const trigger = modeTrigger(transcript);
        if (trigger) { setSpelling(trigger === 'spell'); continue; }

        const compile = spellingRef.current ? compileSpelling : compileDictation;
        const { text, action } = compile(transcript, textRef.current);
        textRef.current = text;
        cbs.current.onText?.(text);
        if (action) cbs.current.onAction?.(action, text);
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are ordinary: someone held the button and
      // said nothing, or let go. Surfacing those as errors would put a red
      // message under every mis-press.
      if (e?.error === 'no-speech' || e?.error === 'aborted') return;
      setError(e?.error === 'not-allowed'
        ? 'Microphone permission was refused.'
        : 'The microphone stopped unexpectedly.');
      stop();
    };

    // The recogniser can end on its own — a long pause, the tab losing focus.
    // Whatever the reason, the music must come back up.
    rec.onend = () => { if (recRef.current === rec) stop(); };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setError('The microphone could not be started.');
      return false;
    }
    setListening(true);
    duck();
    return true;
  }, [supported, lang, duck, stop]);

  // Leaving the screen with the microphone open must not leave the music
  // ducked — this is the failure that ends with someone thinking playback
  // broke.
  useEffect(() => () => {
    cancelAnimationFrame(fadeRef.current);
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null; rec.onerror = null; rec.onend = null;
      try { rec.stop(); } catch { /* already dead */ }
    }
    recRef.current = null;
    if (duckedFrom.current !== null) {
      cbs.current.setVolume?.(duckedFrom.current);
      duckedFrom.current = null;
    }
  }, []);

  return {
    supported,
    listening,
    spelling,
    setSpelling,
    heard,
    error,
    start,
    stop,
    /** The text built so far this session — for a caller that mounts late. */
    peek: () => textRef.current,
  };
}

export default useVoiceDictation;
