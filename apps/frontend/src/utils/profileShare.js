// MOVE YOUR LISTS TO ANOTHER DEVICE — no server involved.
//
// Everything a person has saved lives in this browser. To carry it to a new phone or
// laptop we pack their saved playlists (and the unlocked survival guide) into one short
// text code — JSON, deflated, base64url — that can be pasted, or shared as a link whose
// code sits after the # so it is never sent to any server, including ours.
//
//   code:  TG1.<base64url>
//   link:  https://truegle.info/#profile=TG1.<base64url>

import { playlists, upsertImportedPlaylist } from './playlists';
import { vaultTier, findVault } from './vault';

const PREFIX = 'TG1.';
export const PROFILE_HASH = '#profile=';

const toB64 = (bytes) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (str) => {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** What would travel: the saved lists and the guide unlock. */
export function snapshot() {
  return {
    v: 1,
    lists: playlists().map((p) => ({
      id: p.id,
      n: p.name,
      i: p.items.map((s) => [s.src, s.kind || '', s.title || '', s.pageUrl || '', s.poster || '', s.channel || '', s.vertical ? 1 : 0]),
    })),
    guide: vaultTier() || null,
  };
}

/** @returns {Promise<string>} the TG1. code for this device's lists. */
export async function exportProfile() {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot()));
  return PREFIX + toB64(await pipe(bytes, new CompressionStream('deflate-raw')));
}

export const profileLink = (code) => `${window.location.origin}/${PROFILE_HASH}${code}`;

/** Parses a code (or a whole link) without applying it. Throws on anything unreadable. */
export async function readProfile(input) {
  let code = String(input || '').trim();
  const at = code.indexOf(PROFILE_HASH);
  if (at >= 0) code = code.slice(at + PROFILE_HASH.length);
  if (!code.startsWith(PREFIX)) throw new Error('not a Truegle code');
  const bytes = await pipe(fromB64(code.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || data.v !== 1 || !Array.isArray(data.lists)) throw new Error('unsupported code');
  return data;
}

/** Adds the lists (re-importing the same code refreshes them rather than duplicating). */
export function applyProfile(data) {
  let count = 0;
  data.lists.forEach((l) => {
    const items = (l.i || []).map(([src, kind, title, pageUrl, poster, channel, vertical]) => ({
      src, kind: kind || undefined, title, pageUrl, poster, channel, ...(vertical ? { vertical: true } : {}),
    }));
    if (upsertImportedPlaylist(`profile:${l.id}`, l.n, items)) count += 1;
  });
  if (data.guide) findVault(data.guide);
  return count;
}
