import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { X, Minus, Maximize2, GripHorizontal, Eye, EyeOff, PictureInPicture2, PanelBottom, Play, Pause, SkipForward, ChevronUp } from 'lucide-react';
import { MODE_COLORS, BRAND_GRADIENT } from '../../config/modeTheme';
import { usePageMode, BRAND } from '../../hooks/usePageMode';
import TrueglePlayer from '../player/TrueglePlayer';
import { useFeedbackBarHeight } from './PreProductionBanner';
import { usePlayerQuery } from '../../utils/playerQueryStore';
import { toHandle } from '../../utils/playerQuery';
import PlayerScopeChips from '../player/PlayerScopeChips';
import { useNarrowViewport } from '../../hooks/useNarrowViewport';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { usePageInputFocus } from '../../hooks/usePageInputFocus';

// The floating FRAME for the one player. Rendered ABOVE <Routes> (in
// AppContent) so the media node it hosts is never unmounted on navigation —
// the source keeps playing while the user browses elsewhere.
//
// This file deliberately owns no player UI. Everything inside the frame is
// <TrueglePlayer presentation="popped" />, the same component that docks into
// the Tube search bar, so the popped-out player is not a lookalike of the
// docked one — it is the same one.
//
// What lives here is only what a floating window needs: drag, resize,
// geometry persistence, the page-mode accent ring, and its own search bar in
// the header. That bar's query is INDEPENDENT of the page's bar — two bars
// that mirrored each other would defeat the point of having two. Media
// Session (lock-screen controls for native audio/video) also stays here,
// since it belongs to the page-level singleton.
//
// MOBILE: every drag surface sets `touch-action: none`. Without it the browser
// claims the touch for page scrolling before pointermove ever fires, which is
// what made the player feel immovable on a phone. Handles are also sized for a
// thumb, and "Adjust" mode turns the whole player into one big drag target
// with oversized grips so you don't have to hit a 16px corner.
const DEFAULT_W = 340;
const MIN_W = 240;
const MAX_W = 900;
const BANNER_CLEARANCE = 80;  // px above the bottom pre-production banner
const GEOM_KEY = 'truegle_player_geom';

const clampW = (w) => Math.max(MIN_W, Math.min(w, MAX_W, window.innerWidth - 16));

const loadGeom = () => {
  try {
    const g = JSON.parse(localStorage.getItem(GEOM_KEY) || 'null');
    return g && typeof g.width === 'number' ? g : null;
  } catch { return null; }
};

