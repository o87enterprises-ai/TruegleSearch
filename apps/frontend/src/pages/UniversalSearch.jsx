import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Markdown from '../components/ui/Markdown';
import { FREE_ACCESS_MODE } from '../config/access';
import {
  ChevronDown,
  Sparkles,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Eye,
  X,
  MapPin,
  PlayCircle,
  PauseCircle,
  ChevronsDown,
} from 'lucide-react';

// Backgrounds - Import all backgrounds
import { WarpSpeedBackground } from '../components/backgrounds/WarpSpeedBackground';
import { DeepSpaceBackground } from '../components/backgrounds/DeepSpaceBackground';
import DeepSeaEnhanced from '../components/backgrounds/DeepSeaEnhanced';
import DeepseekParticles from '../components/backgrounds/DeepseekParticles';
import LightRays from '../components/backgrounds/LightRays';
import LetterGlitch from '../components/backgrounds/LetterGlitch';

// Components
import TruegleLogo from '../components/ui/TruegleLogo';
import SearchBar from '../components/ui/SearchBar';
import MultimediaInterface from '../components/ui/MultimediaInterface';
import InlineSummaryChat from '../components/search/InlineSummaryChat';
import { SkeletonSearchResult } from '../components/ui/Skeleton';
import QuickAnswerCard from '../components/ui/QuickAnswerCard';
import BusinessPanelCard from '../components/ui/BusinessPanelCard';
import { usePlacePanel } from '../hooks/usePlacePanel';
import AsSeenOn from '../components/Content/AsSeenOn';
import PerspectiveSelector from '../components/search/PerspectiveSelector';
import RabbitHoleFold from '../components/search/RabbitHoleFold';
import { readThroughLens } from '../utils/perspectiveLens';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { MapViewWrapper } from '../components/map';
import QuickResultCard from '../components/ui/QuickResultCard';
import TruegleShareButton from '../components/ui/TruegleShareButton';
import OSINTToolsPanel from '../components/ui/OSINTToolsPanel';
import TokenGate from '../components/ui/TokenGate';
import RepairsModal from '../components/ui/RepairsModal';
import LanguageSelector from '../components/ui/LanguageSelector';
// OsintClassRow is retired on the ocean page (the OSINT Tools module owns tool
// selection); osintHintPrefix is still used to tag ocean web searches.
import { osintHintPrefix } from '../components/search/OsintClassRow';
import PillModeRow from '../components/landing/PillModeRow';
import ChatModeRow from '../components/landing/ChatModeRow';
import { useUnhingedGate } from '../hooks/useUnhingedGate';
import CreatorHeader, { CreatorPill } from '../components/creator/CreatorHeader';
import { recordRef } from '../utils/creatorRef';

// Hooks and Config
import { useSearchMode } from '../hooks/useSearchMode';
import { useLocationDetection, parseLocalQuery } from '../hooks/useLocationDetection';
import useDeviceTier from '../hooks/useDeviceTier';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { isQuestionQuery, getQuickAnswer } from '../utils/queryIntent';
import { classifyQuery, describeLink } from '../utils/urlQuery';
import { useSearchStashContext } from '../context/SearchStashContext';
import ReelsSurface from '../components/reels/ReelsSurface';
import SingleLinkCard from '../components/search/SingleLinkCard';

// Frontend mode -> the string /api/search and /api/ai/summary expect. Was
// inlined in handleSearch; the pasted-link path needs the same mapping and a
// second copy is how the two drift apart.
// ('green' makes the backend filter AI-generated-content domains.)
const modeToBackend = (mode) => ({
  red: 'red-pill',
  purple: 'purple',
  ocean: 'ocean',
  green: 'green',
}[mode] || 'blue-pill');
import { LITE_BG, PERSPECTIVE_COLORS, getModeAccent, MODE_LABELS, MODE_COLORS } from '../config/modeTheme';

// The five selectable flows. The active `mode` (from URL/toggle) is the PRIMARY
// — it drives which sources/results are fetched. Additional lenses selected
// here only blend into the AI summary + follow-up chat, so the results grid and
// its routing are never destabilized by multi-select.
const LENS_MODES = ['blue', 'green', 'red', 'purple', 'ocean'];
// Modes with no AI surfaces at all — no summary banner, no quick answer, and
// no request fired for either. Green is summarise-only by definition; Tube is
// a player, and an answer card above the video is noise.
const AI_FREE_MODES = new Set(['green', 'tube']);
const isAiFree = (m) => AI_FREE_MODES.has(m);
const MODE_TO_BACKEND = { blue: 'blue-pill', green: 'green', red: 'red-pill', purple: 'purple', ocean: 'ocean', tube: 'blue-pill' };

// FOLDED MODES. Perspectives is no longer a mode of its own — its one job
// ("show me this from another angle") is now the Rabbit Hole fold, which does
// it without a page, a background, or a round trip you didn't ask for.
//
// The old entry points still resolve. ?mode=purple and /biased land on Red
// with the fold already open, so bookmarks, shared links and every citation
// the assistant ever emitted keep working instead of quietly becoming a
// different page. Nothing here deletes purple's code paths: the rerun still
// uses the same perspective ids and the same backend mapping.
const FOLDED_MODES = { purple: 'red' };
const foldMode = (m) => FOLDED_MODES[m] || m;
import { getVideoEmbed, getPlayable, mediaKey } from '../utils/videoEmbed';
import { canPreview, opensOnLabel } from '../utils/embeddable';
import api from '../services/api';
import { fallbackVideos } from '../content/creatorVideosFallback';
import QueueButton from '../components/ui/QueueButton';
import { isShortForm, asReel } from '../utils/shortForm';
import { useFeedAutoplay } from '../hooks/useFeedAutoplay';
import TrueglePlayer from '../components/player/TrueglePlayer';
import { setPlayerQuery } from '../utils/playerQueryStore';
import { toHandle, SEARCH_SCOPES } from '../utils/playerQuery';

// Guarded so a hand-typed ?scope=whatever can't put the chips into a state
// that has no chip.
const SEARCH_SCOPE_IDS = new Set(SEARCH_SCOPES.map((s) => s.id));
import { parsePlayerParams, resolveShareInput } from '../utils/playerLink';
import { usePlayer } from '../context/PlayerContext';

// The SearchFiltersBar "category" dropdown offers political/content labels
// (mainstream, conspiracy, democratic, republican, nonpartisan, music, videos,
// socials, reels, shopping) that don't match the backend's own category/bias
// vocab directly — map them through so picking one actually changes results
// instead of silently doing nothing.
const FILTER_CATEGORY_BIAS_MAP = {
  mainstream: 'mainstream',
  conspiracy: 'conspiracy',
  democratic: 'left',
  republican: 'right',
  nonpartisan: 'center',
};
const FILTER_CATEGORY_TYPE_MAP = {
  music: 'web',
  videos: 'videos',
  socials: 'social',
  reels: 'videos',
  shopping: 'shopping',
};

// useLocationDetection queryTypes that mean the user explicitly wants a map.
// 'location' (generic "in/at/near <place>" phrasing) and 'place' (fuzzy
// geocode fallback) are deliberately excluded — they show a "View map" chip.
const MAP_AUTO_OPEN_TYPES = ['geolocation', 'directions', 'zipcode'];

