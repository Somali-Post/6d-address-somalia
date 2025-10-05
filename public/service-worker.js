const CACHE_NAME = '6d-address-v1';
// These are the core files that make up the "app shell".
const urlsToCache = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/main.js',
  '/js/config.js',
  '/js/utils.js',
  '/js/map-core.js',
  '/js/firebase.js',
  '/js/locales.js',
  '/assets/logo-somalia.png'
];

// 1. Installation: Open a cache and add the app shell files to it.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Activation: Clean up old caches.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Fetch: Serve files from the cache first (Cache-First Strategy).
self.addEventListener('fetch', event => {
  // We only want to cache GET requests for our app shell.
  // All other requests (e.g., POST to our API, Google Maps tiles) should go to the network.
  if (event.request.method !== 'GET' || !urlsToCache.includes(new URL(event.request.url).pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // If we found a match in the cache, return it.
          // console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        // If no match, fetch from the network.
        // console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request);
      })
  );
});