/* Sketchboard service worker: makes the app work offline.
   - App code (HTML, JS, CSS, manifest): network first, so you always get the latest version when online;
     falls back to the cached copy when offline or the network is slow.
   - Fonts and icons: cache first (they rarely change).
   PRECACHE must list every file the app needs; tests/smoke.mjs checks it against the folders. */
const CACHE = 'sketchboard-v1';
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/fonts.css',
  'js/core.js',
  'js/geometry.js',
  'js/text.js',
  'js/render.js',
  'js/history.js',
  'js/create.js',
  'js/camera.js',
  'js/editing.js',
  'js/ops.js',
  'js/pointer.js',
  'js/keyboard.js',
  'js/panel.js',
  'js/selbar.js',
  'js/chrome.js',
  'js/export.js',
  'js/store.js',
  'js/boards.js',
  'js/templates.js',
  'js/home.js',
  'js/power.js',
  'js/palette.js',
  'js/share.js',
  'js/actions.js',
  'js/pwa.js',
  'js/main.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'fonts/bricolage-grotesque-normal-500-latin.woff2',
  'fonts/bricolage-grotesque-normal-500-latin-ext.woff2',
  'fonts/figtree-normal-400-latin.woff2',
  'fonts/figtree-normal-400-latin-ext.woff2',
  'fonts/figtree-italic-400-latin.woff2',
  'fonts/figtree-italic-400-latin-ext.woff2',
  'fonts/kalam-normal-400-latin.woff2',
  'fonts/kalam-normal-400-latin-ext.woff2',
  'fonts/kalam-normal-700-latin.woff2',
  'fonts/kalam-normal-700-latin-ext.woff2',
  'fonts/lora-normal-400-latin.woff2',
  'fonts/lora-normal-400-latin-ext.woff2',
  'fonts/lora-italic-400-latin.woff2',
  'fonts/lora-italic-400-latin-ext.woff2',
  'fonts/jetbrains-mono-normal-400-latin.woff2',
  'fonts/jetbrains-mono-normal-400-latin-ext.woff2',
  'fonts/jetbrains-mono-italic-400-latin.woff2',
  'fonts/jetbrains-mono-italic-400-latin-ext.woff2',
  'fonts/nunito-normal-400-latin.woff2',
  'fonts/nunito-normal-400-latin-ext.woff2',
  'fonts/nunito-italic-400-latin.woff2',
  'fonts/nunito-italic-400-latin-ext.woff2',
  'fonts/permanent-marker-normal-400-latin.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIC = /\/(fonts|icons)\//;
function timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
}
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), timeout(4000)]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const hit =
      (await cache.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' && (await cache.match('index.html')));
    if (hit) return hit;
    throw _;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(STATIC.test(url.pathname) ? cacheFirst(req) : networkFirst(req));
});
