import { useState } from 'react';
import { Link2, Loader2, Check, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPlayable } from '../../utils/videoEmbed';
import { titleFromUrl } from '../../utils/playerLink';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// "Add a link" — the way something the web index doesn't carry becomes
// playable, and findable, for everyone.
//
// Two things happen on submit, and the difference matters:
//   • It goes into YOUR queue immediately, from the link alone. That part
//     needs no account and no network.
//   • It is SHARED — added to the searchable set every visitor can find — and
//     that part is signed-in only. A submission is playable by everybody, so
//     it is attributable to somebody; anonymous writes to a store the whole
//     site plays from is an open door.
//
// Nothing is uploaded. Truegle stores the link; the media plays from its
// original platform, so the creator keeps their views.
export default function AddLinkRow({ accent = '#f43f5e', onQueued, compact = false }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | shared | queued
  const [error, setError] = useState('');

  const reset = () => { setUrl(''); setTitle(''); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) return;

    // Classify on the client first: the same rule the server enforces, but the
    // user finds out before a round trip that a link can't play here.
    const playable = getPlayable(raw);
    if (!playable) {
      setError("Truegle's player can't host that link — YouTube, Vimeo, TikTok, SoundCloud and direct audio/video files all work.");
      return;
    }

    const source = { ...playable, title: title.trim() || titleFromUrl(raw), pageUrl: raw };
    onQueued?.(source);          // yours to play right now, account or not

    if (!isAuthenticated) {
      setState('queued');
      return;                    // queued for you; sharing needs an account
    }

    setState('saving');
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: raw, title: title.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That link could not be shared.');
      setState('shared');
      reset();
      setTimeout(() => { setState('idle'); setOpen(false); }, 2200);
    } catch (err) {
      setState('idle');
      setError(err.message);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-2 px-3 ${compact ? 'py-2' : 'py-2.5'} border-t border-white/10
                    text-[11px] text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors`}
      >
        <Link2 size={12} />
        Add a link
        <span className="ml-auto text-white/25">plays for everyone</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="border-t border-white/10 bg-black/30 px-3 py-2.5 space-y-2">
      <input
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError(''); }}
        placeholder="Paste a link — YouTube, Vimeo, TikTok, SoundCloud, mp3/mp4…"
        aria-label="Link to playable media"
        autoFocus
        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white
                   placeholder-white/30 focus:outline-none focus:border-white/30"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional) — what people will search for"
        aria-label="Title for this link"
        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white
                   placeholder-white/30 focus:outline-none focus:border-white/30"
      />

      {error && <p className="text-[11px] text-amber-300/90 leading-snug">{error}</p>}

      {state === 'shared' && (
        <p className="flex items-center gap-1.5 text-[11px] text-green-300">
          <Check size={12} /> Added — anyone can find and play this now.
        </p>
      )}

      {state === 'queued' && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
          <p className="text-[11px] text-white/60 leading-snug">
            It&apos;s in your queue. Sign in to share it, and it becomes searchable
            and playable for everyone else too.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold text-black"
            style={{ background: accent }}
          >
            <LogIn size={13} /> Sign in to share it
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={state === 'saving' || !url.trim()}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold text-black disabled:opacity-40"
          style={{ background: accent }}
        >
          {state === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          {isAuthenticated ? 'Add and share' : 'Add to my queue'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); setState('idle'); }}
          className="px-3 h-8 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
