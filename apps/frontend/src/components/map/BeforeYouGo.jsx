import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CameraView from './CameraView';
import { X, Car, AlertTriangle, CloudSun, Camera, Navigation, Loader2 } from 'lucide-react';

// "Before you go": what a trip to one place looks like right now — drive time
// with live traffic, incidents at the destination, the weather there, the
// nearest public cameras, and one tap to Uber or Lyft. Data from
// POST /api/maps/before-you-go (see BeforeYouGoService on the backend).
//
// No ride prices: there is no free, lawful source for live fares, and a
// number we guessed would be the kind this site does not print. The buttons
// open the apps, which show their own.

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const clock = (iso) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return null; }
};
const distance = (m) => (m < 305 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

export const uberLink = (p) => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${p.lat}&dropoff[longitude]=${p.lng}&dropoff[nickname]=${encodeURIComponent(p.name || 'Destination')}`;
export const lyftLink = (p) => `https://lyft.com/ride?id=lyft&destination[latitude]=${p.lat}&destination[longitude]=${p.lng}`;

function Section({ icon: Icon, title, children }) {
  return (
    <section className="py-3 border-t border-white/10 first:border-t-0">
      <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
        <Icon size={13} aria-hidden="true" /> {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * @param {{ place: {name,lat,lng,address?}, from: {lat,lng}|null, onClose, onDirections }} props
 */
export default function BeforeYouGo({ place, from, onClose, onDirections }) {
  const [brief, setBrief] = useState(null);
  // A tapped camera opens INSIDE the card: a separate viewer layered over a
  // phone's bottom sheet fought it for the screen and for Escape.
  const [camera, setCamera] = useState(null);
  const cardRef = useRef(null);

  // Desktop: the card hangs off the map, which may sit low on the page —
  // bring the whole card into view rather than open it half below the fold.
  // (A phone's sheet is fixed to the screen, so this is a no-op there.)
  useEffect(() => { cardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [place.lat, place.lng, brief]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setBrief(null);
    setFailed(false);
    fetch(`${BACKEND}/api/maps/before-you-go`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: { lat: place.lat, lng: place.lng }, from: from ? { lat: from.lat, lng: from.lng } : undefined }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setBrief)
      .catch((e) => { if (e.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [place.lat, place.lng, from?.lat, from?.lng]);

  useEffect(() => {
    // Capture phase + stopPropagation: Escape closes this card (or the
    // camera inside it) and nothing else — not the map behind it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (camera) setCamera(null); else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, camera]);

  const missing = (part) => brief?.unavailable?.includes(part);

  // A PHONE'S SHEET RENDERS AT PAGE LEVEL. Inside the map it was capped by
  // the map's own stacking layer, so the page's floating feedback button sat
  // on top of its Lyft button whatever z-index it had. In native fullscreen
  // only the fullscreen element is drawn, so it goes there instead.
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const card = (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Before you go to ${place.name}`}
      // Phone: a sheet pinned to the SCREEN's bottom (fixed) — pinned to the
      // map's bottom it opened below the fold whenever the map sat lower on
      // the page. Top layer on a phone: it is a sheet, and the chat bubble and
      // feedback bar must not sit on its buttons. Desktop: a card on the
      // map's right edge, in the map's own layer.
      className="truegle-byg fixed z-[10000] bg-neutral-900 sm:bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-2xl text-white
                 left-0 right-0 bottom-0 max-h-[75vh] rounded-t-2xl
                 sm:absolute sm:z-[60] sm:left-auto sm:right-4 sm:top-20 sm:bottom-auto sm:w-80 sm:max-h-[calc(100%-6rem)] sm:rounded-2xl
                 flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-start gap-2 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold">Before you go</p>
          <h3 className="text-base font-semibold leading-tight truncate">{place.name}</h3>
          {place.address && <p className="text-xs text-white/50 truncate">{place.address}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-white/10 text-white/70">
          <X size={16} />
        </button>
      </header>

      <div className="overflow-y-auto px-4 pb-2">
        {failed && <p className="py-4 text-sm text-red-300">Couldn&apos;t load this right now. Try again in a moment.</p>}
        {!brief && !failed && (
          <p className="py-6 flex items-center justify-center gap-2 text-sm text-white/60">
            <Loader2 size={16} className="animate-spin" /> Checking the trip…
          </p>
        )}

        {brief && (
          <>
            <Section icon={Car} title="Drive now">
              {brief.drive ? (
                <>
                  <p className="text-lg font-semibold">
                    {brief.drive.minutes} min <span className="text-sm font-normal text-white/60">· {brief.drive.miles} mi</span>
                  </p>
                  <p className="text-xs text-white/65">
                    {brief.drive.trafficDelayMinutes > 0
                      ? <span className="text-amber-300">Includes {brief.drive.trafficDelayMinutes} min of traffic delay</span>
                      : 'No traffic delay right now'}
                    {brief.drive.arrival && clock(brief.drive.arrival) ? ` · arrive about ${clock(brief.drive.arrival)}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/60">
                  {missing('drive') ? 'Drive time is unavailable right now.' : 'Turn on your location to see the drive time from where you are.'}
                </p>
              )}
            </Section>

            <Section icon={AlertTriangle} title="At the destination">
              {brief.incidents == null ? (
                <p className="text-sm text-white/60">Incident reports are unavailable right now.</p>
              ) : brief.incidents.count === 0 ? (
                <p className="text-sm text-emerald-300">No reported incidents within about 3 km.</p>
              ) : (
                <>
                  <p className="text-sm text-amber-300">{brief.incidents.count} reported incident{brief.incidents.count > 1 ? 's' : ''} nearby</p>
                  <ul className="mt-1 space-y-0.5">
                    {brief.incidents.top.map((i, k) => (
                      <li key={k} className="text-xs text-white/70">
                        {i.kind}{i.road ? ` · ${i.road}` : ''}{i.from ? ` · ${i.from}${i.to ? ` → ${i.to}` : ''}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            <Section icon={CloudSun} title="Weather there">
              {brief.weather ? (
                <p className="text-sm">
                  <span className="text-lg font-semibold">{brief.weather.tempF}°F</span>
                  <span className="text-white/70"> · {brief.weather.summary} · wind {brief.weather.windMph} mph</span>
                  {brief.weather.precipitationIn > 0 && <span className="text-sky-300"> · {brief.weather.precipitationIn} in precipitation</span>}
                </p>
              ) : <p className="text-sm text-white/60">Weather is unavailable right now.</p>}
            </Section>

            {brief.cameras?.length > 0 && (
              <Section icon={Camera} title="Nearest cameras">
                {camera && (
                  <div className="mb-2">
                    <CameraView camera={camera} className="w-full rounded-lg object-contain bg-black" />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] text-white/60 truncate">{camera.name}</p>
                      <button type="button" onClick={() => setCamera(null)} className="text-[11px] text-cyan-300 hover:text-cyan-200 shrink-0 ml-2">Close camera</button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {brief.cameras.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCamera({ name: c.name, imageUrl: c.imageUrl })}
                      className={`shrink-0 w-28 text-left rounded-lg overflow-hidden border hover:border-cyan-400/60 ${camera?.imageUrl === c.imageUrl ? 'border-cyan-400' : 'border-white/10'}`}
                      title={c.name}
                    >
                      <img src={c.imageUrl} alt="" loading="lazy" className="w-full h-16 object-cover bg-black/40" referrerPolicy="no-referrer" />
                      <p className="px-1.5 py-1 text-[10px] text-white/70 truncate">{distance(c.meters)} · {c.name}</p>
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      <footer className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-white/10">
        <button
          type="button"
          onClick={onDirections}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-cyan-500 text-black text-xs font-semibold py-2 hover:bg-cyan-400"
        >
          <Navigation size={13} aria-hidden="true" /> Directions
        </button>
        <a
          href={uberLink(place)}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens Uber with this destination — Uber shows the price"
          className="inline-flex items-center justify-center rounded-full bg-white text-black text-xs font-semibold py-2 hover:bg-white/85"
        >
          Uber
        </a>
        <a
          href={lyftLink(place)}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens Lyft with this destination — Lyft shows the price"
          className="inline-flex items-center justify-center rounded-full bg-[#FF00BF] text-white text-xs font-semibold py-2 hover:opacity-90"
        >
          Lyft
        </a>
      </footer>
    </div>
  );

  if (isPhone && typeof document !== 'undefined') {
    return createPortal(card, document.fullscreenElement || document.body);
  }
  return card;
}
