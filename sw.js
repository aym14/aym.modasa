/* AYM Smart Ledger v1.2.93 — Party password login */
const CACHE_PREFIX = 'aym-smart-ledger-pwa-';
const CACHE_NAME = CACHE_PREFIX + 'v1.2.93-party-separate-password-login';
const APP_SHELL = ['./index.html', './party-cloud.js', './party-requests.js', './party-mobile-email-login.js', './manifest.json', './icons/app-icon-192.png', './icons/app-icon-512.png', './icons/app-icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* Keep the previous worker/cache alive if the required app shell cannot be fetched. */
    try {
      await cache.add(new Request('./index.html', { cache: 'reload' }));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    await Promise.all(APP_SHELL.filter((path) => path !== './index.html').map((path) =>
      cache.add(new Request(path, { cache: 'reload' })).catch(() => null)
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (url.pathname.endsWith('/sync-config.json') || url.pathname.endsWith('/licensing-config.json') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(new Request(request, { cache: 'no-store' }));
        if (fresh && fresh.ok) {
          cache.put(new URL('./index.html', scope).href, fresh.clone()).catch(() => {});
          return fresh;
        }
      } catch (_) {}
      return (await cache.match(new URL('./index.html', scope).href)) ||
        (await cache.match(new URL('./', scope).href)) ||
        new Response('Open the app online once before using it offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  })().catch(() => new Response('Resource unavailable.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});
