import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Globe, Navigation, MapPin, ChevronDown } from 'lucide-react';

const LocalPackMap = lazy(() => import('./LocalPackMap'));

// Truegle Maps, inline: the local businesses for "eugene oregon patent
// lawyers", each its own card with Call / Website / Directions — so calling
// one of them never means leaving the results. Data from /api/maps/local-pack
// (TomTom POIs); nothing here is invented, so a field TomTom doesn't have is
// simply not shown.

const miles = (m) => (m == null ? null : m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);
const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
// Privacy-respecting directions until Truegle Maps has its own route view.
const directionsHref = (p) => `https://www.openstreetmap.org/directions?route=%3B${p.lat}%2C${p.lng}`;

const SHOWN = 3;

export default function LocalPackCard({ pack, accent }) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  if (!pack?.places?.length) return null;
  const places = expanded ? pack.places : pack.places.slice(0, SHOWN);
  const more = pack.places.length - SHOWN;

  return (
    <motion.section
      aria-label={`${pack.label}${pack.where ? ` in ${pack.where}` : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`mb-5 rounded-2xl border bg-white/[0.04] backdrop-blur-sm overflow-hidden ${accent?.border || 'border-white/10'}`}
    >
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <MapPin size={16} className="text-cyan-300 shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white truncate">
          {pack.label}{pack.where ? <span className="text-white/50 font-normal"> · {pack.where}</span> : null}
        </h2>
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold">Truegle Maps</span>
      </header>

      <div className="flex flex-col md:flex-row-reverse">
        {/* Map: above the list on a phone, beside it on desktop. */}
        {/* relative + absolute child: beside the list the column's height
            comes from the list (flex stretch), and Leaflet needs a box with a
            real height to draw into — h-auto alone left it at zero. */}
        <div className="relative h-40 md:h-auto md:min-h-[240px] md:w-72 shrink-0 md:border-l border-white/10">
          <div className="absolute inset-0">
            <Suspense fallback={<div className="w-full h-full bg-white/5 animate-pulse" />}>
              <LocalPackMap places={places} center={pack.center} activeIndex={active} onPick={setActive} />
            </Suspense>
          </div>
        </div>

        <ol className="flex-1 min-w-0 divide-y divide-white/10">
          {places.map((p, i) => (
            <li
              key={p.name}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}
              className={`px-4 py-3 transition-colors ${active === i ? 'bg-white/[0.06]' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center" aria-hidden="true">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-semibold text-white leading-tight">{p.name}</h3>
                    {p.mentioned && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/30" title="This business also appears in the web results below">
                        In your results
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/55 mt-0.5 leading-snug">
                    {[p.category, p.address].filter(Boolean).join(' · ')}
                    {miles(p.distanceMeters) ? <span className="text-white/35"> · {miles(p.distanceMeters)}</span> : null}
                  </p>
                  {p.phone && <p className="text-xs text-white/70 mt-0.5">{p.phone}</p>}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.phone && (
                      <a
                        href={telHref(p.phone)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-colors"
                        aria-label={`Call ${p.name}`}
                      >
                        <Phone size={13} aria-hidden="true" /> Call
                      </a>
                    )}
                    {p.website && (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={hostOf(p.website)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 text-white/80 text-xs hover:bg-white/10 transition-colors"
                      >
                        <Globe size={13} aria-hidden="true" /> Website
                      </a>
                    )}
                    {Number.isFinite(p.lat) && (
                      <a
                        href={directionsHref(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 text-white/80 text-xs hover:bg-white/10 transition-colors"
                      >
                        <Navigation size={13} aria-hidden="true" /> Directions
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {more > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-white/10 text-xs font-semibold text-white/70 hover:bg-white/5 transition-colors"
        >
          {expanded ? 'Fewer places' : `More places (${more})`}
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </motion.section>
  );
}
