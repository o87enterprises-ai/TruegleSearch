import { useEffect, useState } from 'react';
import { LocateFixed, Radio } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

// THE STATIONS TUNER: live radio by country and region, or near you (owner,
// 2026-10-17). Real stations' own internet streams from the Radio Browser
// directory, via our backend (routes/stations.js), which lists only streams a
// browser will play on an https page. A station plays in the ONE player like
// anything else — it is just a live <audio> source.
//
// "Near me" asks the browser for a location only when pressed. The backend
// rounds it to ~11km before it goes anywhere, and nothing here stores it.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const PREFS = 'truegle_stations_v1';

const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p && /^[A-Z]{2}$/.test(p.country)) return { country: p.country, region: p.region || '' };
  } catch { /* fall through */ }
  // A first visit starts in the browser's own country ("en-GB" → GB).
  const cc = (typeof navigator !== 'undefined' && (navigator.language || '').split('-')[1]) || 'US';
  return { country: /^[A-Z]{2}$/i.test(cc) ? cc.toUpperCase() : 'US', region: '' };
}

export const stationSource = (s) => ({
  kind: 'audio',
  src: s.url,
  title: s.name,
  pageUrl: s.homepage || s.url,
  poster: s.favicon || undefined,
  channel: [s.region, s.country].filter(Boolean).join(', ') || 'Live radio',
  live: true,
});

export default function StationsPanel() {
  const { playNow, current } = usePlayer();
  const [prefs, setPrefs] = useState(readPrefs);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [near, setNear] = useState(null); // { lat, lng } while "Near me" is on
  const [nearState, setNearState] = useState('idle'); // idle | asking | denied
  const [list, setList] = useState(null); // null = loading

  useEffect(() => {
    try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* private mode */ }
  }, [prefs]);

  useEffect(() => {
    getJson(`${BACKEND}/api/stations/countries`).then((d) => setCountries(d?.countries || []));
  }, []);

  useEffect(() => {
    setRegions([]);
    getJson(`${BACKEND}/api/stations/regions?country=${prefs.country}`).then((d) => setRegions(d?.regions || []));
  }, [prefs.country]);

  useEffect(() => {
    let live = true;
    setList(null);
    const q = near
      ? `lat=${near.lat}&lng=${near.lng}&km=100`
      : `country=${prefs.country}${prefs.region ? `&region=${encodeURIComponent(prefs.region)}` : ''}`;
    getJson(`${BACKEND}/api/stations?${q}`).then((d) => { if (live) setList(d?.stations || []); });
    return () => { live = false; };
  }, [prefs.country, prefs.region, near]);

  const askNear = () => {
    if (near) { setNear(null); return; }
    if (!navigator.geolocation) { setNearState('denied'); return; }
    setNearState('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({ lat: pos.coords.latitude.toFixed(1), lng: pos.coords.longitude.toFixed(1) });
        setNearState('idle');
      },
      () => setNearState('denied'),
      { maximumAge: 10 * 60 * 1000, timeout: 10000 },
    );
  };

  const select = 'min-w-0 flex-1 rounded-lg bg-neutral-900/80 border border-neutral-700/50 px-2 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-cyan-500/50';

  return (
    <div className="mt-2 rounded-xl border border-cyan-500/20 bg-black/30 p-2.5" data-stations-panel="">
      <div className="flex flex-wrap items-center gap-1.5">
        <select aria-label="Country" className={select} disabled={!!near}
          value={prefs.country} onChange={(e) => setPrefs({ country: e.target.value, region: '' })}>
          {!countries.some((c) => c.code === prefs.country) && <option value={prefs.country}>{prefs.country}</option>}
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select aria-label="Region" className={select} disabled={!!near || regions.length === 0}
          value={prefs.region} onChange={(e) => setPrefs((p) => ({ ...p, region: e.target.value }))}>
          <option value="">All regions</option>
          {regions.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <button type="button" onClick={askNear} aria-pressed={!!near}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${near
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
            : 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400 hover:text-cyan-300 hover:border-cyan-500/30'}`}>
          <LocateFixed size={12} />
          {nearState === 'asking' ? 'Locating…' : 'Near me'}
        </button>
      </div>
      {nearState === 'denied' && (
        <p className="mt-1.5 text-[11px] text-white/45">Location isn’t available — pick a country and region instead.</p>
      )}

      <div className="mt-2 max-h-72 overflow-y-auto -mx-1 px-1" role="list">
        {list === null && <p className="py-3 text-center text-[12px] text-white/40">Tuning…</p>}
        {list && list.length === 0 && (
          <p className="py-3 text-center text-[12px] text-white/40">No playable stations here — try All regions or another country.</p>
        )}
        {list && list.map((s) => {
          const on = current?.src === s.url;
          return (
            <button key={s.id} type="button" role="listitem" onClick={() => playNow(stationSource(s))}
              data-station={s.id} aria-current={on || undefined}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${on ? 'bg-cyan-500/15' : 'hover:bg-white/5'}`}>
              <span className="shrink-0 w-7 h-7 rounded-md bg-neutral-800 flex items-center justify-center overflow-hidden">
                {s.favicon
                  ? <img src={s.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : <Radio size={14} className="text-white/40" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] font-medium ${on ? 'text-cyan-300' : 'text-white/85'}`}>{s.name}</span>
                <span className="block truncate text-[11px] text-white/45">
                  {[s.km != null ? `${s.km} km` : s.region, ...s.tags].filter(Boolean).join(' · ')}
                </span>
              </span>
              {s.bitrate ? <span className="shrink-0 text-[10px] text-white/35">{s.bitrate}k</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
