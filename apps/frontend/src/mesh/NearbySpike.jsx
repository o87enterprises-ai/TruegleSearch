import { useEffect, useRef, useState } from 'react';
import { meshStatus, meshStart, meshStop, meshSendText, meshOn } from './native';

// Phase-1 spike UI: opt-in switch, nearby peers with RSSI, and a raw text send/receive log.
// Used to prove two phones find each other and swap bytes over BLE. No encryption yet.
export default function NearbySpike() {
  const [st, setSt] = useState(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const [peers, setPeers] = useState({}); // fp -> { rssi, t }
  const [log, setLog] = useState([]);
  const [text, setText] = useState('hello');
  const t0 = useRef(0);

  const refresh = () => meshStatus().then((s) => { setSt(s); setOn(!!s.running); }).catch((e) => setErr(String(e?.message || e)));
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!on) return undefined;
    const offs = [];
    let dead = false;
    t0.current = Date.now();
    (async () => {
      const a = await meshOn('peer', (p) => {
        setPeers((prev) => {
          if (!prev[p.peer]) setLog((l) => [`found ${p.peer.slice(0, 8)} in ${((Date.now() - t0.current) / 1000).toFixed(1)}s`, ...l].slice(0, 30));
          return { ...prev, [p.peer]: { rssi: p.rssi, t: Date.now() } };
        });
      });
      const b = await meshOn('data', (d) => setLog((l) => [`← ${d.text}`, ...l].slice(0, 30)));
      const c = await meshOn('error', (e) => setErr(e.error));
      if (dead) { a(); b(); c(); } else offs.push(a, b, c);
    })();
    return () => { dead = true; offs.forEach((f) => f()); };
  }, [on]);

  const toggle = async () => {
    setErr('');
    try {
      if (on) { await meshStop(); setPeers({}); } else await meshStart();
      await refresh();
    } catch (e) { setErr(String(e?.message || e)); }
  };

  const send = async (fp) => {
    setErr('');
    try { await meshSendText(fp, text); setLog((l) => [`→ ${fp.slice(0, 8)}: ${text}`, ...l].slice(0, 30)); }
    catch (e) { setErr(String(e?.message || e)); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <p className="text-[12px] text-white/55">
        Nearby talks to other phones running Truegle over Bluetooth — no internet needed. It stays off until you turn it on.
        This is an early test: messages aren’t encrypted yet.
      </p>
      {st && !st.supported && <p className="text-xs text-amber-300">This device has no Bluetooth LE.</p>}
      {st && st.supported && !st.advertiseSupported && (
        <p className="text-xs text-amber-300">This phone can’t advertise over Bluetooth, so others won’t see it (it can still see them).</p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} disabled={!st?.supported}
          className={`rounded-full px-4 py-2 text-sm font-semibold border ${on ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200' : 'border-white/20 text-white hover:bg-white/10'}`}>
          {on ? 'Nearby is on — turn off' : 'Turn Nearby on'}
        </button>
        {st?.fingerprint && <span className="text-[11px] text-white/40">You: {st.fingerprint.slice(0, 8)}</span>}
      </div>
      {err && <p className="text-xs text-red-300" role="alert">{err}</p>}
      {on && (
        <>
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 120))}
            className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm" aria-label="Message to send" />
          <ul className="space-y-1.5">
            {Object.keys(peers).length === 0 && <li className="text-xs text-white/40">Looking for nearby phones…</li>}
            {Object.entries(peers).map(([fp, p]) => (
              <li key={fp} className="flex items-center justify-between text-sm">
                <span>{fp.slice(0, 8)} <span className="text-white/40 text-xs">· {p.rssi} dBm</span></span>
                <button type="button" onClick={() => send(fp)} className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10">Send</button>
              </li>
            ))}
          </ul>
          <ul className="text-[11px] text-white/55 space-y-0.5 font-mono">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
