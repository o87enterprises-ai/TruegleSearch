import { useState, useEffect, useRef } from 'react';
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
 */
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const MAX_RECORDING_MS = 15000;

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
  size = 16,
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimeout(maxTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
      releaseStream();
    };
  }, []);

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
        releaseStream();
        setIsProcessing(true);
        transcribe();
      };
      recorderRef.current = recorder;
      recorder.start();

      setIsRecording(true);
      onStatusChangeRef.current?.('started');

      // Safety cap so a forgotten recording can't run forever.
      maxTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORDING_MS);
    } catch (error) {
      releaseStream();
      setIsRecording(false);
      const code = error?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture';
      onStatusChangeRef.current?.('error', code);
    }
  };

  const stopRecording = () => {
    clearTimeout(maxTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    setIsRecording(false);
  };

  const toggle = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

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

      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute -inset-2 rounded-full border-2 border-red-500/50 pointer-events-none"
            style={{ boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.3)' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceRecognition;
