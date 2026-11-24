// サービスワーカー。配るファイルを端末にしまい、通信なしでも開けるようにする。
// 配るファイルを1つでも変えたら、下の CACHE の番号を上げる(上げないと古い画面が残る)。
// 番号の上げ忘れと ASSETS の書きもれは、cache-check.py で調べられる。
const CACHE = '__APP_ID__-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/store.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  // cache: 'reload' で、ブラウザの手元の古い写しではなく、置いてある最新を取りにいく
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('__APP_ID__-v') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { cacheName: CACHE }).then((hit) => hit || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
