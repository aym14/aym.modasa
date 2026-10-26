/* ANSAR YUVA MANDAL — Smart Ledger · Service Worker (ઑફલાઇન સપોર્ટ)
   ------------------------------------------------------------------
   v8 — GitHub Pages પર નવું વર્ઝન તરત ચાલે એ માટે ખાસ સુધારો:
   • index.html અને version.json → હંમેશા પહેલાં નેટવર્ક (કૅશ-બસ્ટર સાથે)
   • version.json ક્યારેય જૂનું ન આપે (અગાઉ એ કૅશમાં ભરાઈ જતું → નવું વર્ઝન દેખાતું નહોતું)
   • બીજી ફાઇલો (આઇકોન, ફોન્ટ, PDF લાઇબ્રેરી) → કૅશ + પાછળ નેટવર્કથી તાજી
   • નવો SW મળે કે તરત સક્રિય થાય (skipWaiting + clients.claim), જૂનું કૅશ ભૂંસાય
   • એપમાંથી "કૅશ ખાલી કરો" સંદેશ આવે તો બધું કૅશ ડિલીટ
   ડેટા localStorage માં જ રહે છે — SW ડેટાને અડતું નથી. */
const VERSION = 'aym-ledger-v19-2026-10-25';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/app-icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
  './icons/logo.png',
  './sync-config.json',
  './vendor/fonts/fonts.css',
  './vendor/fontawesome/all.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
  './vendor/js/jspdf.umd.min.js',
  './vendor/js/jspdf.plugin.autotable.min.js',
  './vendor/js/html2canvas.min.js',
  './vendor/js/qrcode.min.js'
];

/* આ ફાઇલો ક્યારેય કૅશમાંથી ન આપવી — હંમેશા નેટવર્ક પરથી તાજી */
const NEVER_STALE = /(^|\/)(version\.json|sw\.js)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    /* એક ફાઇલ ન મળે તો પણ ઇન્સ્ટોલ અટકે નહીં */
    await Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data;
  if (d === 'skip-waiting') { self.skipWaiting(); return; }
  if (d === 'clear-caches') {
    e.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (e.source && e.source.postMessage) e.source.postMessage({ type: 'caches-cleared' });
    })());
    return;
  }
  if (d === 'check-update') {
    e.waitUntil(self.registration && self.registration.update ? self.registration.update().catch(() => {}) : Promise.resolve());
  }
});

function isNavigation(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').indexOf('text/html') >= 0);
}

/* કૅશ-બસ્ટર સાથે તાજી વિનંતી — GitHub Pages નું 10 મિનિટનું કૅશ પણ વટાવે */
function bust(req) {
  try {
    const u = new URL(req.url);
    u.searchParams.set('_aym', String(Date.now()));
    return new Request(u.href, { cache: 'no-store', credentials: 'same-origin', mode: 'same-origin', redirect: 'follow' });
  } catch (e) {
    return new Request(req.url, { cache: 'no-store' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  /* 0) version.json / sw.js → ફક્ત નેટવર્ક, કૅશ બિલકુલ નહીં */
  if (NEVER_STALE.test(url.pathname)) {
    event.respondWith(fetch(bust(req)).catch(() => new Response('{}', {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  /* 1) પેજ ખૂલવાની વિનંતી → પહેલાં નેટવર્ક (તાજું), ન મળે તો કૅશ (ઑફલાઇન) */
  if (isNavigation(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(bust(req));
        if (fresh && fresh.ok) {
          const c = await caches.open(VERSION);
          c.put('./index.html', fresh.clone()).catch(() => {});
          return fresh;
        }
        throw new Error('bad status');
      } catch (err) {
        const c = await caches.open(VERSION);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  /* 2) બાકીનું → કૅશ પહેલાં, પછી પાછળ નેટવર્કથી તાજું કરો (ઑફલાઇન ઝડપી) */
  event.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if (hit) { net; return hit; }
    return (await net) || Response.error();
  })());
});
