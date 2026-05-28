import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import AdBanner from './AdBanner';
import { aiAPI } from '../../services/api';

// TEMPORARY AI IMPLEMENTATION - Will be replaced with final AI provider
export default function AIChatOverlay({
  isOpen,
  onClose,
  initialSummary,
  context = 'general', // Page context for AI prompts
  themeColor = 'red' // 'red', 'blue', 'purple', or 'ocean' for different themes
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content:
        initialSummary ||
        'Climate change solutions encompass a wide range of approaches including renewable energy adoption, carbon capture technologies, and sustainable practices. Recent progress shows accelerating adoption of solar and wind power, with costs dropping significantly. However, economic and political challenges remain. Experts emphasize the need for continued innovation and policy support across multiple sectors.',
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

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Refresh ads on each query
    setAdKey((prev) => prev + 1);

    try {
      // Call the backend AI service with context
      const response = await aiAPI.chat(inputValue, { context });
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.response.choices?.[0]?.message?.content ||
                 response.data.response.content ||
                 response.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `I'm sorry, but I encountered an error processing your request. ${error.response?.data?.message || 'Please try again later.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
