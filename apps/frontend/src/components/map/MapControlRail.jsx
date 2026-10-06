import { Plus, Minus, LocateFixed, MapPin, Globe, Target, Layers, Palette, Navigation, Maximize2, Minimize2, PictureInPicture2, X } from 'lucide-react';

// ── EVERY MAP CONTROL, ONE PLACE, ALWAYS ON SCREEN ───────────────────────────
//
// Owner, 2026-10-06: "the different filter buttons going across the top of the
// screen in full screen are only visible in full screen and can't be touched
// unless full screen is activated. I want the buttons to go down the right
// side of the screen so that they will always be visible. They need to clearly
// display their current state on screen when clicked (currently I have no idea
// what each button does) and I want all of the buttons consolidated into one
// place, not randomly placed across the screen."
//
// So: one column on the right edge, in the docked map, the popped-out window
// and full screen alike. Every button carries its NAME and its STATE in words
// under the icon ("Globe · On", "Style · Satellite", "Layers · 3 on") — an
// icon that only lights up tells you something is on, not what. The column
// scrolls if the map is shorter than it.
//
// Replaces: the bottom function bar, the full-screen top bar (a second copy of
// the same buttons), the separate full-screen button, the renderer's zoom +
// compass, the "recentre" button, Reset View, and the camera / camera-search
// panels (cameras are a map layer now — see MapLayersSheet).

function RailButton({ id, icon, label, state, on = false, tone = 'cyan', onClick, disabled = false, title, dataState }) {
  const tones = {
    cyan: 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/70',
    blue: 'bg-blue-500/25 text-blue-100 ring-1 ring-blue-400/70',
    amber: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/60',
    green: 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/70',
    purple: 'bg-purple-500/25 text-purple-100 ring-1 ring-purple-400/70',
    red: 'text-red-300 hover:bg-red-600/80 hover:text-white',
  };
  return (
    <button
      type="button"
      data-map-control={id}
      data-location-state={dataState}
      aria-label={state ? `${label}: ${state}` : label}
      aria-pressed={on}
      title={title || (state ? `${label} — ${state}` : label)}
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 px-0.5 transition-colors
        ${disabled ? 'opacity-35 cursor-not-allowed' : ''}
        ${on ? tones[tone] : tone === 'red' ? tones.red : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
    >
      {icon}
      <span className="text-[9px] leading-none font-semibold tracking-tight">{label}</span>
      {state && <span data-control-state="" className={`text-[9px] leading-none ${on ? 'opacity-90' : 'opacity-55'}`}>{state}</span>}
    </button>
  );
}

const Divider = () => <div className="h-px w-8 mx-auto bg-white/10 my-0.5 shrink-0" />;

export default function MapControlRail({
  viewMode,                 // 'standard' | 'azimuthal_flat' | 'globe_3d'
  onZoom,                   // (dir) => void
  locationState, locationTitle, onLocate,
  onProjection,             // (mode) => void — Globe / Azimuthal; again = back to the street map
  basemapName, onCycleBasemap,
  layersOn, layersOpen, onLayers,
  directionsOpen, onDirections,
  fullscreen, onFullscreen,
  poppedOut, onTogglePopOut,
  onClose,
}) {
  const street = viewMode === 'standard';
  const loc = {
    lit: { state: 'Here', on: true },
    located: { state: 'Go back', on: false },
    blocked: { state: 'Blocked', on: false },
    unknown: { state: 'Find', on: false },
  }[locationState] || { state: 'Find', on: false };

  return (
    <nav
      data-map-rail=""
      aria-label="Map controls"
      className="absolute right-2 top-2 bottom-2 z-[46] w-[58px] flex flex-col gap-0.5 p-1 overflow-y-auto overscroll-contain
                 rounded-2xl border border-white/10 bg-neutral-900/90 backdrop-blur-xl shadow-2xl
                 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <RailButton id="zoom-in" icon={<Plus size={17} />} label="Zoom in" onClick={() => onZoom(1)} />
      <RailButton id="zoom-out" icon={<Minus size={17} />} label="Zoom out" onClick={() => onZoom(-1)} />
      <Divider />
      <RailButton
        id="locate"
        icon={locationState === 'unknown' ? <MapPin size={17} /> : <LocateFixed size={17} />}
        label="Me" state={loc.state} on={loc.on} tone={locationState === 'blocked' ? 'amber' : 'blue'}
        title={locationTitle}
        dataState={locationState}
        onClick={onLocate}
      />
      <Divider />
      <RailButton
        id="globe" icon={<Globe size={17} />} label="Globe"
        state={viewMode === 'globe_3d' ? 'On' : 'Off'} on={viewMode === 'globe_3d'}
        title={viewMode === 'globe_3d' ? 'Globe is on — press to go back to the street map, or zoom in' : 'Show the 3D globe (zoom in to come back to the street map)'}
        onClick={() => onProjection('globe_3d')}
      />
      <RailButton
        id="azimuthal" icon={<Target size={17} />} label="Azimuthal"
        state={viewMode === 'azimuthal_flat' ? 'On' : 'Off'} on={viewMode === 'azimuthal_flat'}
        title={viewMode === 'azimuthal_flat' ? 'Azimuthal is on — press to go back to the street map, or zoom in' : 'Show the azimuthal world map (zoom in to come back to the street map)'}
        onClick={() => onProjection('azimuthal_flat')}
      />
      <RailButton
        id="style" icon={<Palette size={17} />} label="Style"
        state={basemapName} on={street} tone="purple"
        disabled={!street}
        title={street ? `Map style: ${basemapName} — press for the next style` : 'Map styles apply to the street map'}
        onClick={onCycleBasemap}
      />
      <RailButton
        id="layers"
        icon={<span className="relative"><Layers size={17} />{layersOn > 0 && <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-cyan-400 text-[9px] leading-[14px] text-neutral-900 font-bold">{layersOn}</span>}</span>}
        label="Layers" state={layersOn ? `${layersOn} on` : 'Off'} on={layersOpen || layersOn > 0}
        title="Live layers: cameras, traffic, aircraft, weather and more"
        onClick={onLayers}
      />
      <RailButton
        id="directions" icon={<Navigation size={17} />} label="Route"
        state={directionsOpen ? 'Open' : 'Off'} on={directionsOpen} tone="green"
        title="Directions — drive, walk, bike or transit"
        onClick={onDirections}
      />
      <Divider />
      <RailButton
        id="fullscreen" icon={fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        label="Full" state={fullscreen ? 'On' : 'Off'} on={fullscreen}
        title={fullscreen ? 'Leave full screen' : 'Full screen'}
        onClick={onFullscreen}
      />
      {onTogglePopOut && (
        <RailButton
          id="popout" icon={poppedOut ? <Minimize2 size={17} /> : <PictureInPicture2 size={17} />}
          label={poppedOut ? 'Dock' : 'Pop out'} state={poppedOut ? 'Floating' : 'Docked'} on={poppedOut}
          title={poppedOut ? 'Put the map back in the page' : 'Pop the map out so you can keep browsing'}
          onClick={onTogglePopOut}
        />
      )}
      {onClose && (
        <RailButton id="close" icon={<X size={17} />} label="Close" tone="red" onClick={onClose} title="Close the map" />
      )}
    </nav>
  );
}
