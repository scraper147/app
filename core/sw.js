/* Service worker commun, importé par <ami>/<app>/sw.js (importScripts) : une mise à jour de ce fichier
   met à jour toutes les tablettes. Réseau d'abord (3 s), sinon cache. Préfixe propre à l'ami et à l'app. */
var CAISSE_VERSION = '4';
var parts = self.location.pathname.split('/'), APPN = parts[parts.length - 2], CID = parts[parts.length - 3];
var PREFIX = 'caisse-' + CID + '-' + APPN + '-', CACHE = PREFIX + 'v' + CAISSE_VERSION;
var FILES = ['./', './index.html', './manifest.webmanifest', '../client.js', '../../core/' + APPN + '.js', '../../core/' + APPN + '.css',
  '../../core/icons/' + APPN + '-192.png', '../../core/icons/' + APPN + '-512.png', '../../core/icons/' + APPN + '-maskable-512.png', '../../core/icons/' + APPN + '-apple.png'];
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
