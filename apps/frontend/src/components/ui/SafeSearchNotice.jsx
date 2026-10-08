import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';

// "Safe search on. For 18+ search click here" — brief, once per search, gone
// on its own. Signed in (so an adult who agreed to the terms): straight to the
// Safe Search setting. Signed out: the sign-in page, which opens on the 18+
// agreement (AgeGate.jsx).
const SHOW_MS = 9000;

export default function SafeSearchNotice({ show, signedIn, searchKey }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!show) { setOpen(false); return undefined; }
    setOpen(true);
    const t = setTimeout(() => setOpen(false), SHOW_MS);
    return () => clearTimeout(t);
  }, [show, searchKey]);
  if (!open) return null;
  return (
    <div
      role="status"
      data-safesearch-notice=""
      className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[70] flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-full bg-gray-950/95 border border-amber-400/40 shadow-2xl text-sm text-white max-w-[calc(100vw-32px)]"
    >
      <ShieldCheck size={16} className="text-amber-300 shrink-0" />
      <span>
        Safe search on. For 18+ search{' '}
        <Link
          to={signedIn ? '/settings#safe-search' : '/auth/login'}
          data-safesearch-notice-link=""
          className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200"
        >
          click here
        </Link>
      </span>
      <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10">
        <X size={14} />
      </button>
    </div>
  );
}
