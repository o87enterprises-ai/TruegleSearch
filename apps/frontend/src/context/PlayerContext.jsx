import { createContext, useContext, useState, useCallback } from 'react';

// Global media-player state for the persistent pop-out mini-player. Lives ABOVE
// <Routes> so the media node it drives (MiniPlayer) survives SPA navigation —
// the whole point of "pop out and keep playing while I browse elsewhere".
const PlayerContext = createContext();

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
};

export const PlayerProvider = ({ children }) => {
  // current: { kind: 'youtube'|'vimeo'|'audio'|'video', src, title, pageUrl,
  //            poster } | null. Single active source — popping out a new one
  //            replaces it (no queue in MVP).
  const [current, setCurrent] = useState(null);
  const [minimized, setMinimized] = useState(false);

  const play = useCallback((source) => {
    if (!source || !source.src) return;
    setCurrent(source);
    setMinimized(false);
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
    setMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => setMinimized((v) => !v), []);

  return (
    <PlayerContext.Provider value={{ current, minimized, play, close, toggleMinimize }}>
      {children}
    </PlayerContext.Provider>
  );
};
