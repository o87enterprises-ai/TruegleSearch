import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Cross-browser voice search.
 *
 * Records the mic with MediaRecorder — supported in every modern browser,
 * including Firefox and Chromium forks like Kiwi where the Web Speech API is
 * missing or non-functional — then sends the clip to /api/voice/stt for
 * open-source Whisper transcription. The transcript fills the search box; the
 * user reviews it and searches (transcription is post-recording, not live, so
 * we don't auto-submit a possible mis-hear).
 *
 * While recording we show a full-screen overlay with a LIVE waveform (drawn
 * from the actual mic stream via a Web Audio AnalyserNode), so the user can see
 * the service is listening. Capture is VOICE-ACTIVITY based: it keeps listening
 * while you speak and auto-stops 5s after you finish (silence), instead of
 * cutting off at a fixed window. Safety caps: stop if no speech is heard in the
 * first 8s, and a hard 30s ceiling. The user can also stop early.
 */
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const SILENCE_MS = 5000;        // stop this long after speech ends
const INITIAL_SILENCE_MS = 8000; // stop if the user never starts speaking
const MAX_WINDOW_MS = 30000;    // hard ceiling on a single capture
const SPEECH_LEVEL = 0.06;      // peak amplitude (0..1) that counts as speech

// First MediaRecorder mime the browser supports (Chrome/FF → webm, Safari → mp4).
function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

const VoiceRecognition = ({
  onTranscriptChange,
  onStatusChange,
  disabled = false,
  // Open already listening. Set by the home-screen "Talk to Truegle" shortcut
  // (/search?voice=1): the point of that shortcut is that you tap the icon and
  // start speaking — making you find and press the mic afterwards defeats it.
  // Fires once per mount, and never while something else is already recording.
  autoStart = false,
  size = 16,
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SILENCE_MS / 1000);
  const [speaking, setSpeaking] = useState(false);

  // Voice-activity tracking for silence-based auto-stop.
  const startedAtRef = useRef(0);
  const lastSpeechRef = useRef(0);
  const speechStartedRef = useRef(false);

  const isSupported = useRef(
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  );
  const isMountedRef = useRef(true);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const maxTimerRef = useRef(null);
  const countdownRef = useRef(null);
  // Web Audio graph for the live waveform.
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onStatusChangeRef = useRef(onStatusChange);
  onTranscriptChangeRef.current = onTranscriptChange;
  onStatusChangeRef.current = onStatusChange;

  const releaseStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const teardownAudioGraph = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* already closed */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    clearInterval(countdownRef.current);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimeout(maxTimerRef.current);
      teardownAudioGraph();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
      releaseStream();
    };
  }, []);

  // Live-waveform draw loop — reads time-domain data off the AnalyserNode and
  // paints it to the overlay canvas. Started once the analyser + canvas exist.
  const startWaveform = () => {
    const draw = () => {
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      if (!analyser || !canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const bins = analyser.frequencyBinCount;
      const data = new Uint8Array(bins);
      analyser.getByteTimeDomainData(data);

      // Voice-activity detection: peak deviation from the 128 midpoint. Above
      // the threshold counts as speech and resets the silence timer.
      let peak = 0;
      for (let i = 0; i < bins; i++) {
        const dev = Math.abs(data[i] - 128);
        if (dev > peak) peak = dev;
      }
      if (peak / 128 > SPEECH_LEVEL) {
        lastSpeechRef.current = Date.now();
        speechStartedRef.current = true;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#34d399'; // emerald — matches the search theme
      ctx.shadowColor = 'rgba(52, 211, 153, 0.7)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const slice = w / bins;
      let x = 0;
      for (let i = 0; i < bins; i++) {
        const v = data[i] / 128.0; // 0..2, centered at 1
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  };

  const transcribe = async () => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length) {
      setIsProcessing(false);
      return;
    }

    const mime = recorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type: mime });
    // Too small to contain speech (user tapped stop instantly / silence).
    if (blob.size < 1200) {
      setIsProcessing(false);
      onStatusChangeRef.current?.('error', 'no-speech');
      return;
    }

    const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('audio', blob, `voice.${ext}`);

    try {
      const response = await fetch(`${BACKEND}/api/voice/stt`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`STT ${response.status}`);
      const data = await response.json();
      const text = (data.text || '').trim();
      if (!isMountedRef.current) return;
      setIsProcessing(false);
      if (text) {
        onTranscriptChangeRef.current?.(text);
      } else {
        onStatusChangeRef.current?.('error', 'no-speech');
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      setIsProcessing(false);
      onStatusChangeRef.current?.('error', 'network');
    }
  };

  const startRecording = async () => {
    if (disabled || isRecording || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        teardownAudioGraph();
        releaseStream();
        setIsProcessing(true);
        transcribe();
      };
      recorderRef.current = recorder;
      recorder.start();

      // Live-waveform audio graph off the same stream (analyser only — never
      // connected to the destination, so the mic isn't played back to speakers).
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
        startWaveform();
      } catch { /* waveform is cosmetic — recording still works without it */ }

      setIsRecording(true);
      setSpeaking(false);
      setSecondsLeft(SILENCE_MS / 1000);
      onStatusChangeRef.current?.('started');

      // Voice-activity loop: auto-stop 5s after speech ends (or after 8s of
      // never speaking); the waveform loop updates lastSpeechRef.
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      lastSpeechRef.current = startedAt;
      speechStartedRef.current = false;
      countdownRef.current = setInterval(() => {
        const now = Date.now();
        if (now - startedAtRef.current >= MAX_WINDOW_MS) { stopRecording(); return; }
        if (!speechStartedRef.current) {
          setSpeaking(false);
          if (now - startedAtRef.current >= INITIAL_SILENCE_MS) { stopRecording(); return; }
          setSecondsLeft(Math.ceil((INITIAL_SILENCE_MS - (now - startedAtRef.current)) / 1000));
          return;
        }
        const sinceSpeech = now - lastSpeechRef.current;
        setSpeaking(sinceSpeech < 400); // "speaking" if a voice frame landed very recently
        if (sinceSpeech >= SILENCE_MS) { stopRecording(); return; }
        setSecondsLeft(Math.ceil((SILENCE_MS - sinceSpeech) / 1000));
      }, 200);

      // Hard safety ceiling in case the interval is throttled (backgrounded tab).
      maxTimerRef.current = setTimeout(() => stopRecording(), MAX_WINDOW_MS);
    } catch (error) {
      teardownAudioGraph();
      releaseStream();
      setIsRecording(false);
      const code = error?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture';
      onStatusChangeRef.current?.('error', code);
    }
  };

  const stopRecording = () => {
    clearTimeout(maxTimerRef.current);
    clearInterval(countdownRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    setIsRecording(false);
  };

  const toggle = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // A gesture-less getUserMedia is allowed when the permission has already been
  // granted; the first time, the browser prompts, which is the correct
  // behaviour for a shortcut the user deliberately tapped.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || disabled) return;
    autoStarted.current = true;
    startRecording();
    // startRecording is recreated each render; the ref guard is what makes
    // this run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, disabled]);

  const renderIcon = () => {
    if (isProcessing) return <Loader2 size={size} className="animate-spin" />;
    if (isRecording) return <Square size={size} />;
    return <Mic size={size} />;
  };

  // No MediaRecorder / getUserMedia (rare, very old browsers) — hide the mic
  // rather than show a control that can't work.
  if (!isSupported.current) return null;

  return (
    <div className={`relative ${className}`}>
      <motion.button
        type="button"
        onClick={toggle}
        disabled={disabled || isProcessing}
        className={`
          flex items-center justify-center
          p-1 rounded-full transition-all duration-200
          ${disabled || isProcessing
            ? 'text-gray-500 cursor-not-allowed'
            : isRecording
              ? 'text-red-500 hover:bg-red-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }
        `}
        whileHover={!disabled && !isProcessing ? { scale: 1.1 } : {}}
        whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
        aria-label={isRecording ? 'Stop recording' : 'Start voice search'}
      >
        {renderIcon()}
      </motion.button>

      {/* Full-screen recording overlay with live waveform + countdown, so the
          user has clear feedback that the mic is live and working. The whole
          AnimatePresence is portalled to <body> so `fixed inset-0` truly covers
          the viewport — inside the hero's transformed/filtered ancestors it
          would otherwise be a cramped box. (Portal must wrap AnimatePresence,
          not sit inside it, or AnimatePresence won't track/render the child.) */}
      {createPortal(
        <AnimatePresence>
          {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6"
            onClick={stopRecording}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg font-semibold tracking-wide">{speaking ? 'Listening…' : 'Waiting for speech…'}</span>
              </div>

              <canvas
                ref={canvasRef}
                width={480}
                height={140}
                className="w-full h-32 rounded-2xl bg-white/[0.03] border border-emerald-500/20"
              />

              <div className="text-emerald-300/80 text-sm">
                {speaking
                  ? 'Keep talking — auto-stops 5s after you finish'
                  : <>Auto-stops in <span className="font-bold text-emerald-300">{secondsLeft}s</span></>}
              </div>

              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/90 hover:bg-red-500 text-white font-semibold transition-colors"
              >
                <Square size={16} /> Stop
              </button>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default VoiceRecognition;
