import { useEffect, useReducer, useState } from 'react';
import { Radio } from 'lucide-react';
import { startRelay, stopRelay, relayEnabled, setRelayEnabled, relayStats, onRelayChange } from './relay';
import { ensureHandle } from './identity';

// Lets this phone carry other people's messages onward over Bluetooth. They are end-to-end
// encrypted, so this phone cannot read them. Android app only, and only while Nearby is on and the
// app is open (background relaying is not part of this version).
export default function RelayCard({ nearbyOn }) {
  const [on, setOn] = useState(relayEnabled());
  const [err, setErr] = useState('');
  const [, bump] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (!(on && nearbyOn)) { stopRelay(); return undefined; }
    let live = true;
    ensureHandle().catch(() => {}).finally(() => { if (live) startRelay().catch((e) => setErr(e?.message || 'Could not start relaying.')); });
    const un = onRelayChange(bump);
    const t = setInterval(bump, 5000);
    return () => { live = false; un(); clearInterval(t); stopRelay(); };
  }, [on, nearbyOn]);

  const toggle = () => { const v = !on; setRelayEnabled(v); setOn(v); setErr(''); };
  const s = relayStats();

  return (
    <section aria-label="Relay" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2" data-relay-card="">
      <div className="flex items-center gap-2 text-sm text-white/80"><Radio size={14} /> Help messages travel</div>
      <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
        <input type="checkbox" checked={on} onChange={toggle} className="accent-orange-400" />
        Carry other people’s encrypted messages through this phone
      </label>
      <p className="text-[11px] text-white/45">
        Messages are scrambled end to end, so this phone can pass them on but can’t read them. They’re kept for up to 24 hours and handed to
        other Truegle phones that come into range. Works while Nearby is on and the app is open. Only phones running Truegle can relay —
        other Bluetooth devices (headphones, speakers, watches) can’t.
      </p>
      {on && (
        <p className="text-[11px] text-cyan-200/80" role="status">
          {nearbyOn ? `${s.peers} phone${s.peers === 1 ? '' : 's'} in range · carrying ${s.carrying} message${s.carrying === 1 ? '' : 's'}` : 'Turn Nearby on to start relaying.'}
        </p>
      )}
      {err && <p className="text-[11px] text-red-300" role="alert">{err}</p>}
    </section>
  );
}
