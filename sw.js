/* Versioned local app shell. Orders and admin data are never cached. */
const PREFIX = 'jianfu-gyoza-';
const CACHE = PREFIX + 'v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './assets/site.css',
  './assets/vendor/lucide.min.js', './assets/vendor/three.min.js', './assets/street-3d.js?v=6',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => (key.startsWith(PREFIX) && key !== CACHE) || key === 'jianfu-v4')
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const base = new URL('./', self.location.href);
  const shellUrls = SHELL.map(path => new URL(path, base).href);
  if (req.mode === 'navigate') {
    // Do not serve the customer shell for the admin page or unknown paths.
    if (![base.pathname, base.pathname + 'index.html'].includes(url.pathname)) return;
    event.respondWith(fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)));
      }
      return res;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', base).href))));
    return;
  }
  if (!shellUrls.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(req)).then(hit => hit || fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)));
    }
    return res;
  })));
});
