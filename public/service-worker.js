// public/service-worker.js

const CACHE_NAME = '6d-address-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/js/main.js',
  '/js/map-core.js',
  '/js/utils.js',
  '/js/locales.js',
  '/js/firebase.js',
  '/js/config.js',
  '/js/animated-background.js',
  '/assets/favicon.ico',
  '/assets/favicon.svg',
  '/assets/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap'
];

// Install: Cache the application shell
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch: Implement Network First strategy for critical assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests for caching. The Cache API does not
  // support caching of POST/PUT/PATCH/DELETE requests.
  if (request.method !== 'GET') {
    // Let the network handle non-GET requests without touching the cache
    return; // do not call respondWith; default fetch proceeds
  }

  // Use Network First for HTML, CSS, and JS files from our origin
  if (request.mode === 'navigate' || (url.origin === self.location.origin && (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the network request is successful, cache it and return it
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              // Cache only GET requests
              cache.put(request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // If the network request fails (offline), serve from cache
          return caches.match(request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('/index.html'); // Fallback to index
            });
        })
    );
  } else {
    // For all other requests (images, fonts, etc.), use a Cache First strategy
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request).then(response => {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
            return response;
          });
        })
    );
  }
});
