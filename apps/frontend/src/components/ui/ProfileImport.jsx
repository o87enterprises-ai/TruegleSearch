import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROFILE_HASH, readProfile, applyProfile } from '../../utils/profileShare';

// Mounted once. Opening a Truegle "move my lists" link (…/#profile=TG1.…) asks before
// importing, then clears the code from the address bar. Nothing leaves the device.
export default function ProfileImport() {
  const [data, setData] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const check = async () => {
      if (!window.location.hash.startsWith(PROFILE_HASH)) return;
      try { setData(await readProfile(window.location.hash)); } catch { setData(null); }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const clear = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  if (!data && done === null) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0e14] p-5 text-white">
        {done === null ? (
          <>
            <h2 className="text-base font-bold">Bring your lists to this device?</h2>
            <p className="text-sm text-white/60 mt-2">
              {data.lists.length} saved {data.lists.length === 1 ? 'list' : 'lists'}
              {data.guide ? ' and your unlocked survival guide' : ''}. Stored on this device only.
            </p>
            <div className="flex gap-2 mt-4">
              <button type="button" className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-black"
                onClick={() => { setDone(applyProfile(data)); setData(null); clear(); }}>Import</button>
              <button type="button" className="flex-1 rounded-lg border border-white/20 py-2 text-sm"
                onClick={() => { setData(null); clear(); }}>Not now</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold">Done</h2>
            <p className="text-sm text-white/60 mt-2">{done} {done === 1 ? 'list' : 'lists'} imported.</p>
            <button type="button" className="mt-4 w-full rounded-lg bg-white py-2 text-sm font-semibold text-black"
              onClick={() => setDone(null)}>OK</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
