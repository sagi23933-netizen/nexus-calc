/* BulDeal service worker — offline app shell, cached deals feed and images. */
const VERSION = 'dev'; // replaced with a per-build hash by vite.config.ts
const BUILD_ASSETS = []; // filled at build time with the public-site JS/CSS chunks
const SHELL = `bd-shell-${VERSION}`;
const ASSETS = `bd-assets-${VERSION}`;
const API = `bd-api-${VERSION}`;
const IMAGES = 'bd-images-v1';
const FONTS = 'bd-fonts-v1';
const KEEP = [SHELL, ASSETS, API, IMAGES, FONTS];

const PRECACHE = ['/', '/offline.html', '/manifest.json', '/logo.webp', '/icon-192.png', '/icon-512.png', '/favicon.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL).then((c) => c.addAll(PRECACHE)),
      // build chunks are cached one by one so a single failure doesn't abort the install
      caches.open(ASSETS).then((c) => Promise.all(BUILD_ASSETS.map((u) => c.add(u).catch(() => {})))),
    ])
      .then(async () => {
        // first install: activate immediately; updates wait until the user taps "update" (see message handler)
        if (!self.registration.active) await self.skipWaiting();
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('bd-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/** Network first with a timeout, falling back to cache (used for the public deals API). */
async function networkFirst(request, cacheName, ms = 6000) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(request), timeout(ms)]);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'אין חיבור לאינטרנט', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) {
    cache.put(request, res.clone());
    if (max) trim(cacheName, max);
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

/** SPA navigations: network first, then the cached app shell, then the offline page. */
async function navigation(event) {
  try {
    const preload = await event.preloadResponse;
    const res = preload || (await Promise.race([fetch(event.request), timeout(8000)]));
    if (res && res.ok) {
      const cache = await caches.open(SHELL);
      cache.put('/', res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL);
    return (await cache.match('/')) || (await cache.match('/offline.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') return event.respondWith(navigation(event));
    if (url.pathname.startsWith('/api/public/') && !url.pathname.endsWith('/track')) return event.respondWith(networkFirst(request, API));
    if (url.pathname.startsWith('/api/')) return; // private data is never cached
    if (url.pathname.startsWith('/uploads/')) return event.respondWith(cacheFirst(request, IMAGES, 150));
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request, ASSETS, 120));
    if (url.pathname === '/sw.js') return;
    return event.respondWith(staleWhileRevalidate(request, SHELL));
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
  }
});
