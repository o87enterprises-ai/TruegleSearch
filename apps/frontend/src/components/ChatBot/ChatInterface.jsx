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
import AdBanner from '../ui/AdBanner';
import { aiAPI } from '../../services/api';

// TEMPORARY AI IMPLEMENTATION - Will be replaced with final AI provider
export default function ChatInterface({ isOpen, onClose, initialSummary, context = 'general', themeColor = 'purple' }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content:
        initialSummary ||
        'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adKey, setAdKey] = useState(0);
  const messagesEndRef = useRef(null);

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

    // Add a temporary AI message with loading state
    const tempAiMessageId = Date.now() + 1;
    const tempAiMessage = {
      id: tempAiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, tempAiMessage]);

    try {
      // Call the backend AI service with context
      const response = await aiAPI.chat(inputValue, { context });
      const fullContent = response.data.response.choices?.[0]?.message?.content ||
                          response.data.response.content ||
                          response.data.response;

      // Simulate streaming by gradually adding content (in a real implementation,
      // this would be handled by the backend with streaming responses)
      const words = fullContent.split(' ');
      let currentContent = '';

      // Update the temporary message with streaming effect
      for (let i = 0; i < words.length; i++) {
        currentContent += (i > 0 ? ' ' : '') + words[i];

        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempAiMessageId
              ? { ...msg, content: currentContent + (i === words.length - 1 ? '' : '█') }
              : msg
          )
        );

        // Add delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Final update without cursor
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempAiMessageId
            ? { ...msg, content: fullContent, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempAiMessageId
            ? {
                ...msg,
                content: `I'm sorry, but I encountered an error processing your request. ${error.response?.data?.message || 'Please try again later.'}`,
                isStreaming: false
              }
            : msg
        )
      );
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

  // Theme color mappings for different modes
  const getColors = () => {
    if (themeColor === 'red') {
      return {
        border: 'border-red-500/50',
        shadow: 'shadow-red-500/50',
        headerBg: 'bg-gradient-to-r from-red-500/10 to-red-600/10',
        assistantIcon: 'from-red-500 to-red-600',
        assistantIconShadow: 'shadow-red-500/25',
        userBg: 'from-red-500/20 to-red-500/20',
        userBorder: 'border-red-500/50',
        inputBorder: 'border-red-500/50',
        inputFocus: 'focus:border-red-400',
        gradientButton: 'from-red-500 to-red-600',
        gradientButtonHover: 'hover:from-red-400 hover:to-red-500',
        shadowButton: 'shadow-red-500/25',
        loadingDots: 'bg-red-400'
      };
    } else if (themeColor === 'purple') {
      // Purple theme for "Feeling Biased" mode
      return {
        border: 'border-purple-500/50',
        shadow: 'shadow-purple-500/50',
        headerBg: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
        assistantIcon: 'from-purple-500 to-pink-500',
        assistantIconShadow: 'shadow-purple-500/25',
        userBg: 'from-purple-500/20 to-purple-500/20',
        userBorder: 'border-purple-500/50',
        inputBorder: 'border-purple-500/50',
        inputFocus: 'focus:border-purple-400',
        gradientButton: 'from-purple-500 to-pink-500',
        gradientButtonHover: 'hover:from-purple-400 hover:to-pink-400',
        shadowButton: 'shadow-purple-500/25',
        loadingDots: 'bg-purple-400'
      };
    } else if (themeColor === 'ocean') {
      // Ocean blue theme for OSINT mode
      return {
        border: 'border-cyan-500/50',
        shadow: 'shadow-cyan-500/50',
        headerBg: 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10',
        assistantIcon: 'from-cyan-500 to-blue-500',
        assistantIconShadow: 'shadow-cyan-500/25',
        userBg: 'from-cyan-500/20 to-blue-500/20',
        userBorder: 'border-cyan-500/50',
        inputBorder: 'border-cyan-500/50',
        inputFocus: 'focus:border-cyan-400',
        gradientButton: 'from-cyan-500 to-blue-500',
        gradientButtonHover: 'hover:from-cyan-400 hover:to-blue-400',
        shadowButton: 'shadow-cyan-500/25',
        loadingDots: 'bg-cyan-400'
      };
    } else {
      // Blue pill mode (default)
      return {
        border: 'border-blue-500/50',
        shadow: 'shadow-blue-500/50',
        headerBg: 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10',
        assistantIcon: 'from-blue-500 to-cyan-500',
        assistantIconShadow: 'shadow-blue-500/25',
        userBg: 'from-cyan-500/20 to-blue-500/20',
        userBorder: 'border-blue-500/50',
        inputBorder: 'border-blue-500/50',
        inputFocus: 'focus:border-blue-400',
        gradientButton: 'from-blue-500 to-cyan-500',
        gradientButtonHover: 'hover:from-blue-400 hover:to-cyan-400',
        shadowButton: 'shadow-blue-500/25',
        loadingDots: 'bg-blue-400'
      };
    }
  };

  const colors = getColors();

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
          className={`fixed inset-4 md:inset-8 lg:inset-16 bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] rounded-3xl border-2 ${colors.border} shadow-2xl ${colors.shadow} overflow-hidden flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${colors.border} ${colors.headerBg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg ${colors.assistantIconShadow}`}>
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {context === 'osint' ? 'OSINT/SEO AI Assistant' : 'AI Assistant'}
                </h2>
                <p className="text-sm text-white/60">
                  Ask follow-up questions for deeper insights
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all border border-red-500/30"
            >
              <X size={24} />
            </button>
          </div>

          {/* Yellow Ad Banner 1 - Top */}
          <motion.div
            key={`ad-top-${adKey}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-4 p-4 rounded-2xl border-2 border-yellow-400"
            style={{
              backgroundColor: '#FFEB3B',
              boxShadow: '0 4px 15px rgba(255, 235, 59, 0.3)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-700 mb-1 font-bold">
                  Sponsored
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {context === 'osint' ? 'OSINT Research Tools' : 'AI Research Tools'}
                </div>
                <div className="text-xs text-gray-800">
                  {context === 'osint' ? 'Advanced intelligence gathering for professionals' : 'Advanced analytics for professionals'}
                </div>
              </div>
              <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold whitespace-nowrap hover:from-purple-400 hover:to-pink-400 transition-all shadow-lg">
                Learn More
              </button>
            </div>
          </motion.div>

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
                      ? `bg-gradient-to-br ${colors.userBg} border-2 ${colors.userBorder}`
                      : `bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border-2 ${colors.border}`
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
                        {message.role === 'assistant' && !message.isStreaming && (
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
                <div className={`max-w-[80%] p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border-2 ${colors.border}`}>
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
          <motion.div
            key={`ad-bottom-${adKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mb-4 p-4 rounded-2xl border-2 border-yellow-400"
            style={{
              backgroundColor: '#FFEB3B',
              boxShadow: '0 4px 15px rgba(255, 235, 59, 0.3)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-700 mb-1 font-bold">
                  Sponsored
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  Truegle Premium
                </div>
                <div className="text-xs text-gray-800">
                  Unlimited AI searches without ads
                </div>
              </div>
              <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg">
                Upgrade Now
              </button>
            </div>
          </motion.div>

          {/* Input Area */}
          <div className={`p-6 border-t ${colors.border} bg-gradient-to-r from-purple-500/5 to-pink-500/5`}>
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
                className={`px-6 py-3 rounded-xl bg-gradient-to-r ${colors.gradientButton} ${colors.gradientButtonHover} text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg ${colors.shadowButton}`}
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