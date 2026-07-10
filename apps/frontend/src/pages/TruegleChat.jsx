import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Send, ExternalLink, Eye, Image as ImageIcon, Film } from 'lucide-react';
import LandingBackground from '../components/LandingBackground';
import CursorGlow from '../components/ui/CursorGlow';
import TruegleLogo from '../components/ui/TruegleLogo';
import api, { aiAPI } from '../services/api';
import { FREE_ACCESS_MODE } from '../config/access';
import { MODE_COLORS, MODE_LABELS, MODE_TO_CONTEXT, getModeAccent } from '../config/modeTheme';
import { getVideoEmbed } from '../utils/videoEmbed';

// Truegle Chat is a designated route for chat-first users — the same brand
// (logo, mode-synced background/accents) as the rest of Truegle, but reduced
// to one thing: a chat box, with search results (links/pics/vids) cited
// inline. Deliberately no ads, no filters, no results grid — "Truegle in a
// nutshell with less clutter."

const MODES = ['blue', 'green', 'red', 'purple', 'ocean'];

// Frontend pill mode -> backend /api/search `mode` field (SearchService uses
// this for mode-specific source selection, e.g. red-pill's alt-media query).
const MODE_TO_BACKEND_SEARCH = {
  blue: 'blue-pill',
  green: 'green',
  red: 'red-pill',
  purple: 'purple',
  ocean: 'ocean',
};

const MODE_WELCOME = {
  blue: 'Ask me anything. I search the web and answer with sources.',
  green: 'Ask me anything, plain and simple.',
  red: 'Alternative and suppressed perspectives — what do you want to dig into?',
  purple: 'Skeptical, accountability-first framing. What would you like to explore?',
  ocean: 'OSINT assistant ready — ask about digital investigation or research.',
};

function extractContent(chatResponse) {
  const r = chatResponse?.data?.response;
  return r?.choices?.[0]?.message?.content || r?.content || r || 'No response received.';
}

// Fetch citation material for a query: top links+videos from a general
// search, plus a small image strip — in parallel, independently gradeful
// when either call fails or comes back empty.
async function fetchCitations(query, backendMode) {
  const [webRes, imgRes] = await Promise.allSettled([
    api.post('/search', { query, mode: backendMode, filters: { category: 'all', perPage: 10 } }),
    api.post('/search', { query, mode: backendMode, filters: { category: 'images', perPage: 6 } }),
  ]);

  const webResults = webRes.status === 'fulfilled' ? (webRes.value.data.results || []) : [];
  const imgResults = imgRes.status === 'fulfilled' ? (imgRes.value.data.results || []) : [];

  const links = webResults.filter((r) => !getVideoEmbed(r.url)).slice(0, 4);
  const videos = webResults.filter((r) => getVideoEmbed(r.url)).slice(0, 3);
  const pics = imgResults.slice(0, 6);

  if (links.length === 0 && videos.length === 0 && pics.length === 0) return null;
  return { links, videos, pics };
}

