import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  LogIn,
} from 'lucide-react';
import AdBanner from './AdBanner';
import { aiAPI } from '../../services/api';
import { FREE_ACCESS_MODE } from '../../config/access';

// Map frontend mode strings to backend context strings
const MODE_TO_CONTEXT = {
  blue: 'search_results',
  green: 'search_results',
  red: 'red_pill',
  purple: 'biased_results',
  ocean: 'osint',
};

const MODE_WELCOME = {
  blue: 'Ask me anything about your search results.',
  green: 'Ask me anything about your search results.',
  red: 'I specialize in alternative and suppressed perspectives. What do you want to dig into?',
  purple: 'I\'ll analyze this topic strictly through your selected bias lenses. What would you like to explore?',
  ocean: 'OSINT assistant ready. I can guide you through digital investigations, suggest data sources, and help correlate findings.',
};

export default function AIChatOverlay({
  isOpen,
  onClose,
  initialSummary,
  mode = 'blue', // 'blue' | 'red' | 'purple' | 'ocean'
  context, // deprecated — use mode instead
  themeColor = 'red'
}) {
  const navigate = useNavigate();
  const resolvedMode = mode || 'blue';
  const resolvedContext = MODE_TO_CONTEXT[resolvedMode] || 'search_results';
  const isAuthed = !!localStorage.getItem('truegle_token');

  const welcomeContent = initialSummary || MODE_WELCOME[resolvedMode] || MODE_WELCOME.blue;

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: welcomeContent,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adKey, setAdKey] = useState(0);
  const messagesEndRef = useRef(null);

  // Theme color mappings for different modes
  const getColors = () => {
    if (themeColor === 'red') {
      return {
        border: 'border-red-500/50',
        borderHover: 'hover:border-red-500/30',
        bg: 'bg-red-500/10',
        bgGradient: 'from-red-500/10 to-red-600/10',
        gradient: 'from-red-500 to-red-600',
        gradientHover: 'hover:from-red-400 hover:to-red-500',
        text: 'text-red-400',
        textHover: 'hover:text-red-300',
        shadow: 'shadow-red-500/25',
        shadowLg: 'shadow-red-500/50',
        messageBorder: 'border-red-500/50',
        userBg: 'from-red-500/20 to-red-500/20',
        assistantIcon: 'from-red-500 to-red-600',
        loadingDots: 'bg-red-400',
        inputBorder: 'border-red-500/50',
        inputFocus: 'focus:border-red-400'
      };
    } else if (themeColor === 'purple') {
      // Purple theme for "Feeling Biased" mode
      return {
        border: 'border-purple-500/50',
        borderHover: 'hover:border-purple-500/30',
        bg: 'bg-purple-500/10',
        bgGradient: 'from-purple-500/10 to-purple-600/10',
        gradient: 'from-purple-500 to-purple-600',
        gradientHover: 'hover:from-purple-400 hover:to-purple-500',
        text: 'text-purple-400',
        textHover: 'hover:text-purple-300',
        shadow: 'shadow-purple-500/25',
        shadowLg: 'shadow-purple-500/50',
        messageBorder: 'border-purple-500/50',
        userBg: 'from-purple-500/20 to-purple-500/20',
        assistantIcon: 'from-purple-500 to-purple-600',
        loadingDots: 'bg-purple-400',
        inputBorder: 'border-purple-500/50',
        inputFocus: 'focus:border-purple-400'
      };
    } else if (themeColor === 'ocean') {
      // Ocean blue theme for OSINT mode
      return {
        border: 'border-cyan-500/50',
        borderHover: 'hover:border-cyan-500/30',
        bg: 'bg-cyan-500/10',
        bgGradient: 'from-cyan-500/10 to-blue-500/10',
        gradient: 'from-cyan-500 to-blue-500',
        gradientHover: 'hover:from-cyan-400 hover:to-blue-400',
        text: 'text-cyan-400',
        textHover: 'hover:text-cyan-300',
        shadow: 'shadow-cyan-500/25',
        shadowLg: 'shadow-cyan-500/50',
        messageBorder: 'border-cyan-500/50',
        userBg: 'from-cyan-500/20 to-blue-500/20',
        assistantIcon: 'from-cyan-500 to-blue-500',
        loadingDots: 'bg-cyan-400',
        inputBorder: 'border-cyan-500/50',
        inputFocus: 'focus:border-cyan-400'
      };
    } else {
      // Blue pill mode (default)
      return {
        border: 'border-blue-500/50',
        borderHover: 'hover:border-blue-500/30',
        bg: 'bg-blue-500/10',
        bgGradient: 'from-blue-500/10 to-blue-600/10',
        gradient: 'from-blue-500 to-blue-600',
        gradientHover: 'hover:from-blue-400 hover:to-blue-500',
        text: 'text-blue-400',
        textHover: 'hover:text-blue-300',
        shadow: 'shadow-blue-500/25',
        shadowLg: 'shadow-blue-500/50',
        messageBorder: 'border-blue-500/50',
        userBg: 'from-cyan-500/20 to-blue-500/20',
        assistantIcon: 'from-blue-500 to-blue-600',
        loadingDots: 'bg-blue-400',
        inputBorder: 'border-blue-500/50',
        inputFocus: 'focus:border-blue-400'
      };
    }
  };

  const colors = getColors();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!FREE_ACCESS_MODE && !isAuthed) {
      onClose();
      navigate('/auth/login', { state: { redirectTo: window.location.pathname + window.location.search } });
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setAdKey((prev) => prev + 1);

    try {
      const response = await aiAPI.chat(inputValue, { context: resolvedContext });
      const content = response.data.response?.choices?.[0]?.message?.content
        || response.data.response?.content
        || response.data.response
        || 'No response received.';
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('AI chat error:', error);
      if (!FREE_ACCESS_MODE && error.response?.status === 401) {
        onClose();
        navigate('/auth/login', { state: { redirectTo: window.location.pathname + window.location.search } });
        return;
      }
      const status = error.response?.status;
      const errText = status === 402
        ? 'You\'ve run out of tokens. Watch an ad or upgrade to Premium.'
        : (status === 401 || status === 403)
        ? 'The AI assistant is still being tuned up in early access and isn\'t open to everyone yet. Search results work great in the meantime — thanks for your patience!'
        : error.response?.data?.message || 'Something went wrong on our end. We\'re on it — please try again in a moment.';
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: errText,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`fixed inset-4 md:inset-8 lg:inset-16 bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] rounded-3xl border-2 ${colors.border} shadow-2xl ${colors.shadowLg} overflow-hidden flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${colors.border} bg-gradient-to-r ${colors.bgGradient}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg ${colors.shadow}`}>
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Smart Search Assistant
                </h2>
                <p className="text-sm text-white/60">
                  Ask follow-up questions for deeper insights
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-3 rounded-xl ${colors.bg} hover:bg-opacity-30 ${colors.text} ${colors.textHover} transition-all border ${colors.border}`}
            >
              <X size={24} />
            </button>
          </div>

          {/* Yellow Ad Banner 1 - Top */}
          <AdBanner
            key={`ad-top-${adKey}`}
            variant="yellow"
            size="medium"
            title="Smart Research Tools"
            description="Advanced analytics for professionals"
            ctaText="Learn More"
            className="mx-6 mt-4"
          />

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? `bg-gradient-to-br ${colors.userBg} border-2 ${colors.messageBorder}`
                      : `bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border-2 ${colors.messageBorder}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {message.role === 'assistant' && (
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors.assistantIcon} flex items-center justify-center flex-shrink-0`}>
                        <Sparkles size={16} className="text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-white text-sm leading-relaxed">
                        {message.content}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-white/40">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2">
                            <button className="text-white/40 hover:text-green-400 transition-colors">
                              <ThumbsUp size={12} />
                            </button>
                            <button className="text-white/40 hover:text-red-400 transition-colors">
                              <ThumbsDown size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className={`max-w-[80%] p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border-2 ${colors.messageBorder}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors.assistantIcon} flex items-center justify-center`}>
                      <RefreshCw
                        size={16}
                        className="text-white animate-spin"
                      />
                    </div>
                    <div className="flex gap-1">
                      <div
                        className={`w-2 h-2 ${colors.loadingDots} rounded-full animate-bounce`}
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className={`w-2 h-2 ${colors.loadingDots} rounded-full animate-bounce`}
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className={`w-2 h-2 ${colors.loadingDots} rounded-full animate-bounce`}
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Yellow Ad Banner 2 - Bottom */}
          <AdBanner
            key={`ad-bottom-${adKey}`}
            variant="red"
            size="medium"
            title="Truegle Premium"
            description="Unlimited Smart searches without ads"
            ctaText="Upgrade Now"
            className="mx-6 mb-4"
          />

          {/* Input Area */}
          <div className={`p-6 border-t ${colors.border} bg-gradient-to-r ${colors.bgGradient}`}>
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a follow-up question..."
                disabled={isLoading}
                className={`flex-1 px-4 py-3 rounded-xl bg-black/40 border-2 ${colors.inputBorder} text-white placeholder-white/40 ${colors.inputFocus} focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className={`px-6 py-3 rounded-xl bg-gradient-to-r ${colors.gradient} ${colors.gradientHover} text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg ${colors.shadow}`}
              >
                <Send size={20} />
                <span>Send</span>
              </button>
            </div>
            <p className="text-xs text-white/40 mt-2">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