// `creator` turns this into a creator page: the SAME Tube page — same logo,
// pill row, search bar, player and results — with the creator's identity block
// between the logo and the bar. The old /creator/:slug was a seventh copy of
// the search layout and had already drifted away from every other page; this
// makes "on brand" true by construction rather than by re-matching it by hand
// every time something changes. Same reasoning as /tube itself being a mode.
export default function UniversalSearch({ lockedGreen = false, lockedTube: lockedTubeProp = false, creator = null }) {
  const lockedTube = lockedTubeProp || !!creator;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { settings, updateSetting } = useSettings();
  const { allowHeavyAnimations } = useDeviceTier();

  // Get query from URL
  const query = searchParams.get('q') || '';
  const queryIsQuestion = isQuestionQuery(query);

  // Routes that ARE a mode (shareable in their own right) rather than a query
  // string on /search. Their path is what the user shares and lands back on.
  // Searching from a creator page must stay ON that creator page — this path
  // is what the URL is rewritten to after a search, and /tube would have
  // quietly thrown the visitor off the creator they were watching.
  const lockedPath = lockedGreen ? '/green'
    : creator ? `/creator/${creator.slug}`
      : lockedTube ? '/tube' : null;

  // Mode management - Default to 'blue' (SearchPortal)
  const modeParam = searchParams.get('mode');
  const { mode: autoMode, modeConfig, overrideMode } = useSearchMode(query);
  // Persist mode preference across sessions — if user has set a preference, honour it;
  // URL param overrides (so direct links like ?mode=red still work).
  const [mode, setMode] = useState(() => {
    if (lockedGreen) return 'green';
    if (lockedTube) return 'tube';
    if (modeParam) return foldMode(modeParam);
    return foldMode(localStorage.getItem('truegle_mode_pref') || 'blue');
  });
  // Arriving from an old Perspectives link opens the fold, so the control that
  // replaced that page is the first thing on screen rather than something to
  // go hunting for.
  const arrivedFolded = modeParam === 'purple' || searchParams.get('fold') === '1';
  // Single cycling pill (same control as the landing page). Reflects the
  // current search mode; cycling stages a new one and submitting navigates to
  // it (black = Chat -> /chat, orange/yellow -> their page, else /search?mode=).
  const [pillMode, setPillMode] = useState(mode);
  // Cycling the pill to Chat has to change the row UNDER the bar too. It
  // didn't: the categories are driven by `mode`, which only updates on submit,
  // so the pill said Chat while All / Local / Maps / Pics / Reels sat
  // underneath it offering things chat has no concept of.
  //
  // Same localStorage keys the landing page and TruegleChat use, so a lens
  // staged here carries silently into /chat on submit.
  const [chatModes, setChatModes] = useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('truegle_modes_pref') || 'null');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch { /* fall through */ }
    return ['blue'];
  });
  const [chatModesOpen, setChatModesOpen] = useState(false);
  // Same gate as the landing row and /chat — one definition, three selectors.
  const { unhingedAllowed, onLockedUnhinged } = useUnhingedGate(chatModes, setChatModes);
  const toggleChatMode = (id) => {
    if (id === 'unhinged' && !unhingedAllowed) { onLockedUnhinged(); return; }
    setChatModes((prev) => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };
  useEffect(() => {
    try {
      localStorage.setItem('truegle_modes_pref', JSON.stringify(chatModes));
      localStorage.setItem('truegle_mode_pref', chatModes[0]);
    } catch { /* private mode */ }
  }, [chatModes]);
  // Staging Chat should show the lenses without a second tap — that is the
  // whole point of the row appearing.
  useEffect(() => { if (pillMode === 'black') setChatModesOpen(true); }, [pillMode]);
  useEffect(() => { setPillMode(mode); }, [mode]);

  // The "TrueGLE Mode" pill was REMOVED here (owner's call, 2026-08-13) along
  // with the landing page's "vs. TrueGLE" toggle. The Null-Prime dual-audit
  // protocol is not gone — it is part of how the backend frames contested
  // claims — it just is not a user-facing switch any more. The backend still
  // accepts `nepheshMode`, so nothing on that side had to change.
  // Search-page AI (summary + follow-up chat) is always CONCISE — "Summarize"
  // is the fixed default here, so there's no verbosity toggle (the old
  // "Feeling chat-e?" control was removed). Chat gets the opposite default
  // (verbose) via TruegleChat's own derivation.
  const SEARCH_VERBOSE = false;

  // Summary banner: null = not chosen, 'show' = show for session, 'none' = dismissed for session
  const [sessionSummaryChoice, setSessionSummaryChoice] = useState(
    () => sessionStorage.getItem('truegle_summary_choice') || null
  );
  const [showNoSummaryConfirm, setShowNoSummaryConfirm] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  // First-search modal: shown exactly once ever (localStorage, not sessionStorage).
  // Skip entirely if user already has a saved preference.
  const [showFirstSearchModal, setShowFirstSearchModal] = useState(false);
  const [firstSearchDone, setFirstSearchDone] = useState(
    () => localStorage.getItem('truegle_mode_pref_asked') === 'true'
  );

  // Search state
  const [searchValue, setSearchValue] = useState(query);
  const [activeCategory, setActiveCategory] = useState('all');
  // ── REELS IS A SURFACE, NOT A RESULT SHAPE ────────────────────────────────
  // "When reels selection is made it opens to full screen 4 quarters." Picking
  // the pill opens the grid rather than re-rendering the ordinary result list
  // with taller thumbnails — a reel is watched, not read, and a list of links
  // to vertical video was the wrong container for it.
  //
  // Closing it drops the category back to All, so the page underneath is not
  // left showing a Reels pill over a list the pill no longer describes.
  const [reelsOpen, setReelsOpen] = useState(false);
  const selectCategory = useCallback((id) => {
    setActiveCategory(id);
    if (id === 'reels') setReelsOpen(true);
  }, []);
  // Viewport-driven autoplay for the results feed: the visible playable result
  // plays, the rest stay still, and (optionally) the page walks itself down.
  const feed = useFeedAutoplay();
  // Tube docks the one player into this page; popping it out hands it to the
  // floating frame and leaves a way back.
  const {
    poppedOut, setPoppedOut, current: playerCurrent,
    expanded: tubeExpanded, setExpanded, enqueueMany, play,
    startFeed, stopFeed, feedActive,
  } = usePlayer();
  // The screen drops out of the bar on its own the first time there's
  // something to show, but `expanded` stays authoritative after that — a
  // purely derived flag can never be collapsed back, which is what made the
  // collapse control appear broken.
  // Docked = the player is living inside this page's search bar. Popped out,
  // the page is an ordinary search page again.
  const tubeDocked = mode === 'tube' && !poppedOut;
  // A shared player link is now just /tube?u=…&t=… — same page, arriving with
  // a queue. Everything a `u` has to survive (getPlayable or it isn't
  // rendered at all) is enforced inside parsePlayerParams; unplayable values
  // are dropped rather than shown, because this page has no inert-text slot
  // for them the way /l does.
  const sharedLoaded = useRef(false);
  useEffect(() => {
    if (!lockedTube || sharedLoaded.current) return;
    const { sources } = parsePlayerParams(searchParams.toString());
    if (!sources.length) return;
    sharedLoaded.current = true;
    enqueueMany(sources);
    play(sources[0]);
  }, [lockedTube, searchParams, enqueueMany, play]);

  // ── shared INTO Truegle from another app ─────────────────────────────────
  // The manifest registers Truegle as a share target, so once it is installed
  // it appears in the phone's own share sheet. Sharing a video from YouTube,
  // Reddit or a browser lands here and plays it — that is the whole
  // interaction, and it is the closest a web app gets to being a place you
  // can throw things at from the home screen.
  //
  // Android is inconsistent about WHERE it puts the link: some apps fill the
  // `url` field, most stuff it into `text` next to the title. Both are read,
  // and a URL is dug out of the text when that is all there is.
  // Visiting a creator's page attributes traffic to them.
  useEffect(() => { if (creator?.refCode) recordRef(creator.refCode); }, [creator]);

  // The creator's uploads, newest first — the card's "latest" tile, and the
  // queue the page starts you on. Falls back to the committed snapshot when
  // the live feed is empty, same as the old page did.
  const [creatorVideos, setCreatorVideos] = useState([]);
  useEffect(() => {
    if (!creator) { setCreatorVideos([]); return undefined; }
    let live = true;
    api.get(`/creators/${creator.channelId}/videos`)
      .then((r) => {
        if (!live) return;
        const v = r.data?.videos || [];
        setCreatorVideos(v.length ? v : fallbackVideos(creator.channelId));
      })
      .catch(() => { if (live) setCreatorVideos(fallbackVideos(creator.channelId)); });
    return () => { live = false; };
  }, [creator]);
  const creatorLatest = creatorVideos[0] || null;

  const toCreatorSource = useCallback((v) => {
    const base = v && getPlayable(v.url);
    return base ? {
      ...base, title: v.title || creator?.name, pageUrl: v.url,
      poster: v.thumbnail, channel: creator?.name,
    } : null;
  }, [creator]);

  // Playing anything of theirs lines the rest of the channel up behind it, so
  // Next walks the channel instead of wandering into general search.
  const playCreatorVideo = useCallback((v) => {
    const source = toCreatorSource(v);
    if (!source) return;
    play(source);
    const rest = creatorVideos
      .slice(creatorVideos.indexOf(v) + 1)
      .map(toCreatorSource)
      .filter(Boolean);
    if (rest.length) enqueueMany(rest);
  }, [toCreatorSource, creatorVideos, play, enqueueMany]);

  // Arriving on a creator page with nothing playing starts their latest —
  // this is a page you came to WATCH. If something is already playing it is
  // left alone; interrupting whatever the visitor chose would be worse.
  const startedCreator = useRef(null);
  useEffect(() => {
    if (!creator || !creatorLatest || playerCurrent) return;
    if (startedCreator.current === creator.slug) return;
    startedCreator.current = creator.slug;
    playCreatorVideo(creatorLatest);
  }, [creator, creatorLatest, playerCurrent, playCreatorVideo]);

  const sharedInRef = useRef(false);
  useEffect(() => {
    if (!lockedTube || sharedInRef.current) return;
    const direct = searchParams.get('add') || '';
    const fromText = /https?:\/\/\S+/.exec(searchParams.get('sharetext') || '')?.[0] || '';
    const link = direct || fromText;
    if (!link) return;
    sharedInRef.current = true;
    const sources = resolveShareInput(link);
    if (sources.length) {
      play(sources[0]);
      if (sources.length > 1) enqueueMany(sources.slice(1));
    } else {
      // Not playable. Don't fail silently — put it in the box so the player's
      // own "we can't play that provider" message explains why.
      setSearchValue(link);
    }
  }, [lockedTube, searchParams, play, enqueueMany]);

  // Tube's bar is the player's bar, and the player lives above <Routes> now,
  // so what's typed here has to be published to it.
  // What the Tube box is being used to look for. YouTube's chips are the
  // model: the same words mean different searches depending on whether you
  // are after a channel, a song or a title.
  // Seeded from ?scope= so /shorts — which now redirects to /tube?scope=shorts
  // — lands on the short-form deck rather than on a generic Tube page that
  // makes the redirect look like it went to the wrong place.
  // Read-only now that the What row is gone: the URL is the only thing that
  // sets it, which is exactly what /shorts needs (it redirects to
  // /tube?scope=shorts and must land on the short-form deck, not a generic
  // Tube page that makes the redirect look misrouted).
  const tubeScope = useMemo(() => {
    const s = searchParams.get('scope');
    return s && SEARCH_SCOPE_IDS.has(s) ? s : 'all';
  }, [searchParams]);
  // Every provider, always. The picker that used to narrow this is gone (see
  // the note where the chip rows were): a search fans out across all of them
  // and the results say which is which by colour. A bang — !yt, !reddit, !sc —
  // still narrows it per query, inside parsePlayerQuery, which is the version
  // of this control that costs no screen.
  const tubeProvider = 'all';
  const selectedUrl = searchParams.get('sel') || '';
  // The home-screen "Talk to Truegle" shortcut. Consumed once: leaving it in
  // the URL would restart the mic on every re-render and on back-navigation.
  const [autoVoice, setAutoVoice] = useState(() => searchParams.get('voice') === '1');
  useEffect(() => {
    if (!autoVoice) return;
    const t = setTimeout(() => setAutoVoice(false), 1500);
    return () => clearTimeout(t);
  }, [autoVoice]);
  useEffect(() => {
    if (!tubeDocked) return undefined;
    setPlayerQuery(searchValue, tubeScope, tubeProvider);
    return () => setPlayerQuery('', 'all', 'all');
  }, [tubeDocked, searchValue, tubeScope, tubeProvider]);
  const autoExpanded = useRef(false);
  useEffect(() => {
    if (autoExpanded.current) return;
    // Landing on /tube — a link somebody shared — must show the player, not a
    // collapsed strip with nothing in it. Everywhere else the screen drops out
    // once there's something to show.
    if (lockedTube || playerCurrent || searchValue.trim().length >= 2) {
      autoExpanded.current = true;
      setExpanded(true);
    }
  }, [lockedTube, playerCurrent, searchValue, setExpanded]);

  // OSINT (ocean) exception: multi-select investigation classes that replace
  // the content categories on the ocean page and tag the query with entity types.
  const [osintClasses, setOsintClasses] = useState([]);
  const toggleOsintClass = (id) =>
    setOsintClasses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const [searchResults, setSearchResults] = useState([]);
  const [instantAnswer, setInstantAnswer] = useState(null);
  const [quickAnswer, setQuickAnswer] = useState(null);
  const [quickAnswerLoading, setQuickAnswerLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState(null);
  // Distinguish "search failed" (provider/network error) from "0 genuine results"
  // so users always get a clear message instead of a silent empty page.
  const [searchError, setSearchError] = useState(false);

  // Down-for-repairs: show a maintenance modal after consecutive search failures
  const [showRepairsModal, setShowRepairsModal] = useState(false);
  const consecutiveFailuresRef = useRef(0);
  const REPAIRS_FAILURE_THRESHOLD = 2;

  // THE PASTED-LINK CASE. When the query is a URL rather than prose, this
  // holds what it turned out to be and the results list is suppressed — see
  // handleSearch. A pasted link wants one destination, not ten pages about it.
  const [linkQuery, setLinkQuery] = useState(null);

  // ── TUBE: PICKING SOMETHING PUTS THE LIST AWAY ───────────────────────────
  //
  // "selection made / play is pushed = input cleared / results dropped, random
  // next flow unless interrupted by user."
  //
  // Once you have chosen, the list has done its job — Tube becomes a player,
  // not a page of search results with a video on top. The random-next flow that
  // takes over from here already exists: TrueglePlayer's advance() falls
  // through to useUpNext.pick() when nothing is queued, so the clip that ends
  // is followed by a drawn one (related and, a fixed fraction of the time,
  // deliberately not).
  //
  // Nothing is DISCARDED, only put down — see useSearchStash. The list comes
  // back on demand, which is the only thing that makes clearing it reasonable.
  const searchStash = useSearchStashContext();
  const clearedFor = useRef(null);
  useEffect(() => {
    if (!lockedTube) return;
    const key = playerCurrent?.src || null;
    // Only on a NEW selection. Without this the effect re-fires on every
    // unrelated re-render and re-clears an input the user has started retyping.
    if (!key || clearedFor.current === key) return;
    clearedFor.current = key;
    searchStash.stashSearch(searchValue, searchResults);
    setSearchValue('');
    setSearchResults([]);
    setLinkQuery(null);
  }, [lockedTube, playerCurrent, searchValue, searchResults, searchStash]);

  // Bringing it back: the input and the list return exactly as they were,
  // including the track that is playing, so the next pick is made from the
  // same list rather than from a freshly-reordered one.
  //
  // Registered with the context rather than called directly, because the
  // gesture that triggers it lives on the locked player — which MiniPlayer
  // mounts at app level, outside this tree entirely.
  useEffect(() => searchStash.registerApply((prev) => {
    setSearchValue(prev.query);
    setSearchResults(prev.results);
  }), [searchStash]);


  // AI state
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(true);

  // Multi-select: extra AI lenses layered on top of the primary `mode`. These
  // only affect the AI summary + follow-up chat framing (not the results grid).
  const [extraLenses, setExtraLenses] = useState(() => {
    try {
      const raw = localStorage.getItem('truegle_extra_lenses');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((m) => LENS_MODES.includes(m)) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('truegle_extra_lenses', JSON.stringify(extraLenses)); } catch { /* quota */ }
  }, [extraLenses]);

  // Primary mode first, then the extra lenses (deduped) — the full set the AI blends.
  const activeModes = useMemo(
    () => [mode, ...extraLenses.filter((m) => m !== mode)],
    [mode, extraLenses]
  );
  // Tapping the primary is a no-op here (it's driven by the main mode toggle /
  // URL, since switching primary re-runs the whole search). Others toggle on/off.
  const toggleLens = (m) => {
    if (m === mode) return;
    setExtraLenses((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  // When the lens set changes and results are already on screen, re-run just
  // the AI summary (not the whole search) so multi-select feels immediate.
  const lensSig = extraLenses.join(',');
  useEffect(() => {
    if (!isAiFree(mode) && sessionSummaryChoice !== 'none' && searchResults.length > 0 && query) {
      fetchAiSummary(query, searchResults, MODE_TO_BACKEND[mode]);
    }
  }, [lensSig]); // intentionally lens-only: re-summarize on lens change, not on every result update

  // Question queries auto-open the AI answer (results stay put) — the user asked
  // a question, so surface the answer instead of the Show/No-Summary prompt.
  // Only when they haven't already made a choice this session (null), and never
  // in Summarize/OSINT modes (which have no summary card).
  useEffect(() => {
    if (
      queryIsQuestion &&
      !isAiFree(mode) && mode !== 'ocean' &&
      searchResults.length > 0 &&
      sessionSummaryChoice === null
    ) {
      setSessionSummaryChoice('show');
    }
  }, [queryIsQuestion, searchResults.length, mode, sessionSummaryChoice]);

  // Perspective state. Shared by the (folded) purple page and the Rabbit Hole
  // fold — same ids, same toggle handler.
  // Seeded from ?perspectives= so an old Perspectives link arrives with its
  // lens intact. It was written into the URL all along and never read back,
  // which meant every shared purple link opened on Neutral — the one thing the
  // sender definitionally wasn't looking at.
  const [selectedPerspectives, setSelectedPerspectives] = useState(() => {
    const raw = (searchParams.get('perspectives') || '').split(',').map((s) => s.trim()).filter(Boolean);
    return raw.length ? raw : ['neutral'];
  });

  // THE REREAD/RERUN SPLIT. On the Rabbit Hole, choosing a lens must NOT fire a
  // search: the reread re-reads the results already on screen, instantly and
  // for free. Only `lensRerun` — set when the user says the reread missed what
  // they were after — goes back to the network. Purple keeps its old
  // behaviour, where every perspective change was a fresh search.
  const [lensRerun, setLensRerun] = useState([]);
  const runLensAgain = (ids) => setLensRerun(ids.filter((id) => id && id !== 'neutral'));
  // A new query is a new question — the previous lens shouldn't silently
  // narrow it server-side.
  useEffect(() => { setLensRerun([]); }, [query]);

  // Ad targeting context — prefer the most specific signal available.
  // to match the user's active perspective or search mode.
  const adContext = (() => {
    const p = selectedPerspectives[0];
    if (p && p !== 'neutral') return p;       // 'left' | 'right' → highest specificity
    if (mode && mode !== 'blue') return mode; // 'red' | 'purple' | 'ocean' | 'green'
    return 'neutral';
  })();
  const [activePerspectiveCategory, setActivePerspectiveCategory] = useState(0);

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRedPillMode, setIsRedPillMode] = useState(false);
  const [isOSINTMode, setIsOSINTMode] = useState(false);
  const cursorGlowRef = useRef(null);
  const [showMap, setShowMap] = useState(false);
  const [mapManuallyClosed, setMapManuallyClosed] = useState(false);
  // Detect location intent from the SUBMITTED query, not the live input. Driving
  // this off `searchValue` made the map auto-open on almost every keystroke (the
  // bare-query geocode fallback matches most short terms), so it now keys off the
  // last query the user actually searched for.
  const { isLocationQuery, detectedLocation, queryType } = useLocationDetection(lastSearchedQuery);

  // A near-me question the server cannot have answered.
  //
  // `queryType === 'geolocation'` is parseLocalQuery's verdict on the query
  // the user actually submitted, and it is the same rule the backend now uses
  // to refuse building a card. Suppression is unconditional rather than
  // waiting on a permission check: even WITH a granted position, the card in
  // hand was built server-side from a web result and knows nothing about
  // where the reader is, so it is a guess either way. What answers the
  // question is the map — which opens for exactly these queries and asks for
  // a position when it needs one.
  const suppressLocalGuess = queryType === 'geolocation'
    && instantAnswer?.type === 'local_business';

  // The local panel. Asked on the SUBMITTED query only, and the backend gate
  // means most searches never reach a provider — a geocode per keystroke would
  // spend a free-tier quota on the 99% of queries that are not places.
  //
  // The visitor's position is passed only when the location detector already
  // resolved one for this query; it is never requested for the panel's sake.
  // "near me" is unanswerable without it and correctly returns nothing rather
  // than a plausible business in the wrong city.
  const placePanel = usePlacePanel(lastSearchedQuery, {
    lat: detectedLocation?.lat ?? null,
    lng: detectedLocation?.lng ?? null,
  });
  // Only EXPLICIT location intent auto-opens the map. Casual "in <place>"
  // phrasing ('location') and fuzzy place geocodes ('place') get a "View map"
  // chip instead — "where is the largest fireworks show in america" is a
  // question, not a map request.
  const autoOpenMap = isLocationQuery && MAP_AUTO_OPEN_TYPES.includes(queryType);
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    category: 'all',
    dateRange: 'any',
    bias: 'all'
  });

  // Update mode when URL param changes (a locked route IS the mode, so a
  // stray ?mode= on /green or /tube can't unlock it)
  useEffect(() => {
    if (lockedPath) return;
    const urlMode = searchParams.get('mode');
    if (urlMode) {
      setMode(foldMode(urlMode));
    }
  }, [searchParams, lockedPath]);

  // Update search value when query param changes
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchValue(queryParam);
    }
  }, [searchParams]);

  // Seed the active result category from the URL (&category=), so the landing/
  // chat search-category strip carries its selection into the results page.
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setActiveCategory(cat);
  }, [searchParams]);

  // Sync pill modes with current mode
  // Purple, Red, and Ocean pages: Red pill mode by default
  // Blue page: Blue pill mode by default
  useEffect(() => {
    setIsRedPillMode(mode === 'red' || mode === 'purple' || mode === 'ocean');
    setIsOSINTMode(mode === 'ocean');
    // Green pill mode disables Smart features
    if (mode === 'green') {
      setSessionSummaryChoice('none');
    }
    // Purple page always starts on the Neutral perspective
    if (mode === 'purple') {
      setSelectedPerspectives(['neutral']);
      setActivePerspectiveCategory(0);
    }
  }, [mode]);

  // Cursor glow effect — update the overlay's style DIRECTLY (ref + rAF) instead
  // of setting React state on every mousemove. Previously this re-rendered the
  // entire (~1500-line) search page on every pixel of movement, which made the
  // result cards glitch/flicker. Now there are zero re-renders from the cursor.
  useEffect(() => {
    let rafId = null;
    let pending = null;
    const apply = () => {
      rafId = null;
      if (cursorGlowRef.current && pending) {
        cursorGlowRef.current.style.background = `radial-gradient(600px circle at ${pending.x}px ${pending.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`;
      }
    };
    const handleMouseMove = (e) => {
      pending = { x: e.clientX, y: e.clientY };
      if (rafId == null) rafId = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Auto-execute search when URL query changes
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam && queryParam.trim() && queryParam !== lastSearchedQuery && !searchLoading) {
      handleSearch();
    }
  }, [searchParams]);

  // Re-search whenever the mode, active category pill, filter dropdowns, or
  // the server-side perspective set change — previously only `mode` was wired
  // up, so switching categories/filters/perspectives silently left stale
  // results on screen instead of re-ranking/re-filtering them.
  //
  // Deliberately NOT `selectedPerspectives`. On the Rabbit Hole that state
  // drives the reread, which is a local re-sort — firing a search on every
  // chip press would put a network round trip behind a control whose entire
  // reason for existing is that it doesn't need one. Purple's ids still land
  // here, via `perspectiveSig` below, because there the perspective IS the
  // search.
  const perspectiveSig = (mode === 'purple' ? selectedPerspectives : lensRerun).join(',');
  useEffect(() => {
    if (lastSearchedQuery && searchValue && !searchLoading) {
      handleSearch();
    }
  }, [mode, activeCategory, osintClasses, filters.bias, filters.dateRange, filters.sortBy, filters.order, filters.category, perspectiveSig]);

  // Auto-detect shopping category
  const isShoppingQuery = (query) => {
    const shoppingKeywords = [
      'buy', 'purchase', 'shop', 'store', 'price', 'deal', 'discount', 'sale',
      'best', 'top', 'review', 'compare', 'amazon', 'walmart',
    ];
    return shoppingKeywords.some((keyword) => query.toLowerCase().includes(keyword));
  };

  useEffect(() => {
    if (searchValue && isShoppingQuery(searchValue)) {
      setActiveCategory('shopping');
    }
  }, [searchValue]);

  // Reset manual map close when a NEW search is run (so a fresh location query
  // can re-open the map), rather than on every keystroke.
  useEffect(() => {
    setMapManuallyClosed(false);
  }, [lastSearchedQuery]);

  /**
   * Handle search execution
   */
  // Re-run the active search when the engine language changes, so results
  // re-localize immediately. Skips initial mount (no prior search yet).
  useEffect(() => {
    if (lastSearchedQuery) {
      handleSearch();
    }
  }, [settings.language]);

  // Submit handler for the search bar. The single cycling pill decides where a
  // submit goes (same model as the landing page): black = Chat -> /chat,
  // orange -> /rewards, yellow -> /extract, a different search mode -> that
  // /search page; the current mode just re-runs the search in place.
  const submitSearch = () => {
    const q = searchValue.trim();
    if (!q) return;

    // A PASTED LINK IS NOT A SEARCH. If it is something the player can host,
    // open it — the player IS the answer, and a list of pages about the link
    // never was. This runs before the pill routing on purpose: pasting a video
    // means "play this" whatever mode happens to be selected, and Chat is the
    // one exception because there the ASK is for an explanation of the link.
    if (pillMode !== 'black') {
      const link = classifyQuery(q);
      if (link?.kind === 'playable' && link.playerLink) {
        // Navigate within the SPA rather than assigning window.location: the
        // player link is our own /tube route and a full page load would drop
        // anything already playing.
        const target = link.playerLink.replace(/^https?:\/\/[^/]+/, '');
        navigate(target);
        return;
      }
    }

    if (pillMode === 'black') { navigate(`/chat?q=${encodeURIComponent(q)}`); return; }
    if (pillMode === 'orange') { navigate('/rewards'); return; }
    if (pillMode === 'yellow') { navigate('/creators'); return; }
    // Tube stays on this page — it is a mode of the search page, not a
    // separate route, which is what keeps its layout identical by construction.
    if (pillMode !== mode) {
      setMode(pillMode);
      // Tube owns /tube, so switching into it lands on the shareable route
      // rather than a query string that means the same thing.
      navigate(pillMode === 'tube'
        ? `/tube?q=${encodeURIComponent(q)}`
        : `/search?mode=${pillMode}&q=${encodeURIComponent(q)}`);
      return;
    }
    handleSearch();
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) return;

    // Update URL. A locked route keeps its own path — rewriting /tube to
    // /search?mode=tube would hand the user a different link to share than the
    // one they arrived on (and reloading /green would leave the lock behind).
    const params = new URLSearchParams();
    params.set('q', searchValue);
    if (mode !== 'blue' && !lockedPath) {
      params.set('mode', mode);
    }
    // Tube has no perspectives control, so carrying the default in the URL is
    // just noise on a link people are meant to share.
    if (selectedPerspectives.length > 0 && !lockedTube) {
      params.set('perspectives', selectedPerspectives.join(','));
    }
    // A card handed over from Tube stays selected: this rewrite runs right
    // after that navigation and would otherwise drop the very link the user
    // tapped, landing them on an ordinary list.
    if (selectedUrl) params.set('sel', selectedUrl);
    window.history.replaceState({}, '', `${lockedPath || '/search'}?${params.toString()}`);

    // Classify BEFORE fetching. A URL that isn't playable still isn't a
    // search: the user knows the page they want. The AI summary above still
    // runs (it is what says WHAT the link is), but the result list below is
    // replaced by a single link card — see displayResults / the render.
    const link = classifyQuery(searchValue.trim());
    setLinkQuery(link);

    // SKIP THE PROVIDER FETCH ENTIRELY for a pasted link. Searching a URL as
    // if it were prose is what produced the original bug — a playlist link came
    // back as a page about HTTP vs HTTPS — and those results then fed the AI
    // summary, so the summary was about HTTPS too. There is nothing to salvage
    // in that list; the link itself is the only source, so it is the only thing
    // handed to the summary.
    if (link) {
      setSearchResults([]);
      setSearchError(false);
      setSearchLoading(false);
      if (!isAiFree(mode) && sessionSummaryChoice !== 'none') {
        fetchAiSummary(searchValue, [{
          title: link.title,
          url: link.url,
          snippet: describeLink(link),
          sourceName: link.host,
        }], modeToBackend(mode));
      }
      return;
    }

    setSearchLoading(true);
    setAiSummary(null);
    setInstantAnswer(null);
    setQuickAnswer(null);
    setLastSearchedQuery(searchValue);

    try {
      const categoryMap = {
        pics: 'images',
        reels: 'videos',   // filtered to short-form client-side after the fetch
        vids: 'videos',
        audio: 'web',
        soc: 'social',
        local: 'shopping',
        maps: 'shopping',
      };

      const categoryKeywords = {
        finance: 'finance stocks market',
        sports: 'sports scores',
        business: 'business company',
        academic: 'research paper academic',
        world: 'world international news',
        health: 'health medical',
        entertainment: 'entertainment movies tv',
        podcasts: 'podcast episode',
        tech: 'technology software',
        gaming: 'gaming video game',
        food: 'food recipe restaurant',
        travel: 'travel destination',
        lifestyle: 'lifestyle wellness',
      };

      let effectiveQuery = searchValue;
      let searchCategory = categoryMap[activeCategory] || 'all';

      if (categoryKeywords[activeCategory]) {
        effectiveQuery = `${searchValue} ${categoryKeywords[activeCategory]}`;
        searchCategory = activeCategory === 'world' ? 'news' : 'all';
      }

      // OSINT (ocean) exception: tag the query with the selected investigation
      // classes so the backend entity detector + OSINT-framed AI summary treat
      // the input as that entity type (domain/email/phone/username/person/ip).
      if (mode === 'ocean') {
        const hint = osintHintPrefix(osintClasses);
        if (hint) effectiveQuery = `${hint} ${effectiveQuery}`.trim();
      }

      // The category pills (above) take priority; the filter dropdown only
      // fills in a content-type/bias hint when the pills haven't already set one.
      if (searchCategory === 'all' && FILTER_CATEGORY_TYPE_MAP[filters.category]) {
        searchCategory = FILTER_CATEGORY_TYPE_MAP[filters.category];
      }
      const filterCategoryBias = FILTER_CATEGORY_BIAS_MAP[filters.category];
      const effectiveBias = filters.bias !== 'all' ? filters.bias : (filterCategoryBias || filters.bias);

      const backendMode = modeToBackend(mode);

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: effectiveQuery,
            mode: backendMode,
            filters: {
              category: searchCategory,
              bias: effectiveBias,
              // Purple sends whatever is selected. Red sends only what the
              // user explicitly asked to search again for — a lens they are
              // merely reading through must never change what gets fetched.
              perspectives: mode === 'purple' ? selectedPerspectives : (mode === 'red' ? lensRerun : []),
              dateRange: filters.dateRange,
              sortBy: filters.sortBy,
              order: filters.order,
              perPage: 20,
              safeSearch: settings.safeSearch,
              language: settings.language,
              country: settings.country,
            },
          }),
        }
      );

      if (!response.ok) throw new Error(`Search error: ${response.status}`);

      const data = await response.json();
      // "Reels/Shorts" — whether picked as a category pill or from the filter
      // dropdown — maps to the backend's videos category, which returns
      // long-form too. Keep only what's actually short-form, otherwise the
      // filter is decorative.
      const wantsShortForm = filters.category === 'reels' || activeCategory === 'reels';
      // DEDUPED BY MEDIA, NOT BY URL, and only where the promotion above can
      // create a collision.
      //
      // REPORTED: "the reels results had a duplicate identical result." The
      // same Short is reachable at /shorts/<id> AND /watch?v=<id>, and two
      // providers answering the same query can return one of each. asReel then
      // rewrites the watch URL to its /shorts/ form — at which point two rows
      // that arrived looking different are the same video, listed twice.
      // mediaKey() is the identity the player already uses for exactly this
      // ("the same YouTube video arrives as a watch link, a youtu.be link and
      // an /embed/ URL"), so the list now uses it too.
      const results = wantsShortForm
        ? (() => {
          const seenKeys = new Set();
          return (data.results || [])
            .map(asReel)
            .filter((r) => r && isShortForm(r))
            .filter((r) => {
              const key = mediaKey(r.url) || r.url;
              if (seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            });
        })()
        : (data.results || []);
      setSearchResults(results);
      setInstantAnswer(data.instantAnswer || null);
      setSearchError(false);

      // Successful response — clear the consecutive-failure streak
      consecutiveFailuresRef.current = 0;
      if (showRepairsModal) setShowRepairsModal(false);

      // Show green-mode preference modal exactly once ever (localStorage).
      // Never on an already-AI-free mode: offering to "disable smart features"
      // on Tube, which has no AI on it at all, is a dialog with nothing to
      // agree to — and it lands right on top of the player.
      if (!firstSearchDone && !isAiFree(mode)) {
        setFirstSearchDone(true);
        localStorage.setItem('truegle_mode_pref_asked', 'true');
        setShowFirstSearchModal(true);
      }

      // Fetch summary only if not green mode and not dismissed
      if (!isAiFree(mode) && sessionSummaryChoice !== 'none' && results.length > 0) {
        fetchAiSummary(searchValue, results, backendMode);
      }
      // Quick answer fires in parallel with the summary. Green mode is AI-free
      // by definition; deliberately NOT gated on sessionSummaryChoice — that
      // setting is about the summary banner, not the answer box.
      if (!isAiFree(mode) && results.length > 0) {
        fetchQuickAnswer(searchValue, results);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setSearchError(true);

      // Track consecutive malfunctions; surface the maintenance modal once we
      // hit the threshold (e.g. a backend/CORS outage), so global users aren't
      // left with a silent empty page.
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= REPAIRS_FAILURE_THRESHOLD) {
        setShowRepairsModal(true);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Fetch the DuckDuckGo-style quick answer: a short, cited answer for
   * question / factual-lookup queries. Resolves to null (card hidden) whenever
   * the query isn't answerable or the backend can't answer confidently.
   */
  const fetchQuickAnswer = async (query, results) => {
    setQuickAnswerLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/quick-answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, results: results.slice(0, 6) }),
        }
      );
      if (!response.ok) throw new Error(`Quick answer error: ${response.status}`);
      const data = await response.json();
      setQuickAnswer(data.answer ? { answer: data.answer, sources: data.sources || [] } : null);
    } catch (error) {
      console.error('Quick answer error:', error);
      setQuickAnswer(null);
    } finally {
      setQuickAnswerLoading(false);
    }
  };

  /**
   * Fetch AI summary
   */
  const fetchAiSummary = async (query, results, backendMode = 'blue-pill') => {
    setAiLoading(true);
    // Tell the model what the MAP is doing, as a fact rather than a guess.
    //
    // Left to itself it wrote "if you're on a TrueGLE search page, the map pane
    // should already be showing Cottage Grove" — hedging about our own product,
    // and wrong: that query opened no map at all. Read straight off
    // parseLocalQuery, which is the same function this page uses to decide, so
    // the fact and the behaviour cannot disagree. Computed from the `query`
    // argument rather than from the isLocationQuery state, because that state
    // resolves asynchronously and may still be from the previous search when
    // this fires.
    const local = parseLocalQuery(query);
    const mapSurface = !local
      ? { state: 'none' }
      : {
        state: MAP_AUTO_OPEN_TYPES.includes(local.type) ? 'open' : 'available',
        subject: local.subject || undefined,
        place: local.place || undefined,
      };
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            results: results.slice(0, 10),
            mode: backendMode,
            // Multi-select: extra lenses (mapped to backend mode strings) blend
            // into the summary framing. Only sent when >1 flow is active.
            modes: activeModes.length > 1 ? activeModes.map((m) => MODE_TO_BACKEND[m]) : undefined,
            perspectives: selectedPerspectives,
            isQuestion: isQuestionQuery(query),
            verbose: SEARCH_VERBOSE,
            mapSurface,
          }),
        }
      );

      if (!response.ok) throw new Error(`AI error: ${response.status}`);

      const data = await response.json();
      setAiSummary({
        summary: data.summary,
        perspectives: data.perspectives,
        sourcesAnalyzed: data.sourcesAnalyzed,
        model: data.model,
        isQuestion: data.isQuestion || false,
      });
    } catch (error) {
      console.error('AI summary error:', error);
      setAiSummary({
        summary: `Analysis of "${query}" from multiple perspectives.`,
        perspectives: [],
        sourcesAnalyzed: results.length,
        model: 'fallback',
      });
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * Handle mode switching via pill toggle (now receives mode string)
   */
  const handlePillModeChange = (newModeOrBool) => {
    // Green mode is locked — ignore any attempt to switch modes
    if (lockedGreen) return;
    // Accept either string ('blue'|'red'|'green') or legacy boolean
    const newMode = typeof newModeOrBool === 'boolean'
      ? (newModeOrBool ? 'red' : 'blue')
      : newModeOrBool;
    setMode(newMode);
    localStorage.setItem('truegle_mode_pref', newMode);
    const params = new URLSearchParams(searchParams);
    if (newMode === 'blue') {
      params.delete('mode');
    } else {
      params.set('mode', newMode);
    }
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  // "Deep dive" from a perspective named in the AI summary. It used to throw
  // the user onto the Perspectives page — a different background, a different
  // pill, a fresh search — to see one angle on the results they were already
  // reading. Now it selects that lens where they stand: the results re-read
  // instantly, and the rerun is one press away if the reread misses.
  const handleDeepDivePerspective = (perspectiveId) => {
    if (lockedGreen) return;
    setSelectedPerspectives([perspectiveId]);
    if (mode !== 'red') {
      setMode('red');
      const params = new URLSearchParams(searchParams);
      params.set('mode', 'red');
      params.set('perspectives', perspectiveId);
      params.set('fold', '1');
      navigate(`/search?${params.toString()}`, { replace: true });
    }
  };

  const toggleOSINT = () => {
    if (lockedGreen) return;
    const newMode = mode === 'ocean' ? 'blue' : 'ocean';
    setMode(newMode);
    const params = new URLSearchParams(searchParams);
    if (newMode === 'blue') {
      params.delete('mode');
    } else {
      params.set('mode', newMode);
    }
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  /**
   * Handle perspective toggle (purple mode)
   */
  const handleTogglePerspective = (perspectiveId) => {
    setSelectedPerspectives((prev) => {
      let next;
      if (prev.includes(perspectiveId)) {
        next = prev.filter((p) => p !== perspectiveId);
      } else {
        // Selecting a real perspective drops the default 'neutral'
        next = perspectiveId === 'neutral'
          ? [...prev, perspectiveId]
          : [...prev.filter((p) => p !== 'neutral'), perspectiveId];
      }
      // Always fall back to Neutral when nothing is selected
      return next.length > 0 ? next : ['neutral'];
    });
  };

  /**
   * Render appropriate background based on mode
   */
  const renderBackground = () => {
    // Low-end devices / reduced-motion: skip heavy WebGL+particle backgrounds
    if (!allowHeavyAnimations) {
      return <div className={`fixed inset-0 ${LITE_BG[mode] || LITE_BG.blue}`} />;
    }

    switch (mode) {
      case 'blue':
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
            <DeepSpaceBackground />
          </ErrorBoundary>
        );

      case 'red':
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
            <WarpSpeedBackground />
          </ErrorBoundary>
        );

      case 'purple':
        return (
          <>
            <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
              <DeepSpaceBackground />
            </ErrorBoundary>
            <div className="fixed inset-0" style={{ zIndex: 5 }}>
              <ErrorBoundary fallback={null}>
                <DeepseekParticles />
              </ErrorBoundary>
            </div>
          </>
        );

      case 'ocean':
        return (
          <>
            <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
              <DeepSeaEnhanced />
            </ErrorBoundary>
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }}>
              <ErrorBoundary fallback={null}>
                <LightRays raysColor="#1983FF" />
              </ErrorBoundary>
            </div>
          </>
        );

      case 'green':
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-br from-green-950 via-black to-emerald-950" />}>
            <div className="fixed inset-0">
              <LetterGlitch
                glitchColors={['#2b4539', '#61dca3', '#61b3dc']}
                glitchSpeed={50}
                centerVignette={true}
                outerVignette={false}
                smooth={true}
              />
              <div className="absolute inset-0 bg-black/72" />
            </div>
          </ErrorBoundary>
        );

      default:
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
            <DeepSpaceBackground />
          </ErrorBoundary>
        );
    }
  };

  // Perspective colors + per-mode container accent — shared with other
  // mode-aware pages via config/modeTheme.js.
  const perspectiveColors = PERSPECTIVE_COLORS;

  // THE REREAD, applied. `searchResults` stays the raw set the backend
  // returned; this is what the page actually renders. Keeping the two separate
  // is what makes the lens undoable in one press without re-fetching anything
  // — clearing it restores the full set from memory.
  //
  // Red only: everywhere else the lens has no meaning, and quietly filtering a
  // Blue search by a perspective the user can't see or clear would look
  // exactly like the search losing results.
  const lensView = useMemo(
    () => readThroughLens(searchResults, mode === 'red' ? selectedPerspectives : []),
    [searchResults, selectedPerspectives, mode],
  );
  // A lens that matches nothing shows the unfiltered results rather than an
  // empty page — the fold's status bar is already saying "0 of 20 read this
  // way", which is the useful version of that information.
  const rawDisplayResults = lensView.active && lensView.count > 0 ? lensView.matched : searchResults;
  // A pasted link shows ONE card, never a list. Emptying the list here rather
  // than branching at each render site keeps every downstream consumer — the
  // count line, the autoplay feed, the lens counts — consistent with what is
  // actually on screen.
  const displayResults = linkQuery ? [] : rawDisplayResults;

  // ── THE FEED PLAYS THROUGH THE PLAYER ─────────────────────────────────────
  //
  // Switching autoplay on hands the playable results to the one player, in the
  // order they are listed, and it takes over from there: it advances when a
  // video actually ENDS rather than on a timer, because the player has a real
  // end-of-video signal and a card's own iframe never did.
  //
  // The queue underneath is untouched — see PlayerContext's startFeed. It is put
  // on standby, not consumed, and does not resume by itself afterwards.
  const feedSources = useMemo(() => (displayResults || [])
    .map((r) => {
      const p = getPlayable(r.url);
      return p ? { ...p, title: r.title || r.url, pageUrl: r.url, poster: r.image } : null;
    })
    .filter(Boolean), [displayResults]);

  // Started once per switch-on, not on every render of the list: re-running it
  // as results stream in would restart the feed from the top mid-watch.
  const feedRunning = useRef(false);
  useEffect(() => {
    if (!feed.autoplay) {
      if (feedRunning.current) { feedRunning.current = false; stopFeed(); }
      return;
    }
    if (feedRunning.current || feedSources.length === 0) return;
    feedRunning.current = true;
    // START WHERE YOU ALREADY ARE, if you are already somewhere.
    //
    // It used to always start at result one, so switching autoplay on while
    // something from the list was playing threw you back to the top — reported
    // as "it looped back to the beginning". If what is playing is in the feed,
    // the feed begins there and keeps it playing; the rest queues up behind.
    const at = playerCurrent?.src
      ? feedSources.findIndex((f) => f.src === playerCurrent.src)
      : -1;
    startFeed(at > 0 ? feedSources.slice(at) : feedSources);
  }, [feed.autoplay, feedSources, startFeed, stopFeed, playerCurrent]);

  // A NEW SEARCH ENDS THE FEED. Typing a different query is a deliberate change
  // of subject; carrying on playing the last one's results through it would be
  // the player talking over the person using it.
  //
  // SKIPS ITS FIRST RUN, and that is not a nicety. `feed.autoplay` is
  // remembered in localStorage, so arriving with it already on ran the start
  // effect and then this one in the same commit — starting the feed and killing
  // it a moment later. The release effect below then saw a dead feed and
  // switched the toggle off, which is exactly the reported "autoplay failed to
  // start by default … required one more click before properly firing".
  const searchSettled = useRef(false);
  useEffect(() => {
    if (!searchSettled.current) { searchSettled.current = true; return; }
    feedRunning.current = false;
    stopFeed();
  }, [lastSearchedQuery, stopFeed]);

  // The player stopping (Stop, Close, or the feed running dry) releases the
  // toggle, so the switch on screen never claims a feed that is not running.
  useEffect(() => {
    if (!feedActive && feedRunning.current) {
      feedRunning.current = false;
      feed.setAutoplay(false);
    }
  }, [feedActive, feed]);

  // THE PAGE FOLLOWS THE PLAYER. When the player moves to the next feed item —
  // because the last one ENDED, not because a timer fired — walk the list down
  // to match, so the marked card is the one actually playing and the next
  // result is under your eyes when it starts.
  //
  // The first item is skipped: startFeed sets `current` itself, and scrolling on
  // that would jump the page the instant the toggle is pressed.
  const feedFollowing = useRef(null);
  useEffect(() => {
    if (!feedActive || !playerCurrent?.src) { feedFollowing.current = null; return; }
    if (feedFollowing.current === null) { feedFollowing.current = playerCurrent.src; return; }
    if (feedFollowing.current === playerCurrent.src) return;
    feedFollowing.current = playerCurrent.src;
    if (feed.autoAdvance) feed.advanceToNext();
  }, [feedActive, playerCurrent, feed]);
  const modeAccent = getModeAccent(mode);

  // ── ResultCard ──────────────────────────────────────────────────────────
  function ResultCard({ result, index, perspectiveColors, accent, safeSearch, currentQuery, currentMode }) {
    // `&sel=` — arrived here from a Tube result. That card opens with its
    // actions showing, so the trip lands on the thing you tapped rather than
    // on a list you have to find it in again.
    const [viewerOpen, setViewerOpen] = useState(() => selectedUrl === result.url);
    const videoEmbed = getVideoEmbed(result.url);
    const playable = getPlayable(result.url);
    // THIS CARD NO LONGER PLAYS ANYTHING.
    //
    // It used to mount its own `<iframe ...autoplay=1&mute=1>` — a second media
    // surface with no control channel, which is why pause, volume and
    // end-of-video behaved differently here than in the player, and why feed
    // auto-advance had to guess with a 30-second timer instead of waiting for
    // the video to finish. Playback goes to the one player now; the card shows
    // that it is the one playing and nothing more.
    const playingHere = feed.autoplay && !!videoEmbed && feed.activeIndex === index;
    // Page previews ("Open in app") are unaffected: those are documents, not
    // media, and there is only ever one of them open because it takes a press.
    const showViewer = viewerOpen;
    const borderClass = accent.border;
    const titleClass = accent.title;
    const blurClass = safeSearch === 'blur' ? 'blur-md hover:blur-none transition-all duration-200' : '';

    // Human-friendly source URL (hostname + path)
    // The host on its own, for the "Opens on …" label and its tooltip.
    const hostLabel = (() => {
      try { return new URL(result.url).hostname.replace(/^www\./, ''); } catch { return 'This site'; }
    })();
    let displayUrl = result.domain || result.url || '';
    try {
      const u = new URL(result.url);
      displayUrl = u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '');
    } catch { /* keep fallback */ }

    // Whole-card tap opens the link natively. The Truegle action buttons
    // (Open link / View anonymously / Open in app / Share) sit INSIDE the
    // card, so clicks on any real link/button/iframe are excluded — they
    // keep executing their own behavior without also opening the page.
    const openCardLink = (e) => {
      if (e.target.closest('a, button, iframe, input, [role="menu"]')) return;
      if (showViewer) return; // in-app viewer open = user is browsing here
      // Don't hijack text selection (mobile long-press copy)
      if (window.getSelection && String(window.getSelection())) return;
      window.open(result.url, '_blank', 'noopener,noreferrer');
    };

    // On Tube these results are listed BELOW the player, including the ones it
    // can't play. Tapping one shouldn't throw you out to the open web: it pops
    // the player out so whatever is playing keeps playing, and hands the link
    // to the mainstream results page with its own actions — open in app, view
    // anonymously, visit the site — already open on it.
    //
    // Capture phase, because the title is a real <a>: by the time a click
    // bubbles to the card the browser is already following the link. Buttons
    // are left alone so Play now / Add to queue still do their own job.
    const tubeHandoff = (e) => {
      if (e.target.closest('button, input, iframe, [role="menu"]')) return;
      e.preventDefault();
      e.stopPropagation();
      setPoppedOut(true);
      navigate(`/search?q=${encodeURIComponent(lastSearchedQuery || searchValue)}`
        + `&mode=blue&sel=${encodeURIComponent(result.url)}`);
    };

    return (
      <motion.div
        // Only playable cards join the autoplay rotation.
        ref={videoEmbed ? (el) => feed.register(index, el) : undefined}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        role="link"
        tabIndex={0}
        onClickCapture={tubeDocked ? tubeHandoff : undefined}
        aria-label={`Open ${result.title || result.url}`}
        onClick={openCardLink}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) {
            e.preventDefault();
            window.open(result.url, '_blank', 'noopener,noreferrer');
          }
        }}
        // THE CARD SAYS IT IS THE ONE PLAYING, rather than playing it.
        // Without a mark, handing playback to the player would leave the list
        // with no indication of where you are in it — you would be watching
        // something with no idea which result it came from.
        className={`rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border transition-colors duration-300 cursor-pointer ${
          playingHere ? 'ring-1 ring-white/40' : ''
        } ${borderClass}`}
      >
        <div className="p-4">
          {playingHere && (
            <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-wider text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Playing in the player
            </div>
          )}
          <div className="flex gap-3">
            {/* Thumbnail */}
            {result.image && (
              <img
                src={result.image}
                alt=""
                className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 opacity-80 ${blurClass}`}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {!result.image && result.favicon && (
              <img
                src={result.favicon}
                alt=""
                className="w-5 h-5 object-contain flex-shrink-0 mt-1 opacity-60"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}

            <div className="flex-1 min-w-0">
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="group">
                <h3 className={`text-base font-semibold transition-colors flex items-center gap-2 ${titleClass}`}>
                  <span className="line-clamp-2">{result.title}</span>
                  <ExternalLink size={13} className="flex-shrink-0 opacity-40" />
                </h3>
              </a>

              {/* Source URL */}
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 mt-0.5 text-xs text-emerald-400/90 hover:text-emerald-300 transition-colors"
              >
                {result.favicon && (
                  <img src={result.favicon} alt="" className="w-3.5 h-3.5 object-contain opacity-70"
                    onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <span className="truncate max-w-[320px]">{displayUrl}</span>
              </a>

              <p className="truegle-selectable text-sm text-white/70 mt-1 line-clamp-2">{result.snippet}</p>

              <div className="flex items-center gap-3 mt-2 text-xs text-white/50 flex-wrap">
                <span className="truncate max-w-[200px]">{result.sourceName || result.domain}</span>
                {result.date && <span>{new Date(result.date).toLocaleDateString()}</span>}
                {result.bias && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${perspectiveColors[result.bias] || perspectiveColors.neutral}`}>
                    {result.biasLabel || result.bias}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 ${accent.link} transition-colors`}
                  >
                    <ExternalLink size={12} /> Open link
                  </a>
                  {/* "View anonymously" pointed at result.proxyUrl, whose
                      only source is searchConfig's
                      `https://cors-anywhere.herokuapp.com/` — a public DEMO
                      proxy that stopped serving traffic when Heroku ended free
                      dynos, and which required each visitor to manually opt in
                      on a separate page before that. Promising anonymity
                      through a dead third-party host is worse than not
                      offering it: the claim was never true and the link never
                      worked. Restore this when Truegle proxies it itself. */}
                  {/* "Open in app" is only offered when the site will
                      actually open in the app. A host that refuses framing
                      cannot be previewed by anyone — the button spins and
                      lands on a blank rectangle, every time, for every
                      visitor — so it is replaced by an honest label rather
                      than left there to waste a press. See utils/embeddable.js.
                      A VIDEO EMBED still gets its button: YouTube and TikTok
                      refuse to frame their watch pages while publishing a
                      dedicated embed path, and that path is what plays. */}
                  {/* "Play here" is gone. There is one Play, it is on the
                      QueueButton below, and it plays in the player — which is
                      the whole point of removing the card's own embed. A page
                      preview is a different thing and keeps its button. */}
                  {(!videoEmbed && canPreview(result.url)) ? (
                    <button
                      onClick={() => setViewerOpen(!viewerOpen)}
                      className={`${accent.link} transition-colors`}
                    >
                      {viewerOpen ? 'Close' : 'Open in app'}
                    </button>
                  ) : videoEmbed ? null : (
                    <span
                      className="text-white/30 cursor-default"
                      title={`${hostLabel} blocks other sites from displaying its pages, so it can only open in its own tab.`}
                    >
                      {opensOnLabel(result.url)}
                    </span>
                  )}
                  {playable && (
                    <QueueButton
                      source={{ ...playable, title: result.title || displayUrl, pageUrl: result.url, poster: result.image }}
                      className={accent.link}
                      showLabel
                    />
                  )}
                  <TruegleShareButton
                    result={result}
                    query={currentQuery}
                    mode={currentMode}
                    compact
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inline iframe viewer (Open in app, or feed autoplay) */}
          {showViewer && (
            <div className={`mt-3 rounded-xl overflow-hidden border ${accent.iframeBorder}`}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5">
                <span className="text-xs text-white/40 truncate flex-1 mr-2">{result.url}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    className={`text-xs ${accent.link} flex items-center gap-1`}>
                    <ExternalLink size={11} /> Open link
                  </a>
                  <button onClick={() => setViewerOpen(false)} className="text-xs text-white/30 hover:text-white">✕</button>
                </div>
              </div>
              {(
                /* NO onLoad SNIFFING. This used to try to detect a refusal
                   by reading `contentDocument`, which is null for EVERY
                   cross-origin frame by specification — embeddable or not — so
                   the catch branch fired on every external result and the
                   preview announced "This page can't be embedded" about pages
                   that embed perfectly well. A blocked frame is deliberately
                   indistinguishable from a slow one; that is what the header
                   is for. Known refusals are handled ahead of the press
                   instead (utils/embeddable.js), and the bar above this frame
                   always carries an Open link, so a frame that stays blank for
                   any other reason still has a way out. */
                <iframe
                  key={result.url}
                  src={result.url}
                  className="w-full h-[60vh]"
                  title="Result preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }
  // ── end ResultCard ───────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen w-full bg-black overflow-y-auto">
      {/* Background - Changes based on mode */}
      <div className="fixed inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full h-full"
          >
            {renderBackground()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cursor Glow Effect — driven imperatively via cursorGlowRef (see effect
          above) so it never triggers a React re-render. No CSS transition: it
          would fight the per-frame updates and cause a laggy trailing glitch. */}
      <div
        ref={cursorGlowRef}
        className="pointer-events-none fixed inset-0 z-30"
      />

      {/* Content - EXACT structure from SearchResults.jsx */}
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Logo - CENTERED AND BIG (same as SearchResults). The logo is scaled
              1.5-1.8x, which visually overflows its layout box; the extra bottom
              margin keeps that overflow from covering the mode-pill row below. */}
          {/* The header answers to the viewport: on a short screen (a phone in
              portrait, a phone with the keyboard up) a 1.8×-scaled logo and a
              48px margin are most of what you can see, and they pushed the
              player's controls off the bottom. Every search page shrinks the
              same way, so the layouts stay identical to each other. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="vp-header-gap flex justify-center mb-12"
          >
            {/* True Tube wears its own mark — it's a destination people share
                by name, not just a colour of the search page. */}
            <TruegleLogo
              variant={mode === 'tube' ? 'tube' : 'default'}
              className="vp-logo scale-[1.5] sm:scale-[1.8]"
              onClick={lockedGreen ? undefined : () => navigate('/')}
            />
          </motion.div>

          {/* Single cycling pill — same control as the landing page. relative
              z-20 so it sits above the scaled logo's overflow and stays
              clickable. Cycling only stages the mode; navigation happens on
              submit (see the search bar's onSearch below). */}
          {creator ? (
            <div className="relative z-20 mb-3">
              <CreatorPill creator={creator} />
            </div>
          ) : !lockedGreen && (
            <div className="relative z-20 mb-2">
              <PillModeRow activeMode={pillMode} onSelect={setPillMode} />
            </div>
          )}

          {/* Whose page this is — under the mark, above the bar. */}
          {creator && (
            <CreatorHeader
              creator={creator}
              latest={creatorLatest}
              onPlayLatest={playCreatorVideo}
            />
          )}

          {/* Search Bar - Directly Below Logo (same as SearchResults) */}
          <div className="max-w-4xl mx-auto mb-6">
            <SearchBar
              value={searchValue}
              // No buttons below the bar (uniform with landing/chat) — submit
              // via Enter or the in-bar play button.
              showSearchButton={false}
              showBiasedButton={false}
              showUnbiasedButton={false}
              onChange={(val) => {
                setSearchValue(
                  // While the Channel chip is on, the box IS a handle: keep the
                  // @ and drop spaces as they're typed, so what you see is what
                  // gets searched.
                  tubeDocked && tubeScope === 'channel' ? toHandle(val, tubeProvider) : val,
                );
              }}
              onSubmit={() => submitSearch()}
              onSearch={() => submitSearch()}
              // Same shape-shift as the landing bar, driven by the same pill,
              // so cycling to Chat here changes the box exactly as it does
              // there instead of looking like a different product.
              variant={pillMode === 'black' ? 'chat' : 'default'}
              shape={pillMode === 'black' ? 'chat' : 'line'}
              placeholder={mode === 'purple' ? 'Explore perspectives...' : mode === 'ocean' ? 'OSINT search...' : 'Search for unbiased truth...'}
              size="medium"
              // Legacy in-bar pill + OSINT toggles removed — the single cycling
              // pill above the bar now covers all modes uniformly.
              showPillToggle={false}
              safeSearch={settings.safeSearch}
              onSafeSearchChange={(v) => updateSetting('safeSearch', v)}
              showFilters={!tubeDocked}
              filters={filters}
              onFiltersChange={setFilters}
              compactFilters={false}
              showFilterToggle={!tubeDocked}
              showOSINTToggle={false}
              // OSINT exception: the ocean page swaps the content categories for
              // the investigation-class row rendered below the bar.
              showCategories={mode !== 'ocean' && !tubeDocked && pillMode !== 'black'}
              showMultiInput
              autoVoice={autoVoice}
              showCameraInput={!tubeDocked}
              showFileInput={!tubeDocked}
              singleLine={tubeDocked}
              belowSlot={mode === 'tube' && !poppedOut ? (
                // The transport gets its OWN row directly under the input
                // rather than sitting inside it. Crammed into the input row it
                // left roughly 100px of usable width on a phone and the
                // placeholder wrapped one character per line. Negative margin
                // tucks this under the pill's rounded bottom so the bar and
                // its controls read as one surface, not a box under a box.
                <div
                  className="relative z-[6] -mt-3 rounded-b-2xl overflow-hidden border border-t-0"
                  style={{ borderColor: `${MODE_COLORS.tube}59` }}
                >
                  {tubeExpanded ? (
                    // NOT the player — the space the player docks into. The
                    // one player is mounted above <Routes> and positions
                    // itself over this slot, because rendering it here would
                    // unmount its <iframe> the moment it popped out, and the
                    // track would start over. Height comes from the player
                    // itself via a CSS variable so the page reserves exactly
                    // the room it occupies.
                    <>
                      {/* THE WHERE/WHAT CHIP ROWS ARE GONE. They asked the
                          visitor to pick a platform before searching, which is
                          backwards: you want a thing, not a website. The
                          multi-provider search behind them is unchanged and
                          still runs across every provider at once — the bangs
                          (!yt, !reddit, !sc) and @handles still steer it for
                          anyone who wants to, via parsePlayerQuery. What each
                          result actually IS now rides on the result itself, in
                          its provider's colour. */}
                      <div
                        data-player-slot
                        aria-hidden="true"
                        style={{ height: 'var(--truegle-player-h, 260px)' }}
                      />
                    </>
                  ) : (
                    <div className="px-1.5 py-1 bg-black/30">
                      <TrueglePlayer presentation="collapsed" accent={MODE_COLORS.tube} />
                    </div>
                  )}
                </div>
              ) : null}
              activeCategory={activeCategory}
              onSelectCategory={selectCategory}
              showMap={showMap || (autoOpenMap && !mapManuallyClosed)}
              onMapToggle={() => {
                if (showMap || (autoOpenMap && !mapManuallyClosed)) {
                  // If map is currently visible, hide it and mark as manually closed
                  setShowMap(false);
                  setMapManuallyClosed(true);
                } else {
                  // If map is hidden, show it and clear manual close flag
                  setShowMap(true);
                  setMapManuallyClosed(false);
                }
              }}
              isLocationQuery={isLocationQuery}
              themeColor={
                mode === 'red' ? 'red' :
                mode === 'purple' ? 'purple' :
                mode === 'ocean' ? 'cyan' :
                mode === 'green' ? 'green' :
                'blue'
              }
              isLoading={searchLoading}
            />
            {/* Chat lenses, in the slot the search categories just vacated —
                the row under the bar always describes the mode the pill is
                showing. Submitting carries them into /chat via localStorage,
                the same contract the landing page uses. */}
            {pillMode === 'black' && (
              <ChatModeRow
                activeModes={chatModes}
                onToggle={toggleChatMode}
                open={chatModesOpen}
                onToggleOpen={() => setChatModesOpen((v) => !v)}
                unhingedAllowed={unhingedAllowed}
                onLockedUnhinged={onLockedUnhinged}
              />
            )}
            {/* (Ocean/OSINT: the investigation-class row and the "TrueGLE vs"
                toggle are removed — the interactive OSINT Tools module below the
                bar now owns tool selection and the AI. Other modes keep them.) */}
            {/* Language selector — synced to browser language by default */}
            <div className="flex justify-end items-center gap-3 mt-2">
              <LanguageSelector />
            </div>
          </div>

          {/* Quick Result Card — directly below search bar for instant visibility */}
          {/* NO QUICK CARD FOR A NEAR-ME QUESTION WITHOUT A POSITION.
              The server builds a local-business card from the top web
              result's pagemap, and it has no idea where anybody is — so
              "coffee near me" produced a confident card for whichever coffee
              shop ranks well globally, in a city the reader has never been
              to. The backend refuses these now; this guard is what makes the
              fix take effect on a frontend deploy rather than waiting for a
              backend one, and it keeps holding if an older backend is ever
              rolled back. The map is the answer to a near-me question. */}
          {instantAnswer && mode !== 'tube' && !suppressLocalGuess && (
            <div className="max-w-4xl mx-auto mb-4 mt-2">
              <QuickResultCard instantAnswer={instantAnswer} mode={mode === 'green' ? 'green' : mode === 'red' ? 'red' : mode === 'purple' ? 'purple' : mode === 'ocean' ? 'ocean' : 'blue'} />
            </div>
          )}

          {/* Multimedia Interface Dropdown (same as SearchResults) */}
          <AnimatePresence>
            {(activeCategory === 'pics' ||
              activeCategory === 'vids' ||
              activeCategory === 'audio' ||
              activeCategory === 'soc') && (
              <>
                <MultimediaInterface
                  category={activeCategory}
                  onClose={() => setActiveCategory('all')}
                  searchQuery={searchValue}
                />
              </>
            )}
          </AnimatePresence>

          {/* "View map" chip — location detected but not an explicit map query.
              Not gated on mapManuallyClosed so it reappears after closing. */}
          {isLocationQuery && !autoOpenMap && !showMap && detectedLocation && (
            <div className="max-w-4xl mx-auto mb-4">
              <button
                type="button"
                onClick={() => { setShowMap(true); setMapManuallyClosed(false); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/70 transition-colors"
              >
                <MapPin size={13} />
                View map{detectedLocation.locationName ? ` — ${detectedLocation.locationName}` : ''}
              </button>
            </div>
          )}

          {/* Map View Overlay */}
          <AnimatePresence>
            {((showMap || autoOpenMap) && !mapManuallyClosed) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto mb-6"
              >
                <MapViewWrapper
                  isOpen={(showMap || autoOpenMap) && !mapManuallyClosed}
                  onToggle={() => {
                    setShowMap(false);
                    setMapManuallyClosed(true);
                  }}
                  onClose={() => {
                    setShowMap(false);
                    setMapManuallyClosed(true);
                  }}
                  detectedLocation={detectedLocation}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shopping Interface (same as SearchResults) */}
          <AnimatePresence>
            {activeCategory === 'shopping' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto mb-6 overflow-hidden"
              >
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                          <circle cx="6" cy="19" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <path d="M2.5 6.5h19v10h-19z"></path>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">As Seen On</h3>
                        <p className="text-sm text-emerald-300/70">Find the best deals across retailers</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveCategory('all')}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-white" />
                    </button>
                  </div>
                  <AsSeenOn searchQuery={searchValue} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OSINT Tools (Ocean mode only) — the interactive investigation
              module: the searched query is routed into its input, findings +
              AI results-summary + debrief all live here (no separate summary). */}
          {mode === 'ocean' && <OSINTToolsPanel initialQuery={lastSearchedQuery} />}

          {/* The Rabbit Hole fold — Perspectives, on demand, in the mode that
              already asks the same question. Only once there is something to
              re-read: an empty page has no angles to offer. */}
          {mode === 'red' && searchResults.length > 0 && (
            <RabbitHoleFold
              results={searchResults}
              selected={selectedPerspectives}
              onSelect={handleTogglePerspective}
              onRerun={runLensAgain}
              rerunning={searchLoading}
              startOpen={arrivedFolded}
            />
          )}

          {/* Perspective Selector — the folded purple page. Unreachable from
              the UI now (?mode=purple redirects into the fold above); kept
              because the mode, its backend filter and its strict date ranking
              still work, and deleting a working pipeline to remove a pill is
              how you lose the ability to put it back. */}
          {mode === 'purple' && (
            <div className="max-w-4xl mx-auto mb-6">
              <PerspectiveSelector
                selectedPerspectives={selectedPerspectives}
                onTogglePerspective={handleTogglePerspective}
                show={true}
                activeCategoryIndex={activePerspectiveCategory}
                onCategoryChange={setActivePerspectiveCategory}
              />
            </div>
          )}

          {/* Prominent Question Answer — auto-shown for direct questions, no click required.
              (Ocean/OSINT has no AI summary surfaces — the tools module owns the AI.) */}
          {aiSummary?.isQuestion && !isAiFree(mode) && mode !== 'ocean' && (
            <div className="max-w-4xl mx-auto mb-4">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl backdrop-blur-xl border shadow-lg ${
                  mode === 'red' ? 'bg-red-950/70 border-red-500/40 shadow-red-500/10' :
                  mode === 'purple' ? 'bg-purple-950/70 border-purple-500/40 shadow-purple-500/10' :
                  mode === 'ocean' ? 'bg-cyan-950/70 border-cyan-500/40 shadow-cyan-500/10' :
                  'bg-[#0d1f3c]/90 border-cyan-500/40 shadow-cyan-500/10'
                }`}
              >
                <div className={`flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-widest ${
                  mode === 'red' ? 'text-red-400' : mode === 'purple' ? 'text-purple-400' :
                  mode === 'ocean' ? 'text-cyan-400' : 'text-cyan-400'
                }`}>
                  <Sparkles size={13} />
                  Quick Answer
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-3">
                    <div className={`animate-spin w-5 h-5 border-2 border-t-transparent rounded-full ${
                      mode === 'red' ? 'border-red-500' : mode === 'purple' ? 'border-purple-500' :
                      mode === 'ocean' ? 'border-cyan-500' : 'border-cyan-500'
                    }`} />
                    <span className="text-white/60 text-sm">Finding your answer...</span>
                  </div>
                ) : (
                  <p className="text-white text-lg font-medium leading-snug">
                    {getQuickAnswer(aiSummary.summary)}
                  </p>
                )}
              </motion.div>
            </div>
          )}

          {/* Search Summary — Banner + Expandable Card.
              Excluded on ocean: the OSINT Tools module above hosts its own AI
              results-summary + debrief, so there's no separate summary here. */}
          {!isAiFree(mode) && mode !== 'ocean' && sessionSummaryChoice !== 'none' && (
            <div className="max-w-4xl mx-auto mb-4">
              {/* (The AI lenses now live inside the expanded summary's inline
                  mini-chat — see InlineSummaryChat — rather than an always-shown
                  row here.) */}
              {/* Banner: shown when choice not yet made */}
              {!sessionSummaryChoice && (aiSummary || aiLoading || searchResults.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl backdrop-blur-xl border ${
                    mode === 'red' ? 'bg-red-950/60 border-red-500/30' :
                    mode === 'purple' ? 'bg-purple-950/60 border-purple-500/30' :
                    mode === 'ocean' ? 'bg-cyan-950/60 border-cyan-500/30' :
                    'bg-[#1a1a2e]/80 border-cyan-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className={
                      mode === 'red' ? 'text-red-400' : mode === 'purple' ? 'text-purple-400' :
                      mode === 'ocean' ? 'text-cyan-400' : 'text-cyan-400'
                    } />
                    <span className="text-sm text-white/70">
                      {mode === 'purple' ? 'Perspective Search Summary available' :
                       mode === 'red' ? 'Deep Dive Search Summary available' :
                       mode === 'ocean' ? 'OSINT Search Summary available' :
                       '(Unbiased) Search Summary available'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSessionSummaryChoice('show');
                        sessionStorage.setItem('truegle_summary_choice', 'show');
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        mode === 'red' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40' :
                        mode === 'purple' ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40' :
                        mode === 'ocean' ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40' :
                        'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40'
                      }`}
                    >
                      Show Summary
                    </button>
                    <button
                      onClick={() => setShowNoSummaryConfirm(true)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/5 text-white/50 hover:bg-white/10 border border-white/10 transition-all"
                    >
                      No Summary
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Expanded summary card: shown after user selects "Show Summary" */}
              {sessionSummaryChoice === 'show' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border ${
                    mode === 'red' ? 'border-red-500/30' :
                    mode === 'purple' ? 'border-purple-500/30' :
                    mode === 'ocean' ? 'border-cyan-500/30' :
                    'border-cyan-500/30'
                  }`}
                >
                  <button
                    onClick={() => setSummaryCollapsed(!summaryCollapsed)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                        mode === 'red' ? 'from-red-500 to-red-600' :
                        mode === 'purple' ? 'from-purple-500 to-purple-600' :
                        mode === 'ocean' ? 'from-cyan-500 to-blue-500' :
                        'from-cyan-500 to-purple-500'
                      } flex items-center justify-center`}>
                        <Sparkles size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-left text-lg font-display font-bold text-white">
                          {mode === 'purple' ? 'Perspective Search Summary' :
                           mode === 'red' ? 'Deep Dive Search Summary' :
                           mode === 'ocean' ? 'OSINT Search Summary' :
                           '(Unbiased) Search Summary'}
                        </h3>
                        <p className="text-xs text-white/40 text-left">Powered by Truegle Search</p>
                      </div>
                      {aiLoading && (
                        <div className={`animate-spin w-4 h-4 border-2 ${
                          mode === 'red' ? 'border-red-500' : mode === 'purple' ? 'border-purple-500' :
                          mode === 'ocean' ? 'border-cyan-500' : 'border-cyan-500'
                        } border-t-transparent rounded-full`} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setShowNoSummaryConfirm(true); }}
                        onKeyDown={(e) => e.key === 'Enter' && setShowNoSummaryConfirm(true)}
                        className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 cursor-pointer"
                      >
                        Dismiss
                      </span>
                      <motion.div animate={{ rotate: summaryCollapsed ? 0 : 180 }}>
                        <ChevronDown size={20} className="text-white/40" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {!summaryCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`overflow-hidden mt-3 pt-3 border-t ${
                          mode === 'red' ? 'border-red-500/20' : mode === 'purple' ? 'border-purple-500/20' :
                          mode === 'ocean' ? 'border-cyan-500/20' : 'border-cyan-500/20'
                        }`}
                      >
                        {aiLoading ? (
                          <div className="flex items-center gap-3 py-4">
                            <div className={`animate-spin w-5 h-5 border-2 ${
                              mode === 'red' ? 'border-red-500' : mode === 'purple' ? 'border-purple-500' :
                              mode === 'ocean' ? 'border-cyan-500' : 'border-cyan-500'
                            } border-t-transparent rounded-full`} />
                            <span className="text-white/60 text-sm">Analyzing search results...</span>
                          </div>
                        ) : aiSummary ? (
                          <>
                            {aiSummary.isQuestion && (
                              <div className={`mb-3 p-3 rounded-xl border ${
                                mode === 'red' ? 'bg-red-500/10 border-red-500/30' :
                                mode === 'purple' ? 'bg-purple-500/10 border-purple-500/30' :
                                mode === 'ocean' ? 'bg-cyan-500/10 border-cyan-500/30' :
                                'bg-cyan-500/10 border-cyan-500/30'
                              }`}>
                                <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">
                                  Quick Answer
                                </div>
                                <p className="text-sm text-white font-medium leading-snug">
                                  {getQuickAnswer(aiSummary.summary)}
                                </p>
                              </div>
                            )}
                            <div className="text-sm text-white/80 leading-relaxed mb-3 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_strong]:font-semibold [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded">
                              <Markdown>{aiSummary.summary}</Markdown>
                            </div>
                            {mode === 'red' && aiSummary.perspectives?.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-semibold text-red-300 mb-2">
                                  Choose a perspective to deep dive into:
                                </div>
                                <div className="space-y-2">
                                  {aiSummary.perspectives.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => handleDeepDivePerspective(p.perspectiveId)}
                                      className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/40 transition-all"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold text-white">{p.label}</span>
                                        <span className="text-xs text-white/40">
                                          {p.count} source{p.count === 1 ? '' : 's'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-white/60">{p.summary}</p>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-white/40">
                              <span>{aiSummary.sourcesAnalyzed || 0} sources analyzed</span>
                            </div>
                            {/* Inline mini-chat — a miniaturized /chat that
                                continues from this summary. Chat lenses live in
                                its mode row ("Summarize" default). */}
                            {(FREE_ACCESS_MODE || isAuthenticated) ? (
                              <InlineSummaryChat
                                query={lastSearchedQuery}
                                summary={aiSummary.summary}
                                primaryMode={mode}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate('/auth/login', { state: { redirectTo: window.location.pathname + window.location.search } })}
                                className="mt-3 text-xs text-white/40 underline hover:text-white/60"
                              >
                                Sign in to chat
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-white/60 leading-relaxed">
                            Search for a topic to get an unbiased summary analyzing multiple sources.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          )}

          {/* One ad below the AI summary — orange-outlined, "Sponsored". Hidden
              on question-phrased queries so the quick-answer card gets the space,
              and in green (Summarize) mode. */}
          {!queryIsQuestion && !isAiFree(mode) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto mb-4"
            >
            </motion.div>
          )}


          {/* No Summary Confirmation Modal — portalled to <body>. Inside the
              page's z-10 wrapper its z-50 is scoped to that wrapper, so it
              could never rise above the fixed player; the player painted over
              the dialog and the buttons were unreachable. */}
          {createPortal(
          <AnimatePresence>
            {showNoSummaryConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                >
                  <h3 className="text-white font-bold text-lg mb-2">Disable Search Summary?</h3>
                  <p className="text-white/60 text-sm mb-5">
                    Clicking <strong>Yes</strong> will hide search summaries for the rest of this session.
                    You can restore them by refreshing the page.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSessionSummaryChoice('none');
                        sessionStorage.setItem('truegle_summary_choice', 'none');
                        setShowNoSummaryConfirm(false);
                      }}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                    >
                      Yes, hide it
                    </button>
                    <button
                      onClick={() => setShowNoSummaryConfirm(false)}
                      className="flex-1 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold text-sm border border-cyan-500/40 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>, document.body)}

          {/* First-Search Modal: Disable Smart Features? — portalled for the
              same reason as the one above. */}
          {createPortal(
          <AnimatePresence>
            {showFirstSearchModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[#0f1a0f] border border-green-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Sparkles size={18} className="text-green-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg">Disable Smart Features?</h3>
                  </div>
                  <p className="text-white/60 text-sm mb-1">
                    Switch to <strong className="text-green-400">Green Mode</strong> for search with
                    zero AI — no summaries, no answer card, no assistant. Nothing is generated, so no
                    model runs on your query at all.
                  </p>
                  <p className="text-white/40 text-xs mb-5">Your choice is saved — we won't ask again. Change it anytime via the pill toggle.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowFirstSearchModal(false);
                        handlePillModeChange('green');
                      }}
                      className="flex-1 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold text-sm border border-green-500/40 transition-all"
                    >
                      Yes, go Green
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem('truegle_mode_pref', 'blue');
                        setShowFirstSearchModal(false);
                      }}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                    >
                      No, keep Smart features
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>, document.body)}

          {/* Down-for-repairs modal (consecutive search malfunctions) */}
          <RepairsModal
            open={showRepairsModal}
            onClose={() => setShowRepairsModal(false)}
            onRetry={() => {
              setShowRepairsModal(false);
              handleSearch();
            }}
          />

          {/* Results Grid (same as SearchResults) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Results Column — in Tube this is the player instead. The
                page, its rails and everything above are untouched, which is
                what keeps Tube's layout identical to the other search pages. */}
            <div className="lg:col-span-3 space-y-4">
              {mode === 'tube' && poppedOut && (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <span className="text-[11px] text-white/45 flex-1">
                    Playing in the popped-out player — keep searching here, it won&apos;t interrupt.
                  </span>
                  <button
                    type="button"
                    onClick={() => setPoppedOut(false)}
                    className="text-[11px] text-slate-200 hover:text-white whitespace-nowrap"
                  >
                    Dock it back
                  </button>
                </div>
              )}
              {searchLoading ? (
                <div className="space-y-4">
                  <div className="text-sm text-white/60 mb-4">Searching...</div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SkeletonSearchResult key={i} />
                  ))}
                </div>
              ) : (
                <>
                  {/* A link query has no count to report — it has a
                      destination. Saying "No results yet - try searching!"
                      under a perfectly good link read as a failure. */}
                  {!linkQuery && (
                    <div className="text-sm mb-4">
                      <span className={modeAccent.count}>
                        {displayResults.length > 0
                          ? (lensView.active && lensView.count > 0
                            ? `${displayResults.length} of ${searchResults.length} results, read through your lens`
                            : `About ${displayResults.length} results`)
                          : 'No results yet - try searching!'}
                      </span>
                    </div>
                  )}

                  {/* BACK TO YOUR RESULTS. Tube clears the list when you pick
                      something (see the stash effect above), so this is the
                      visible way back — the locked player's top-tap gesture is
                      the same action, but it only exists on a phone, and a
                      list you can only reopen with an undiscoverable gesture is
                      a list you have lost. */}
                  {lockedTube && searchStash.hasStash && displayResults.length === 0 && (
                    <button
                      type="button"
                      onClick={searchStash.recall}
                      className="w-full mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 text-sm text-white/70 hover:text-white transition-colors text-left"
                    >
                      <span className="font-semibold">Back to your results</span>
                      <span className="text-white/40"> — the list you picked this from</span>
                    </button>
                  )}

                  {/* THE SINGLE LINK CARD. Sits where the result list would
                      have been, under the AI summary above, so the summary
                      still explains what the link is and this says where it
                      goes. One destination, one button. */}
                  {linkQuery && (
                    <SingleLinkCard
                      info={linkQuery}
                      description={describeLink(linkQuery)}
                      className="mb-4"
                    />
                  )}

                  {/* The local panel, when the query turned out to be about a
                      real place. It REPLACES the quick answer rather than
                      stacking with it: both are answering the same question,
                      and two answer boxes push the results off the screen. The
                      panel wins because "call" and "directions" beat a sentence
                      about a business every time. */}
                  {placePanel.panel && (
                    <BusinessPanelCard panel={placePanel.panel} className="mb-4" />
                  )}

                  {/* Quick answer — short cited answer for question queries;
                      hidden when a structured instant answer already covers it */}
                  {!instantAnswer && !placePanel.panel && (
                    <QuickAnswerCard quickAnswer={quickAnswer} loading={quickAnswerLoading} className="mb-4" />
                  )}

                  {/* Search failed (provider/network/quota) — reassure + retry */}
                  {searchError && lastSearchedQuery && (
                    <div className="mb-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                      <div className="text-2xl mb-2">🛠️</div>
                      <p className="text-amber-200 text-sm font-semibold mb-1">
                        We're having trouble fetching results right now
                      </p>
                      <p className="text-white/50 text-xs mb-4 max-w-md mx-auto">
                        TruegleSearch is in early access and one of our search
                        providers may be catching its breath. This is usually
                        brief — please try again in a moment.
                      </p>
                      <button
                        onClick={() => handleSearch()}
                        className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-sm border border-amber-500/40 transition-all"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {/* Genuine zero-results (search succeeded, nothing matched) */}
                  {!searchError && lastSearchedQuery && searchResults.length === 0 && (
                    <div className="mb-4 p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                      <p className="text-white/80 text-sm font-semibold mb-1">
                        No results for "{lastSearchedQuery}"
                      </p>
                      <p className="text-white/40 text-xs max-w-md mx-auto">
                        Try different keywords, broader terms, or another search mode.
                      </p>
                    </div>
                  )}

                  {/* OSINT mode requires auth + token */}
                  {mode === 'ocean' && searchResults.length > 0 && (
                    <TokenGate featureName="osint-tools">
                      <div className="space-y-4">
                        {searchResults.map((result, index) => (
                          <Fragment key={result.url || index}>
                            <ResultCard
                              result={result}
                              index={index}
                              mode={mode}
                              perspectiveColors={perspectiveColors}
                              accent={modeAccent}
                              safeSearch={settings.safeSearch}
                              currentQuery={lastSearchedQuery}
                              currentMode={mode}
                            />
                          </Fragment>
                        ))}
                      </div>
                    </TokenGate>
                  )}

                  {/* Feed autoplay controls — only where there's media to play */}
                  {!tubeDocked && searchResults.some((r) => getVideoEmbed(r.url)) && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => feed.setAutoplay((v) => !v)}
                        aria-pressed={feed.autoplay}
                        title="Play each video as you scroll to it, and stop it when you scroll away"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          feed.autoplay
                            ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
                            : 'bg-white/5 border-white/15 text-white/60 hover:text-white'
                        }`}
                      >
                        {feed.autoplay ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        {feed.autoplay ? 'Autoplay on' : 'Autoplay feed'}
                      </button>
                      {feed.autoplay && (
                        <button
                          type="button"
                          onClick={() => { feed.setAutoAdvance((v) => !v); feed.bumpInteraction(); }}
                          aria-pressed={feed.autoAdvance}
                          title="Also scroll to the next video on its own"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                            feed.autoAdvance
                              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
                              : 'bg-white/5 border-white/15 text-white/60 hover:text-white'
                          }`}
                        >
                          <ChevronsDown size={13} />
                          {feed.autoAdvance ? 'Auto-scroll on' : 'Auto-scroll'}
                        </button>
                      )}
                      <span className="text-[10px] text-white/30">
                        {feed.autoplay
                          ? 'Results play in the player, in order'
                          : 'Play the results through the player'}
                      </span>
                    </div>
                  )}

                  {mode !== 'ocean' && displayResults.map((result, index) => (
                    <Fragment key={result.url || index}>
                      <div>
                        <ResultCard
                          result={result}
                          index={index}
                          mode={mode}
                          perspectiveColors={perspectiveColors}
                          accent={modeAccent}
                          safeSearch={settings.safeSearch}
                          currentQuery={lastSearchedQuery}
                          currentMode={mode}
                        />
                      </div>
                    </Fragment>
                  ))}

                  {/* Attribution badge — appears under the results so scraped/
                      shared result pages carry a visible Truegle credit. */}
                  {searchResults.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/10 text-center">
                      <span className="text-xs text-white/40">
                        Results from{' '}
                        <a
                          href="https://truegle.info"
                          rel="noopener noreferrer"
                          className="text-white/60 hover:text-white/90 underline-offset-2 hover:underline"
                        >
                          Truegle
                        </a>{' '}
                        — the unbiased search engine
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar Column (same as SearchResults) */}
            <div className="lg:col-span-1 space-y-4">
            </div>
          </div>
        </div>
      </div>

      {/* The follow-up chat now lives inline in the expanded summary card
          (InlineSummaryChat), not in a separate modal overlay. */}

      {/* REELS. Mounted last so it layers over the whole page, and only while
          open so its search and its embeds cost nothing the rest of the time.
          It is a fixed box rather than a fullscreen element — see the note in
          ReelsSurface for why the clock cannot survive the Fullscreen API. */}
      {reelsOpen && (
        <ReelsSurface
          query={lastSearchedQuery || searchValue}
          accent={MODE_COLORS[mode] || MODE_COLORS.blue}
          onClose={() => { setReelsOpen(false); setActiveCategory('all'); }}
        />
      )}
    </div>
  );
}
