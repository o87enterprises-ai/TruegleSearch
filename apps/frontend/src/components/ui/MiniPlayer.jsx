import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { X, Minus, GripHorizontal, PictureInPicture2, PanelBottom } from 'lucide-react';
import { MODE_COLORS, BRAND_GRADIENT } from '../../config/modeTheme';
import { usePageMode, BRAND } from '../../hooks/usePageMode';
import TrueglePlayer from '../player/TrueglePlayer';
import { useFeedbackBarHeight } from './PreProductionBanner';
import { useBottomDockClaim } from '../../hooks/useBottomDock';
import { usePlayerQuery } from '../../utils/playerQueryStore';
import { toHandle } from '../../utils/playerQuery';
import PlayerMiniBar from '../player/PlayerMiniBar';
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
    current, queue, history, minimized, poppedOut, dock,
    next, prev, close, toggleMinimize, setPoppedOut, setDock,
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
  // MOVE MODE IS GONE. It was a state you switched on before you could drag,
  // because an iframe swallows pointer events so the picture could not be a
  // drag handle. A desktop window does not work that way and never needed to:
  // you drag its bar and resize its corner, which is what the grab bar and the
  // corner grip already do. The button that turned the mode on has gone with
  // it — one less control, and one less thing that only existed in one
  // presentation.
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
  // Fixed at "everything". The chips that used to narrow this are gone from
  // both bars — a bang (!yt, !reddit, !sc) narrows a single query instead, and
  // costs no screen to offer. Kept as named constants rather than inlined
  // because TrueglePlayer still takes them, and the day one of them becomes a
  // real setting again this is the seam.
  const playerScope = 'all';
  const playerProvider = 'all';
  const playerInputRef = useRef(null);
  const submitPlayerQuery = useCallback(() => {
    setSubmitNonce((n) => n + 1);
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

  // ── keeping clear of the page's own search bar ───────────────────────────
  // A floating window is free to sit anywhere, and in a SHORT viewport —
  // a phone held in landscape — "anywhere" is on top of the search box, which
  // is the one thing it must never cover. You cannot tap what is covered, and
  // you cannot move the thing covering it without tapping past it first.
  //
  // Retract-while-typing already existed and does not help here: it fires on
  // FOCUS, and focus is exactly what the overlap prevents.
  const [pageBar, setPageBar] = useState(null);
  const floating = poppedOut && !docked;
  useEffect(() => {
    if (!floating) { setPageBar(null); return undefined; }
    const measure = () => {
      const el = document.querySelector('[data-page-search]');
      if (!el) { setPageBar(null); return; }
      const r = el.getBoundingClientRect();
      setPageBar((prev) => (prev
        && Math.abs(prev.top - r.top) < 0.5
        && Math.abs(prev.bottom - r.bottom) < 0.5
        ? prev
        : { top: r.top, bottom: r.bottom }));
    };
    measure();
    // Same three triggers the slot uses: the bar moves when the page scrolls,
    // when the viewport rotates, and when something above it loads.
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    const poll = setInterval(measure, 250);
    return () => {
      clearInterval(poll);
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [floating]);

  // ── telling the screen how much room it actually has ────────────────────
  // The docked path has always set --truegle-player-cap; the floating one
  // never did. So the media area sized itself against the VIEWPORT while the
  // frame was sized against whatever is left after keeping clear of the page's
  // search bar — and in a short viewport the difference is the whole transport
  // row, scrolled out of the bottom of a window that looks like it should not
  // need scrolling.
  //
  // Both numbers are read from the DOM rather than derived. The frame's chrome
  // (header, filter strip, transport) came to 18px more than a reasoned-out
  // constant — borders, a divider, the transport's padding — and that is not a
  // figure worth guessing when one rect read is exact. Polled because the list
  // opening and the filter strip appearing both change it with no event.
  useEffect(() => {
    if (!floating) return undefined;
    const root = document.documentElement;
    const measure = () => {
      const frame = document.querySelector('[data-mini]');
      const screen = frame?.querySelector('[data-player-screen]');
      if (!frame || !screen) return;
      const max = parseFloat(getComputedStyle(frame).maxHeight);
      if (!Number.isFinite(max)) return;
      const chrome = Math.max(80, frame.scrollHeight - screen.getBoundingClientRect().height);
      root.style.setProperty('--truegle-player-cap', `${Math.max(100, Math.round(max - chrome))}px`);
    };
    measure();
    const poll = setInterval(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(poll);
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--truegle-player-cap');
    };
  }, [floating]);
  // Only the free-floating and footer forms overlap the page. The slot-docked
  // player is IN the layout, so it can't be in anybody's way.
  // ONE small state. `peek` (retract while typing) used to be a fourth
  // presentation with its own row of buttons; it is now just this — the same
  // bar, shown for a different reason.
  //
  // DOCKED IS INCLUDED NOW. It used to be excluded, on the reasoning that a
  // docked player sits IN the page below the search bar rather than on top of
  // it, so typing never covers anything. That is true and it was not the whole
  // problem: covering is not the only way to be in the way. Docked, the player
  // takes a large bite out of the screen directly beneath the bar, and on a
  // phone with the keyboard up there was no room left underneath it for the
  // suggestions — so the thing you were typing into had nowhere to show you
  // what it had found.
  //
  // The trade is honest: the results below do shift up while you type and back
  // down when you stop. That is the same motion the player already makes when
  // it expands and collapses, and it buys back the space the suggestions need.
  const small = minimized || (pageTyping && !peekOpen);

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

  // Pinned across the bottom, the player is competing for the same strip as
  // the early-access feedback bar — and it loses, because that bar is z-[60]
  // and full width. Claiming the dock collapses the bar to its chip for as
  // long as the player is down here, which hands back the height the player is
  // squeezed by. Released automatically when it floats again or closes.
  useBottomDockClaim(footerDock && !!current);

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
  //
  // Also kept live whenever the player is FOOTER-docked: that presentation
  // pins across the bottom the same way a slot does, but of its own pages
  // that manage their own internal scroll (e.g. TruegleChat's fixed-height
  // shell) can't benefit from the body.paddingBottom reservation below —
  // body scroll never applies inside an overflow-hidden shell. Those pages
  // read this var directly to reserve their own extra scroll room instead.
  useEffect(() => {
    const el = frameRef.current;
    const active = docked || (footerDock && !!current);
    if (!active || !el) {
      document.documentElement.style.removeProperty('--truegle-player-h');
      return undefined;
    }
    const apply = () => document.documentElement.style.setProperty(
      '--truegle-player-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--truegle-player-h');
    };
  }, [docked, footerDock, current]);

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

  // How tall the floating frame may be without crossing the page's search bar.
  // Returns the height unchanged when the bar is off screen, already clear, or
  // when clearing it would squash the frame below its minimum — in that last
  // case there is genuinely no arrangement that fits, and a frame too small to
  // use is not an improvement on one that overlaps.
  // ...for a frame that hangs from a fixed TOP. Shrinking it lifts the bottom
  // edge, which is exactly what is needed.
  const capBelow = (height, top) => {
    if (!pageBar) return height;
    if (pageBar.bottom <= 0 || pageBar.top >= visible) return height; // off screen
    const room = pageBar.top - top - 8;
    if (room >= height) return height;                                // already clear
    // No arrangement fits. A frame squashed below its minimum is not an
    // improvement on one that overlaps, so leave it and let retract-on-typing
    // handle the moment it actually matters.
    return room >= minH ? Math.round(room) : height;
  };

  // ...and for a frame anchored to the BOTTOM. Shrinking one of those moves
  // its TOP down and leaves the bottom edge exactly where it was — which is
  // the edge doing the overlapping. The anchor has to be raised instead.
  // Getting this backwards is why the first fix measured clean and changed
  // nothing on screen.
  const liftedBottom = (() => {
    const base = BANNER_CLEARANCE + keyboardInset;
    if (!pageBar) return base;
    if (pageBar.bottom <= 0 || pageBar.top >= visible) return base;
    return Math.max(base, Math.round(visible - pageBar.top + 8));
  })();

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
      // Anchored only by `bottom`, with no ceiling — so tall content (the
      // results list open) grew straight past the top of the screen once the
      // keyboard ate into `visible`, taking the frame's own search bar off
      // the top edge with it. The docked and floating paths above already
      // guard against this exact failure; footerDock never did.
      maxHeight: `${Math.max(minH, Math.round(visible - (feedbackOffset + keyboardInset) - 8))}px`,
      overflowY: 'auto',
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
        maxHeight: `${capBelow(visibleHeight, floatTop)}px`,
        overflowY: 'auto',
      }
      : {
        left: 16,
        bottom: liftedBottom,
        width,
        maxHeight: `${Math.max(140, Math.round(visible - liftedBottom - 16))}px`,
        overflowY: 'auto',
      };

  // Every control is a ≥36px square. The old 13px icons packed edge to edge
  // were the other half of the "hard to maneuver" problem.
  const ctrl = 'flex items-center justify-center w-9 h-9 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors';

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
          background: ring,
          // Docked, the bar above supplies the top edge — a ring all the way
          // round would draw a line through the middle of one surface.
          padding: docked ? '0 1.5px 1.5px' : 1.5,
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
        {/* THE minimized player — the same component and the same footprint
            whether the player is floating, docked into the page, or pinned to
            the footer, and whether it got small because you minimized it or
            because you started typing. That sameness is the point: the
            controls stop changing under you. The media node is NOT unmounted
            to render this; it keeps playing behind the bar. */}
        {small && (
          <PlayerMiniBar
            accent={accent || undefined}
            onExpand={() => { setPeekOpen(true); if (minimized) toggleMinimize(); }}
            onClose={close}
          />
        )}

        {/* ── Grab bar. Thick on purpose: 44px tall, full width, with a visible
            grip so it reads as "hold here to move me".
            Docked, it's gone entirely: the page's search bar is directly above
            and a second search input under it is exactly the duplication we
            took out. ── */}
        {!docked && !small && (
        <div
          onPointerDown={footerDock ? undefined : startMove}
          style={{ touchAction: footerDock ? 'auto' : 'none', background: tint }}
          className={`sticky top-0 z-40 flex items-center gap-1.5 px-2 min-h-[44px] border-b backdrop-blur-xl ${footerDock ? '' : 'cursor-move'} ${
            'border-white/10'
          }`}
        >
          {!footerDock && (
            <GripHorizontal size={18} className="text-white/40 shrink-0" />
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
              onChange={(e) => setPlayerQuery(e.target.value)}
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
          {/* One Minimize everywhere. This slot used to be a Watch/Hidden
              pair in the footer and a plain minimize elsewhere — two controls
              for one idea, in two places, doing subtly different things.
              Expanding again is the button on the minimized bar itself. */}
          <button type="button" onClick={toggleMinimize} title="Minimize the player"
            aria-label="Minimize the player" className={ctrl}>
            <Minus size={16} />
          </button>
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

        {/* The chip rows are gone here too — the popped-out player is the
            same player, so it searches the same way: every provider at once,
            with the result's own colour saying which one answered. Bangs still
            narrow it per query. */}

        {/* The player itself is the SHARED component — the same stack that
            docks inside the Tube search bar. This file now owns only the
            floating FRAME (drag, resize, geometry, accent ring); everything
            inside it is TrueglePlayer, so "one player" is structural rather
            than a resemblance that drifts. */}
        {/* Clipped, not unmounted — unmounting the iframe restarts the track.
            But a clipped subtree is still TABBABLE, so aria-hidden alone would
            leave a keyboard user landing on eleven invisible controls. `inert`
            takes them out of the tab order and out of the a11y tree together,
            which is the only correct pairing. */}
        <div
          className={small ? 'max-h-0 overflow-hidden' : ''}
          aria-hidden={small}
          inert={small ? '' : undefined}
        >
          <TrueglePlayer
            presentation={docked ? 'expanded' : 'popped'}
            accent={accent || undefined}
            openListNonce={submitNonce}
            query={docked ? page.text : playerQuery}
            scope={docked ? page.scope : playerScope}
            provider={docked ? page.provider : playerProvider}
          />
        </div>

        {/* Move mode's own row is gone: the transport's right-hand control IS
            the move toggle once the player is popped out and away from Tube.
            Two buttons for one job, in two different places, was the "press
            pop-out, press move, drag, press move, press pop-out" dance. */}

        {/* Resize grip in its own footer strip — never overlaps the media
            controls, and needs no mode of its own. Bigger while moving so a
            thumb can find it without leaving the mode. */}
        {!footerDock && !docked && !small && (
          <div className="relative z-30 flex justify-end border-t border-white/10 bg-black/20">
            <div
              onPointerDown={startResize}
              title="Drag to resize"
              style={{ touchAction: 'none' }}
              className="cursor-nwse-resize flex items-end justify-end p-1.5 w-9 h-8"
            >
              <span className="block border-r-2 border-b-2 w-3 h-3 border-white/40" />
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
