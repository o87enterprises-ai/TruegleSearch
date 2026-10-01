import { useCallback, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { importPlaylist, importMessage } from '../utils/playlistImport';

// PLAY ALL — the one thing a playlist link does (owner, 2026-10-01).
//
// It used to be three different buttons in three places — "Play in Truegle"
// on a pasted link, "Import playlist" in the player's list, and Play now /
// Queue / List on a card for the link — and none of them did the whole job:
// one played YouTube's playlist embed (which here shows "This video is
// unavailable"), one saved the list and then lost it. Now there is one:
//
//   1. the playlist is saved to Lists (refreshing it if it is already there),
//   2. it REPLACES the queue — nothing old mixed in behind it,
//   3. track one plays, and the rest are up next, locked to the list.
//
// Returns { playAll(url), busy, message }. Never throws.
export function usePlayAll() {
  const { playList } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const playAll = useCallback(async (url) => {
    setBusy(true);
    setMessage('');
    const result = await importPlaylist(url);
    setBusy(false);
    if (result.ok) playList(result.sources, 'tube', result.id, 0);
    setMessage(importMessage(result));
    return result;
  }, [playList]);
  return { playAll, busy, message };
}

export default usePlayAll;
