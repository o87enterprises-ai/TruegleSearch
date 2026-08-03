import { useState } from 'react';
import { Loader2, Check, Plus, X } from 'lucide-react';

// "Add a reel" — the submission half of the aggregated feed.
//
// TikTok, Instagram Reels and Facebook Reels have no free search API, so
// Truegle cannot go and find them: discovery there is gated behind Meta/TikTok
// app review. Anyone can paste a reel link here instead, and it joins the feed
// for everyone.
//
// Nothing is uploaded. We keep the link; the clip plays from the platform's
// own embed, so the original creator keeps their views. The backend re-checks
// the URL and rejects anything that isn't a genuine Short/Reel/TikTok — the
// client-side hint below is only there to save a round trip.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function AddReelForm({ onClose, onAdded }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setState({ status: 'saving', message: '' });
    try {
      const res = await fetch(`${BACKEND}/api/reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ status: 'error', message: body.error || 'That reel could not be added.' });
        return;
      }
      setState({ status: 'done', message: `Added — ${body.reel?.platform}` });
      setUrl('');
      setTitle('');
      onAdded?.();
      setTimeout(() => setState({ status: 'idle', message: '' }), 2500);
    } catch {
      setState({ status: 'error', message: 'Could not reach Truegle just now.' });
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md mb-3 rounded-xl border border-white/12 bg-black/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Plus size={14} className="text-cyan-300" />
        <span className="text-xs text-white/80 font-medium">Add a reel to the feed</span>
        <button type="button" onClick={onClose} aria-label="Close add-a-reel"
          className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <X size={13} />
        </button>
      </div>

      <input
        value={url}
        onChange={(e) => { setUrl(e.target.value); setState({ status: 'idle', message: '' }); }}
        placeholder="Paste a YouTube Short, TikTok, Instagram or Facebook Reel link"
        inputMode="url"
        aria-label="Reel link"
        className="w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/60"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        aria-label="Reel title"
        className="mt-1.5 w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/60"
      />

      <button
        type="submit"
        disabled={state.status === 'saving' || !url.trim()}
        className="mt-2 w-full flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
      >
        {state.status === 'saving' ? <Loader2 size={14} className="animate-spin" />
          : state.status === 'done' ? <Check size={14} className="text-green-400" />
            : <Plus size={14} />}
        {state.status === 'saving' ? 'Adding…' : state.status === 'done' ? state.message : 'Add to the reels feed'}
      </button>

      {state.status === 'error' && (
        <p className="mt-1.5 text-[10px] text-amber-300/90 leading-tight">{state.message}</p>
      )}
      <p className="mt-1.5 text-[10px] text-white/35 leading-tight">
        Only the link is stored — the clip plays from the original platform, so the creator keeps their views.
      </p>
    </form>
  );
}
