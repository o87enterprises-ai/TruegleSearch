/*
 * Truegle's service worker — precaches the app shell so the installed PWA
 * has SOMETHING of its own to show with zero network, instead of the OS's
 * generic "you're offline" screen.
 *
 * HISTORY, because this exact file already caused one incident. A
 * third-party ad service worker was briefly served at this path on
 * 2026-06-15. It was replaced with a kill-switch: claim control, unregister
 * itself, wipe every cache, reload open tabs. That kill-switch is why it is
 * safe to turn this file into a real worker now — any client still carrying
 * the old registration self-destructs on its next activation and starts
 * clean, and the app never called `serviceWorker.register()` at all in the
 * meantime, so there has been nothing running here to conflict with.
 *
 * WHAT THIS DOES NOT DO, on purpose: cache API responses. /api/search,
 * /api/ai/*, anything backend-shaped, is left completely untouched — serving
 * a stale search result while claiming to be offline-capable would be
 * actively misleading, not a feature. This is app-shell-only: enough HTML/JS/
 * CSS to boot React with no network, so client-side routing can do its job
 * (see App.jsx's offline routing) and land on the one page worth seeing with
 * nothing behind it — the 404 page and its easter egg.
 *
 * WHY THE SHELL IS DISCOVERED, NOT LISTED. Vite hashes every built filename,
 * so a static list here would go stale the moment the next build ran. Instead
 * `install` fetches `/` fresh off the network (this only ever runs while
 * online — an install can't happen offline) and regex-scans the returned HTML
 * for the same-origin <script>/<link> tags IT actually references. That
 * keeps this file in step with every build without a build step of its own.
 *
 * THE LAZY CHUNKS (the 404 page's trail game and its encyclopedia) are NOT
 * precached — their filenames aren't in index.html at all, only reachable by
 * actually importing them client-side. They're covered by the runtime
 * cache-then-network-update rule below instead: the first time anyone visits
 * them ONLINE, the response is cached, and it's available offline from then
 * on. A visitor who has never opened the game before going offline still gets
 * the 404 page itself — just not the game inside it yet. Worth knowing, not
 * worth the complexity of a build-time manifest to close for a $0 project.
 */

// BUMP THIS on any change to what gets cached or how — activate deletes every
// cache whose name doesn't match, so a stale version never lingers.
const CACHE_VERSION = 'shell-v3';
const CACHE_NAME = `truegle-${CACHE_VERSION}`;

// OFFLINE PACK (v2): the Game Boy ROMs and game art are cached like build assets, and the
// map's basemap tiles get their own cache (kept across versions, capped) so places already
// looked at still draw with no network. Only these two tile hosts — nothing else cross-origin.
const TILE_CACHE = 'truegle-tiles-v1';
const TILE_MAX = 1500;
const TILE_HOST = /^(?:[a-d]\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)$/;

const CORE_URLS = ['/', '/manifest.webmanifest', '/truegle.png'];
// Source modules whose built chunks (and everything they import) must work with no network.
const OFFLINE_ENTRY = /GuidePage|OfflineHub|TrailGame|Encyclopedia|GameBoyPlayer|gameboyCore|GamesPanel|games\/trail|MapViewWrapper|TruegleMap/;

