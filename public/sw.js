// Service worker for offline use. It caches this site's own files and nothing else.
// It never sees pasted text: the page sends nothing anywhere, so there is nothing to intercept.
// Its own CSP (public/_headers) allows connect-src 'self' only, so it can refresh these files and nothing more.
const CACHE = 'pastesafe-v3';
const FILES = [
  '/',
  '/styles.css',
  '/adunit.css',
  '/fonts/ibm-plex-sans-latin.woff2',
  '/fonts/jetbrains-mono-latin.woff2',
  '/favicon.svg',
  '/og.png',
  '/robots.txt',
  '/js/app.js',
  '/js/adunit.js',
  '/js/makers.js',
  '/makers/censory.svg',
  '/makers/penholder.svg',
  '/makers/scrapeland.svg',
  '/js/detect.js',
  '/js/rules.js',
  '/js/sample.js',
  '/js/scan-worker.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first, so online visitors always get the latest files; the cache is the offline fallback.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.pathname === '/index.html' ? '/' : url.pathname;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); }
        return res;
      })
      .catch(() => caches.match(key).then(r => r || Response.error())),
  );
});
