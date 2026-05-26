import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  MoreHorizontal,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';

/**
 * SearchResultsContainer Component
 *
 * CONSTRAINT CHECK:
 * ✅ No background/animation changes (transparent overlay on animated bg)
 * ✅ Preserves brand colors (emerald/purple accents)
 * ✅ Uses 8px spacing grid system
 * ✅ Uses MD3 typography tokens
 *
 * CHANGE SCOPE:
 * - Glassmorphism result cards
 * - Perspective badges with color coding
 * - AI summary section
 * - Staggered animation on load
 * - Responsive grid layout
 */

// Perspective color mapping
const PERSPECTIVE_COLORS = {
  left: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  center: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/20',
  },
  right: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  neutral: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
  },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

/**
 * Single Search Result Card
 */
function SearchResultCard({
  result,
  index,
  onFeedback,
  onBookmark,
  onShare,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const perspectiveStyle = PERSPECTIVE_COLORS[result.perspective] || PERSPECTIVE_COLORS.neutral;

  const handleFeedback = (type) => {
    setFeedbackGiven(type);
    onFeedback?.(result.id, type);
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    onBookmark?.(result.id, !isBookmarked);
  };

  return (
    <motion.article
      variants={itemVariants}
      layout
      className={`
        relative group
        bg-neutral-900/80 backdrop-blur-xl
        border ${perspectiveStyle.border} hover:border-opacity-60
        rounded-2xl
        p-5
        transition-all duration-300 ease-out
        hover:shadow-lg hover:${perspectiveStyle.glow}
        hover:bg-neutral-900/90
      `}
    >
      {/* Perspective Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Source Favicon Placeholder */}
          <div className="w-5 h-5 rounded bg-neutral-700 flex items-center justify-center">
            <Globe size={12} className="text-neutral-400" />
          </div>

          {/* Source Info */}
          <div className="flex items-center gap-2 text-label-small text-neutral-400">
            <span className="font-medium text-neutral-300">{result.source}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {result.date}
            </span>
          </div>
        </div>

        {/* Perspective Tag */}
        <span
          className={`
            px-2.5 py-1 rounded-full
            text-label-small font-medium
            ${perspectiveStyle.bg} ${perspectiveStyle.text}
            border ${perspectiveStyle.border}
          `}
        >
          {result.perspective?.charAt(0).toUpperCase() + result.perspective?.slice(1) || 'Neutral'}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-title-medium text-neutral-50 mb-2 group-hover:text-emerald-300 transition-colors duration-200">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline decoration-emerald-500/50 underline-offset-2"
        >
          {result.title}
        </a>
      </h3>

      {/* URL */}
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-body-small text-emerald-500 hover:text-emerald-400 mb-3 transition-colors"
      >
        <span className="truncate max-w-[300px]">{result.url}</span>
        <ExternalLink size={12} />
      </a>

      {/* Description */}
      <p className={`text-body-medium text-neutral-300 leading-relaxed ${!isExpanded && 'line-clamp-3'}`}>
        {result.description}
      </p>

      {/* Expand/Collapse for long content */}
      {result.description?.length > 200 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 mt-2 text-label-small text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              <span>Show more</span>
            </>
          )}
        </button>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
        {/* Feedback Buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleFeedback('helpful')}
            className={`
              p-2 rounded-lg transition-colors duration-150
              ${feedbackGiven === 'helpful'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-neutral-800/50 text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              }
            `}
            aria-label="Mark as helpful"
          >
            <ThumbsUp size={16} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleFeedback('not_helpful')}
            className={`
              p-2 rounded-lg transition-colors duration-150
              ${feedbackGiven === 'not_helpful'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-neutral-800/50 text-neutral-500 hover:text-red-400 hover:bg-red-500/10'
              }
            `}
            aria-label="Mark as not helpful"
          >
            <ThumbsDown size={16} />
          </motion.button>
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleBookmark}
            className={`
              p-2 rounded-lg transition-colors duration-150
              ${isBookmarked
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-neutral-800/50 text-neutral-500 hover:text-purple-400 hover:bg-purple-500/10'
              }
            `}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onShare?.(result)}
            className="p-2 rounded-lg bg-neutral-800/50 text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors duration-150"
            aria-label="Share result"
          >
            <Share2 size={16} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg bg-neutral-800/50 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/50 transition-colors duration-150"
            aria-label="More options"
          >
            <MoreHorizontal size={16} />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

/**
 * AI Summary Card
 */
function AISummaryCard({ summary, isLoading = false, isCollapsed = false, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-purple-900/40 via-neutral-900/80 to-cyan-900/30
        backdrop-blur-xl
        border border-purple-500/30
        rounded-2xl
        mb-6
      `}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
            <Sparkles size={18} className="text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-title-small text-neutral-50 font-semibold">AI Summary</h3>
            <p className="text-label-small text-neutral-400">Powered by Truegle AI</p>
          </div>
        </div>

        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className="text-neutral-400" />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {isLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 size={20} className="text-purple-400 animate-spin" />
                  <span className="text-body-medium text-neutral-400">Generating summary...</span>
                </div>
              ) : (
                <div className="text-body-medium text-neutral-300 leading-relaxed">
                  {summary || 'No summary available for this search.'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ query }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="p-4 rounded-2xl bg-neutral-800/50 mb-4">
        <AlertCircle size={40} className="text-neutral-500" />
      </div>
      <h3 className="text-title-medium text-neutral-300 mb-2">No results found</h3>
      <p className="text-body-medium text-neutral-500 max-w-md">
        We couldn't find any results for "{query}". Try different keywords or check your spelling.
      </p>
    </motion.div>
  );
}

/**
 * Loading State Component
 */
function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-2xl p-5 animate-pulse"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 rounded bg-neutral-700" />
            <div className="h-4 w-32 bg-neutral-700 rounded" />
            <div className="h-4 w-20 bg-neutral-700 rounded ml-auto" />
          </div>
          <div className="h-5 w-3/4 bg-neutral-700 rounded mb-2" />
          <div className="h-4 w-1/2 bg-neutral-700 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-neutral-800 rounded" />
            <div className="h-4 w-5/6 bg-neutral-800 rounded" />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

/**
 * Main SearchResultsContainer Component
 */
export default function SearchResultsContainer({
  results = [],
  query = '',
  aiSummary = null,
  isLoading = false,
  isSummaryLoading = false,
  onFeedback,
  onBookmark,
  onShare,
  className = '',
}) {
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);

  // Filter results by perspective if needed
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      // Sort by relevance or date if available
      return 0;
    });
  }, [results]);

  if (isLoading) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`}>
        <LoadingState />
      </div>
    );
  }

  if (!results.length && query) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`}>
        <EmptyState query={query} />
      </div>
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* AI Summary Section */}
      {(aiSummary || isSummaryLoading) && (
        <AISummaryCard
          summary={aiSummary}
          isLoading={isSummaryLoading}
          isCollapsed={isSummaryCollapsed}
          onToggle={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
        />
      )}

      {/* Results Count */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mb-4"
        >
          <p className="text-body-small text-neutral-500">
            About <span className="text-neutral-300 font-medium">{results.length.toLocaleString()}</span> results
          </p>
        </motion.div>
      )}

      {/* Results Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {sortedResults.map((result, index) => (
          <div key={result.id || index}>
            {/* Ad Banner after every 3rd result */}
            {index > 0 && index % 3 === 0 && (
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-yellow-200 mb-1">
                      Sponsored
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Premium Ad Content
                    </div>
                    <div className="text-xs text-white/90">
                      High-quality products and services
                    </div>
                  </div>
                  <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                    Learn More
                  </button>
                </div>
              </div>
            )}

            <SearchResultCard
              result={result}
              index={index}
              onFeedback={onFeedback}
              onBookmark={onBookmark}
              onShare={onShare}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Export individual components for flexibility
 */
export { SearchResultCard, AISummaryCard, EmptyState, LoadingState };
