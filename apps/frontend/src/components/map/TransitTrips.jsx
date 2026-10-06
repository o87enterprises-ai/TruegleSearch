// Public transit trips in the Directions panel.
//
// Owner, 2026-10-06: "add a local public transit option to the truegle maps
// directions." The trips come from Transitous (via our backend — see
// apps/backend/services/TransitService.js). Each trip is a row you can pick;
// the picked one is drawn on the map and spelled out leg by leg underneath, in
// the words a rider needs: which line, which way, from which stop, until when.

const MODE_ICON = {
  WALK: '🚶', BUS: '🚌', TRAM: '🚊', SUBWAY: '🚇', METRO: '🚇', RAIL: '🚆', REGIONAL_RAIL: '🚆',
  HIGHSPEED_RAIL: '🚄', LONG_DISTANCE: '🚆', NIGHT_RAIL: '🚆', COACH: '🚌', FERRY: '⛴️',
  AIRPLANE: '✈️', FUNICULAR: '🚞', AERIAL_LIFT: '🚡', CABLE_CAR: '🚡', BIKE: '🚲', CAR: '🚗', OTHER: '🚐',
};
const MODE_WORD = {
  WALK: 'Walk', BUS: 'Bus', TRAM: 'Tram', SUBWAY: 'Subway', METRO: 'Metro', RAIL: 'Train',
  REGIONAL_RAIL: 'Train', HIGHSPEED_RAIL: 'Train', LONG_DISTANCE: 'Train', NIGHT_RAIL: 'Night train',
  COACH: 'Coach', FERRY: 'Ferry', FUNICULAR: 'Funicular', AERIAL_LIFT: 'Aerial lift', CABLE_CAR: 'Cable car',
};

export const legIcon = (mode) => MODE_ICON[mode] || MODE_ICON.OTHER;
const word = (mode) => MODE_WORD[mode] || 'Transit';

export function clock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function mins(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const m = Math.max(1, Math.round(seconds / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/** The whole trip as one line for the map, in order. */
export function tripGeometry(trip) {
  const coords = [];
  for (const leg of trip?.legs || []) {
    for (const pt of leg.geometry || []) {
      const last = coords[coords.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) coords.push(pt);
    }
  }
  return coords;
}

function LegChips({ trip }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {trip.legs.map((leg, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-white/25 text-[10px]">›</span>}
          {leg.transit ? (
            <span
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: leg.color || '#2563eb' }}
            >
              {legIcon(leg.mode)} {leg.route || word(leg.mode)}
            </span>
          ) : (
            <span className="text-[11px] text-white/60">{legIcon(leg.mode)} {mins(leg.duration)}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function TransitTrips({ trips, picked, onPick }) {
  if (!trips?.length) return null;
  const trip = trips[picked] || trips[0];
  return (
    <div className="space-y-3" data-transit-trips="">
      <div className="space-y-2">
        {trips.map((t, i) => (
          <button
            key={i}
            type="button"
            data-transit-trip={i}
            aria-pressed={i === picked}
            onClick={() => onPick(i)}
            className={`w-full text-left rounded-lg p-3 border transition-colors ${
              i === picked
                ? 'bg-blue-500/15 border-blue-400/60'
                : 'bg-neutral-800/40 border-neutral-700/50 hover:border-neutral-500'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-sm font-semibold text-white">{clock(t.startTime)} – {clock(t.endTime)}</span>
              <span className="text-xs text-white/70">{mins(t.duration)}</span>
            </div>
            <LegChips trip={t} />
            <p className="mt-1 text-[10px] text-white/45">
              {t.transfers === 0 ? 'No transfers' : `${t.transfers} transfer${t.transfers > 1 ? 's' : ''}`}
            </p>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Step by step</h3>
        <ol className="space-y-2" data-transit-steps="">
          {trip.legs.map((leg, i) => (
            <li key={i} className="flex gap-3 p-3 bg-neutral-800/30 rounded-lg">
              <span className="text-lg leading-none">{legIcon(leg.mode)}</span>
              <div className="min-w-0 text-sm text-white">
                {leg.transit ? (
                  <>
                    <p>
                      <span className="font-semibold">{word(leg.mode)} {leg.route}</span>
                      {leg.headsign && <span className="text-white/70"> toward {leg.headsign}</span>}
                    </p>
                    <p className="text-xs text-white/60">
                      {clock(leg.from.time)} from {leg.from.name || 'the stop'} → {leg.to.name || 'the stop'} at {clock(leg.to.time)}
                      {Number.isFinite(leg.stops) && leg.stops > 0 ? ` · ${leg.stops} stop${leg.stops > 1 ? 's' : ''}` : ''}
                    </p>
                    {leg.agency && <p className="text-[10px] text-white/35">{leg.agency}</p>}
                  </>
                ) : (
                  <p>
                    Walk {mins(leg.duration)}
                    {leg.to.name ? <span className="text-white/70"> to {leg.to.name}</span> : <span className="text-white/70"> to your destination</span>}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-[10px] text-white/35">
        Timetables from the local transit agencies via{' '}
        <a href="https://transitous.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">Transitous</a>.
        Check the agency for delays.
      </p>
    </div>
  );
}
