import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSocialConnections } from '../hooks/useSocialConnections';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// The OAuth return leg, and nothing else.
//
// WHY THIS IS ITS OWN COMPONENT and not a branch inside FeedPage:
// App.jsx renders <Routes key={location.pathname}>, so every path change
// remounts the whole tree. When FeedPage served both paths, finishing the
// handshake and cleaning /feed/callback out of the URL remounted the page it
// had just filled — the feed was discarded and page one was fetched a second
// time on every single connect. Handing the callback its own component means
// FeedPage mounts once, on /feed, already connected.
//
// It is also the more honest shape: /feed/callback is a leg of a handshake,
// not somewhere anybody should end up sitting.
export default function FeedCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { connect } = useSocialConnections();
  // The code is one-use and the state is burned server-side on first use, so a
  // second run would fail against a handshake that already succeeded.
  const spent = useRef(false);

  useEffect(() => {
    if (spent.current) return;
    spent.current = true;

    const provider = params.get('provider');
    const code = params.get('code');
    const state = params.get('state');
    // Somebody who lands here by hand has nothing to exchange. Send them to the
    // page rather than showing an error for a mistake they did not make.
    if (!provider || !code || !state) { navigate('/feed', { replace: true }); return; }

    // Always `replace`: the callback URL carries a spent code, and leaving it
    // in history means Back replays it and fails.
    const done = (feedError) => navigate('/feed', { replace: true, state: feedError ? { feedError } : undefined });

    // Exchanged SERVER-side. The real version needs a client secret, and a
    // secret that reaches the browser is not a secret.
    fetch(`${BACKEND}/api/social-auth/${provider}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d.connection) { done(d?.error || 'That did not work. Try again.'); return; }
        connect(d.connection);
        done();
      })
      .catch(() => done('Could not reach Truegle to finish connecting.'));
    // Deliberately once, on mount: this consumes a one-use code.
  }, []);

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center gap-3">
      <Loader2 size={22} className="animate-spin text-white/50" />
      <p className="text-white/40 text-sm">Finishing up…</p>
    </div>
  );
}
