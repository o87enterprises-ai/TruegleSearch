import { useEffect, useReducer, useState } from 'react';
import { Bluetooth } from 'lucide-react';
import { webBleAvailable, connectPhone, disconnectPhone, phoneLink, onWebBleChange } from './webBle';

// For laptops and tablets using Truegle in a browser: link to a nearby phone that has the Truegle
// app (with Nearby and relaying on) so messages you send can travel onward over Bluetooth.
export default function WebPhoneCard() {
  const [, bump] = useReducer((n) => n + 1, 0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => onWebBleChange(bump), []);
  if (!webBleAvailable()) return null;
  const link = phoneLink();

  const connect = async () => {
    setBusy(true); setErr('');
    try { await connectPhone(); } catch (e) { if (e?.name !== 'NotFoundError') setErr(e?.message || 'Could not connect.'); } // NotFound = chooser closed
    finally { setBusy(false); }
  };

  return (
    <section aria-label="Phone link" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2" data-web-phone-card="">
      <div className="flex items-center gap-2 text-sm text-white/80"><Bluetooth size={14} /> Send through a nearby phone</div>
      <p className="text-[11px] text-white/45">
        A browser can’t relay messages itself, but it can hand them to a phone running the Truegle app that is nearby (Nearby and relaying turned
        on), and that phone carries them onward. You choose the phone in your browser’s Bluetooth window.
      </p>
      {link ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-300">Linked to {link.name}</span>
          <button type="button" onClick={disconnectPhone} className="px-2 h-6 rounded border border-white/20 text-[10px] uppercase tracking-wider text-white/60 hover:bg-white/10">Disconnect</button>
        </div>
      ) : (
        <button type="button" onClick={connect} disabled={busy}
          className="h-8 px-3 rounded-md border border-white/20 text-[11px] uppercase tracking-wider text-white/70 enabled:hover:bg-white/10 disabled:opacity-40">
          {busy ? 'Choosing…' : 'Choose a phone'}
        </button>
      )}
      {err && <p className="text-[11px] text-red-300" role="alert">{err}</p>}
    </section>
  );
}
