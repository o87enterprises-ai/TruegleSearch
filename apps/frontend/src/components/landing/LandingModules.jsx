import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Clapperboard, Compass, LineChart, MessageCircle, Newspaper, PlayCircle, ShieldCheck } from 'lucide-react';
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
  { id: 'why', title: 'Why Truegle?', icon: ShieldCheck, pitch: 'Search without bias, tracking, or censorship.', card: true },
  { id: 'search', title: 'Search', icon: Compass, pitch: 'Same query, different lens. Pick your reality.' },
  { id: 'tube', title: 'Tube', icon: PlayCircle, pitch: 'Every video, reel and song. One player. Zero ads.' },
  { id: 'chat', title: 'Chat', icon: MessageCircle, pitch: 'Ask TrueGLE. Stack lenses. See every angle.' },
  { id: 'feed', title: 'Feed', icon: Clapperboard, pitch: 'Reddit, Bluesky, Mastodon and creators. One scroll.' },
  { id: 'news', title: 'News', icon: Newspaper, pitch: 'Today’s headlines, as video. Tap and watch.', wide: true },
  // `wide`: two columns on desktop only. Below Why Truegle's full-width card
  // sit six tiles: three rows of two on a phone, and on desktop four across
  // then News and Markets two wide each — no orphan in either grid.
  { id: 'markets', title: 'Markets', icon: LineChart, pitch: 'Prices, charts, and the takes moving them.', wide: true },
];

/** Two columns on a phone, four from 768px up. */
function useColumns() {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener?.('change', on);
    on();
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide ? 4 : 2;
}

/** Columns a tile takes: a card is the full width, `wide` is two on desktop. */
const spanOf = (m, cols) => (m.card ? cols : m.wide && cols === 4 ? 2 : 1);

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
        <span className="min-w-0 text-sm sm:text-base font-bold leading-tight" style={{ color }}>{mod.title}</span>
      </span>
      <span data-tile-pitch="" className="block mt-2 pr-4 text-[12px] leading-snug text-white/70">{mod.pitch}</span>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