// Same-origin build output only — never a CDN, a font host, or anything else
// that isn't ours to cache.
function isSameOriginAsset(url) {
  try {
    const u = new URL(url, self.location.origin);
    if (u.origin !== self.location.origin) return false;
    // The build's hashed output lives under /assets/; the two brand marks are
    // root-level files, not a directory — matched by exact name, not a prefix.
    return /^\/(?:assets|game|roms)\//.test(u.pathname) || u.pathname === '/truegle.png' || u.pathname === '/truetube.png';
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Best-effort: a failed precache should not stop the worker installing —
    // an app shell that caches most of itself beats one that caches none of
    // itself because a single font request 404'd.
    await Promise.all(CORE_URLS.map((u) => cache.add(u).catch(() => {})));

    try {
      const res = await fetch('/', { cache: 'no-store' });
      const html = await res.text();
      const urls = new Set();
      const attrPattern = /(?:src|href)="([^"]+)"/g;
      let m;
      while ((m = attrPattern.exec(html))) {
        // Vite emits `./assets/…` — relative to the page, not to this
        // worker's own script URL. Resolve explicitly rather than trusting
        // cache.add()'s implicit resolution to land on the same absolute URL
        // isSameOriginAsset() checks and fetch requests will actually use.
        const abs = new URL(m[1], self.location.href).href;
        if (isSameOriginAsset(abs)) urls.add(abs);
      }
      await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})));

      // THE OFFLINE PAGES' LAZY CHUNKS (2026-11-19). Pages are code-split now, so the guide,
      // offline hub, Trail, Game Boy and map are separate files that index.html never names.
      // The build writes asset-manifest.json (vite.config.js `build.manifest`); precache every
      // file those entries need, following their imports, so they work offline on a visit that
      // was never made online. Best-effort like everything above.
      try {
        const mres = await fetch('/asset-manifest.json', { cache: 'no-store' });
        if (mres.ok) {
          const man = await mres.json();
          const seen = new Set();
          const files = new Set();
          const walk = (key) => {
            const e = man[key];
            if (!e || seen.has(key)) return;
            seen.add(key);
            files.add('/' + e.file);
            (e.css || []).forEach((f) => files.add('/' + f));
            (e.assets || []).forEach((f) => files.add('/' + f));
            // Static imports only: the lazy children that matter are named in OFFLINE_ENTRY, and
            // following every dynamic import would drag in search, three, hls — 2 MB nobody offline needs.
            (e.imports || []).forEach(walk);
          };
          Object.keys(man).filter((k) => OFFLINE_ENTRY.test(k)).forEach(walk);
          await Promise.all([...files].map((u) => cache.add(u).catch(() => {})));
        }
      } catch { /* no manifest: runtime caching still covers anything visited online */ }
    } catch {
      // Offline install (a re-install triggered with no network) — the CORE_URLS
      // above already have whatever the previous cache held via cache.add's
      // implicit revalidation; nothing further to do.
    }

    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== TILE_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never touch writes — those are API calls

  const url = new URL(request.url);

  // MAP TILES — cache-first (a tile at a given z/x/y does not change), keyed with the
  // CARTO subdomain collapsed to "a" so the same tile from b/c/d is one entry.
  if (url.protocol === 'https:' && TILE_HOST.test(url.hostname)) {
    const key = url.href.replace(/^https:\/\/[b-d]\.basemaps/, 'https://a.basemaps');
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') {
          await cache.put(key, res.clone());
          const keys = await cache.keys();
          if (keys.length > TILE_MAX) await Promise.all(keys.slice(0, keys.length - TILE_MAX).map((k) => cache.delete(k)));
        }
        return res;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return; // never touch any other third-party request

  // NAVIGATIONS (a real address-bar/link load, including the PWA's own
  // start_url on launch). Network first — a visitor with a connection always
  // gets the current build, never a stale cached shell. Offline, fall back to
  // the cached shell; App.jsx's own online/offline routing takes it from
  // there and lands on the 404 page instead of trying to render whatever
  // route was actually requested with no backend to answer it.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/', { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }

  // BUILD ASSETS ONLY (scripts, styles, the icons) — stale-while-revalidate.
  // Answer from cache instantly when there is one, and refresh it in the
  // background regardless, so this browser's cache converges on the current
  // build within a request or two rather than staying pinned to whatever was
  // cached at install. This is also what opportunistically catches the trail
  // game / encyclopedia chunks the first time they're actually imported.
  if (isSameOriginAsset(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // ignoreVary: a host that answers `Vary: Origin` would otherwise never match a file the
      // install precached (its request carries no Origin) against the page's own module request.
      const cached = await cache.match(request, { ignoreVary: true });
      const network = fetch(request)
        .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }

  // Everything else — API calls, anything not matched above — is left
  // completely alone: no respondWith, the browser's normal network request
  // goes out exactly as if this worker did not exist.
});