export default function MiniPlayer() {
  const {
    current, queue, history, minimized, poppedOut, dock, footerView, paused,
    next, prev, close, toggleMinimize, setPoppedOut, setFooterView, setDock, togglePause,
  } = usePlayer();
  // 'footer' = pinned across the bottom of the page, above the feedback bar.
  // The frame stops being a window in that state: no dragging, no resizing,
  // no stored geometry — it belongs to the page now.
  //
  // dock === null means nobody has chosen, so the screen decides: on a phone a
  // floating window is big enough to cover the very results it was popped out
  // to sit beside, so phone-width defaults to the footer — the same place
  // every mobile player puts itself. The pop-out control still switches it,
  // and that choice is remembered.
  const narrow = useNarrowViewport();
  const footerDock = dock === 'footer' || (!dock && narrow);
  // A fixed element is positioned against the layout viewport, which Android
  // doesn't shrink for the keyboard — so the player (and the input inside it)
  // ended up underneath it. Lift by exactly what the keyboard covers.
  const keyboardInset = useKeyboardInset();
  const feedbackOffset = useFeedbackBarHeight();
  // The player floats over whatever page you're on, so it takes that page's
  // colour — otherwise it reads as a foreign dark box sitting on top of the
  // design (which is exactly how it looked on a phone).
  const pageMode = usePageMode();
  const accent = pageMode === BRAND ? null : (MODE_COLORS[pageMode] || MODE_COLORS.blue);
  const ring = accent ? `${accent}8c` : BRAND_GRADIENT;   // 8c ≈ 55% alpha
  const tint = accent ? `${accent}1f` : 'rgba(255,255,255,0.06)'; // 1f ≈ 12%

  const mediaRef = useRef(null);
  const drag = useRef(null);
  const saved = useRef(loadGeom());

  const [pos, setPos] = useState(saved.current?.pos || null); // {left, top}; null = docked
  const [width, setWidth] = useState(saved.current?.width || DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const [adjust, setAdjust] = useState(false);   // move mode: drag from anywhere
  const [playerQuery, setPlayerQuery] = useState('');
  // ── getting out of the way of the page's search bar ──────────────────────
  // Pinned to the bottom of a phone screen and lifted by the keyboard, the
  // player lands exactly on the search bar the visitor is typing into — it
  // covered the input, the suggestions under it, and on the landing page the
  // whole search block. While a page field has focus the player retracts to a
  // single 36px strip: still playing, still controllable, no longer in front
  // of the thing being used. `peekOpen` is the escape hatch for anyone who
  // wants it back mid-type, and it resets when focus leaves so the retract is
  // automatic again next time.
  const pageTyping = usePageInputFocus();
  const [peekOpen, setPeekOpen] = useState(false);
  useEffect(() => { if (!pageTyping) setPeekOpen(false); }, [pageTyping]);
  // Bumped on submit so TrueglePlayer opens its list even when the text is
  // unchanged — otherwise a second Enter looks like nothing happened.
  const [submitNonce, setSubmitNonce] = useState(0);
  // The popped-out player has its own bar, so it needs its own type chips —
  // they were only ever on the Tube page, which meant the same search behaved
  // differently depending on where you typed it.
  const [playerScope, setPlayerScope] = useState('all');
  const [playerProvider, setPlayerProvider] = useState('all');
  const [scopesOpen, setScopesOpen] = useState(false);
  const playerInputRef = useRef(null);
  const submitPlayerQuery = useCallback(() => {
    setSubmitNonce((n) => n + 1);
    setScopesOpen(false);   // same as Tube: spent once a search has run
    // Dropping focus is what retracts the keyboard; with the keyboard up there
    // is no room left to show the results that were just fetched.
    playerInputRef.current?.blur();
  }, []);
  const frameRef = useRef(null);
  const page = usePlayerQuery();

  // ── docking into a page's slot ───────────────────────────────────────────
  // A page that wants the player inside its layout renders an empty
  // [data-player-slot] and this frame positions itself over it. It does NOT
  // render the player itself: React cannot move a DOM node between parents
  // without recreating it, so a page-rendered player meant a brand-new
  // <iframe> — and a track that started over — every time it popped out.
  // One node, mounted once, above <Routes>; only its geometry changes.
  const [slot, setSlot] = useState(null);
  const wantSlot = !poppedOut;
  useEffect(() => {
    if (!wantSlot) { setSlot(null); return undefined; }
    const measure = () => {
      const el = document.querySelector('[data-player-slot]');
      if (!el) { setSlot(null); return; }
      const r = el.getBoundingClientRect();
      // How much room is actually left below the page's header. A 9:16 reel
      // capped only against the viewport still ran past the bottom once the
      // logo, pill row and search bar had taken their share — the transport
      // ended up just off screen, which is exactly when you need it.
      document.documentElement.style.setProperty(
        '--truegle-player-cap',
        `${Math.max(180, Math.round(window.innerHeight - r.top - 120))}px`,
      );
      setSlot((prev) => (prev
        && Math.abs(prev.left - r.left) < 0.5
        && Math.abs(prev.top - r.top) < 0.5
        && Math.abs(prev.width - r.width) < 0.5
        ? prev
        : { left: r.left, top: r.top, width: r.width }));
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    // Catches the layout changes nothing tells us about — the slot appearing
    // on a later render, ads loading above it, the bar growing a row.
    const poll = setInterval(measure, 250);
    return () => {
      clearInterval(poll);
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      document.documentElement.style.removeProperty('--truegle-player-cap');
    };
  }, [wantSlot]);
  const docked = !!slot && wantSlot;
  // Only the free-floating and footer forms overlap the page. The slot-docked
  // player is IN the layout, so it can't be in anybody's way.
  const peek = pageTyping && !peekOpen && !docked;

  // ── drag + resize ────────────────────────────────────────────────────────
  const onMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    if (d.mode === 'move') {
      const left = Math.max(4, Math.min(e.clientX - d.dx, window.innerWidth - 80));
      const top = Math.max(4, Math.min(e.clientY - d.dy, window.innerHeight - 40));
      setPos({ left, top });
    } else {
      setWidth(clampW(d.startW + (e.clientX - d.startX)));
    }
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove]);

  const begin = useCallback((e, spec) => {
    e.preventDefault();
    drag.current = spec;
    setDragging(true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  const startMove = useCallback((e) => {
    if (e.target.closest('button, input, a')) return; // let controls work
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    begin(e, { mode: 'move', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  }, [begin]);

  const startResize = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    begin(e, { mode: 'resize', startX: e.clientX, startW: rect.width });
  }, [begin]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  // Remember where the user put it — re-dragging the player on every visit was
  // half of what made it feel fiddly.
  useEffect(() => {
    try { localStorage.setItem(GEOM_KEY, JSON.stringify({ pos, width })); } catch { /* private mode */ }
  }, [pos, width]);

  // A rotate or a smaller window must not strand the player off-screen.
  useEffect(() => {
    const onResize = () => {
      setWidth((w) => clampW(w));
      setPos((p) => (p ? {
        left: Math.max(4, Math.min(p.left, window.innerWidth - 80)),
        top: Math.max(4, Math.min(p.top, window.innerHeight - 40)),
      } : p));
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Footer dock covers the bottom of the page, so the page gets that height
  // back as extra scroll — otherwise the last few lines of every page sit
  // permanently underneath the player and can never be read.
  useEffect(() => {
    const el = frameRef.current;
    if (!footerDock || !el) { document.body.style.paddingBottom = ''; return; }
    const apply = () => {
      document.body.style.paddingBottom = `${el.getBoundingClientRect().height + feedbackOffset + 24}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); document.body.style.paddingBottom = ''; };
  }, [footerDock, feedbackOffset, minimized, current]);

  // A slot can't know how tall the player is, and the player can't be in the
  // page's layout, so the height crosses as a CSS variable — the slot reserves
  // exactly the room the frame occupies and the page never jumps.
  useEffect(() => {
    const el = frameRef.current;
    if (!docked || !el) return undefined;
    const apply = () => document.documentElement.style.setProperty(
      '--truegle-player-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--truegle-player-h');
    };
  }, [docked]);

  // ── Media Session: lock-screen controls + background audio (native only) ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const isNative = current && (current.kind === 'audio' || current.kind === 'video');
    if (!isNative) { try { navigator.mediaSession.metadata = null; } catch { /* noop */ } return; }
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: current.title || 'Truegle',
        artist: 'Truegle',
        artwork: current.poster ? [{ src: current.poster }] : [],
      });
    } catch { /* MediaMetadata unsupported */ }
    const set = (act, fn) => { try { navigator.mediaSession.setActionHandler(act, fn); } catch { /* unsupported action */ } };
    set('play', () => mediaRef.current?.play());
    set('pause', () => mediaRef.current?.pause());
    set('previoustrack', history.length ? prev : null);
    set('nexttrack', queue.length ? next : null);
    return () => ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((act) => set(act, null));
  }, [current, history.length, queue.length, next, prev]);

  // Nothing playing, not popped out, and no page slot asking for it → nothing
  // to show. Once popped out the frame stays even with an empty screen: the
  // user asked for the player, and its search bar is how they fill it.
  if (!current && !poppedOut && !docked) return null;

  const title = current?.title;
  const clipWhenMin = minimized;
  // What's actually on screen once the keyboard has taken its share, and the
  // geometry that fits INSIDE it. The height floor has to move the frame UP
  // rather than let it overhang — a minimum height enforced against a fixed
  // top just pushes the bottom off the screen, which is where the search box
  // went when the keyboard opened.
  const visible = Math.max(200, (typeof window !== 'undefined' ? window.innerHeight : 800) - keyboardInset);
  const avail = Math.max(120, visible - 8);
  const minH = Math.min(180, avail);
  const floatTop = pos ? Math.max(4, Math.min(pos.top, visible - minH - 8)) : 4;
  const visibleHeight = Math.max(minH, Math.round(Math.min(avail, visible - floatTop - 8)));

  const style = docked
    ? {
      left: slot.left,
      top: slot.top,
      width: slot.width,
      // The frame is FIXED, so anything of its own that runs past the bottom
      // of the screen can never be scrolled to — the page scrolls, the frame
      // doesn't. Cap it at what's actually visible and let it scroll itself,
      // so an opened panel (a long queue, the results list) stays reachable.
      //
      // The KEYBOARD counts as "not visible". This was the one geometry path
      // that ignored it: 100svh does not shrink for the keyboard on Android,
      // so with the list open the frame was sized against the full screen,
      // grew down behind the keyboard, and covered the page's search bar —
      // the very box you were typing into. The float and footer paths already
      // subtracted this; docked never did.
      maxHeight: `${Math.max(140, Math.round(
        (typeof window !== 'undefined' ? window.innerHeight : 800)
        - keyboardInset - Math.max(0, slot.top) - 8,
      ))}px`,
      overflowY: 'auto',
    }
    : footerDock
    ? {
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: feedbackOffset + keyboardInset,
      width: 'min(calc(100vw - 1rem), 48rem)',
    }
    : pos
      ? {
        left: pos.left,
        // Same rule for the floating window: with the keyboard up, slide it
        // up by whatever it would otherwise be buried under.
        top: floatTop,
        width,
        // ...and it must FIT what's left. Without a cap the frame ran past the
        // bottom of the visible viewport, and since it's fixed, nothing could
        // scroll it back — the header, with the search box in it, ended up
        // above the top of the screen with no way to reach it.
        maxHeight: `${visibleHeight}px`,
        overflowY: 'auto',
      }
      : {
        left: 16,
        bottom: BANNER_CLEARANCE + keyboardInset,
        width,
        maxHeight: `${Math.max(180, Math.round(window.innerHeight - keyboardInset - BANNER_CLEARANCE - 16))}px`,
        overflowY: 'auto',
      };

  // Every control is a ≥36px square. The old 13px icons packed edge to edge
  // were the other half of the "hard to maneuver" problem.
  const ctrl = 'flex items-center justify-center w-9 h-9 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors';
  // The retracted strip trades the 36px target for staying out of the way; it
  // is a temporary state you are not meant to be operating from.
  const peekBtn = 'flex items-center justify-center w-7 h-7 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0';

  return (
    <>
      {/* Gesture overlay — captures pointer events over the iframe while
          dragging/resizing so the move doesn't get eaten by the embed. */}
      {dragging && (
        <div
          className="fixed inset-0 z-[9997]"
          style={{ touchAction: 'none', cursor: drag.current?.mode === 'resize' ? 'nwse-resize' : 'move' }}
        />
      )}

      {/* The 1.5px "ring" is a background, not a border, so the same code path
          renders a flat mode colour and the brand gradient. Inner surface stays
          translucent over it. */}
      <div
        data-mini
        ref={frameRef}
        style={{
          ...style,
          background: adjust ? MODE_COLORS.ocean : ring,
          // Docked, the bar above supplies the top edge — a ring all the way
          // round would draw a line through the middle of one surface.
          padding: docked ? '0 1.5px 1.5px' : (adjust ? 2.5 : 1.5),
        }}
        className={`fixed shadow-2xl transition-shadow ${dragging ? 'select-none' : ''} ${
          docked
            // Below the page's own dropdowns (suggestions drop over this
            // space), above the results underneath it.
            ? 'z-[30] rounded-b-2xl'
            : 'z-[9996] max-w-[calc(100vw-1rem)] rounded-xl'
        }`}
      >
      <div className={`relative overflow-hidden bg-[#0d0d14]/95 backdrop-blur-xl ${docked ? 'rounded-b-[14px]' : 'rounded-[10px]'}`}>
        {/* Move mode: the WHOLE player becomes the drag handle, including the
            video area — an iframe swallows pointer events, so without this
            overlay "move" could only ever be started from the grab bar, which
            is why the button felt like it did nothing but resize. Resizing
            still lives on the corner grip; it never needed a mode. */}
        {adjust && !docked && !footerDock && (
          <div
            onPointerDown={startMove}
            style={{ touchAction: 'none' }}
            className="absolute inset-0 z-20 cursor-move"
            aria-hidden="true"
          />
        )}
        {/* Retracted: the whole player as one 36px strip. The media node is
            NOT unmounted — it is still playing, and unmounting an iframe
            restarts it. Only the chrome around it goes away, which is all that
            was covering the search bar. */}
        {peek && (
          <div className="flex items-center gap-0.5 px-1.5 h-9 bg-black/70 backdrop-blur-xl">
            <button type="button" onClick={() => (current ? togglePause() : null)}
              title={paused ? 'Play' : 'Pause'} aria-label={paused ? 'Play' : 'Pause'} className={peekBtn}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <span className="flex-1 min-w-0 truncate text-[11px] text-white/55">
              {title || 'Truegle player'}
            </span>
            <button type="button" onClick={next} title="Next" aria-label="Next" className={peekBtn}>
              <SkipForward size={14} />
            </button>
            <button type="button" onClick={() => setPeekOpen(true)}
              title="Show the player" aria-label="Show the player" className={peekBtn}>
              <ChevronUp size={14} />
            </button>
            <button type="button" onClick={close} title="Close player (keeps your queue)"
              aria-label="Close player" className={peekBtn}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Grab bar. Thick on purpose: 44px tall, full width, with a visible
            grip so it reads as "hold here to move me".
            Docked, it's gone entirely: the page's search bar is directly above
            and a second search input under it is exactly the duplication we
            took out. ── */}
        {!docked && !peek && (
        <div
          onPointerDown={footerDock ? undefined : startMove}
          style={{ touchAction: footerDock ? 'auto' : 'none', background: adjust ? 'rgba(34,211,238,0.15)' : tint }}
          className={`sticky top-0 z-40 flex items-center gap-1.5 px-2 min-h-[44px] border-b backdrop-blur-xl ${footerDock ? '' : 'cursor-move'} ${
            adjust ? 'border-cyan-400/30' : 'border-white/10'
          }`}
        >
          {!footerDock && (
            <GripHorizontal size={18} className={adjust ? 'text-cyan-300 shrink-0' : 'text-white/40 shrink-0'} />
          )}
          {/* The player's OWN search bar, in the header where it can't be
              mistaken for the page's. Deliberately never auto-hides: the old
              below-player bar collapsed on a 3s idle timer that focus merely
              restarted, so it vanished mid-word. Its query is independent of
              the page's bar — that separation is the point of having two.
              Enter blurs, which retracts the on-screen keyboard and uncovers
              the results underneath; it also forces the list open, so pressing
              enter always visibly does something. */}
          <form
            onSubmit={(e) => { e.preventDefault(); submitPlayerQuery(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative flex-1 min-w-0"
          >
            <input
              ref={playerInputRef}
              value={playerQuery}
              onChange={(e) => {
                setScopesOpen(true);
                setPlayerQuery(playerScope === 'channel'
                  ? toHandle(e.target.value, playerProvider)
                  : e.target.value);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitPlayerQuery(); } }}
              enterKeyHint="search"
              placeholder={title || 'Search something to play…'}
              aria-label="Search the player"
              className={`w-full bg-black/40 border border-white/10 rounded-lg py-1.5 pl-2.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-white/30 ${playerQuery ? 'pr-7' : 'pr-2.5'}`}
            />
            {playerQuery && (
              <button
                type="button"
                onClick={() => { setPlayerQuery(''); playerInputRef.current?.focus(); }}
                title="Clear"
                aria-label="Clear the player search"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </form>
          {/* Footer dock: two named states. Watch = the picture. Hidden = the
              controls only, still playing — the "listening while I read the
              results" case, which is most of what a dock at the bottom of a
              page is for. Elsewhere the frame keeps its plain minimize. */}
          {footerDock ? (
            <div className="flex items-center rounded-lg bg-black/40 border border-white/10 p-0.5 shrink-0">
              {[['watch', 'Watch', Eye], ['hidden', 'Hidden', EyeOff]].map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFooterView(value)}
                  aria-pressed={footerView === value}
                  title={value === 'watch' ? 'Show the video' : 'Hide the video — keeps playing'}
                  className={`flex items-center gap-1 px-2 h-8 rounded-md text-[11px] font-semibold transition-colors ${
                    footerView === value ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/80'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={toggleMinimize} title={minimized ? 'Expand' : 'Minimize'} className={ctrl}>
              {minimized ? <Maximize2 size={16} /> : <Minus size={16} />}
            </button>
          )}
          {/* Where the window lives. It left the transport when that slot became
              the move control, and it belongs with the other window chrome
              anyway. */}
          <button
            type="button"
            onClick={() => setDock(footerDock ? 'float' : 'footer')}
            title={footerDock ? 'Float the player' : 'Dock the player at the bottom of the page'}
            aria-label={footerDock ? 'Float the player' : 'Dock the player at the bottom of the page'}
            className={ctrl}
          >
            {footerDock ? <PictureInPicture2 size={15} /> : <PanelBottom size={15} />}
          </button>
          {/* Close puts the player away; it does NOT empty the queue. Clearing
              is explicit, in the list. */}
          <button type="button" onClick={close} title="Close player (keeps your queue)" className={ctrl}>
            <X size={16} />
          </button>
        </div>
        )}

        {/* The same type chips Tube has, under THIS bar's input — the popped
            out player is the same player, so it has to search the same way.
            Sticky with the header so the keyboard can't push them out of
            reach; they retract on Enter and come back on the next keystroke. */}
        {!docked && !peek && scopesOpen && (
          <PlayerScopeChips
            compact
            provider={playerProvider}
            scope={playerScope}
            onProvider={(id) => {
              setPlayerProvider(id);
              // The address changes with the platform: @handle on YouTube,
              // r/ on Reddit. Rewrite what's in the box so it stays valid.
              if (playerScope === 'channel') setPlayerQuery(toHandle(playerQuery, id));
              setScopesOpen(true);
            }}
            onScope={(id) => {
              setPlayerScope(id);
              if (id === 'channel') {
                const h = toHandle(playerQuery, playerProvider);
                if (h) setPlayerQuery(h);
              } else if (playerScope === 'channel') {
                setPlayerQuery(playerQuery.replace(/^(@|r\/|c\/)/i, ''));
              }
              setScopesOpen(true);
            }}
            className="sticky top-[44px] z-40 bg-black/60 backdrop-blur-xl border-b border-white/10"
          />
        )}

        {/* The player itself is the SHARED component — the same stack that
            docks inside the Tube search bar. This file now owns only the
            floating FRAME (drag, resize, geometry, accent ring); everything
            inside it is TrueglePlayer, so "one player" is structural rather
            than a resemblance that drifts. */}
        <div className={clipWhenMin || peek ? 'max-h-0 overflow-hidden' : ''} aria-hidden={peek}>
          <TrueglePlayer
            presentation={docked ? 'expanded' : 'popped'}
            accent={accent || undefined}
            hideScreen={footerDock && footerView === 'hidden'}
            openListNonce={submitNonce}
            moveOn={adjust}
            onToggleMove={() => setAdjust((v) => !v)}
            query={docked ? page.text : playerQuery}
            scope={docked ? page.scope : playerScope}
            provider={docked ? page.provider : playerProvider}
          />
        </div>

        {/* Move mode's own row is gone: the transport's right-hand control IS
            the move toggle once the player is popped out and away from Tube.
            Two buttons for one job, in two different places, was the "press
            pop-out, press move, drag, press move, press pop-out" dance. */}
        {adjust && !footerDock && !docked && !peek && (
          <div className="relative z-30 px-3 py-1 border-t border-cyan-400/20 bg-cyan-400/10">
            <span className="text-[10px] uppercase tracking-wider text-cyan-200/80">
              Drag anywhere to move · corner to resize
            </span>
          </div>
        )}

        {/* Resize grip in its own footer strip — never overlaps the media
            controls, and needs no mode of its own. Bigger while moving so a
            thumb can find it without leaving the mode. */}
        {!minimized && !footerDock && !docked && !peek && (
          <div className={`relative z-30 flex justify-end border-t ${adjust ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-white/10 bg-black/20'}`}>
            <div
              onPointerDown={startResize}
              title="Drag to resize"
              style={{ touchAction: 'none' }}
              className={`cursor-nwse-resize flex items-end justify-end p-1.5 ${adjust ? 'w-11 h-11' : 'w-8 h-6'}`}
            >
              <span className={`block border-r-2 border-b-2 ${adjust ? 'w-4 h-4 border-cyan-300' : 'w-2.5 h-2.5 border-white/40'}`} />
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
