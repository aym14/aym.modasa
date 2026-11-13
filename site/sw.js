/* AYM Smart Ledger v1.2.84 — Party session and authorization fixes */
const CACHE_PREFIX = 'aym-smart-ledger-pwa-';
const CACHE_NAME = CACHE_PREFIX + 'v1.2.90-code90-party-email-otp-cache-refresh';
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
