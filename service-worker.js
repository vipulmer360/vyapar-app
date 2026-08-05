const CACHE_NAME = 'vyapar-v17';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/dashboard.css',
  './css/print.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/firebase-config.js',
  './js/auth.js',
  './js/sync.js',
  './js/dashboard.js',
  './js/accounts.js',
  './js/transactions.js',
  './js/parties.js',
  './js/reports.js',
  './js/settings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Install — cache all assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (e.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});
