import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

// Live intelligence layers for the map — aircraft, satellites, earthquakes,
// fires, vessels, weather events, public cameras, conflict reports.
//
// Served by /api/osiris (see backend services/OsirisService.js), never fetched
// from the browser directly: a direct fetch would hand the upstream every
// visitor's IP and, through the bounding box, a record of where they were
// looking. Everything here therefore goes through Truegle's own origin.
//
// ── WHAT THIS HOOK IS CAREFUL ABOUT ─────────────────────────────────────────
//
// A live layer on a map is a request generator. Panning fires a viewport
// change on every animation frame, and a naive "fetch on viewport change"
// turns one drag into a hundred requests, most of them for a view nobody ever
// saw. So:
//
//   · nothing is fetched for a layer that is switched OFF — the cost of a
//     layer is zero until it is asked for;
//   · viewport changes are debounced, so a drag costs one request at the end
//     rather than one per frame;
//   · a layer refreshes on its own interval only while it is on and the tab is
//     visible — a backgrounded tab polling aircraft positions forever is a
//     battery bug that nobody sees on a desktop;
//   · a request in flight is abandoned when a newer one supersedes it, so a
//     slow reply cannot overwrite fresher data that arrived first.
//
// ── FAILURE IS VISIBLE ──────────────────────────────────────────────────────
//
// A layer that cannot load reports an error the map can SHOW. It must never
// resolve to an empty FeatureCollection: an empty layer draws as "there are no
// aircraft here", which is indistinguishable from "the aircraft feed broke"
// and is the exact failure the backend goes out of its way to report instead
// of swallowing.

/** Long enough that a drag settles, short enough to feel immediate. */
const PAN_DEBOUNCE_MS = 400;

/** How often a switched-on layer re-asks. The server caches per layer at its
 *  own TTL, so a shorter interval here costs a cheap 304-ish round trip rather
 *  than an upstream call — but there is no point going below the slowest thing
 *  we are drawing. */
const REFRESH_MS = 60_000;

const emptyState = () => ({ features: [], loading: false, error: '', meta: null });

export function useOsirisLayers() {
  // The catalogue is served rather than hardcoded, so a layer added on the
  // backend appears in the switcher without a frontend change.
  const [catalogue, setCatalogue] = useState([]);
  const [active, setActive] = useState(() => new Set());
  const [layers, setLayers] = useState({});   // id -> { features, loading, error, meta }
  const [bbox, setBbox] = useState(null);

  const inflight = useRef(new Map());  // id -> AbortController
  const panTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/osiris/layers')
      .then(({ data }) => { if (!cancelled) setCatalogue(data.layers || []); })
      // A catalogue that will not load means no switcher. That is a quiet,
      // complete absence of the feature rather than a broken-looking map, and
      // it is the one case where staying silent is right: nothing was ever
      // switched on, so nothing is missing from the view.
      .catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async (id, box) => {
    // Supersede rather than race. Without this a slow reply for a viewport the
    // user already left can land after a fast one for where they are now, and
    // the map shows the wrong place's data with no way to tell.
    inflight.current.get(id)?.abort();
    const controller = new AbortController();
    inflight.current.set(id, controller);

    setLayers((prev) => ({ ...prev, [id]: { ...(prev[id] || emptyState()), loading: true, error: '' } }));
    try {
      const { data } = await api.get(`/osiris/${id}`, {
        params: box ? { bbox: box.join(',') } : undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setLayers((prev) => ({
        ...prev,
        [id]: { features: data.features || [], loading: false, error: '', meta: data.meta || null },
      }));
    } catch (err) {
      if (controller.signal.aborted || err.name === 'CanceledError') return;
      // The server's own sentence, when it wrote one — it distinguishes "this
      // feed changed shape" from "this feed is unreachable", and those need
      // different reactions from whoever reads it.
      const message = err?.response?.data?.message || 'This layer could not be loaded.';
      setLayers((prev) => ({ ...prev, [id]: { features: [], loading: false, error: message, meta: null } }));
    } finally {
      if (inflight.current.get(id) === controller) inflight.current.delete(id);
    }
  }, []);

  const toggle = useCallback((id) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Switching a layer off drops its features immediately rather than
        // leaving them to be garbage collected on the next render — a hidden
        // layer holding 2000 features is memory nobody can see or reclaim.
        inflight.current.get(id)?.abort();
        setLayers((l) => { const copy = { ...l }; delete copy[id]; return copy; });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Fetch when a layer is switched on, and re-fetch the ones already on when
  // the viewport settles somewhere new.
  useEffect(() => {
    for (const id of active) {
      if (!layers[id]) load(id, bbox);
    }
    // `layers` is deliberately absent from the deps: it is written by `load`,
    // so including it would re-run this effect on every response and refetch
    // forever. The guard above reads it only to answer "has this one been
    // asked for yet", which is exactly what the write settles.
  }, [active, bbox, load]);

  // Periodic refresh, only while something is on and the tab is being looked
  // at. A hidden tab refreshing aircraft positions every minute is a battery
  // cost with no viewer.
  useEffect(() => {
    if (!active.size) return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      for (const id of active) load(id, bbox);
    };
    const timer = setInterval(tick, REFRESH_MS);
    // Coming back to a tab that has been away should not wait out the rest of
    // the interval to show current data.
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, bbox, load]);

  /** Called by the map on viewport change — as often as it likes. */
  const setViewport = useCallback((bounds) => {
    if (!bounds) return;
    clearTimeout(panTimer.current);
    panTimer.current = setTimeout(() => {
      setBbox((prev) => {
        const next = bounds.map((n) => Math.round(n * 100) / 100);
        // Rounding to ~1km and comparing means a jitter of a few pixels does
        // not count as a new viewport, which is most of what a "pan" actually
        // is once a finger is involved.
        return prev && prev.every((v, i) => v === next[i]) ? prev : next;
      });
    }, PAN_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => {
    clearTimeout(panTimer.current);
    for (const controller of inflight.current.values()) controller.abort();
  }, []);

  return { catalogue, active, layers, toggle, setViewport };
}

export default useOsirisLayers;
