import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// The small satellite map beside the local results — numbered pins that match
// the numbered cards. Loaded lazily (see LocalPackCard) so Leaflet only
// downloads when a local card actually shows. Satellite is the default here;
// the full Truegle Maps work (layers, directions) is its own item.
const pin = (n, active) => L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? '#22d3ee' : '#ef4444'};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font:700 11px system-ui">${n}</span></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

export default function LocalPackMap({ places, center, activeIndex, onPick }) {
  const pts = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const bounds = pts.length > 1 ? L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.25) : null;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      bounds={bounds || undefined}
      scrollWheelZoom={false}
      attributionControl={false}
      className="w-full h-full"
      style={{ background: '#0b1220' }}
    >
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
      {places.map((p, i) => (Number.isFinite(p.lat) && Number.isFinite(p.lng) ? (
        <Marker
          key={p.name}
          position={[p.lat, p.lng]}
          icon={pin(i + 1, i === activeIndex)}
          eventHandlers={{ click: () => onPick?.(i) }}
          title={p.name}
        />
      ) : null))}
    </MapContainer>
  );
}
