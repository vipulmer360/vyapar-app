const CACHE_NAME = 'vyapar-v103';
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
  './js/calculations.js',
  './js/income.js',
  './js/expense.js',
  './js/accounts.js',
  './js/dashboard.js',
  './js/transactions.js',
  './js/parties.js',
  './js/reports.js',
  './js/settings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Install — cache all assets & activate immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches & take control immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — NETWORK FIRST for HTML/JS/CSS, Cache First for images
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET requests and Firebase/external API calls
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // For HTML, JS, CSS files → Network First (always get latest code)
  if (e.request.destination === 'document' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {

    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Got fresh response from network — update cache & serve
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline — serve from cache
          return caches.match(e.request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // For images/icons/other assets → Cache First (fast loading)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        if (response.status === 200) {
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
