import { useSyncExternalStore } from 'react';

// RADIO: when what's playing is a song, "next" is more of the ARTIST and of
// artists people listen to alongside them — not more of the same TITLE, which
// is what the ordinary up-next search does and how a song used to turn into a
// run of covers, lyric videos and reactions to itself (owner, 2026-10-17).
//
// The switch lives in this browser only. The similar-artist lookup sends the
// artist's NAME to Truegle's backend, which asks MusicBrainz/ListenBrainz; it
// carries nothing about the listener.
const KEY = 'truegle_player_radio_v1';
const listeners = new Set();

export function isRadioOn() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** Stream is on, OR was never touched (so a fresh song search may start it).
 *  An explicit OFF by the listener is respected. */
export function isRadioAllowed() {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}

export function setRadio(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode: session only */ }
  // Off ends the session: the next time it is switched on it starts from
  // whatever is playing then, not from an artist remembered from before.
  if (!on) { anchor = null; session = false; }
  listeners.forEach((fn) => fn());
}

// ── THE ARTIST RADIO IS FOLLOWING, kept across the session ─────────────────
// Radio used to work the artist out afresh from every clip, so one song with
// a messy title ("Song (Lyrics)", a fan upload) broke the chain and handed
// "next" to plain Up Next. The last artist it followed is now remembered and
// used whenever the current clip can't be identified. Tab-only, never stored.
let anchor = null;
export const getRadioAnchor = () => anchor;
export function setRadioAnchor(name) { anchor = name || null; }

// ── STARTED ON PURPOSE ─────────────────────────────────────────────────────
// "Start Radio" from a song: Radio takes over "next" straight away, even with
// a queue waiting — the queue is parked, untouched, and comes back when Radio
// is switched off. Plain Radio (the switch) still only fills in once the
// queue is empty.
let session = false;
export const isRadioSession = () => session;
export function startRadioFrom(source) {
  anchor = artistOf(source) || anchor;
  session = true;
  setRadio(true);
}
export function useRadioSession() {
  return useSyncExternalStore(subscribe, () => session && isRadioOn(), () => false);
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// WHAT RADIO LAST DID, so the button can say it. Radio only steers "next"
// when the clip reads as a song (artistOf) and a search for that artist
// finds something; otherwise the ordinary up-next plays. That fallback used
// to be silent, which made Radio look like it worked only sometimes.
//   { state: 'following', artist } | { state: 'fallback', reason } | null
let status = null;
const statusListeners = new Set();
export function setRadioStatus(next) {
  status = next;
  statusListeners.forEach((fn) => fn());
}
const subscribeStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
export function useRadioStatus() {
  return useSyncExternalStore(subscribeStatus, () => status, () => null);
}

/** [on, setOn] — shared by every player presentation. */
export function useRadio() {
  const on = useSyncExternalStore(subscribe, isRadioOn, () => false);
  return [on, setRadio];
}

// "Artist - Song", with the dash variants people actually type.
const SEP = /\s[-–—]\s/;
// "A feat. B", "A ft B", "A x B", "A & B", "A, B" → A.
const COLLAB = /\s+(?:feat\.?|ft\.?|featuring|x|&|and|with|vs\.?)\s+|,\s*/i;
// The left side of a dash that is not an artist.
const NOT_ARTIST = /\b(official|lyrics?|video|audio|live|cover|remix|reaction|full album|playlist|mix|episode|ep\.?)\b/i;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * The artist of the playing item, or null when it doesn't look like a song.
 *
 * Most reliable first: YouTube's auto-generated "Artist - Topic" channels and
 * VEVO channels ARE the artist. Then the "Artist - Song" title convention,
 * which nearly every music upload follows. Anything else returns null and the
 * player falls back to the ordinary up-next, rather than guessing a radio
 * station out of a podcast title.
 */
export function artistOf(source) {
  const channel = clean(source?.channel);
  const topic = channel.match(/^(.+?)\s+-\s+Topic$/i);
  if (topic) return topic[1];

  const title = clean(source?.title);
  if (SEP.test(title)) {
    const left = clean(title.split(SEP)[0]).replace(/^\[[^\]]*\]\s*|^\([^)]*\)\s*/, '');
    const first = clean(left.split(COLLAB)[0]);
    if (first && first.length <= 40 && !NOT_ARTIST.test(first)) return first;
  }

  const vevo = channel.match(/^(.+?)\s*VEVO$/i);
  if (vevo && vevo[1].length >= 2) return vevo[1];
  return null;
}

/** Loose name match: case, accents and punctuation don't matter. */
export const nameKey = (s) => String(s || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');
