import { useState, useRef, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Send, ExternalLink, Eye, Image as ImageIcon, Film, Share2, X, Copy, Pencil, Check, Plus, Lock } from 'lucide-react';
import LandingBackground from '../components/LandingBackground';
import VoiceRecognition from '../components/ui/VoiceRecognition';
import CameraInput from '../components/ui/CameraInput';
import FileInput from '../components/ui/FileInput';
import CursorGlow from '../components/ui/CursorGlow';
import TruegleLogo from '../components/ui/TruegleLogo';
import api, { aiAPI, shareAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useUnhingedGate } from '../hooks/useUnhingedGate';
import { FREE_ACCESS_MODE } from '../config/access';
import { MODE_COLORS, MODE_LABELS, MODE_TO_CONTEXT, getModeAccent, solidTextClass } from '../config/modeTheme';
import { getVideoEmbed, getPlayable } from '../utils/videoEmbed';
import { fmtStamp, fmtStampFull, msgTime } from '../utils/formatTime';
import QueueButton from '../components/ui/QueueButton';
import ChatShareButton from '../components/ui/ChatShareButton';
import SponsoredAd from '../components/ads/SponsoredAd';
import InvestigationGraph from '../components/ui/InvestigationGraph';
import FeedbackButtons from '../components/ui/FeedbackButtons';
import PillModeRow from '../components/landing/PillModeRow';
import CategoryModeRow from '../components/landing/CategoryModeRow';

// Truegle Chat is a designated route for chat-first users — the same brand
// (logo, mode-synced background/accents) as the rest of Truegle, but reduced
// to one thing: a chat box, with search results (links/pics/vids) cited
// inline. Deliberately no ads, no filters, no results grid — "Truegle in a
// nutshell with less clutter."

// Unhinged is in the list because it is one of the things you pick — alone for
// a casual conversation, or on top of a lens as a register. The backend treats
// it as a mode key OR a flag; both are gated identically (routes/ai.js).
const MODES = ['blue', 'green', 'red', 'purple', 'ocean', 'unhinged'];

// Persisted thread — so navigating away and coming back continues the same
// conversation instead of resetting to a cold welcome message.
const THREAD_KEY = 'truegle_chat_thread_v1';

// One-line explainer per mode for the "How do the modes work?" tutorial popover.
const MODE_INFO = {
  blue: 'Mainstream — establishment and widely-accepted sources. Balanced, cited answers.',
  green: 'Summarize — concise, plain-English answers with no jargon. Short and to the point.',
  red: 'Rabbit Hole — independent and suppressed perspectives that question the official narrative.',
  purple: 'Perspectives — lays out multiple viewpoints side by side with skeptical, accountability-first framing.',
  unhinged: 'Unhinged — off the record. Crude, sweary, no lectures. On its own it is a casual conversation; on top of another lens it changes the voice, not the research.',
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
  green: 'Ask me anything — I answer in a short, plain-language summary.',
  red: 'Rabbit Hole — independent and suppressed perspectives. What do you want to dig into?',
  purple: 'Perspectives mode — I lay out multiple viewpoints with skeptical, accountability-first framing. What would you like to explore?',
  ocean: 'OSINT assistant ready — ask about digital investigation or research.',
  unhinged: "Off the record. Say what you actually want to say — I'm not going to lecture you.",
};

function extractContent(chatResponse) {
  const r = chatResponse?.data?.response;
  return r?.choices?.[0]?.message?.content || r?.content || r || 'No response received.';
}

// Fetch citation material for a query: top links+videos from a general
// search, plus a small image strip — in parallel, independently gradeful
// when either call fails or comes back empty.
// True when a promise rejected because its AbortController was aborted (axios
// cancel or a fetch AbortError) — i.e. the user hit Stop, not a real failure.
const isAbortError = (e) =>
  e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';

async function fetchCitations(query, backendMode, signal) {
  const [webRes, imgRes] = await Promise.allSettled([
    api.post('/search', { query, mode: backendMode, filters: { category: 'all', perPage: 10 } }, { signal }),
    api.post('/search', { query, mode: backendMode, filters: { category: 'images', perPage: 6 } }, { signal }),
  ]);

  const webResults = webRes.status === 'fulfilled' ? (webRes.value.data.results || []) : [];
  const imgResults = imgRes.status === 'fulfilled' ? (imgRes.value.data.results || []) : [];

  const links = webResults.filter((r) => !getVideoEmbed(r.url)).slice(0, 4);
  const videos = webResults.filter((r) => getVideoEmbed(r.url)).slice(0, 3);
  const pics = imgResults.slice(0, 6);

  if (links.length === 0 && videos.length === 0 && pics.length === 0) return null;
  return { links, videos, pics };
}

