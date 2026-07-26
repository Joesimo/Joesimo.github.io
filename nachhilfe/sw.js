/* Service Worker: App-Hülle offline verfügbar halten. */

const VERSION = 'nh-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/sync.js',
  'js/crypto.js',
  'js/ui.js',
  'js/util.js',
  'js/icons.js',
  'js/charts.js',
  'js/theme.js',
  'js/actions.js',
  'js/views/dashboard.js',
  'js/views/students.js',
  'js/views/lessons.js',
  'js/views/grades.js',
  'js/views/calendar.js',
  'js/views/finance.js',
  'js/views/settings.js',
  'icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Sync-Anfragen nie abfangen

  // Netz zuerst, damit Aktualisierungen sofort ankommen; Cache als Rückfallebene.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
