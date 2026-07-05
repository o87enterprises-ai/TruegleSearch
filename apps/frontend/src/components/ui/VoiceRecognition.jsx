import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VoiceRecognition = ({
  onTranscriptChange,
  onStatusChange,
  disabled = false,
  size = 16,
  className = "",
  lang,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const isSupported = useRef('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const isMountedRef = useRef(true);
  const transcriptRef = useRef('');
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep refs in sync without triggering re-initialization
  onTranscriptChangeRef.current = onTranscriptChange;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    isMountedRef.current = true;

    if (!isSupported.current) {
      console.warn('Speech Recognition is not supported in this browser');
      return;
    }

    // Initialize the speech recognition once
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    // Default to the browser's language so non-English users are transcribed
    // correctly; callers can override via the `lang` prop.
    recognitionRef.current.lang = lang || navigator.language || 'en-US';

    recognitionRef.current.onstart = () => {
      if (!isMountedRef.current) return;
      setIsListening(true);
      setIsProcessing(false);
      onStatusChangeRef.current?.('started');
    };

    recognitionRef.current.onresult = (event) => {
      if (!isMountedRef.current) return;

      // Final results must be appended to the accumulated transcript; interim
      // results are only for live display. The previous code dropped finals and
      // re-stored interims into the ref, so finished words were lost/garbled.
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const display = (transcriptRef.current + interimTranscript).trimStart();
      setTranscript(display);
      onTranscriptChangeRef.current?.(display);
    };

    recognitionRef.current.onerror = (event) => {
      if (!isMountedRef.current) return;
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      setIsProcessing(false);
      onStatusChangeRef.current?.('error', event.error);
    };

    recognitionRef.current.onend = () => {
      if (!isMountedRef.current) return;
      setIsListening(false);
      setIsProcessing(false);
      onStatusChangeRef.current?.('stopped');
    };

    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // Run once on mount only

  const startListening = async () => {
    if (!isSupported.current || disabled || isListening) return;

    try {
      setIsProcessing(true);
      setTranscript('');
      transcriptRef.current = '';

      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately release the tracks — we only needed the permission grant;
      // SpeechRecognition opens its own capture. Leaving them live keeps the
      // mic held (and the OS mic indicator on) for the page's lifetime.
      stream.getTracks().forEach((t) => t.stop());

      recognitionRef.current.start();
      onStatusChange && onStatusChange('starting');
    } catch (error) {
      console.error('Microphone access denied:', error);
      setIsProcessing(false);
      onStatusChange && onStatusChange('error', error.message);
    }
  };

  const stopListening = () => {
    if (!isSupported.current || !recognitionRef.current) return;

    recognitionRef.current.stop();
    setIsProcessing(false);
    setIsListening(false);

    // Update final transcript
    if (transcript) {
      onTranscriptChange && onTranscriptChange(transcript);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Determine the icon to show based on state
  const renderIcon = () => {
    if (isProcessing) {
      return <Loader2 size={size} className="animate-spin" />;
    }
    if (isListening) {
      return <Square size={size} />;
    }
    return <Mic size={size} />;
  };

  // Determine the button state
  const buttonState = isListening ? 'stop' : 'start';

  // No Web Speech API (Firefox-family mobile, some WebViews) — render nothing
  // rather than a mic that silently does nothing on tap.
  if (!isSupported.current) return null;

  return (
    <div className={`relative ${className}`}>
      <motion.button
        type="button"
        onClick={toggleListening}
        disabled={disabled || isProcessing}
        className={`
          flex items-center justify-center
          p-1 rounded-full transition-all duration-200
          ${disabled || isProcessing
            ? 'text-gray-500 cursor-not-allowed'
            : isListening
              ? 'text-red-500 hover:bg-red-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }
        `}
        whileHover={!disabled && !isProcessing ? { scale: 1.1 } : {}}
        whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
        aria-label={isListening ? 'Stop listening' : 'Start voice search'}
      >
        {renderIcon()}
      </motion.button>

      {/* Visual feedback when listening */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute -inset-2 rounded-full border-2 border-red-500/50"
            style={{
              boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.3)',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceRecognition;