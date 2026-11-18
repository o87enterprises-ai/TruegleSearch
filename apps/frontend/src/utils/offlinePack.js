// OFFLINE PACK — what Truegle keeps on this device so the basics work with no network:
// the guide, Trail, the Game Boy games, the map (tiles you have looked at, plus a world
// overview) and your saved lists. Everything is stored in THIS browser (Cache Storage and
// localStorage) and never sent anywhere. public/sw.js does the serving; this file warms it.
//
// Safe to call repeatedly: every fetch is a plain same-origin GET the service worker caches.

import { PLAYABLE_GAMES } from '../data/gameboyLibrary';

const KEY = 'truegle_offline_pack_v1';
const OSM = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

export function offlinePackStatus() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

/** Fetches the lazy code and game files so the service worker caches them. Online only. */
export async function warmOfflinePack() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return false;
  // Importing a lazy chunk is what downloads (and so caches) it.
  const chunks = await Promise.allSettled([
    import('../components/Encyclopedia'),
    import('../components/TrailGame'),
    import('../games/trail/index.js'),
    import('../components/games/GamesPanel'),
    import('../components/games/GameBoyPlayer'),
    import('../utils/gameboyCore'),
    import('../components/map/MapViewWrapper'),
  ]);
  const roms = await Promise.allSettled(
    PLAYABLE_GAMES.map((g) => fetch(g.romPath).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))),
  );
  // A whole-world overview (zoom 0-2, 21 tiles) so the map is never blank offline.
  const tiles = [];
  for (let z = 0; z <= 2; z += 1) {
    for (let x = 0; x < 2 ** z; x += 1) {
      for (let y = 0; y < 2 ** z; y += 1) tiles.push(fetch(OSM(z, x, y), { mode: 'cors' }));
    }
  }
  await Promise.allSettled(tiles);

  const ok = [...chunks, ...roms].every((r) => r.status === 'fulfilled');
  if (ok) {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), games: PLAYABLE_GAMES.length })); } catch { /* private mode */ }
  }
  return ok;
}
