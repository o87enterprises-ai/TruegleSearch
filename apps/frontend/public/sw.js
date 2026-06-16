/*
 * Self-destructing service worker (kill switch).
 *
 * A third-party ad service worker was briefly served at this path on
 * 2026-06-15 and has been removed. This replacement exists ONLY to clean up
 * after any browser that registered that old worker: it claims control,
 * unregisters itself, clears all caches, and reloads open tabs so no
 * foreign/stale worker keeps controlling the page. It references no external
 * domains and registers nothing — the app never calls
 * navigator.serviceWorker.register() anymore, so for the vast majority of
 * visitors this file is never executed at all.
 *
 * Safe to delete once you're confident no clients still have the old worker
 * registered (weeks). Leaving it costs nothing.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (err) {
        // ignore — cache cleanup is best-effort
      }

      try {
        await self.registration.unregister();
      } catch (err) {
        // ignore
      }

      // Reload any open tabs so they stop being controlled by the old worker.
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        try {
          client.navigate(client.url);
        } catch (err) {
          // ignore — some clients may not allow navigation
        }
      });
    })()
  );
});
