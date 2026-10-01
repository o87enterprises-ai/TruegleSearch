import { useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

// ONE PLAYER. Anything playable picked outside Tube or the Feed — the Vids tab,
// a chat answer's ▶ Play, a result card — goes to the universal player rather
// than mounting a frame of its own. A second frame plays over the first, has
// no pause/volume/next, and never ends a queue (owner, 2026-10-01: "we want
// only one active usable player").
//
// Same rule as QueueButton's Play: if somebody is following their queue, the
// pick plays now and the queue carries on after it; otherwise it simply plays.
export function usePlayInPlayer() {
  const { play, playNow, queueArmed, queue } = usePlayer();
  return useCallback((source) => {
    if (!source?.src) return false;
    if (queueArmed && queue.length > 0) playNow(source, 'tube'); else play(source, 'tube');
    return true;
  }, [play, playNow, queueArmed, queue.length]);
}

export default usePlayInPlayer;
