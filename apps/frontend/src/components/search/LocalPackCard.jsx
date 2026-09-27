import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Globe, Navigation, MapPin, ChevronDown, Share2 } from 'lucide-react';

const LocalPackMap = lazy(() => import('./LocalPackMap'));

// THE LISTINGS CARD — Truegle Maps, inline, for any business query:
// "O'Reilly's near me", "autozone cottage grove", "eugene patent lawyers".
//
// Built to the owner's reference (Google's local results, 2026-09-27):
//   · one card, collapsible as a whole;
//   · a map with lettered pins matching the lettered listings;
//   · up to FOUR listings, divided by visible lines, then "More locations";
//   · every listing: name, what it is, address, distance, and Call /
//     Directions / Website one tap away — no second screen to find a number;
//   · each listing expands for its full details.
//
// Data from /api/maps/local-pack (TomTom POIs). Nothing is invented: a field
// the map data doesn't have is simply not shown — no stars, no hours.

const miles = (m) => (m == null ? null : m < 305 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);
const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
// Privacy-respecting directions (OpenStreetMap), not a tracker's.
const directionsHref = (p) => `https://www.openstreetmap.org/directions?route=%3B${p.lat}%2C${p.lng}`;
const letter = (i) => String.fromCharCode(65 + i);

const SHOWN = 4;

const chip = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors';

function Listing({ p, i, active, onHover }) {
  const [open, setOpen] = useState(false);
  const share = async () => {
    const text = [p.name, p.address, p.phone].filter(Boolean).join(' · ');
    try {
      if (navigator.share) await navigator.share({ title: p.name, text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* dismissed */ }
  };
  return (
    <li
      onMouseEnter={() => onHover(i)}
      onMouseLeave={() => onHover(-1)}
      className={`px-4 py-3 transition-colors ${active ? 'bg-white/[0.06]' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center" aria-hidden="true">{letter(i)}</span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="w-full text-left flex items-start gap-2 group"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold text-white leading-tight">{p.name}</span>
                {p.mentioned && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/30" title="This business also appears in the web results below">
                    In your results
                  </span>
                )}
              </span>
              <span className="block text-xs text-white/55 mt-0.5 leading-snug">
                {[p.category, miles(p.distanceMeters)].filter(Boolean).join(' · ')}
              </span>
              {p.address && <span className="block text-xs text-white/70 mt-0.5 truncate">{p.address}</span>}
            </span>
            <ChevronDown
              size={16}
              aria-label={open ? 'Hide details' : 'Show details'}
              className={`shrink-0 mt-1 text-white/40 group-hover:text-white/80 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {/* One tap from the list: the reason this card exists. */}
          <div className="flex flex-wrap gap-2 mt-2">
            {p.phone && (
              <a href={telHref(p.phone)} className={`${chip} bg-cyan-500 text-black hover:bg-cyan-400`} aria-label={`Call ${p.name}`}>
                <Phone size={13} aria-hidden="true" /> Call
              </a>
            )}
            {Number.isFinite(p.lat) && (
              <a href={directionsHref(p)} target="_blank" rel="noopener noreferrer" className={`${chip} border border-white/20 text-white/85 hover:bg-white/10`}>
                <Navigation size={13} aria-hidden="true" /> Directions
              </a>
            )}
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer" title={hostOf(p.website)} className={`${chip} border border-white/20 text-white/85 hover:bg-white/10`}>
                <Globe size={13} aria-hidden="true" /> Website
              </a>
            )}
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.dl
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2 text-xs text-white/75 space-y-1.5"
              >
                {p.address && (
                  <div className="flex gap-2"><dt className="sr-only">Address</dt><MapPin size={13} className="shrink-0 mt-0.5 text-white/40" aria-hidden="true" /><dd>{p.address}</dd></div>
                )}
                {p.phone && (
                  <div className="flex gap-2"><dt className="sr-only">Phone</dt><Phone size={13} className="shrink-0 mt-0.5 text-white/40" aria-hidden="true" /><dd><a href={telHref(p.phone)} className="text-cyan-300 hover:underline">{p.phone}</a></dd></div>
                )}
                {p.website && (
                  <div className="flex gap-2"><dt className="sr-only">Website</dt><Globe size={13} className="shrink-0 mt-0.5 text-white/40" aria-hidden="true" /><dd><a href={p.website} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline break-all">{hostOf(p.website)}</a></dd></div>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={share} className="inline-flex items-center gap-1 text-white/60 hover:text-white">
                    <Share2 size={12} aria-hidden="true" /> Share
                  </button>
                </div>
                <p className="text-[10px] text-white/35">From public map data — hours and numbers can be out of date.</p>
              </motion.dl>
            )}
          </AnimatePresence>
        </div>
      </div>
    </li>
  );
}

export default function LocalPackCard({ pack, accent, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  if (!pack?.places?.length) return null;
  const places = expanded ? pack.places : pack.places.slice(0, SHOWN);
  const more = pack.places.length - SHOWN;

  return (
    <motion.section
      aria-label={`${pack.label}${pack.where ? ` — ${pack.where}` : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`rounded-2xl border bg-white/[0.04] backdrop-blur-sm overflow-hidden ${accent?.border || 'border-white/10'}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 pt-3 pb-2 text-left"
      >
        <MapPin size={16} className="text-cyan-300 shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white truncate">
          {pack.label}{pack.where ? <span className="text-white/50 font-normal"> · {pack.where}</span> : null}
        </h2>
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold">
          {pack.places.length} {pack.places.length === 1 ? 'place' : 'places'}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col md:flex-row-reverse border-t border-white/10">
              {/* Map: above the list on a phone, beside it on desktop. The
                  relative/absolute pair gives Leaflet a box with a real
                  height to draw into — h-auto alone left it at zero. */}
              <div className="relative h-40 md:h-auto md:min-h-[240px] md:w-72 shrink-0 md:border-l border-white/10">
                <div className="absolute inset-0">
                  <Suspense fallback={<div className="w-full h-full bg-white/5 animate-pulse" />}>
                    <LocalPackMap places={places} center={pack.center} activeIndex={active} onPick={setActive} />
                  </Suspense>
                </div>
              </div>

              <ol className="flex-1 min-w-0 divide-y divide-white/15">
                {places.map((p, i) => (
                  <Listing key={`${p.name}|${p.address}`} p={p} i={i} active={active === i} onHover={setActive} />
                ))}
              </ol>
            </div>

            {more > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-white/15 text-xs font-semibold text-white/75 hover:bg-white/5 transition-colors"
              >
                {expanded ? 'Fewer locations' : `More locations (${more})`}
                <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