// Compact citation chip — the same three Truegle actions every result card
// gets: Open link, View anonymously (proxy), Open in app (inline expand).
function CitationChip({ result, accent }) {
  const [expanded, setExpanded] = useState(false);
  const videoEmbed = getVideoEmbed(result.url);
  let domain = result.domain || '';
  try {
    domain = new URL(result.url).hostname.replace(/^www\./, '');
  } catch { /* keep fallback */ }

  return (
    <div className={`rounded-lg border ${accent.iframeBorder} bg-white/5 overflow-hidden`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {result.image && (
          <img src={result.image} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0"
            onError={(e) => { e.target.style.display = 'none'; }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white/80 truncate">{result.title || domain}</div>
          <div className="text-[10px] text-white/40 truncate">{domain}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={result.url} target="_blank" rel="noopener noreferrer"
            title="Open link" className={`${accent.link} transition-colors`}>
            <ExternalLink size={12} />
          </a>
          {result.proxyUrl && (
            <a href={result.proxyUrl} target="_blank" rel="noopener noreferrer"
              title="View anonymously — the site never sees your IP" className={`${accent.link} transition-colors`}>
              <Eye size={12} />
            </a>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={videoEmbed ? 'Play here' : 'Open in app'}
            className={`text-[10px] font-medium ${accent.link} transition-colors`}
          >
            {expanded ? 'Close' : videoEmbed ? '▶' : 'In app'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className={`border-t ${accent.iframeBorder}`}>
          <iframe
            key={videoEmbed || result.proxyUrl || result.url}
            src={videoEmbed ? `${videoEmbed}?autoplay=1` : (result.proxyUrl || result.url)}
            className="w-full h-64"
            title={result.title || 'Preview'}
            allow={videoEmbed ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' : undefined}
            sandbox={videoEmbed ? undefined : 'allow-scripts allow-same-origin'}
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

function Citations({ citations, accent }) {
  if (!citations) return null;
  const { links, videos, pics } = citations;
  return (
    <div className="mt-3 space-y-3">
      {links.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/30 mb-1.5">Sources</div>
          <div className="space-y-1.5">
            {links.map((r, i) => <CitationChip key={r.url || i} result={r} accent={accent} />)}
          </div>
        </div>
      )}
      {pics.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/30 mb-1.5 flex items-center gap-1">
            <ImageIcon size={11} /> Pics
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {pics.map((r, i) => (
              <a key={r.url || i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                <img src={r.image || r.thumbnail} alt={r.title || ''} className="w-16 h-16 rounded-lg object-cover opacity-85 hover:opacity-100 transition-opacity"
                  onError={(e) => { e.target.style.display = 'none'; }} />
              </a>
            ))}
          </div>
        </div>
      )}
      {videos.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/30 mb-1.5 flex items-center gap-1">
            <Film size={11} /> Vids
          </div>
          <div className="space-y-1.5">
            {videos.map((r, i) => <CitationChip key={r.url || i} result={r} accent={accent} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TruegleChat() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => localStorage.getItem('truegle_mode_pref') || 'blue');
  const [nepheshMode, setNepheshMode] = useState(() => localStorage.getItem('truegle_nephesh_mode') === 'true');
  const [verboseMode, setVerboseMode] = useState(() => localStorage.getItem('truegle_verbose_mode') === 'true');
  const [messages, setMessages] = useState(() => [
    { id: 1, role: 'assistant', content: MODE_WELCOME[localStorage.getItem('truegle_mode_pref') || 'blue'], citations: null },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const isAuthed = !!localStorage.getItem('truegle_token');
  const accent = getModeAccent(mode);

  useEffect(() => { localStorage.setItem('truegle_mode_pref', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('truegle_nephesh_mode', String(nepheshMode)); }, [nepheshMode]);
  useEffect(() => { localStorage.setItem('truegle_verbose_mode', String(verboseMode)); }, [verboseMode]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!FREE_ACCESS_MODE && !isAuthed) {
      navigate('/auth/login', { state: { redirectTo: '/chat' } });
      return;
    }

    const query = input.trim();
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: query, citations: null }]);
    setInput('');
    setLoading(true);

    const [chatRes, citeRes] = await Promise.allSettled([
      aiAPI.chat(query, { context: MODE_TO_CONTEXT[mode], nepheshMode, verbose: verboseMode }),
      fetchCitations(query, MODE_TO_BACKEND_SEARCH[mode]),
    ]);

    const content = chatRes.status === 'fulfilled'
      ? extractContent(chatRes.value)
      : "Sorry, I couldn't reach the AI just now — try again in a moment.";
    const citations = citeRes.status === 'fulfilled' ? citeRes.value : null;

    setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content, citations }]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative bg-black overflow-hidden">
      <LandingBackground />
      {/* Mode-tinted ambient tint — crossfades on mode change, pure CSS/opacity
          (no WebGL) so it's safe everywhere the base LandingBackground is. */}
      <AnimatePresence>
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${MODE_COLORS[mode]}26, transparent 60%)`,
          }}
        />
      </AnimatePresence>
      <CursorGlow />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 pt-14 pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4"
        >
          <TruegleLogo size="large" animated />
        </motion.div>

        {/* Pill mode row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                mode === m
                  ? 'text-white'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
              }`}
              style={mode === m ? { backgroundColor: `${MODE_COLORS[m]}33`, borderColor: `${MODE_COLORS[m]}80` } : undefined}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Nephesh mode + verbosity toggles — same semantics as the search pages */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setNepheshMode((v) => !v)}
            title="Nephesh Mode: layer the Null-Prime dual-audit protocol onto contested claims"
            aria-pressed={nepheshMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              nepheshMode ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${nepheshMode ? 'bg-cyan-300' : 'bg-white/20'}`} />
            Nephesh Mode
          </button>
          <button
            type="button"
            onClick={() => setVerboseMode((v) => !v)}
            title="Feeling chat-e? In-depth responses instead of the default succinct answers"
            aria-pressed={verboseMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              verboseMode ? 'bg-purple-500/20 border-purple-400/50 text-purple-200' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${verboseMode ? 'bg-purple-300' : 'bg-white/20'}`} />
            Feeling chat-e?
          </button>
        </div>

        {/* Message thread */}
        <div className="w-full max-w-2xl flex-1 space-y-4 mb-4 overflow-y-auto">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-white/10 text-white'
                  : `bg-black/40 border ${accent.iframeBorder} text-white/90`
              }`}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_a]:text-inherit [&_a]:underline">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{m.content}</p>
                )}
                <Citations citations={m.citations} accent={accent} />
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className={`rounded-2xl px-4 py-3 bg-black/40 border ${accent.iframeBorder} flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full animate-bounce ${accent.count}`} style={{ backgroundColor: 'currentColor', animationDelay: '0ms' }} />
                <span className={`w-2 h-2 rounded-full animate-bounce ${accent.count}`} style={{ backgroundColor: 'currentColor', animationDelay: '150ms' }} />
                <span className={`w-2 h-2 rounded-full animate-bounce ${accent.count}`} style={{ backgroundColor: 'currentColor', animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* One large chat box */}
        <div className="w-full max-w-2xl">
          <div className={`flex items-end gap-2 rounded-2xl border ${accent.iframeBorder} bg-white/5 backdrop-blur-xl p-2`}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Truegle anything..."
              rows={2}
              className="flex-1 bg-transparent resize-none outline-none text-white placeholder-white/30 text-sm p-2"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                input.trim() && !loading ? `${accent.link} bg-white/10 hover:bg-white/20` : 'text-white/20 bg-white/5 cursor-not-allowed'
              }`}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
