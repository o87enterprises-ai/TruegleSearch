import { Source, Layer, Popup } from 'react-map-gl/maplibre';
import { X } from 'lucide-react';

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

/* The toggles live in MapLayersSheet now — one row per layer, each saying
 * On or Off, with a god's-eye switch for all of them. */

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
        {/* `_group` is set for composite feeds — maritime returns ships, ports
            and chokepoints in one response, and which of the three a row is
            happens to be the most useful single fact about it. Shown beside
            the layer rather than buried in the field list. */}
        <p className="text-neutral-400 mb-2">
          {props._layer}{props._group ? ` · ${props._group}` : ''}
        </p>

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
