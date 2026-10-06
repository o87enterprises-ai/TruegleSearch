import { useState } from 'react';
import { Phone, Globe, Navigation, MapPin, ChevronDown } from 'lucide-react';

// The listings for a business query, ON the map — the owner's reference was
// Google Maps' bottom sheet ("O'Reilly's near me": each store with Directions
// and Call). Same pack as the search page's card and chat (LocalPackService);
// here Directions stays inside Truegle — it opens the map's own route panel —
// and tapping a name flies the map to that store and opens its card.
//
// Phone: a sheet along the bottom of the map. Desktop: a panel down the left.
// Collapsible to its header either way, so it never has to be closed to be
// out of the way.

const SHOWN = 4;
const miles = (m) => (m == null ? null : m < 305 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);
const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
const chip = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors';

export default function MapListings({ listings, onDirections, onFocus }) {
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  if (!listings?.places?.length) return null;
  const places = all ? listings.places : listings.places.slice(0, SHOWN);
  const more = listings.places.length - SHOWN;

  return (
    <section
      aria-label={`${listings.label} — listings`}
      className="absolute z-[45] bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-2xl text-white rounded-2xl flex flex-col
                 left-2 right-[70px] bottom-2 max-h-[45%]
                 sm:right-auto sm:left-3 sm:top-32 sm:bottom-auto sm:w-80 sm:max-h-[calc(100%-10rem)]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2.5 text-left shrink-0"
      >
        <MapPin size={15} className="text-cyan-300 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold truncate">{listings.label}</span>
          {listings.where && <span className="block text-[11px] text-white/50 truncate">{listings.where}</span>}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold shrink-0">{listings.places.length}</span>
        <ChevronDown size={16} className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="overflow-y-auto border-t border-white/10">
          <ol className="divide-y divide-white/15">
            {places.map((p, i) => (
              <li key={`${p.name}|${p.address}`} className="px-3 py-2.5">
                <button type="button" onClick={() => onFocus?.(p)} className="w-full text-left flex items-start gap-2 group">
                  <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold leading-tight group-hover:text-cyan-200">{p.name}</span>
                    <span className="block text-[11px] text-white/55 truncate">
                      {[p.category, miles(p.distanceMeters)].filter(Boolean).join(' · ')}
                    </span>
                    {p.address && <span className="block text-[11px] text-white/70 truncate">{p.address}</span>}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5 mt-1.5 pl-7">
                  {p.phone && (
                    <a href={telHref(p.phone)} className={`${chip} bg-cyan-500 text-black hover:bg-cyan-400`} aria-label={`Call ${p.name}`}>
                      <Phone size={11} aria-hidden="true" /> Call
                    </a>
                  )}
                  {Number.isFinite(p.lat) && (
                    <button type="button" onClick={() => onDirections?.(p)} className={`${chip} border border-white/20 text-white/85 hover:bg-white/10`}>
                      <Navigation size={11} aria-hidden="true" /> Directions
                    </button>
                  )}
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className={`${chip} border border-white/20 text-white/85 hover:bg-white/10`}>
                      <Globe size={11} aria-hidden="true" /> Website
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {more > 0 && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              aria-expanded={all}
              className="w-full flex items-center justify-center gap-1 py-2 border-t border-white/15 text-[11px] font-semibold text-white/75 hover:bg-white/5"
            >
              {all ? 'Fewer locations' : `More locations (${more})`}
              <ChevronDown size={13} className={`transition-transform ${all ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
