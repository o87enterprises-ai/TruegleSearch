import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VoiceRecognition = ({
  onTranscriptChange,
  onStatusChange,
  disabled = false,
  size = 16,
  className = ""
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const isSupported = useRef('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const isMountedRef = useRef(true); // Track if component is mounted

  useEffect(() => {
    isMountedRef.current = true;

    if (!isSupported.current) {
      console.warn('Speech Recognition is not supported in this browser');
      return;
    }

    // Initialize the speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      if (!isMountedRef.current) return;
      setIsListening(true);
      setIsProcessing(false);
      onStatusChange && onStatusChange('started');
    };

    recognitionRef.current.onresult = (event) => {
      if (!isMountedRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const newTranscript = transcript + interimTranscript;
      setTranscript(newTranscript);

      // Update parent with current transcript
      onTranscriptChange && onTranscriptChange(newTranscript);
    };

    recognitionRef.current.onerror = (event) => {
      if (!isMountedRef.current) return;
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      setIsProcessing(false);
      onStatusChange && onStatusChange('error', event.error);
    };

    recognitionRef.current.onend = () => {
      if (!isMountedRef.current) return;
      setIsListening(false);
      setIsProcessing(false);
      onStatusChange && onStatusChange('stopped');
    };

    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscriptChange, onStatusChange, transcript]);

  const startListening = async () => {
    if (!isSupported.current || disabled || isListening) return;

    try {
      setIsProcessing(true);
      setTranscript('');

      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

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