// Turn fetched citations into a compact text block the model can actually
// ground its answer in — without this, the citations shown to the user are
// pulled from a real search but never seen by the model, which can then
// state something confidently that the sources don't say (or invent a
// source of its own) with no connection between the two.
function formatCitationsForPrompt(citations) {
  if (!citations) return null;
  const items = [...(citations.links || []), ...(citations.videos || [])];
  if (items.length === 0) return null;
  return items
    .map((r, i) => {
      const title = r.title || r.domain || r.url;
      const snippet = r.snippet ? `\n   ${r.snippet}` : '';
      return `${i + 1}. ${title}${snippet}\n   ${r.url}`;
    })
    .join('\n');
}

// Match http(s) URLs, stopping before trailing punctuation that's usually
// prose (a period, comma, closing paren) rather than part of the link.
const URL_RE = /https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"]/g;

// Pull every URL the model mentioned out of its answer, so bare links it
// quoted still end up in the Sources list at the bottom (deduped).
function extractUrls(text) {
  if (!text) return [];
  return [...new Set(text.match(URL_RE) || [])];
}

// react-markdown (no gfm plugin here) doesn't autolink bare URLs, so wrap any
// bare URL in <…> autolink syntax — while leaving URLs already inside a
// [label](url) markdown link or an existing <url> autolink untouched.
function linkifyBareUrls(text) {
  if (!text) return text;
  return text.replace(
    /(\[[^\]]*\]\([^)]*\)|<https?:\/\/[^>]+>)|(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])/g,
    (m, existing, bare) => (existing ? existing : `<${bare}>`),
  );
}

// Fold the model-mentioned URLs into the fetched citations' Sources list so
// every link named in the answer is clickable in the list below it, without
// duplicating any the search already surfaced.
function mergeUrlCitations(citations, urls) {
  if (!urls || urls.length === 0) return citations;
  const links = Array.isArray(citations?.links) ? citations.links : [];
  const seen = new Set(links.map((l) => l.url));
  const extra = urls.filter((u) => !seen.has(u)).map((u) => ({ url: u }));
  if (extra.length === 0) return citations;
  return { ...(citations || {}), links: [...links, ...extra] };
}

// All markdown links open in a new tab, safely.
const MD_COMPONENTS = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

