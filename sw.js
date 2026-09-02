/* Repodest Service Worker — caches the app shell and CDN resources */
const CACHE_NAME = 'repodest-v3';
const SHELL_URLS = [
  './',
  './index.html',
  './styles.css',
  './core.js',
  './app.js',
  './manifest.json'
];
const CDN_URLS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap'
];

/* Install: pre-cache the app shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_URLS).catch(() => {
        /* Non-critical: shell URLs may fail in some contexts */
      });
    })
  );
  self.skipWaiting();
});

/* Activate: clean up old caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Fetch: network-first for API calls, cache-first for static assets */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Never cache GitHub API calls */
  if (url.hostname === 'api.github.com' || url.hostname === 'gitlab.com' || url.hostname === 'api.bitbucket.org') {
    return;
  }

  /* Cache-first for CDN resources (Chart.js, html2canvas, fonts) */
  if (
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  /* Network-first for the app itself */
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
