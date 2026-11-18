import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Gamepad2, Joystick, Map as MapIcon, ListMusic, WifiOff, ArrowLeft, X, Paperclip } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlaylists } from '../utils/playlists';
import { GUIDE_NAME, GUIDE_PATH } from '../utils/guideAccess';
import PlayerFiles from '../components/player/PlayerFiles';
import TruegleLogo from '../components/ui/TruegleLogo';

const TrailGame = lazy(() => import('../components/TrailGame'));
const GamesPanel = lazy(() => import('../components/games/GamesPanel'));
const MapViewWrapper = lazy(() => import('../components/map/MapViewWrapper'));

// /offline — everything that works with no connection, in one place. Also where the app
// lands automatically when the network drops (see App.jsx). Needs nothing from the backend:
// the guide and games run from cached code, the map from tiles already viewed, and the lists
// from this browser's own storage.
export default function OfflineHub() {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const lists = usePlaylists();
  const [view, setView] = useState(null); // null | trail | games | map | lists

  const Card = ({ icon: Icon, title, text, onClick, tone = 'text-cyan-300' }) => (
    <button type="button" onClick={onClick}
      className="text-left rounded-xl border border-white/10 bg-white/[0.04] hover:border-white/30 p-4 transition-colors">
      <Icon size={22} className={tone} />
      <div className="mt-2 text-sm font-semibold text-white">{title}</div>
      <div className="text-[12px] text-white/55 mt-0.5">{text}</div>
    </button>
  );

  const back = (
    <button type="button" onClick={() => setView(null)}
      className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white">
      <ArrowLeft size={14} /> Offline home
    </button>
  );
  const fallback = <div className="rounded-lg border border-white/10 aspect-[16/9]" />;

  return (
    <div className="min-h-screen bg-black text-white px-4 pt-16 pb-12">
      <div className="max-w-3xl mx-auto">
        {view && view !== 'map' ? back : null}

        {view === null && (
          <>
            {/* The Truegle mark, and the way back home. */}
            <Link to="/" aria-label="Truegle — home" className="flex justify-center mb-6">
              <TruegleLogo size="large" animated />
            </Link>
            <div className="flex items-center gap-2 mb-1">
              <WifiOff size={18} className={online ? 'text-white/30' : 'text-amber-300'} />
              <h1 className="text-lg font-bold">{online ? 'Works offline' : 'You’re offline'}</h1>
            </div>
            <p className="text-xs text-white/50 mb-5">
              Saved on this device only. Search, chat and live feeds need a connection; these don’t.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card icon={BookOpen} tone="text-emerald-300" title={GUIDE_NAME}
                text="The free survival guide — unlocked once, yours for good."
                onClick={() => navigate(GUIDE_PATH)} />
              <Card icon={Gamepad2} title="Trail" text="The 500-mile survival run." onClick={() => setView('trail')} />
              <Card icon={Joystick} tone="text-violet-300" title="Game Boy games"
                text="Free homebrew games, touch or keyboard." onClick={() => setView('games')} />
              <Card icon={MapIcon} tone="text-sky-300" title="Map"
                text="Places you’ve already looked at, and a world overview." onClick={() => setView('map')} />
              <Card icon={Paperclip} tone="text-lime-300" title="My files"
                text="Audio and video you added from this device. Plays with no connection."
                onClick={() => setView('files')} />
              <Card icon={ListMusic} tone="text-pink-300" title="Saved lists"
                text={lists.length ? `${lists.length} saved on this device.` : 'None saved yet.'}
                onClick={() => setView('lists')} />
            </div>
            <Link to="/" className="inline-block mt-6 text-xs text-white/40 hover:text-white/70">
              {online ? 'Back to Truegle' : 'Try Truegle again'}
            </Link>
          </>
        )}

        <Suspense fallback={fallback}>
          {view === 'trail' && <TrailGame embedded onClose={() => setView(null)} onFound={() => navigate(GUIDE_PATH)} />}
          {view === 'games' && <GamesPanel onClose={() => setView(null)} />}
          {view === 'map' && (
            // Full screen, with a close button that always sits on top of the map.
            <div className="fixed inset-0 z-[9000] bg-black">
              <MapViewWrapper isOpen onClose={() => setView(null)} popOutStorageKey="truegle_offline_map_popped" />
              <button type="button" onClick={() => setView(null)} aria-label="Close the map"
                className="fixed top-3 left-16 z-[100001] flex items-center gap-1.5 rounded-full bg-black/80 border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
                <X size={16} /> Close
              </button>
            </div>
          )}
        </Suspense>

        {view === 'files' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04]"><PlayerFiles /></div>
        )}

        {view === 'lists' && (
          <div className="space-y-3">
            {lists.length === 0 && <p className="text-sm text-white/50">No saved lists yet. Lists you save while online show up here.</p>}
            {lists.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-semibold">{p.name} <span className="text-white/40 font-normal">· {p.items.length}</span></div>
                <ul className="mt-2 space-y-1 text-[12px] text-white/60">
                  {p.items.slice(0, 50).map((it, i) => <li key={it.key || i} className="truncate">{it.title || it.src}</li>)}
                </ul>
              </div>
            ))}
            <p className="text-[11px] text-white/35">Videos stream, so they play again once you’re back online.</p>
          </div>
        )}
      </div>
    </div>
  );
}
