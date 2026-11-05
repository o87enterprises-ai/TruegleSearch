import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Clapperboard, Compass, LineChart, MessageCircle, Newspaper, PlayCircle, ShieldCheck } from 'lucide-react';
import { CARD_ACCENT, inkOn, shade } from './cardTheme';
import useAutoOpenOnScroll from './useAutoOpenOnScroll';
import WhyBody from './WhyBody';
import SearchBody from './SearchBody';
import ChatBody from './ChatBody';
import TubeBody from './TubeBody';
import FeedBody from './FeedBody';
import { NewsBody, MarketsBody } from './NewsFeed';

// THE LANDING PAGE'S MODULES: one unified block of tiles in a grid, not a
// vertical list of cards (owner, 2026-09-29).
//
// A TILE is an icon, a one-word title in its pill's colour, and an elevator
// pitch of ten words or fewer — enough to glance and get the jist. Pressing a
// tile opens its body in a full-width panel directly UNDER THAT TILE'S ROW;
// pressing it again (or another tile) retracts it completely. The tiles never
// move: the panel is the only thing that comes and goes, which is what keeps a
// grid from jumping under a thumb.
//
// ONE OPEN AT A TIME, and only by a hand — no hover previews here, because a
// panel opening under a resting cursor pushes the tiles out from under it. The
// single exception is Why Truegle on a PHONE, which descends by itself as you
// scroll down to it (useAutoOpenOnScroll), and only into a quiet page.
//
// TILE ORDER FOLLOWS THE PILL (owner, 2026-10-18): Tube · Feed · Search (Green,
// Mainstream, Rabbit Hole, OSINT) · Chat — the pill's own order, with the four
// search lenses living together inside the Search tile.
//
// WHY TRUEGLE IS NOT A TILE BUT A CARD: full width, and its body opens inside
// its own border instead of in a panel under a row shared with Search.
//
// NOTHING IS ASKED FOR WHILE A TILE IS CLOSED: only the open tile's body is
// mounted, so its fetches and polling start on open and stop on close.

const MODULES = [
  // `card`: full width, and its body opens INSIDE the same bordered card
  // rather than in a separate panel under the row (owner, 2026-10-17: the
  // dropdown and the Why Truegle tile were two components, and Search sat
  // between them). Search is the next tile, directly below.
  { id: 'why', title: 'Why Truegle?', icon: ShieldCheck, pitch: '', card: true },
  { id: 'tube', title: 'Tube', icon: PlayCircle, to: '/tube', pitch: 'One customizable player for all media.\nFree streaming, no ads, ever.' },
  { id: 'feed', title: 'Feed', icon: Clapperboard, to: '/feed', pitch: 'One feed for all social media.' },
  { id: 'search', title: 'Search', icon: Compass, to: '/search', pitch: 'Multiple modes for discovering what other search methods suppress.' },
  { id: 'chat', title: 'Chat', icon: MessageCircle, to: '/chat', pitch: 'Unbiased, unopinionated, and indifferent deep research agent.' },
  { id: 'news', title: 'News', icon: Newspaper, to: '/feed?category=news', pitch: 'Today’s headlines, as video. Tap and watch.' },
  // TWO ROWS OF THREE at every width (owner, 2026-11-05): one-word titles,
  // the pitch drops down on hover or tap, and the coloured Go pill navigates
  // straight to the page.
  { id: 'markets', title: 'Markets', icon: LineChart, to: '/feed?category=markets', pitch: 'Prices, charts, and the takes moving them.' },
];

/** Three across at every width: six tiles = two rows of three. */
const useColumns = () => 3;

/** Columns a tile takes: a card is the full width, `wide` is two on desktop. */
const spanOf = (m, cols) => (m.card ? cols : 1);

/** Tile indices by row, given each tile's column span. */
function packRows(mods, cols) {
  const rows = [];
  let row = [];
  let used = 0;
  mods.forEach((m, i) => {
    const span = spanOf(m, cols);
    if (used + span > cols) { rows.push(row); row = []; used = 0; }
    row.push(i);
    used += span;
  });
  if (row.length) rows.push(row);
  return rows;
}

