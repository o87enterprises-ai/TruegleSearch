import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  readProfile, readMoveLink, applyProfile, extractShare, intentLink, isNativeApp,
} from '../../utils/profileShare';

// Mounted once, so a Truegle share link works NO MATTER WHERE it shows up:
//   • opened as a link (…/#move=… or …/#profile=…),
//   • pasted into any box, anywhere in the app,
//   • sent to the Android app from another app (https or truegle:// link),
//   • handed over by a page (e.g. the "You pasted a link" card) via openShare().
// It always asks before importing, then clears the code from the address bar.
// Nothing leaves the device except fetching the encrypted short-link blob.
export default function ProfileImport() {
  const [data, setData] = useState(null);
  const [done, setDone] = useState(null);
  const [moveId, setMoveId] = useState(null);
  const [problem, setProblem] = useState('');
  const [frag, setFrag] = useState(null);
  const busy = useRef(null);

  const handle = useCallback(async (text) => {
    const fragment = extractShare(text);
    if (!fragment || busy.current === fragment) return;
    busy.current = fragment;
    setFrag(fragment);
    try {
      if (fragment.startsWith('#move=')) {
        const r = await readMoveLink(fragment);
        setMoveId(r.id); setData(r.data);
      } else {
        setData(await readProfile(fragment));
      }
    } catch (e) {
      setData(null);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setProblem(fragment.startsWith('#move=')
        ? (offline
          ? 'This short link needs an internet connection to open. Connect, or ask for the full code instead (Settings → Move to another device → Copy code).'
          : 'This link has expired or was already used. Make a new one on your other device.')
        : 'That code could not be read. Make a new one on your other device.');
      if (e?.response?.status >= 500) setProblem('Truegle could not be reached right now. Try again in a moment.');
    }
  }, []);

  useEffect(() => {
    const fromHash = () => handle(window.location.hash);
    fromHash();
    window.addEventListener('hashchange', fromHash);
    const onEvent = (e) => handle(e.detail);
    window.addEventListener('truegle:share-link', onEvent);
    // Paste anywhere (search box, chat, a list name…): if it holds a share link, offer to import it.
    const onPaste = (e) => {
      if (e.target?.closest?.('[data-move-lists]')) return; // the Import box on Settings has its own button
      const t = e.clipboardData?.getData('text') || '';
      if (extractShare(t)) handle(t);
    };
    document.addEventListener('paste', onPaste, true);
    // Android app: links sent from other apps (https://truegle.info/#… or truegle://…).
    let off;
    const link = window.Capacitor?.Plugins?.TruegleLink;
    if (link) {
      (async () => {
        try {
          // `await`, not .then: on a native plugin addListener hands back a handle, not always a Promise.
          off = await link.addListener('link', (e) => {
            const url = String(e?.url || '');
            if (extractShare(url)) handle(url);
            else {
              try { const u = new URL(url); if (u.pathname !== '/' && /truegle\.info$/.test(u.host)) window.location.assign(u.pathname + u.search + u.hash); } catch { /* ignore */ }
            }
          });
          const r = await link.getLaunchUrl?.();
          if (r?.url) handle(r.url);
        } catch { /* link handling is optional: never take the app down for it */ }
      })();
    }
    return () => {
      window.removeEventListener('hashchange', fromHash);
      window.removeEventListener('truegle:share-link', onEvent);
      document.removeEventListener('paste', onPaste, true);
      off?.remove?.();
    };
  }, [handle]);

  const clear = () => {
    busy.current = null;
    setFrag(null);
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  const finish = () => { setMoveId(null); }; // links stay valid: they can be reused
  if (!data && done === null && !problem) return null;

  const onAndroidWeb = !isNativeApp() && /Android/i.test(navigator.userAgent || '');

  return createPortal(
    <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0e14] p-5 text-white">
        {problem ? (
          <>
            <h2 className="text-base font-bold">Link not available</h2>
            <p className="text-sm text-white/60 mt-2">{problem}</p>
            <button type="button" className="mt-4 w-full rounded-lg bg-white py-2 text-sm font-semibold text-black"
              onClick={() => { setProblem(''); clear(); }}>OK</button>
          </>
        ) : done === null ? (
          <>
            <h2 className="text-base font-bold">Bring these lists to this device?</h2>
            <p className="text-sm text-white/60 mt-2">
              {data.lists.length} saved {data.lists.length === 1 ? 'list' : 'lists'}
              {data.guide ? ' and your unlocked survival guide' : ''}. Stored on this device only.
            </p>
            <div className="flex gap-2 mt-4">
              <button type="button" className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-black"
                onClick={() => { setDone(applyProfile(data)); setData(null); clear(); finish(); }}>Import</button>
              <button type="button" className="flex-1 rounded-lg border border-white/20 py-2 text-sm"
                onClick={() => { setData(null); clear(); }}>Not now</button>
            </div>
            {onAndroidWeb && frag && (
              <a href={intentLink(frag)} className="mt-3 block rounded-lg border border-cyan-400/40 py-2 text-center text-sm text-cyan-200 hover:bg-cyan-400/10">
                Open in the Truegle app instead
              </a>
            )}
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
