import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Phone, Globe, Navigation, Share2, MapPin, Clock, Star, Check,
} from 'lucide-react';
import { copyText } from '../../utils/clipboard';

/**
 * The local panel: what someone asking about a PLACE actually wants.
 *
 * "dentist near me" and "Rossi's hours" don't want a sentence, they want a
 * phone number and a Directions button. The quick-answer card was answering
 * them in prose, which is the right shape for "how tall is the Eiffel Tower"
 * and the wrong shape for anything you might drive to.
 *
 * Two rules this card follows that are easy to break:
 *
 *   NOTHING IS INVENTED. Every row renders only if the backend actually
 *   returned that field. There is deliberately no photo strip: no provider we
 *   use returns photos OF THIS BUSINESS, and a stock photo of "a restaurant"
 *   beside a named restaurant is a picture of somewhere else. An empty row is
 *   honest; a plausible wrong one is not.
 *
 *   THE ACTIONS ARE REAL LINKS. tel:, a maps URL, the business's own site —
 *   `href`s, not click handlers, so they long-press, open in a new tab and
 *   work with a screen reader the way every other link does.
 */
const fmtPhone = (p) => {
  const d = String(p).replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
};

const fmtDistance = (m) => (m == null ? null : (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`));

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export default function BusinessPanelCard({ panel, className = '', onDirections }) {
  const [shared, setShared] = useState(false);
  if (!panel?.name) return null;

  const {
    name, address, category, phone, website, hours, isOpen,
    rating, reviewCount, priceRange, lat, lng, distanceMeters,
  } = panel;

  // Hand the coordinates to whatever maps app the device prefers rather than
  // hard-coding one vendor. A place with no coordinates gets a name search,
  // which still lands somewhere useful.
  // OpenStreetMap, not Google — sending a visitor's destination to Google
  // Maps was the one tracker link left in this card.
  const directions = lat != null && lng != null
    ? `https://www.openstreetmap.org/directions?route=%3B${lat}%2C${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

  const share = async () => {
    const text = [name, address, phone].filter(Boolean).join(' · ');
    if (navigator.share) {
      try { await navigator.share({ title: name, text }); return; } catch { /* dismissed */ }
    }
    if (await copyText(`${text}\n${directions}`)) {
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    }
  };

  const action = 'flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white transition-colors';

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={`Local result for ${name}`}
      className={`rounded-2xl bg-gradient-to-br from-emerald-500/[0.10] to-cyan-500/[0.06] backdrop-blur-xl border border-emerald-400/25 p-5 shadow-lg shadow-emerald-500/10 ${className}`}
    >
      <h2 className="text-xl font-semibold text-white leading-tight">{name}</h2>

      {/* The identity line: rating, category, price, distance — whichever of
          them exist. Built as a list and separated BETWEEN items, so a missing
          field never leaves a dangling dot. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/60">
        {[
          rating != null && (
            <span key="rating" className="inline-flex items-center gap-1 text-amber-300">
              <Star size={13} fill="currentColor" strokeWidth={0} />
              <span className="tabular-nums font-medium">{rating.toFixed(1)}</span>
              {reviewCount > 0 && <span className="text-white/45">({reviewCount.toLocaleString()})</span>}
            </span>
          ),
          category && <span key="cat">{category}</span>,
          priceRange && <span key="price">{priceRange}</span>,
          distanceMeters != null && <span key="dist">{fmtDistance(distanceMeters)}</span>,
        ].filter(Boolean).flatMap((el, i) => (
          i === 0 ? [el] : [<span key={`sep${i}`} className="text-white/25">·</span>, el]
        ))}
      </div>

      {/* Open / closed is the single most useful fact on the card, so it gets
          its own line and a colour. Only rendered when we actually know — an
          unknown state shown as "Closed" would send someone home. */}
      {isOpen !== null && isOpen !== undefined && (
        <p className={`mt-2 text-sm font-semibold ${isOpen ? 'text-emerald-300' : 'text-rose-300'}`}>
          {isOpen ? 'Open now' : 'Closed now'}
          {hours && <span className="font-normal text-white/50"> · {hours}</span>}
        </p>
      )}
      {(isOpen === null || isOpen === undefined) && hours && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-white/60">
          <Clock size={14} className="mt-0.5 shrink-0" />
          <span>{hours}</span>
        </p>
      )}

      {/* Actions. The row people came for. */}
      <div className="mt-4 flex items-stretch gap-2">
        {phone && (
          <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className={action}>
            <Phone size={16} />
            <span className="text-[11px] font-medium">Call</span>
          </a>
        )}
        {directions && (
          onDirections ? (
            <button type="button" onClick={() => onDirections({ name, lat, lng })} className={action}>
              <Navigation size={16} />
              <span className="text-[11px] font-medium">Directions</span>
            </button>
          ) : (
            <a href={directions} target="_blank" rel="noopener noreferrer" className={action}>
              <Navigation size={16} />
              <span className="text-[11px] font-medium">Directions</span>
            </a>
          )
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className={action}>
            <Globe size={16} />
            <span className="text-[11px] font-medium">Website</span>
          </a>
        )}
        <button type="button" onClick={share} className={action}>
          {shared ? <Check size={16} className="text-emerald-300" /> : <Share2 size={16} />}
          <span className="text-[11px] font-medium">{shared ? 'Copied' : 'Share'}</span>
        </button>
      </div>

      {/* Details, below the fold of the card. Each row is its own link where
          being a link is useful — an address you can tap through to a map, a
          phone number you can tap to dial. */}
      <dl className="mt-4 space-y-2 text-sm border-t border-white/10 pt-3">
        {address && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Address</dt>
            <MapPin size={14} className="mt-0.5 shrink-0 text-white/40" />
            <dd>
              <a href={directions} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
                {address}
              </a>
            </dd>
          </div>
        )}
        {phone && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Phone</dt>
            <Phone size={14} className="mt-0.5 shrink-0 text-white/40" />
            <dd>
              <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="text-white/70 hover:text-white transition-colors tabular-nums">
                {fmtPhone(phone)}
              </a>
            </dd>
          </div>
        )}
        {website && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Website</dt>
            <Globe size={14} className="mt-0.5 shrink-0 text-white/40" />
            <dd className="min-w-0">
              <a href={website} target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-emerald-100 transition-colors truncate block">
                {host(website)}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-3 text-[10px] text-white/35">
        Local listing from public map data — hours and numbers can be out of date.
      </p>
    </motion.section>
  );
}