// Small copy-to-clipboard icon button with a brief ✓ confirmation.
function CopyButton({ text, accent, title = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — no-op */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${copied ? 'text-green-300' : `text-white/40 hover:${accent?.link || 'text-white/70'}`}`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// Compact citation chip — the same three Truegle actions every result card
// gets: Open link, View anonymously (proxy), Open in app (inline expand). The
// whole chip is a click target that opens the link; the icons on the second
// row take over only when one is explicitly clicked.
function CitationChip({ result, accent }) {
  const [expanded, setExpanded] = useState(false);
  const videoEmbed = getVideoEmbed(result.url);
  const playable = getPlayable(result.url);
  let domain = result.domain || '';
  try {
    domain = new URL(result.url).hostname.replace(/^www\./, '');
  } catch { /* keep fallback */ }

  const openMain = () => window.open(result.url, '_blank', 'noopener,noreferrer');

  return (
    <div className={`rounded-lg border ${accent.iframeBorder} bg-white/5 overflow-hidden`}>
      <div
        role="link"
        tabIndex={0}
        onClick={openMain}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMain(); } }}
        className="px-2.5 py-2 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {result.image && (
            <img src={result.image} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs text-white/80 truncate">{result.title || domain}</div>
            <div className="text-[10px] text-white/40 truncate">{domain}</div>
          </div>
        </div>
        {/* Icons on their own line — larger tap targets. Clicking one overrides
            the whole-chip "open link" action above. */}
        <div className="flex items-center gap-1 mt-1.5 -ml-1" onClick={(e) => e.stopPropagation()}>
          <a href={result.url} target="_blank" rel="noopener noreferrer"
            title="Open link" className={`p-1.5 rounded-lg hover:bg-white/10 ${accent.link} transition-colors`}>
            <ExternalLink size={16} />
          </a>
          {result.proxyUrl && (
            <a href={result.proxyUrl} target="_blank" rel="noopener noreferrer"
              title="View anonymously — the site never sees your IP" className={`p-1.5 rounded-lg hover:bg-white/10 ${accent.link} transition-colors`}>
              <Eye size={16} />
            </a>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={videoEmbed ? 'Play here' : 'Open in app'}
            className={`px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-medium ${accent.link} transition-colors`}
          >
            {expanded ? 'Close' : videoEmbed ? '▶ Play' : 'In app'}
          </button>
          {playable && (
            <QueueButton
              source={{ ...playable, title: result.title || domain, pageUrl: result.url, poster: result.image }}
              className={accent.link}
            />
          )}
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

export function Citations({ citations, accent }) {
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

// Load the persisted mode selection as an array (multi-select). Falls back to
// the legacy single `truegle_mode_pref` so existing users keep their choice.
function loadModes() {
  try {
    const raw = localStorage.getItem('truegle_modes_pref');
    if (raw) {
      const arr = JSON.parse(raw);
      const clean = Array.isArray(arr) ? arr.filter((m) => MODES.includes(m)) : [];
      if (clean.length) return clean;
    }
  } catch { /* fall through to single-key */ }
  const single = localStorage.getItem('truegle_mode_pref');
  return [single && MODES.includes(single) ? single : 'blue'];
}

export default function TruegleChat() {
  const navigate = useNavigate();
  // Multi-select: the user can activate more than one flow at once and get a
  // single blended answer. `primaryMode` (first selected) drives theming,
  // background tint, citation sourcing, and OSINT routing.
  const [modes, setModes] = useState(loadModes);
  const primaryMode = modes[0] || 'blue';
  // UNHINGED replaces the old "vs. TrueGLE" toggle here (and the matching
  // "TrueGLE Mode" pill on the search page — both are gone as of 2026-08-13).
  const { isAuthenticated } = useAuth();
  // The gate itself (allowed? locked-tap handler? snap off when it closes?)
  // lives in useUnhingedGate, because the landing row and the search page's
  // row need exactly the same three behaviours. `unhinged` is DERIVED from
  // `modes`, not a second source of truth — it used to be its own useState and
  // its own button beside the lens row, which is precisely why it read as a
  // bolt-on: two selectors, two states, and the lens row silently outweighing
  // it. It is one of the modes now.
  const { unhingedAllowed, unhinged, onLockedUnhinged } = useUnhingedGate(modes, setModes);

  // Pill mode (search selector) — sits at the top, below the logo, exactly like
  // the landing page. Defaults to 'black' (Chat) on every /chat load: you're on
  // the chat page, so you chat by default and only leave to a /search page by
  // cycling the pill to a color and then sending. Not read from the shared
  // landing pref, to avoid arriving here already pointed at a search mode.
  // PillModeRow handles the cycle; onSelect just receives the next id.
  const [pillMode, setPillMode] = useState('black');
  // Search-category strip — shown in place of the chat modes whenever the pill
  // is on a search color (blue/green/red/purple/ocean). The pick rides the
  // /search URL as &category= when the query is submitted.
  const SEARCH_MODES = ['blue', 'green', 'red', 'purple', 'ocean'];
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchCatOpen, setSearchCatOpen] = useState(false);
  // Response length: verbose (in-depth) by default; the "Summarize" mode (green)
  // makes answers concise. Replaces the old "Feeling chat-e?" toggle.
  const verbose = !modes.includes('green');
  const [messages, setMessages] = useState(() => loadThread() || [
    { id: 1, role: 'assistant', content: MODE_WELCOME[localStorage.getItem('truegle_mode_pref') || 'blue'], citations: null },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const endRef = useRef(null);
  const lastMessageRef = useRef(null); // the newest message bubble — see the scroll effect below
  const inputRef = useRef(null);
  const abortRef = useRef(null); // in-flight send's AbortController (Stop button)
  const [mediaOpen, setMediaOpen] = useState(false); // chat input: mic/camera/attach expander
  const isAuthed = !!localStorage.getItem('truegle_token');
  const accent = getModeAccent(primaryMode);

  // Vertically-expanding chat box — same technique as the landing search bar:
  // grow line-by-line as the query is typed, capped before it scrolls internally.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [input]);

  // Toggle a mode on/off, but never let the selection go empty.
  const toggleMode = (m) => {
    if (m === 'unhinged' && !unhingedAllowed) {
      onLockedUnhinged();
      return;
    }
    setModes((prev) => {
      if (prev.includes(m)) return prev.length === 1 ? prev : prev.filter((x) => x !== m);
      return [...prev, m];
    });
  };

  useEffect(() => {
    localStorage.setItem('truegle_modes_pref', JSON.stringify(modes));
    localStorage.setItem('truegle_mode_pref', primaryMode); // keep single-key in sync for the search pages
  }, [modes, primaryMode]);
  // While sending (user's turn just appended, reply pending) scroll to the
  // bottom so the sent message + typing indicator are visible, same as any
  // chat app. Once the ANSWER lands, though, land on its BEGINNING instead of
  // scrolling past it to the bottom — the user reads top-down, not bottom-up.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Persist the thread on every change so a page-away-and-back resumes it.
  // Wrapped because localStorage can throw (quota / private mode); a failed
  // save must never break the chat.
  useEffect(() => {
    try { localStorage.setItem(THREAD_KEY, JSON.stringify(messages)); } catch { /* over quota — skip */ }
  }, [messages]);

  const resetThread = () => {
    setMessages([{ id: Date.now(), role: 'assistant', content: MODE_WELCOME[primaryMode], citations: null, createdAt: Date.now() }]);
    setShareUrl('');
  };

  // "Edit" a prior prompt: drop its text back into the input box so it can be
  // tweaked and re-sent (the original turn stays in the thread as history).
  const editPrompt = (text) => {
    setInput(text || '');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSentRef = useRef(false); // guard so ?q= / ?hasImage= silent-transport fires once
  // Image handed off from the search bar's attach button (see SearchBar.jsx —
  // it can't reason over pixels, so it stashes the file and routes here).
  // Attaches to the NEXT turn only, then clears.
  const [attachedImage, setAttachedImage] = useState(null); // { dataUrl, name } | null

  // Persist the whole thread server-side and produce a link that opens the LIVE
  // conversation (messages + cited media/links) for anyone — not pasted text.
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    setShareCopied(false);
    try {
      const payload = {
        modes,
        title: messages.find((m) => m.role === 'user')?.content?.slice(0, 120) || 'Truegle conversation',
        messages: messages
          .filter((m) => m.id !== 1)
          .map((m) => ({ role: m.role, content: m.content, citations: m.citations || null, graph: m.graph || null, createdAt: msgTime(m) })),
      };
      const kind = modes.includes('ocean') ? 'investigation' : 'chat';
      const res = await shareAPI.create(kind, payload);
      const url = `${window.location.origin}${res.data.path}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setShareCopied(true); } catch { /* clipboard blocked — link still shown */ }
    } catch {
      setShareUrl('error');
    } finally {
      setSharing(false);
    }
  };

  const handleSend = async (explicitText, explicitImage) => {
    // Accept an explicit query (e.g. the ?q= silent-transport from the landing
    // page) or fall back to the input box. Same for the image: the mount-time
    // handoff effect passes it explicitly (avoids a same-tick state-read race
    // with setAttachedImage); a manual send picks up whatever's attached.
    const text = (typeof explicitText === 'string' ? explicitText : input).trim();
    const image = explicitImage !== undefined ? explicitImage : attachedImage;
    // An attached image is a valid turn on its own ("what does this say?");
    // otherwise real text is required as before.
    if ((!text && !image) || loading) return;

    // Pill mode is the search selector (same as landing): if it's on a non-Chat
    // color, sending leaves chat and opens that /search page instead of chatting.
    if (pillMode !== 'black') {
      if (pillMode === 'orange') { navigate('/rewards'); return; }
      if (pillMode === 'yellow') { navigate('/extract'); return; }
      const catParam = searchCategory && searchCategory !== 'all' ? `&category=${searchCategory}` : '';
      navigate(`/search?q=${encodeURIComponent(text)}&mode=${pillMode}${catParam}`);
      return;
    }

    if (!FREE_ACCESS_MODE && !isAuthed) {
      navigate('/auth/login', { state: { redirectTo: '/chat' } });
      return;
    }

    const query = text;
    // Prior turns → working memory for a real back-and-forth. Skip the id:1
    // welcome (not a real exchange). Send only role/content, no media payloads
    // (the image itself isn't replayed into history — see aiAPI.chat call below).
    const history = messages
      .filter((m) => m.id !== 1)
      .map((m) => ({ role: m.role, content: m.content }));
    // Abortable send: the Stop button (shown while thinking) cancels this and
    // rolls the accidental turn back — the user message is removed and its text
    // is restored to the input so it can be edited or discarded.
    const controller = new AbortController();
    abortRef.current = controller;
    const userMsgId = Date.now();
    let aborted = false;

    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: query, citations: null, image: image?.dataUrl || null, createdAt: userMsgId }]);
    setInput('');
    setAttachedImage(null); // one-shot — attaches to this turn only
    setLoading(true);

    let content;
    let citations = null;
    let graph = null;

    // Ocean selected → auto-OSINT: if the query names an investigable entity
    // (domain/IP/email/username/phone) the backend runs the lookups and
    // synthesizes an investigator's report. If it names none, fall through to
    // normal chat so methodology questions still get answered.
    if (modes.includes('ocean')) {
      try {
        const res = await api.post('/osint/investigate', { query }, { signal: controller.signal });
        const d = res.data;
        if (d?.report) {
          content = d.report;
          citations = (d.artifacts && d.artifacts.length) ? { links: d.artifacts } : null;
          graph = d.graph || null; // GraphiPy-style investigation graph
        }
      } catch (e) { if (isAbortError(e)) aborted = true; /* else fall through to chat below */ }
    }

    if (content === undefined && !aborted) {
      // Search FIRST, then chat — the model needs the real results to ground
      // its answer in, not just a citations panel bolted on afterward with no
      // connection to what it actually says. An attached image is analyzed
      // directly by the model — a web-search citation lookup doesn't apply
      // (and an empty-text query would just waste a request when the turn is
      // image-only).
      citations = query
        ? await fetchCitations(query, MODE_TO_BACKEND_SEARCH[primaryMode], controller.signal)
            .catch((e) => { if (isAbortError(e)) aborted = true; return null; })
        : null;
      const searchResults = formatCitationsForPrompt(citations);

      // Pass the pill keys (blue/green/red/purple/ocean) as `modes` so the
      // backend blends each lens; `context` (primary) still keys cache/DB.
      if (!aborted) {
        try {
          const chatRes = await aiAPI.chat(query, {
            context: MODE_TO_CONTEXT[primaryMode], modes, unhinged, verbose, history,
            image: image?.dataUrl, searchResults,
          }, { signal: controller.signal });
          content = extractContent(chatRes);
        } catch (e) {
          if (isAbortError(e)) aborted = true;
          else content = "Sorry, I couldn't reach the AI just now — try again in a moment.";
        }
      }
    }

    abortRef.current = null;
    if (aborted) {
      // Roll the cancelled turn back and hand its text back to the input.
      setMessages((prev) => prev.filter((mm) => mm.id !== userMsgId));
      setInput(query);
      setLoading(false);
      return;
    }
    setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content, citations, graph, createdAt: Date.now() }]);
    setLoading(false);
  };

  // Stop button — abort the in-flight send (see handleSend's rollback).
  const handleStop = () => { abortRef.current?.abort(); };

  // Silent transport: the landing page routes a first query here as /chat?q=…,
  // and the search bar's image-attach button routes here as ?hasImage=1 (with
  // the actual image stashed in sessionStorage — see SearchBar.jsx). Handled
  // together in one effect so a combined "typed a question, then attached an
  // image" handoff sends both in the SAME turn: reading the image and calling
  // handleSend must happen in one pass, not across two effects racing on the
  // same setAttachedImage/searchParams update.
  useEffect(() => {
    if (autoSentRef.current) return;
    const q = searchParams.get('q');
    const hasImage = searchParams.get('hasImage') === '1';
    if (!q?.trim() && !hasImage) return;
    autoSentRef.current = true;

    let image = null;
    if (hasImage) {
      try {
        const raw = sessionStorage.getItem('truegle_pending_image');
        sessionStorage.removeItem('truegle_pending_image');
        if (raw) image = JSON.parse(raw);
      } catch { /* corrupt/missing — just skip the attachment */ }
    }
    setSearchParams({}, { replace: true });

    if (q?.trim()) {
      handleSend(q, image); // text (+ optional image) → send immediately
    } else if (image) {
      setAttachedImage(image); // image only, no text yet — stage it, wait for the user to ask
    }
  }, [searchParams]); // one-shot guarded by autoSentRef; deliberately params-only

  // Chat-mode cluster — sits below the final AI output, above the input box.
  // Multi-select lenses (tap to toggle; 2+ blend into one answer, first pick
  // "primary" drives the theme), plus the TrueGLE vs (dual-audit) toggle and
  // the Modes tutorial. Selected buttons get a SOLID fill in the mode's color
  // so the active state is unmistakable.
  const modesRow = (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {MODES.map((m) => {
          const active = modes.includes(m);
          const isPrimary = active && primaryMode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleMode(m)}
              aria-pressed={active}
              title={m === 'unhinged' && !unhingedAllowed
                ? (isAuthenticated ? 'Unhinged is locked — turn Safe Search off in Settings' : 'Unhinged is locked — sign in, then turn Safe Search off')
                : active ? `${MODE_LABELS[m]} active — tap to remove` : `Add ${MODE_LABELS[m]} lens`}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? solidTextClass(m)
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
              } ${isPrimary ? 'ring-2 ring-white/60' : ''}`}
              style={active ? { backgroundColor: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : undefined}
            >
              {m === 'unhinged' && !unhingedAllowed && <Lock size={10} className="inline mr-1 -mt-0.5" />}
              {MODE_LABELS[m]}
            </button>
          );
        })}

        {/* Modes tutorial — explains the lenses; lives with them at the bottom. */}
        <div
          className="relative"
          onMouseEnter={() => setShowTutorial(true)}
          onMouseLeave={() => setShowTutorial(false)}
        >
          <button
            type="button"
            onClick={() => setShowTutorial((v) => !v)}
            aria-expanded={showTutorial}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-white/5 border-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] leading-none">?</span>
            Modes
          </button>
          <AnimatePresence>
            {showTutorial && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute z-30 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 max-w-[85vw] rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl p-3 text-left shadow-2xl"
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
                  Answers are in-depth by default; pick <span className="font-semibold" style={{ color: MODE_COLORS.green }}>Summarize</span> for a concise version.
                  Add <span className="text-cyan-300">vs. TrueGLE</span> to dual-audit contested claims. Selections stick across pages.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {modes.length > 1 && (
        <div className="text-[11px] text-white/40">
          Blending {modes.length} lenses — <span className="text-white/60">{modes.map((m) => MODE_LABELS[m]).join(' + ')}</span>
        </div>
      )}
    </div>
  );

  // The input box itself — extracted so it can render inline in the thread
  // (appearing directly below the latest response) instead of pinned to the
  // page bottom.
  const chatInputBox = (
    <div className="space-y-2">
      {attachedImage && (
        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${accent.iframeBorder} bg-white/5`}>
          <img src={attachedImage.dataUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
          <span className="text-xs text-white/60 truncate flex-1">{attachedImage.name}</span>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            aria-label="Remove attached image"
            className="text-white/40 hover:text-white/80 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className={`flex items-end gap-2 rounded-2xl border ${accent.iframeBorder} bg-white/5 backdrop-blur-xl p-2`}>
        {/* Input modes — mic / camera / attach, collapsed behind a "+" so the
            chat box reads like a normal input. */}
        <button
          type="button"
          onClick={() => setMediaOpen((v) => !v)}
          aria-label={mediaOpen ? 'Hide input options' : 'More input options'}
          aria-expanded={mediaOpen}
          className="flex-shrink-0 w-8 h-8 mb-0.5 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <Plus size={18} className={`transition-transform ${mediaOpen ? 'rotate-45' : ''}`} />
        </button>
        {mediaOpen && (
          <div className="flex items-center gap-0.5 mb-1 flex-shrink-0">
            <VoiceRecognition
              onTranscriptChange={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
              size={16}
            />
            <CameraInput
              onSearchSubmit={(dataUrl) => { if (dataUrl) { setAttachedImage({ dataUrl, name: 'Photo' }); setMediaOpen(false); } }}
              size={16}
            />
            <FileInput
              onFileSelect={(files) => {
                const f = files?.[0];
                if (!f?.file) return;
                if (f.type?.startsWith('image/')) {
                  const r = new FileReader();
                  r.onload = (e) => { setAttachedImage({ dataUrl: e.target.result, name: f.name }); setMediaOpen(false); };
                  r.readAsDataURL(f.file);
                } else if (f.type?.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(f.name)) {
                  const r = new FileReader();
                  r.onload = (e) => setInput((e.target.result || '').slice(0, 2000).trim());
                  r.readAsText(f.file);
                } else {
                  setInput((prev) => (prev ? prev : f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')));
                }
              }}
              size={16}
            />
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={attachedImage ? 'Ask about this image (or leave blank to describe it)…' : 'Ask Truegle anything...'}
          style={{ minHeight: '40px', maxHeight: '240px' }}
          className="flex-1 bg-transparent resize-none overflow-y-auto outline-none text-white placeholder-white/30 text-sm p-2"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={(!input.trim() && !attachedImage) || loading}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            (input.trim() || attachedImage) && !loading ? `${accent.link} bg-white/10 hover:bg-white/20` : 'text-white/20 bg-white/5 cursor-not-allowed'
          }`}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );

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
          key={primaryMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${MODE_COLORS[primaryMode]}26, transparent 60%)`,
          }}
        />
      </AnimatePresence>
      <CursorGlow />

      <div className="relative z-10 h-[100dvh] flex flex-col items-center px-4 pt-5 pb-3">
        {/* Hero logo — mirrors the landing page's treatment (glow + gentle
            pulse + reflection) so /chat reads as the same brand, sized down to
            fit the fixed-height chat shell rather than the scrollable landing. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-2 inline-block flex-shrink-0"
        >
          <div
            className="relative"
            style={{ filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.3)) drop-shadow(0 0 40px rgba(139,92,246,0.2))' }}
          >
            <motion.div
              animate={{ scale: [1, 1.01, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <TruegleLogo variant="chat" size="large" animated />
            </motion.div>
            {/* Reflection underneath the logo (same as landing) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                top: '100%',
                width: '100%',
                height: '40px',
                background: 'linear-gradient(to bottom, rgba(139,92,246,0.3) 0%, transparent 100%)',
                filter: 'blur(20px)',
                transform: 'scaleY(-0.3) translateY(-20px)',
                opacity: 0.5,
              }}
            />
          </div>
        </motion.div>

        {/* Pill mode (search selector) — top of the page, below the logo, just
            like the landing page. Cycling is state-only; a non-Chat pill sends
            the query to that /search page (see handleSend). */}
        <div className="mb-3 flex-shrink-0">
          <PillModeRow activeMode={pillMode} onSelect={setPillMode} />
        </div>

        {/* Hero chat-mode row — a compact, always-visible copy of the lens pills
            directly below the Chat pill, so modes can be switched from the top of
            the page too. Shares the same `modes` state as the row below the chat
            box, so the two stay perfectly in sync. Chat pill only. */}
        {pillMode === 'black' && (
          <div className="mb-3 flex-shrink-0 flex items-center gap-1.5 flex-wrap justify-center max-w-2xl">
            {MODES.map((m) => {
              const active = modes.includes(m);
              const isPrimary = active && primaryMode === m;
              return (
                <button
                  key={`hero-${m}`}
                  type="button"
                  onClick={() => toggleMode(m)}
                  aria-pressed={active}
                  title={m === 'unhinged' && !unhingedAllowed
                ? (isAuthenticated ? 'Unhinged is locked — turn Safe Search off in Settings' : 'Unhinged is locked — sign in, then turn Safe Search off')
                : active ? `${MODE_LABELS[m]} active — tap to remove` : `Add ${MODE_LABELS[m]} lens`}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    active ? solidTextClass(m) : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
                  } ${isPrimary ? 'ring-2 ring-white/60' : ''}`}
                  style={active ? { backgroundColor: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : undefined}
                >
                  {m === 'unhinged' && !unhingedAllowed && <Lock size={9} className="inline mr-1 -mt-0.5" />}
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        )}

        {/* Session utilities — Share / New chat (only once a thread exists). */}
        {messages.length > 1 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap justify-center flex-shrink-0">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              title="Create a link that opens this whole conversation for anyone"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-white/5 border-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
            >
              <Share2 size={11} /> {sharing ? 'Sharing…' : 'Share'}
            </button>
            <button
              type="button"
              onClick={resetThread}
              title="Start a new conversation"
              className="px-2.5 py-1 rounded-full text-xs font-medium border bg-white/5 border-white/10 text-white/40 hover:text-white/70 transition-colors"
            >
              New chat
            </button>
          </div>
        )}

        {/* Shareable-link result */}
        {shareUrl && (
          <div className="w-full max-w-2xl mb-2 flex-shrink-0">
            {shareUrl === 'error' ? (
              <div className="text-[11px] text-red-300/80 text-center">Couldn't create a share link — try again in a moment.</div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5">
                <span className="text-[11px] text-green-300 flex-shrink-0">{shareCopied ? '✓ Link copied' : 'Share link:'}</span>
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 bg-transparent text-[11px] text-white/70 outline-none truncate"
                />
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={`text-[11px] flex-shrink-0 ${accent.link}`}>Open</a>
              </div>
            )}
          </div>
        )}

        {/* Message thread — takes the majority of the page; input stays pinned
            below it and above the mobile keyboard (dvh container). */}
        <div className="w-full max-w-2xl flex-1 min-h-0 space-y-4 mb-3 overflow-y-auto">
          {messages.map((m, i) => {
            // The user turn this answer responded to — sent as feedback context.
            const priorQuery = m.role === 'assistant'
              ? [...messages.slice(0, i)].reverse().find((p) => p.role === 'user')?.content
              : undefined;
            return (
            <Fragment key={m.id}>
            <motion.div
              ref={i === messages.length - 1 ? lastMessageRef : undefined}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 select-text ${
                  m.role === 'user'
                    ? 'bg-white/10 text-white'
                    : `bg-black/40 border ${accent.iframeBorder} text-white/90`
                }`}
                style={{ WebkitUserSelect: 'text', userSelect: 'text', WebkitTouchCallout: 'default' }}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_a]:text-inherit [&_a]:underline [&_a]:break-words">
                    <ReactMarkdown components={MD_COMPONENTS}>{linkifyBareUrls(m.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    {m.image && (
                      <img src={m.image} alt="Attached" className="max-w-full max-h-64 rounded-lg mb-2 object-contain" />
                    )}
                    {m.content && <p className="text-sm">{m.content}</p>}
                    {m.content && (
                      <div className="mt-1.5 -mb-1 flex items-center justify-end gap-0.5">
                        <CopyButton text={m.content} accent={accent} title="Copy prompt" />
                        <button
                          type="button"
                          onClick={() => editPrompt(m.content)}
                          title="Edit — reuse this prompt in the input box"
                          className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
                {/* One ad after the response — orange-outlined, "Sponsored". */}
                {m.role === 'assistant' && m.id !== 1 && (
                  <div className="my-3">
                    <SponsoredAd />
                  </div>
                )}
                <Citations
                  citations={m.role === 'assistant' ? mergeUrlCitations(m.citations, extractUrls(m.content)) : m.citations}
                  accent={accent}
                />
                {m.graph && <InvestigationGraph graph={m.graph} accent={accent} />}
                {/* One ad after the final results links (citations). */}
                {m.role === 'assistant' && m.id !== 1 && (
                  <div className="mt-3">
                    <SponsoredAd />
                  </div>
                )}
                {m.role === 'assistant' && m.id !== 1 && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <ChatShareButton message={m} />
                      <CopyButton text={m.content} accent={accent} title="Copy answer" />
                    </div>
                    <FeedbackButtons answer={m.content} query={priorQuery} mode={modes.join('+')} />
                  </div>
                )}
              </div>
              {msgTime(m) && (
                <time
                  dateTime={new Date(msgTime(m)).toISOString()}
                  title={fmtStampFull(msgTime(m))}
                  className="mt-1 px-1 text-[10px] text-white/30 tabular-nums select-none"
                >
                  {fmtStamp(msgTime(m))}
                </time>
              )}
            </motion.div>
            </Fragment>
            );
          })}
          {/* Disappear/reappear flow: while a reply is in flight, the input is
              replaced by the loading indicator; once it lands, the mode row +
              input reappear directly below the finalized response — never
              pinned to the page bottom. */}
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex justify-start w-full">
                <div className={`rounded-2xl px-4 py-3 bg-black/40 border ${accent.iframeBorder} flex items-center gap-2`}>
                  <span className={`w-2 h-2 rounded-full animate-bounce ${accent.count}`} style={{ backgroundColor: 'currentColor', animationDelay: '0ms' }} />
                  <span className={`w-2 h-2 rounded-full animate-bounce ${accent.count}`} style={{ backgroundColor: 'currentColor', animationDelay: '150ms' }} />
                  <span className={`w-2 h-2 rounded-full animate-bounce ${accent.count}`} style={{ backgroundColor: 'currentColor', animationDelay: '300ms' }} />
                </div>
              </div>
              {/* Stop — cancels an accidental send and restores the prompt. */}
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <X size={13} /> Stop
              </button>
            </div>
          ) : (
            <motion.div
              key={messages[messages.length - 1]?.id ?? 'input'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 pt-1"
            >
              {/* Chat lenses when in Chat mode; when a search color is picked,
                  the chat modes are replaced by the search-category strip. */}
              {SEARCH_MODES.includes(pillMode) ? (
                <CategoryModeRow
                  activeCategory={searchCategory}
                  onSelect={setSearchCategory}
                  open={searchCatOpen}
                  onToggleOpen={() => setSearchCatOpen((v) => !v)}
                  accentColor={MODE_COLORS[pillMode]}
                />
              ) : (
                modesRow
              )}
              <div className="w-full">{chatInputBox}</div>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
