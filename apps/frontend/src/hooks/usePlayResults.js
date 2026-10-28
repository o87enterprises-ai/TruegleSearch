import { useCallback, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { isRadioOn, isRadioAllowed, startRadioFrom, artistOf } from '../utils/radio';
import { identifyQuery } from './useUpNext';
import { mediaKey } from '../utils/videoEmbed';

// "PLAY FROM HERE" ON A LIST OF SEARCH RESULTS.
//
// Ordinarily the tapped result plays and the rest of the results follow it as a
// feed run (startFeed). For MUSIC that is the wrong shape: a search for a song
// returns that song several times over — the original, the lyric video, the
// live cut, a cover — so "the rest of the results" is a run of the same song,
// and Stream never got a turn because a feed run outranks it (owner,
// 2026-10-24, searching "sade smooth criminal").
//
// So when the pick is music, a fresh search + play is a fresh start: the results
// are NOT queued behind it, the up-next queue is cleared, and Stream picks what
// follows from the artist and the artists people listen to alongside them
// (Last.fm / ListenBrainz, see useUpNext). Like YouTube's autoplay: what comes
// next is chosen from this song, not from the search box.
//
// "IS IT MUSIC?" has two answers. Right away: Stream is on, or the clip reads
// "Artist - Song". Failing that — most real uploads are titled by the song
// alone ("Tweedle Dee (Performed live on The Ed Sullivan Show)") — the SEARCH
// QUERY is asked, in the background: if it names an artist and a song and the
// clip is that song, the run is converted to a Stream a moment after it starts
// (owner, 2026-10-28: Stream was falling back to plain Up Next for these).
//
// Order matters: `play`, not `playNow` — playNow files the song that was on at
// the FRONT of the queue, which would put a previously played song straight
// back in as the next one.

// Does the clip look like the song / artist the query turned out to be about?
const squash = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');
export function corroborates(source, said) {
  const text = squash(`${source?.title || ''} ${source?.channel || ''}`);
  const track = squash(said?.track);
  const artist = squash(said?.artist);
  return (track.length >= 4 && text.includes(track)) || (artist.length >= 4 && text.includes(artist));
}

export function usePlayResults() {
  const player = usePlayer();
  const { startFeed, stopFeed, clearQueue, play } = player;
  // What is playing NOW, read when the background answer arrives.
  const playing = useRef(null);
  playing.current = player.current;

  return useCallback((sources, deck, { query } = {}) => {
    const first = (sources || []).find((s) => s?.src);
    const asStream = () => { stopFeed(); clearQueue(); play(first, deck); startRadioFrom(first, { query }); };
    if (first && (isRadioOn() || (isRadioAllowed() && artistOf(first)))) {
      asStream();
      return;
    }
    startFeed(sources, deck);
    if (!first || !isRadioAllowed() || !String(query || '').trim()) return;
    const key = mediaKey(first) || first.src;
    identifyQuery(query).then((said) => {
      if (!said.artist || !isRadioAllowed() || !corroborates(first, said)) return;
      // Only if the listener is still on that very clip, and nothing else (an
      // explicit queue add, a different pick) has taken over in the meantime.
      const now = playing.current;
      if (!now || (mediaKey(now) || now.src) !== key) return;
      stopFeed(); clearQueue(); startRadioFrom(first, { query });
    }).catch(() => { /* the results simply keep playing as a run */ });
  }, [startFeed, stopFeed, clearQueue, play]);
}

export default usePlayResults;
