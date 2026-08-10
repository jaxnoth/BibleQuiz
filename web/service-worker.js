const cacheName = 'bible-quiz-v8';
const assets = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/game-engine.js',
  './js/progress-store.js',
  './js/scripture-provider.js',
  './js/scripture-session.js',
  './js/api-bible-provider.js',
  './data/study-data.json',
  './manifest.webmanifest',
  './icons/icon.svg',
];

function isScriptureApiRequest(url) {
  try {
    const path = new URL(url).pathname;
    return path.startsWith('/api/scripture') || path.includes('/api/scripture');
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Never cache API.Bible proxy responses (license / freshness).
  if (isScriptureApiRequest(event.request.url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('./index.html'))),
  );
});
