// react-map-gl 8.1 predates maplibre-gl 6. v6 moved the camera transform off the
// Map (it now lives at map._camera.transform) and made transformCameraUpdate a
// setter method, so react-map-gl read `map.transform` -> undefined -> the whole
// page crashed on "Show Map". This subclass puts both back; remove it once
// react-map-gl ships v6 support.
import * as maplibre from 'maplibre-gl';
// maplibre 6 starts its tile worker from ./maplibre-gl-worker.mjs "next to the
// module". Once Vite bundles the library that file does not exist, so every
// worker died with "Worker failed to load" and the map stayed a blank panel
// (no tiles are ever fetched without it). `?worker&url` has Vite build the
// worker (with its shared chunk) as its own asset and hand back its URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibre.setWorkerUrl(workerUrl);

class CompatMap extends maplibre.Map {
  get transform() {
    return this._camera?.transform;
  }

  set transformCameraUpdate(fn) {
    this.setTransformCameraUpdate?.(fn);
  }
}

export const mapLib = { ...maplibre, Map: CompatMap };
