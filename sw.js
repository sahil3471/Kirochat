/* Stale-while-revalidate service worker for the Dartmouth Eats Tracker.
 *
 * Bump CACHE whenever you ship code changes — the activate handler deletes
 * any cache whose name doesn't match, which is what forces installed PWAs to
 * pick up the new app.js / playbook.js / etc.
 *
 * Fetch strategy: serve from cache immediately (so it's fast and works
 * offline), but ALWAYS fire off a network request in the background and
 * update the cache. The next time the user opens the app, they'll get the
 * fresh version. This is what makes future deploys propagate automatically
 * without having to bump CACHE for every change.
 */
const CACHE = "dartmouth-eats-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./playbook.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        // Always kick off a network request in the background and update the
        // cache so the next launch gets fresh code.
        const networkPromise = fetch(req).then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);

        // Return cached immediately if we have it; otherwise wait for network.
        return cached || networkPromise;
      })
    )
  );
});
