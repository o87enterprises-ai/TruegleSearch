import { useEffect, useState } from 'react';
import { Copy, Search, UserRound } from 'lucide-react';
import { ensureHandle, getHandle, changeHandle, checkAvailable, setSearchable, isSearchable, lookupHandle, searchHandles } from './identity';
import { cleanHandle } from './seal';

// "Your name on Truegle Nearby": an anonymous handle made on this device, a way to change it to
// any free screen name, an opt-in switch to be found by prefix search, and a box to find others.
// It is tied to two public keys — not your account, email or phone.
export default function HandleCard() {
  const [handle, setHandle] = useState(getHandle());
  const [edit, setEdit] = useState('');
  const [status, setStatus] = useState('');
  const [searchable, setSearch] = useState(isSearchable());
  const [find, setFind] = useState('');
  const [found, setFound] = useState(null); // { exact: handle|null, more: [handle] }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!handle) ensureHandle().then((h) => live && setHandle(h)).catch((e) => live && setStatus(e?.message || 'Could not create a handle.'));
    return () => { live = false; };
  }, [handle]);

  // Live availability while typing a new name.
  useEffect(() => {
    const h = cleanHandle(edit);
    if (!edit || h === handle) { setStatus(''); return undefined; }
    const t = setTimeout(async () => {
      try {
        const r = await checkAvailable(h);
        setStatus(!r.valid ? 'Use 3-24 letters, numbers and single hyphens, starting with a letter.' : r.available ? `“${h}” is free.` : `“${h}” is taken.`);
      } catch { setStatus('Could not check right now.'); }
    }, 350);
    return () => clearTimeout(t);
  }, [edit, handle]);

  const copy = (v) => { try { navigator.clipboard?.writeText(v); setStatus('Copied.'); } catch { /* ignore */ } };
  const save = async () => {
    setBusy(true);
    try { const h = await changeHandle(edit); setHandle(h); setEdit(''); setStatus(`You are now ${h}.`); }
    catch (e) { setStatus(e?.message || 'Could not change your name.'); }
    finally { setBusy(false); }
  };
  const toggle = async () => {
    const next = !searchable;
    try { await setSearchable(next); setSearch(next); setStatus(next ? 'People can now find you by typing the start of your name.' : 'You can only be found by your exact name.'); }
    catch (e) { setStatus(e?.message || 'Could not change that.'); }
  };
  const lookup = async (ev) => {
    ev.preventDefault();
    const q = cleanHandle(find);
    if (!q) return;
    setBusy(true);
    try {
      const exact = await lookupHandle(q);
      const more = (await searchHandles(q)).filter((h) => h !== exact?.handle);
      setFound({ exact: exact?.handle || null, more, q });
    } catch { setFound({ exact: null, more: [], q }); }
    finally { setBusy(false); }
  };

  return (
    <section aria-label="Your handle" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3" data-handle-card="">
      <div className="flex items-center gap-2 text-sm text-white/80"><UserRound size={14} /> Your name</div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-orange-200 break-all">{handle || '…'}</span>
        {handle && (
          <button type="button" onClick={() => copy(handle)} title="Copy your name" aria-label="Copy your name"
            className="flex items-center justify-center w-7 h-7 rounded text-white/50 hover:text-white hover:bg-white/10"><Copy size={13} /></button>
        )}
      </div>
      <p className="text-[11px] text-white/45">Made on this device. It isn’t linked to your account, email or phone — share it so friends can find you.</p>

      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input value={edit} onChange={(e) => setEdit(e.target.value)} placeholder="Pick your own name" maxLength={30} aria-label="New name"
          className="min-w-0 flex-1 h-8 px-2 rounded-md bg-white/5 border border-white/15 text-xs text-white outline-none focus:border-white/40" />
        <button type="submit" disabled={busy || !edit || cleanHandle(edit) === handle}
          className="h-8 px-3 rounded-md border border-white/20 text-[11px] uppercase tracking-wider text-white/70 enabled:hover:bg-white/10 disabled:opacity-30">Use</button>
      </form>

      <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
        <input type="checkbox" checked={searchable} onChange={toggle} className="accent-orange-400" />
        Let people find me by typing the start of my name
      </label>

      <form className="flex items-center gap-2 pt-1 border-t border-white/10" onSubmit={lookup}>
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find someone by name" maxLength={30} aria-label="Find someone"
          className="min-w-0 flex-1 h-8 px-2 rounded-md bg-white/5 border border-white/15 text-xs text-white outline-none focus:border-white/40" />
        <button type="submit" disabled={busy || !find} aria-label="Search"
          className="flex items-center justify-center w-8 h-8 rounded-md border border-white/20 text-white/70 enabled:hover:bg-white/10 disabled:opacity-30"><Search size={13} /></button>
      </form>

      {found && (
        <ul className="text-xs space-y-1" data-handle-results="">
          {found.exact && <li className="text-emerald-300 font-mono">{found.exact} <span className="text-white/40 font-sans">· exact match</span></li>}
          {found.more.map((h) => <li key={h} className="text-white/70 font-mono">{h}</li>)}
          {!found.exact && found.more.length === 0 && <li className="text-white/45">No one called “{found.q}”. Names must be typed exactly unless the person chose to be searchable.</li>}
        </ul>
      )}
      {status && <p className="text-[11px] text-cyan-200/80" role="status">{status}</p>}
    </section>
  );
}
