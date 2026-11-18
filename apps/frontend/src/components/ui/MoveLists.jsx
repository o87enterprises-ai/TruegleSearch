import { useState } from 'react';
import { exportProfile, profileLink, readProfile, applyProfile } from '../../utils/profileShare';

// Settings → "Move to another device". A share link or code that carries the saved lists
// (and guide unlock) to another device; the code never touches a server.
export default function MoveLists() {
  const [code, setCode] = useState('');
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');

  const copy = async (kind) => {
    try {
      const c = code || await exportProfile();
      setCode(c);
      await navigator.clipboard.writeText(kind === 'link' ? profileLink(c) : c);
      setMsg(kind === 'link' ? 'Link copied. Open it on your other device.' : 'Code copied. Paste it below on your other device.');
    } catch {
      setMsg('Could not copy — select the code below and copy it by hand.');
    }
  };

  const importIt = async () => {
    try {
      const n = applyProfile(await readProfile(paste));
      setMsg(`${n} ${n === 1 ? 'list' : 'lists'} imported.`);
      setPaste('');
    } catch {
      setMsg('That doesn’t look like a Truegle code. Paste the whole link or code.');
    }
  };

  return (
    <div data-move-lists="" className="mb-6 p-6 rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border border-cyan-500/20 shadow-xl">
      <h2 className="text-lg font-semibold mb-1">Move to another device</h2>
      <p className="text-sm text-white/60 mb-3">
        Your saved lists live on this device. Make a link or code, open it on your new device and they come with you.
        The code stays in the link after the “#”, so it is never sent to any server.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" onClick={() => copy('link')} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold">Copy share link</button>
        <button type="button" onClick={() => copy('code')} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold">Copy code</button>
      </div>
      {code && (
        <textarea readOnly value={code} rows={2} onFocus={(e) => e.target.select()}
          className="w-full mb-3 rounded-lg bg-black/40 border border-white/10 p-2 text-[11px] font-mono text-white/70" />
      )}
      <div className="flex gap-2">
        <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a link or code from your other device"
          className="flex-1 min-w-0 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm placeholder-white/30" />
        <button type="button" onClick={importIt} disabled={!paste.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-semibold">Import</button>
      </div>
      {msg && <p className="mt-3 text-sm text-cyan-200">{msg}</p>}
    </div>
  );
}
