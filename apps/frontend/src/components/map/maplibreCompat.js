// react-map-gl 8.1 predates maplibre-gl 6. v6 moved the camera transform off the
// Map (it now lives at map._camera.transform) and made transformCameraUpdate a
// setter method, so react-map-gl read `map.transform` -> undefined -> the whole
// page crashed on "Show Map". This subclass puts both back; remove it once
// react-map-gl ships v6 support.
import * as maplibre from 'maplibre-gl';

class CompatMap extends maplibre.Map {
  get transform() {
    return this._camera?.transform;
  }

  set transformCameraUpdate(fn) {
    this.setTransformCameraUpdate?.(fn);
  }
}

export const mapLib = { ...maplibre, Map: CompatMap };