function Tile({ mod, open, onToggle, tileRef, cols, bare = false }) {
  if (bare) return <CardHeader mod={mod} open={open} onToggle={onToggle} tileRef={tileRef} />;
  const color = CARD_ACCENT[mod.id];
  const Icon = mod.icon;
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  // Hover floats the pitch BELOW the tile (absolute, so the row never grows
  // and no tile moves); tapped open, the pitch heads the panel instead.
  const showPitch = hover && !open;
  return (
    <div
      data-tile={mod.id}
      data-open={open ? 'open' : 'closed'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onToggle}
      className="relative flex flex-col cursor-pointer rounded-2xl border p-2 sm:p-3 backdrop-blur-sm transition-colors duration-200 hover:bg-white/[0.07]"
      style={{ gridColumn: `span ${spanOf(mod, cols)}`, borderColor: `${color}${open ? 'bb' : '55'}`, background: open ? `${color}18` : 'rgba(255,255,255,0.03)' }}
    >
      <button
        ref={tileRef}
        type="button"
        aria-expanded={open}
        aria-controls={`landing-panel-${mod.id}`}
        className="flex flex-col items-center gap-1 text-center w-full"
      >
        <span
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color}, ${shade(color)})`, color: inkOn(color) }}
        >
          <Icon size={16} />
        </span>
        <span data-tile-title="" className="text-sm sm:text-base font-bold leading-tight" style={{ color }}>{mod.title}</span>
        <ChevronDown size={12} aria-hidden="true" className={`text-white/40 transition-transform duration-300 ${open || showPitch ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {showPitch && mod.pitch && (
          <motion.span
            data-tile-pitch=""
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
            className="pointer-events-none absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border px-2 py-1.5 text-center text-[11px] sm:text-[12px] leading-snug text-white/85 whitespace-pre-line bg-[#13131f]/95 backdrop-blur-md shadow-xl"
            style={{ borderColor: `${color}66` }}
          >
            {mod.pitch}
          </motion.span>
        )}
      </AnimatePresence>
      {mod.to && (
        <button
          type="button"
          data-tile-go={mod.id}
          onClick={(e) => { e.stopPropagation(); navigate(mod.to); }}
          aria-label={`Go to ${mod.title}`}
          className="mt-2 mx-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold shadow-md transition-transform active:scale-95 hover:brightness-110"
          style={{ background: `linear-gradient(135deg, ${color}, ${shade(color)})`, color: inkOn(color) }}
        >
          Go <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

function CardHeader({ mod, open, onToggle, tileRef, cols, bare = true }) {
  const color = CARD_ACCENT[mod.id];
  const Icon = mod.icon;
  return (
    <button
      ref={tileRef}
      type="button"
      data-tile={mod.id}
      data-open={open ? 'open' : 'closed'}
      aria-expanded={open}
      aria-controls={`landing-panel-${mod.id}`}
      onClick={onToggle}
      // flex-col + justify-start: a button centres its content vertically by
      // default, which floated the wide Markets tile's title below its
      // neighbours'.
      // `bare`: the card around it owns the border and background.
      className={bare
        ? 'relative flex flex-col justify-start text-left w-full rounded-2xl p-3 transition-colors duration-200 hover:bg-white/[0.04]'
        : 'relative flex flex-col justify-start text-left rounded-2xl border p-3 backdrop-blur-sm transition-colors duration-200 hover:bg-white/[0.07]'}
      style={bare
        ? undefined
        : { gridColumn: `span ${spanOf(mod, cols)}`, borderColor: `${color}${open ? 'bb' : '55'}`, background: open ? `${color}18` : 'rgba(255,255,255,0.03)' }}
    >
      <span className="flex items-center gap-1.5 sm:gap-2">
        <span
          className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color}, ${shade(color)})`, color: inkOn(color) }}
        >
          <Icon size={16} />
        </span>
        {/* Wraps rather than truncates: at 320, 360 and 768px the tiles are too
            narrow for "Why Truegle?" on one line, and a clipped title is worse
            than a two-line one (the row stretches to match). */}
        <span data-tile-title="" className="min-w-0 text-sm sm:text-base font-bold leading-tight" style={{ color }}>{mod.title}</span>
      </span>
      {mod.pitch && <span data-tile-pitch="" className="block mt-2 pr-4 text-[12px] leading-snug text-white/70 whitespace-pre-line">{mod.pitch}</span>}
      {/* In the corner rather than in the title row: a title row with an icon
          AND a chevron left "Why Truegle?" room for "Why Tru…". */}
      <ChevronDown size={14} aria-hidden="true" className={`absolute bottom-2.5 right-2.5 text-white/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

/** A tile and its body as ONE bordered card: the body opens inside it. */
function CardTile({ mod, open, onToggle, tileRef, cols, children }) {
  const reduce = useReducedMotion();
  const color = CARD_ACCENT[mod.id];
  return (
    <div
      data-card={mod.id}
      className="rounded-2xl border backdrop-blur-sm transition-colors duration-200"
      style={{ gridColumn: `span ${spanOf(mod, cols)}`, borderColor: `${color}${open ? 'bb' : '55'}`, background: open ? `${color}18` : 'rgba(255,255,255,0.03)' }}
    >
      <Tile mod={mod} open={open} onToggle={onToggle} tileRef={tileRef} cols={cols} bare />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`landing-panel-${mod.id}`}
            data-panel={mod.id}
            role="region"
            aria-label={mod.title}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-3 pt-3 border-t" style={{ borderColor: `${color}55` }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({ mod, children }) {
  const reduce = useReducedMotion();
  const color = CARD_ACCENT[mod.id];
  return (
    <motion.div
      id={`landing-panel-${mod.id}`}
      data-panel={mod.id}
      role="region"
      aria-label={mod.title}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, opacity: { duration: 0.18 } }}
      className="col-span-full overflow-hidden"
    >
      <div className="rounded-2xl border p-4" style={{ borderColor: `${color}99`, background: `${color}0d` }}>
        {mod.pitch && <p data-panel-pitch="" className="mb-3 text-[12px] leading-snug text-white/70 whitespace-pre-line">{mod.pitch}</p>}
        {children}
      </div>
    </motion.div>
  );
}

export default function LandingModules({ safeModeOff, canDisableSafeSearch, toggleSafeMode, onOpenTube }) {
  const [openId, setOpenId] = useState(null);
  const cols = useColumns();
  const rows = useMemo(() => packRows(MODULES, cols), [cols]);
  const whyRef = useRef(null);

  // Descends by itself on a phone, into a quiet page only: a tile the visitor
  // opened wins.
  useAutoOpenOnScroll(whyRef, useCallback(() => setOpenId((cur) => cur ?? 'why'), []));

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  const body = (id) => {
    switch (id) {
      case 'why': return <WhyBody safeModeOff={safeModeOff} canDisableSafeSearch={canDisableSafeSearch} toggleSafeMode={toggleSafeMode} />;
      case 'search': return <SearchBody />;
      case 'chat': return <ChatBody />;
      case 'tube': return <TubeBody onOpen={onOpenTube} />;
      case 'feed': return <FeedBody />;
      case 'news': return <NewsBody />;
      case 'markets': return <MarketsBody />;
      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4" data-landing-modules="">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {rows.map((row) => (
          <Fragment key={row.join('-')}>
            {row.map((i) => {
              const mod = MODULES[i];
              const common = {
                mod,
                cols,
                open: openId === mod.id,
                onToggle: () => toggle(mod.id),
                tileRef: mod.id === 'why' ? whyRef : undefined,
              };
              return mod.card
                ? <CardTile key={mod.id} {...common}>{body(mod.id)}</CardTile>
                : <Tile key={mod.id} {...common} />;
            })}
            {/* The panel sits under the row of the tile that opened it. Each
                row has its own slot so closing animates in place and moving to
                another row animates out here and in there. */}
            <AnimatePresence initial={false}>
              {row.some((i) => !MODULES[i].card && MODULES[i].id === openId) && (
                <Panel key={openId} mod={MODULES.find((m) => m.id === openId)}>
                  {body(openId)}
                </Panel>
              )}
            </AnimatePresence>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
