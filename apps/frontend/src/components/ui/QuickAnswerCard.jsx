import { motion } from 'framer-motion';
import { Sparkles, ExternalLink } from 'lucide-react';
import { SkeletonCard } from './Skeleton';

/**
 * DuckDuckGo-style quick answer: a short, cited answer for question /
 * factual-lookup queries, rendered above the organic results.
 *
 * Data comes from POST /api/ai/quick-answer, which answers only when the
 * sources support it — callers just mount this with `quickAnswer`/`loading`
 * and it renders nothing when there is no answer (the card never shows an
 * empty or hedged state).
 */
export default function QuickAnswerCard({ quickAnswer, loading = false, className = '' }) {
  if (!loading && !quickAnswer) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl bg-gradient-to-br from-cyan-500/[0.12] to-blue-500/[0.08] backdrop-blur-xl border border-cyan-400/30 p-5 shadow-lg shadow-cyan-500/10 ${className}`}
    >
      {loading && !quickAnswer ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-cyan-300 text-sm">
            <Sparkles size={16} />
            <span>Finding a quick answer…</span>
          </div>
          <SkeletonCard className="h-16" />
        </div>
      ) : quickAnswer ? (
        <>
          <div className="flex items-center gap-2 mb-2 text-cyan-300 text-xs font-semibold uppercase tracking-wide">
            <Sparkles size={14} />
            <span>Quick Answer</span>
          </div>
          <p className="text-lg text-white leading-relaxed mb-4">{quickAnswer.answer}</p>
          {quickAnswer.sources?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-cyan-400/15">
              <span className="text-xs text-white/50 mr-1">Sources:</span>
              {quickAnswer.sources.map((s, i) => (
                <a
                  key={s.url || i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-cyan-200 transition-colors"
                >
                  <ExternalLink size={11} />
                  <span className="max-w-[180px] truncate">{s.domain || s.title}</span>
                </a>
              ))}
            </div>
          )}
          <div className="mt-3 text-[10px] text-white/40">
            Generated from search results — verify with the sources above.
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
