import { useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { isRadioOn, startRadioFrom } from '../utils/radio';

// "PLAY FROM HERE" ON A LIST OF SEARCH RESULTS.
//
// Ordinarily the tapped result plays and the rest of the results follow it as a
// feed run (startFeed). With RADIO ON that is the wrong shape: a search for a
// song returns that song several times over — the original, the lyric video,
// the live cut, a cover — so "the rest of the results" is a run of the same
// song, and Radio never got a turn because a feed run outranks it (owner,
// 2026-10-24, searching "sade smooth criminal").
//
// So with Radio on, a fresh search + play is a fresh start: the results are NOT
// queued behind it, the up-next queue is cleared, and Radio picks what follows
// from the artist and the artists people listen to alongside them (Last.fm /
// ListenBrainz, see useUpNext). It is the same idea as YouTube's autoplay:
// what comes next is chosen from this song, not from the search box.
//
// Order matters: `play`, not `playNow` — playNow files the song that was on at
// the FRONT of the queue, which would put a previously played song straight
// back in as the next one.
export function usePlayResults() {
  const { startFeed, stopFeed, clearQueue, play } = usePlayer();
  return useCallback((sources, deck) => {
    const first = (sources || []).find((s) => s?.src);
    if (first && isRadioOn()) {
      stopFeed();
      clearQueue();
      play(first, deck);
      startRadioFrom(first);
      return;
    }
    startFeed(sources, deck);
  }, [startFeed, stopFeed, clearQueue, play]);
}

export default usePlayResults;
