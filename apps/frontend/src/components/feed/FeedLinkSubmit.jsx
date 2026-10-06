import { useState } from 'react';
import { Loader2, Check, Send, AlertCircle, Play } from 'lucide-react';
import api from '../../services/api';
import { usePastedLink } from '../../hooks/usePastedLink';
import { usePlayInPlayer } from '../../hooks/usePlayInPlayer';

// Paste a playable link into the feed's search box and it can become a post.
//
// WHY IT LIVES IN THE SEARCH BAR RATHER THAN BEHIND AN "ADD" BUTTON: pasting a
// link into a search box is already what people do with a link they want to do
// something with. A separate compose affordance would be a second thing to
// find, and the feed is not a place anyone expects to find a form. So the bar
// notices what was pasted and offers the obvious next step, and goes back to
// being a search box the moment the text stops being a link.
//
// NOTHING IS UPLOADED. The link is classified and stored; the media plays from
// its original platform's embed, so the creator keeps their views. See
// migration 018.
//
// ANONYMOUS IS THE DEFAULT AND IT IS CONSTRAINED. No account is needed for a
// platform link, and the server takes no text from the submitter at all — the
// title comes from the platform's own oEmbed. Direct file links (.mp4/.mp3)
// still require an account, because unattributed arbitrary media on someone
// else's server is the one case with no platform moderating it and nobody to
// hold responsible. See migration 023 for the whole reasoning.

export default function FeedLinkSubmit({ url, onPosted }) {
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');
  const [posted, setPosted] = useState(null);
  const playInPlayer = usePlayInPlayer();

  // Share links (vm.tiktok.com/…) are followed to the video first.
  const { playable, resolving, failed } = usePastedLink(url);
  if (resolving) {
    return (
      <div data-feed-submit="resolving" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-yellow-500/25 text-xs text-white/70">
        <Loader2 size={14} className="animate-spin text-yellow-300" /> Finding the video behind that link…
      </div>
    );
  }
  if (failed) {
    return (
      <div data-feed-submit="unresolved" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-yellow-500/25 text-xs text-white/70">
        <AlertCircle size={14} className="text-amber-300" /> That share link didn’t lead to a video Truegle can play.
      </div>
    );
  }
  // Not a link, or not one the player can host: this component is simply not
  // here, and the bar is a search bar again.
  if (!playable) return null;

  // JUST PLAY IT. A pasted link used to offer only "Post" — sharing it with
  // everyone — when what you usually want is to watch it (owner, 2026-10-06:
  // "I can't figure out how to search a TikTok link to test on feed").
  const playNowClick = () => {
    playInPlayer({ ...playable, title: playable.title || `${playable.kind} link` });
  };

  const send = async () => {
    setState('sending');
    setMessage('');
    try {
      const { data } = await api.post('/media', { url: url.trim() });
      setPosted(data?.media || null);
      setState('done');
      // Bring the feed back from the top so the new row is actually visible.
      // Posting into a list that does not change is indistinguishable from
      // posting into nothing.
      if (onPosted) onPosted(data?.media || null);
    } catch (err) {
      setState('error');
      // The server's own sentence. It distinguishes "sign in for THIS kind of
      // link" from "no platform recognises this", and those need different
      // things from the person reading them — one is a different link, the
      // other is an account.
      setMessage(err?.response?.data?.error || 'That link could not be posted.');
    }
  };

  if (state === 'done') {
    return (
      <div
        data-feed-submit="done"
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-200"
      >
        <Check size={14} className="shrink-0" />
        <span className="truncate">
          Posted to the feed{posted?.title ? ` · ${posted.title}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      data-feed-submit={state}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-yellow-500/25"
    >
      {/* A dot in the feed's own colour, not the wordmark: TruegleLogo has no
          small square variant (default/chat/tube are all wide), and the wide
          mark squeezed to 16px is a smear. The Truegle mark belongs on the
          posted CARD, where it says who hosts the post — here it would just be
          branding on a form. */}
      <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/80 truncate">
          {state === 'error' ? message : `${playable.kind} link — play it, or post it to the feed`}
        </p>
        {state !== 'error' && (
          // Said before the button is pressed, not after. Anonymous is the
          // default here and somebody should know that before they act, not
          // discover it afterwards.
          <p className="text-[11px] text-white/40">
            Posted anonymously. It plays from {playable.kind} — nothing is uploaded.
          </p>
        )}
      </div>
      <button
        type="button"
        data-feed-play-link
        onClick={playNowClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400 text-neutral-900 text-xs font-semibold hover:bg-yellow-300 transition-colors shrink-0"
      >
        <Play size={13} /> Play
      </button>
      <button
        type="button"
        data-feed-submit-go
        onClick={send}
        disabled={state === 'sending'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-xs font-medium hover:bg-yellow-500/30 disabled:opacity-50 transition-colors shrink-0"
      >
        {state === 'sending'
          ? <Loader2 size={13} className="animate-spin" />
          : state === 'error'
            ? <AlertCircle size={13} />
            : <Send size={13} />}
        {state === 'sending' ? 'Posting' : state === 'error' ? 'Retry' : 'Post'}
      </button>
    </div>
  );
}
