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
import ChatShareButton from '../components/ui/ChatShareButton';

// Truegle Chat is a designated route for chat-first users — the same brand
// (logo, mode-synced background/accents) as the rest of Truegle, but reduced
// to one thing: a chat box, with search results (links/pics/vids) cited
// inline. Deliberately no ads, no filters, no results grid — "Truegle in a
// nutshell with less clutter."

const MODES = ['blue', 'green', 'red', 'purple', 'ocean'];

// Persisted thread — so navigating away and coming back continues the same
// conversation instead of resetting to a cold welcome message.
const THREAD_KEY = 'truegle_chat_thread_v1';

// One-line explainer per mode for the "How do the modes work?" tutorial popover.
const MODE_INFO = {
  blue: 'Mainstream — establishment and widely-accepted sources. Balanced, cited answers.',
  green: 'Simplified — plain-English answers with no jargon. Good for quick understanding.',
  red: 'Alternative — independent and suppressed perspectives that question the official narrative.',
  purple: 'Perspectives — lays out multiple viewpoints side by side with skeptical, accountability-first framing.',
  ocean: 'Privacy / OSINT — digital-investigation assistant. Name an entity (domain, email, username, phone, or person) and it runs public-records lookups automatically.',
};

function loadThread() {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* corrupt/oversized — fall back to a fresh welcome */ }
  return null;
}

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
  purple: 'Perspectives mode — I lay out multiple viewpoints with skeptical, accountability-first framing. What would you like to explore?',
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
  // Defensive defaults: the OSINT path builds { links } only (no videos/pics),
  // so destructuring straight to .length used to crash the whole page with
  // "can't access property length, n is undefined". Never trust the shape.
  const links = Array.isArray(citations.links) ? citations.links : [];
  const videos = Array.isArray(citations.videos) ? citations.videos : [];
  const pics = Array.isArray(citations.pics) ? citations.pics : [];
  if (links.length === 0 && videos.length === 0 && pics.length === 0) return null;
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
  const [messages, setMessages] = useState(() => loadThread() || [
    { id: 1, role: 'assistant', content: MODE_WELCOME[localStorage.getItem('truegle_mode_pref') || 'blue'], citations: null },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const endRef = useRef(null);
  const isAuthed = !!localStorage.getItem('truegle_token');
  const accent = getModeAccent(mode);

  useEffect(() => { localStorage.setItem('truegle_mode_pref', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('truegle_nephesh_mode', String(nepheshMode)); }, [nepheshMode]);
  useEffect(() => { localStorage.setItem('truegle_verbose_mode', String(verboseMode)); }, [verboseMode]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // Persist the thread on every change so a page-away-and-back resumes it.
  // Wrapped because localStorage can throw (quota / private mode); a failed
  // save must never break the chat.
  useEffect(() => {
    try { localStorage.setItem(THREAD_KEY, JSON.stringify(messages)); } catch { /* over quota — skip */ }
  }, [messages]);

  const resetThread = () => {
    setMessages([{ id: Date.now(), role: 'assistant', content: MODE_WELCOME[mode], citations: null }]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!FREE_ACCESS_MODE && !isAuthed) {
      navigate('/auth/login', { state: { redirectTo: '/chat' } });
      return;
    }

    const query = input.trim();
    // Prior turns → working memory for a real back-and-forth. Skip the id:1
    // welcome (not a real exchange). Send only role/content, no media payloads.
    const history = messages
      .filter((m) => m.id !== 1)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: query, citations: null }]);
    setInput('');
    setLoading(true);

    let content;
    let citations = null;

    // Ocean mode → auto-OSINT: if the query names an investigable entity
    // (domain/IP/email/username/phone) the backend runs the lookups and
    // synthesizes an investigator's report. If it names none, fall through to
    // normal Ocean-mode chat so methodology questions still get answered.
    if (mode === 'ocean') {
      try {
        const res = await api.post('/osint/investigate', { query });
        const d = res.data;
        if (d?.report) {
          content = d.report;
          citations = (d.artifacts && d.artifacts.length) ? { links: d.artifacts } : null;
        }
      } catch { /* fall through to chat below */ }
    }

    if (content === undefined) {
      const [chatRes, citeRes] = await Promise.allSettled([
        aiAPI.chat(query, { context: MODE_TO_CONTEXT[mode], nepheshMode, verbose: verboseMode, history }),
        fetchCitations(query, MODE_TO_BACKEND_SEARCH[mode]),
      ]);
      content = chatRes.status === 'fulfilled'
        ? extractContent(chatRes.value)
        : "Sorry, I couldn't reach the AI just now — try again in a moment.";
      citations = citeRes.status === 'fulfilled' ? citeRes.value : null;
    }

    setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content, citations }]);
    setLoading(false);
  };

  return (
    // h-[100dvh] (dynamic viewport height) instead of min-h-screen: when the
    // mobile keyboard opens, dvh shrinks with the visible area so the input row
    // stays on-screen. With min-h-screen the box was pushed under the keyboard.
    <div className="h-[100dvh] relative bg-black overflow-hidden">
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

      <div className="relative z-10 h-[100dvh] flex flex-col items-center px-4 pt-5 pb-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-3 flex-shrink-0"
        >
          <TruegleLogo size="medium" animated />
        </motion.div>

        {/* Pill mode row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap justify-center flex-shrink-0">
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
        <div className="flex items-center gap-2 mb-3 flex-wrap justify-center flex-shrink-0">
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
          {/* Tutorial: explains each mode and how they combine. Hover on desktop,
              tap on touch — both toggle the same popover. */}
          <div
            className="relative"
            onMouseEnter={() => setShowTutorial(true)}
            onMouseLeave={() => setShowTutorial(false)}
          >
            <button
              type="button"
              onClick={() => setShowTutorial((v) => !v)}
              aria-expanded={showTutorial}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white/5 border-white/10 text-white/40 hover:text-white/70 transition-colors"
            >
              <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] leading-none">?</span>
              Modes
            </button>
            <AnimatePresence>
              {showTutorial && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-30 top-full mt-2 left-1/2 -translate-x-1/2 w-72 max-w-[85vw] rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl p-3 text-left shadow-2xl"
                >
                  <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">How the modes work</div>
                  <ul className="space-y-1.5">
                    {MODES.map((m) => (
                      <li key={m} className="text-xs text-white/70 leading-snug">
                        <span className="font-semibold" style={{ color: MODE_COLORS[m] }}>{MODE_LABELS[m]}</span>
                        {' — '}{MODE_INFO[m].split('—').slice(1).join('—').trim()}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-white/45 leading-snug">
                    Pair any mode with <span className="text-cyan-300">Nephesh Mode</span> (dual-audit on contested claims) and
                    {' '}<span className="text-purple-300">Feeling chat-e?</span> (longer answers). Toggles stick across pages.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={resetThread}
              title="Start a new conversation"
              className="px-2.5 py-1 rounded-full text-xs font-medium border bg-white/5 border-white/10 text-white/40 hover:text-white/70 transition-colors"
            >
              New chat
            </button>
          )}
        </div>

        {/* Message thread — takes the majority of the page; input stays pinned
            below it and above the mobile keyboard (dvh container). */}
        <div className="w-full max-w-2xl flex-1 min-h-0 space-y-4 mb-3 overflow-y-auto">
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
                {m.role === 'assistant' && m.id !== 1 && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex justify-start">
                    <ChatShareButton message={m} />
                  </div>
                )}
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

        {/* One large chat box — pinned below the thread, never shrinks */}
        <div className="w-full max-w-2xl flex-shrink-0">
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
