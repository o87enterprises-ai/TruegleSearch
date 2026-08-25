import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

const GuidanceAgent = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });

  // Speech recognition setup (using browser native API)
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const browserSupportsSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const resetTranscript = () => {
    setTranscript('');
  };

  useEffect(() => {
    if (browserSupportsSpeechRecognition) {
      setIsListening(listening);

      // Initialize speech recognition if supported
      if ('webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');

          setTranscript(transcript);
        };

        recognition.onend = () => {
          if (listening) {
            recognition.start();
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        if (listening) {
          recognition.start();
        } else {
          recognition.stop();
        }

        // Cleanup function
        return () => {
          recognition.stop();
        };
      }
    }
  }, [listening, browserSupportsSpeechRecognition]);

  // Voice search functionality is now handled by the button click

  // On-screen guidance
  const guidanceMessages = [
    'Try searching for unbiased news sources',
    'Use voice search by clicking the microphone',
    // Was 'Enable VPN for private browsing' — there is no VPN to enable
    // (see ShareForPremiumButton). Replaced with something Truegle does.
    'Truegle sets no cookies — nothing to accept, nothing to clear',
    'Check bias analysis for different perspectives',
  ];

  const getRandomGuidance = () => {
    return guidanceMessages[
      Math.floor(Math.random() * guidanceMessages.length)
    ];
  };

  // Draggable positioning
  const handleMouseDown = (e) => {
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - startX,
        y: e.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized ? 'w-12 h-12' : 'w-80 h-96'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        background: 'rgba(17, 24, 39, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
      }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center p-2 border-b border-purple-500/20 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-purple-300 text-xs font-medium">
            Truegle Assistant
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3 space-y-3">
          {/* Voice Input */}
          {browserSupportsSpeechRecognition && (
            <div className="space-y-2">
              <button
                onClick={async () => {
                if (isListening) {
                  setListening(false);
                  // Perform search with the transcript
                  if (transcript.trim()) {
                    try {
                      const response = await api.post('/search', { query: transcript });
                      setResult(response.data);
                      setQuery(transcript);
                    } catch (error) {
                      console.error('Voice search failed:', error);
                    }
                  }
                  resetTranscript();
                } else {
                  setListening(true);
                }
              }}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
                }`}
              >
                {isListening ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <span>Listening...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 text-purple-400">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M7 4a3 3 0 016 0v1a1 1 0 002 0V4a3 3 0 016 0v1a1 1 0 002 0V4zM5.5 9.643a.75.75 0 00-.695.47l-2.5 1.75a.75.75 0 01-.695-.47l1.25-.875V14.5a.5.5 0 001 0v-8.282l1.25.875zm4.5.0a1.5 1.5 0 00-3 0v10.5a1.5 1.5 0 003 0V9.5z"
                        />
                      </svg>
                    </div>
                    <span>Click to Search</span>
                  </div>
                )}
              </button>
              {transcript && (
                <div className="text-xs text-purple-400 italic">
                  "{transcript}"
                </div>
              )}
            </div>
          )}

          {/* Quick Guidance */}
          <div className="space-y-2">
            <div className="text-xs text-purple-300 font-medium mb-2">
              💡 Quick Tips:
            </div>
            <div className="text-xs text-purple-400 bg-purple-900/30 p-2 rounded-lg">
              {getRandomGuidance()}
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask me anything..."
              className="w-full px-3 py-2 bg-purple-900/30 border border-purple-500/20 rounded-lg text-purple-200 text-sm placeholder-purple-500 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30"
            />
            <button
              onClick={async () => {
                try {
                  const response = await api.post('/search', { query });
                  setResult(response.data);
                } catch (error) {
                  console.error('Search failed:', error);
                }
              }}
              className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Search with Guidance
            </button>
          </div>

          {/* Privacy Notice */}
          <div className="text-xs text-purple-500 bg-purple-900/20 p-2 rounded border border-purple-500/20">
            🔒 Your searches are private and never stored
          </div>
        </div>
      )}

      {/* Minimized State */}
      {isMinimized && (
        <div className="flex items-center justify-center h-full">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
};

export default GuidanceAgent;
