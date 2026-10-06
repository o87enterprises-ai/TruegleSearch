import { X, Camera, TrafficCone, Eye, Loader2, AlertTriangle, LayoutGrid } from 'lucide-react';

// ── LIVE LAYERS, EACH ONE NAMED AND SWITCHABLE — OR ALL OF THEM AT ONCE ──────
//
// Owner, 2026-10-06: "add visible layers that can be toggled on and off one at
// a time and all together for the god's eye camera feed views", and the
// traffic-camera menu "removed and instead it become a map overlay".
//
// One row per layer: a colour swatch (the same colour it is drawn in), its
// name, what it shows, and a switch that SAYS On or Off. The top row is the
// god's-eye switch: every layer at once, and off again. Cameras are a layer
// like any other — camera icons on the map, hover for the live picture, tap
// to open it — plus "Watch all in view", a wall of every feed on screen.

function Switch({ on, label, onClick, colour = '#22d3ee', testId }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${on ? 'On' : 'Off'}`}
      data-layer-switch={testId}
      onClick={onClick}
      className="shrink-0 flex items-center gap-1.5"
    >
      <span className={`text-[10px] font-semibold w-6 text-right ${on ? 'text-white' : 'text-white/45'}`}>{on ? 'On' : 'Off'}</span>
      <span
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: on ? colour : 'rgba(255,255,255,0.15)' }}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Row({ swatch, icon, title, note, children }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 border-t border-white/5">
      <span className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center" style={{ background: `${swatch}33`, color: swatch }}>
        {icon || <span className="w-2.5 h-2.5 rounded-full" style={{ background: swatch }} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white truncate">{title}</p>
        {note && <p className="text-[10px] text-white/50 truncate">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export default function MapLayersSheet({
  catalogue, active, layers, onToggle,
  cameras, traffic,
  allOn, onAll,
  onClose,
}) {
  return (
    <section
      data-map-layers=""
      aria-label="Map layers"
      className="absolute right-[70px] top-2 z-[47] w-[min(18rem,calc(100%-82px))] max-h-[calc(100%-16px)] overflow-y-auto
                 rounded-2xl border border-white/10 bg-neutral-900/95 backdrop-blur-xl shadow-2xl text-white"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold">Layers</h3>
        <button type="button" onClick={onClose} aria-label="Close layers" className="p-1 rounded-lg hover:bg-white/10">
          <X size={15} />
        </button>
      </header>

      <Row swatch="#f8fafc" icon={<Eye size={14} />} title="God's eye — everything" note="Every layer below, at once">
        <Switch on={allOn} label="All layers" onClick={() => onAll(!allOn)} colour="#e2e8f0" testId="all" />
      </Row>

      <Row
        swatch="#f59e0b"
        icon={cameras.loading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        title="Cameras"
        note={cameras.on
          ? (cameras.needZoom ? 'Zoom in closer to see camera icons' : `${cameras.count} live camera${cameras.count === 1 ? '' : 's'} in view`)
          : 'Traffic & public cameras — hover or tap for the live view'}
      >
        <Switch on={cameras.on} label="Cameras" onClick={cameras.onToggle} colour="#f59e0b" testId="cameras" />
      </Row>
      {cameras.on && cameras.count > 0 && !cameras.needZoom && (
        <div className="px-3 pb-2">
          <button
            type="button"
            data-camera-wall-open=""
            onClick={cameras.onWall}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
          >
            <LayoutGrid size={13} /> Watch all in view ({Math.min(cameras.count, 12)})
          </button>
        </div>
      )}

      {traffic.available && (
        <Row swatch="#f97316" icon={<TrafficCone size={14} />} title="Traffic" note="Live congestion on roads">
          <Switch on={traffic.on} label="Traffic" onClick={traffic.onToggle} colour="#f97316" testId="traffic" />
        </Row>
      )}

      {catalogue.map((layer) => {
        const on = active.has(layer.id);
        const st = layers[layer.id];
        const note = st?.error
          ? st.error
          : on && st?.meta?.returned != null
            ? `${st.meta.returned} in view${st.meta.stale ? ` · ${Math.round((st.meta.ageSeconds || 0) / 60) || '<1'} min old` : ''}`
            : 'Live';
        return (
          <Row
            key={layer.id}
            swatch={layer.colour}
            icon={st?.loading ? <Loader2 size={14} className="animate-spin" /> : st?.error ? <AlertTriangle size={14} /> : null}
            title={layer.label}
            note={note}
          >
            <Switch on={on} label={layer.label} onClick={() => onToggle(layer.id)} colour={layer.colour} testId={layer.id} />
          </Row>
        );
      })}
    </section>
  );
}
