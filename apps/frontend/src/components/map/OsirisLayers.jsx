import { Source, Layer, Popup } from 'react-map-gl/maplibre';
import { Loader2, X, AlertTriangle } from 'lucide-react';

// Live intelligence layers, drawn on whichever map is mounted.
//
// Deliberately generic: nothing here knows what an aircraft is. Every layer is
// a GeoJSON point collection with a colour and a label, both decided by the
// backend's LAYERS table (services/OsirisService.js), so adding a feed is a
// change on the server and this file follows without being touched. The
// alternative — a component per feed — is how the search page reached 2600
// lines and five dead forks.
//
// Split into three exports rather than one component because they render in
// three different places: the sources go INSIDE the map, the switcher sits in
// the toolbar above it, and the popup is anchored to a clicked feature.

/** Layer ids are namespaced so `interactiveLayerIds` can select ours without
 *  claiming the host map's own route lines and markers. */
export const OSIRIS_LAYER_PREFIX = 'osiris-';

export const osirisLayerIds = (active) => [...active].map((id) => `${OSIRIS_LAYER_PREFIX}${id}`);

/** Is this click on one of ours? The map's own click handler asks before
 *  treating the click as "empty space, clear the selection". */
export const isOsirisFeature = (feature) =>
  typeof feature?.layer?.id === 'string' && feature.layer.id.startsWith(OSIRIS_LAYER_PREFIX);

/** The GeoJSON sources. Mount inside <BaseMap>. */
export function OsirisSources({ layers }) {
  return (
    <>
      {Object.entries(layers).map(([id, state]) => {
        if (!state?.features?.length) return null;
        const colour = state.meta?.colour || '#38bdf8';
        return (
          <Source
            key={id}
            id={`${OSIRIS_LAYER_PREFIX}src-${id}`}
            type="geojson"
            data={{ type: 'FeatureCollection', features: state.features }}
          >
            <Layer
              id={`${OSIRIS_LAYER_PREFIX}${id}`}
              type="circle"
              paint={{
                // Interpolated by zoom so a continent-wide view is not a solid
                // block of colour and a street-level one is still clickable.
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 6, 4, 12, 7],
                'circle-color': colour,
                'circle-opacity': 0.85,
                'circle-stroke-width': 1,
                // A dark halo, not a white one: these sit over satellite
                // imagery as often as over the street style, and white
                // disappears into cloud.
                'circle-stroke-color': 'rgba(0,0,0,0.55)',
              }}
            />
          </Source>
        );
      })}
    </>
  );
}

/** Toolbar toggles. Styled to match the map's existing buttons rather than
 *  introducing a second visual language for the same kind of control. */
export function OsirisLayerSwitcher({ catalogue, active, layers, onToggle, labelClass = '' }) {
  if (!catalogue.length) return null;
  return (
    <>
      {catalogue.map((layer) => {
        const on = active.has(layer.id);
        const state = layers[layer.id];
        return (
          <button
            key={layer.id}
            type="button"
            onClick={() => onToggle(layer.id)}
            data-osiris-toggle={layer.id}
            aria-pressed={on}
            title={state?.error || `${layer.label} — live`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              on ? 'text-white shadow-lg' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
            // The layer's OWN colour when on, so the button and the dots it
            // put on the map are visibly the same thing.
            style={on ? { background: layer.colour, boxShadow: `0 4px 14px ${layer.colour}55` } : undefined}
          >
            {state?.loading
              ? <Loader2 size={14} className="animate-spin" />
              : state?.error
                // A layer that failed says so on its own button. Switched on
                // and simply blank is the one outcome that must not happen:
                // it reads as "nothing here", which is a claim about the
                // world rather than about us.
                ? <AlertTriangle size={14} />
                : <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? 'rgba(0,0,0,0.45)' : layer.colour }} />}
            <span className={labelClass}>{layer.label}</span>
            {on && state?.meta?.returned != null && (
              <span className="tabular-nums opacity-75">{state.meta.returned}</span>
            )}
            {/* STALE IS SAID, NOT IMPLIED. The upstream is slow enough that the
                server serves last-known positions while it refreshes behind
                the request. An aircraft position from four minutes ago is
                useful; the same position presented as live is a small lie, and
                this is a map people might make decisions from. */}
            {on && state?.meta?.stale && (
              <span className="opacity-70" title={`Last updated ${state.meta.ageSeconds}s ago`}>
                ·{Math.round((state.meta.ageSeconds || 0) / 60) || '<1'}m
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

/**
 * The clicked feature, in full.
 *
 * THIS IS THE INVESTIGATION SURFACE. Every scalar the upstream published is
 * listed — callsign, registration, altitude, magnitude, depth, vessel MMSI,
 * whatever the feed carries — because the point of an OSINT layer is the
 * fields, not the dot. Summarising to a title and a subtitle would throw away
 * the only thing that makes it investigable, and a feed's useful field is
 * routinely the obscure one.
 */
export function OsirisFeaturePopup({ feature, onClose }) {
  if (!feature) return null;
  const props = feature.properties || {};
  const [lon, lat] = feature.geometry?.coordinates || [];
  if (lon == null || lat == null) return null;

  // `_label` and `_layer` are ours, added by the normaliser — shown as the
  // heading rather than repeated in the field list.
  const fields = Object.entries(props)
    .filter(([k]) => !k.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Popup
      longitude={lon}
      latitude={lat}
      anchor="bottom"
      closeButton={false}
      onClose={onClose}
      maxWidth="320px"
      className="osiris-popup"
    >
      <div data-osiris-popup className="relative min-w-[220px] max-w-[300px] text-xs">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-1 -right-1 p-1 rounded text-neutral-400 hover:text-white"
        >
          <X size={13} />
        </button>
        <p className="font-semibold text-white pr-5 leading-snug">{props._label || 'Feature'}</p>
        <p className="text-neutral-400 mb-2">{props._layer}</p>

        <dl className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
          {fields.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-neutral-500 shrink-0">{k}</dt>
              <dd className="text-neutral-200 break-all text-right ml-auto">{String(v)}</dd>
            </div>
          ))}
          {!fields.length && <p className="text-neutral-500">No further detail published.</p>}
        </dl>

        {/* The coordinates, always — they are what makes the row pivotable
            into any other tool, and half the feeds do not repeat them in
            their own fields. */}
        <p className="mt-2 pt-2 border-t border-white/10 text-neutral-400 tabular-nums">
          {lat.toFixed(4)}, {lon.toFixed(4)}
        </p>
      </div>
    </Popup>
  );
}

export default OsirisSources;
