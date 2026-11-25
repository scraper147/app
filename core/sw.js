/* Service worker commun, importé par <ami>/<app>/sw.js (importScripts) : une mise à jour de ce fichier
   met à jour toutes les tablettes. Réseau d'abord (3 s), sinon cache. Préfixe propre à l'ami et à l'app. */
var CAISSE_VERSION = '17';
var parts = self.location.pathname.split('/'), APPN = parts[parts.length - 2], CORE = self.CAISSE_CORE || '../../core/'; // CAISSE_CORE : posé par <app>/<x>/sw.js (apps rangées sous un client)
var BASE = parts.slice(0, -2).join('/').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
var PREFIX = 'caisse-' + BASE + '-' + APPN + '-', CACHE = PREFIX + 'v' + CAISSE_VERSION;
var FILES = ['./', './index.html', './manifest.webmanifest', '../client.js', CORE + APPN + '.js', CORE + APPN + '.css',
  CORE + 'icons/' + APPN + '-192.png', CORE + 'icons/' + APPN + '-512.png', CORE + 'icons/' + APPN + '-maskable-512.png', CORE + 'icons/' + APPN + '-apple.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return fetch(f, { cache: 'no-store' }).then(function (r) { if (r.ok) return c.put(new URL(f, self.location).href, r); }).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function fromCache() {
      if (done) return; done = true;
      caches.open(CACHE).then(function (c) { return c.match(e.request, { ignoreSearch: true }).then(function (r) { return r || c.match(new URL('./index.html', self.location).href); }); }).then(resolve);
    }
    var timer = setTimeout(fromCache, 3000);
    fetch(e.request, { cache: 'no-store' }).then(function (res) {
      if (res && res.ok) { var copy = res.clone(), u = new URL(e.request.url); caches.open(CACHE).then(function (c) { c.put(u.origin + u.pathname, copy); }); }
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(function () { clearTimeout(timer); fromCache(); });
  }));
});
