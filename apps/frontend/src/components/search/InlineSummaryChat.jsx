import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send } from 'lucide-react';
import { aiAPI } from '../../services/api';
import { MODE_COLORS, MODE_LABELS, MODE_TO_CONTEXT, solidTextClass } from '../../config/modeTheme';
import FeedbackButtons from '../ui/FeedbackButtons';

// The chat lenses that can flavor the follow-up conversation.
const LENSES = ['blue', 'green', 'red', 'purple', 'ocean'];

// Inline mini-chat that continues from the search AI summary — a miniaturized
// version of the /chat interface (mode row + bubbles + auto-growing input),
// embedded in the expanded summary card. "Summarize" (green) is the default
// lens, so follow-ups stay concise; adding other lenses blends their framing
// and switches to in-depth answers (verbose = not Summarize), matching /chat.
export default function InlineSummaryChat({ query, summary, primaryMode = 'blue', nepheshMode = false }) {
  const [modes, setModes] = useState(['green']); // Summarize default (concise)
  const [messages, setMessages] = useState([]);  // follow-ups only; summary is shown above
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const verbose = !modes.includes('green');
  const primary = modes[0] || primaryMode || 'green';

  const toggleMode = (m) =>
    setModes((prev) => (prev.includes(m) ? (prev.length === 1 ? prev : prev.filter((x) => x !== m)) : [...prev, m]));

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }
  }, [input]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    // Seed the summary as the opening assistant turn so the model has context.
    const history = [
      { role: 'assistant', content: summary || '' },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ].filter((h) => h.content);
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await aiAPI.chat(text, {
        context: MODE_TO_CONTEXT[primary] || 'search_results',
        modes: modes.length > 1 ? modes : undefined,
        nepheshMode,
        verbose,
        history,
      });
      const content = res.data.response?.choices?.[0]?.message?.content
        || res.data.response?.content || res.data.response || 'No response received.';
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content }]);
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Couldn't reach the AI just now — try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      {/* Chat-lens row — the mode options; tap to blend (Summarize default). */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-[11px] text-white/40 mr-0.5">Continue in chat:</span>
        {LENSES.map((m) => {
          const active = modes.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleMode(m)}
              aria-pressed={active}
              title={active ? `${MODE_LABELS[m]} active — tap to remove` : `Add ${MODE_LABELS[m]} lens`}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                active ? solidTextClass(m) : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
              }`}
              style={active ? { backgroundColor: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : undefined}
            >
              {MODE_LABELS[m]}
            </button>
          );
        })}
      </div>

      {/* Follow-up thread (miniaturized /chat bubbles) */}
      {(messages.length > 0 || loading) && (
        <div className="space-y-3 mb-3 max-h-80 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-white/10 text-white' : 'bg-black/40 border border-white/10 text-white/90'
              }`}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_a]:underline">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : m.content}
                {m.role === 'assistant' && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <FeedbackButtons
                      answer={m.content}
                      query={[...messages.slice(0, i)].reverse().find((p) => p.role === 'user')?.content || query}
                      mode={modes.join('+')}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3.5 py-2.5 bg-black/40 border border-white/10 flex gap-1">
                <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Auto-growing input (same technique as /chat + landing) */}
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask a follow-up…"
          style={{ minHeight: '36px', maxHeight: '160px' }}
          className="flex-1 bg-transparent resize-none overflow-y-auto outline-none text-white placeholder-white/30 text-sm p-1.5"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || loading}
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            input.trim() && !loading ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
