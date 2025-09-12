// service-worker.js
const CACHE_NAME = 'quick-locations-v2';

// Same-origin core files
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './locations.json'
];

// Cross-origin assets we rely on (cache them so it works offline)
const CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...CORE, ...CDN]);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => (n !== CACHE_NAME) && caches.delete(n)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Cache-first for our core files and the specific CDN URLs
  const isCore = url.origin === self.location.origin;
  const isCdn = CDN.some(cdnUrl => req.url.startsWith(cdnUrl));

  if (req.method === 'GET' && (isCore || isCdn)) {
    // Special: locations.json = stale-while-revalidate (so updates appear later but still work offline)
    if (url.pathname.endsWith('/locations.json') || req.url.endsWith('locations.json')) {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((fresh) => {
    cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || fetchPromise || Response.error();
}
