// EZ Trip Planner — Service Worker
// Stale-while-revalidate: serve cache instantly, update in background
const CACHE_NAME = 'ez-trip-v27';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle http(s) requests — skip chrome-extension://, data:, etc.
  if (!e.request.url.startsWith('http')) return;

  // Network-first for GitHub Gist API
  if (e.request.url.includes('api.github.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Stale-while-revalidate for app files:
  // 1. Return cached version immediately (fast load)
  // 2. Fetch fresh version in background and update cache
  // 3. If fresh version differs, notify user to reload
  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp && resp.status === 200 && e.request.method === 'GET') {
            cache.put(e.request, resp.clone());
            // Notify clients that new content is available
            if (cached && e.request.url.includes('index.html')) {
              self.clients.matchAll().then(clients => {
                clients.forEach(c => c.postMessage({ type: 'UPDATE_AVAILABLE' }));
              });
            }
          }
          return resp;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    )
  );
});
