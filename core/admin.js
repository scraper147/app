/* caisse · admin · v12 — code commun à tous les amis */
document.body.insertAdjacentHTML("afterbegin", "\n<div id=\"app\"></div>\n");

/* ================= Mode démo : serveur local à la place de GitHub =================
   Les appels à l'API GitHub (api.github.com) et la lecture de catalogue.json sont servis par un petit
   « serveur » rangé dans la mémoire du navigateur (localStorage, clé DEMO_KEY). L'Admin et la Caisse,
   publiées sur le même site (admin/ et caisse/), partagent donc les mêmes données : catalogue publié,
   ventes envoyées, stock, fichiers de caisse. Aucun jeton, aucun compte. */
/* Utilisateur (client.js du dossier de l'utilisateur) et préfixe de TOUTES les clés de mémoire : plusieurs utilisateurs
   partagent l'adresse scraper147.github.io, leurs données ne doivent jamais se mélanger. */
var CLIENT = window.CLIENT || { id: 'demo', donnees: 'local' };
var KP = 'caisse:' + (CLIENT.chemin || CLIENT.id) + ':'; // chemin = dossier de l'app (« client/app » quand l'app est rangée sous un client)
var RACINE = '../' + (CLIENT.racine || '../'); // depuis une page de l'app (caisse/, admin/, soiree/) vers la racine du site
var APP_ID = window.APP_ID || (/\/admin\//.test(location.pathname) ? 'admin' : /\/soiree\//.test(location.pathname) ? 'soiree' : 'caisse');
var DEMO_KEY = KP + 'serveur';
var DEMO_CAT_REPO = 'demo/caisse', DEMO_SALES_REPO = 'demo/ventes';
function demoDb() { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; } catch (e) { return {}; } }
function demoDbSave(db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
function demoB64(s) { return btoa(unescape(encodeURIComponent(s))); }
function demoUnb64(s) { return decodeURIComponent(escape(atob(String(s).replace(/\s/g, '')))); }
function demoSha(text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8) + Date.now().toString(16) + Math.random().toString(16).slice(2, 10); }
function demoPut(db, repo, path, text) { if (!db[repo]) db[repo] = {}; db[repo][path] = { sha: demoSha(text), text: text }; return db[repo][path]; }
/* ---------- Accès GitHub de l'ami : clé chiffrée (CLIENT.cle) → { token, depot }, gardé sur l'appareil après déverrouillage ---------- */
var ACCES_KEY = KP + 'acces';
function caisseAcces() { try { var a = JSON.parse(localStorage.getItem(ACCES_KEY)); return a && a.token && a.depot ? a : null; } catch (e) { return null; } }
function caisseNormPass(p) { return String(p || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase(); }
function caisseB64d(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function caisseB64e(u) { var s = ''; u = new Uint8Array(u); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
function caisseKey(pass, salt, iter, use) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(caisseNormPass(pass)), 'PBKDF2', false, ['deriveKey'])
    .then(function (b) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, b, { name: 'AES-GCM', length: 256 }, false, [use]); });
}
function caisseDecrypt(blob, pass) {
  return caisseKey(pass, caisseB64d(blob.salt), blob.iter || 600000, 'decrypt')
    .then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: caisseB64d(blob.iv) }, k, caisseB64d(blob.data)); })
    .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
}
function caisseEncrypt(obj, pass) {
  var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  return caisseKey(pass, salt, 600000, 'encrypt').then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(obj))); })
    .then(function (ct) { return { v: 1, kdf: 'PBKDF2-SHA256', iter: 600000, salt: caisseB64e(salt), iv: caisseB64e(iv), data: caisseB64e(ct) }; });
}
function caisseLock() { try { localStorage.removeItem(ACCES_KEY); } catch (e) {} location.reload(); }
/* Écran de déverrouillage (mode GitHub, appareil pas encore déverrouillé) : commun aux trois apps */
function caisseUnlockScreen() {
  if (CLIENT.donnees !== 'github' || caisseAcces() || document.getElementById('caisse-unlock')) return;
  var d = document.createElement('div'); d.id = 'caisse-unlock';
  d.innerHTML = '<style>#caisse-unlock{position:fixed;inset:0;z-index:99999;background:rgba(10,14,20,.86);display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
    '#caisse-unlock form{background:#fff;color:#1A2230;border-radius:16px;padding:24px;width:min(420px,92vw);display:flex;flex-direction:column;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
    '#caisse-unlock h2{margin:0;font-size:21px}#caisse-unlock p{margin:0;color:#586273;font-size:14px;line-height:1.45}#caisse-unlock input{font:inherit;font-size:17px;padding:12px;border:1px solid #C9D1DB;border-radius:10px}' +
    '#caisse-unlock button{font:inherit;font-size:17px;font-weight:700;padding:12px;border:0;border-radius:10px;color:#fff;cursor:pointer}#caisse-unlock .err{color:#A33A2B;font-weight:600}</style>' +
    '<form><h2>Déverrouiller cet appareil</h2><p>' + (CLIENT.cle ? 'Entrez la phrase de passe du commerce. Elle n’est demandée qu’une fois sur cet appareil et n’est jamais enregistrée.' : 'La clé d’accès de ce commerce n’est pas encore installée. Contactez la personne qui gère votre accès.') + '</p>' +
    (CLIENT.cle ? '<input type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="Phrase de passe" required><button type="submit">Déverrouiller</button>' : '') + '<p class="err" hidden></p></form>';
  document.body.appendChild(d);
  var f = d.querySelector('form'), btn = d.querySelector('button'), err = d.querySelector('.err'), inp = d.querySelector('input');
  if (btn) btn.style.background = themeGet ? themeGet().couleur : '#2F5D8A';
  if (inp) setTimeout(function () { inp.focus(); }, 50);
  f.addEventListener('submit', function (e) {
    e.preventDefault(); if (!inp) return; btn.disabled = true; btn.textContent = 'Vérification…'; err.hidden = true;
    caisseDecrypt(CLIENT.cle, inp.value).then(function (acc) {
      if (!acc || !acc.token || !acc.depot) throw new Error('clé');
      return (window.caisseRealFetch || fetch)('https://api.github.com/repos/' + acc.depot, { headers: { Authorization: 'Bearer ' + acc.token, Accept: 'application/vnd.github+json' }, cache: 'no-store' }).then(function (r) {
        if (r.status === 401) throw new Error('Le jeton a expiré ou a été révoqué. Une nouvelle clé doit être préparée.');
        if (r.status === 404) throw new Error('Dépôt de données introuvable avec ce jeton.');
        if (!r.ok) throw new Error('GitHub a répondu ' + r.status + '.');
        localStorage.setItem(ACCES_KEY, JSON.stringify({ token: acc.token, depot: acc.depot, le: new Date().toISOString() })); location.reload();
      });
    }).catch(function (x) {
      btn.disabled = false; btn.textContent = 'Déverrouiller'; err.hidden = false;
      err.textContent = x && x.name === 'OperationError' ? 'Phrase de passe incorrecte.' : x instanceof TypeError ? 'Pas de réseau : la vérification a besoin d’internet.' : (x && x.message) || 'Erreur.';
    });
  });
}
if (CLIENT.donnees === 'github') { if (document.body) setTimeout(caisseUnlockScreen, 0); else document.addEventListener('DOMContentLoaded', caisseUnlockScreen); }
(function () {
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.caisseRealFetch = realFetch; // vérification de l'accès au déverrouillage, sans passer par le shim
  function res(status, body, raw) {
    return new Response(raw ? body : JSON.stringify(body), { status: status, headers: { 'Content-Type': raw ? 'text/plain; charset=utf-8' : 'application/json' } });
  }
  function later(v) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, 120 + Math.random() * 120); }); }
  function api(path, opts) {
    if (navigator.onLine === false) return Promise.reject(new TypeError('Failed to fetch'));
    var method = (opts.method || 'GET').toUpperCase(), q = path.indexOf('?'), p = q >= 0 ? path.slice(0, q) : path;
    var hdr = opts.headers || {}, accept = (typeof hdr.get === 'function' ? hdr.get('Accept') : hdr.Accept || hdr.accept) || '';
    var body = null; try { body = opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
    var m = /^\/repos\/([^/]+\/[^/]+)(?:\/(.*))?$/.exec(p);
    if (p === '/user') return later(res(200, { login: 'demo' }));
    if (!m) return later(res(404, { message: 'Not Found' }));
    var repo = decodeURIComponent(m[1]), rest = m[2] || '', db = demoDb(), files = db[repo] || {};
    if (!rest) return later(res(200, { full_name: repo, private: true, permissions: { pull: true, push: true } }));
    if (rest.indexOf('contents') === 0) {
      var fp = rest.slice(9).split('/').filter(Boolean).map(decodeURIComponent).join('/'), f = files[fp];
      if (method === 'GET') {
        if (f) {
          if (/raw/.test(accept)) return later(res(200, f.text, true));
          return later(res(200, { type: 'file', name: fp.split('/').pop(), path: fp, sha: f.sha, size: f.text.length, encoding: 'base64', content: demoB64(f.text) }));
        }
        var seen = {}, list = [];
        Object.keys(files).forEach(function (k) {
          if (fp && k.indexOf(fp + '/') !== 0) return;
          var r = fp ? k.slice(fp.length + 1) : k, parts = r.split('/'), name = parts[0], full = (fp ? fp + '/' : '') + name;
          if (seen[name]) return; seen[name] = 1;
          list.push(parts.length > 1 ? { type: 'dir', name: name, path: full, sha: 'dir' } : { type: 'file', name: name, path: full, sha: files[full].sha, size: files[full].text.length });
        });
        return later(list.length ? res(200, list) : res(404, { message: 'Not Found' }));
      }
      if (method === 'PUT') {
        if (!body || typeof body.content !== 'string') return later(res(422, { message: 'content missing' }));
        if (f && body.sha !== f.sha) return later(res(409, { message: 'sha does not match' }));
        if (!f && body.sha) return later(res(422, { message: 'sha given for a new file' }));
        var n = demoPut(db, repo, fp, demoUnb64(body.content));
        if (!demoDbSave(db)) return later(res(422, { message: 'Mémoire de démonstration pleine' }));
        return later(res(f ? 200 : 201, { content: { name: fp.split('/').pop(), path: fp, sha: n.sha }, commit: { sha: n.sha } }));
      }
      if (method === 'DELETE') {
        if (!f) return later(res(404, { message: 'Not Found' }));
        if (!body || body.sha !== f.sha) return later(res(409, { message: 'sha does not match' }));
        delete files[fp]; db[repo] = files; demoDbSave(db);
        return later(res(200, { commit: {} }));
      }
    }
    if (rest.indexOf('git/trees') === 0) {
      var tree = [], dirs = {};
      Object.keys(files).forEach(function (k) {
        var parts = k.split('/'); for (var i = 1; i < parts.length; i++) dirs[parts.slice(0, i).join('/')] = 1;
        tree.push({ path: k, mode: '100644', type: 'blob', sha: files[k].sha, size: files[k].text.length });
      });
      Object.keys(dirs).forEach(function (d) { tree.push({ path: d, mode: '040000', type: 'tree', sha: 'dir' }); });
      return later(res(200, { sha: 'demo', tree: tree, truncated: false }));
    }
    if (rest.indexOf('git/blobs/') === 0) {
      var sha = rest.slice(10), hit = null;
      Object.keys(files).forEach(function (k) { if (files[k].sha === sha) hit = files[k]; });
      return later(hit ? res(200, { sha: sha, encoding: 'base64', content: demoB64(hit.text), size: hit.text.length }) : res(404, { message: 'Not Found' }));
    }
    return later(res(404, { message: 'Not Found' }));
  }
  /* ---------- Mode GitHub (CLIENT.donnees === 'github') : les quatre dépôts « virtuels » du code deviennent quatre dossiers
     du dépôt privé de l'ami (CLIENT.cle déchiffrée → { token, depot }). Le jeton réel est ajouté ici ; les apps gardent leur
     faux jeton « demo ». */
  var GH_MAP = { 'demo/caisse': 'caisse/', 'demo/soiree': 'soiree/', 'demo/ventes': 'ventes/', 'demo/admin-donnees': 'admin/' };
  function strip(pre, o) {
    if (Array.isArray(o)) return o.filter(function (x) { return x && typeof x.path === 'string' && x.path.indexOf(pre) === 0; }).map(function (x) { return strip(pre, x); });
    if (o && typeof o === 'object') { if (typeof o.path === 'string' && o.path.indexOf(pre) === 0) o.path = o.path.slice(pre.length); if (o.content && typeof o.content === 'object') strip(pre, o.content); }
    return o;
  }
  function ghReal(path, opts) {
    if (navigator.onLine === false) return Promise.reject(new TypeError('Failed to fetch'));
    var acc = caisseAcces(); if (!acc) return later(res(401, { message: 'Appareil verrouillé' }));
    var q = path.indexOf('?'), p = q >= 0 ? path.slice(0, q) : path, qs = q >= 0 ? path.slice(q) : '';
    var m = /^\/repos\/([^/]+\/[^/]+)(?:\/(.*))?$/.exec(p), hdr = {}, src = opts.headers || {};
    Object.keys(src).forEach(function (k) { if (!/^authorization$/i.test(k)) hdr[k] = src[k]; });
    hdr.Authorization = 'Bearer ' + acc.token; if (!hdr.Accept && !hdr.accept) hdr.Accept = 'application/vnd.github+json';
    var init = { method: opts.method || 'GET', headers: hdr, body: opts.body, cache: 'no-store' };
    var repo = m && decodeURIComponent(m[1]), pre = repo && GH_MAP[repo];
    if (!m || pre == null) return realFetch('https://api.github.com' + path, init);
    var rest = m[2] || '', base = 'https://api.github.com/repos/' + acc.depot;
    if (!rest) return realFetch(base, init);
    if (rest.indexOf('contents') === 0) {
      var fp = rest.slice(9).split('/').filter(Boolean).map(decodeURIComponent);
      var url = base + '/contents/' + (pre + fp.join('/')).split('/').filter(Boolean).map(encodeURIComponent).join('/') + qs;
      return realFetch(url, init).then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        if (!r.ok || ct.indexOf('json') < 0 || /raw/.test(hdr.Accept || hdr.accept || '')) return r;
        return r.json().then(function (j) { return res(r.status, strip(pre, j)); });
      });
    }
    if (rest.indexOf('git/trees') === 0) {
      return realFetch(base + '/git/trees/HEAD?recursive=1', init).then(function (r) {
        if (r.status === 404 || r.status === 409) return res(200, { sha: '', tree: [], truncated: false }); // dépôt encore vide
        if (!r.ok) return r;
        return r.json().then(function (j) { j.tree = strip(pre, (j.tree || []).filter(function (x) { return x.path.length > pre.length; })); return res(200, j); });
      });
    }
    return realFetch(base + '/' + rest + qs, init);
  }
  window.fetch = function (input, opts) {
    var url = String(input && input.url ? input.url : input);
    if (url.indexOf('https://api.github.com') === 0) return CLIENT.donnees === 'github' ? ghReal(url.slice(22), opts || {}) : api(url.slice(22), opts || {});
    var mf = /^(?:\.\/)?(catalogue|config|theme|photos)\.json(\?|$)/.exec(url);
    if (mf && CLIENT.donnees === 'github') {
      var vr = mf[1] === 'catalogue' && APP_ID === 'soiree' ? 'demo/soiree' : DEMO_CAT_REPO;
      return ghReal('/repos/' + vr + '/contents/' + mf[1] + '.json', { headers: { Accept: 'application/vnd.github.raw' } });
    }
    if (mf) {
      var f = (demoDb()[mf[1] === 'catalogue' && APP_ID === 'soiree' ? 'demo/soiree' : DEMO_CAT_REPO] || {})[mf[1] + '.json']; // apparence et réglages : communs à toutes les apps de l'ami
      return later(f ? res(200, f.text, true) : res(404, 'Not Found', true));
    }
    return realFetch(input, opts);
  };
})();

/* ---------- Données d'exemple (bouton « Charger un exemple » de l'Admin) ---------- */
var DEMO_SOIREE_CAT = { format: 'chlorophylle-caisse/catalogue', formatVersion: 1, version: 1, date: '2026-11-24', soiree: 'Soirée démo',
  entrees: [{ id: 'entree', libelle: 'Entrée', prix: 15, ordre: 1, actif: true, compte: 'personne' }, { id: 'vip', libelle: 'Table VIP', prix: 200, ordre: 2, actif: true, compte: 'table' },
    { id: 'invite', libelle: 'Entrée invité/prévente', prix: 0, ordre: 3, actif: true, compte: 'personne' }],
  tickets: { prixCase: 3, casesParCarte: 18 },
  prevente: { modele: '^(?:DEMO-)?([0-9a-fA-F]{32})$', description: 'QR de démonstration : DEMO-<32 caractères 0-9 a-f>' },
  boissons: [
    { id: 'softs', nom: 'Softs', ordre: 1, actif: true, produits: [{ id: 'eau', libelle: 'Eau', format: 'verre', cases: 1, ordre: 1, actif: true }, { id: 'soft', libelle: 'Soft', format: 'verre', cases: 1, ordre: 2, actif: true }] },
    { id: 'bieres', nom: 'Bières', ordre: 2, actif: true, produits: [{ id: 'biere', libelle: 'Bière', format: 'verre', cases: 1, ordre: 1, actif: true }, { id: 'speciale', libelle: 'Bière spéciale', format: 'verre', cases: 2, ordre: 2, actif: true }] },
    { id: 'vins', nom: 'Vins et bulles', ordre: 3, actif: true, produits: [{ id: 'vin', libelle: 'Verre de vin', format: 'verre', cases: 2, ordre: 1, actif: true }, { id: 'cava-btl', libelle: 'Cava', format: 'bouteille', cases: 10, ordre: 2, actif: true }] }] };
function demoIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function demoReset() {
  var keys = [];
  for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(KP) === 0) keys.push(k); }
  keys.forEach(function (k) { localStorage.removeItem(k); });
}
function demoSeed() {
  var keepCfg = null, keepTh = null; try { keepCfg = localStorage.getItem(KP + 'admin-config'); keepTh = localStorage.getItem(KP + 'admin-apparence'); } catch (e) {}
  demoReset();
  if (keepCfg) try { localStorage.setItem(KP + 'admin-config', keepCfg); } catch (e) {}
  if (keepTh) try { localStorage.setItem(KP + 'admin-apparence', keepTh); } catch (e) {}
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function r2(n) { return Math.round(n * 100) / 100; }
  /* les deux jours précédents : aujourd'hui reste libre pour les ventes faites pendant la démo */
  var today = new Date(), d1 = new Date(today), d2 = new Date(today); d1.setDate(today.getDate() - 1); d2.setDate(today.getDate() - 2);
  var days = [demoIso(d2), demoIso(d1)], start = new Date(today); start.setDate(today.getDate() - 3);
  var PDV = [{ id: 'pdv1', nom: 'Stand principal' }, { id: 'pdv2', nom: 'Stand 2' }];
  var CATS = [
    { id: 'boissons', nom: 'Boissons', produits: [['eau', 'Eau', 2], ['soft', 'Soft', 2.5], ['biere', 'Bière', 3], ['vin', 'Verre de vin', 4]] },
    { id: 'snacks', nom: 'Snacks', produits: [['chips', 'Chips', 2], ['hotdog', 'Hot-dog', 4.5], ['gaufre', 'Gaufre', 3.5]] },
    { id: 'goodies', nom: 'Goodies', produits: [['tshirt', 'T-shirt', 15], ['casquette', 'Casquette', 12], ['gobelet', 'Gobelet réutilisable', 1]] },
    { id: 'services', nom: 'Services', produits: [['livraison', 'Livraison', 10]] }
  ];
  var cat = { format: 'agri-garden-caisse/catalogue', formatVersion: 1, version: 1, date: demoIso(start),
    pointsDeVente: PDV.map(function (p) { return { id: p.id, nom: p.nom, actif: true }; }),
    categories: CATS.map(function (k, i) { return { id: k.id, nom: k.nom, ordre: i + 1, actif: true, prefixe: false,
      produits: k.produits.map(function (p, j) { return { id: p[0], libelle: p[1], prix: p[2], ordre: j + 1, actif: true }; }) }; }) };
  var db = {};
  demoPut(db, DEMO_CAT_REPO, 'catalogue.json', JSON.stringify(cat, null, 1) + '\n');
  var PROD = [], LIV = { id: 'livraison', libelle: 'Livraison', prix: 10, cat: 'Services' }; CATS.forEach(function (k) { if (k.id !== 'services') k.produits.forEach(function (p) { PROD.push({ id: p[0], libelle: p[1], prix: p[2], cat: k.nom }); }); });
  /* Stock : livraison au début, un transfert entre stands */
  var arts = {}; PROD.forEach(function (p) { arts[p.id] = { libelle: p.libelle, categorie: p.cat }; });
  var liv1 = {}, liv2 = {}, tr = {};
  PROD.forEach(function (p) { liv1[p.id] = p.prix >= 10 ? 30 : 200; liv2[p.id] = p.prix >= 10 ? 15 : 120; });
  tr.biere = 24; tr.eau = 24;
  var t0 = demoIso(start) + 'T09:00:00', stockId = 'evenement-demo';
  var stock = { format: 'agri-garden-caisse/stock', formatVersion: 1, id: stockId, nom: 'Événement démo', creeLe: t0, majLe: t0, majPar: 'Admin',
    depot: { id: 'depot', nom: 'Réserve' }, stands: { pdv1: { nom: PDV[0].nom }, pdv2: { nom: PDV[1].nom } }, articles: arts,
    mouvements: {
      m1: { type: 'livraison', date: demoIso(start), stand: 'pdv1', lignes: liv1, creeLe: t0, source: 'admin' },
      m2: { type: 'livraison', date: demoIso(start), stand: 'pdv2', lignes: liv2, creeLe: t0, source: 'admin' },
      m3: { type: 'transfert', date: days[1], de: 'pdv1', vers: 'pdv2', lignes: tr, creeLe: days[1] + 'T12:30:00', source: 'admin' }
    } };
  demoPut(db, DEMO_SALES_REPO, 'sapin/stock/' + stockId + '.json', JSON.stringify(stock, null, 1) + '\n');
  /* Ventes et caisse : deux jours, deux stands */
  days.forEach(function (day, di) {
    PDV.forEach(function (pl, pi) {
      var n = (pi ? 22 : 38) + Math.floor(rnd() * 10), ventes = [], cash = 0, banc = 0, tir = [];
      var last = 18;
      for (var i = 0; i < n; i++) {
        var tm = 600 + Math.floor((480 * (i + rnd() * 0.8)) / n), hor = day + 'T' + String(Math.floor(tm / 60)).padStart(2, '0') + ':' + String(tm % 60).padStart(2, '0') + ':' + String(Math.floor(rnd() * 60)).padStart(2, '0');
        var lignes = [], nl = 1 + Math.floor(rnd() * 3), used = {};
        for (var j = 0; j < nl; j++) {
          var p = pick(PROD); if (used[p.id]) continue; used[p.id] = 1;
          var q = p.prix >= 10 ? 1 : 1 + Math.floor(rnd() * 3);
          lignes.push({ produitId: p.id, categorie: p.cat, libelle: p.libelle, articleLibre: false, prixUnitaire: p.prix, quantite: q, remise: null, total: r2(p.prix * q) });
        }
        var CLI = [['Dupont Marie', 'Rue des Lilas 12, 1000 Bruxelles', '0471 23 45 67'], ['Martin Paul', 'Avenue du Parc 3, 5000 Namur', '0485 11 22 33'], ['Leroy Sophie', 'Chaussée de Wavre 140, 1050 Ixelles', '0496 98 76 54']];
        var withLiv = pi === 0 && (i === 4 || i === 15 || i === 27), cli = CLI[(i + di) % 3];
        if (withLiv) lignes.push({ produitId: LIV.id, categorie: LIV.cat, libelle: LIV.libelle, articleLibre: false, prixUnitaire: LIV.prix, quantite: 1, remise: null, total: LIV.prix });
        var tot = r2(lignes.reduce(function (a, l) { return a + l.total; }, 0)), remT = null;
        if (i % 17 === 5) { remT = { type: 'pourcentage', valeur: 10 }; tot = r2(Math.round(tot * 0.9 * 20) / 20); }
        var mode = rnd() < 0.55 ? 'cash' : 'bancontact', pay = { mode: mode, cash: mode === 'cash' ? tot : 0, bancontact: mode === 'cash' ? 0 : tot };
        var id = pl.id + '-' + day.replace(/-/g, '') + '-' + String(i + 1).padStart(4, '0');
        var fac = (i === 8 || i === 20) && pi === 0 ? { societe: i === 8 ? 'Jardin SA' : 'Événements Plus SRL', adresse: i === 8 ? 'Rue Haute 1, 5000 Namur' : 'Boulevard Central 20, 1000 Bruxelles', tva: i === 8 ? 'BE 0123.456.789' : 'BE 0987.654.321', email: i === 8 ? 'compta@jardin.be' : 'factures@evenements-plus.be', payee: i === 8, horodatage: hor } : null;
        if (fac && !fac.payee) pay = { mode: 'a-facturer', cash: 0, bancontact: 0 };
        var v = { id: id, horodatage: hor, pointDeVente: { id: pl.id, nom: pl.nom }, lignes: lignes, sousTotal: r2(lignes.reduce(function (a, l) { return a + l.total; }, 0)), remiseTicket: remT, total: tot, paiement: pay };
        if (withLiv) v.livraison = { nom: cli[0], adresse: cli[1], telephone: cli[2] };
        if (fac) v.facture = fac;
        if (i === 9 && di === 0) v.annulation = { horodatage: hor.slice(0, 14) + '59:00', motif: 'Erreur de saisie' };
        else { cash += pay.cash; banc += pay.bancontact; }
        if (pay.mode === 'cash') tir.push({ horodatage: hor, motif: 'Vente', venteId: id });
        ventes.push(v);
      }
      tir.push({ horodatage: day + 'T14:05:00', motif: 'Faire de la monnaie', venteId: null });
      var valid = ventes.filter(function (v) { return !v.annulation; });
      var nonPaye = r2(valid.filter(function (v) { return v.paiement.mode === 'a-facturer'; }).reduce(function (a, v) { return a + v.total; }, 0));
      var file = { format: 'agri-garden-caisse/ventes', formatVersion: 1, date: day, pointDeVente: { id: pl.id, nom: pl.nom }, catalogueVersion: 1,
        miseAJour: day + 'T' + String(last).padStart(2, '0') + ':30:00', nombreVentes: valid.length, nombreAnnulations: ventes.length - valid.length,
        totalJournee: r2(cash + banc + nonPaye), totalCash: r2(cash), totalBancontact: r2(banc), totalNonPaye: nonPaye, nombreAFacturer: valid.filter(function (v) { return v.facture; }).length, ouverturesTiroir: tir, nombreOuverturesSansVente: 1, caisse: null, ventes: ventes };
      demoPut(db, DEMO_SALES_REPO, 'sapin/' + day + '_' + pl.id + '_' + pl.nom.toLowerCase().replace(/\s+/g, '-') + '_demo.json', JSON.stringify(file, null, 1) + '\n');
      /* fichier de caisse : fond, retrait, et comptage la veille */
      var fond = 150, ent = {
        f1: { type: 'fond', montant: fond, detail: null, horodatage: day + 'T09:45:00', source: 'admin' },
        r1: { type: 'retrait', montant: 100, motif: 'Dépôt au coffre', detail: null, horodatage: day + 'T15:00:00', source: 'caisse', appareil: 'demo' }
      };
      if (true) {
        var att = r2(fond + cash - 100), compte = r2(att - (pi ? 0 : 2.5));
        ent.c1 = { type: 'comptage', montant: compte, detail: null, horodatage: day + 'T18:30:00', source: 'caisse', appareil: 'demo', attendu: att, ecart: r2(compte - att), laisse: fond, recette: r2(compte - fond), attenduApres: fond };
      }
      var cx = { format: 'agri-garden-caisse/caisse', formatVersion: 1, date: day, pointDeVente: { id: pl.id, nom: pl.nom }, creeLe: day + 'T09:45:00', majLe: day + 'T18:30:00', majPar: 'Admin', entrees: ent };
      demoPut(db, DEMO_SALES_REPO, 'sapin/caisse/' + day + '_' + pl.id + '.json', JSON.stringify(cx, null, 1) + '\n');
    });
  });
  /* Commandes de clients (année en cours) */
  var yr = String(today.getFullYear()), cmd = { format: 'agri-garden-caisse/commandes', formatVersion: 1, annee: yr, majLe: days[1] + 'T18:00:00', commandes: {} };
  function cmdAdd(n, nom, tel, mode, lieu, dj, lignes, paye, st, note) {
    var d = new Date(today); d.setDate(today.getDate() + dj); var dt = demoIso(d), id = 'c' + n;
    var L = lignes.map(function (x) { var p = PROD.filter(function (q) { return q.id === x[0]; })[0]; return { produitId: p.id, libelle: p.libelle, prixUnitaire: p.prix, quantite: x[1], total: r2(p.prix * x[1]) }; });
    var tot = r2(L.reduce(function (a, l) { return a + l.total; }, 0));
    cmd.commandes[id] = { id: id, numero: n, creeLe: days[0] + 'T10:0' + n + ':00', source: 'admin', client: { nom: nom, tel: tel, email: '' }, mode: mode,
      livraison: mode === 'livraison' ? { adresse: lieu, date: dt, creneau: '14h-16h' } : null, retrait: mode === 'retrait' ? { stand: { id: lieu, nom: lieu === 'pdv1' ? PDV[0].nom : PDV[1].nom }, date: dt } : null,
      lignes: L, total: tot, paye: { montant: paye, mode: paye > 0 ? 'bancontact' : '' }, statut: st, note: note || '', historique: [{ statut: st, le: days[0] + 'T10:00:00' }] };
  }
  cmdAdd(1, 'Lambert Julie', '0472 10 20 30', 'livraison', 'Rue de la Gare 8, 1300 Wavre', 1, [['tshirt', 4], ['casquette', 2]], 0, 'a-preparer', 'Sonner deux fois');
  cmdAdd(2, 'Club de foot Les Aigles', '0478 55 66 77', 'retrait', 'pdv1', 0, [['biere', 48], ['soft', 24], ['chips', 30]], 100, 'prete');
  cmdAdd(3, 'Renard Thomas', '0499 01 02 03', 'livraison', 'Place communale 2, 5190 Spy', 2, [['gobelet', 50], ['vin', 12]], 98, 'a-preparer');
  cmdAdd(4, 'Mercier Anne', '0470 44 33 22', 'retrait', 'pdv2', -1, [['gaufre', 10]], 35, 'livree');
  demoPut(db, DEMO_SALES_REPO, 'sapin/commandes/' + yr + '.json', JSON.stringify(cmd, null, 1) + '\n');
  /* Soirée à tickets : catalogue et liste de préventes pour ce soir */
  var sc = JSON.parse(JSON.stringify(DEMO_SOIREE_CAT)); sc.date = demoIso(today);
  demoPut(db, 'demo/soiree', 'catalogue.json', JSON.stringify(sc, null, 1) + '\n');
  var csv = 'control;cout;paye;reference;date\n', ref = demoIso(today).replace(/-/g, '');
  ['0a1b2c3d4e5f60718293a4b5c6d7e8f9', '1111aaaa2222bbbb3333cccc4444dddd', '9f8e7d6c5b4a39281706f5e4d3c2b1a0', 'abcdefabcdefabcdefabcdefabcdef01', '00112233445566778899aabbccddeeff']
    .forEach(function (c, i) { csv += c + ';' + (i === 3 ? 24 : 12) + ';' + (i === 4 ? 'NULL' : '1') + ';' + ref + ';' + today.getDate() + '\n'; });
  demoPut(db, DEMO_SALES_REPO, 'preventes/billetterie-demo.csv', csv);
  /* Comptage du stock d'événement */
  var sid = 'stock-evenement-' + days[0], sart = [['fut', 'Bière (fût)', 'fûts', 'Boissons'], ['soft', 'Softs', 'caisses', 'Boissons'], ['vin', 'Vin', 'bouteilles', 'Boissons'], ['gob', 'Gobelets', 'cartons', 'Matériel']];
  var sdoc = { format: 'admin/stock', formatVersion: 1, id: sid, nom: 'Stock événement', debut: days[0], statut: 'ouvert', creeLe: days[0] + 'T08:00:00', clotureLe: null, majLe: days[1] + 'T23:00:00',
    articles: sart.map(function (a) { return { id: a[0], nom: a[1], unite: a[2], categorie: a[3], actif: true }; }),
    stockInitial: { fut: 10, soft: 20, vin: 48, gob: 6 },
    jours: {} };
  sdoc.jours[days[0]] = { livraisons: { fut: 4 }, restant: { fut: 7, soft: 12, vin: 30, gob: 4 } };
  sdoc.jours[days[1]] = { livraisons: { soft: 10 }, restant: { fut: 2, soft: 11, vin: 14, gob: 3 } };
  demoPut(db, 'demo/admin-donnees', 'stock/' + sid + '.json', JSON.stringify(sdoc, null, 1) + '\n');
  if (keepTh) { try { var kt = JSON.parse(keepTh); kt.pending = false; kt.err = null; kt.version = kt.version || 1; localStorage.setItem(KP + 'admin-apparence', JSON.stringify(kt)); demoPut(db, DEMO_CAT_REPO, 'theme.json', JSON.stringify(themeFile(kt.t, kt.version), null, 1) + '\n'); } catch (e) {} }
  /* réglage des fonctionnalités gardé : republié pour les caisses */
  if (keepCfg) { try { var kc = JSON.parse(keepCfg); kc.pending = false; kc.err = null; var cf = featFile(kc, kc.version || 1); kc.version = cf.version; kc.publieLe = cf.majLe; localStorage.setItem(KP + 'admin-config', JSON.stringify(kc)); demoPut(db, DEMO_CAT_REPO, 'config.json', JSON.stringify(cf, null, 1) + '\n'); } catch (e) {} }
  demoDbSave(db);
}

/* ---------- Fonctionnalités activables (Admin › Paramètres) ----------
   Réglage rangé à côté des données de démo (clé demo-config) : l'Admin l'écrit, la Caisse et la Caisse Soirée le lisent
   à chaque affichage. Dépendances : une option « fille » est coupée quand sa « mère » est coupée. */
/* Le réglage est PUBLIÉ par l'Admin dans config.json, à côté de catalogue.json (dépôt de la caisse) ; chaque app en garde
   une copie (clé propre) : l'Admin = dernier réglage (avec « pending » tant qu'il n'est pas publié), la Caisse = dernier
   config.json lu (au démarrage, toutes les 30 s, au retour sur l'app, ⋮ › Vérifier le catalogue). Hors ligne : la copie sert. */
var FEAT_KEY = KP + APP_ID + '-config', CONFIG_FMT = 'caisse/config';
var FEATURES = [
  { id: 'vente', nom: 'Vente', items: [
    { id: 'articleLibre', nom: 'Article libre', desc: 'Libellé et prix tapés à la main sur la caisse.' },
    { id: 'raccourci', nom: 'Raccourci vers un article', desc: 'Bouton à côté des catégories ; « Article libre » passe alors dans le menu ⋮.', off: true },
    { id: 'remiseLigne', nom: 'Remise sur une ligne', desc: 'En % ou en € sur un article du panier.' },
    { id: 'remiseTicket', nom: 'Remise sur le ticket', desc: 'Bouton « Remise ticket » dans le panier.' },
    { id: 'codePatron', nom: 'Remise ticket sécurisée', desc: 'Menu ⋮ › Remise ticket, après saisie d’un code à 4 chiffres. Le code se change dans Paramètres › Sécurité (1234 par défaut).', off: true },
    { id: 'arrondi', nom: 'Arrondi à 5 cents', desc: 'Le total est arrondi aux 5 cents supérieurs.' } ] },
  { id: 'cmdliv', nom: 'Commandes, livraisons et factures', items: [
    { id: 'commandes', nom: 'Gestion des commandes', desc: 'Commandes de clients (livraison ou retrait sur un stand), statuts, reste à payer, export (Admin).' },
    { id: 'commandesCaisse', nom: 'Retrait des commandes au stand', desc: 'Onglet Commandes sur la caisse : commandes à retirer à ce stand, encaissement du reste à payer, remise au client.', req: 'commandes' },
    { id: 'commandesStock', nom: 'Commandes retirées du stock', desc: 'Une commande en livraison est retirée du stand de stockage, une commande en retrait du stand choisi (dès son enregistrement).', req: 'commandes' },
    { id: 'livraison', nom: 'Livraison à domicile', desc: 'Bouton Livraison sur la caisse avec nom, adresse et téléphone, ticket vendeur ; aussi après coup depuis l’Historique.' },
    { id: 'gestionLivraisons', nom: 'Gestion des livraisons', desc: 'Liste des livraisons à faire, statut À livrer / Livrée, liste pour le livreur (Admin).', req: 'livraison' },
    { id: 'facture', nom: 'Gestion des factures', desc: 'Bouton « À facturer » sur la caisse (payé ou non), encaissement plus tard ; onglet Factures de l’Admin (établie, payée par virement).' } ] },
  { id: 'paiement', nom: 'Paiement', items: [
    { id: 'bancontact', nom: 'Bancontact', desc: 'Sinon, paiement en cash uniquement.' },
    { id: 'mixte', nom: 'Paiement mixte', desc: 'Une partie en cash, le reste en Bancontact.', req: 'bancontact' } ] },
  { id: 'historique', nom: 'Historique sur la tablette', items: [
    { id: 'annulation', nom: 'Annulation d’une vente', desc: 'Avec un motif, depuis l’Historique.' },
    { id: 'export', nom: 'Export manuel des ventes du jour', desc: 'Téléchargement d’un fichier depuis le menu.' } ] },
  { id: 'imprimante', nom: 'Imprimante et tiroir', items: [
    { id: 'imprimante', nom: 'Impression du ticket', desc: 'Ticket, duplicata et aperçu (imprimante Epson Wi-Fi).' },
    { id: 'tiroir', nom: 'Tiroir-caisse', desc: 'Ouverture à l’encaissement, ouverture sans vente avec motif, journal.', req: 'imprimante' } ] },
  { id: 'caisse', nom: 'Caisse du jour', items: [
    { id: 'fond', nom: 'Fond de caisse', desc: 'Demandé à l’ouverture ; onglet Caisse de l’Admin.' },
    { id: 'mouvements', nom: 'Retraits et ajouts d’argent', desc: '', req: 'fond' },
    { id: 'decompte', nom: 'Décompte final', desc: 'Au total ou en billets et pièces, avec l’écart.', req: 'fond' } ] },
  { id: 'stock', nom: 'Stock', items: [
    { id: 'stock', nom: 'Stock par stand', desc: 'Livraisons, transferts et restant par stand (Admin).' },
    { id: 'stockTablette', nom: 'Stock du stand sur la tablette', desc: '', req: 'stock' },
    { id: 'reception', nom: 'Réception de stock sur la tablette', desc: 'Articles venus d’un autre stand.', req: 'stock' },
    { id: 'restantTuiles', nom: 'Restant affiché sur les tuiles', desc: '', req: 'stock' } ] },
  { id: 'catalogue', nom: 'Catalogue', items: [
    { id: 'multiPdv', nom: 'Plusieurs points de vente', desc: 'Sinon, un seul point de vente, choisi d’office.' },
    { id: 'prefixe', nom: 'Préfixe de catégorie dans le libellé', desc: 'Ex. « Boissons Eau » sur le ticket.' } ] },
  { id: 'suivi', nom: 'Suivi des ventes', items: [
    { id: 'envoiAuto', nom: 'Envoi automatique des ventes', desc: 'Sinon, transfert par fichier exporté.' },
    { id: 'historiqueAdmin', nom: 'Historique de vente (Admin)', desc: '' } ] },
  { id: 'options', nom: 'Modules en option', items: [
    { id: 'stockEvenement', nom: 'Comptage du stock d’événement', desc: 'Stock de départ, livraisons et restant compté chaque jour, alerte de stock bas.', off: true },
    { id: 'soiree', nom: 'Soirée à tickets', desc: 'Entrées, cartes à cases, boissons en cases et préventes (app Caisse Soirée).', off: true } ] }
];
var FEAT_DEF = {}; FEATURES.forEach(function (g) { g.items.forEach(function (it) { FEAT_DEF[it.id] = it; }); });
var _featRaw = null, _featCfg = { f: {}, raccourciId: '' };
function featCfg() {
  var raw = null; try { raw = localStorage.getItem(FEAT_KEY); } catch (e) {}
  if (raw !== _featRaw) { _featRaw = raw; try { _featCfg = JSON.parse(raw) || {}; } catch (e) { _featCfg = {}; } if (!_featCfg.f) _featCfg.f = {}; }
  return _featCfg;
}
function featOwn(id) { var c = featCfg(), d = FEAT_DEF[id]; if (id === 'soiree' && CLIENT.type === 'simple') return false; if (c.f[id] != null) return !!c.f[id]; if (id === 'soiree') return CLIENT.type === 'soiree'; return !(d && d.off); }
function FEAT(id) {
  var d = FEAT_DEF[id]; if (!featOwn(id)) return false;
  if (d && d.req && !FEAT(d.req)) return false;
  if (id === 'raccourci' && !featCfg().raccourciId) return false;
  return true;
}
/* Contenu de config.json : toutes les fonctionnalités, valeur explicite */
function featFile(c, version) {
  var f = {}, d0 = FEAT_DEF; Object.keys(d0).forEach(function (id) { f[id] = c.f && c.f[id] != null ? !!c.f[id] : !d0[id].off; });
  return { format: CONFIG_FMT, formatVersion: 1, version: version, majLe: new Date().toISOString(), fonctionnalites: f, raccourciId: c.raccourciId || '', remiseCodeSha: c.remiseCodeSha || '', remiseCodeLe: c.remiseCodeLe || '' };
}
function featSave(c) { try { localStorage.setItem(FEAT_KEY, JSON.stringify(c)); return true; } catch (e) { return false; } }

/* ---------- Apparence (theme.json publié par l'Admin, à côté de catalogue.json) ----------
   Nom du commerce, couleurs, logo, coordonnées du ticket. Chaque app garde une copie (KP + app + '-apparence') :
   l'Admin = dernier réglage (pending tant qu'il n'est pas publié), les caisses = dernier theme.json lu. */
var THEME_FMT = 'caisse/theme', THEME_COPY = KP + APP_ID + '-apparence';
var THEME_DEF = { nom: 'Caisse', couleur: '#2F5D8A', accent: '#3A8DB0', logo: '',
  ticket: { activite: '', adresse: [], telephone: '', email: '', tva: '', site: '', merci: 'Merci et à bientôt !', mention: 'Ce ticket n’est pas une facture.' } };
var _thRaw = null, _thObj = null;
function themeCopy() {
  var raw = null; try { raw = localStorage.getItem(THEME_COPY); } catch (e) {}
  if (raw !== _thRaw || !_thObj) { _thRaw = raw; try { _thObj = JSON.parse(raw) || {}; } catch (e) { _thObj = {}; } }
  return _thObj;
}
var TH_FONTS = {
  systeme: { nom: 'Système', css: 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif' },
  moderne: { nom: 'Moderne', css: '"Avenir Next",Avenir,Montserrat,"Segoe UI","Helvetica Neue",Arial,sans-serif' },
  arrondie: { nom: 'Arrondie', css: 'ui-rounded,"SF Pro Rounded",Nunito,"Varela Round","Arial Rounded MT Bold",Quicksand,system-ui,sans-serif' },
  elegante: { nom: 'Élégante', css: '"Playfair Display",Didot,"Bodoni MT",Georgia,serif' },
  classique: { nom: 'Classique', css: '"Palatino Linotype","Book Antiqua",Palatino,"Noto Serif",Georgia,serif' },
  condensee: { nom: 'Condensée', css: '"Roboto Condensed","Arial Narrow","sans-serif-condensed","Helvetica Neue",sans-serif' },
  machine: { nom: 'Machine à écrire', css: '"Courier Prime","Courier New",ui-monospace,monospace' },
  manuscrite: { nom: 'Manuscrite', css: '"Segoe Print","Bradley Hand","Dancing Script","Brush Script MT",cursive' },
  affiche: { nom: 'Affiche', css: 'Impact,Anton,Haettenschweiler,"Arial Black",sans-serif' }
};
/* Modèles prêts à l'emploi : couleurs, polices, formes (le logo, le nom, le ticket, les catégories et les photos ne changent pas) */
var TH_MODELES = [
  { id: 'ardoise', nom: 'Ardoise (sombre)', mode: 'sombre', couleur: '#5B8DEF', accent: '#F2B64C', fond: '', barre: '', tuile: '', police: 'moderne', policeTitres: 'moderne', forme: 'arrondi', ombre: false },
  { id: 'lounge', nom: 'Lounge (sombre)', mode: 'sombre', couleur: '#D4A657', accent: '#9B6FD0', fond: '', barre: '', tuile: '', police: 'moderne', policeTitres: 'elegante', forme: 'carre', ombre: true },
  { id: 'classique', nom: 'Classique', couleur: '#2F5D8A', accent: '#3A8DB0', fond: '#F5F7FA', barre: '#FFFFFF', tuile: '#FFFFFF', police: 'systeme', policeTitres: 'systeme', forme: 'arrondi', ombre: false },
  { id: 'nature', nom: 'Bois et nature', couleur: '#4F6F3A', accent: '#B5835A', fond: '#F4F0E8', barre: '#3E3226', tuile: '#FFFDF8', police: 'moderne', policeTitres: 'classique', forme: 'arrondi', ombre: true },
  { id: 'nuit', nom: 'Nuit élégante', couleur: '#B08D57', accent: '#7A5C99', fond: '#EFEDE8', barre: '#14161C', tuile: '#FFFFFF', police: 'moderne', policeTitres: 'elegante', forme: 'carre', ombre: true },
  { id: 'pop', nom: 'Pop coloré', couleur: '#E4405F', accent: '#FFB400', fond: '#FFF6EC', barre: '#E4405F', tuile: '#FFFFFF', police: 'arrondie', policeTitres: 'arrondie', forme: 'pastille', ombre: true },
  { id: 'minimal', nom: 'Minimal', couleur: '#111111', accent: '#666666', fond: '#FFFFFF', barre: '#FFFFFF', tuile: '#F6F6F6', police: 'systeme', policeTitres: 'moderne', forme: 'carre', ombre: false },
  { id: 'marche', nom: 'Marché', couleur: '#2E7D32', accent: '#F57C00', fond: '#FBF8EF', barre: '#2E7D32', tuile: '#FFFFFF', police: 'arrondie', policeTitres: 'affiche', forme: 'arrondi', ombre: true },
  { id: 'ocean', nom: 'Océan', couleur: '#006D77', accent: '#E29578', fond: '#EDF6F9', barre: '#006D77', tuile: '#FFFFFF', police: 'moderne', policeTitres: 'moderne', forme: 'pastille', ombre: false },
  { id: 'bistrot', nom: 'Bistrot', couleur: '#7B2D26', accent: '#C9A227', fond: '#F7F1E3', barre: '#2B2118', tuile: '#FFFBF2', police: 'classique', policeTitres: 'manuscrite', forme: 'arrondi', ombre: true }
];
function thHex(v, def) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v : def; }
function themeGet() {
  var t = themeCopy().t || {}, d = THEME_DEF, tk = t.ticket || {}, af = tk.afficher || {}, sb = t.sombre || {};
  return { nom: (t.nom || '').trim() || d.nom, couleur: thHex(t.couleur, d.couleur), accent: thHex(t.accent, d.accent), logo: t.logo || '',
    onglet: ['logo', 'client', 'image'].indexOf(t.onglet) >= 0 ? t.onglet : 'defaut', ongletImage: t.ongletImage || '', modele: t.modele || '', mode: t.mode === 'sombre' ? 'sombre' : 'clair', fond: thHex(t.fond, ''), barre: thHex(t.barre, ''), tuile: thHex(t.tuile, ''),
    police: TH_FONTS[t.police] ? t.police : 'systeme', policeTitres: TH_FONTS[t.policeTitres] ? t.policeTitres : (TH_FONTS[t.police] ? t.police : 'systeme'),
    forme: ['carre', 'pastille'].indexOf(t.forme) >= 0 ? t.forme : 'arrondi', ombre: !!t.ombre, densite: t.densite === 'compacte' ? 'compacte' : 'normale',
    fondImage: t.fondImage || '', voile: Math.max(0, Math.min(85, +(t.voile != null ? t.voile : 35) || 0)),
    sombre: { couleur: thHex(sb.couleur, ''), fond: thHex(sb.fond, '') }, categories: t.categories && typeof t.categories === 'object' ? t.categories : {}, photosVersion: +t.photosVersion || 0,
    ticket: { activite: tk.activite || '', adresse: Array.isArray(tk.adresse) ? tk.adresse.filter(function (x) { return x && String(x).trim(); }) : [], telephone: tk.telephone || '', email: tk.email || '', tva: tk.tva || '', site: tk.site || '',
      merci: tk.merci != null ? tk.merci : d.ticket.merci, mention: tk.mention != null ? tk.mention : d.ticket.mention,
      logo: tk.logo || '', logoTaille: ['aucun', 'petit', 'grand'].indexOf(tk.logoTaille) >= 0 ? tk.logoTaille : 'moyen', entete: tk.entete === 'gauche' ? 'gauche' : 'centre', nomGrand: !!tk.nomGrand,
      separateur: ['-', '.', '=', '*', '~'].indexOf(tk.separateur) >= 0 ? tk.separateur : '-', papier: tk.papier === '58' ? '58' : '80',
      afficher: { numero: af.numero !== false, date: af.date !== false, pdv: af.pdv !== false, nbArticles: af.nbArticles !== false, paiement: af.paiement !== false, rendu: af.rendu !== false },
      tauxTVA: Math.max(0, +tk.tauxTVA || 0), messageEntete: tk.messageEntete || '', saison: tk.saison || '', saisonDu: tk.saisonDu || '', saisonAu: tk.saisonAu || '', qr: tk.qr || '', qrTexte: tk.qrTexte || '' } };
}
/* Message saisonnier : dates JJ/MM (ou MM-JJ), période qui peut passer le 31/12 */
function themeSaisonActive(tk, now) {
  if (!tk.saison) return false; if (!tk.saisonDu || !tk.saisonAu) return true;
  function md(v) { var m = /^(\d{1,2})[\/.-](\d{1,2})$/.exec(String(v).trim()); return m ? (+m[2]) * 100 + (+m[1]) : null; }
  var a = md(tk.saisonDu), b = md(tk.saisonAu), d = now || new Date(), x = (d.getMonth() + 1) * 100 + d.getDate(); if (a == null || b == null) return true;
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}
function thLum(h) { var c = thRgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function thContrast(a, b) { var x = thLum(a), y = thLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function thInk(bg) { return thContrast(bg, '#ffffff') >= thContrast(bg, '#111111') ? '#ffffff' : '#111111'; }
function themeCatStyle(cid) { var c = (themeGet().categories || {})[cid] || {}; return /^#[0-9a-f]{6}$/i.test(c.couleur || '') ? c.couleur : ''; }
function themeCatEmoji(cid) { var c = (themeGet().categories || {})[cid] || {}; return c.emoji ? String(c.emoji).slice(0, 4) + ' ' : ''; }
/* Photos des articles : photos.json à part (lu seulement quand theme.json annonce une nouvelle version) */
var PHOTOS_COPY = KP + APP_ID + '-photos', _phRaw = null, _phObj = null;
function photosCopy() { var raw = null; try { raw = localStorage.getItem(PHOTOS_COPY); } catch (e) {} if (raw !== _phRaw || !_phObj) { _phRaw = raw; try { _phObj = JSON.parse(raw) || {}; } catch (e) { _phObj = {}; } } return _phObj; }
function photosSaveCopy(o) { try { localStorage.setItem(PHOTOS_COPY, JSON.stringify(o)); } catch (e) { return false; } _phRaw = null; return true; }
function themePhoto(pid) { var p = (photosCopy().photos || {})[pid]; return p || ''; }
function photosCheck(onChange) {
  var want = themeGet().photosVersion; if (APP_ID === 'admin' || !want || want === (photosCopy().version || 0)) return;
  fetch('photos.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.photos) return; photosSaveCopy({ photos: j.photos, version: +j.version || want }); if (onChange) onChange();
  }).catch(function () {});
}
function themeSaveCopy(o) { try { localStorage.setItem(THEME_COPY, JSON.stringify(o)); } catch (e) { return false; } _thRaw = null; return true; }
function themeFile(t, version) { return { format: THEME_FMT, formatVersion: 1, version: version, majLe: new Date().toISOString(), apparence: t || {} }; }
function thRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function thMix(a, b, t) { var x = thRgb(a), y = thRgb(b); return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join(''); }
function thEsc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var TH_ICON = '<g fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"><rect x="14" y="40" width="72" height="44" rx="8"/><path d="M26 40V22h48v18"/><path d="M34 30h32"/><path d="M28 58h12M48 58h12M28 70h12M48 70h12"/><path d="M68 58h6v12h-6z"/></g>';
function thSvg(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
/* kind : 'full' (accueil, grand), 'print' (ticket : noir sur blanc), 'text' (barre du haut), 'square' (carré), 'dark' (grand, sur fond sombre) */
function themeLogo(kind) {
  var t = themeGet(); if (kind === 'ticket') { if (t.ticket.logo) return t.ticket.logo; kind = 'print'; } if (t.logo) return t.logo;
  var n = thEsc(t.nom), sub = thEsc(t.ticket.activite || ''), c = kind === 'print' ? '#000' : kind === 'dark' ? thMix(t.couleur, '#ffffff', .35) : t.couleur, ink = kind === 'print' ? '#000' : kind === 'dark' ? '#EEF2F7' : t.couleur;
  if (kind === 'square') return thSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="' + t.couleur + '"/>' + TH_ICON.replace('{c}', '#fff') + '</svg>');
  if (kind === 'text' && t.mode === 'sombre' && !t.barre) { c = t.sombre.couleur || thMix(t.couleur, '#ffffff', .45); ink = c; }
  if (kind === 'text' && t.barre && thContrast(c, t.barre) < 3) { c = thInk(t.barre); ink = c; }
  if (kind === 'text') return thSvg('<svg xmlns="http://www.w3.org/2000/svg" height="100" width="' + (130 + n.length * 27) + '" viewBox="0 0 ' + (130 + n.length * 27) + ' 100">' + TH_ICON.replace('{c}', c) + '<text x="104" y="66" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="700" fill="' + ink + '">' + n + '</text></svg>');
  var w = Math.max(900, 300 + n.length * 50);
  return thSvg('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="220" viewBox="0 0 ' + w + ' 220">' + (kind === 'print' ? '<rect width="' + w + '" height="220" fill="#fff"/>' : '') + '<g transform="translate(40,10) scale(2)">' + TH_ICON.replace('{c}', c) + '</g><text x="270" y="' + (sub ? 128 : 140) + '" font-family="Arial,Helvetica,sans-serif" font-size="84" font-weight="700" fill="' + ink + '">' + n + '</text>' + (sub ? '<text x="274" y="178" font-family="Arial,Helvetica,sans-serif" font-size="34" fill="' + ink + '">' + sub + '</text>' : '') + '</svg>');
}
/* Couleurs : variables CSS de chaque app, recalculées depuis la couleur principale et l'accent */
function themeApply() {
  var t = themeGet(), c = t.couleur, a = t.accent, css = '', light = '', dark = '';
  if (APP_ID === 'caisse') {
    light = '--green:' + c + ';--green-d:' + thMix(c, '#000000', .3) + ';--accent:' + a + ';--tint:' + thMix(c, '#ffffff', .9);
    dark = '--green:' + thMix(c, '#ffffff', .45) + ';--green-d:' + thMix(c, '#ffffff', .7) + ';--accent:' + thMix(a, '#ffffff', .3) + ';--tint:' + thMix(c, '#000000', .75) + ';--on-green:#0E141B';
    css = 'html:root{' + light + '}html:root[data-theme="dark"]{' + dark + '}';
  } else if (APP_ID === 'admin') {
    light = '--green:' + c + ';--green-d:' + thMix(c, '#000000', .35) + ';--gold:' + a + ';--gold-soft:' + thMix(a, '#ffffff', .88) + ';--band:' + thMix(c, '#000000', .78) + ';--band-line:' + thMix(c, '#000000', .6) + ';--s1:' + a + ';--s2:' + c;
    dark = '--green:' + thMix(c, '#ffffff', .45) + ';--green-d:' + thMix(c, '#ffffff', .7) + ';--gold:' + thMix(a, '#ffffff', .3) + ';--gold-soft:' + thMix(a, '#000000', .75) + ';--band:' + thMix(c, '#000000', .88) + ';--band-line:' + thMix(c, '#000000', .72) + ';--s1:' + thMix(a, '#ffffff', .3) + ';--s2:' + thMix(c, '#ffffff', .45);
    css = 'html:root{' + light + '}@media (prefers-color-scheme:dark){html:root:not([data-theme="light"]){' + dark + '}}html:root[data-theme="dark"]{' + dark + '}';
  } else {
    css = 'html:root{--gold:' + thMix(c, '#ffffff', .3) + ';--gold-l:' + thMix(c, '#ffffff', .55) + '}';
  }
  /* couleurs fines, mode sombre personnalisé, polices, formes, fond d'écran */
  var sb = t.sombre, F = TH_FONTS[t.police].css, FT = TH_FONTS[t.policeTitres].css, R = document.documentElement;
  if (APP_ID === 'caisse') {
    css += 'html:root{' + (t.fond ? '--ground:' + t.fond + ';' : '') + (t.tuile ? '--surface:' + t.tuile + ';' : '') + '}';
    if (t.barre) css += 'html:root:not([data-theme="dark"]) .header{background:' + t.barre + ';color:' + thInk(t.barre) + '}html:root:not([data-theme="dark"]) .header .sub,html:root:not([data-theme="dark"]) .header small{color:' + thInk(t.barre) + ';opacity:.8}';
    if (sb.couleur || sb.fond) css += 'html:root[data-theme="dark"]{' + (sb.couleur ? '--green:' + sb.couleur + ';--green-d:' + thMix(sb.couleur, '#ffffff', .4) + ';--on-green:' + thInk(sb.couleur) + ';' : '') + (sb.fond ? '--ground:' + sb.fond + ';--surface:' + thMix(sb.fond, '#ffffff', .06) + ';' : '') + '}';
    css += 'body,button,input,select,textarea{font-family:' + F + '}h1,h2,h3,.cat,.prod .m,.tabs button,.mt-l{font-family:' + FT + '}';
    css += '.prod{position:relative;overflow:hidden}.prod.ph{height:178px;padding-top:0}.prod .pph{width:calc(100% + 32px);margin:0 -16px 6px;height:84px;object-fit:cover;display:block}';
    if (t.fondImage) css += '#app>.center{background-image:linear-gradient(rgba(255,255,255,' + (t.voile / 100) + '),rgba(255,255,255,' + (t.voile / 100) + ')),url("' + t.fondImage + '");background-size:cover;background-position:center}html[data-theme="dark"] #app>.center{background-image:linear-gradient(rgba(0,0,0,' + (t.voile / 100) + '),rgba(0,0,0,' + (t.voile / 100) + ')),url("' + t.fondImage + '")}';
  } else if (APP_ID === 'admin') {
    css += 'html:root:not([data-theme="dark"]){' + (t.fond ? '--bg:' + t.fond + ';' : '') + (t.tuile ? '--surface:' + t.tuile + ';' : '') + (t.barre ? '--band:' + t.barre + ';--band-ink:' + thInk(t.barre) + ';--band-muted:' + thMix(thInk(t.barre), t.barre, .35) + ';--band-line:' + thMix(t.barre, thInk(t.barre), .18) + ';' : '') + '}';
    if (sb.couleur || sb.fond) css += 'html:root[data-theme="dark"]{' + (sb.couleur ? '--green:' + sb.couleur + ';--green-d:' + thMix(sb.couleur, '#ffffff', .4) + ';' : '') + (sb.fond ? '--bg:' + sb.fond + ';--surface:' + thMix(sb.fond, '#ffffff', .06) + ';' : '') + '}';
    css += 'html:root{--text:' + F + ';--display:' + FT + '}';
    if (t.fondImage) css += '.band{background-image:linear-gradient(rgba(0,0,0,' + (t.voile / 100) + '),rgba(0,0,0,' + (t.voile / 100) + ')),url("' + t.fondImage + '");background-size:cover;background-position:center}';
  } else {
    css += 'body,button,input,select,textarea{font-family:' + F + '}h1,h2,h3{font-family:' + FT + '}';
  }
  css += 'html.th-carre *:not(.cbadge):not(.dot):not(.sw){border-radius:3px!important}' +
    'html.th-pastille :is(button,.btn,.cat,.rchip,.small,.free,.apb,select,input[type=text],input[type=password],input[type=search]){border-radius:999px!important}html.th-pastille :is(.prod,.mtile,.mod,section,.card,.modal){border-radius:24px!important}' +
    'html.th-ombre :is(.prod,.mtile,.mod,section,.cat,.card,.evcard,.modal){box-shadow:0 4px 14px rgba(0,0,0,.10)!important}' + (APP_ID === 'caisse' ? 'html.th-compact body{zoom:.9}' : '');
  ['th-carre', 'th-pastille', 'th-ombre', 'th-compact'].forEach(function (k) { R.classList.remove(k); });
  if (t.forme !== 'arrondi') R.classList.add('th-' + t.forme); if (t.ombre) R.classList.add('th-ombre'); if (t.densite === 'compacte') R.classList.add('th-compact');
  var el = document.getElementById('theme-vars');
  if (!el) { el = document.createElement('style'); el.id = 'theme-vars'; document.head.appendChild(el); }
  el.textContent = css;
  document.title = APP_ID === 'admin' ? 'Admin · ' + t.nom : APP_ID === 'soiree' ? 'Caisse Soirée · ' + t.nom : t.nom;
  /* icône de l'onglet : Admin = logo du client (SuperAdmin) ; Caisse et Caisse Soirée = choix de l'Apparence */
  var ic = themeFavicon(), li = document.querySelector('link[rel="icon"]');
  if (ic) { if (!li) { li = document.createElement('link'); li.rel = 'icon'; document.head.appendChild(li); } if (!li.getAttribute('data-def')) li.setAttribute('data-def', li.getAttribute('href') || ''); li.setAttribute('href', ic); }
  else if (li && li.getAttribute('data-def') != null) li.setAttribute('href', li.getAttribute('data-def'));
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', APP_ID === 'caisse' ? c : thMix(c, '#000000', .78));
}
function themeFavicon() {
  var t = themeGet();
  if (APP_ID === 'admin') return CLIENT.logoClient || '';
  if (t.onglet === 'logo') return t.logo || themeLogo('square');
  if (t.onglet === 'client') return CLIENT.logoClient || '';
  if (t.onglet === 'image') return t.ongletImage || '';
  return '';
}
/* Coordonnées du ticket : recopiées dans l'objet TICKET de la caisse (référence gardée pour les mises à jour) */
var _thTicket = null;
function themeTicket(obj) {
  if (obj) _thTicket = obj; if (!_thTicket) return;
  var tk = themeGet().ticket; Object.keys(tk).forEach(function (k) { _thTicket[k] = tk[k]; });
}
/* Caisses : relire theme.json (comme config.json) ; onChange appelé si la version a changé */
function themeCheck(onChange) {
  if (APP_ID === 'admin' || navigator.onLine === false) return;
  fetch('theme.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (j) {
      var cur = themeCopy();
      if (!j || j.format !== THEME_FMT) { if (!j && cur.version) { themeSaveCopy({}); themeApply(); themeTicket(); if (onChange) onChange(); } return; }
      if (+j.version === cur.version) return;
      themeSaveCopy({ t: j.apparence || {}, version: +j.version }); themeApply(); themeTicket(); if (onChange) onChange();
    }).catch(function () {});
}
try { themeApply(); } catch (e) {}

/* Code de la remise ticket : empreinte SHA-256 de 'caisse-remise:<code>' (jamais le code), publiée dans config.json */
var REMISE_SHA_DEFAUT = '45edae630ded19020597081f0c2a8bce98de6ebf1f6f32422ec4ee761ac944bb'; // 1234
function remiseCodeSha() { return featCfg().remiseCodeSha || REMISE_SHA_DEFAUT; }

try { if (!localStorage.getItem(KP + 'admin-gh-token')) { localStorage.setItem(KP + 'admin-gh-token', 'demo'); localStorage.setItem(KP + 'admin-gh-tokens', '["demo"]'); } } catch (e) {}
var LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyMCIgZmlsbD0iIzJGNUQ4QSIvPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxyZWN0IHg9IjE0IiB5PSI0MCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjQ0IiByeD0iOCIvPjxwYXRoIGQ9Ik0yNiA0MFYyMmg0OHYxOCIvPjxwYXRoIGQ9Ik0zNCAzMGgzMiIvPjxwYXRoIGQ9Ik0yOCA1OGgxMk00OCA1OGgxMk0yOCA3MGgxMk00OCA3MGgxMiIvPjxwYXRoIGQ9Ik02OCA1OGg2djEyaC02eiIvPjwvZz48L3N2Zz4='; // Agri-Garden by Xavier Vaerman (icône de la Caisse)
var THEME_KEY = KP + 'admin-theme';
try { document.documentElement.setAttribute('data-theme', themeGet().mode === 'sombre' ? 'dark' : 'light'); } catch (e) {}

/* ---------- Données ---------- */
var FILES = [];            // {name, data, status, note}
var F = { soiree: null, bar: 'all', caisse: null };
/* Caisses lues par le Bilan (préfixe du format des exports) */
var CAISSES_BILAN = { 'caisse-bar/ventes': 'bar', 'agri-garden-caisse/ventes': 'sapin', 'chlorophylle-caisse/soiree': 'soiree' };
var CAISSE_LABEL = { bar: 'Caisse Bar', sapin: 'Caisse', soiree: 'Caisse Soirée' };
/* Article « Livraison » (ou « Frais de livraison ») : service, jamais déduit du stock, montré à part du chiffre d'affaires */
var LIV_RE = /(^|\s)(frais de )?livraison$/i;
/* Vente « à facturer » non payée (Caisse v36) : reste dû = total − cash − Bancontact ; 0 pour tout autre cas (anciens fichiers, mode inconnu) */
function vNonPaye(v) { if (!v) return 0; var p = v.paiement || {}, f = v.facture; if (!((f && typeof f === 'object' && f.payee === false) || p.mode === 'a-facturer')) return 0; var r = (+v.total || 0) - (+p.cash || 0) - (+p.bancontact || 0); return r > 0.004 ? Math.round(r * 100) / 100 : 0; }
function isLivLine(l) { return !!l && LIV_RE.test(String(l.libelle || '').trim()); }
function isLivProduct(p) { return !!p && /^(frais de )?livraison$/i.test(String(p.libelle || '').trim()); }
var CAISSE_OPEN = {};
function caisseOf(fmt) { return CAISSES_BILAN[fmt] || null; }
function okVentes(d) { var c = d && caisseOf(d.format); return !!c && (c === 'soiree' ? Array.isArray(d.enregistrements) : Array.isArray(d.ventes)); }
/* Trois Bilans séparés : « bar » (Bar › Bilan), « soiree » (Soirée démo › Bilan), « sapin » (Gestion d’événement › Bilan).
   Chacun garde ses fichiers, ses filtres et son panneau du dépôt ; render() active le bon (bilUse). */
var BIL_CUR = 'bar', BIL_ST = {};
var CTX_LABEL = { bar: 'Bar', soiree: 'Soirée démo', sapin: 'Gestion d’événement' };
function bilAllowed(c) { return [c || BIL_CUR]; }
function bilFresh() { return { FILES: [], F: { soiree: null, bar: 'all', caisse: null }, BGH: { open: false, loading: false, files: null, sel: {}, err: null, busy: false, tab: null }, DISMISSED: {} }; }
function bilUse(c) {
  if (c === BIL_CUR) return;
  BIL_ST[BIL_CUR] = { FILES: FILES, F: F, BGH: BGH, DISMISSED: DISMISSED };
  var st = BIL_ST[c] || bilFresh();
  FILES = st.FILES; F = st.F; BGH = st.BGH; DISMISSED = st.DISMISSED; BIL_CUR = c;
}
/* Exécute fn dans le contexte c (réponse arrivée après un changement de module), puis revient. */
function bilWith(c, fn) { var back = BIL_CUR; bilUse(c); try { fn(); } finally { bilUse(back); } }
function bilWrongNote(c) { return 'Ce fichier vient de la ' + (CAISSE_LABEL[c] || 'caisse ' + c) + ' : ouvrez-le dans ' + (CTX_LABEL[c] || '?') + ' › Bilan.'; }
var ERR_FORMAT = 'Ce fichier n\u2019est pas un export de ventes d\u2019une caisse (Caisse Bar, Caisse ou Caisse Soirée).';
function caisses() { var o = {}; FILES.forEach(function (f) { if (f.status === 'ok' && f.caisse) o[f.caisse] = 1; }); return bilAllowed().filter(function (c) { return o[c]; }); }
function defSoiree() { var ss = soirees(); return ss.length > 1 ? 'all' : ss[0] || null; }
function fixCaisse() { var cs = caisses(); if (!F.caisse || cs.indexOf(F.caisse) < 0) F.caisse = cs[0] || null; }
/* Vocabulaire : soirée et bar pour la Caisse Bar, journée et point de vente pour la Caisse */
function T() { if (F.caisse === 'soiree') return { per: 'Soirée', pers: 'soirées', toutes: 'Toutes les soirées', du: 'Soirée du', dela: 'la soirée du', pdv: 'Appareil', pdvs: 'appareils', par: 'Par appareil', inconnu: 'Appareil inconnu', tous: 'Tous' };
  return F.caisse === 'sapin' ? { per: 'Journée', pers: 'journées', toutes: 'Toutes les journées', du: 'Journée du', dela: 'la journée du', pdv: 'Point de vente', pdvs: 'points de vente', par: 'Par point de vente', inconnu: 'Point de vente inconnu', tous: 'Tous' } : { per: 'Soirée', pers: 'soirées', toutes: 'Toutes les soirées', du: 'Soirée du', dela: 'la soirée du', pdv: 'Bar', pdvs: 'bars', par: 'Par bar', inconnu: 'Bar inconnu', tous: 'Tous' }; }
var ART_VIEW = 'cat';      // 'cat' (par catégorie) ou 'top' (classement)
var toastMsg = '', toastT;

function r2(x) { return Math.round(x * 100) / 100; }
function money(x) { return (Math.round(x * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + '\u00a0€'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dParts(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function longDate(iso) { var d = dParts(iso); return d ? JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] : iso; }
function shortDate(iso) { var d = dParts(iso); return d ? JOURS[d.getDay()].slice(0, 3) + '. ' + d.getDate() + '/' + (d.getMonth() + 1) : iso; }
function hh(iso) { return +iso.slice(11, 13); }
/* Soirée = date de l'horodatage décalé de 6 h : une vente à 2 h compte dans la soirée de la veille */
var CUT = 6;
function soireeOf(iso) {
  var d = dParts(iso); if (hh(iso) < CUT) d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function slot0() { return F.caisse === 'sapin' ? 6 : F.caisse === 'soiree' ? 12 : 18; } // heure de la 1re colonne du graphique
function slot(iso) { var h = hh(iso); return (h - slot0() + 24) % 24; } // Caisse Bar : 0 = 18 h ... 23 = 17 h

/* ---------- Chargement ---------- */
function addFiles(list) {
  list = Array.prototype.slice.call(list || []);
  var pending = list.length; if (!pending) return;
  var ctx = BIL_CUR;
  Array.prototype.forEach.call(list, function (file) {
    var rd = new FileReader();
    rd.onload = function () {
      var entry = { name: file.name, data: null, status: 'err', note: '' };
      try {
        var d = JSON.parse(rd.result);
        if (!okVentes(d)) entry.note = ERR_FORMAT;
        else if (bilAllowed(ctx).indexOf(caisseOf(d.format)) < 0) entry.note = bilWrongNote(caisseOf(d.format));
        else { entry.data = d; entry.status = 'ok'; entry.caisse = caisseOf(d.format); }
      } catch (e) { entry.note = 'Fichier illisible (JSON invalide).'; }
      bilWith(ctx, function () { FILES.push(entry); });
      if (--pending === 0) { bilWith(ctx, function () { dedupe(); var lastOk = FILES.filter(function (f) { return f.status === 'ok'; }).pop(); if (lastOk && entry.status === 'ok') F.caisse = entry.caisse; fixCaisse(); F.soiree = defSoiree(); F.bar = 'all'; }); render(); toast(list.length + ' fichier' + (list.length > 1 ? 's' : '') + ' chargé' + (list.length > 1 ? 's' : '')); }
    };
    rd.readAsText(file);
  });
}
/* Un même bar et un même jour en double : on garde l'export le plus récent */
function dedupe() {
  var best = {};
  FILES.forEach(function (f) {
    if (!f.data) return;
    if (f.status === 'rep') f.status = 'ok';
    var k = fileDedupKey(f);
    if (!best[k] || (f.data.miseAJour || '') > (best[k].data.miseAJour || '')) best[k] = f;
  });
  FILES.forEach(function (f) {
    if (!f.data) return;
    var k = fileDedupKey(f);
    if (best[k] !== f) { f.status = 'rep'; f.note = f.caisse === 'soiree' ? 'Remplacé par un export plus récent du même appareil pour la même soirée (' + best[k].name + ').' : 'Remplacé par un export plus récent du même point de vente et du même jour (' + best[k].name + ').'; }
    else f.note = '';
  });
}
function fileDedupKey(f) {
  if (f.caisse === 'soiree') return 'soiree|' + (f.data.appareil && f.data.appareil.id) + '|' + f.data.soiree;
  return f.caisse + '|' + (f.data.pointDeVente && f.data.pointDeVente.id) + '|' + f.data.date;
}
function activeFiles() { fixCaisse(); return FILES.filter(function (f) { return f.status === 'ok' && f.caisse === F.caisse; }); }
function allSales() {
  var seen = {}, out = [];
  activeFiles().forEach(function (f) {
    var bar = f.data.pointDeVente || { id: '?', nom: T().inconnu };
    f.data.ventes.forEach(function (v) {
      if (!v || typeof v.horodatage !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}/.test(v.horodatage)) return; // vente incomplète : ignorée
      if (seen[v.id]) return; seen[v.id] = 1;
      var pv = v.pointDeVente || bar;
      out.push({ v: v, bar: pv.nom, barId: pv.id, soiree: soireeOf(v.horodatage) });
    });
  });
  return out;
}
function soirees() { var o = {}; if (F.caisse === 'soiree') { soirRecs().forEach(function (x) { o[x.night] = 1; }); return Object.keys(o).sort().reverse(); } allSales().forEach(function (s) { o[s.soiree] = 1; }); activeFiles().forEach(function (f) { if (f.data.date && hasCaisseData(f.data)) o[f.data.date] = 1; }); return Object.keys(o).sort().reverse(); }
function bars() { var o = {}; (F.caisse === 'soiree' ? soirRecs().map(function (x) { return { barId: x.apId, bar: x.apNom }; }) : allSales().concat(activeFiles().filter(function (f) { return f.data.pointDeVente && hasCaisseData(f.data); }).map(function (f) { return { barId: f.data.pointDeVente.id, bar: f.data.pointDeVente.nom || f.data.pointDeVente.id }; }))).forEach(function (s) { o[s.barId] = s.bar; }); return Object.keys(o).sort(function (a, b) { return o[a].localeCompare(o[b]); }).map(function (id) { return { id: id, nom: o[id] }; }); }
function filtered() {
  return allSales().filter(function (s) { return (F.soiree === 'all' || s.soiree === F.soiree) && (F.bar === 'all' || s.barId === F.bar); });
}

/* ---------- Calculs ---------- */
function stats(list) {
  var ok = list.filter(function (s) { return !s.v.annulation; }), ann = list.filter(function (s) { return s.v.annulation; });
  var S = { pre: 0, nCmd: 0, np: 0, vir: 0, nFact: 0, pay: {}, remRows: {}, liv: { n: 0, m: 0, na: 0, ma: 0, rows: {} }, n: ok.length, total: 0, cash: 0, bc: 0, mixte: 0, ann: ann, art: {}, cats: {}, hours: {}, perBar: {}, remLig: 0, nRemLig: 0, remTic: 0, nRemTic: 0, lignes: 0 };
  ok.forEach(function (s) {
    var v = s.v, p = v.paiement || { cash: 0, bancontact: 0 };
    var vt = +v.total || 0;
    S.total += vt; S.cash += p.cash || 0; S.bc += p.bancontact || 0; if (p.mode === 'mixte') S.mixte++;
    var b = S.perBar[s.barId] || (S.perBar[s.barId] = { nom: s.bar, n: 0, total: 0, cash: 0, bc: 0 });
    b.n++; b.total += vt; b.cash += p.cash || 0; b.bc += p.bancontact || 0;
    if (v.commande && typeof v.commande === 'object') { S.nCmd++; S.pre += Math.max(0, +v.commande.dejaPaye || 0); }
    var np = vNonPaye(v), vir = 0; if (np && fsGet(v.id, s.soiree).virement) { vir = np; np = 0; }
    S.np += np; S.vir += vir; b.np = (b.np || 0) + np; b.vir = (b.vir || 0) + vir; if (v.facture && typeof v.facture === 'object') S.nFact++;
    var pk = s.soiree + '|' + s.barId, pr = S.pay[pk] || (S.pay[pk] = { day: s.soiree, bar: s.bar, cash: 0, bc: 0, np: 0, vir: 0, total: 0, nFact: 0 });
    pr.cash += +p.cash || 0; pr.bc += +p.bancontact || 0; pr.np += np; pr.vir += vir; pr.total += vt; if (v.facture && typeof v.facture === 'object') pr.nFact++;
    var h = slot(v.horodatage), hb = S.hours[h] || (S.hours[h] = {});
    hb[s.barId] = (hb[s.barId] || 0) + vt;
    var rk = s.soiree + '|' + s.barId, rr = function () { return S.remRows[rk] || (S.remRows[rk] = { day: s.soiree, barId: s.barId, bar: s.bar, lig: 0, nLig: 0, tic: 0, nTic: 0 }); };
    if (v.remiseTicket) { S.remTic += (v.sousTotal || 0) - vt; S.nRemTic++; rr().tic += (v.sousTotal || 0) - vt; rr().nTic++; }
    var lq = 0, lm = 0; (v.lignes || []).forEach(function (l) { if (isLivLine(l)) { lq += +l.quantite || 0; lm += +l.total || 0; } });
    if (lq || lm) {
      var after = !!(v.livraisonAjoutee || v.venteLiee), lk = s.soiree + '|' + s.barId, lr = S.liv.rows[lk] || (S.liv.rows[lk] = { day: s.soiree, barId: s.barId, bar: s.bar, n: 0, m: 0, na: 0, ma: 0 });
      S.liv.n += lq; S.liv.m += lm; lr.n += lq; lr.m += lm;
      if (after) { S.liv.na += lq; S.liv.ma += lm; lr.na += lq; lr.ma += lm; }
    }
    (v.lignes || []).forEach(function (l) {
      var key = l.produitId || ('libre:' + l.libelle), cat = l.categorie || (l.articleLibre ? 'Articles libres' : 'Sans catégorie');
      var a = S.art[key] || (S.art[key] = { libelle: l.libelle, cat: l.produitId ? cat : 'Articles libres', libre: !l.produitId, q: 0, m: 0, per: {} });
      a.q += +l.quantite || 0; a.m += +l.total || 0; S.lignes += +l.total || 0;
      var ap = a.per[s.barId] || (a.per[s.barId] = { q: 0, m: 0 }); ap.q += +l.quantite || 0; ap.m += +l.total || 0;
      if (l.remise) { S.remLig += (l.prixUnitaire * l.quantite) - l.total; S.nRemLig++; rr().lig += (l.prixUnitaire * l.quantite) - l.total; rr().nLig++; }
    });
  });
  Object.keys(S.art).forEach(function (k) { var a = S.art[k], c = S.cats[a.cat] || (S.cats[a.cat] = { q: 0, m: 0, items: [], per: {} }); c.q += a.q; c.m += a.m; c.items.push(a); Object.keys(a.per).forEach(function (b) { var cp = c.per[b] || (c.per[b] = { q: 0, m: 0 }); cp.q += a.per[b].q; cp.m += a.per[b].m; }); });
  return S;
}
function warnings() {
  var w = [];
  FILES.forEach(function (f) { if (f.status === 'err') w.push({ err: true, t: '<strong>' + esc(f.name) + '</strong> : ' + esc(f.note) }); });
  FILES.forEach(function (f) { if (f.status === 'rep') w.push({ t: '<strong>' + esc(f.name) + '</strong> est ignoré : ' + esc(f.note) }); });
  if (F.caisse === 'soiree') {
    var R = soirStats(soirFiltered());
    if (R.bo.cases > R.tk.cases) w.push({ t: 'Plus de cases barrées (<strong>' + R.bo.cases + '</strong>) que de cases vendues (<strong>' + R.tk.cases + '</strong>) : il manque peut-être le fichier d\u2019un appareil Tickets.' });
    return w;
  }
  var all = allSales(), bs = bars(), byS = {};
  all.forEach(function (s) { (byS[s.soiree] = byS[s.soiree] || {})[s.barId] = 1; });
  activeFiles().forEach(function (f) { var d = f.data; if (d.date && d.pointDeVente && byS[d.date]) byS[d.date][d.pointDeVente.id] = 1; });
  Object.keys(byS).sort().forEach(function (so) { bs.forEach(function (b) { if (!byS[so][b.id]) w.push({ t: 'Aucune vente de <strong>' + esc(b.nom) + '</strong> pour ' + T().dela + ' ' + longDate(so) + ' : un fichier manque peut-être.' }); }); });
  return w;
}

/* ---------- Rendu ---------- */
function renderBilan() {
  try { renderBilanInner(); }
  catch (e) {
    var app = document.getElementById('mod');
    app.innerHTML = vBand(null) + '<main><div class="alerts"><div class="alert err"><strong>Le bilan n\u2019a pas pu être affiché</strong> avec les fichiers chargés (' + esc(e && e.message || e) + '). Retirez le dernier fichier chargé ci-dessous, puis envoyez-le à Claude pour qu\u2019il corrige l\u2019app.</div></div>' + vFiles() + '</main>' + vToast();
    bindDrop(); if (window.console) console.error(e);
  }
}
function renderBilanInner() {
  var app = document.getElementById('mod');
  if (!activeFiles().length) { app.innerHTML = vBand(null) + (FILES.length || BGH.open ? '<main>' + vGhPanel() + vAlerts() + '</main>' : '') + vToast(); bindDrop(); return; }
  if (F.caisse === 'soiree') { var R = soirStats(soirFiltered()); app.innerHTML = vSoirBand(R) + vFilters() + '<main>' + vGhPanel() + vAlerts() + vSoirRecette(R) + vSoirEntrees(R) + vSoirCases(R) + vSoirBoissons(R) + vSoirHours(R) + vSoirApp(R) + vSoirAnn(R) + vFiles() + '</main>' + vToast(); bindDrop(); return; }
  if (F.caisse === 'sapin') { var yrs = {}; activeFiles().forEach(function (f) { if (f.data.date) yrs[f.data.date.slice(0, 4)] = 1; }); Object.keys(yrs).forEach(fsEnsure); }
  var list = filtered(), S = stats(list);
  var CR = caisseRows();
  app.innerHTML = vBand(S) + vFilters() + '<main>' + vGhPanel() + vAlerts() + vBars(S) + vHours(S) + vPaiements(S) + (F.caisse !== 'sapin' || FEAT('fond') ? vCaisse(CR) : '') + (F.caisse !== 'sapin' || FEAT('livraison') ? vLivraisons(S) : '') + (F.caisse !== 'sapin' || FEAT('tiroir') ? vTiroir(CR) : '') + vArticles(S) + vAdjust(S) + vFiles() + '</main>' + vToast();
  bindDrop();
}
function vToast() { return toastMsg ? '<div class="toast" role="status">' + esc(toastMsg) + '</div>' : ''; }
function toast(t) { toastMsg = t; clearTimeout(toastT); toastT = setTimeout(function () { toastMsg = ''; render(); }, 3200); render(); }
function isDark() { var a = document.documentElement.getAttribute('data-theme'); return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }

function vBand(S) {
  var top = '<div class="band-top"><h1>' + (BIL_CUR === 'sapin' ? 'Bilan des ventes' : BIL_CUR === 'soiree' ? 'Bilan Soirée démo' : 'Bilan du bar') + '</h1></div>';
  if (!S) {
    return '<div class="band">' + top + '<div class="drop" id="drop"><h2>Déposez les exports des caisses</h2>' +
      (BIL_CUR === 'sapin' ? '<p>Glissez ici les fichiers <strong>ventes_….json</strong> téléchargés depuis la Caisse, de tous les points de vente et de tous les jours. Ils restent sur cet appareil : rien n\u2019est envoyé sur internet.</p>'
        : BIL_CUR === 'soiree' ? '<p>Glissez ici les fichiers <strong>chlorophylle_….json</strong> de la Caisse Soirée, de tous les appareils. Ils restent sur cet appareil : rien n\u2019est envoyé sur internet.</p>'
        : '<p>Glissez ici les fichiers <strong>ventes_….json</strong> téléchargés depuis la Caisse Bar, de tous les bars et de tous les jours. Ils restent sur cet appareil : rien n\u2019est envoyé sur internet.</p>') +
      '<div class="acts"><label class="pick">Choisir des fichiers<input type="file" accept=".json,application/json" multiple data-files></label>' +
      '<button class="demo" data-g="open">Charger depuis le serveur</button>' + (BIL_CUR === 'bar' ? '<button class="demo" data-a="demo">Essayer avec des exemples</button>' : '') + '</div></div></div>';
  }
  var title = (caisses().length > 1 ? CAISSE_LABEL[F.caisse] + ' · ' : '') + (F.soiree === 'all' ? T().toutes : T().du + ' ' + longDate(F.soiree));
  if (F.bar !== 'all') { var b = bars().filter(function (x) { return x.id === F.bar; })[0]; if (b) title += ', ' + b.nom; }
  var tot = S.total || 0, pc = tot ? S.cash / tot * 100 : 0, pn = tot ? (S.np + S.vir) / tot * 100 : 0, pb = Math.max(0, 100 - pc - pn);
  return '<div class="band">' + top + '<div class="hero"><h2>' + esc(title) + '</h2>' +
    '<div class="big num">' + money(tot).replace(/\u00a0€$/, '') + '<small>€</small></div>' +
    '<div class="split" role="img" aria-label="Cash ' + Math.round(pc) + ' %, Bancontact ' + Math.round(100 - pc) + ' %"><i style="width:' + pc + '%;background:var(--gold)"></i><i style="width:' + (tot ? pb : 0) + '%;background:#5E8F4E"></i>' + (pn ? '<i style="width:' + pn + '%;background:#C9785F"></i>' : '') + '</div>' +
    '<div class="split-legend num"><span><span class="dot" style="background:var(--gold)"></span>Cash <b>' + money(S.cash) + '</b> (' + Math.round(pc) + ' %)</span>' +
    '<span><span class="dot" style="background:#5E8F4E"></span>Bancontact <b>' + money(S.bc) + '</b> (' + Math.round(tot ? pb : 0) + ' %)</span>' +
      (S.np ? '<span><span class="dot" style="background:#C9785F"></span>À facturer (non payé) <b>' + money(S.np) + '</b></span>' : '') + (S.vir ? '<span><span class="dot" style="background:#C9785F"></span>Payé par virement <b>' + money(S.vir) + '</b></span>' : '') + '</div>' +
    '<div class="facts num"><strong>' + S.n + '</strong> vente' + (S.n > 1 ? 's' : '') + ', panier moyen <strong>' + money(S.n ? S.total / S.n : 0) + '</strong>' +
    (S.mixte ? ', dont ' + S.mixte + ' en paiement mixte (réparti ci-dessus)' : '') + (S.nCmd ? ', <strong>' + S.nCmd + '</strong> commande' + (S.nCmd > 1 ? 's' : '') + ' retirée' + (S.nCmd > 1 ? 's' : '') + (S.pre ? ' (dont ' + money(S.pre) + ' payés à la commande)' : '') : '') + (S.nFact ? ', <strong>' + S.nFact + '</strong> facture' + (S.nFact > 1 ? 's' : '') + ' demandée' + (S.nFact > 1 ? 's' : '') : '') +
    (S.ann.length ? '. ' + S.ann.length + ' vente' + (S.ann.length > 1 ? 's' : '') + ' annulée' + (S.ann.length > 1 ? 's' : '') + ', non comptée' + (S.ann.length > 1 ? 's' : '') : '') + '.</div>' +
    (S.liv.m ? '<div class="facts num">' + 'Articles' + ' <strong>' + money(tot - S.liv.m) + '</strong> · <strong>' + S.liv.n + '</strong> livraison' + (S.liv.n > 1 ? 's' : '') + '</div>' : '') + '</div></div>';
}
function vFilters() {
  var ss = soirees(), bs = bars();
  return '<div class="filters"><div class="in">' +
    (caisses().length > 1 ? '<div class="fgroup"><span>Caisse</span>' + caisses().map(function (c) { return '<button class="chip' + (F.caisse === c ? ' on' : '') + '" data-a="caisse" data-v="' + c + '">' + CAISSE_LABEL[c] + '</button>'; }).join('') + '</div>' : '') +
    '<div class="fgroup"><span>' + T().per + '</span>' + ss.map(function (s) { return '<button class="chip' + (F.soiree === s ? ' on' : '') + '" data-a="soiree" data-v="' + s + '">' + shortDate(s) + '</button>'; }).join('') +
    (ss.length > 1 ? '<button class="chip' + (F.soiree === 'all' ? ' on' : '') + '" data-a="soiree" data-v="all">Toutes</button>' : '') + '</div>' +
    (bs.length > 1 ? '<div class="fgroup"><span>' + T().pdv + '</span><button class="chip' + (F.bar === 'all' ? ' on' : '') + '" data-a="bar" data-v="all">Tous</button>' +
      bs.map(function (b) { return '<button class="chip' + (F.bar === b.id ? ' on' : '') + '" data-a="bar" data-v="' + esc(b.id) + '">' + esc(b.nom) + '</button>'; }).join('') + '</div>' : '') +
    '<div class="right"><label class="btn">+ Ajouter des fichiers<input type="file" accept=".json,application/json" multiple data-files></label>' +
    '<button class="btn" data-g="open">+ Depuis le serveur</button><button class="btn" data-a="clear">Retirer les fichiers</button><button class="btn" data-a="print">Imprimer</button><button class="btn" data-a="csv">Exporter pour Excel</button></div></div></div>';
}
/* Alertes du Bilan : chacune peut être fermée (mémorisé tant que l'app reste ouverte) */
var DISMISSED = {};
function shownWarnings() { return warnings().filter(function (x) { return !DISMISSED[x.t]; }); }
function vAlerts() {
  var w = shownWarnings(); if (!w.length) return '';
  return '<div class="alerts">' + (w.length > 1 ? '<div class="alerts-head"><button class="btn sm" data-a="dismissAll">Tout fermer (' + w.length + ')</button></div>' : '') +
    w.map(function (x, i) { return '<div class="alert closable' + (x.err ? ' err' : '') + '"><div class="atext">' + x.t + '</div><button class="aclose" data-a="dismiss" data-v="' + i + '" aria-label="Fermer cette alerte" title="Fermer">✕</button></div>'; }).join('') + '</div>';
}
function vBars(S) {
  var ids = Object.keys(S.perBar).sort(function (a, b) { return S.perBar[b].total - S.perBar[a].total; });
  var max = Math.max.apply(null, ids.map(function (i) { return S.perBar[i].total; }).concat([1]));
  var npc = S.np > 0 || S.vir > 0;
  var rows = ids.map(function (i) { var b = S.perBar[i];
    return '<tr><td class="bname"><strong>' + esc(b.nom) + '</strong><span class="sub num">' + b.n + ' vente' + (b.n > 1 ? 's' : '') + (S.total ? ', ' + Math.round(b.total / S.total * 100) + ' %' : '') + '</span><span class="share" style="width:' + Math.max(6, b.total / max * 100) + '%"></span></td><td class="r num">' + money(b.cash) + '</td><td class="r num">' + money(b.bc) + '</td>' + (npc ? '<td class="r num">' + money((b.np || 0) + (b.vir || 0)) + '</td>' : '') + '<td class="r num"><strong>' + money(b.total) + '</strong></td></tr>'; }).join('');
  return '<section class="half"><h3>' + T().par + '</h3><p class="lead">Le paiement mixte est réparti entre cash et Bancontact.</p><div class="scroll"><table><thead><tr><th>' + T().pdv + '</th><th class="r">Cash</th><th class="r">Bancontact</th>' + (npc ? '<th class="r">À facturer</th>' : '') + '<th class="r">Total</th></tr></thead><tbody>' + rows +
    (ids.length > 1 ? '<tr class="tot"><td>Total</td><td class="r num">' + money(S.cash) + '</td><td class="r num">' + money(S.bc) + '</td>' + (npc ? '<td class="r num">' + money(S.np + S.vir) + '</td>' : '') + '<td class="r num">' + money(S.total) + '</td></tr>' : '') + '</tbody></table></div></section>';
}
function vHours(S) {
  var slots = Object.keys(S.hours).map(Number); if (!slots.length) return '<section class="half"><h3>Heure par heure</h3><p class="empty">Aucune vente.</p></section>';
  var a = Math.min.apply(null, slots), b = Math.max.apply(null, slots), ids = bars().map(function (x) { return x.id; }).filter(function (i) { return S.perBar[i]; });
  var cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  var vals = [], max = 1;
  for (var s = a; s <= b; s++) { var t = 0; ids.forEach(function (i) { t += (S.hours[s] || {})[i] || 0; }); vals.push(t); max = Math.max(max, t); }
  var step = max > 1000 ? 500 : max > 400 ? 200 : max > 150 ? 50 : 25, top = Math.ceil(max / step) * step;
  var W = 560, H = 240, L = 46, B = 28, T = 10, n = b - a + 1, bw = (W - L - 8) / n;
  var g = '';
  for (var y = 0; y <= top; y += step) { var yy = T + (H - T - B) * (1 - y / top); g += '<line x1="' + L + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + y + ' €</text>'; }
  for (var k = 0; k < n; k++) {
    var sl = a + k, h = (sl + slot0()) % 24, x = L + 4 + k * bw, base = H - B;
    ids.forEach(function (i, j) { var v = (S.hours[sl] || {})[i] || 0; if (!v) return; var hgt = (H - T - B) * v / top; base -= hgt;
      g += '<rect x="' + (x + 2) + '" y="' + base + '" width="' + Math.max(2, bw - 4) + '" height="' + hgt + '" rx="3" fill="' + cols[j % 4] + '"><title>' + h + ' h : ' + esc(S.perBar[i].nom) + ' ' + money(v) + '</title></rect>'; });
    g += '<text x="' + (x + bw / 2) + '" y="' + (H - 9) + '" text-anchor="middle">' + h + 'h</text>';
  }
  var peak = vals.indexOf(Math.max.apply(null, vals)), ph = (a + peak + slot0()) % 24;
  return '<section class="half"><h3>Heure par heure</h3><p class="lead">Pic entre ' + ph + ' h et ' + ((ph + 1) % 24) + ' h : ' + money(vals[peak]) + '.</p>' +
    '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ventes par heure">' + g + '</svg>' +
    (ids.length > 1 ? '<div class="legend">' + ids.map(function (i, j) { return '<span><span class="dot" style="background:' + cols[j % 4] + '"></span>' + esc(S.perBar[i].nom) + '</span>'; }).join('') + '</div>' : '') + '</section>';
}
function vArticles(S) {
  var stands = bars().filter(function (b) { return S.perBar[b.id]; });
  if (F.caisse === 'sapin' && stands.length > 1) return vArticlesStands(S, stands);
  var arts = Object.keys(S.art).map(function (k) { return S.art[k]; });
  var head = '<thead><tr><th>Article</th><th class="r">Quantité</th><th class="r">Montant</th><th class="r">Part</th></tr></thead>';
  function row(a) { return '<tr><td>' + esc(a.libelle) + (a.libre ? '<span class="tag">article libre</span>' : '') + '</td><td class="r num">' + a.q + '</td><td class="r num">' + money(a.m) + '</td><td class="r num">' + (S.lignes ? Math.round(a.m / S.lignes * 100) : 0) + ' %</td></tr>'; }
  var body;
  if (ART_VIEW === 'top') body = arts.sort(function (x, y) { return y.m - x.m; }).map(row).join('');
  else body = Object.keys(S.cats).sort(function (x, y) { return S.cats[y].m - S.cats[x].m; }).map(function (c) {
    var k = S.cats[c];
    return '<tr class="cat"><td>' + esc(c) + '</td><td class="r num">' + k.q + '</td><td class="r num">' + money(k.m) + '</td><td class="r num">' + (S.lignes ? Math.round(k.m / S.lignes * 100) : 0) + ' %</td></tr>' +
      k.items.sort(function (x, y) { return y.m - x.m; }).map(row).join('');
  }).join('');
  return '<section><h3>Par article</h3><p class="lead">Montants après les remises sur article, avant les remises sur le ticket entier.</p>' +
    '<div class="seg noprint" role="group" aria-label="Affichage"><button class="' + (ART_VIEW === 'cat' ? 'on' : '') + '" data-a="artview" data-v="cat">Par catégorie</button><button class="' + (ART_VIEW === 'top' ? 'on' : '') + '" data-a="artview" data-v="top">Du plus vendu au moins vendu</button></div>' +
    '<div class="scroll"><table>' + head + '<tbody>' + body + '</tbody></table></div>' +
    '<p class="reconcile num">Articles ' + money(S.lignes) + (S.remTic ? ' − remises sur ticket ' + money(S.remTic) : '') + ' = <strong>' + money(S.lignes - S.remTic) + '</strong>' +
    (Math.abs(S.lignes - S.remTic - S.total) > 0.01 ? ' (écart de ' + money(S.total - (S.lignes - S.remTic)) + ' avec le total des ventes)' : ', soit le total des ventes.') + '</p></section>';
}
/* Caisse : quantités par point de vente, puis le total de tous les stands */
function vArticlesStands(S, stands) {
  stands = stands.slice().sort(function (x, y) { return String(x.id).localeCompare(String(y.id), undefined, { numeric: true }); }); // ordre du catalogue (pdv1 Spy, pdv2…)
  var arts = Object.keys(S.art).map(function (k) { return S.art[k]; });
  var head = '<thead><tr><th>Article</th>' + stands.map(function (b) { return '<th class="r">' + esc(b.nom) + '</th>'; }).join('') + '<th class="r atot">Tous les stands</th><th class="r">Montant</th><th class="r">Part</th></tr></thead>';
  function cells(o, q, m) { return stands.map(function (b) { var p = o[b.id]; return '<td class="r num">' + (p && p.q ? p.q : '—') + '</td>'; }).join('') + '<td class="r num atot"><strong>' + q + '</strong></td><td class="r num">' + money(m) + '</td><td class="r num">' + (S.lignes ? Math.round(m / S.lignes * 100) : 0) + ' %</td>'; }
  function row(a) { return '<tr><td>' + esc(a.libelle) + (a.libre ? '<span class="tag">article libre</span>' : '') + '</td>' + cells(a.per, a.q, a.m) + '</tr>'; }
  var body;
  if (ART_VIEW === 'top') body = arts.sort(function (x, y) { return y.q - x.q || y.m - x.m; }).map(row).join('');
  else body = Object.keys(S.cats).sort(function (x, y) { return S.cats[y].m - S.cats[x].m; }).map(function (c) {
    var k = S.cats[c];
    return '<tr class="cat"><td>' + esc(c) + '</td>' + cells(k.per, k.q, k.m) + '</tr>' + k.items.sort(function (x, y) { return y.q - x.q || y.m - x.m; }).map(row).join('');
  }).join('');
  var tq = {}; arts.forEach(function (a) { Object.keys(a.per).forEach(function (b) { tq[b] = (tq[b] || 0) + a.per[b].q; }); });
  var tot = '<tr class="tot"><td>Total</td>' + stands.map(function (b) { return '<td class="r num">' + (tq[b.id] || 0) + '</td>'; }).join('') + '<td class="r num atot">' + arts.reduce(function (s, a) { return s + a.q; }, 0) + '</td><td class="r num">' + money(S.lignes) + '</td><td class="r num">100 %</td></tr>';
  return '<section><h3>Par article</h3><p class="lead">Quantités vendues par point de vente, puis le total de tous les stands. Montants après les remises sur article, avant les remises sur le ticket entier.</p>' +
    '<div class="seg noprint" role="group" aria-label="Affichage"><button class="' + (ART_VIEW === 'cat' ? 'on' : '') + '" data-a="artview" data-v="cat">Par catégorie</button><button class="' + (ART_VIEW === 'top' ? 'on' : '') + '" data-a="artview" data-v="top">Du plus vendu au moins vendu</button></div>' +
    '<div class="scroll"><table class="artst">' + head + '<tbody>' + body + tot + '</tbody></table></div>' +
    '<p class="reconcile num">Articles ' + money(S.lignes) + (S.remTic ? ' − remises sur ticket ' + money(S.remTic) : '') + ' = <strong>' + money(S.lignes - S.remTic) + '</strong>' +
    (Math.abs(S.lignes - S.remTic - S.total) > 0.01 ? ' (écart de ' + money(S.total - (S.lignes - S.remTic)) + ' avec le total des ventes)' : ', soit le total des ventes.') + '</p></section>';
}
function vAdjust(S) {
  var rem = '<p style="margin:0">' + (S.nRemLig || S.nRemTic ?
    'Remises sur article : <strong class="num">' + money(S.remLig) + '</strong> (' + S.nRemLig + ' ligne' + (S.nRemLig > 1 ? 's' : '') + '). Remises sur ticket : <strong class="num">' + money(S.remTic) + '</strong> (' + S.nRemTic + ' vente' + (S.nRemTic > 1 ? 's' : '') + ').'
    : 'Aucune remise.') + '</p>';
  var rrows = Object.keys(S.remRows).map(function (k) { return S.remRows[k]; }).sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : String(a.bar).localeCompare(String(b.bar)); });
  if (rrows.length) rem += '<div class="scroll"><table class="remt"><thead><tr><th>' + T().per + '</th><th class="r">Sur article</th><th class="r">Sur ticket</th><th class="r">Total</th></tr></thead><tbody>' +
    rrows.map(function (r) { return '<tr><td>' + esc(shortDate(r.day)) + '<span class="sub">' + esc(r.bar) + '</span></td><td class="r num">' + (r.nLig ? money(r.lig) + '<span class="sub">' + r.nLig + ' ligne' + (r.nLig > 1 ? 's' : '') + '</span>' : '—') + '</td><td class="r num">' + (r.nTic ? money(r.tic) + '<span class="sub">' + r.nTic + ' vente' + (r.nTic > 1 ? 's' : '') + '</span>' : '—') + '</td><td class="r num"><strong>' + money(r.lig + r.tic) + '</strong></td></tr>'; }).join('') +
    (rrows.length > 1 ? '<tr class="tot"><td>Total</td><td class="r num">' + money(S.remLig) + '</td><td class="r num">' + money(S.remTic) + '</td><td class="r num">' + money(S.remLig + S.remTic) + '</td></tr>' : '') + '</tbody></table></div>';
  var ann = S.ann.length ? '<div class="scroll"><table class="cancel"><thead><tr><th>Heure</th><th>' + T().pdv + '</th><th>Vente</th><th class="r">Montant</th></tr></thead><tbody>' +
    S.ann.sort(function (x, y) { return x.v.horodatage < y.v.horodatage ? -1 : 1; }).map(function (s) {
      var v = s.v; return '<tr><td class="num">' + v.horodatage.slice(11, 16) + '</td><td>' + esc(s.bar) + '</td><td>' + (v.lignes || []).map(function (l) { return l.quantite + ' × ' + esc(l.libelle); }).join(', ') +
        (v.annulation.motif ? '<br><span class="motif">' + esc(v.annulation.motif) + '</span>' : '') + '</td><td class="r num">' + money(v.total) + '</td></tr>'; }).join('') + '</tbody></table></div>'
    : '<p class="empty">Aucune vente annulée.</p>';
  return '<section><h3>Remises et ventes annulées</h3>' + rem + '<p class="lead" style="margin-top:10px">' + (S.ann.length ? S.ann.length + ' vente' + (S.ann.length > 1 ? 's' : '') + ' annulée' + (S.ann.length > 1 ? 's' : '') + ', comptée' + (S.ann.length > 1 ? 's' : '') + ' dans aucun total :' : '') + '</p>' + ann + '</section>';
}
/* ---------- Caisse du jour, livraisons et tiroir (Caisse v13 → v28 ; champs absents des anciens fichiers) ---------- */
function hasCaisseData(d) { if (d && BIL_CUR === 'sapin' && d.pointDeVente && CXFILES[cxPath(d.date, d.pointDeVente.id)] && CXFILES[cxPath(d.date, d.pointDeVente.id)].doc) return true; return !!d && ((d.caisse && typeof d.caisse === 'object') || (Array.isArray(d.ouverturesTiroir) && d.ouverturesTiroir.length > 0)); }
function caisseRows() {
  if (F.caisse === 'soiree') return [];
  if (BIL_CUR === 'sapin' && BGH.cxFiles && BGH.cxFiles.length) { var want = {}; activeFiles().forEach(function (f) { var d = f.data, p = d.pointDeVente || {}; if (p.id) want[cxPath(d.date, p.id)] = 1; }); cxBilanLoad(BGH.cxFiles.filter(function (x) { return want[x.path]; })); }
  return activeFiles().filter(function (f) { var d = f.data, p = d.pointDeVente || {};
    return (F.soiree === 'all' || d.date === F.soiree) && (F.bar === 'all' || p.id === F.bar);
  }).map(function (f) { var d = f.data, p = d.pointDeVente || { id: '?', nom: T().inconnu };
    var tir = Array.isArray(d.ouverturesTiroir) ? d.ouverturesTiroir : null;
    var sv = tir ? tir.filter(function (o) { return o && !o.venteId; }) : [];
    var cx = BIL_CUR === 'sapin' && p.id ? cxForBilan(d.date, p.id, d) : null;
    return { key: (p.id || '?') + '|' + d.date, day: d.date, barId: p.id, bar: p.nom || p.id, c: cx || d.caisse, cxf: !!cx, has: 'caisse' in d || !!cx, tir: tir, sansVente: sv, nsv: typeof d.nombreOuverturesSansVente === 'number' ? d.nombreOuverturesSansVente : sv.length, name: f.name };
  }).sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : String(a.bar).localeCompare(String(b.bar)); });
}
function cNum(x) { return typeof x === 'number' && !isNaN(x) ? x : 0; }
function cKind(m) { if (m.type !== 'retrait') return 'apport'; if (m.auto || m.motif === 'Recette de fin de journée') return 'recette'; if (m.motif === 'Dépôt au coffre') return 'coffre'; return 'autre'; }
function cStatus(r) {
  var c = r.c, comps = Array.isArray(c.comptages) ? c.comptages : [], last = comps[comps.length - 1] || null, b = [];
  var st = { counted: !!last, last: last, recount: false, nextDay: false, noFond: !c.fond };
  if (last) {
    var ref = typeof last.attenduApres === 'number' ? last.attenduApres : last.attendu;
    st.recount = typeof c.attendu === 'number' && typeof ref === 'number' && Math.abs(c.attendu - ref) >= 0.005;
    st.nextDay = comps.some(function (k) { return k.viaFond || (k.horodatage && String(k.horodatage).slice(0, 10) !== r.day); });
  }
  if (!last) b.push('<span class="cbadge err">Non comptée</span>');
  if (st.recount) b.push('<span class="cbadge warn">À recompter</span>');
  if (st.nextDay) b.push('<span class="cbadge">Comptée le lendemain</span>');
  if (st.noFond) b.push('<span class="cbadge warn">Fond non saisi</span>');
  st.badges = b.join(' ');
  st.label = [!last ? 'Non comptée' : st.recount ? 'À recompter' : 'Comptée', st.nextDay ? 'le lendemain' : '', st.noFond ? 'fond non saisi' : ''].filter(Boolean).join(', ');
  return st;
}
function cEcart(x) { var ok = Math.abs(cNum(x)) < 0.005; return '<span class="ecart ' + (ok ? 'ok' : 'bad') + '">' + (x > 0.004 ? '+' : '') + money(cNum(x)) + '</span>'; }
function cBillets(d) {
  if (!d || typeof d !== 'object') return '';
  var ks = Object.keys(d).filter(function (k) { return +d[k] > 0; }).sort(function (a, b) { return +b - +a; });
  if (!ks.length) return '';
  return '<span class="billets">' + ks.map(function (k) { var v = +k; return '<span>' + (+d[k]) + ' × ' + (v < 1 ? money(v) : v + ' €') + '</span>'; }).join('') + '</span>';
}
function cTime(iso, day) { if (!iso) return ''; var s = String(iso); return (s.slice(0, 10) !== day ? shortDate(s.slice(0, 10)) + ' ' : '') + s.slice(11, 16); }
function cMotifs(c, type) {
  var o = {}; (c.mouvements || []).forEach(function (m) { if (m && m.type === type) { var k = cKind(m) === 'recette' ? 'Recette de fin de journée' : (m.motif || 'Sans motif'); o[k] = (o[k] || 0) + cNum(m.montant); } });
  return Object.keys(o).map(function (k) { return esc(k) + ' ' + money(o[k]); }).join(' · ');
}
function vCaisseDetail(r) {
  var c = r.c, f = c.fond, mv = Array.isArray(c.mouvements) ? c.mouvements : [], cp = Array.isArray(c.comptages) ? c.comptages : [];
  var h = '<div class="cdet">';
  h += '<div><h4>Fond de caisse</h4>' + (f ? '<p class="num"><strong>' + money(cNum(f.montant)) + '</strong>' + (f.horodatage ? ' <span class="faint">à ' + esc(cTime(f.horodatage, r.day)) + '</span>' : '') + '</p>' + cBillets(f.detail) : '<p class="empty">Non saisi.</p>') + '</div>';
  h += '<div><h4>Retraits et apports</h4>' + (mv.length ? '<div class="scroll"><table class="ctab"><thead><tr><th>Heure</th><th>Type</th><th>Motif</th><th class="r">Montant</th></tr></thead><tbody>' + mv.map(function (m) {
      return '<tr><td class="num">' + esc(cTime(m.horodatage, r.day)) + '</td><td>' + (m.type === 'apport' ? 'Apport' : 'Retrait') + '</td><td>' + esc(m.motif || '') + (m.auto ? ' <span class="faint">(automatique)</span>' : '') + '</td><td class="r num">' + (m.type === 'apport' ? '+' : '−') + money(cNum(m.montant)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">Aucun.</p>') + '</div>';
  h += '<div><h4>Comptages' + (cp.length > 1 ? ' (le dernier fait foi)' : '') + '</h4>' + (cp.length ? '<div class="scroll"><table class="ctab"><thead><tr><th>Heure</th><th class="r">Compté</th><th class="r">Attendu</th><th class="r">Écart</th><th class="r">Laissé</th><th class="r">Retiré</th></tr></thead><tbody>' + cp.map(function (k, i) {
      return '<tr' + (i === cp.length - 1 ? ' class="clast"' : '') + '><td class="num">' + esc(cTime(k.horodatage, r.day)) + (k.viaFond ? ' <span class="cbadge">avec le fond du lendemain</span>' : '') + '</td><td class="r num">' + money(cNum(k.montant)) + '</td><td class="r num">' + money(cNum(k.attendu)) + '</td><td class="r num">' + cEcart(k.ecart) + '</td><td class="r num">' + (typeof k.laisse === 'number' ? money(k.laisse) : '—') + '</td><td class="r num">' + (typeof k.recette === 'number' ? money(k.recette) : '—') + '</td></tr>' +
        (cBillets(k.detail) ? '<tr class="cbil"><td colspan="6">' + cBillets(k.detail) + '</td></tr>' : ''); }).join('') + '</tbody></table></div>' : '<p class="empty">Pas encore comptée.</p>') + '</div>';
  return h + '<p class="hint">Fichier : ' + esc(r.name) + '</p></div>';
}
function vCaisse(rows) {
  var withC = rows.filter(function (r) { return r.c && typeof r.c === 'object'; }), empty = rows.filter(function (r) { return r.has && !r.c; });
  if (!withC.length && !empty.length) return '';
  var body = withC.map(function (r) {
    var c = r.c, st = cStatus(r), open = !!CAISSE_OPEN[r.key], ret = cMotifs(c, 'retrait'), app = cMotifs(c, 'apport');
    return '<tr class="crow' + (open ? ' open' : '') + '"><td><button class="clink" data-a="cdet" data-v="' + esc(r.key) + '" aria-expanded="' + open + '"><span class="chev" aria-hidden="true">' + (open ? '▾' : '▸') + '</span> ' + esc(shortDate(r.day)) + '</button><span class="sub">' + esc(r.bar) + (r.cxf ? ' · fichier de caisse' : '') + '</span>' + (st.badges ? '<span class="cbadges">' + st.badges + '</span>' : '') + '</td>' +
      '<td class="r num">' + money(cNum(c.fondDeCaisse)) + '</td><td class="r num">' + money(cNum(c.ventesCash)) + '</td>' +
      '<td class="r num">' + money(cNum(c.apports)) + (app ? '<span class="sub">' + app + '</span>' : '') + '</td>' +
      '<td class="r num">' + money(cNum(c.retraits)) + (ret ? '<span class="sub">' + ret + '</span>' : '') + '</td>' +
      '<td class="r num">' + money(cNum(c.attendu)) + '</td>' +
      '<td class="r num">' + (st.counted ? money(cNum(c.compte)) : '—') + '</td><td class="r num">' + (st.counted ? cEcart(c.ecart) : '—') + '</td><td class="r num">' + (st.counted && typeof c.laissePourDemain === 'number' ? money(c.laissePourDemain) : '—') + '</td></tr>' +
      (open ? '<tr class="cdrow"><td colspan="9">' + vCaisseDetail(r) + '</td></tr>' : '');
  }).join('');
  /* Sur téléphone, le détail s'affiche sous le tableau (le tableau défile en largeur) */
  var outDet = withC.filter(function (r) { return CAISSE_OPEN[r.key]; }).map(function (r) {
    return '<div class="cdout"><div class="row-between"><strong>' + esc(r.bar) + ' · ' + esc(longDate(r.day)) + '</strong><button class="btn sm" data-a="cdet" data-v="' + esc(r.key) + '">Fermer</button></div>' + vCaisseDetail(r) + '</div>';
  }).join('');
  /* Totaux de la période, par stand et tous stands */
  var per = {}, order = [], mot = { retrait: {}, apport: {} };
  function acc(id, nom) { if (!per[id]) { per[id] = { nom: nom, j: 0, ec: 0, nc: 0, rc: 0, rec: 0, cof: 0, aut: 0, app: 0 }; order.push(id); } return per[id]; }
  var T0 = { nom: 'Tous les stands', j: 0, ec: 0, nc: 0, rc: 0, rec: 0, cof: 0, aut: 0, app: 0 };
  withC.forEach(function (r) {
    var c = r.c, st = cStatus(r), a = acc(r.barId, r.bar);
    [a, T0].forEach(function (x) { x.j++; if (st.counted) x.ec += cNum(c.ecart); else x.nc++; if (st.recount) x.rc++; });
    (c.mouvements || []).forEach(function (m) { if (!m) return; var k = cKind(m), v = cNum(m.montant);
      [a, T0].forEach(function (x) { if (k === 'recette') x.rec += v; else if (k === 'coffre') x.cof += v; else if (k === 'autre') x.aut += v; else x.app += v; });
      if (k === 'autre' || k === 'apport') { var o = mot[m.type === 'apport' ? 'apport' : 'retrait'], key = m.motif || 'Sans motif'; o[key] = (o[key] || 0) + v; } });
  });
  function trow(x, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + esc(x.nom) + '<span class="sub">' + x.j + ' jour' + (x.j > 1 ? 's' : '') + '</span></td><td class="r num">' + cEcart(x.ec) + '</td><td class="r num">' + (x.nc ? '<span class="bad">' + x.nc + '</span>' : '0') + '</td><td class="r num">' + (x.rc ? '<span class="warnt">' + x.rc + '</span>' : '0') + '</td><td class="r num">' + money(x.rec) + '</td><td class="r num">' + money(x.cof) + '</td><td class="r num">' + money(x.aut) + '</td><td class="r num">' + money(x.app) + '</td></tr>'; }
  var tot = withC.length ? '<h4 class="csub">Totaux de la période</h4><div class="scroll"><table class="ctot"><thead><tr><th>Stand</th><th class="r">Écarts</th><th class="r">Non comptées</th><th class="r">À recompter</th><th class="r">Recettes retirées</th><th class="r">Dépôts au coffre</th><th class="r">Autres retraits</th><th class="r">Apports</th></tr></thead><tbody>' +
    order.map(function (id) { return trow(per[id]); }).join('') + (order.length > 1 ? trow(T0, 'tot') : '') + '</tbody></table></div>' : '';
  var ml = ['retrait', 'apport'].map(function (t) { var o = mot[t], ks = Object.keys(o); return ks.length ? '<p class="cmot"><strong>' + (t === 'retrait' ? 'Autres retraits' : 'Apports') + ' :</strong> ' + ks.sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return esc(k) + ' ' + money(o[k]); }).join(' · ') + '</p>' : ''; }).join('');
  return '<section class="caisse"><h3>Caisse</h3><p class="lead">Par stand et par jour, chiffres de la tablette : attendu = fond + ventes cash + apports − retraits. Touchez un jour pour le détail des mouvements, des comptages et des billets.</p>' +
    (withC.length ? '<div class="scroll"><table class="cmain"><thead><tr><th>Jour</th><th class="r">Fond</th><th class="r">Ventes cash</th><th class="r">Apports</th><th class="r">Retraits</th><th class="r">Attendu</th><th class="r">Compté</th><th class="r">Écart</th><th class="r">Laissé pour demain</th></tr></thead><tbody>' + body + '</tbody></table></div>' : '<p class="empty">Aucune caisse saisie sur cette période.</p>') + outDet +
    (empty.length ? '<p class="hint">' + empty.length + ' journée' + (empty.length > 1 ? 's' : '') + ' sans saisie de caisse (ni fond, ni comptage) : ' + empty.map(function (r) { return esc(r.bar) + ' ' + esc(shortDate(r.day)); }).join(', ') + '.</p>' : '') + tot + ml + '</section>';
}
function vLivraisons(S) {
  var rows = Object.keys(S.liv.rows).map(function (k) { return S.liv.rows[k]; }).sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : a.bar.localeCompare(b.bar); });
  if (!rows.length) return '';
  return '<section class="half"><h3>Livraisons</h3><p class="lead">Nombre de livraisons par stand et par jour. Une livraison ajoutée après le paiement compte au jour de la vente d’origine.</p><div class="scroll"><table><thead><tr><th>Jour</th><th class="r">Livraisons</th></tr></thead><tbody>' +
    rows.map(function (r) { return '<tr><td>' + esc(shortDate(r.day)) + '<span class="sub">' + esc(r.bar) + '</span></td><td class="r num"><strong>' + r.n + '</strong></td></tr>'; }).join('') +
    (rows.length > 1 ? '<tr class="tot"><td>Total</td><td class="r num">' + S.liv.n + '</td></tr>' : '') + '</tbody></table></div></section>';
}
function vTiroir(rows) {
  var rs = rows.filter(function (r) { return r.tir && r.tir.length; });
  if (!rs.length) return '';
  var totO = 0, totS = 0;
  var body = rs.map(function (r) {
    var o = {}; r.sansVente.forEach(function (x) { var k = x.motif || 'Sans motif'; o[k] = (o[k] || 0) + 1; }); totO += r.tir.length; totS += r.nsv;
    return '<tr><td>' + esc(shortDate(r.day)) + '<span class="sub">' + esc(r.bar) + '</span></td><td class="r num">' + r.tir.length + '</td><td class="r num">' + (r.nsv ? '<strong>' + r.nsv + '</strong>' : '0') + '</td><td class="tmot">' + (Object.keys(o).length ? Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return esc(k) + (o[k] > 1 ? ' ×' + o[k] : ''); }).join(' · ') : '—') + '</td></tr>';
  }).join('');
  return '<section class="half"><h3>Tiroir-caisse</h3><p class="lead">Ouvertures enregistrées par la tablette ; « sans vente » avec leur motif.</p><div class="scroll"><table><thead><tr><th>Jour</th><th class="r">Ouvertures</th><th class="r">Sans vente</th><th>Motifs (sans vente)</th></tr></thead><tbody>' + body +
    (rs.length > 1 ? '<tr class="tot"><td>Total</td><td class="r num">' + totO + '</td><td class="r num">' + totS + '</td><td></td></tr>' : '') + '</tbody></table></div></section>';
}
function vFiles() {
  var rows = FILES.map(function (f, i) {
    var d = f.data, st = f.status === 'ok' ? '<span class="status ok">Pris en compte</span>' : f.status === 'rep' ? '<span class="status rep">Ignoré (doublon)</span>' : '<span class="status err">Refusé</span>';
    return '<tr><td>' + esc(f.name) + '</td><td>' + (f.caisse ? CAISSE_LABEL[f.caisse] : '') + '</td><td>' + (d ? esc(d.pointDeVente ? d.pointDeVente.nom : d.appareil ? (soirNames()[d.appareil.id] || d.appareil.nom || d.appareil.id) : '?') : '') + '</td><td class="num">' + (d ? String(d.date || d.soiree || '').split('-').reverse().join('/') : '') + '</td><td class="r num">' + (d && d.ventes ? d.ventes.length : d && d.enregistrements ? d.enregistrements.length : '') + '</td><td>' + st + '</td><td class="r"><button class="x" data-a="rm" data-v="' + i + '" aria-label="Retirer ' + esc(f.name) + '">Retirer</button></td></tr>';
  }).join('');
  return '<section class="files"><h3>Fichiers chargés</h3><p class="lead">Un export par point de vente et par jour de calendrier (Caisse Soirée : un fichier par appareil et par soirée). Caisse Bar et Caisse Soirée : les ventes après minuit sont rattachées à la soirée de la veille.</p><div class="scroll"><table><thead><tr><th>Fichier</th><th>Caisse</th><th>Point de vente / appareil</th><th>Jour</th><th class="r">Ventes</th><th>État</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="noprint" style="margin:14px 0 0"><button class="btn" data-a="clear">Tout retirer</button></p></section>';
}


/* ================= Bilan de la Caisse Soirée (format chlorophylle-caisse/soiree) ================= */
/* Enregistrements de tous les fichiers actifs, fusionnés par identifiant (un même enregistrement n'est compté qu'une fois) */
function soirNightOf(iso) { var d = new Date(iso); if (isNaN(d)) return iso.slice(0, 10); d = new Date(d.getTime() - 12 * 3600 * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function isDefName(n, id) { return !n || n === id || /^appareil\s+\w{1,8}$/i.test(String(n).trim()); }
/* Nom d'un appareil : le nom donné le plus récent (fichier le plus récent, puis enregistrements), sinon nom tiré du nom de fichier du dépôt */
function soirNames() {
  var best = {};
  function offer(id, nom, when) { if (!id || isDefName(nom, id)) return; if (!best[id] || when > best[id].w) best[id] = { n: String(nom).trim(), w: when }; }
  FILES.forEach(function (f) {
    if (f.caisse !== 'soiree' || !f.data) return;
    var d = f.data, ap = d.appareil || {};
    offer(ap.id, ap.nom, (d.miseAJour || '') + '~');
    (d.enregistrements || []).forEach(function (r) { if (r && r.appareil) offer(r.appareil.id, r.appareil.nom, r.horodatage || ''); });
    if (ap.id && !best[ap.id]) { var m = new RegExp('\\d{4}-\\d{2}-\\d{2}_(.+)_' + ap.id + '\\.json$').exec(f.name.replace(/ › /g, '/')); if (m) best[ap.id] = { n: m[1].replace(/[-_]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }), w: '' }; }
  });
  var o = {}; Object.keys(best).forEach(function (k) { o[k] = best[k].n; }); return o;
}
function soirRecs() {
  var map = {}, out = [], NAMES = soirNames();
  activeFiles().forEach(function (f) {
    var d = f.data, ap = d.appareil || {};
    (d.enregistrements || []).forEach(function (r) {
      if (!r || !r.id || typeof r.horodatage !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}/.test(r.horodatage)) return;
      if (map[r.id]) return; map[r.id] = 1;
      var a = r.appareil || ap;
      out.push({ r: r, night: r.soiree || d.soiree || soirNightOf(r.horodatage), apId: a.id || '?', apNom: NAMES[a.id] || a.nom || (a.id ? 'Appareil ' + a.id : T().inconnu), pc: +r.prixCase || +d.prixCase || 0, cpc: +d.casesParCarte || 18 });
    });
  });
  return out;
}
function soirFiltered() { return soirRecs().filter(function (x) { return (F.soiree === 'all' || x.night === F.soiree) && (F.bar === 'all' || x.apId === F.bar); }); }
function soirStats(list) {
  var R = { recette: 0, cash: 0, bc: 0, mixte: 0, n: 0, ann: [], pc: 0, cpc: 18,
    ent: { recette: 0, cash: 0, bc: 0, ventes: 0, personnes: 0, preventes: 0, forcees: 0, produits: {} },
    tk: { recette: 0, cash: 0, bc: 0, ventes: 0, cases: 0, cartes: 0, seules: 0, budget: 0 },
    bo: { commandes: 0, cases: 0, valeur: 0, produits: {}, cats: {} }, hours: {}, perAp: {} };
  list.forEach(function (x) { if (!R.pc && x.pc) R.pc = x.pc; if (x.cpc) R.cpc = x.cpc; });
  list.forEach(function (x) {
    var r = x.r;
    if (r.annulation) { R.ann.push(x); return; }
    R.n++;
    var a = R.perAp[x.apId] || (R.perAp[x.apId] = { nom: x.apNom, recette: 0, cash: 0, bc: 0, entrees: 0, vip: 0, cases: 0, commandes: 0, barrees: 0, n: 0 });
    a.n++;
    var h = slot(r.horodatage), hb = R.hours[h] || (R.hours[h] = { ent: 0, vip: 0, cmd: 0, rec: 0 });
    var p = r.paiement;
    if (p && (r.type === 'entree' || r.type === 'ticket')) {
      var t = +r.total || 0, c = +p.cash || 0, b = +p.bancontact || 0;
      R.recette += t; R.cash += c; R.bc += b; if (p.mode === 'mixte') R.mixte++;
      a.recette += t; a.cash += c; a.bc += b; hb.rec += t;
      var g = r.type === 'entree' ? R.ent : R.tk; g.recette += t; g.cash += c; g.bc += b;
    }
    if (r.type === 'prevente') { R.ent.preventes++; if (r.forcee) R.ent.forcees++; a.entrees++; hb.ent++; }
    else if (r.type === 'entree') {
      R.ent.ventes++;
      (r.lignes || []).forEach(function (l) {
        var k = l.produitId || l.libelle, e = R.ent.produits[k] || (R.ent.produits[k] = { libelle: l.libelle || k, q: 0, m: 0 });
        e.q += +l.quantite || 0; e.m += +l.total || 0;
        if (l.produitId === 'entree') { R.ent.personnes += +l.quantite || 0; a.entrees += +l.quantite || 0; hb.ent += +l.quantite || 0; }
        else if (l.produitId === 'vip') { R.ent.vip = (R.ent.vip || 0) + (+l.quantite || 0); a.vip += +l.quantite || 0; hb.vip += +l.quantite || 0; }
      });
    } else if (r.type === 'ticket') {
      R.tk.ventes++; R.tk.cases += +r.cases || 0; R.tk.cartes += +r.cartes || 0; R.tk.seules += +r.casesSeules || 0; if (r.budget) R.tk.budget++;
      a.cases += +r.cases || 0;
    } else if (r.type === 'commande') {
      var tc = +r.totalCases || 0;
      R.bo.commandes++; R.bo.cases += tc; R.bo.valeur += r.valeur != null ? +r.valeur : tc * x.pc; a.commandes++; a.barrees += tc; hb.cmd++;
      (r.lignes || []).forEach(function (l) {
        var k = l.produitId || l.libelle, cat = l.categorie || 'Sans catégorie';
        var pr = R.bo.produits[k] || (R.bo.produits[k] = { libelle: l.libelle || k, cat: cat, format: l.format, q: 0, cases: 0 });
        pr.q += +l.quantite || 0; pr.cases += +l.totalCases || 0;
      });
    }
  });
  Object.keys(R.bo.produits).forEach(function (k) { var pr = R.bo.produits[k], c = R.bo.cats[pr.cat] || (R.bo.cats[pr.cat] = { q: 0, cases: 0, items: [] }); c.q += pr.q; c.cases += pr.cases; c.items.push(pr); });
  ['recette', 'cash', 'bc'].forEach(function (k) { R[k] = r2(R[k]); });
  return R;
}
function plur(n, s, p) { return n + ' ' + (Math.abs(n) > 1 ? (p || s + 's') : s); }
function soirTitle() {
  var title = (caisses().length > 1 ? CAISSE_LABEL.soiree + ' · ' : '') + (F.soiree === 'all' ? T().toutes : T().du + ' ' + longDate(F.soiree));
  if (F.bar !== 'all') { var b = bars().filter(function (x) { return x.id === F.bar; })[0]; if (b) title += ', ' + b.nom; }
  return title;
}
function vSoirBand(R) {
  var tot = R.recette || 0, pc = tot ? R.cash / tot * 100 : 0, entT = R.ent.personnes + R.ent.preventes;
  return '<div class="band"><div class="band-top"><h1>Bilan des ventes</h1></div><div class="hero"><h2>' + esc(soirTitle()) + '</h2>' +
    '<div class="big num">' + money(tot).replace(/ €$/, '') + '<small>€</small></div>' +
    '<div class="split" role="img" aria-label="Cash ' + Math.round(pc) + ' %, Bancontact ' + Math.round(100 - pc) + ' %"><i style="width:' + pc + '%;background:var(--gold)"></i><i style="width:' + (tot ? 100 - pc : 0) + '%;background:#5E8F4E"></i></div>' +
    '<div class="split-legend num"><span><span class="dot" style="background:var(--gold)"></span>Cash <b>' + money(R.cash) + '</b> (' + Math.round(pc) + ' %)</span>' +
    '<span><span class="dot" style="background:#5E8F4E"></span>Bancontact <b>' + money(R.bc) + '</b> (' + Math.round(tot ? 100 - pc : 0) + ' %)</span></div>' +
    '<div class="facts num"><strong>' + entT + '</strong> entrée' + (entT > 1 ? 's' : '') + ' (' + R.ent.personnes + ' payante' + (R.ent.personnes > 1 ? 's' : '') + ', ' + R.ent.preventes + ' prévente' + (R.ent.preventes > 1 ? 's' : '') + '), <strong>' + R.tk.cases + '</strong> case' + (R.tk.cases > 1 ? 's' : '') + ' vendue' + (R.tk.cases > 1 ? 's' : '') + ', <strong>' + R.bo.commandes + '</strong> commande' + (R.bo.commandes > 1 ? 's' : '') + ' de boissons' +
    (R.ann.length ? '. ' + R.ann.length + ' enregistrement' + (R.ann.length > 1 ? 's' : '') + ' annulé' + (R.ann.length > 1 ? 's' : '') + ', non compté' + (R.ann.length > 1 ? 's' : '') : '') + '.</div></div></div>';
}
function vSoirRecette(R) {
  function row(lbl, g) { return '<tr><td class="bname"><strong>' + lbl + '</strong>' + (R.recette ? '<span class="sub num">' + Math.round(g.recette / R.recette * 100) + ' %</span>' : '') + '</td><td class="r num">' + money(g.cash) + '</td><td class="r num">' + money(g.bc) + '</td><td class="r num"><strong>' + money(g.recette) + '</strong></td></tr>'; }
  return '<section class="half"><h3>Recette</h3><p class="lead">Seules les entrées et les tickets sont encaissés ; les boissons se paient en cases. Le paiement mixte est réparti entre cash et Bancontact.</p><div class="scroll"><table><thead><tr><th>Caisse</th><th class="r">Cash</th><th class="r">Bancontact</th><th class="r">Total</th></tr></thead><tbody>' +
    row('Entrées', R.ent) + row('Tickets', R.tk) +
    '<tr class="tot"><td>Total</td><td class="r num">' + money(R.cash) + '</td><td class="r num">' + money(R.bc) + '</td><td class="r num">' + money(R.recette) + '</td></tr></tbody></table></div>' +
    (R.mixte ? '<p class="reconcile num">' + R.mixte + ' paiement' + (R.mixte > 1 ? 's' : '') + ' mixte' + (R.mixte > 1 ? 's' : '') + '.</p>' : '') + '</section>';
}
function vSoirEntrees(R) {
  var ks = Object.keys(R.ent.produits).sort(function (a, b) { return a === 'entree' ? -1 : b === 'entree' ? 1 : R.ent.produits[b].m - R.ent.produits[a].m; });
  var rows = ks.map(function (k) { var e = R.ent.produits[k]; return '<tr><td>' + esc(e.libelle) + '</td><td class="r num">' + e.q + '</td><td class="r num">' + money(e.m) + '</td></tr>'; }).join('') +
    '<tr><td>Préventes (QR)' + (R.ent.forcees ? '<span class="tag">' + R.ent.forcees + ' doublon' + (R.ent.forcees > 1 ? 's' : '') + ' accepté' + (R.ent.forcees > 1 ? 's' : '') + '</span>' : '') + '</td><td class="r num">' + R.ent.preventes + '</td><td class="r num">' + money(0) + '</td></tr>';
  return '<section class="half"><h3>Entrées</h3><p class="lead"><strong class="num">' + (R.ent.personnes + R.ent.preventes) + '</strong> personnes entrées : ' + R.ent.personnes + ' payante' + (R.ent.personnes > 1 ? 's' : '') + ' et ' + R.ent.preventes + ' prévente' + (R.ent.preventes > 1 ? 's' : '') + ' scannée' + (R.ent.preventes > 1 ? 's' : '') + '.</p>' +
    '<div class="scroll"><table><thead><tr><th>Article</th><th class="r">Quantité</th><th class="r">Montant</th></tr></thead><tbody>' + rows +
    '<tr class="tot"><td>Total</td><td class="r num"></td><td class="r num">' + money(R.ent.recette) + '</td></tr></tbody></table></div></section>';
}
function vSoirCases(R) {
  var ec = R.tk.cases - R.bo.cases, pc = R.pc;
  function kpi(l, v, sm, cls) { return '<div class="kpi' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b>' + (sm ? '<small>' + sm + '</small>' : '') + '</div>'; }
  return '<section><h3>Tickets et cases</h3><p class="lead">Case à ' + money(pc) + ', cartes de ' + R.cpc + ' cases. Les cases vendues aux Tickets sont barrées au bar des Boissons.</p><div class="kpis">' +
    kpi('Cases vendues', R.tk.cases, money(R.tk.recette)) +
    kpi('Équivalent cartes', String(r2(R.tk.cases / (R.cpc || 18))).replace('.', ','), 'de ' + R.cpc + ' cases') +
    kpi('Cartes complètes', R.tk.cartes, plur(R.tk.seules, 'case') + ' à l’unité') +
    kpi('Ventes de tickets', R.tk.ventes, R.tk.ventes ? 'moy. ' + String(r2(R.tk.cases / R.tk.ventes)).replace('.', ',') + ' cases' + (R.tk.budget ? ', ' + R.tk.budget + ' par budget' : '') : '') +
    kpi('Cases barrées', R.bo.cases, 'valeur ' + money(R.bo.cases * pc)) +
    kpi('Cases non barrées', ec, (ec >= 0 ? 'vendues − barrées' : 'plus barrées que vendues') + ', valeur ' + money(ec * pc), ec < 0 ? 'warn' : '') + '</div></section>';
}
function vSoirBoissons(R) {
  var pc = R.pc, prods = Object.keys(R.bo.produits).map(function (k) { return R.bo.produits[k]; });
  if (!prods.length) return '<section><h3>Boissons</h3><p class="empty">Aucune commande de boissons.</p></section>';
  var head = '<thead><tr><th>Boisson</th><th class="r">Quantité</th><th class="r">Cases</th><th class="r">Valeur</th><th class="r">Part</th></tr></thead>';
  function part(c) { return R.bo.cases ? Math.round(c / R.bo.cases * 100) : 0; }
  function row(p) { return '<tr><td>' + esc(p.libelle) + (p.format === 'bouteille' ? '<span class="tag">bouteille</span>' : '') + '</td><td class="r num">' + p.q + '</td><td class="r num">' + p.cases + '</td><td class="r num">' + money(p.cases * pc) + '</td><td class="r num">' + part(p.cases) + ' %</td></tr>'; }
  var body;
  if (ART_VIEW === 'top') body = prods.sort(function (a, b) { return b.cases - a.cases || b.q - a.q; }).map(row).join('');
  else body = Object.keys(R.bo.cats).sort(function (a, b) { return R.bo.cats[b].cases - R.bo.cats[a].cases; }).map(function (c) {
    var k = R.bo.cats[c];
    return '<tr class="cat"><td>' + esc(c) + '</td><td class="r num">' + k.q + '</td><td class="r num">' + k.cases + '</td><td class="r num">' + money(k.cases * pc) + '</td><td class="r num">' + part(k.cases) + ' %</td></tr>' + k.items.sort(function (a, b) { return b.cases - a.cases || b.q - a.q; }).map(row).join('');
  }).join('');
  return '<section><h3>Boissons</h3><p class="lead">' + plur(R.bo.commandes, 'commande') + ', ' + plur(R.bo.cases, 'case') + ' barrée' + (R.bo.cases > 1 ? 's' : '') + '. La valeur est le nombre de cases × ' + money(pc) + '.</p>' +
    '<div class="seg noprint" role="group" aria-label="Affichage"><button class="' + (ART_VIEW === 'cat' ? 'on' : '') + '" data-a="artview" data-v="cat">Par catégorie</button><button class="' + (ART_VIEW === 'top' ? 'on' : '') + '" data-a="artview" data-v="top">Du plus vendu au moins vendu</button></div>' +
    '<div class="scroll"><table>' + head + '<tbody>' + body + '<tr class="tot"><td>Total</td><td class="r num"></td><td class="r num">' + R.bo.cases + '</td><td class="r num">' + money(R.bo.cases * pc) + '</td><td></td></tr></tbody></table></div></section>';
}
function vSoirHours(R) {
  var slots = Object.keys(R.hours).map(Number); if (!slots.length) return '';
  var a = Math.min.apply(null, slots), b = Math.max.apply(null, slots), max = 1, s, hasVip = !!R.ent.vip;
  for (s = a; s <= b; s++) { var hb = R.hours[s] || {}; max = Math.max(max, hb.ent || 0, hb.vip || 0, hb.cmd || 0); }
  var step = max > 400 ? 100 : max > 150 ? 50 : max > 60 ? 20 : max > 25 ? 10 : 5, top = Math.ceil(max / step) * step;
  var W = 1100, H = 260, L = 40, B = 28, TP = 10, n = b - a + 1, bw = (W - L - 8) / n, g = '', y;
  for (y = 0; y <= top; y += step) { var yy = TP + (H - TP - B) * (1 - y / top); g += '<line x1="' + L + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + y + '</text>'; }
  var pk = a, pv = -1;
  for (var k = 0; k < n; k++) {
    var sl = a + k, h = (sl + slot0()) % 24, x = L + 4 + k * bw, v = R.hours[sl] || { ent: 0, vip: 0, cmd: 0, rec: 0 }, ser = [['ent', 'var(--s1)', 'entrées']].concat(hasVip ? [['vip', 'var(--s3)', 'tables VIP']] : []).concat([['cmd', 'var(--s2)', 'commandes']]), half = Math.max(2, (bw - 6) / ser.length);
    ser.forEach(function (z, j) { var val = v[z[0]] || 0; if (!val) return; var hg = (H - TP - B) * val / top;
      g += '<rect x="' + (x + 3 + j * half) + '" y="' + (H - B - hg) + '" width="' + (half - 1) + '" height="' + hg + '" rx="3" fill="' + z[1] + '"><title>' + h + ' h : ' + val + ' ' + z[2] + (j === 0 && v.rec ? ', ' + money(v.rec) + ' encaissés' : '') + '</title></rect>'; });
    if ((v.ent || 0) + (v.cmd || 0) > pv) { pv = (v.ent || 0) + (v.cmd || 0); pk = h; }
    g += '<text x="' + (x + bw / 2) + '" y="' + (H - 9) + '" text-anchor="middle">' + h + 'h</text>';
  }
  return '<section><h3>Heure par heure</h3><p class="lead">Activité la plus forte entre ' + pk + ' h et ' + ((pk + 1) % 24) + ' h.</p>' +
    '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Entrées, tables VIP et commandes par heure">' + g + '</svg>' +
    '<div class="legend"><span><span class="dot" style="background:var(--s1)"></span>Entrées (payantes + préventes)</span>' + (hasVip ? '<span><span class="dot" style="background:var(--s3)"></span>Tables VIP</span>' : '') + '<span><span class="dot" style="background:var(--s2)"></span>Commandes de boissons</span></div></section>';
}
function vSoirApp(R) {
  var ids = Object.keys(R.perAp).sort(function (a, b) { return R.perAp[a].nom.localeCompare(R.perAp[b].nom); });
  if (!ids.length) return '';
  return '<section><h3>Par appareil</h3><p class="lead">Ce que chaque appareil a enregistré.</p><div class="scroll"><table><thead><tr><th>Appareil</th><th class="r">Entrées</th><th class="r">Tables VIP</th><th class="r">Cases vendues</th><th class="r">Commandes</th><th class="r">Cases barrées</th><th class="r">Cash</th><th class="r">Bancontact</th><th class="r">Total</th></tr></thead><tbody>' +
    ids.map(function (i) { var a = R.perAp[i]; return '<tr><td><strong>' + esc(a.nom) + '</strong></td><td class="r num">' + a.entrees + '</td><td class="r num">' + a.vip + '</td><td class="r num">' + a.cases + '</td><td class="r num">' + a.commandes + '</td><td class="r num">' + a.barrees + '</td><td class="r num">' + money(a.cash) + '</td><td class="r num">' + money(a.bc) + '</td><td class="r num"><strong>' + money(a.recette) + '</strong></td></tr>'; }).join('') +
    (ids.length > 1 ? '<tr class="tot"><td>Total</td><td class="r num">' + (R.ent.personnes + R.ent.preventes) + '</td><td class="r num">' + (R.ent.vip || 0) + '</td><td class="r num">' + R.tk.cases + '</td><td class="r num">' + R.bo.commandes + '</td><td class="r num">' + R.bo.cases + '</td><td class="r num">' + money(R.cash) + '</td><td class="r num">' + money(R.bc) + '</td><td class="r num">' + money(R.recette) + '</td></tr>' : '') +
    '</tbody></table></div></section>';
}
function soirDesc(r) {
  if (r.type === 'prevente') return 'Prévente ' + esc(r.code || '');
  if (r.type === 'ticket') return plur(+r.cases || 0, 'case');
  if (r.type === 'commande') return (r.lignes || []).map(function (l) { return l.quantite + ' × ' + esc(l.libelle); }).join(', ') + ' (' + plur(+r.totalCases || 0, 'case') + ')';
  return (r.lignes || []).map(function (l) { return l.quantite + ' × ' + esc(l.libelle); }).join(', ');
}
var SOIR_TYPE = { entree: 'Entrée', prevente: 'Prévente', ticket: 'Tickets', commande: 'Boissons' };
function vSoirAnn(R) {
  if (!R.ann.length) return '<section><h3>Enregistrements annulés</h3><p class="empty">Aucun enregistrement annulé.</p></section>';
  return '<section><h3>Enregistrements annulés</h3><p class="lead">' + R.ann.length + ' enregistrement' + (R.ann.length > 1 ? 's' : '') + ', compté' + (R.ann.length > 1 ? 's' : '') + ' dans aucun total :</p><div class="scroll"><table class="cancel"><thead><tr><th>Heure</th><th>Appareil</th><th>Caisse</th><th>Détail</th><th class="r">Montant</th></tr></thead><tbody>' +
    R.ann.sort(function (x, y) { return x.r.horodatage < y.r.horodatage ? -1 : 1; }).map(function (x) { var r = x.r;
      return '<tr><td class="num">' + r.horodatage.slice(11, 16) + '</td><td>' + esc(x.apNom) + '</td><td>' + (SOIR_TYPE[r.type] || esc(r.type)) + '</td><td>' + soirDesc(r) + (r.annulation.motif ? '<br><span class="motif">' + esc(r.annulation.motif) + '</span>' : '') + '</td><td class="r num">' + (r.paiement ? money(r.total) : r.type === 'commande' ? plur(+r.totalCases || 0, 'case') : '') + '</td></tr>'; }).join('') +
    '</tbody></table></div></section>';
}
function soirCsv() {
  var list = soirFiltered(), R = soirStats(list), pc = R.pc, tag = 'soiree_' + (F.soiree === 'all' ? 'tout' : F.soiree) + (F.bar === 'all' ? '' : '_' + F.bar);
  var a = [['Section', 'Libellé', 'Catégorie', 'Format', 'Quantité', 'Cases', 'Montant / valeur (€)']];
  a.push(['Recette', 'Total', '', '', '', '', R.recette], ['Recette', 'Cash', '', '', '', '', R.cash], ['Recette', 'Bancontact', '', '', '', '', R.bc]);
  Object.keys(R.ent.produits).forEach(function (k) { var e = R.ent.produits[k]; a.push(['Entrées', e.libelle, '', '', e.q, '', e.m]); });
  a.push(['Entrées', 'Préventes (QR)', '', '', R.ent.preventes, '', 0]);
  if (R.ent.forcees) a.push(['Entrées', 'dont doublons acceptés', '', '', R.ent.forcees, '', '']);
  a.push(['Tickets', 'Cases vendues', '', '', R.tk.ventes, R.tk.cases, R.tk.recette], ['Tickets', 'Cartes complètes', '', '', R.tk.cartes, '', ''], ['Tickets', 'Cases à l’unité', '', '', R.tk.seules, '', '']);
  Object.keys(R.bo.produits).map(function (k) { return R.bo.produits[k]; }).sort(function (x, y) { return x.cat.localeCompare(y.cat) || y.cases - x.cases; }).forEach(function (p) { a.push(['Boissons', p.libelle, p.cat, p.format || '', p.q, p.cases, p.cases * pc]); });
  a.push(['Boissons', 'Total cases barrées', '', '', R.bo.commandes, R.bo.cases, R.bo.cases * pc], ['Cases', 'Non barrées (vendues − barrées)', '', '', '', R.tk.cases - R.bo.cases, '']);
  download('bilan-soiree_' + tag + '.csv', a);
  var e = [['Soirée', 'Appareil', 'Heure', 'ID', 'Caisse', 'Détail', 'Cases', 'Total (€)', 'Cash (€)', 'Bancontact (€)', 'Mode', 'Annulé', 'Motif']];
  list.slice().sort(function (x, y) { return x.r.horodatage < y.r.horodatage ? -1 : 1; }).forEach(function (x) { var r = x.r, p = r.paiement || {};
    e.push([x.night, x.apNom, r.horodatage.slice(0, 16).replace('T', ' '), r.id, SOIR_TYPE[r.type] || r.type, soirDesc(r).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      r.type === 'ticket' ? r.cases : r.type === 'commande' ? r.totalCases : '', r.paiement ? r.total : '', r.paiement ? p.cash : '', r.paiement ? p.bancontact : '', p.mode || '', r.annulation ? 'oui' : '', r.annulation ? r.annulation.motif : '']); });
  setTimeout(function () { download('bilan-enregistrements_' + tag + '.csv', e); }, 400);
  toast('Deux fichiers pour Excel : bilan et enregistrements');
}

/* ---------- Export pour Excel (CSV ; séparateur point-virgule, virgule décimale) ---------- */
function csvCell(x) { var s = typeof x === 'number' ? String(r2(x)).replace('.', ',') : String(x == null ? '' : x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function download(name, rows) {
  var txt = '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportCsv() {
  if (F.caisse === 'soiree') { soirCsv(); return; }
  var list = filtered(), S = stats(list), tag = (F.caisse || '') + '_' + (F.soiree === 'all' ? 'tout' : F.soiree) + (F.bar === 'all' ? '' : '_' + F.bar);
  var arts = [['Catégorie', 'Article', 'Quantité', 'Montant (€)']];
  Object.keys(S.art).map(function (k) { return S.art[k]; }).sort(function (x, y) { return x.cat.localeCompare(y.cat) || y.m - x.m; }).forEach(function (a) { arts.push([a.cat, a.libelle, a.q, a.m]); });
  download('bilan-articles_' + tag + '.csv', arts);
  var vs = [[T().per, T().pdv, 'Heure', 'ID vente', 'Articles', 'Total (€)', 'Cash (€)', 'Bancontact (€)', 'Mode', 'Annulée', 'Motif']];
  list.sort(function (x, y) { return x.v.horodatage < y.v.horodatage ? -1 : 1; }).forEach(function (s) { var v = s.v, p = v.paiement;
    var lm = (v.lignes || []).reduce(function (a, l) { return a + (isLivLine(l) ? +l.total || 0 : 0); }, 0);
    vs.push([s.soiree, s.bar, v.horodatage.slice(0, 16).replace('T', ' '), v.id, (v.lignes || []).map(function (l) { return l.quantite + ' x ' + l.libelle; }).join(', '), v.total, p.cash, p.bancontact, p.mode, v.annulation ? 'oui' : '', v.annulation ? v.annulation.motif : '', lm || '', lm && (v.livraisonAjoutee || v.venteLiee) ? 'oui' : '']); });
  vs[0].push('Livraison (€)', 'Livraison après paiement');
  if (F.caisse === 'sapin') { vs[0].push('livraison_nom', 'livraison_adresse', 'livraison_telephone', 'facture_societe', 'facture_tva', 'facture_email', 'facture_payee', 'reste_du', 'facture_suivi');
    list.forEach(function (s, i) { var v = s.v, c = v.livraison || {}, f = v.facture && typeof v.facture === 'object' ? v.facture : null, np = vNonPaye(v), sv = f ? fsGet(v.id, s.soiree) : {};
      var row = vs[i + 1]; while (row.length < 13) row.push('');
      row.push(c.nom || '', c.adresse || '', c.telephone || '', f ? f.societe || '' : '', f ? f.tva || '' : '', f ? f.email || '' : '', f ? (f.payee === false ? 'non' : 'oui') : '', np && !sv.virement ? np : '', f ? [sv.etablie ? 'établie' + (sv.numero ? ' ' + sv.numero : '') : 'à établir', sv.virement ? 'payée par virement' : ''].filter(Boolean).join(', ') : ''); }); }
  setTimeout(function () { download('bilan-ventes_' + tag + '.csv', vs); }, 400);
  var CR = caisseRows();
  if (CR.length) {
    var cs = [[T().per, T().pdv, 'Fond (€)', 'Ventes cash (€)', 'Apports (€)', 'Retraits (€)', 'Recettes retirées (€)', 'Dépôts au coffre (€)', 'Attendu (€)', 'Compté (€)', 'Écart (€)', 'Laissé pour demain (€)', 'Statut caisse', 'Comptages', 'Livraisons', 'Livraisons (€)', 'Livraisons après paiement', 'Livraisons après paiement (€)', 'Ouvertures du tiroir', 'Ouvertures sans vente', 'Remises sur article (€)', 'Remises sur ticket (€)', 'Remises total (€)']];
    CR.forEach(function (r) {
      var c = r.c, L = S.liv.rows[r.day + '|' + r.barId] || { n: 0, m: 0, na: 0, ma: 0 }, rec = 0, cof = 0;
      if (c && typeof c === 'object') (c.mouvements || []).forEach(function (m) { var k = m && cKind(m); if (k === 'recette') rec += cNum(m.montant); else if (k === 'coffre') cof += cNum(m.montant); });
      var st = c && typeof c === 'object' ? cStatus(r) : null;
      cs.push([r.day, r.bar].concat(st ? [cNum(c.fondDeCaisse), cNum(c.ventesCash), cNum(c.apports), cNum(c.retraits), rec, cof, cNum(c.attendu), st.counted ? cNum(c.compte) : '', st.counted ? cNum(c.ecart) : '', st.counted && typeof c.laissePourDemain === 'number' ? c.laissePourDemain : '', st.label, (c.comptages || []).length]
        : ['', '', '', '', '', '', '', '', '', '', r.has ? 'Rien saisi' : 'Non disponible (ancienne version)', '']).concat([L.n, L.m, L.na, L.ma, r.tir ? r.tir.length : '', r.tir ? r.nsv : '']).concat((function (R) { return [R.lig, R.tic, R.lig + R.tic]; })(S.remRows[r.day + '|' + r.barId] || { lig: 0, tic: 0 })));
    });
    setTimeout(function () { download('bilan-caisse_' + tag + '.csv', cs); }, 800);
    toast('Trois fichiers pour Excel : articles, ventes et caisse');
  } else toast('Deux fichiers pour Excel : articles et ventes');
}

/* ---------- Exemples (deux bars, une soirée de 19 h à 3 h 30) ---------- */
function demoFiles() {
  var seed = 17; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var CAT = [
    ['Softs', [['s1', 'Eau plate', 2], ['s2', 'Eau pétillante', 2], ['s3', 'Cola', 2.5], ['s4', 'Jus d\u2019orange', 2.5]], 0.22],
    ['Bières', [['b1', 'Bière pression 25 cl', 2.5], ['b2', 'Bière pression 50 cl', 4.5], ['b3', 'Bière spéciale', 4]], 0.45],
    ['Vins', [['v1', 'Verre de vin rouge', 4], ['v2', 'Verre de vin blanc', 4], ['v3', 'Verre de rosé', 4], ['v4', 'Bouteille de vin', 18]], 0.13],
    ['Cocktails', [['cocktails-mojito', 'Mojito', 7], ['cocktails-spritz', 'Spritz', 8]], 0.15],
    ['Boissons chaudes', [['c1', 'Café', 2], ['c2', 'Thé', 2]], 0.05]];
  function pickCat() { var r = rnd(), acc = 0; for (var i = 0; i < CAT.length; i++) { acc += CAT[i][2]; if (r < acc) return CAT[i]; } return CAT[1]; }
  var weights = { 19: 3, 20: 6, 21: 9, 22: 12, 23: 13, 0: 11, 1: 8, 2: 5, 3: 2 };
  function iso(day, h, m, s) { return day + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '+02:00'; }
  var bars = [{ id: 'pdv1', nom: 'Bar 1', k: 1 }, { id: 'pdv2', nom: 'Bar 2', k: 0.7 }], out = [];
  bars.forEach(function (bar) {
    var byDay = { '2026-10-17': [], '2026-10-18': [] };
    Object.keys(weights).forEach(function (hs) {
      var h = +hs, n = Math.round(weights[h] * 4.2 * bar.k * (0.85 + rnd() * 0.3)), day = h >= 12 ? '2026-10-17' : '2026-10-18';
      var mins = []; for (var i = 0; i < n; i++) mins.push(Math.floor(rnd() * 3600)); mins.sort(function (a, b) { return a - b; });
      mins.forEach(function (t) {
        if (h === 3 && t > 1800) return;
        var nl = rnd() < 0.55 ? 1 : rnd() < 0.7 ? 2 : 3, lines = [], used = {};
        for (var j = 0; j < nl; j++) { var c = pickCat(), it = c[1][Math.floor(rnd() * c[1].length)]; if (used[it[0]]) continue; used[it[0]] = 1;
          var q = rnd() < 0.7 ? 1 : rnd() < 0.7 ? 2 : 4, base = it[2] * q, rem = rnd() < 0.03 ? { type: 'pourcentage', valeur: 50 } : null;
          lines.push({ produitId: it[0], categorie: c[0], libelle: it[1], articleLibre: false, prixUnitaire: it[2], quantite: q, remise: rem, total: rem ? Math.ceil(base * 50) / 100 : base }); }
        if (rnd() < 0.02) lines.push({ produitId: null, categorie: '', libelle: 'Cocktail du jour', articleLibre: true, prixUnitaire: 6, quantite: 1, remise: null, total: 6 });
        var sub = r2(lines.reduce(function (a, l) { return a + l.total; }, 0)), rt = rnd() < 0.015 ? { type: 'montant', valeur: 2 } : null, tot = rt ? Math.max(0, r2(sub - 2)) : sub;
        var r = rnd(), pay = r < 0.42 ? { mode: 'cash', cash: tot, bancontact: 0 } : r < 0.95 ? { mode: 'bancontact', cash: 0, bancontact: tot } : { mode: 'mixte', cash: Math.min(tot, 5), bancontact: r2(tot - Math.min(tot, 5)) };
        var list = byDay[day], v = { id: bar.id + '-' + day.replace(/-/g, '') + '-' + String(list.length + 1).padStart(4, '0'), horodatage: iso(day, h, Math.floor(t / 60), t % 60), pointDeVente: { id: bar.id, nom: bar.nom }, lignes: lines, sousTotal: sub, remiseTicket: rt, total: tot, paiement: pay };
        list.push(v);
      });
    });
    var motifs = ['erreur de saisie', 'client remboursé', ''];
    byDay['2026-10-17'][Math.floor(rnd() * 40) + 20].annulation = { horodatage: '2026-10-17T22:41:10+02:00', motif: motifs[0] };
    if (bar.id === 'pdv1') byDay['2026-10-18'][5].annulation = { horodatage: '2026-10-18T00:20:03+02:00', motif: motifs[1] };
    Object.keys(byDay).forEach(function (day) {
      var all = byDay[day], ok = all.filter(function (v) { return !v.annulation; });
      out.push({ name: 'ventes_' + day + '_' + bar.nom.toLowerCase().replace(/\s+/g, '-') + '.json', data: { format: 'caisse-bar/ventes', formatVersion: 1, date: day, pointDeVente: { id: bar.id, nom: bar.nom }, catalogueVersion: 2, miseAJour: day + 'T23:59:00+02:00',
        nombreVentes: ok.length, nombreAnnulations: all.length - ok.length, totalJournee: r2(ok.reduce(function (a, v) { return a + v.total; }, 0)),
        totalCash: r2(ok.reduce(function (a, v) { return a + v.paiement.cash; }, 0)), totalBancontact: r2(ok.reduce(function (a, v) { return a + v.paiement.bancontact; }, 0)), ventes: all } });
    });
  });
  // un export plus ancien du Bar 1 (doublon) pour montrer la détection
  var old = JSON.parse(JSON.stringify(out[0])); old.name = 'ventes_2026-10-17_bar-1 (1).json'; old.data.miseAJour = '2026-10-17T21:30:00+02:00'; old.data.ventes = old.data.ventes.slice(0, 60);
  out.push(old);
  return out;
}


/* ================= Coquille Admin ================= */
var ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  bilan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
  catalogue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  pdv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  parametres: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  bar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14l-7 8z"/><path d="M12 12v7"/><path d="M8 20h8"/></svg>',
  chloro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3v3M15.5 4.5h3"/></svg>',
  sapin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2"/></svg>',
  cloture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M8 3v3M16 3v3"/><path d="M8 15h3"/></svg>'
};
/* Ajouter un module = ajouter une entrée ici (ready:true + render). ctx = contexte du Bilan et du Catalogue. */
var MODULES = [
  { id: 'sapin', nom: 'Gestion d’événement', court: 'Gestion d’événement', ready: true, ctx: 'sapin', render: function () { renderSub(); },
    desc: 'Catalogue (points de vente, articles par catégorie), stock, caisse, bilan et historique des ventes.' },
  { id: 'chloro', nom: 'Soirée à tickets', court: 'Soirée à tickets', ready: true, ctx: 'soiree', render: function () { renderSub(); },
    desc: 'Caisse Soirée : catalogue (entrées, prix de la case, boissons en cases) et bilan de la soirée.' },
  { id: 'parametres', nom: 'Paramètres', court: 'Paramètres', ready: true, render: function () { renderSub(); },
    desc: 'Données de démonstration : charger un exemple ou tout effacer.' }
];
var MOD = 'accueil';
var SUBS = {
  bar: [{ id: 'catalogue', nom: 'Catalogue', render: function () { renderCatalogue(); } }, { id: 'bilan', nom: 'Bilan', render: function () { renderBilan(); } }],
  chloro: [{ id: 'catalogue', nom: 'Catalogue', render: function () { renderCatalogue(); } }, { id: 'stock', nom: 'Stock', render: function () { renderStock(); } }, { id: 'bilan', nom: 'Bilan', render: function () { renderBilan(); } }],
  sapin: [{ id: 'catalogue', nom: 'Catalogue', render: function () { renderCatalogue(); } }, { id: 'stock', nom: 'Stock', render: function () { renderSapStock(); } }, { id: 'caisse', nom: 'Caisse', render: function () { renderSapCaisse(); } }, { id: 'commandes', nom: 'Commandes', render: function () { renderSapCommandes(); } }, { id: 'factures', nom: 'Factures', render: function () { renderSapFactures(); } }, { id: 'livraisons', nom: 'Livraisons', render: function () { renderSapLivraisons(); } }, { id: 'bilan', nom: 'Bilan', render: function () { renderBilan(); } }, { id: 'hist', nom: 'Historique de vente', render: function () { renderSapHist(); } }]
};
var SUB = { bar: 'catalogue', chloro: 'catalogue', sapin: 'catalogue' };
/* Anciennes adresses (#bilan, #catalogue, #stock) : renvoyées vers le nouveau menu */
SUBS.parametres = [{ id: 'apparence', nom: 'Apparence de l’app', render: function () { renderParametres(); } }, { id: 'ticket', nom: 'Apparence du ticket', render: function () { renderParametres(); } }, { id: 'fonctionnalites', nom: 'Fonctionnalités', render: function () { renderParametres(); } }, { id: 'securite', nom: 'Sécurité', render: function () { renderParametres(); } }];
SUB.parametres = 'apparence';
SUBS.chloro = [{ id: 'catalogue', nom: 'Catalogue', render: function () { renderCatalogue(); } }, { id: 'bilan', nom: 'Bilan', render: function () { renderBilan(); } }];
(function () { var i = SUBS.sapin.map(function (x) { return x.id; }).indexOf('stock') + 1; SUBS.sapin.splice(i, 0, { id: 'stockevt', nom: 'Comptage du stock', render: function () { renderStock(); } }); })();
var SUBS_SAPIN_ALL = SUBS.sapin.slice(), MODULES_ALL = MODULES.slice();
/* Menus selon Admin › Paramètres › Fonctionnalités */
function featApply() {
  try { document.documentElement.setAttribute('data-theme', themeGet().mode === 'sombre' ? 'dark' : 'light'); } catch (e) {}
  var want = { catalogue: 1, stock: FEAT('stock'), stockevt: FEAT('stockEvenement'), caisse: FEAT('fond'), commandes: FEAT('commandes'), factures: FEAT('facture'), livraisons: FEAT('gestionLivraisons'), bilan: 1, hist: FEAT('historiqueAdmin') };
  SUBS.sapin = SUBS_SAPIN_ALL.filter(function (x) { return want[x.id]; });
  if (!SUBS.sapin.some(function (x) { return x.id === SUB.sapin; })) SUB.sapin = 'catalogue';
  MODULES = MODULES_ALL.filter(function (m) { return m.id !== 'chloro' || FEAT('soiree'); });
  if (MOD !== 'accueil' && !modById(MOD)) MOD = 'accueil';
}
function featPruneAdmin(root) {
  root.querySelectorAll('[data-a="theme"]').forEach(function (el) { el.remove(); }); // clair / sombre : Paramètres › Apparence de l’app
  function rm(sel, f) { if (!FEAT(f)) root.querySelectorAll(sel).forEach(function (el) { el.remove(); }); }
  rm('[data-cx="form"][data-v="retrait"],[data-cx="form"][data-v="apport"]', 'mouvements');
  rm('[data-cx="form"][data-v="comptage"]', 'decompte');
  rm('[data-c="pdvAdd"]', 'multiPdv');
  if (!FEAT('prefixe')) root.querySelectorAll('[data-cf="c.prefixe"]').forEach(function (el) { (el.closest('label') || el).remove(); });
}
var OLD_HASH = { evenement: ['sapin', 'catalogue'] };
function hashPart(h) {
  var p = (h || '').replace('#', '').split('/');
  if (OLD_HASH[p[0]]) p = OLD_HASH[p[0]].slice();
  if (SUBS[p[0]] && SUBS[p[0]].some(function (x) { return x.id === p[1]; })) SUB[p[0]] = p[1];
  return p[0];
}
function curSub() { return SUBS[MOD] ? SUB[MOD] : null; }
featApply();
(function () { var h = hashPart(location.hash); if (h && MODULES.some(function (m) { return m.id === h; })) { MOD = h; try { history.replaceState(null, '', '#' + h + (SUBS[h] ? '/' + SUB[h] : '')); } catch (e) {} } })();
function modById(id) { return MODULES.filter(function (m) { return m.id === id; })[0]; }
function go(id) {
  MOD = id;
  try { history.replaceState(null, '', '#' + id + (SUBS[id] ? '/' + SUB[id] : '')); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', function () { var s0 = JSON.stringify(SUB), h = hashPart(location.hash); if ((h === 'accueil' || modById(h)) && (h !== MOD || s0 !== JSON.stringify(SUB))) { MOD = h; render(); } });

function vShell() {
  var tabs = [{ id: 'accueil', court: 'Accueil', ready: true, ic: 'home' }].concat(MODULES.map(function (m) { return { id: m.id, court: m.court, ready: m.ready, ic: m.id }; }));
  return '<header class="shell"><div class="in"><div class="brand"><img src="' + (CLIENT.logoClient || themeLogo('square')) + '" alt=""><div class="name"><b>Admin</b><span>' + esc(themeGet().nom) + '</span></div>' +
    '<button class="ghost" data-a="theme" aria-label="Changer de thème">' + (isDark() ? '☀︎ <span class="lbl">Clair</span>' : '☾ <span class="lbl">Sombre</span>') + '</button></div>' +
    '<nav class="nav" aria-label="Modules">' + tabs.map(function (t) {
      return '<button class="' + (MOD === t.id ? 'on' : '') + '" data-a="go" data-v="' + t.id + '"' + (MOD === t.id ? ' aria-current="page"' : '') + '>' + ICONS[t.ic] + esc(t.court) + (t.ready ? '' : '<span class="soon">bientôt</span>') + '</button>';
    }).join('') + '</nav>' + (SUBS[MOD] ? vSubNav() : '') + '</div></header>';
}
function bilanStatus() {
  var act = activeFiles();
  if (!act.length) return 'Aucun fichier chargé';
  var ns = soirees().length;
  if (F.caisse === 'soiree') { var R0 = soirStats(soirRecs()); return act.length + ' fichier' + (act.length > 1 ? 's' : '') + ' · ' + ns + ' soirée' + (ns > 1 ? 's' : '') + ' · ' + money(R0.recette); }
  var S = stats(allSales());
  return act.length + ' fichier' + (act.length > 1 ? 's' : '') + ' · ' + ns + ' soirée' + (ns > 1 ? 's' : '') + ' · ' + money(S.total);
}
function renderHome() {
  var db = demoDb(), cat = (db[DEMO_CAT_REPO] || {})['catalogue.json'], nv = Object.keys(db[DEMO_SALES_REPO] || {}).filter(function (k) { return /^sapin\/\d{4}-\d{2}-\d{2}_/.test(k); }).length;
  document.getElementById('mod').innerHTML =
    '<div class="band"><div class="home-hero"><h2>Administration de la caisse</h2><p>Version de démonstration : les données restent dans ce navigateur et sont partagées avec l’app Caisse ouverte sur le même appareil.</p></div></div>' +
    '<div class="mods">' + MODULES.map(function (m) {
      return '<button class="mod" data-a="go" data-v="' + m.id + '"><span class="ic">' + ICONS[m.id] + '</span><h3>' + esc(m.nom) + '</h3><p>' + esc(m.desc) + '</p>' +
        '<span class="st num">' + (m.id === 'sapin' ? (cat ? 'Catalogue publié' : 'Catalogue pas encore publié') + ' · ' + nv + ' fichier' + (nv > 1 ? 's' : '') + ' de ventes' : m.id === 'chloro' ? 'Entrées, cartes à cases, préventes' : featCount()) + '</span></button>';
    }).join('') + '</div>' + vApps() + vToast();
}
/* Liens vers les applications des caisses (même site GitHub Pages) */
var APPS = [
  { nom: 'Caisse', url: '../caisse/', desc: 'App de vente (tablette ou téléphone)' }
];
function vApps() {
  APPS = [{ nom: 'Caisse', url: '../caisse/', desc: 'App de vente (tablette ou téléphone)' }].concat(FEAT('soiree') ? [{ nom: 'Caisse Soirée', url: '../soiree/', desc: 'Entrées, cartes à cases, boissons, préventes' }] : []);
  return '<div class="apps"><h3>Application de vente</h3><div class="apps-row">' + APPS.map(function (a) {
    return '<a class="app-link" href="' + a.url + '" target="_blank" rel="noopener"><span class="ic">' + ICONS.pdv + '</span><span class="t"><b>' + esc(a.nom) + '</b><small>' + esc(a.desc) + '</small></span><span class="go" aria-hidden="true">↗</span></a>';
  }).join('') + '</div></div>';
}
/* ---------- Sous-menus des modules (Bar, Soirée démo, Gestion d’événement) ---------- */
function vSubNav() {
  var m = modById(MOD);
  return '<nav class="subnav" aria-label="' + esc(m ? m.nom : '') + '">' + SUBS[MOD].map(function (x) {
    var on = SUB[MOD] === x.id;
    return '<button class="rchip' + (on ? ' on' : '') + '" data-a="sub" data-v="' + MOD + '/' + x.id + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(x.nom) + '</button>';
  }).join('') + '</nav>';
}
function renderSub() { var s = SUBS[MOD].filter(function (x) { return x.id === SUB[MOD]; })[0] || SUBS[MOD][0]; SUB[MOD] = s.id; s.render(); }
/* ================= Gestion d’événement › Stock ================= */
/* Un fichier par saison dans le dépôt privé des ventes : sapin/stock/<id>.json (format agri-garden-caisse/stock).
   Les mouvements sont rangés par identifiant (pas de liste) et chaque appareil rejoue ses modifications sur la
   dernière version avant d'enregistrer : l'Admin et, plus tard, la Caisse pourront écrire sans s'écraser.
   Les articles viennent du catalogue de la Caisse (mêmes identifiants) ; le stock garde une copie
   (libellé, catégorie) de chaque article utilisé, pour rester lisible si le catalogue change. */
var SS_FMT = 'agri-garden-caisse/stock', SS_DIR = 'sapin/stock';
var SS = { loaded: false, loading: false, err: null, seasons: [], cat: null, catErr: null, cur: null, view: 'stands', form: null, newSeason: null, confirm: null, busy: false, standSel: 'all', mvFilter: 'all' };
function ssPath(id) { return SS_DIR + '/' + id + '.json'; }
function ssKey(id) { return KP + 'admin-sapstock:' + id; }
function ssGet(path) {
  return ghFetch('/repos/' + SALES_REPO + '/contents/' + path, {}, getToken()).then(function (j) { return { sha: j.sha, json: JSON.parse(b64utf8(j.content)) }; },
    function (e) { if (e.status === 404) return null; throw e; });
}
function ssPut(path, json, sha, msg) {
  var body = { message: msg, content: utf8b64(JSON.stringify(json, null, 1) + '\n') }; if (sha) body.sha = sha;
  return ghFetch('/repos/' + SALES_REPO + '/contents/' + path, { method: 'PUT', body: JSON.stringify(body) }, getToken());
}
function ssNorm(d) {
  d = d && typeof d === 'object' ? d : {};
  if (!d.mouvements || typeof d.mouvements !== 'object' || Array.isArray(d.mouvements)) d.mouvements = {};
  if (!d.articles || typeof d.articles !== 'object' || Array.isArray(d.articles)) d.articles = {};
  if (!d.stands || typeof d.stands !== 'object' || Array.isArray(d.stands)) d.stands = {};
  if (!d.depot) d.depot = { id: '', nom: '' };
  return d;
}
function ssApply(doc, op) {
  if (op.t === 'mv') { if (op.v == null) delete doc.mouvements[op.id]; else doc.mouvements[op.id] = op.v; }
  else if (op.t === 'art') doc.articles[op.id] = op.v;
  else if (op.t === 'depot') doc.depot = op.v;
  else if (op.t === 'stand') doc.stands[op.id] = op.v;
  return doc;
}
function ssDoc() { var c = SS.cur; if (!c) return null; var d = ssNorm(clone(c.doc)); c.ops.forEach(function (o) { ssApply(d, o); }); return d; }
function ssPersist() {
  var c = SS.cur; if (!c) return;
  lsSet(ssKey(c.id), c.ops.length || c.isNew ? JSON.stringify({ doc: c.doc, sha: c.sha, ops: c.ops, isNew: c.isNew, err: c.err || null }) : null);
}
function ssLocal() {
  var out = [];
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(KP + 'admin-sapstock:') === 0) { var o = JSON.parse(localStorage.getItem(k)); if (o && o.doc && o.doc.id) out.push(o); } } } catch (e) {}
  return out;
}
function ssErrText(e) {
  if (e && e.status === 0) return 'Hors ligne : les modifications sont gardées sur cet appareil et seront envoyées au retour d’internet.';
  if (e && (e.status === 403 || e.status === 404)) return 'Le jeton n’a pas le droit d’écrire dans le dépôt ' + SALES_REPO + '. Il lui faut « Contents : Read and write » sur ce dépôt (voir Paramètres › Tester l’accès aux dépôts).';
  return ghErrText(e);
}
function ssSave(tries) {
  var c = SS.cur; if (!c || c.saving || (!c.ops.length && !c.isNew)) return;
  if (!getToken()) { c.err = 'Appareil verrouillé : déverrouillez-le dans Paramètres pour enregistrer sur le serveur. Les modifications sont gardées sur cet appareil.'; ssPersist(); render(); return; }
  c.saving = true; c.err = null; render();
  var ops = c.ops.slice();
  ssGet(ssPath(c.id)).then(function (r) {
    var base = r ? ssNorm(r.json) : ssNorm(clone(c.doc));
    ops.forEach(function (o) { ssApply(base, o); });
    base.majLe = new Date().toISOString(); base.majPar = 'admin';
    return ssPut(ssPath(c.id), base, r && r.sha, 'Stock ' + (base.nom || c.id) + ' (Admin)').then(function (res) { return { doc: base, sha: res && res.content && res.content.sha }; });
  }).then(function (x) {
    c.saving = false; c.doc = x.doc; c.sha = x.sha; c.ops = c.ops.slice(ops.length); c.isNew = false; c.err = null; ssPersist();
    var s = SS.seasons.filter(function (y) { return y.id === c.id; })[0]; if (s) { s.doc = x.doc; s.sha = x.sha; s.local = false; }
    render(); if (c.ops.length) ssSave();
  }, function (e) {
    c.saving = false;
    if ((e.status === 409 || e.status === 422) && (tries || 0) < 2) { ssSave((tries || 0) + 1); return; }
    c.err = ssErrText(e); ssPersist(); render();
  });
}
function ssOp(list) { var c = SS.cur; if (!c) return; c.ops = c.ops.concat(list); ssPersist(); ssSave(); }
window.addEventListener('online', function () { if (SS.cur && (SS.cur.ops.length || SS.cur.isNew)) ssSave(); });

function ssLoad() {
  SS.loading = true; SS.err = null; SS.catErr = null; render();
  var tok = getToken(); SS.tok = !!tok;
  var pCat = ghGetCatalogue(SAPIN_REPO, tok).then(function (r) {
    SS.cat = r.json ? normalizeCat(r.json) : null;
    if (!r.json) SS.catErr = 'Le catalogue de la Caisse n’est pas encore publié : publiez-le dans Gestion d’événement › Catalogue.';
  }, function (e) { SS.catErr = 'Catalogue de la Caisse indisponible (' + ghErrText(e, 'de lire') + ') La liste vient des articles déjà présents dans le stock.'; });
  var pList = !tok ? Promise.resolve([]) : ghFetch('/repos/' + SALES_REPO + '/contents/' + SS_DIR, {}, tok).then(function (l) {
    return Promise.all((Array.isArray(l) ? l : []).filter(function (f) { return f.type === 'file' && /\.json$/i.test(f.name); }).map(function (f) {
      return ssGet(f.path).then(function (r) { return r && r.json && r.json.format === SS_FMT ? { id: f.name.replace(/\.json$/i, ''), sha: r.sha, doc: ssNorm(r.json) } : null; });
    }));
  }, function (e) { if (e.status === 404 || e.status === 409) return []; throw e; }).then(function (a) { return a.filter(Boolean); }, function (e) { SS.err = ssErrText(e); return []; });
  Promise.all([pCat, pList]).then(function (res) {
    SS.loading = false; SS.loaded = true; SS.seasons = res[1];
    ssLocal().forEach(function (o) { if (!SS.seasons.some(function (s) { return s.id === o.doc.id; })) SS.seasons.push({ id: o.doc.id, sha: o.sha, doc: ssNorm(o.doc), local: true }); });
    SS.seasons.sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    var keep = SS.cur && SS.seasons.some(function (s) { return s.id === SS.cur.id; }) ? SS.cur.id : SS.seasons[0] && SS.seasons[0].id;
    var pv = SS.cur && SS.cur.id === keep && (SS.view === 'mvts' || SS.view === 'stands') ? SS.view : null;
    SS.cur = null; if (keep) { ssOpen(keep); if (pv && SS.view !== pv) { SS.view = pv; render(); } } else render();
  });
}
function ssOpen(id) {
  var s = SS.seasons.filter(function (y) { return y.id === id; })[0], loc = null;
  try { loc = JSON.parse(lsGet(ssKey(id)) || 'null'); } catch (e) {}
  if (!s && !loc) return;
  var remote = s && !s.local;
  SS.cur = { id: id, doc: ssNorm(clone(remote ? s.doc : (loc ? loc.doc : s.doc))), sha: remote ? s.sha : loc ? loc.sha : s.sha, ops: loc ? loc.ops || [] : [], isNew: loc ? !!loc.isNew && !remote : false, err: loc ? loc.err : null, saving: false };
  SS.view = 'stands'; SS.form = null; SS.confirm = null; SS.newSeason = null;
  render();
  if (SS.cur.ops.length || SS.cur.isNew) ssSave();
}

/* Articles : catalogue (ordre des catégories) puis ceux du stock qui n'y sont plus */
function ssLabel(k, p) { return (k.prefixe === false ? '' : k.nom + ' ') + p.libelle; }
function ssGroups(doc) {
  var groups = [], seen = {};
  if (SS.cat) SS.cat.categories.forEach(function (k) {
    var items = k.produits.filter(function (p) { if (isLivProduct(p)) { seen[p.id] = 1; return false; } return true; }).map(function (p) { seen[p.id] = 1; return { id: p.id, libelle: ssLabel(k, p), cat: k.nom, actif: k.actif !== false && p.actif !== false }; });
    if (items.length) groups.push({ nom: k.nom, items: items });
  });
  var extra = Object.keys(doc.articles).filter(function (id) { return !seen[id]; }).map(function (id) { var a = doc.articles[id] || {}; return { id: id, libelle: a.libelle || id, cat: a.categorie || '', actif: true, gone: !!SS.cat }; });
  extra.sort(function (a, b) { return a.libelle.localeCompare(b.libelle); });
  if (extra.length) groups.push({ nom: SS.cat ? 'Plus dans le catalogue' : 'Articles du stock', items: extra, gone: !!SS.cat });
  return groups;
}
/* Stands : points de vente du catalogue (actifs, ou inactifs s'ils ont du stock), stand de stockage en premier,
   puis ceux qui n'apparaissent que dans les mouvements ou les ventes. */
function ssStands(doc, used) {
  var out = [], seen = {}, pdvs = SS.cat ? SS.cat.pointsDeVente : [];
  function add(id, nom, actif) { if (!id || seen[id]) return; seen[id] = 1; out.push({ id: id, nom: nom || (doc.stands[id] && doc.stands[id].nom) || (id === doc.depot.id && doc.depot.nom) || id, actif: actif !== false }); }
  var dp = pdvs.filter(function (p) { return p.id === doc.depot.id; })[0];
  add(doc.depot.id, dp ? dp.nom : doc.depot.nom, true);
  pdvs.forEach(function (p) { if (p.actif !== false || (used && used[p.id])) add(p.id, p.nom, p.actif); });
  Object.keys(used || {}).forEach(function (id) { add(id, used[id] !== 1 ? used[id] : null, true); });
  return out;
}
function ssStandName(doc, id) { var s = ssStands(doc, null).filter(function (x) { return x.id === id; })[0]; return s ? s.nom : (doc.stands[id] && doc.stands[id].nom) || id; }
/* Stock de chaque stand : livré + reçu − envoyé − vendu (ventes lues dans le dépôt, depuis le début de la saison) */
function ssCompute(doc, skipMid) {
  var q = {}, used = {};
  function cell(s, a) { var o = q[s] || (q[s] = {}); return o[a] || (o[a] = { liv: 0, inn: 0, out: 0, sold: 0, cmd: 0 }); }
  Object.keys(doc.mouvements).forEach(function (m) {
    var v = doc.mouvements[m]; if (!v || m === skipMid) return;
    Object.keys(v.lignes || {}).forEach(function (a) {
      var n = +v.lignes[a] || 0;
      if (v.type === 'livraison') { cell(v.stand, a).liv += n; used[v.stand] = used[v.stand] || 1; }
      else if (v.type === 'transfert') { cell(v.de, a).out += n; cell(v.vers, a).inn += n; used[v.de] = used[v.de] || 1; used[v.vers] = used[v.vers] || 1; }
    });
  });
  var sv = svSold(doc);
  Object.keys(sv.q).forEach(function (s) { used[s] = sv.names[s] || used[s] || 1; Object.keys(sv.q[s]).forEach(function (a) { cell(s, a).sold += sv.q[s][a]; }); });
  var cy = (ssStart(doc) || todayIso()).slice(0, 4), cq = FEAT('commandesStock') ? coQty(coDocFor(cy), doc.depot.id) : { q: {}, per: {}, names: {}, n: 0, pcs: 0 };
  Object.keys(cq.q).forEach(function (sid) { used[sid] = used[sid] || cq.names[sid] || 1; Object.keys(cq.q[sid]).forEach(function (a) { cell(sid, a).cmd += cq.q[sid][a]; }); });
  Object.keys(q).forEach(function (s) { Object.keys(q[s]).forEach(function (a) { var c = q[s][a]; c.rest = c.liv + c.inn - c.out - c.sold - c.cmd; }); });
  return { q: q, used: used, sv: sv, cmd: { n: cq.n, year: cy, pcs: cq.pcs, per: cq.per }, get: function (s, a) { return (q[s] && q[s][a]) || { liv: 0, inn: 0, out: 0, sold: 0, cmd: 0, rest: 0 }; } };
}
function ssStart(doc) {
  if (doc.debut) return doc.debut;
  var d = null; Object.keys(doc.mouvements).forEach(function (m) { var v = doc.mouvements[m]; if (v && v.date && (!d || v.date < d)) d = v.date; });
  return d;
}

/* ---------- Ventes de la Caisse (dossier sapin/ du dépôt ventes) ----------
   Chaque fichier est résumé une seule fois (gardé par son sha) : point de vente, jour, quantités par article. */
var SV = { loaded: false, loading: false, err: null, files: [], cache: null, at: null };
var SV_KEY = KP + 'admin-sapventes-3';
try { localStorage.removeItem(KP + 'admin-sapventes'); localStorage.removeItem(KP + 'admin-sapventes-2'); } catch (e) {}
function svCache() {
  if (!SV.cache) { try { SV.cache = JSON.parse(lsGet(SV_KEY) || '{}') || {}; } catch (e) { SV.cache = {}; } }
  return SV.cache;
}
function svSummary(d) {
  if (!d || d.format !== 'agri-garden-caisse/ventes' || !Array.isArray(d.ventes)) return { ok: false };
  var fp = d.pointDeVente || {}, s = { ok: true, key: (fp.id || '?') + '|' + (d.date || ''), maj: d.miseAJour || '', names: {}, q: {}, libres: 0, ids: [] };
  if (fp.id) s.names[fp.id] = fp.nom || fp.id;
  d.ventes.forEach(function (v) {
    if (!v || v.annulation || typeof v.horodatage !== 'string') return;
    if (v.commande && typeof v.commande === 'object' && v.commande.id) { s.cmdSales = (s.cmdSales || 0) + 1; return; } // déjà retirée du stock par la commande
    var pv = v.pointDeVente || fp, sid = pv.id || '?', day = v.horodatage.slice(0, 10);
    if (pv.id && pv.nom) s.names[pv.id] = pv.nom;
    s.ids.push(v.id);
    (v.lignes || []).forEach(function (l) {
      if (isLivLine(l)) return; // service : jamais déduit du stock
      if (!l.produitId) { s.libres += +l.quantite || 0; return; }
      var o = s.q[sid] || (s.q[sid] = {}), od = o[day] || (o[day] = {});
      od[l.produitId] = (od[l.produitId] || 0) + (+l.quantite || 0);
    });
  });
  return s;
}
function svLoad() {
  var tok = getToken(); if (!tok || SV.loading) return;
  SV.loading = true; SV.err = null; render();
  ghFetch('/repos/' + SALES_REPO + '/git/trees/HEAD?recursive=1', {}, tok).then(function (t) {
    var files = (t.tree || []).filter(function (x) { return x.type === 'blob' && /^sapin\//.test(x.path) && !/^sapin\/(stock|caisse|commandes|factures|livraisons)\//.test(x.path) && /\.json$/i.test(x.path); });
    var cache = svCache(), todo = files.filter(function (f) { return !cache[f.sha]; });
    return Promise.all(todo.map(function (f) { return bghRaw(f.path, tok).then(function (txt) { var s; try { s = svSummary(JSON.parse(txt)); } catch (e) { s = { ok: false }; } cache[f.sha] = s; }); })).then(function () {
      var keep = {}; files.forEach(function (f) { keep[f.sha] = cache[f.sha]; }); SV.cache = keep;
      try { localStorage.setItem(SV_KEY, JSON.stringify(keep)); } catch (e) {}
      SV.files = files; SV.loaded = true; SV.loading = false; SV.at = new Date(); render();
    });
  }, function (e) { if (e.status === 409) return { tree: [] }; throw e; }).catch(function (e) { SV.loading = false; SV.loaded = true; SV.err = bghErr(e); render(); });
}
/* Quantités vendues par stand et par article depuis le début de la saison (un fichier par point de vente et par jour : le plus récent gagne) */
function svSold(doc) {
  var res = { q: {}, names: {}, nFiles: 0, libres: 0, bad: 0, start: ssStart(doc), maxDay: null };
  if (!SV.loaded || !res.start) return res;
  var cache = svCache(), best = {};
  SV.files.forEach(function (f) { var s = cache[f.sha]; if (!s) return; if (!s.ok) { res.bad++; return; } if (!best[s.key] || s.maj > best[s.key].maj) best[s.key] = s; });
  var seen = {};
  Object.keys(best).forEach(function (k) {
    var s = best[k], counted = false;
    Object.keys(s.q).forEach(function (sid) { Object.keys(s.q[sid]).forEach(function (day) {
      if (day < res.start) return; counted = true;
      if (!res.maxDay || day > res.maxDay) res.maxDay = day;
      var o = res.q[sid] || (res.q[sid] = {}); Object.keys(s.q[sid][day]).forEach(function (a) { o[a] = (o[a] || 0) + s.q[sid][day][a]; });
    }); });
    if (counted) { res.nFiles++; res.libres += s.libres; Object.keys(s.names).forEach(function (id) { res.names[id] = s.names[id]; }); }
  });
  return res;
}
function ssMvList(doc) {
  return Object.keys(doc.mouvements).map(function (id) { return { id: id, v: doc.mouvements[id] }; }).filter(function (x) { return x.v && (x.v.type === 'livraison' || x.v.type === 'transfert'); })
    .sort(function (a, b) { return a.v.date < b.v.date ? 1 : a.v.date > b.v.date ? -1 : (a.v.creeLe || '') < (b.v.creeLe || '') ? 1 : -1; });
}
function ssArtName(doc, id) {
  var g = ssGroups(doc); for (var i = 0; i < g.length; i++) for (var j = 0; j < g[i].items.length; j++) if (g[i].items[j].id === id) return g[i].items[j].libelle;
  return id;
}
function ssPcs(n) { return fmtQ(n) + ' pièce' + (Math.abs(n) > 1 ? 's' : ''); }

/* ---------- Rendu ---------- */
function renderSapStock() {
  var el = document.getElementById('mod');
  if (SS.loaded && !SS.tok && getToken()) SS.loaded = false; // déverrouillé depuis le dernier chargement
  if (!SS.loaded && !SS.loading) { ssLoad(); return; }
  if (!SS.loaded) { el.innerHTML = ssBand('Stock', '') + '<main><section><p class="empty">Chargement du stock et du catalogue…</p></section></main>' + vToast(); return; }
  var alerts = ssAlerts();
  if (!SS.cur || SS.view === 'season') { el.innerHTML = ssBand('Stock', ssSeasonChips()) + '<main>' + alerts + vSsSeason() + '</main>' + vToast(); return; }
  if (!SV.loaded && !SV.loading && getToken()) { svLoad(); return; }
  var doc = ssDoc();
  if (SS.view === 'form') {
    var f = SS.form, tr = f.type === 'transfert';
    el.innerHTML = ssBand((f.mid ? 'Modifier ' : 'Encoder ') + (tr ? 'un transfert' : 'une livraison'), '<p class="soon-lead">' + esc(doc.nom) + (tr ? ' · d’un stand vers un autre' : ' · livrée au stand de stockage <strong>' + esc(ssStandName(doc, doc.depot.id)) + '</strong>') + '</p>') +
      '<main>' + alerts + vSsForm(doc) + '</main>' + vToast(); ssAfterRender(); return;
  }
  var nl = ssMvList(doc).length;
  el.innerHTML = ssBand('Stock · ' + esc(doc.nom), ssSeasonChips() + '<p class="soon-lead">Stand de stockage : <strong>' + esc(ssStandName(doc, doc.depot.id)) + '</strong> · ' + ssStatus() + '</p>' +
    '<div class="stabs" role="tablist" aria-label="Stock"><button role="tab" aria-selected="' + (SS.view === 'stands') + '" class="' + (SS.view === 'stands' ? 'on' : '') + '" data-ss="view" data-v="stands">Stock par stand</button><button role="tab" aria-selected="' + (SS.view === 'mvts') + '" class="' + (SS.view === 'mvts' ? 'on' : '') + '" data-ss="view" data-v="mvts">Mouvements <span class="num">(' + nl + ')</span></button></div>') +
    '<main>' + alerts + (SS.view === 'mvts' ? vSsMvts(doc) : vSsStands(doc)) + '</main>' + vToast();
}
function ssAfterRender() { if (SS.form && SS.form.focus) { var i = document.getElementById('ssq-' + SS.form.focus); SS.form.focus = null; if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } } }
function ssBand(title, extra) { return '<div class="band"><div class="band-top"><h1>' + title + '</h1></div>' + (extra || '') + '</div>'; }
function ssSeasonChips() {
  if (!SS.seasons.length) return '';
  return '<div class="rsel ssbar" role="group" aria-label="Saison">' + SS.seasons.map(function (s) {
    return '<button class="rchip' + (SS.cur && SS.cur.id === s.id && SS.view !== 'season' ? ' on' : '') + '" data-ss="season" data-v="' + esc(s.id) + '">' + esc(s.doc.nom || s.id) + '</button>';
  }).join('') + '<button class="rchip" data-ss="newSeason">+ Nouvelle saison</button><button class="rchip" data-ss="reload" title="Relire le stock et le catalogue sur le serveur">Actualiser</button></div>';
}
function ssStatus() {
  var c = SS.cur;
  if (c.saving) return '<span class="sv">Enregistrement…</span>';
  if (c.err) return '<span class="sv warn">' + (c.ops.length || c.isNew ? 'Pas encore enregistré sur le serveur' : 'Erreur') + '</span> <button class="ghost sm" data-ss="save">Réessayer</button>';
  if (c.ops.length || c.isNew) return '<span class="sv warn">En attente d’enregistrement</span>';
  var d = c.doc.majLe ? new Date(c.doc.majLe) : null;
  return '<span class="sv ok">Enregistré sur le serveur</span>' + (d && !isNaN(d) ? ' <span class="faint">(' + dmy(c.doc.majLe.slice(0, 10)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ')</span>' : '');
}
function ssAlerts() {
  var a = [];
  if (!getToken()) a.push('<div class="alert">Appareil verrouillé : le stock enregistré sur le serveur ne peut pas être lu. <button class="btn sm" data-a="go" data-v="parametres">Déverrouiller</button></div>');
  if (SS.err) a.push('<div class="alert err">' + SS.err + '</div>');
  if (SS.cur && SS.cur.err) a.push('<div class="alert err">' + SS.cur.err + '</div>');
  if (SS.catErr) a.push('<div class="alert">' + SS.catErr + '</div>');
  return a.length ? '<div class="alerts">' + a.join('') + '</div>' : '';
}
function vSsSeason() {
  var f = SS.newSeason || (SS.newSeason = { nom: 'Saison ' + new Date().getFullYear(), depot: '' });
  var pdvs = SS.cat ? SS.cat.pointsDeVente.filter(function (p) { return p.actif !== false; }) : [];
  if (!f.depot) { var spy = pdvs.filter(function (p) { return /spy/i.test(p.nom); })[0] || pdvs[0]; f.depot = spy ? spy.id : ''; }
  var h = '<section><h3>' + (SS.seasons.length ? 'Nouvelle saison' : 'Créer le stock de la saison') + '</h3><p class="lead">Un stock par saison. Toutes les livraisons de l’année s’y ajoutent ; les articles sont stockés au stand choisi ci-dessous.</p>';
  if (!pdvs.length) return h + '<p class="empty">Les points de vente viennent du catalogue de la Caisse, qui n’a pas pu être lu. Vérifiez la connexion, puis « Actualiser ».</p><button class="btn" data-ss="reload">Actualiser</button></section>';
  return h + '<form class="ssform" data-ss-form="season">' +
    '<label class="fl" for="ssNom">Nom de la saison</label><input type="text" id="ssNom" required value="' + esc(f.nom) + '">' +
    '<label class="fl" for="ssDepot">Stand de stockage (stock de base)</label><select id="ssDepot">' + pdvs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (f.depot === p.id ? ' selected' : '') + '>' + esc(p.nom) + '</option>'; }).join('') + '</select>' +
    '<div class="cbtns"><button class="pick" type="submit">Créer la saison</button>' + (SS.cur ? '<button class="btn" type="button" data-ss="view" data-v="stands">Annuler</button>' : '') + '</div></form></section>';
}
function ssActs() { return '<div class="cbtns"><button class="pick" data-ss="newLiv">+ Livraison</button><button class="pick" data-ss="newTr">+ Transfert</button></div>'; }
function svLine(doc, C) {
  if (!getToken()) return '<p class="hint">Ventes non déduites : déverrouillez l’appareil pour lire les fichiers de ventes.</p>';
  if (SV.loading) return '<p class="hint">Lecture des fichiers de ventes…</p>';
  if (SV.err) return '<div class="alert err">Ventes non déduites : ' + SV.err + ' <button class="btn sm" data-ss="sales">Réessayer</button></div>';
  var sv = C.sv, at = SV.at ? String(SV.at.getHours()).padStart(2, '0') + ':' + String(SV.at.getMinutes()).padStart(2, '0') : '';
  if (!sv.start) return '<p class="hint">Les ventes seront déduites à partir du premier mouvement de la saison.</p>';
  return '<p class="hint">Ventes déduites depuis le ' + dmy(sv.start) + ' : ' + sv.nFiles + ' fichier' + (sv.nFiles > 1 ? 's' : '') + ' de la Caisse' + (sv.maxDay ? ', jusqu’au ' + dmy(sv.maxDay) : '') + (at ? ' (lus à ' + at + ')' : '') + '. ' +
    (sv.libres ? sv.libres + ' article' + (sv.libres > 1 ? 's' : '') + ' libre' + (sv.libres > 1 ? 's' : '') + ' vendu' + (sv.libres > 1 ? 's' : '') + ' (hors catalogue) non déduit' + (sv.libres > 1 ? 's' : '') + '. ' : '') +
    (sv.bad ? sv.bad + ' fichier' + (sv.bad > 1 ? 's' : '') + ' illisible' + (sv.bad > 1 ? 's' : '') + ' ignoré' + (sv.bad > 1 ? 's' : '') + '. ' : '') +
    '<button class="ghost sm ssre" data-ss="sales">Relire les ventes</button></p>';
}
function vSsStands(doc) {
  var C = ssCompute(doc), stands = ssStands(doc, C.used), sel = SS.standSel;
  if (sel !== 'all' && !stands.some(function (s) { return s.id === sel; })) sel = SS.standSel = 'all';
  var chips = '<div class="rsel sschips" role="group" aria-label="Stand"><button class="chip' + (sel === 'all' ? ' on' : '') + '" data-ss="stand" data-v="all">Tous les stands</button>' +
    stands.map(function (s) { return '<button class="chip' + (sel === s.id ? ' on' : '') + '" data-ss="stand" data-v="' + esc(s.id) + '">' + esc(s.nom) + '</button>'; }).join('') + '</div>';
  var head, rows = '', tot = {}, groups = ssGroups(doc), cols;
  function has(id) { return stands.some(function (s) { var c = C.get(s.id, id); return c.liv || c.inn || c.out || c.sold || c.cmd; }); }
  var subDone = true; /* caisse : pas de sous-total « sapins » */ function isAcc(g) { return /accessoire/i.test(g.nom || ''); }
  if (sel === 'all') {
    cols = stands.length + 2;
    head = '<tr><th>Article</th>' + stands.map(function (s) { return '<th class="r">' + esc(s.nom) + (s.id === doc.depot.id ? '<span class="sub">stockage</span>' : '') + '</th>'; }).join('') + '<th class="r">Total</th></tr>';
    groups.forEach(function (g) {
      var items = g.items.filter(function (it) { return g.gone ? has(it.id) : true; }); if (!items.length) return;
      if (!subDone && isAcc(g) && rows) { subDone = true; rows += '<tr class="sssub"><td>Sous-total sapins</td>' + stands.map(function (s) { return '<td class="r num">' + fmtQ(tot[s.id] || 0) + '</td>'; }).join('') + '<td class="r num">' + fmtQ(tot._ || 0) + '</td></tr>'; }
      rows += '<tr class="ssgrp"><td colspan="' + cols + '">' + esc(g.nom) + '</td></tr>' + items.map(function (it) {
        var sum = 0, any = has(it.id);
        var tds = stands.map(function (s) { var c = C.get(s.id, it.id); sum += c.rest; tot[s.id] = (tot[s.id] || 0) + c.rest; var t = c.liv || c.inn || c.out || c.sold || c.cmd;
          return '<td class="r num' + (c.rest < 0 ? ' neg' : '') + '">' + (t ? fmtQ(c.rest) : '—') + '</td>'; }).join('');
        tot._ = (tot._ || 0) + sum;
        return '<tr' + (any ? '' : ' class="off"') + '><td>' + esc(it.libelle) + (it.actif ? '' : '<span class="sub">masqué en caisse</span>') + '</td>' + tds + '<td class="r num' + (sum < 0 ? ' neg' : '') + '"><b>' + (any ? fmtQ(sum) : '—') + '</b></td></tr>';
      }).join('');
    });
    if (rows) rows += '<tr class="sstot"><td>Total</td>' + stands.map(function (s) { return '<td class="r num">' + fmtQ(tot[s.id] || 0) + '</td>'; }).join('') + '<td class="r num">' + fmtQ(tot._ || 0) + '</td></tr>';
  } else {
    var wc = sel === doc.depot.id || !!(C.cmd.per && C.cmd.per[sel]), K = wc ? ['liv', 'inn', 'out', 'sold', 'cmd', 'rest'] : ['liv', 'inn', 'out', 'sold', 'rest']; cols = K.length + 1;
    head = '<tr><th>Article</th><th class="r">Livré</th><th class="r">Reçu</th><th class="r">Envoyé</th><th class="r">Vendu</th>' + (wc ? '<th class="r">Commandes</th>' : '') + '<th class="r">Restant</th></tr>';
    groups.forEach(function (g) {
      var items = g.items.filter(function (it) { var c = C.get(sel, it.id); return !g.gone || c.liv || c.inn || c.out || c.sold || c.cmd; }); if (!items.length) return;
      if (!subDone && isAcc(g) && rows) { subDone = true; rows += '<tr class="sssub"><td>Sous-total sapins</td>' + K.map(function (k) { return '<td class="r num">' + fmtQ(tot[k] || 0) + '</td>'; }).join('') + '</tr>'; }
      rows += '<tr class="ssgrp"><td colspan="' + cols + '">' + esc(g.nom) + '</td></tr>' + items.map(function (it) {
        var c = C.get(sel, it.id), any = c.liv || c.inn || c.out || c.sold || c.cmd;
        K.forEach(function (k) { tot[k] = (tot[k] || 0) + c[k]; });
        return '<tr' + (any ? '' : ' class="off"') + '><td>' + esc(it.libelle) + '</td>' + K.map(function (k) { return '<td class="r num' + (k === 'rest' && c.rest < 0 ? ' neg' : '') + '">' + (k === 'rest' ? '<b>' + (any ? fmtQ(c.rest) : '—') + '</b>' : c[k] ? fmtQ(c[k]) : '—') + '</td>'; }).join('') + '</tr>';
      }).join('');
    });
    if (rows) rows += '<tr class="sstot"><td>Total</td>' + K.map(function (k) { return '<td class="r num">' + fmtQ(tot[k] || 0) + '</td>'; }).join('') + '</tr>';
  }
  var neg = []; stands.forEach(function (s) { groups.forEach(function (g) { g.items.forEach(function (it) { if (C.get(s.id, it.id).rest < 0) neg.push(s.nom + ' : ' + it.libelle); }); }); });
  return '<section><div class="row-between"><h3>' + (sel === 'all' ? 'Stock restant par stand' : 'Stock de ' + esc(ssStandName(doc, sel))) + '</h3>' + ssActs() + '</div>' +
    '<p class="lead">' + (sel === 'all' ? 'Restant = livré + reçu des autres stands − envoyé − vendu − commandes (livraison : au stand de stockage ; retrait : au stand du retrait). Choisissez un stand pour le détail.' : 'Détail du stand : livraisons, transferts reçus et envoyés, ventes de la caisse' + (sel === doc.depot.id ? ', commandes en livraison et à retirer ici' : C.cmd.per && C.cmd.per[sel] ? ', commandes à retirer ici' : '') + '.') + '</p>' +
    chips + svLine(doc, C) + (C.cmd.n ? '<p class="hint">Commandes ' + esc(C.cmd.year) + ' retirées du stock (sauf annulées) : ' + Object.keys(C.cmd.per).map(function (sid) { var pp = C.cmd.per[sid]; return esc(ssStandName(doc, sid)) + ' ' + ssPcs(pp.pcs) + ' (' + [pp.liv ? pp.liv + ' en livraison' : '', pp.ret ? pp.ret + ' à retirer' : ''].filter(Boolean).join(', ') + ')'; }).join(' · ') + '. <button class="ghost sm" data-a="sub" data-v="sapin/commandes">Voir les commandes</button></p>' : '') +
    (neg.length ? '<div class="alert">Stock négatif : ' + neg.slice(0, 6).map(esc).join(' · ') + (neg.length > 6 ? ' …' : '') + '. Il manque peut-être une livraison ou un transfert.</div>' : '') +
    (rows ? '<div class="scroll"><table class="stab bil sstab ssgrid"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">Aucun article : le catalogue de la Caisse est vide ou n’a pas pu être lu.</p>') + '</section>';
}
function vSsMvts(doc) {
  var all = ssMvList(doc), f = SS.mvFilter, l = all.filter(function (x) { return f === 'all' || x.v.type === f; });
  var nb = function (t) { return all.filter(function (x) { return x.v.type === t; }).length; };
  var h = '<section><div class="row-between"><h3>Mouvements</h3>' + ssActs() + '</div>' +
    '<div class="rsel sschips" role="group" aria-label="Type"><button class="chip' + (f === 'all' ? ' on' : '') + '" data-ss="mvf" data-v="all">Tous (' + all.length + ')</button><button class="chip' + (f === 'livraison' ? ' on' : '') + '" data-ss="mvf" data-v="livraison">Livraisons (' + nb('livraison') + ')</button><button class="chip' + (f === 'transfert' ? ' on' : '') + '" data-ss="mvf" data-v="transfert">Transferts (' + nb('transfert') + ')</button></div>';
  if (!l.length) return h + '<p class="empty">Aucun mouvement' + (f === 'all' ? ' encodé pour cette saison.' : ' de ce type.') + '</p></section>';
  return h + '<div class="sslivs">' + l.map(function (x) {
    var v = x.v, ids = Object.keys(v.lignes || {}), n = ids.reduce(function (s, a) { return s + (+v.lignes[a] || 0); }, 0), tr = v.type === 'transfert';
    var conf = SS.confirm && SS.confirm.id === x.id;
    return '<div class="sslv' + (conf ? ' danger' : '') + '"><div class="row-between"><span><span class="mvtag' + (tr ? ' tr' : '') + '">' + (tr ? 'Transfert' : 'Livraison') + '</span> <strong>' + esc(longDate(v.date)) + ' ' + esc(v.date.slice(0, 4)) + '</strong></span><span class="num">' + ssPcs(n) + '</span></div>' +
      '<p class="mvwho">' + (tr ? esc(ssStandName(doc, v.de)) + ' → ' + esc(ssStandName(doc, v.vers)) : 'Livrée à ' + esc(ssStandName(doc, v.stand))) + '</p>' +
      '<p>' + ids.map(function (a) { return esc(ssArtName(doc, a)) + ' <b class="num">× ' + fmtQ(v.lignes[a]) + '</b>'; }).join(' · ') + '</p>' +
      (v.source && v.source !== 'admin' ? '<p class="faint">Encodé depuis : ' + esc(v.source) + '</p>' : '') +
      (conf ? '<div class="cbtns"><span>Supprimer ce' + (tr ? ' transfert' : 'tte livraison') + ' ?</span><button class="btn danger sm" data-ss="delLiv" data-v="' + esc(x.id) + '">Supprimer</button><button class="btn sm" data-ss="cancel">Annuler</button></div>'
        : '<div class="cbtns"><button class="btn sm" data-ss="editLiv" data-v="' + esc(x.id) + '">Modifier</button><button class="btn sm" data-ss="askDel" data-v="' + esc(x.id) + '">Supprimer</button></div>') + '</div>';
  }).join('') + '</div></section>';
}
function ssAvail(doc) { var f = SS.form; if (f.type !== 'transfert' || !f.de) return null; var C = ssCompute(doc, f.mid), o = {}; ssGroups(doc).forEach(function (g) { g.items.forEach(function (it) { o[it.id] = C.get(f.de, it.id).rest; }); }); return o; }
function vSsForm(doc) {
  var f = SS.form, rows = '', tr = f.type === 'transfert', av = ssAvail(doc), C0 = tr ? ssCompute(doc, f.mid) : null, ncol = tr ? 3 : 2;
  SS.avail = av;
  ssGroups(doc).forEach(function (g) {
    var items = g.items.filter(function (it) { return !(tr && g.gone) || (av && av[it.id]) || f.q[it.id]; });
    if (!items.length) return;
    rows += '<tr class="ssgrp"><td colspan="' + ncol + '">' + esc(g.nom) + '</td></tr>' + items.map(function (it) {
      var v = f.q[it.id] == null ? '' : f.q[it.id], pv = parseQ(v), over = tr && av && pv > 0 && pv > av[it.id];
      return '<tr data-ssrow="' + esc((it.libelle + ' ' + it.cat).toLowerCase()) + '"><td><label for="ssq-' + esc(it.id) + '">' + esc(it.libelle) + '</label>' + (it.actif ? '' : '<span class="sub">masqué en caisse</span>') + '</td>' +
        (tr ? '<td class="r num' + (av && av[it.id] < 0 ? ' neg' : '') + '">' + (av ? fmtQ(av[it.id]) : '—') + '</td>' : '') +
        '<td class="r"><input type="text" inputmode="numeric" class="qty num' + (over ? ' bad' : '') + '" id="ssq-' + esc(it.id) + '" data-ssq="' + esc(it.id) + '" value="' + esc(v) + '" placeholder="0" autocomplete="off"></td></tr>';
    }).join('');
  });
  var stands = ssStands(doc, C0 ? C0.used : null);
  function sel(id, key, lab) { return '<div><label class="fl" for="' + id + '">' + lab + '</label><select id="' + id + '" data-ssf="' + key + '">' + stands.map(function (s) { return '<option value="' + esc(s.id) + '"' + (f[key] === s.id ? ' selected' : '') + '>' + esc(s.nom) + (s.id === doc.depot.id ? ' (stockage)' : '') + '</option>'; }).join('') + '</select></div>'; }
  var cats = SS.cat ? SS.cat.categories : [], na = f.na;
  var naBox = !na ? '<button class="btn" type="button" data-ss="naOpen">+ Article absent du catalogue</button>'
    : '<div class="ssna"><h4>Nouvel article</h4><p class="hint">Il est ajouté au catalogue de la Caisse (une nouvelle version est publiée), puis apparaît dans la liste ci-dessus.</p>' +
      '<label class="fl" for="naLib">Libellé</label><input type="text" id="naLib" data-ssn="libelle" value="' + esc(na.libelle) + '" placeholder="Ex. 175–200 cm">' +
      '<label class="fl" for="naCat">Catégorie</label><select id="naCat" data-ssn="cat">' + cats.map(function (k) { return '<option value="' + esc(k.id) + '"' + (na.cat === k.id ? ' selected' : '') + '>' + esc(k.nom) + '</option>'; }).join('') + '<option value="__new"' + (na.cat === '__new' ? ' selected' : '') + '>Nouvelle catégorie…</option></select>' +
      '<div id="naNewWrap"' + (na.cat === '__new' ? '' : ' hidden') + '><label class="fl" for="naNew">Nom de la nouvelle catégorie</label><input type="text" id="naNew" data-ssn="newCat" value="' + esc(na.newCat) + '"></div>' +
      '<label class="fl" for="naPrix">Prix de vente (€)</label><input type="text" inputmode="decimal" id="naPrix" data-ssn="prix" value="' + esc(na.prix) + '" placeholder="Ex. 69">' +
      '<div class="cbtns"><button class="pick" type="button" data-ss="naAdd"' + (SS.busy ? ' disabled' : '') + '>' + (SS.busy ? 'Publication…' : 'Ajouter au catalogue') + '</button><button class="btn" type="button" data-ss="naClose">Annuler</button></div></div>';
  return '<section><form class="ssliv" data-ss-form="liv">' +
    '<div class="ssfhead"><div><label class="fl" for="ssDate">Date ' + (tr ? 'du transfert' : 'de la livraison') + '</label><input type="date" id="ssDate" data-ssf="date" value="' + esc(f.date) + '" required></div>' +
    (tr ? sel('ssDe', 'de', 'Depuis le stand') + '<span class="ssarrow" aria-hidden="true">→</span>' + sel('ssVers', 'vers', 'Vers le stand') : '') +
    '<div class="ssfind"><label class="fl" for="ssFind">Rechercher</label><input type="text" id="ssFind" data-ssf="find" placeholder="Article…" autocomplete="off"></div></div>' +
    (tr && f.de === f.vers ? '<div class="alert">Choisissez deux stands différents.</div>' : '') +
    '<div class="scroll"><table class="stab bil sstab"><thead><tr><th>Article</th>' + (tr ? '<th class="r"><span class="lg">Disponible à ' + esc(ssStandName(doc, f.de)) + '</span><span class="sm">Dispo.</span></th>' : '') + '<th class="r">' + (tr ? '<span class="lg">Quantité transférée</span><span class="sm">Qté</span>' : 'Quantité livrée') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (tr ? '' : '<div class="ssnabox">' + naBox + '</div>') +
    (f.warn ? '<div class="alert ssover">' + f.warn + ' <span class="cbtns"><button class="btn danger sm" type="button" data-ss="force">Enregistrer quand même</button></span></div>' : '') +
    '<div class="ssfoot"><p class="num" id="ssSum">' + ssSumText() + '</p><div class="cbtns"><button class="pick" type="submit">' + (f.mid ? 'Enregistrer les modifications' : tr ? 'Enregistrer le transfert' : 'Enregistrer la livraison') + '</button><button class="btn" type="button" data-ss="view" data-v="' + (f.mid ? 'mvts' : 'stands') + '">Annuler</button></div></div>' +
    '</form></section>';
}
function ssSumText() {
  var f = SS.form, n = 0, k = 0, bad = 0;
  Object.keys(f.q).forEach(function (a) { var v = parseQ(f.q[a]); if (v == null) return; if (isNaN(v) || v < 0 || Math.round(v) !== v) { bad++; return; } if (v > 0) { n += v; k++; } });
  var over = ssOver();
  return bad ? '<span class="bad">' + bad + ' quantité' + (bad > 1 ? 's' : '') + ' invalide' + (bad > 1 ? 's' : '') + ' (nombre entier attendu)</span>' : k ? k + ' article' + (k > 1 ? 's' : '') + ' · ' + ssPcs(n) + (over.length ? ' · <span class="bad">' + over.length + ' au-delà du disponible</span>' : '') : 'Aucune quantité encodée';
}
function ssOver() {
  var f = SS.form, av = SS.avail, o = []; if (!f || f.type !== 'transfert' || !av) return o;
  Object.keys(f.q).forEach(function (a) { var v = parseQ(f.q[a]); if (v > 0 && v > (av[a] || 0)) o.push(a); });
  return o;
}

/* ---------- Actions ---------- */
function ssSubmitLiv(force) {
  var f = SS.form, doc = ssDoc(), lignes = {}, bad = false, tr = f.type === 'transfert';
  Object.keys(f.q).forEach(function (a) { var v = parseQ(f.q[a]); if (v == null) return; if (isNaN(v) || v < 0 || Math.round(v) !== v) bad = true; else if (v > 0) lignes[a] = v; });
  if (bad) { toast('Corrigez les quantités invalides (nombre entier attendu)'); return; }
  if (!Object.keys(lignes).length) { toast('Encodez au moins une quantité'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) { toast('Indiquez la date ' + (tr ? 'du transfert' : 'de la livraison')); return; }
  if (tr && (!f.de || !f.vers || f.de === f.vers)) { toast('Choisissez deux stands différents'); return; }
  if (tr && !force) {
    ssAvail(doc); var over = ssOver().filter(function (a) { return lignes[a]; });
    if (over.length) { f.warn = 'Plus que le stock disponible à ' + esc(ssStandName(doc, f.de)) + ' pour : ' + over.map(function (a) { return esc(ssArtName(doc, a)) + ' (' + fmtQ(lignes[a]) + ' pour ' + fmtQ(SS.avail[a] || 0) + ')'; }).join(', ') + '. Il manque peut-être une livraison, ou des ventes ne sont pas encore lues.'; render(); var w = document.querySelector('.ssover'); if (w) w.scrollIntoView({ block: 'center' }); return; }
  }
  var ops = [], g = ssGroups(doc), byId = {};
  g.forEach(function (x) { x.items.forEach(function (it) { byId[it.id] = it; }); });
  Object.keys(lignes).forEach(function (a) {
    var it = byId[a], snap = it ? { libelle: it.libelle, categorie: it.cat } : doc.articles[a];
    if (snap && JSON.stringify(snap) !== JSON.stringify(doc.articles[a])) ops.push({ t: 'art', id: a, v: snap });
  });
  var old = f.mid ? doc.mouvements[f.mid] : null, now = new Date().toISOString();
  var mv = tr ? { type: 'transfert', date: f.date, de: f.de, vers: f.vers, lignes: lignes, creeLe: old ? old.creeLe : now, source: old ? old.source || 'admin' : 'admin' }
    : { type: 'livraison', date: f.date, stand: old && old.stand ? old.stand : doc.depot.id, lignes: lignes, creeLe: old ? old.creeLe : now, source: old ? old.source || 'admin' : 'admin' };
  if (old) { mv.modifieLe = now; mv.modifiePar = 'admin'; }
  (tr ? [f.de, f.vers] : [mv.stand]).forEach(function (sid) { var nm = ssStandName(doc, sid); if (!doc.stands[sid] || doc.stands[sid].nom !== nm) ops.push({ t: 'stand', id: sid, v: { nom: nm } }); });
  var mid = f.mid || (tr ? 'tr-' : 'liv-') + now.replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
  ops.push({ t: 'mv', id: mid, v: mv });
  SS.view = f.mid ? 'mvts' : 'stands'; if (tr && !f.mid) SS.standSel = f.vers; SS.form = null;
  ssOp(ops);
  if (tr) { toast(old ? 'Transfert modifié' : 'Transfert enregistré : ' + ssPcs(Object.keys(lignes).reduce(function (s, a) { return s + lignes[a]; }, 0)) + ' vers ' + ssStandName(doc, f.vers)); return; }
  toast(old ? 'Livraison modifiée' : 'Livraison enregistrée : ' + ssPcs(Object.keys(lignes).reduce(function (s, a) { return s + lignes[a]; }, 0)));
}
function ssSubmitSeason() {
  var nom = (document.getElementById('ssNom').value || '').trim(), dep = document.getElementById('ssDepot').value;
  if (!nom) { toast('Indiquez le nom de la saison'); return; }
  var id = slug(nom, 32);
  if (SS.seasons.some(function (s) { return s.id === id; })) { toast('Une saison « ' + nom + ' » existe déjà'); return; }
  var p = SS.cat.pointsDeVente.filter(function (x) { return x.id === dep; })[0] || { id: dep, nom: dep }, now = new Date().toISOString();
  var doc = { format: SS_FMT, formatVersion: 1, id: id, nom: nom, creeLe: now, majLe: now, majPar: 'admin', depot: { id: p.id, nom: p.nom }, articles: {}, mouvements: {} };
  SS.seasons.unshift({ id: id, doc: doc, sha: null, local: true });
  SS.cur = { id: id, doc: doc, sha: null, ops: [], isNew: true, err: null, saving: false };
  SS.view = 'stands'; SS.newSeason = null; ssPersist(); ssSave();
}
/* Article absent du catalogue : ajouté directement au catalogue publié de la Caisse */
function ssAddArticle() {
  var na = SS.form.na, lib = (na.libelle || '').trim(), prix = parsePrice(na.prix), newCat = (na.newCat || '').trim();
  if (!lib) { toast('Indiquez le libellé de l’article'); return; }
  if (na.cat === '__new' && !newCat) { toast('Indiquez le nom de la nouvelle catégorie'); return; }
  if (isNaN(prix) || prix < 0) { toast('Indiquez un prix de vente valide'); return; }
  if (!getToken()) { toast('Déverrouillez l’appareil dans Paramètres pour modifier le catalogue'); return; }
  SS.busy = true; render();
  var tries = 0;
  function attempt() {
    return ghGetCatalogue(SAPIN_REPO, getToken()).then(function (r) {
      if (!r.json) throw new Error('Le catalogue de la Caisse n’est pas encore publié : publiez-le d’abord dans Gestion d’événement › Catalogue.');
      var j = clone(r.json), cats = Array.isArray(j.categories) ? j.categories : (j.categories = []), k, ids = {};
      cats.forEach(function (c) { (c.produits || []).forEach(function (p) { ids[p.id] = 1; }); });
      if (na.cat === '__new') {
        k = cats.filter(function (c) { return String(c.nom).trim().toLowerCase() === newCat.toLowerCase(); })[0];
        if (!k) { var cid = slug(newCat), cids = {}; cats.forEach(function (c) { cids[c.id] = 1; }); if (cids[cid]) cid = uid(cid + '-', cids);
          k = { id: cid, nom: newCat, ordre: cats.reduce(function (m, c) { return Math.max(m, c.ordre || 0); }, 0) + 1, actif: true, produits: [] }; cats.push(k); }
      } else k = cats.filter(function (c) { return c.id === na.cat; })[0];
      if (!k) throw new Error('Cette catégorie n’existe plus dans le catalogue. Actualisez la page.');
      if (!Array.isArray(k.produits)) k.produits = [];
      if (k.produits.some(function (p) { return String(p.libelle).trim().toLowerCase() === lib.toLowerCase(); })) throw new Error('« ' + lib + ' » existe déjà dans la catégorie ' + k.nom + '.');
      var prod = { id: uid(slug(k.id).slice(0, 8) + '-', ids), libelle: lib, prix: Math.round(prix * 100) / 100, ordre: k.produits.reduce(function (m, p) { return Math.max(m, p.ordre || 0); }, 0) + 1, actif: true };
      k.produits.push(prod);
      delete j.exemple; j.version = (+j.version || 0) + 1; j.date = todayIso();
      var body = { message: 'Catalogue v' + j.version + ' (Admin, stock : ajout de ' + lib + ')', content: utf8b64(JSON.stringify(j, null, 2) + '\n'), sha: r.sha };
      return ghFetch('/repos/' + SAPIN_REPO + '/contents/catalogue.json', { method: 'PUT', body: JSON.stringify(body) }, getToken()).then(function (res) {
        return { json: j, sha: res && res.content && res.content.sha, cat: k, prod: prod };
      });
    }).catch(function (e) { if ((e.status === 409 || e.status === 422) && tries++ < 2) return attempt(); throw e; });
  }
  attempt().then(function (x) {
    SS.busy = false; SS.cat = normalizeCat(x.json); SS.catErr = null;
    ssPatchCatEditor(x.json, x.sha, x.cat, x.prod);
    if (SS.form) { SS.form.na = null; SS.form.focus = x.prod.id; }
    toast('« ' + x.prod.libelle + ' » ajouté au catalogue (version ' + x.json.version + ')');
  }, function (e) { SS.busy = false; toast(e && e.status !== undefined ? ghErrText(e).replace(/<[^>]+>/g, '') : (e && e.message) || 'Erreur'); });
}
/* L'éditeur du catalogue (Gestion d’événement › Catalogue) garde un brouillon : on y reporte l'article ajouté */
function ssPatchCatEditor(json, sha, cat, prod) {
  var key = KP + 'admin-cat-draft:' + SAPIN_REPO;
  function patch(c) { if (!c || !Array.isArray(c.categories)) return; var k = c.categories.filter(function (x) { return x.id === cat.id; })[0]; if (!k) { k = clone(cat); k.produits = []; c.categories.push(k); } if (!k.produits.some(function (p) { return p.id === prod.id; })) k.produits.push(clone(prod)); }
  function fix(o) { // o = { data, base, sha, source }
    if (!o || !o.data) return null;
    if (comparable(o.data) === comparable(o.base)) return 'drop';
    if (o.source !== 'github') return null;
    patch(o.data); patch(o.base); if (o.base) o.base.version = json.version; o.sha = sha; return 'keep';
  }
  var C = CAT_CUR === 'sapin' ? CAT : CAT_ST.sapin;
  if (C && C.data) {
    var r = fix(C);
    if (r === 'drop') { C.data = null; C.base = null; C.sha = null; C.source = null; lsSet(key, null); }
    else if (r === 'keep') lsSet(key, JSON.stringify({ data: C.data, base: C.base, sha: C.sha, source: C.source }));
  } else {
    var o = null; try { o = JSON.parse(lsGet(key) || 'null'); } catch (e) {}
    var r2 = fix(o); if (r2 === 'drop') lsSet(key, null); else if (r2 === 'keep') lsSet(key, JSON.stringify(o));
  }
}
function ssFilter(q) {
  q = (q || '').trim().toLowerCase();
  var rows = document.querySelectorAll('.sstab tr[data-ssrow]');
  Array.prototype.forEach.call(rows, function (tr) { tr.hidden = !!q && tr.getAttribute('data-ssrow').indexOf(q) < 0; });
  Array.prototype.forEach.call(document.querySelectorAll('.sstab tr.ssgrp'), function (g) {
    var n = g.nextElementSibling, any = false; while (n && !n.classList.contains('ssgrp')) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any;
  });
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-ss]'); if (!b || b.disabled) return;
  var a = b.getAttribute('data-ss'), v = b.getAttribute('data-v');
  if (a === 'view') { SS.view = v; SS.form = null; SS.confirm = null; if (!SS.cur) SS.view = 'season'; render(); }
  else if (a === 'season') ssOpen(v);
  else if (a === 'newSeason') { SS.view = 'season'; SS.newSeason = null; render(); }
  else if (a === 'reload') { SS.loaded = false; SV.loaded = false; COR = {}; render(); }
  else if (a === 'save') ssSave();
  else if (a === 'newLiv') { SS.form = { type: 'livraison', mid: null, date: todayIso(), q: {}, na: null }; SS.view = 'form'; render(); }
  else if (a === 'newTr') { var d0 = ssDoc(), st = ssStands(d0, ssCompute(d0).used), de = SS.standSel !== 'all' ? SS.standSel : d0.depot.id, vers = (st.filter(function (s) { return s.id !== de; })[0] || {}).id || '';
    SS.form = { type: 'transfert', mid: null, date: todayIso(), de: de, vers: vers, q: {}, na: null }; SS.view = 'form'; render(); }
  else if (a === 'editLiv') { var mv = ssDoc().mouvements[v]; if (!mv) return; var q = {}; Object.keys(mv.lignes || {}).forEach(function (k) { q[k] = fmtQ(mv.lignes[k]); }); SS.form = { type: mv.type, mid: v, date: mv.date, de: mv.de, vers: mv.vers, q: q, na: null }; SS.view = 'form'; render(); }
  else if (a === 'force') ssSubmitLiv(true);
  else if (a === 'stand') { SS.standSel = v; render(); }
  else if (a === 'mvf') { SS.mvFilter = v; render(); }
  else if (a === 'sales') { COR = {}; svLoad(); }
  else if (a === 'askDel') { SS.confirm = { id: v }; render(); }
  else if (a === 'cancel') { SS.confirm = null; render(); }
  else if (a === 'delLiv') { var t0 = (ssDoc().mouvements[v] || {}).type; SS.confirm = null; ssOp([{ t: 'mv', id: v, v: null }]); toast(t0 === 'transfert' ? 'Transfert supprimé' : 'Livraison supprimée'); }
  else if (a === 'naOpen') { var c0 = SS.cat && SS.cat.categories[0]; SS.form.na = { libelle: '', cat: c0 ? c0.id : '__new', newCat: '', prix: '' }; render(); var i0 = document.getElementById('naLib'); if (i0) i0.focus(); }
  else if (a === 'naClose') { SS.form.na = null; render(); }
  else if (a === 'naAdd') ssAddArticle();
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.hasAttribute('data-ssq') && SS.form) { var aq = t.getAttribute('data-ssq'), pq = parseQ(t.value); SS.form.q[aq] = t.value; SS.form.warn = null; if (SS.avail) t.classList.toggle('bad', pq > 0 && pq > (SS.avail[aq] || 0)); var s = document.getElementById('ssSum'); if (s) s.innerHTML = ssSumText(); }
  else if (t.hasAttribute('data-ssn') && SS.form && SS.form.na) { var k = t.getAttribute('data-ssn'); SS.form.na[k] = t.value; if (k === 'cat') { var w = document.getElementById('naNewWrap'); if (w) w.hidden = t.value !== '__new'; } }
  else if (t.getAttribute('data-ssf') === 'date' && SS.form) SS.form.date = t.value;
  else if ((t.getAttribute('data-ssf') === 'de' || t.getAttribute('data-ssf') === 'vers') && SS.form) { SS.form[t.getAttribute('data-ssf')] = t.value; SS.form.warn = null; render(); }
  else if (t.getAttribute('data-ssf') === 'find') ssFilter(t.value);
});
document.addEventListener('submit', function (e) {
  var f = e.target.closest('[data-ss-form]'); if (!f) return;
  e.preventDefault();
  if (f.getAttribute('data-ss-form') === 'liv') ssSubmitLiv(); else ssSubmitSeason();
});
/* Entrée dans une quantité : passer à la suivante au lieu d'enregistrer la livraison */
document.addEventListener('keydown', function (e) {
  var t = e.target; if (e.key !== 'Enter' || !t.hasAttribute || !t.hasAttribute('data-ssq')) return;
  e.preventDefault();
  var all = Array.prototype.filter.call(document.querySelectorAll('[data-ssq]'), function (x) { return !x.closest('tr').hidden; }), i = all.indexOf(t);
  if (all[i + 1]) all[i + 1].focus(); else t.blur();
});
/* ---------- Gestion d’événement › Historique de vente ----------
   Un fichier de ventes de la Caisse (dépôt ventes, dossier sapin/, ou fichier de l'appareil),
   affiché comme l'Historique de la caisse, mais de la première à la dernière vente de la journée. */
var HS = { files: null, loading: false, err: null, sel: null, data: null, name: null, busy: false, loadErr: null };
function hsParse(f) {
  var name = f.path.split('/').pop(), m = /^(\d{4}-\d{2}-\d{2})_([^_]+)_([^_]+)_([^_.]+)\.json$/i.exec(name), b = bghParse(f.path);
  var stand = m ? m[3].replace(/-/g, ' ') : b.label;
  return { path: f.path, sha: f.sha, date: m ? m[1] : b.date, pdv: m ? m[2] : '', stand: stand.charAt(0).toUpperCase() + stand.slice(1), app: m ? m[4] : '' };
}
function hsList() {
  var tok = getToken(); if (!tok || HS.loading) return;
  HS.loading = true; HS.err = null; render();
  ghFetch('/repos/' + SALES_REPO + '/git/trees/HEAD?recursive=1', {}, tok).then(function (t) {
    HS.files = (t.tree || []).filter(function (x) { return x.type === 'blob' && /^sapin\//.test(x.path) && !/^sapin\/(stock|caisse|commandes|factures|livraisons)\//.test(x.path) && /\.json$/i.test(x.path); })
      .map(function (x) { return hsParse(x); }).sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : a.stand.localeCompare(b.stand); });
    HS.loading = false;
    if (!HS.sel && !HS.data && HS.files.length) hsOpen(HS.files[0].path); else render();
  }, function (e) { if (e.status === 409) { HS.files = []; HS.loading = false; render(); return; } HS.loading = false; HS.files = []; HS.err = bghErr(e); render(); });
}
function hsOpen(path) {
  HS.sel = path; HS.busy = true; HS.loadErr = null; render();
  bghRaw(path, getToken()).then(function (txt) {
    if (HS.sel !== path) return;
    var d = null; try { d = JSON.parse(txt); } catch (e) {}
    HS.busy = false;
    if (!d || d.format !== 'agri-garden-caisse/ventes' || !Array.isArray(d.ventes)) { HS.data = null; HS.loadErr = 'Ce fichier n’est pas un export de ventes de la Caisse.'; }
    else { HS.data = d; HS.name = path; }
    render();
  }, function (e) { if (HS.sel !== path) return; HS.busy = false; HS.loadErr = bghErr(e); render(); });
}
function hsLocal(file) {
  var rd = new FileReader();
  rd.onload = function () {
    var d = null; try { d = JSON.parse(rd.result); } catch (e) {}
    HS.sel = null;
    if (!d || d.format !== 'agri-garden-caisse/ventes' || !Array.isArray(d.ventes)) { HS.data = null; HS.loadErr = '« ' + file.name + ' » n’est pas un export de ventes de la Caisse.'; }
    else { HS.data = d; HS.name = file.name; HS.loadErr = null; }
    render();
  };
  rd.readAsText(file);
}
function hsDisc(r) { if (!r) return ''; return r.type === 'pourcentage' ? '−' + String(r.valeur).replace('.', ',') + ' %' : '−' + money(+r.valeur || 0); }
function hsNum(id) { var m = /-(\d+)$/.exec(id || ''); return m ? String(+m[1]) : (id || '?'); }
function hsPay(p) { p = p || {}; return p.mode === 'a-facturer' ? 'À facturer' : p.mode === 'deja-paye' ? 'Déjà payé (commande)' : p.mode === 'cash' ? 'Cash' : p.mode === 'bancontact' ? 'Bancontact' : p.mode === 'mixte' ? 'Mixte · cash ' + money(+p.cash || 0) + ' + Bancontact ' + money(+p.bancontact || 0) : esc(p.mode || ''); }
function hsDm(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function renderSapHist() {
  var el = document.getElementById('mod');
  if (HS.files === null && !HS.loading && getToken()) { hsList(); return; }
  var opts = '';
  if (HS.files && HS.files.length) {
    var byDay = {}; HS.files.forEach(function (f) { var k = f.date || 'sans-date'; (byDay[k] = byDay[k] || []).push(f); });
    opts = '<select id="hsSel" data-hs="sel" aria-label="Fichier de ventes">' + (HS.sel ? '' : '<option value="">Choisir un fichier…</option>') + Object.keys(byDay).sort().reverse().map(function (d) {
      return '<optgroup label="' + esc(d === 'sans-date' ? 'Sans date' : longDate(d) + ' ' + d.slice(0, 4)) + '">' + byDay[d].map(function (f) {
        return '<option value="' + esc(f.path) + '"' + (HS.sel === f.path ? ' selected' : '') + '>' + esc((f.date ? shortDate(f.date) + ' · ' : '') + f.stand + (f.app ? ' (appareil ' + f.app + ')' : '')) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select>';
  }
  var picker = '<div class="hspick">' + (opts ? '<label class="fl" for="hsSel">Fichier de ventes</label>' + opts : '') +
    '<div class="cbtns">' + (getToken() ? '<button class="ghost sm" data-hs="reload"' + (HS.loading ? ' disabled' : '') + '>' + (HS.loading ? 'Chargement…' : 'Actualiser la liste') + '</button>' : '') +
    '<label class="ghost sm lab">Ouvrir un fichier de l’appareil<input type="file" accept=".json,application/json" data-hsfile></label></div></div>';
  var band = '<div class="band"><div class="band-top"><h1>Historique de vente</h1></div>' + picker + '</div>';
  var main = '';
  if (!getToken()) main += '<div class="alerts"><div class="alert">Appareil verrouillé : la liste des fichiers du dépôt n’est pas disponible. <button class="btn sm" data-a="go" data-v="parametres">Déverrouiller</button> Vous pouvez aussi ouvrir un fichier de l’appareil.</div></div>';
  if (HS.err) main += '<div class="alerts"><div class="alert err">' + HS.err + '</div></div>';
  if (HS.loadErr) main += '<div class="alerts"><div class="alert err">' + esc(HS.loadErr) + '</div></div>';
  if (HS.busy) main += '<section><p class="empty">Chargement du fichier…</p></section>';
  else if (HS.data) main += vSapHist(HS.data);
  else if (HS.files && !HS.files.length && !HS.err) main += '<section><p class="empty">Aucun fichier de ventes de la Caisse sur le serveur pour l’instant.</p></section>';
  el.innerHTML = band + '<main>' + main + '</main>' + vToast();
}
function vSapHist(d) {
  var all = d.ventes.filter(function (v) { return v && typeof v.horodatage === 'string'; }).slice().sort(function (a, b) { return a.horodatage < b.horodatage ? -1 : a.horodatage > b.horodatage ? 1 : 0; });
  var ok = all.filter(function (v) { return !v.annulation; }), nAnn = all.length - ok.length, tot = ok.reduce(function (s, v) { return s + (+v.total || 0); }, 0);
  var cash = ok.reduce(function (s, v) { return s + (+(v.paiement || {}).cash || 0); }, 0), bc = ok.reduce(function (s, v) { return s + (+(v.paiement || {}).bancontact || 0); }, 0);
  var day = d.date || (all[0] && all[0].horodatage.slice(0, 10)) || '', pv = d.pointDeVente || {};
  if (day) fsEnsure(day.slice(0, 4));
  var h = '<section class="hsec"><div class="row-between"><h3>Ventes du ' + esc(day ? dmy(day) : '?') + (pv.nom ? ' · ' + esc(pv.nom) : '') + '</h3>' +
    (d.miseAJour ? '<span class="faint">Fichier mis à jour le ' + esc(hsDm(d.miseAJour)) + ' à ' + esc(String(d.miseAJour).slice(11, 16)) + '</span>' : '') + '</div>' +
    '<div class="hsum2"><strong>' + ok.length + ' vente' + (ok.length > 1 ? 's' : '') + ' · ' + money(tot) + '</strong><span class="faint">Cash ' + money(cash) + ' · Bancontact ' + money(bc) + '</span>' +
    (nAnn ? '<span class="faint">' + nAnn + ' vente' + (nAnn > 1 ? 's' : '') + ' annulée' + (nAnn > 1 ? 's' : '') + ', non comptée' + (nAnn > 1 ? 's' : '') + '</span>' : '') + '</div>';
  if (!all.length) return h + '<p class="empty">Aucune vente ce jour-là.</p></section>';
  var ids = {}; all.forEach(function (v) { ids[v.id] = v; });
  h += '<div class="hstable">' + all.map(function (v) {
    var lines = (v.lignes || []).map(function (l) { return '<span>' + (+l.quantite || 0) + ' × ' + esc(l.libelle || '') + (l.remise ? ' <em class="hsrem">(' + hsDisc(l.remise) + ')</em>' : '') + (l.articleLibre || !l.produitId ? ' <span class="tag">article libre</span>' : '') + '</span>'; });
    if (v.remiseTicket) lines.push('<span class="hsrem">Remise ticket ' + hsDisc(v.remiseTicket) + '</span>');
    var la = v.livraisonAjoutee, an = v.annulation, notes = [];
    if (la) notes.push('<span class="hsliv">Livraison ajoutée le ' + esc(hsDm(la.horodatage)) + ' à ' + esc(String(la.horodatage || '').slice(11, 16)) + ' · ' + money(+la.montant || 0) + (la.paiement ? ' (' + hsPay(la.paiement) + ')' : '') + '</span>');
    if (v.venteLiee) notes.push('<span class="hsliv">Livraison de la vente n° ' + esc(hsNum(v.venteLiee)) + (ids[v.venteLiee] ? ' (' + esc(ids[v.venteLiee].horodatage.slice(11, 16)) + ')' : '') + '</span>');
    all.forEach(function (o) { if (o.venteLiee === v.id && !o.annulation) notes.push('<span class="hsliv">Livraison payée à part : vente n° ' + esc(hsNum(o.id)) + ' (' + esc(o.horodatage.slice(11, 16)) + ')</span>'); });
    if (v.commande && typeof v.commande === 'object') notes.push('<span class="hsliv">Commande n° ' + esc(v.commande.numero || '?') + ' retirée' + (+v.commande.dejaPaye ? ' · ' + money(+v.commande.dejaPaye) + ' déjà payés à la commande' : '') + ' (stock déjà retiré par la commande)</span>');
    if (v.livraison && typeof v.livraison === 'object') notes.push('<span class="hsliv">Livrer à ' + esc([v.livraison.nom, v.livraison.adresse, v.livraison.telephone].filter(Boolean).join(' · ')) + '</span>');
    if (v.facture && typeof v.facture === 'object') { var fst = faStatus(v, day); notes.push('<span class="hsfac">Facture : ' + esc([v.facture.societe, v.facture.tva].filter(Boolean).join(' · ') || 'données incomplètes') + ' · ' + esc(fst.t) + (v.facture.modifieeLe ? ' · corrigée le ' + esc(hsDm(v.facture.modifieeLe)) : '') + '</span>'); }
    if (an) notes.push('<span class="hsann">Annulée à ' + esc(String(an.horodatage || '').slice(11, 16)) + (an.horodatage && an.horodatage.slice(0, 10) !== day ? ' le ' + esc(hsDm(an.horodatage)) : '') + (an.motif ? ' · ' + esc(an.motif) : '') + '</span>');
    return '<div class="hsale' + (an ? ' cancelled' : '') + '"><span class="hh"><b>' + esc(v.horodatage.slice(11, 16)) + '</b><small>n° ' + esc(hsNum(v.id)) + '</small></span>' +
      '<div class="hl">' + lines.join('') + notes.join('') + '</div><span class="hpm">' + hsPay(v.paiement) + '</span><span class="htt">' + money(+v.total || 0) + '</span></div>';
  }).join('') + '</div>' + (HS.name ? '<p class="hint">Fichier : ' + esc(HS.name) + '</p>' : '') + '</section>';
  return h;
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-hs]'); if (!b || b.disabled || b.tagName === 'SELECT') return;
  if (b.getAttribute('data-hs') === 'reload') { HS.files = null; hsList(); }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.getAttribute && t.getAttribute('data-hs') === 'sel' && t.value) hsOpen(t.value);
  else if (t.hasAttribute && t.hasAttribute('data-hsfile') && t.files && t.files[0]) { hsLocal(t.files[0]); t.value = ''; }
});
/* ================= Gestion d’événement › Caisse (fichier de caisse partagé avec la Caisse) =================
   ventes/sapin/caisse/<AAAA-MM-JJ>_<pdvId>.json : fond, retraits, apports et comptages d'un stand pour un jour.
   Les saisies sont rangées par identifiant (objet « entrees ») : l'Admin et la tablette relisent le fichier,
   ajoutent ou retirent seulement leurs saisies, puis réécrivent avec le sha (jamais d'écrasement).
   Les ventes cash viennent du fichier de ventes de la tablette (champ caisse.ventesCash, sinon calculées). */
var CX_FMT = 'agri-garden-caisse/caisse', CX_DIR = 'sapin/caisse';
var CX_COINS = ['500', '200', '100', '50', '20', '10', '5', '2', '1', '0.5', '0.2', '0.1', '0.05']; // pas de pièces de 1 et 2 cents (arrondi aux 5 cents en Belgique)
var CX_RETRAITS = ['Dépôt au coffre', 'Remboursement client', 'Dépense', 'Autre'];
var CX_APPORTS = ['Ajout de monnaie', 'Autre'];
var CX = { date: null, pdv: null, cat: null, catErr: null, catLoading: false, path: null, doc: null, sha: null, ops: [], loading: false, saving: false, err: null, sales: null, salesLoading: false, form: null, confirm: null };
var CXFILES = {}; // fichiers de caisse lus pour le Bilan : { path: { sha, doc } }
function cxPath(date, pdv) { return CX_DIR + '/' + date + '_' + pdv + '.json'; }
function cxKey(path) { return KP + 'admin-caisse:' + path; }
function cxNorm(d) { d = d && typeof d === 'object' ? d : {}; if (!d.entrees || typeof d.entrees !== 'object' || Array.isArray(d.entrees)) d.entrees = {}; return d; }
function cxApply(doc, op) { if (op.t === 'add') doc.entrees[op.id] = op.v; else if (op.t === 'del') delete doc.entrees[op.id]; return doc; }
function cxDoc() { var d = cxNorm(clone(CX.doc || {})); CX.ops.forEach(function (o) { cxApply(d, o); }); return d; }
function cxR2(x) { return Math.round(x * 100) / 100; }
/* Résumé au même format que le champ « caisse » des fichiers de ventes (utilisé par le Bilan) */
function cxSummary(doc, ventesCash) {
  var E = Object.keys(doc.entrees).map(function (id) { var e = doc.entrees[id]; return e ? Object.assign({ id: id }, e) : null; }).filter(Boolean)
    .sort(function (a, b) { return (a.horodatage || '') < (b.horodatage || '') ? -1 : (a.horodatage || '') > (b.horodatage || '') ? 1 : 0; });
  var fonds = E.filter(function (e) { return e.type === 'fond'; }), fond = fonds[fonds.length - 1] || null;
  var mv = E.filter(function (e) { return e.type === 'retrait' || e.type === 'apport'; }).map(function (e) { return { id: e.id, type: e.type, montant: +e.montant || 0, motif: e.motif || '', horodatage: e.horodatage, source: e.source }; });
  var comps = E.filter(function (e) { return e.type === 'comptage'; });
  comps.forEach(function (k) { if (+k.recette > 0) mv.push({ id: k.id + '-recette', type: 'retrait', montant: +k.recette, motif: 'Recette de fin de journée', horodatage: k.horodatage, auto: true, source: k.source }); });
  mv.sort(function (a, b) { return (a.horodatage || '') < (b.horodatage || '') ? -1 : 1; });
  var ap = mv.filter(function (m) { return m.type === 'apport'; }).reduce(function (s, m) { return s + m.montant; }, 0);
  var re = mv.filter(function (m) { return m.type === 'retrait'; }).reduce(function (s, m) { return s + m.montant; }, 0);
  var fd = fond ? +fond.montant || 0 : 0, vc = +ventesCash || 0, last = comps[comps.length - 1] || null;
  return { source: 'fichier-caisse', fondDeCaisse: fd, ventesCash: vc, apports: cxR2(ap), retraits: cxR2(re), attendu: cxR2(fd + vc + ap - re),
    compte: last ? +last.montant : null, ecart: last ? +last.ecart : null, laissePourDemain: last && typeof last.laisse === 'number' ? last.laisse : null,
    fond: fond ? { montant: fd, horodatage: fond.horodatage, detail: fond.detail || null, source: fond.source } : null, mouvements: mv,
    comptages: comps.map(function (k) { return { id: k.id, horodatage: k.horodatage, montant: +k.montant, detail: k.detail || null, attendu: +k.attendu, ecart: +k.ecart, laisse: k.laisse, recette: +k.recette || 0, attenduApres: +k.attenduApres, viaFond: !!k.viaFond, source: k.source }; }),
    entrees: E };
}
/* Ventes cash du stand ce jour-là, lues dans le fichier de ventes de la tablette (le plus récent) */
function cxSalesCash(d) {
  if (d && d.caisse && typeof d.caisse.ventesCash === 'number') return { v: d.caisse.ventesCash, exact: true };
  var v = 0; (d.ventes || []).forEach(function (x) { if (x && !x.annulation) v += +(x.paiement || {}).cash || 0; });
  return { v: cxR2(v), exact: false };
}
function cxLoadSales() {
  var date = CX.date, pdv = CX.pdv, tok = getToken(); if (!tok) return;
  CX.salesLoading = true;
  ghFetch('/repos/' + SALES_REPO + '/contents/sapin', {}, tok).then(function (l) {
    var hits = (Array.isArray(l) ? l : []).filter(function (f) { return f.type === 'file' && f.name.indexOf(date + '_' + pdv + '_') === 0 && /\.json$/i.test(f.name); });
    return Promise.all(hits.map(function (f) { return bghRaw(f.path, tok).then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } }); }));
  }, function (e) { if (e.status === 404) return []; throw e; }).then(function (docs) {
    if (CX.date !== date || CX.pdv !== pdv) return;
    var best = null; docs.forEach(function (d) { if (d && d.format === 'agri-garden-caisse/ventes' && (!best || (d.miseAJour || '') > (best.miseAJour || ''))) best = d; });
    var sc = best ? cxSalesCash(best) : null;
    CX.sales = best ? { v: sc.v, exact: sc.exact, at: best.miseAJour || '', n: (best.ventes || []).filter(function (x) { return x && !x.annulation; }).length, tiroir: best.caisse && best.caisse.source !== 'fichier-caisse' && Array.isArray(best.caisse.comptages) ? best.caisse : null } : { v: 0, none: true };
    CX.salesLoading = false; render();
  }).catch(function (e) { CX.salesLoading = false; CX.sales = { v: 0, err: bghErr(e) }; render(); });
}
function cxLoadCat() {
  if (CX.catLoading) return; CX.catLoading = true;
  ghGetCatalogue(SAPIN_REPO, getToken()).then(function (r) { CX.cat = r.json ? normalizeCat(r.json) : null; CX.catErr = r.json ? null : 'Le catalogue de la Caisse n’est pas encore publié.'; CX.catLoading = false; render(); },
    function (e) { CX.catLoading = false; CX.catErr = ghErrText(e, 'de lire'); render(); });
}
function cxOpen() {
  if (!CX.date || !CX.pdv) return;
  var path = cxPath(CX.date, CX.pdv), loc = null;
  CX.path = path; CX.doc = null; CX.sha = null; CX.err = null; CX.sales = null; CX.form = null; CX.confirm = null;
  try { loc = JSON.parse(lsGet(cxKey(path)) || 'null'); } catch (e) {}
  CX.ops = loc && Array.isArray(loc.ops) ? loc.ops : [];
  if (!getToken()) { CX.doc = loc && loc.doc ? loc.doc : null; render(); return; }
  CX.loading = true; render();
  ssGet(path).then(function (r) {
    if (CX.path !== path) return;
    CX.loading = false; CX.doc = r ? cxNorm(r.json) : (loc && loc.doc) || null; CX.sha = r ? r.sha : null; render();
    if (CX.ops.length) cxSave();
  }, function (e) { if (CX.path !== path) return; CX.loading = false; CX.doc = loc && loc.doc || null; CX.err = ssErrText(e); render(); });
  cxLoadSales();
}
function cxPersist() { lsSet(cxKey(CX.path), CX.ops.length ? JSON.stringify({ doc: CX.doc, ops: CX.ops }) : null); }
function cxSave(tries) {
  if (!CX.path || CX.saving || !CX.ops.length) return;
  if (!getToken()) { CX.err = 'Appareil verrouillé : la saisie est gardée sur cet appareil. Déverrouillez-le dans Paramètres pour l’enregistrer sur le serveur.'; cxPersist(); render(); return; }
  var path = CX.path, ops = CX.ops.slice(), stand = cxStandName(CX.pdv);
  CX.saving = true; CX.err = null; render();
  ssGet(path).then(function (r) {
    var base = r ? cxNorm(r.json) : cxNorm({ format: CX_FMT, formatVersion: 1, date: CX.date, pointDeVente: { id: CX.pdv, nom: stand }, creeLe: new Date().toISOString() });
    ops.forEach(function (o) {
      /* décompte : attendu et écart recalculés sur la dernière version (saisies de la tablette comprises) */
      if (o.t === 'add' && o.v && o.v.type === 'comptage' && o.v.source === 'admin' && !o.v.fige) {
        var S0 = cxSummary(base, CX.sales ? CX.sales.v : 0); o.v.attendu = S0.attendu; o.v.ecart = cxR2(o.v.montant - S0.attendu); o.v.attenduApres = cxR2(S0.attendu - o.v.recette);
      }
      cxApply(base, o);
    });
    base.majLe = new Date().toISOString(); base.majPar = 'admin';
    return ssPut(path, base, r && r.sha, 'Caisse ' + stand + ' du ' + dmy(CX.date) + ' (Admin)').then(function (res) { return { doc: base, sha: res && res.content && res.content.sha }; });
  }).then(function (x) {
    if (CX.path !== path) { CX.saving = false; return; }
    CX.saving = false; CX.doc = x.doc; CX.sha = x.sha; CX.ops = CX.ops.slice(ops.length); cxPersist(); render(); if (CX.ops.length) cxSave();
  }, function (e) {
    CX.saving = false;
    if ((e.status === 409 || e.status === 422) && (tries || 0) < 2) { cxSave((tries || 0) + 1); return; }
    CX.err = ssErrText(e); cxPersist(); render();
  });
}
function cxOp(op) { CX.ops.push(op); cxPersist(); cxSave(); }
window.addEventListener('online', function () { if (CX.ops.length) cxSave(); });
function cxStands() { return CX.cat ? CX.cat.pointsDeVente.filter(function (p) { return p.actif !== false; }) : []; }
function cxStandName(id) { var p = (CX.cat ? CX.cat.pointsDeVente : []).filter(function (x) { return x.id === id; })[0]; return p ? p.nom : id; }
function cxNowIso() { var d = new Date(), o = -d.getTimezoneOffset(), sg = o >= 0 ? '+' : '-'; o = Math.abs(o); return todayIso() + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0') + sg + String(Math.floor(o / 60)).padStart(2, '0') + ':' + String(o % 60).padStart(2, '0'); }
function cxId(type) { return type + '-admin-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }
function cxDetailTotal(det) { var t = 0; Object.keys(det || {}).forEach(function (k) { var n = parseInt(det[k], 10); if (n > 0) t += n * +k; }); return cxR2(t); }

/* ---------- Rendu ---------- */
function renderSapCaisse() {
  var el = document.getElementById('mod');
  if (!CX.date) CX.date = todayIso();
  if (!CX.cat && !CX.catErr && getToken()) cxLoadCat();
  var st = cxStands();
  if (!CX.pdv && st.length) { CX.pdv = (st.filter(function (p) { return /spy/i.test(p.nom); })[0] || st[0]).id; }
  if (CX.pdv && CX.path !== cxPath(CX.date, CX.pdv) && !CX.loading) { cxOpen(); return; }
  var band = '<div class="band"><div class="band-top"><h1>Caisse</h1></div><div class="cxpick">' +
    '<div><label class="fl" for="cxDate">Jour</label><input type="date" id="cxDate" data-cx="date" value="' + esc(CX.date) + '"></div>' +
    '<div class="cxstands"><span class="fl">Point de vente</span><div class="rsel">' + (st.length ? st.map(function (p) { return '<button class="rchip' + (CX.pdv === p.id ? ' on' : '') + '" data-cx="pdv" data-v="' + esc(p.id) + '">' + esc(p.nom) + '</button>'; }).join('') : '<span class="soon-lead" style="margin:0">' + (CX.catLoading ? 'Chargement des points de vente…' : 'Points de vente indisponibles.') + '</span>') + '</div></div></div></div>';
  var alerts = [];
  if (!getToken()) alerts.push('<div class="alert">Appareil verrouillé : la caisse enregistrée sur le serveur ne peut pas être lue. <button class="btn sm" data-a="go" data-v="parametres">Déverrouiller</button></div>');
  if (CX.catErr) alerts.push('<div class="alert err">' + CX.catErr + '</div>');
  if (CX.err) alerts.push('<div class="alert err">' + CX.err + ' <button class="btn sm" data-cx="retry">Réessayer</button></div>');
  var main = alerts.length ? '<div class="alerts">' + alerts.join('') + '</div>' : '';
  if (!CX.pdv) { el.innerHTML = band + '<main>' + main + '</main>' + vToast(); return; }
  if (CX.loading) { el.innerHTML = band + '<main>' + main + '<section><p class="empty">Chargement de la caisse…</p></section></main>' + vToast(); return; }
  var doc = cxDoc(), vc = CX.sales ? CX.sales.v : 0, S = cxSummary(doc, vc), last = S.comptages[S.comptages.length - 1];
  var recount = last && Math.abs(S.attendu - last.attenduApres) >= 0.005;
  var badges = [!S.fond ? '<span class="cbadge warn">Fond non saisi</span>' : '', !last ? '<span class="cbadge err">Non comptée</span>' : recount ? '<span class="cbadge warn">À recompter</span>' : '<span class="cbadge ok2">Comptée</span>'].join(' ');
  var salesTxt = CX.salesLoading ? 'lecture des ventes…' : !CX.sales ? '' : CX.sales.err ? '<span class="bad">' + CX.sales.err + '</span>' : CX.sales.none ? 'aucun fichier de ventes de la tablette pour ce jour' : CX.sales.n + ' vente' + (CX.sales.n > 1 ? 's' : '') + (CX.sales.at ? ', fichier reçu le ' + esc(hsDm(CX.sales.at)) + ' à ' + esc(String(CX.sales.at).slice(11, 16)) : '') + (CX.sales.exact ? '' : ' (calculées depuis les ventes : ancienne version de la caisse)');
  var stat = CX.saving ? '<span class="sv">Enregistrement…</span>' : CX.ops.length ? '<span class="sv warn">' + CX.ops.length + ' saisie' + (CX.ops.length > 1 ? 's' : '') + ' pas encore sur le serveur</span>' : (doc.majLe ? '<span class="good">Enregistré</span> <span class="faint">(' + esc(dmy(doc.majLe.slice(0, 10))) + ', ' + esc(doc.majPar === 'admin' ? 'Admin' : 'caisse') + ')</span>' : '<span class="faint">Rien de saisi pour ce jour</span>');
  main += '<section class="cxsum"><div class="row-between"><h3>' + esc(cxStandName(CX.pdv)) + ' · ' + esc(longDate(CX.date)) + '</h3><span>' + badges + '</span></div>' +
    '<p class="hint">' + stat + (salesTxt ? ' · Ventes cash : ' + salesTxt : '') + ' <button class="ghost sm ssre" data-cx="reload">Actualiser</button></p>' +
    '<div class="cxgrid">' +
      cxTile('Fond de caisse', money(S.fondDeCaisse), S.fond ? 'saisi ' + esc(cTime(S.fond.horodatage, CX.date)) : 'non saisi') +
      cxTile('Ventes cash', money(vc), CX.sales && !CX.sales.none ? 'tablette' : '—') +
      cxTile('Apports', '+' + money(S.apports), '') +
      cxTile('Retraits', '−' + money(S.retraits), S.mouvements.filter(function (m) { return m.auto; }).length ? 'dont recettes ' + money(S.mouvements.filter(function (m) { return m.auto; }).reduce(function (s, m) { return s + m.montant; }, 0)) : '') +
      cxTile('Attendu en caisse', money(S.attendu), 'fond + ventes cash + apports − retraits', 'em') +
      (last ? cxTile('Dernier décompte', money(last.montant), 'écart ' + cEcart(last.ecart) + (typeof last.laisse === 'number' ? ' · laissé ' + money(last.laisse) : ''), '') : '') +
    '</div>' + (recount ? '<div class="alert">Depuis le dernier décompte, l’attendu a changé de ' + money(S.attendu - last.attenduApres) + ' (ventes, retraits ou apports après le comptage) : recomptez.</div>' : '') +
    '<div class="cbtns cxacts"><button class="pick" data-cx="form" data-v="fond">' + (S.fond ? 'Modifier le fond' : 'Fond de caisse') + '</button><button class="pick" data-cx="form" data-v="retrait">Retrait</button><button class="pick" data-cx="form" data-v="apport">Ajout</button><button class="pick" data-cx="form" data-v="comptage">Décompte final</button></div></section>';
  if (CX.form) main += vCxForm(S);
  main += vCxJournal(S);
  el.innerHTML = band + '<main>' + main + '</main>' + vToast();
  if (CX.form && CX.form.focus) { var fi = document.getElementById(CX.form.focus); CX.form.focus = null; if (fi) { fi.focus(); fi.scrollIntoView({ block: 'center' }); } }
}
function cxTile(l, v, s, cls) { return '<div class="cxt' + (cls ? ' ' + cls : '') + '"><span class="l">' + l + '</span><strong class="num">' + v + '</strong>' + (s ? '<span class="s">' + s + '</span>' : '') + '</div>'; }
function cxAmount(f) { return f.det ? cxDetailTotal(f.det) : parsePrice(f.montant); }
function vCxCount(f) {
  return '<label class="tog cxdt"><input type="checkbox" data-cxf="useDet"' + (f.det ? ' checked' : '') + '>Compter par billets et pièces</label>' +
    (f.det ? '<div class="coins">' + CX_COINS.map(function (k) { var v = +k; return '<label class="coin"><span>' + (v < 1 ? money(v) : v + ' €') + '</span><input type="text" inputmode="numeric" data-cxc="' + k + '" value="' + esc(f.det[k] || '') + '" placeholder="0" autocomplete="off"></label>'; }).join('') + '</div>'
      : '<label class="fl" for="cxMontant">Montant (€)</label><input type="text" inputmode="decimal" id="cxMontant" data-cxf="montant" value="' + esc(f.montant || '') + '" placeholder="0,00" autocomplete="off">');
}
function vCxForm(S) {
  var f = CX.form, k = f.kind, title = { fond: 'Fond de caisse', retrait: 'Retrait', apport: 'Ajout (apport)', comptage: 'Décompte final' }[k];
  var h = '<section class="cxform"><h3>' + title + '</h3><form data-cx-form="1" class="ssform">';
  h += '<p class="hint">Heure enregistrée : celle de l’enregistrement' + (CX.date !== todayIso() ? ' (aujourd’hui ' + esc(dmy(todayIso())) + ', saisie pour le ' + esc(dmy(CX.date)) + ')' : '') + '.</p>';
  if (k === 'fond' || k === 'comptage') h += vCxCount(f);
  else h += '<label class="fl" for="cxMontant">Montant (€)</label><input type="text" inputmode="decimal" id="cxMontant" data-cxf="montant" value="' + esc(f.montant || '') + '" placeholder="0,00" autocomplete="off">';
  if (k === 'retrait' || k === 'apport') {
    var list = k === 'retrait' ? CX_RETRAITS : CX_APPORTS;
    h += '<span class="fl">Motif</span><div class="rsel cxmot">' + list.map(function (m) { return '<button type="button" class="chip' + (f.motif === m ? ' on' : '') + '" data-cx="motif" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') + '</div>' +
      '<div id="cxAutreW"' + (f.motif === 'Autre' ? '' : ' hidden') + '><label class="fl" for="cxAutre">Précisez</label><input type="text" id="cxAutre" data-cxf="autre" value="' + esc(f.autre || '') + '" maxlength="80"></div>';
  }
  if (k === 'comptage') {
    var a = cxAmount(f), att = S.attendu;
    h += '<p class="cxlive num" id="cxLive">' + cxLive(a, att) + '</p>' +
      '<label class="fl" for="cxLaisse">Laissé pour demain (€)</label><div class="row2"><input type="text" inputmode="decimal" id="cxLaisse" data-cxf="laisse" value="' + esc(f.laisse || '') + '" placeholder="obligatoire" autocomplete="off">' +
      '<button type="button" class="btn sm" data-cx="laisse0">Tout retirer (0 €)</button><button type="button" class="btn sm" data-cx="laisseAll">Tout laisser</button></div>' +
      '<p class="hint" id="cxRet">' + cxRetTxt(a, parsePrice(f.laisse)) + '</p>';
  }
  h += '<div class="cbtns"><button class="pick" type="submit" id="cxSave"' + (cxCanSave(f) ? '' : ' disabled') + '>Enregistrer</button><button class="btn" type="button" data-cx="cancelForm">Annuler</button></div></form></section>';
  return h;
}
/* Décompte final : Enregistrer reste grisé tant que le laissé pour demain n'est pas rempli (et valide) */
function cxCanSave(f) {
  if (!f || f.kind !== 'comptage') return true;
  var a = cxAmount(f), l = String(f.laisse || '').trim() === '' ? NaN : parsePrice(f.laisse);
  return !isNaN(a) && a >= 0 && !isNaN(l) && l >= 0 && l <= a + 0.004;
}
function cxLive(a, att) { if (isNaN(a)) return 'Attendu en caisse : <strong>' + money(att) + '</strong>'; var e = cxR2(a - att); return 'Compté <strong>' + money(a) + '</strong> · attendu ' + money(att) + ' · écart ' + cEcart(e); }
function cxRetTxt(a, l) { if (isNaN(a) || isNaN(l)) return 'Retiré (recette) = compté − laissé.'; if (l > a + 0.004) return '<span class="bad">Le laissé dépasse le compté.</span>'; return 'Retiré (recette) : <strong>' + money(a - l) + '</strong>, noté comme « Recette de fin de journée ».'; }
function vCxJournal(S) {
  var E = S.entrees.slice().reverse();
  var h = '<section><h3>Journal de la journée</h3><p class="lead">Saisies de l’Admin et de la tablette, de la plus récente à la plus ancienne. Le dernier fond et le dernier décompte font foi.</p>';
  if (!E.length) return h + '<p class="empty">Aucune saisie.</p></section>';
  var lastF = S.fond, lastC = S.comptages[S.comptages.length - 1];
  return h + '<div class="cxjr">' + E.map(function (e) {
    var t = { fond: 'Fond de caisse', retrait: 'Retrait', apport: 'Ajout', comptage: 'Décompte' }[e.type] || e.type, conf = CX.confirm === e.id;
    var old = (e.type === 'fond' && lastF && lastF.horodatage !== e.horodatage) || (e.type === 'comptage' && lastC && lastC.id !== e.id);
    var det = e.type === 'comptage' ? 'compté ' + money(+e.montant) + ' · attendu ' + money(+e.attendu) + ' · écart ' + cEcart(+e.ecart) + (typeof e.laisse === 'number' ? ' · laissé ' + money(e.laisse) + ' · retiré ' + money(+e.recette || 0) : '') : money(+e.montant || 0) + (e.motif ? ' · ' + esc(e.motif) : '');
    return '<div class="cxe' + (old ? ' old' : '') + (conf ? ' danger' : '') + '"><span class="h num">' + esc(cTime(e.horodatage, CX.date)) + '</span><div class="b"><strong>' + t + '</strong>' + (old ? ' <span class="faint">(remplacé)</span>' : '') + (e.viaFond ? ' <span class="cbadge">avec le fond du lendemain</span>' : '') + '<span class="d">' + det + '</span>' + (cBillets(e.detail) || '') + '</div>' +
      '<span class="src">' + (e.source === 'admin' ? 'Admin' : 'Tablette') + '</span>' +
      (conf ? '<span class="cbtns"><button class="btn danger sm" data-cx="del" data-v="' + esc(e.id) + '">Supprimer</button><button class="btn sm" data-cx="nodel">Annuler</button></span>' : '<button class="x" data-cx="askDel" data-v="' + esc(e.id) + '" aria-label="Supprimer">Supprimer</button>') + '</div>';
  }).join('') + '</div></section>';
}
function cxSubmit() {
  var f = CX.form, k = f.kind, a = (k === 'fond' || k === 'comptage') ? cxAmount(f) : parsePrice(f.montant);
  if (isNaN(a) || a < 0 || (k !== 'fond' && k !== 'comptage' && !(a > 0))) { toast('Indiquez un montant valide'); return; }
  var iso = cxNowIso(), id = cxId(k), v = { type: k, montant: cxR2(a), horodatage: iso, source: 'admin', saisiLe: new Date().toISOString() };
  if (f.det) v.detail = Object.keys(f.det).reduce(function (o, c) { var n = parseInt(f.det[c], 10); if (n > 0) o[c] = String(n); return o; }, {});
  if (k === 'retrait' || k === 'apport') {
    if (!f.motif) { toast('Choisissez un motif'); return; }
    if (f.motif === 'Autre' && !(f.autre || '').trim()) { toast('Précisez le motif'); return; }
    v.motif = f.motif === 'Autre' ? 'Autre : ' + f.autre.trim() : f.motif;
  }
  if (k === 'comptage') {
    var l = parsePrice(f.laisse);
    if (isNaN(l) || l < 0) { toast('Indiquez le montant laissé pour demain (0 si vous emportez tout)'); return; }
    if (l > a + 0.004) { toast('Le laissé dépasse le compté'); return; }
    var S = cxSummary(cxDoc(), CX.sales ? CX.sales.v : 0);
    v.attendu = S.attendu; v.ecart = cxR2(a - S.attendu); v.laisse = cxR2(l); v.recette = cxR2(a - l); v.attenduApres = cxR2(S.attendu - v.recette);
  }
  CX.form = null; cxOp({ t: 'add', id: id, v: v });
  toast({ fond: 'Fond de caisse enregistré', retrait: 'Retrait enregistré', apport: 'Ajout enregistré', comptage: 'Décompte enregistré' }[k]);
}
function cxRefreshLive() {
  var f = CX.form; if (!f || f.kind !== 'comptage') return;
  var a = cxAmount(f), S = cxSummary(cxDoc(), CX.sales ? CX.sales.v : 0), e1 = document.getElementById('cxLive'), e2 = document.getElementById('cxRet');
  if (e1) e1.innerHTML = cxLive(a, S.attendu); if (e2) e2.innerHTML = cxRetTxt(a, parsePrice(f.laisse));
  var sb = document.getElementById('cxSave'); if (sb) sb.disabled = !cxCanSave(f);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-cx]'); if (!b || b.disabled || b.tagName === 'INPUT') return;
  var a = b.getAttribute('data-cx'), v = b.getAttribute('data-v');
  if (a === 'pdv') { CX.pdv = v; CX.path = null; render(); }
  else if (a === 'reload' || a === 'retry') { if (CX.ops.length && a === 'retry') cxSave(); else { CX.path = null; render(); } }
  else if (a === 'form') { if (v === 'comptage' && getToken() && CX.path && !CX.saving) { var pth = CX.path; ssGet(pth).then(function (r) { if (r && CX.path === pth) { CX.doc = cxNorm(r.json); CX.sha = r.sha; if (CX.form) { var fc = document.activeElement && document.activeElement.id; render(); var el2 = fc && document.getElementById(fc); if (el2) el2.focus(); } } }, function () {}); }
    var n = new Date(); CX.form = { kind: v, montant: '', det: null, motif: v === 'apport' ? 'Ajout de monnaie' : '', autre: '', laisse: '', focus: 'cxMontant' }; render(); }
  else if (a === 'cancelForm') { CX.form = null; render(); }
  else if (a === 'motif') { CX.form.motif = v; render(); if (v === 'Autre') { var i = document.getElementById('cxAutre'); if (i) i.focus(); } }
  else if (a === 'laisse0' || a === 'laisseAll') { var am = cxAmount(CX.form); CX.form.laisse = a === 'laisse0' ? '0' : isNaN(am) ? '' : String(am).replace('.', ','); var il = document.getElementById('cxLaisse'); if (il) il.value = CX.form.laisse; cxRefreshLive(); }
  else if (a === 'askDel') { CX.confirm = v; render(); }
  else if (a === 'nodel') { CX.confirm = null; render(); }
  else if (a === 'del') { CX.confirm = null; cxOp({ t: 'del', id: v }); toast('Saisie supprimée'); }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.getAttribute && t.getAttribute('data-cx') === 'date' && t.value) { CX.date = t.value; CX.path = null; render(); return; }
  if (!CX.form) return;
  if (t.hasAttribute('data-cxf')) {
    var k = t.getAttribute('data-cxf');
    if (k === 'useDet') { CX.form.det = t.checked ? {} : null; render(); return; }
    CX.form[k] = t.value; cxRefreshLive();
  } else if (t.hasAttribute('data-cxc')) { CX.form.det[t.getAttribute('data-cxc')] = t.value; cxRefreshLive(); }
});
document.addEventListener('change', function (e) { var t = e.target; if (t.getAttribute && t.getAttribute('data-cxf') === 'useDet') { CX.form.det = t.checked ? {} : null; render(); } });
document.addEventListener('submit', function (e) { if (!e.target.closest('[data-cx-form]')) return; e.preventDefault(); cxSubmit(); });

/* ---------- Bilan : le fichier de caisse partagé, s'il existe, remplace le champ « caisse » du fichier de ventes ---------- */
function cxBilanLoad(paths) {
  var tok = getToken(); if (!tok) return;
  var todo = paths.filter(function (p) { var c = CXFILES[p.path]; return !c || (c.sha !== p.sha && !c.loading); });
  if (!todo.length) return;
  todo.forEach(function (p) { CXFILES[p.path] = Object.assign(CXFILES[p.path] || {}, { loading: true }); });
  Promise.all(todo.map(function (p) { return bghRaw(p.path, tok).then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) {} CXFILES[p.path] = { sha: p.sha, doc: d && d.format === CX_FMT ? cxNorm(d) : null }; }, function () { CXFILES[p.path] = { sha: p.sha, doc: null, err: true }; }); }))
    .then(function () { render(); });
}
function cxForBilan(day, pdv, salesData) {
  var path = cxPath(day, pdv), c = CXFILES[path];
  if (!c || !c.doc) return null;
  return cxSummary(c.doc, cxSalesCash(salesData).v);
}
function ctxHomeStatus(c, def) {
  var st = BIL_CUR === c ? { FILES: FILES } : BIL_ST[c];
  var n = st ? st.FILES.filter(function (f) { return f.status === 'ok'; }).length : 0;
  return n ? n + ' fichier' + (n > 1 ? 's' : '') + ' de ventes chargé' + (n > 1 ? 's' : '') : def;
}
/* ================= Gestion d’événement › Commandes (commandes de clients) =================
   Un fichier par année dans le dépôt privé des ventes : sapin/commandes/<AAAA>.json.
   Les commandes sont rangées par identifiant (objet « commandes ») ; chaque appareil relit le fichier,
   applique ses modifications et réécrit avec le sha (comme le stock) : la Caisse pourra s'y ajouter plus tard. */
var CO_FMT = 'agri-garden-caisse/commandes', CO_DIR = 'sapin/commandes';
var CO_STATUTS = [{ id: 'a-preparer', nom: 'À préparer' }, { id: 'prete', nom: 'Prête' }, { id: 'livree', nom: 'Livrée / retirée' }, { id: 'annulee', nom: 'Annulée' }];
var CO_PAY = [{ id: '', nom: 'Pas encore payé' }, { id: 'cash', nom: 'Cash' }, { id: 'bancontact', nom: 'Bancontact' }, { id: 'virement', nom: 'Virement' }];
var CO = { year: null, years: null, cat: null, catErr: null, catLoading: false, path: null, doc: null, ops: [], loading: false, saving: false, err: null, filter: 'actives', q: '', form: null, confirm: null };
function coPath(y) { return CO_DIR + '/' + y + '.json'; }
function coKey(path) { return KP + 'admin-commandes:' + path; }
function coNorm(d) { d = d && typeof d === 'object' ? d : {}; if (!d.commandes || typeof d.commandes !== 'object' || Array.isArray(d.commandes)) d.commandes = {}; return d; }
function coApply(doc, op) { if (op.t === 'set') doc.commandes[op.id] = op.v; else if (op.t === 'del') delete doc.commandes[op.id]; return doc; }
function coDoc() { var d = coNorm(clone(CO.doc || {})); CO.ops.forEach(function (o) { coApply(d, o); }); return d; }
function coNextNum(doc) { var m = 0; Object.keys(doc.commandes).forEach(function (k) { var c = doc.commandes[k]; if (c && +c.numero > m) m = +c.numero; }); return m + 1; }
function coStatut(id) { return (CO_STATUTS.filter(function (s) { return s.id === id; })[0] || CO_STATUTS[0]).nom; }
function coPersist() { lsSet(coKey(CO.path), CO.ops.length ? JSON.stringify({ doc: CO.doc, ops: CO.ops }) : null); }
function coLoadCat() {
  if (CO.catLoading) return; CO.catLoading = true;
  ghGetCatalogue(SAPIN_REPO, getToken()).then(function (r) { CO.cat = r.json ? normalizeCat(r.json) : null; CO.catErr = r.json ? null : 'Le catalogue de la Caisse n’est pas encore publié.'; CO.catLoading = false; render(); },
    function (e) { CO.catLoading = false; CO.catErr = ghErrText(e, 'de lire'); render(); });
}
function coYears() {
  if (!getToken() || CO.years) return;
  CO.years = [];
  ghFetch('/repos/' + SALES_REPO + '/contents/' + CO_DIR, {}, getToken()).then(function (l) {
    CO.years = (Array.isArray(l) ? l : []).map(function (f) { var m = /^(\d{4})\.json$/.exec(f.name); return m ? m[1] : null; }).filter(Boolean); render();
  }, function () {});
}
function coOpen() {
  var path = coPath(CO.year), loc = null;
  CO.path = path; CO.doc = null; CO.err = null; CO.form = null; CO.confirm = null;
  try { loc = JSON.parse(lsGet(coKey(path)) || 'null'); } catch (e) {}
  CO.ops = loc && Array.isArray(loc.ops) ? loc.ops : [];
  if (!getToken()) { CO.doc = loc && loc.doc || null; render(); return; }
  CO.loading = true; render();
  ssGet(path).then(function (r) {
    if (CO.path !== path) return;
    CO.loading = false; CO.doc = r ? coNorm(r.json) : (loc && loc.doc) || null; render();
    if (CO.ops.length) coSave();
  }, function (e) { if (CO.path !== path) return; CO.loading = false; CO.doc = loc && loc.doc || null; CO.err = ssErrText(e); render(); });
}
function coSave(tries) {
  if (!CO.path || CO.saving || !CO.ops.length) return;
  if (!getToken()) { CO.err = 'Appareil verrouillé : les commandes sont gardées sur cet appareil. Déverrouillez-le dans Paramètres pour les enregistrer sur le serveur.'; coPersist(); render(); return; }
  var path = CO.path, ops = CO.ops.slice(), year = CO.year;
  CO.saving = true; CO.err = null; render();
  ssGet(path).then(function (r) {
    var base = r ? coNorm(r.json) : coNorm({ format: CO_FMT, formatVersion: 1, annee: +year, creeLe: new Date().toISOString() });
    ops.forEach(function (o) {
      if (o.t === 'set' && o.v && !o.v.numero) { o.v.numero = coNextNum(base); }
      var cur = o.t === 'set' && o.v && base.commandes[o.id];
      if (cur && cur.encaissement && !o.v.encaissement) { o.v.encaissement = cur.encaissement; o.v.paye = cur.paye; o.v.statut = cur.statut; o.v.historique = cur.historique; }
      coApply(base, o);
    });
    base.majLe = new Date().toISOString(); base.majPar = 'admin';
    return ssPut(path, base, r && r.sha, 'Commandes ' + year + ' (Admin)').then(function () { return base; });
  }).then(function (doc) {
    if (CO.path !== path) { CO.saving = false; return; }
    CO.saving = false; CO.doc = doc; CO.ops = CO.ops.slice(ops.length); COR[year] = { doc: doc, loaded: true }; coPersist(); render(); if (CO.ops.length) coSave();
  }, function (e) {
    CO.saving = false;
    if ((e.status === 409 || e.status === 422) && (tries || 0) < 2) { coSave((tries || 0) + 1); return; }
    CO.err = ssErrText(e); coPersist(); render();
  });
}
function coOp(op) { CO.ops.push(op); coPersist(); coSave(); }
window.addEventListener('online', function () { if (CO.ops.length) coSave(); });
function coList(doc) {
  return Object.keys(doc.commandes).map(function (id) { var c = doc.commandes[id]; return c ? Object.assign({ id: id }, c) : null; }).filter(Boolean);
}
function coDate(c) { return c.mode === 'retrait' ? (c.retrait && c.retrait.date) || '' : (c.livraison && c.livraison.date) || ''; }
function coReste(c) { return Math.round(((+c.total || 0) - (c.paye && +c.paye.montant || 0)) * 100) / 100; }
function coProducts() {
  var out = []; if (!CO.cat) return out;
  CO.cat.categories.forEach(function (k) { if (k.actif === false) return; var items = k.produits.filter(function (p) { return p.actif !== false; }).map(function (p) { return { id: p.id, libelle: (k.prefixe === false || isLivProduct(p) ? '' : k.nom + ' ') + p.libelle, prix: +p.prix || 0, cat: k.nom }; }); if (items.length) out.push({ nom: k.nom, items: items }); });
  return out;
}

/* ---------- Rendu ---------- */
/* Commandes d'une année pour le stock et les livraisons : la version ouverte dans l'onglet Commandes (avec ses modifications locales), sinon une lecture seule */
var COR = {};
function coDocFor(y) {
  y = String(y);
  if (CO.path === coPath(y) && (CO.doc || CO.ops.length)) return coDoc();
  var r = COR[y];
  if (!r) {
    r = COR[y] = { doc: null, loading: false, loaded: false };
    var loc = null; try { loc = JSON.parse(lsGet(coKey(coPath(y))) || 'null'); } catch (e) {}
    if (loc && loc.doc) { var d0 = coNorm(clone(loc.doc)); (loc.ops || []).forEach(function (o) { coApply(d0, o); }); r.doc = d0; }
    if (getToken()) { r.loading = true; ssGet(coPath(y)).then(function (x) { r.loading = false; r.loaded = true; if (x) r.doc = coNorm(x.json); render(); }, function () { r.loading = false; r.loaded = true; }); }
  }
  return coNorm(clone(r.doc || {}));
}
/* Quantités des commandes (non annulées) par stand et par article, hors ligne Livraison :
   livraison -> stand de stockage (depotId), retrait -> stand du retrait. Les ventes de la caisse liées à une commande (vente.commande) ne sont pas déduites une 2e fois (svSummary). */
function coStandOf(c, depotId) { return c.mode === 'retrait' ? (c.retrait && c.retrait.stand && c.retrait.stand.id) || null : depotId; }
function coQty(doc, depotId) {
  var q = {}, per = {}, names = {}, n = 0, pcs = 0;
  Object.keys(doc.commandes).forEach(function (id) { var c = doc.commandes[id]; if (!c || c.statut === 'annulee') return; var sid = coStandOf(c, depotId); if (!sid) return; var used = 0;
    (c.lignes || []).forEach(function (l) { if (!l.produitId || isLivLine(l)) return; var o = q[sid] || (q[sid] = {}), k = +l.quantite || 0; o[l.produitId] = (o[l.produitId] || 0) + k; used += k; });
    if (used) { n++; pcs += used; var pp = per[sid] || (per[sid] = { n: 0, pcs: 0, liv: 0, ret: 0 }); pp.n++; pp.pcs += used; pp[c.mode === 'retrait' ? 'ret' : 'liv']++; if (c.mode === 'retrait' && c.retrait.stand.nom) names[sid] = c.retrait.stand.nom; } });
  return { q: q, per: per, names: names, n: n, pcs: pcs };
}
function renderSapCommandes() {
  var el = document.getElementById('mod');
  if (!CO.year) CO.year = String(new Date().getFullYear());
  if (!CO.cat && !CO.catErr && getToken()) coLoadCat();
  coYears();
  if (CO.path !== coPath(CO.year) && !CO.loading) { coOpen(); return; }
  var years = (CO.years || []).concat([CO.year, String(new Date().getFullYear())]).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
  var doc = coDoc(), all = coList(doc);
  var stat = CO.saving ? '<span class="sv">Enregistrement…</span>' : CO.ops.length ? '<span class="sv warn">' + CO.ops.length + ' modification' + (CO.ops.length > 1 ? 's' : '') + ' pas encore sur le serveur</span>' : doc.majLe ? '<span class="sv ok">Enregistré sur le serveur</span>' : '';
  var band = '<div class="band"><div class="band-top"><h1>Commandes</h1></div>' +
    '<div class="rsel ssbar" role="group" aria-label="Année">' + years.map(function (y) { return '<button class="rchip' + (y === CO.year ? ' on' : '') + '" data-co="year" data-v="' + esc(y) + '">' + esc(y) + '</button>'; }).join('') + '<button class="rchip" data-co="reload">Actualiser</button></div>' +
    (stat ? '<p class="soon-lead">' + stat + '</p>' : '') + '</div>';
  var alerts = [];
  if (!getToken()) alerts.push('<div class="alert">Appareil verrouillé : les commandes enregistrées sur le serveur ne peuvent pas être lues. <button class="btn sm" data-a="go" data-v="parametres">Déverrouiller</button></div>');
  if (CO.catErr) alerts.push('<div class="alert err">' + CO.catErr + '</div>');
  if (CO.err) alerts.push('<div class="alert err">' + CO.err + ' <button class="btn sm" data-co="retry">Réessayer</button></div>');
  var main = alerts.length ? '<div class="alerts">' + alerts.join('') + '</div>' : '';
  if (CO.loading) { el.innerHTML = band + '<main>' + main + '<section><p class="empty">Chargement des commandes…</p></section></main>' + vToast(); return; }
  if (CO.form) { el.innerHTML = band + '<main>' + main + vCoForm() + '</main>' + vToast(); coAfter(); return; }
  var cnt = { actives: 0, 'a-preparer': 0, prete: 0, livree: 0, annulee: 0, toutes: all.length };
  all.forEach(function (c) { cnt[c.statut || 'a-preparer']++; if (c.statut !== 'livree' && c.statut !== 'annulee') cnt.actives++; });
  var F0 = [['actives', 'À traiter'], ['a-preparer', 'À préparer'], ['prete', 'Prêtes'], ['livree', 'Livrées / retirées'], ['annulee', 'Annulées'], ['toutes', 'Toutes']];
  var q = (CO.q || '').trim().toLowerCase();
  var list = all.filter(function (c) {
    var st = c.statut || 'a-preparer';
    if (CO.filter === 'actives' && (st === 'livree' || st === 'annulee')) return false;
    if (CO.filter !== 'actives' && CO.filter !== 'toutes' && st !== CO.filter) return false;
    if (q) { var hay = [c.numero, c.client && c.client.nom, c.client && c.client.tel, c.client && c.client.email, c.livraison && c.livraison.adresse].join(' ').toLowerCase(); if (hay.indexOf(q) < 0) return false; }
    return true;
  }).sort(function (a, b) { var da = coDate(a) || '9999', db = coDate(b) || '9999'; return da < db ? -1 : da > db ? 1 : (a.numero || 0) - (b.numero || 0); });
  var h = '<section><div class="row-between"><h3>Commandes ' + esc(CO.year) + '</h3><div class="cbtns"><button class="pick" data-co="new">+ Nouvelle commande</button><button class="btn" data-co="csv"' + (all.length ? '' : ' disabled') + '>Exporter pour Excel</button></div></div>' +
    '<div class="rsel sschips" role="group" aria-label="Statut">' + F0.map(function (f) { return '<button class="chip' + (CO.filter === f[0] ? ' on' : '') + '" data-co="filter" data-v="' + f[0] + '">' + f[1] + ' <span class="num">(' + cnt[f[0]] + ')</span></button>'; }).join('') + '</div>' +
    '<input type="text" class="cosearch" data-co-q placeholder="Rechercher : nom, téléphone, n°, adresse…" value="' + esc(CO.q) + '" autocomplete="off">' +
    '<p class="hint">Stock (sauf commandes annulées) : une commande en livraison est retirée du stand de stockage et apparaît dans l’onglet Livraisons ; une commande en retrait est retirée du stock du stand choisi, et la Caisse de ce stand l’encaisse sans la retirer une deuxième fois.</p>';
  if (!list.length) h += '<p class="empty">' + (all.length ? 'Aucune commande ne correspond.' : 'Aucune commande pour ' + esc(CO.year) + '.') + '</p>';
  var lastD = null;
  list.forEach(function (c) {
    var d = coDate(c) || '';
    if (d !== lastD) { h += '<h4 class="codate' + (d ? ' cap' : '') + '">' + (d ? esc(longDate(d)) + ' ' + esc(d.slice(0, 4)) : 'Sans date') + '</h4>'; lastD = d; }
    h += vCoCard(c);
  });
  el.innerHTML = band + '<main>' + main + h + '</section></main>' + vToast();
}
function vCoCard(c) {
  var st = c.statut || 'a-preparer', cl = c.client || {}, reste = coReste(c), conf = CO.confirm && CO.confirm.id === c.id ? CO.confirm.kind : null, enc = c.encaissement && typeof c.encaissement === 'object' ? c.encaissement : null;
  var where = c.mode === 'retrait' ? 'Retrait à <strong>' + esc((c.retrait && c.retrait.stand && c.retrait.stand.nom) || '?') + '</strong>' : 'Livraison : <strong>' + esc((c.livraison && c.livraison.adresse) || '?') + '</strong>' + (c.livraison && c.livraison.creneau ? ' · ' + esc(c.livraison.creneau) : '');
  var next = enc ? null : st === 'a-preparer' ? ['prete', 'Marquer prête'] : st === 'prete' ? ['livree', c.mode === 'retrait' ? 'Marquer retirée' : 'Marquer livrée'] : null;
  return '<div class="cocard st-' + st + (conf ? ' danger' : '') + '"><div class="row-between"><span><strong>n° ' + esc(c.numero || '…') + ' · ' + esc(cl.nom || '?') + '</strong>' + (cl.tel ? ' · <a href="tel:' + esc(cl.tel.replace(/\s/g, '')) + '">' + esc(cl.tel) + '</a>' : '') + (cl.email ? ' · <a href="mailto:' + esc(cl.email) + '">' + esc(cl.email) + '</a>' : '') + '</span>' +
    '<span class="costat st-' + st + '">' + esc(c.mode === 'retrait' && st === 'livree' ? 'Retirée' : st === 'livree' ? 'Livrée' : coStatut(st)) + '</span></div>' +
    '<p>' + where + '</p>' +
    '<p class="coart">' + (c.lignes || []).map(function (l) { return esc(l.quantite + ' × ' + l.libelle); }).join(' · ') + '</p>' +
    '<p class="num"><strong>' + money(+c.total || 0) + '</strong>' + (c.paye && +c.paye.montant ? ' · payé ' + money(+c.paye.montant) + (c.paye.mode ? ' (' + esc((CO_PAY.filter(function (x) { return x.id === c.paye.mode; })[0] || {}).nom || c.paye.mode) + ')' : '') : '') + (reste > 0.004 ? ' · <span class="bad">reste ' + money(reste) + '</span>' : reste < -0.004 ? ' · <span class="warnt">trop payé ' + money(-reste) + '</span>' : ' · <span class="good">payé</span>') + '</p>' +
    (c.note ? '<p class="faint">' + esc(c.note) + '</p>' : '') + (enc ? '<p class="coenc">Encaissée à la caisse' + (enc.pointDeVente && enc.pointDeVente.nom ? ' de ' + esc(enc.pointDeVente.nom) : '') + (enc.horodatage ? ' le ' + esc(hsDm(enc.horodatage)) + ' à ' + esc(String(enc.horodatage).slice(11, 16)) : '') + (enc.venteId ? ' · vente n° ' + esc(hsNum(enc.venteId)) : '') + (enc.montant != null ? ' · ' + money(+enc.montant || 0) + (enc.paiement && enc.paiement.mode ? ' (' + esc(hsPayTxt(enc.paiement)) + ')' : '') : '') + '</p>' : '') +
    (conf ? '<div class="cbtns"><span>' + (conf === 'del' ? (enc ? 'Cette commande a déjà été encaissée à la caisse. ' : '') + 'Supprimer définitivement cette commande ?' : 'Annuler cette commande ?') + '</span><button class="btn danger sm" data-co="' + (conf === 'del' ? 'del' : 'cancelOrder') + '" data-v="' + esc(c.id) + '">' + (conf === 'del' ? 'Supprimer' : 'Annuler la commande') + '</button><button class="btn sm" data-co="noconf">Non</button></div>'
      : '<div class="cbtns">' + (next ? '<button class="pick sm2" data-co="status" data-v="' + esc(c.id) + '" data-s="' + next[0] + '">' + next[1] + '</button>' : '') + (enc ? '' : '<button class="btn sm" data-co="edit" data-v="' + esc(c.id) + '">Modifier</button>' +
        (st !== 'annulee' && st !== 'livree' ? '<button class="btn sm" data-co="askCancel" data-v="' + esc(c.id) + '">Annuler</button>' : '<button class="btn sm" data-co="status" data-v="' + esc(c.id) + '" data-s="a-preparer">Remettre à préparer</button>')) +
        '<button class="x" data-co="askDel" data-v="' + esc(c.id) + '">Supprimer</button></div>') + '</div>';
}
function coTotal(f) { var t = 0; Object.keys(f.q).forEach(function (pid) { var n = parseQ(f.q[pid]); var p = f.prix[pid]; if (n > 0 && p != null) t += n * p; }); return Math.round(t * 100) / 100; }
function vCoForm() {
  var f = CO.form, prods = coProducts(), stands = CO.cat ? CO.cat.pointsDeVente.filter(function (p) { return p.actif !== false; }) : [];
  var rows = prods.map(function (g) { return '<tr class="ssgrp"><td colspan="3">' + esc(g.nom) + '</td></tr>' + g.items.map(function (it) {
    f.prix[it.id] = f.prix[it.id] != null ? f.prix[it.id] : it.prix; f.lib[it.id] = f.lib[it.id] || it.libelle;
    return '<tr><td><label for="coq-' + esc(it.id) + '">' + esc(it.libelle) + '</label></td><td class="r num">' + money(f.prix[it.id]) + '</td><td class="r"><input type="text" inputmode="numeric" class="qty num" id="coq-' + esc(it.id) + '" data-coq="' + esc(it.id) + '" value="' + esc(f.q[it.id] || '') + '" placeholder="0" autocomplete="off"></td></tr>'; }).join(''); }).join('');
  /* articles d'une commande existante qui ne sont plus dans le catalogue */
  Object.keys(f.q).forEach(function (pid) { if (!prods.some(function (g) { return g.items.some(function (i) { return i.id === pid; }); })) rows += '<tr><td>' + esc(f.lib[pid] || pid) + ' <span class="faint">(plus au catalogue)</span></td><td class="r num">' + money(f.prix[pid] || 0) + '</td><td class="r"><input type="text" inputmode="numeric" class="qty num" data-coq="' + esc(pid) + '" value="' + esc(f.q[pid] || '') + '"></td></tr>'; });
  return '<section class="coform"><h3>' + (f.id ? 'Modifier la commande n° ' + esc(f.numero || '') : 'Nouvelle commande') + '</h3><form data-co-form="1">' +
    '<div class="cogrid"><div><label class="fl" for="coNom">Nom du client<span class="req" aria-hidden="true"> *</span></label><input type="text" id="coNom" data-cof="nom" value="' + esc(f.nom) + '" required autocomplete="off"></div>' +
    '<div><label class="fl" for="coTel">Téléphone</label><input type="text" inputmode="tel" id="coTel" data-cof="tel" value="' + esc(f.tel) + '" autocomplete="off"></div>' +
    '<div><label class="fl" for="coMail">E-mail</label><input type="text" inputmode="email" id="coMail" data-cof="email" value="' + esc(f.email) + '" autocomplete="off"></div></div>' +
    '<span class="fl">Remise au client</span><div class="rsel"><button type="button" class="chip' + (f.mode === 'livraison' ? ' on' : '') + '" data-co="mode" data-v="livraison">Livraison</button><button type="button" class="chip' + (f.mode === 'retrait' ? ' on' : '') + '" data-co="mode" data-v="retrait">Retrait sur un stand</button></div>' +
    (f.mode === 'livraison'
      ? '<div class="cogrid"><div class="wide"><label class="fl" for="coAdr">Adresse de livraison<span class="req" aria-hidden="true"> *</span></label><input type="text" id="coAdr" data-cof="adresse" aria-required="true" value="' + esc(f.adresse) + '" autocomplete="off"></div><div><label class="fl" for="coDate">Date de livraison</label><input type="date" id="coDate" data-cof="date" value="' + esc(f.date) + '"></div><div><label class="fl" for="coCren">Créneau</label><input type="text" id="coCren" data-cof="creneau" value="' + esc(f.creneau) + '" placeholder="Ex. 14h–16h" autocomplete="off"></div></div>'
      : '<div class="cogrid"><div><label class="fl" for="coStand">Stand</label><select id="coStand" data-cof="stand">' + stands.map(function (p) { return '<option value="' + esc(p.id) + '"' + (f.stand === p.id ? ' selected' : '') + '>' + esc(p.nom) + '</option>'; }).join('') + '</select></div><div><label class="fl" for="coDate">Date de retrait</label><input type="date" id="coDate" data-cof="date" value="' + esc(f.date) + '"></div></div>') +
    '<span class="fl">Articles<span class="req" aria-hidden="true"> *</span> <span class="faint">(au moins un)</span></span>' + (rows ? '<div class="scroll"><table class="stab bil sstab"><thead><tr><th>Article</th><th class="r">Prix</th><th class="r">Quantité</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">Catalogue de la Caisse indisponible.</p>') +
    '<p class="num cototal" id="coTot">Total : <strong>' + money(coTotal(f)) + '</strong></p>' +
    '<div class="cogrid"><div><label class="fl" for="coPaye">Déjà payé (€)</label><input type="text" inputmode="decimal" id="coPaye" data-cof="paye" value="' + esc(f.paye) + '" placeholder="0,00" autocomplete="off"></div>' +
    '<div><label class="fl" for="coPm">Paiement</label><select id="coPm" data-cof="pmode">' + CO_PAY.map(function (p) { return '<option value="' + p.id + '"' + (f.pmode === p.id ? ' selected' : '') + '>' + esc(p.nom) + '</option>'; }).join('') + '</select></div>' +
    (f.id ? '<div><label class="fl" for="coSt">Statut</label><select id="coSt" data-cof="statut">' + CO_STATUTS.map(function (s) { return '<option value="' + s.id + '"' + (f.statut === s.id ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; }).join('') + '</select></div>' : '') + '</div>' +
    '<label class="fl" for="coNote">Remarque</label><input type="text" id="coNote" data-cof="note" value="' + esc(f.note) + '" maxlength="200" autocomplete="off" placeholder="Ex. sonner deux fois"><p class="reqnote"><span class="req">*</span> champ obligatoire</p>' +
    '<div class="cbtns"><button class="pick" type="submit">' + (f.id ? 'Enregistrer les modifications' : 'Enregistrer la commande') + '</button><button class="btn" type="button" data-co="cancelForm">Annuler</button></div></form></section>';
}
function coAfter() { var f = CO.form; if (f && f.focus) { var i = document.getElementById(f.focus); f.focus = null; if (i) i.focus(); } }
function coSubmit() {
  var f = CO.form, nom = (f.nom || '').trim();
  if (!nom) { toast('Indiquez le nom du client'); return; }
  var lignes = [], bad = false;
  Object.keys(f.q).forEach(function (pid) { var n = parseQ(f.q[pid]); if (n == null || n === 0) return; if (isNaN(n) || n < 0 || Math.round(n) !== n) { bad = true; return; } var pu = +f.prix[pid] || 0; lignes.push({ produitId: pid, libelle: f.lib[pid] || pid, prixUnitaire: pu, quantite: n, total: Math.round(pu * n * 100) / 100 }); });
  if (bad) { toast('Quantités : nombres entiers'); return; }
  if (!lignes.length) { toast('Ajoutez au moins un article'); return; }
  if (f.mode === 'livraison' && !(f.adresse || '').trim()) { toast('Indiquez l’adresse de livraison'); return; }
  var paye = String(f.paye || '').trim() === '' ? 0 : parsePrice(f.paye);
  if (isNaN(paye) || paye < 0) { toast('Montant payé invalide'); return; }
  var old = f.id ? coDoc().commandes[f.id] : null, now = new Date().toISOString(), stand = (CO.cat ? CO.cat.pointsDeVente : []).filter(function (p) { return p.id === f.stand; })[0];
  var st = f.id ? f.statut : 'a-preparer';
  var v = { numero: old ? old.numero : null, creeLe: old ? old.creeLe : now, source: old ? old.source || 'admin' : 'admin',
    client: { nom: nom, tel: (f.tel || '').trim(), email: (f.email || '').trim() }, mode: f.mode,
    livraison: f.mode === 'livraison' ? { adresse: f.adresse.trim(), date: f.date || '', creneau: (f.creneau || '').trim() } : null,
    retrait: f.mode === 'retrait' ? { stand: stand ? { id: stand.id, nom: stand.nom } : { id: f.stand, nom: f.stand }, date: f.date || '' } : null,
    lignes: lignes, total: Math.round(lignes.reduce(function (s, l) { return s + l.total; }, 0) * 100) / 100,
    paye: { montant: Math.round(paye * 100) / 100, mode: paye > 0 ? f.pmode || '' : '' }, statut: st, note: (f.note || '').trim(),
    historique: (old && old.historique ? old.historique.slice() : []).concat(!old ? [{ statut: st, le: now }] : old.statut !== st ? [{ statut: st, le: now }] : []) };
  if (old) v.modifieLe = now;
  var id = f.id || 'cmd-' + now.replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
  CO.form = null; coOp({ t: 'set', id: id, v: v });
  toast(old ? 'Commande modifiée' : 'Commande enregistrée');
}
function coSetStatus(id, s) {
  var c = coDoc().commandes[id]; if (!c) return;
  var v = clone(c), now = new Date().toISOString(); v.statut = s; v.modifieLe = now; v.historique = (v.historique || []).concat([{ statut: s, le: now }]);
  coOp({ t: 'set', id: id, v: v });
}
function coCsv() {
  var rows = [['N°', 'Statut', 'Client', 'Téléphone', 'E-mail', 'Mode', 'Adresse / stand', 'Date', 'Créneau', 'Articles', 'Total (€)', 'Payé (€)', 'Paiement', 'Reste (€)', 'Remarque', 'Encaissée à la caisse']];
  coList(coDoc()).sort(function (a, b) { return (a.numero || 0) - (b.numero || 0); }).forEach(function (c) {
    var cl = c.client || {};
    rows.push([c.numero || '', coStatut(c.statut), cl.nom || '', cl.tel || '', cl.email || '', c.mode === 'retrait' ? 'Retrait' : 'Livraison', c.mode === 'retrait' ? (c.retrait && c.retrait.stand && c.retrait.stand.nom) || '' : (c.livraison && c.livraison.adresse) || '', coDate(c), c.livraison && c.livraison.creneau || '', (c.lignes || []).map(function (l) { return l.quantite + ' x ' + l.libelle; }).join(', '), +c.total || 0, c.paye && +c.paye.montant || 0, c.paye && c.paye.mode || '', coReste(c), c.note || '', c.encaissement ? [c.encaissement.pointDeVente && c.encaissement.pointDeVente.nom, c.encaissement.horodatage && String(c.encaissement.horodatage).slice(0, 16).replace('T', ' '), c.encaissement.venteId].filter(Boolean).join(' · ') : '']);
  });
  download('commandes-sapins_' + CO.year + '.csv', rows); toast('Fichier pour Excel téléchargé');
}
function coFormFrom(c) {
  var f = { id: c ? c.id : null, numero: c ? c.numero : null, nom: '', tel: '', email: '', mode: 'livraison', adresse: '', date: '', creneau: '', stand: '', q: {}, prix: {}, lib: {}, paye: '', pmode: '', statut: 'a-preparer', note: '', focus: 'coNom' };
  var st = CO.cat ? CO.cat.pointsDeVente.filter(function (p) { return p.actif !== false; }) : [];
  f.stand = (st.filter(function (p) { return /spy/i.test(p.nom); })[0] || st[0] || {}).id || '';
  if (c) {
    var cl = c.client || {}; f.nom = cl.nom || ''; f.tel = cl.tel || ''; f.email = cl.email || ''; f.mode = c.mode || 'livraison';
    if (c.livraison) { f.adresse = c.livraison.adresse || ''; f.date = c.livraison.date || ''; f.creneau = c.livraison.creneau || ''; }
    if (c.retrait) { f.stand = c.retrait.stand && c.retrait.stand.id || f.stand; f.date = c.retrait.date || ''; }
    (c.lignes || []).forEach(function (l) { f.q[l.produitId] = String(l.quantite); f.prix[l.produitId] = +l.prixUnitaire || 0; f.lib[l.produitId] = l.libelle; });
    f.paye = c.paye && +c.paye.montant ? String(c.paye.montant).replace('.', ',') : ''; f.pmode = c.paye && c.paye.mode || ''; f.statut = c.statut || 'a-preparer'; f.note = c.note || '';
  }
  return f;
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-co]'); if (!b || b.disabled || b.tagName === 'INPUT') return;
  var a = b.getAttribute('data-co'), v = b.getAttribute('data-v');
  if (a === 'year') { CO.year = v; CO.path = null; render(); }
  else if (a === 'reload') { CO.years = null; CO.cat = null; CO.catErr = null; CO.path = null; render(); }
  else if (a === 'retry') coSave();
  else if (a === 'filter') { CO.filter = v; render(); }
  else if (a === 'new') { CO.form = coFormFrom(null); render(); window.scrollTo(0, 0); }
  else if (a === 'edit') { var c = coDoc().commandes[v]; if (c) { CO.form = coFormFrom(Object.assign({ id: v }, c)); render(); window.scrollTo(0, 0); } }
  else if (a === 'cancelForm') { CO.form = null; render(); }
  else if (a === 'mode') { CO.form.mode = v; render(); }
  else if (a === 'status') { coSetStatus(v, b.getAttribute('data-s')); toast(coStatut(b.getAttribute('data-s'))); }
  else if (a === 'askCancel') { CO.confirm = { id: v, kind: 'cancel' }; render(); }
  else if (a === 'askDel') { CO.confirm = { id: v, kind: 'del' }; render(); }
  else if (a === 'noconf') { CO.confirm = null; render(); }
  else if (a === 'cancelOrder') { CO.confirm = null; coSetStatus(v, 'annulee'); toast('Commande annulée'); }
  else if (a === 'del') { CO.confirm = null; coOp({ t: 'del', id: v }); toast('Commande supprimée'); }
  else if (a === 'csv') coCsv();
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-co-q')) { CO.q = t.value; var pos = t.selectionStart; render(); var i = document.querySelector('[data-co-q]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) {} } return; }
  if (!CO.form) return;
  if (t.hasAttribute('data-cof')) CO.form[t.getAttribute('data-cof')] = t.value;
  else if (t.hasAttribute('data-coq')) { CO.form.q[t.getAttribute('data-coq')] = t.value; var el = document.getElementById('coTot'); if (el) el.innerHTML = 'Total : <strong>' + money(coTotal(CO.form)) + '</strong>'; }
});
document.addEventListener('change', function (e) { var t = e.target; if (CO.form && t.hasAttribute && t.hasAttribute('data-cof') && t.tagName === 'SELECT') CO.form[t.getAttribute('data-cof')] = t.value; });
document.addEventListener('submit', function (e) { if (!e.target.closest('[data-co-form]')) return; e.preventDefault(); coSubmit(); });
document.addEventListener('keydown', function (e) {
  var t = e.target; if (e.key !== 'Enter' || !t.hasAttribute || !t.hasAttribute('data-coq')) return;
  e.preventDefault(); var all = Array.prototype.slice.call(document.querySelectorAll('[data-coq]')), i = all.indexOf(t); if (all[i + 1]) all[i + 1].focus(); else t.blur();
});

/* ================= Factures (Caisse v36) et suivi par le patron =================
   Les données de facturation viennent des fichiers de ventes (vente.facture) ; le suivi (facture établie, payée par virement)
   est gardé à part dans sapin/factures/<AAAA>.json, jamais dans les fichiers de ventes (la tablette les réécrit en entier). */
/* ================= Suivis tenus par l'Admin (factures, livraisons) =================
   Un fichier par année dans le dépôt ventes, indexé par id de vente, jamais dans les fichiers de ventes (la tablette les réécrit).
   Opérations champ par champ fusionnées sur la dernière version (relecture + PUT avec sha, 3 réessais), file d'attente hors ligne. */
function mkSuivi(dir, fmt, label, lsPrefix) {
  var M = { years: {} };
  function path(y) { return dir + '/' + y + '.json'; }
  function key(y) { return lsPrefix + path(y); }
  function norm(d) { d = d && typeof d === 'object' ? d : {}; if (!d.suivi || typeof d.suivi !== 'object' || Array.isArray(d.suivi)) d.suivi = {}; return d; }
  function apply(doc, op) { doc.suivi[op.id] = Object.assign({}, doc.suivi[op.id] || {}, op.champs, { modifieLe: op.le }); return doc; }
  M.state = function (y) {
    y = String(y); if (M.years[y]) return M.years[y];
    var st = M.years[y] = { doc: null, ops: [], loading: false, saving: false, err: null, loaded: false }, loc = null;
    try { loc = JSON.parse(lsGet(key(y)) || 'null'); } catch (e) {}
    if (loc) { st.doc = loc.doc || null; st.ops = Array.isArray(loc.ops) ? loc.ops : []; }
    return st;
  };
  function persist(y) { var st = M.state(y); lsSet(key(y), st.ops.length ? JSON.stringify({ doc: st.doc, ops: st.ops }) : null); }
  M.ensure = function (y) {
    var st = M.state(y); if (st.loaded || st.loading || !getToken()) return st;
    st.loading = true;
    ssGet(path(y)).then(function (r) { st.loading = false; st.loaded = true; st.doc = r ? norm(r.json) : st.doc; render(); if (st.ops.length) M.save(y); },
      function (e) { st.loading = false; st.loaded = true; st.err = ssErrText(e); render(); });
    return st;
  };
  M.doc = function (y) { var st = M.state(y), d = norm(clone(st.doc || {})); st.ops.forEach(function (o) { apply(d, o); }); return d; };
  M.get = function (id, day) { if (!id || !day) return {}; return M.doc(String(day).slice(0, 4)).suivi[id] || {}; };
  M.save = function (y, tries) {
    var st = M.state(y); if (st.saving || !st.ops.length) return;
    if (!getToken()) { st.err = 'Appareil verrouillé : le suivi est gardé sur cet appareil. Déverrouillez-le dans Paramètres pour l’enregistrer sur le serveur.'; persist(y); render(); return; }
    var ops = st.ops.slice(); st.saving = true; st.err = null; render();
    ssGet(path(y)).then(function (r) {
      var base = r ? norm(r.json) : norm({ format: fmt, formatVersion: 1, annee: +y, creeLe: new Date().toISOString() });
      ops.forEach(function (o) { apply(base, o); });
      base.majLe = new Date().toISOString(); base.majPar = 'admin';
      return ssPut(path(y), base, r && r.sha, label + ' ' + y + ' (Admin)').then(function () { return base; });
    }).then(function (doc) {
      st.saving = false; st.doc = doc; st.loaded = true; st.ops = st.ops.slice(ops.length); persist(y); render(); if (st.ops.length) M.save(y);
    }, function (e) {
      st.saving = false;
      if ((e.status === 409 || e.status === 422) && (tries || 0) < 3) { M.save(y, (tries || 0) + 1); return; }
      st.err = ssErrText(e); persist(y); render();
    });
  };
  M.op = function (id, day, champs) { var y = String(day).slice(0, 4), st = M.state(y); st.ops.push({ id: id, champs: champs, le: new Date().toISOString() }); persist(y); M.save(y); };
  window.addEventListener('online', function () { Object.keys(M.years).forEach(function (y) { if (M.years[y].ops.length) M.save(y); }); });
  return M;
}
var FSUIVI = mkSuivi('sapin/factures', 'agri-garden-caisse/factures-suivi', 'Suivi des factures', KP + 'admin-factsuivi:');
var LSUIVI = mkSuivi('sapin/livraisons', 'agri-garden-caisse/livraisons-suivi', 'Suivi des livraisons', KP + 'admin-livsuivi:');
function fsState(y) { return FSUIVI.state(y); }
function fsEnsure(y) { return FSUIVI.ensure(y); }
function fsGet(id, day) { return FSUIVI.get(id, day); }
function fsSave(y) { FSUIVI.save(y); }
function fsOp(id, day, champs) { FSUIVI.op(id, day, champs); }
function faStatus(v, day) {
  var f = v.facture || {}, np = vNonPaye(v), sv = fsGet(v.id, day);
  if (np > 0 && sv.virement) return { k: 'vir', t: 'Payée (virement)', np: 0, vir: np };
  if (np > 0) return { k: 'np', t: 'Non payée · reste ' + money(np), np: np };
  if (f.paiement) return { k: 'later', t: 'Payée au stand le ' + hsDm(f.paiement.horodatage) + (f.paiement.mode ? ' (' + hsPayTxt(f.paiement) + ')' : ''), np: 0 };
  return { k: 'ok', t: 'Payée au stand', np: 0 };
}
function hsPayTxt(p) { p = p || {}; return p.mode === 'cash' ? 'cash' : p.mode === 'bancontact' ? 'Bancontact' : p.mode === 'mixte' ? 'cash ' + money(+p.cash || 0) + ' + Bancontact ' + money(+p.bancontact || 0) : p.mode === 'a-facturer' ? 'à facturer' : p.mode === 'deja-paye' ? 'déjà payé' : String(p.mode || ''); }

/* ---------- Gestion d’événement › Factures ---------- */
var FA = { year: null, files: null, data: {}, loading: false, err: null, at: null, f: { stand: 'all', pay: 'all', est: 'all', from: '', to: '' }, open: null };
function faExtract(d) {
  if (!d || d.format !== 'agri-garden-caisse/ventes' || !Array.isArray(d.ventes)) return { ok: false };
  var fp = d.pointDeVente || {}, out = { ok: true, key: (fp.id || '?') + '|' + (d.date || ''), maj: d.miseAJour || '', ventes: [] };
  d.ventes.forEach(function (v) { if (v && !v.annulation && typeof v.horodatage === 'string' && ((v.facture && typeof v.facture === 'object') || (v.lignes || []).some(isLivLine))) out.ventes.push({ v: v, pv: v.pointDeVente || fp }); });
  return out; // en mémoire seulement : noms, adresses et e-mails ne sont pas gardés dans le navigateur
}
function faLoad() {
  var tok = getToken(); if (!tok || FA.loading) return;
  FA.loading = true; FA.err = null; render();
  ghFetch('/repos/' + SALES_REPO + '/git/trees/HEAD?recursive=1', {}, tok).then(function (t) { return t; }, function (e) { if (e.status === 409) return { tree: [] }; throw e; }).then(function (t) {
    var files = (t.tree || []).filter(function (x) { return x.type === 'blob' && /^sapin\//.test(x.path) && !/^sapin\/(stock|caisse|commandes|factures|livraisons)\//.test(x.path) && /\.json$/i.test(x.path); });
    var todo = files.filter(function (f) { return !FA.data[f.sha]; }), i = 0;
    function next() {
      if (i >= todo.length) return Promise.resolve();
      var f = todo[i++];
      return bghRaw(f.path, tok).then(function (txt) { var s; try { s = faExtract(JSON.parse(txt)); } catch (e) { s = { ok: false }; } FA.data[f.sha] = s; }, function () {}).then(next);
    }
    return Promise.all([next(), next(), next(), next(), next(), next()]).then(function () { FA.files = files; FA.loading = false; FA.at = new Date(); render(); });
  }).catch(function (e) { FA.loading = false; FA.files = FA.files || []; FA.err = bghErr(e); render(); });
}
function faAll() {
  var best = {};
  (FA.files || []).forEach(function (f) { var s = FA.data[f.sha]; if (!s || !s.ok) return; if (!best[s.key] || s.maj > best[s.key].maj) best[s.key] = s; });
  var seen = {}, out = [];
  Object.keys(best).forEach(function (k) { best[k].ventes.forEach(function (x) { if (!x.v.facture || typeof x.v.facture !== 'object' || seen[x.v.id]) return; seen[x.v.id] = 1; out.push({ v: x.v, day: x.v.horodatage.slice(0, 10), pvId: x.pv.id || '?', pvNom: x.pv.nom || x.pv.id || '?' }); }); });
  return out.sort(function (a, b) { return a.v.horodatage < b.v.horodatage ? -1 : a.v.horodatage > b.v.horodatage ? 1 : 0; });
}
function faLines(v) { return (v.lignes || []).map(function (l) { return (+l.quantite || 0) + ' × ' + (l.libelle || ''); }); }
function faCopyText(x) {
  var v = x.v, f = v.facture || {}, st = faStatus(v, x.day), sv = fsGet(v.id, x.day);
  var t = ['Société : ' + (f.societe || ''), 'Adresse : ' + (f.adresse || ''), 'TVA : ' + (f.tva || ''), 'E-mail : ' + (f.email || ''), '',
    'Vente du ' + dmy(x.day) + ' à ' + v.horodatage.slice(11, 16) + ' · ' + x.pvNom + ' · n° ' + hsNum(v.id) + ' (' + v.id + ')', 'Articles :'];
  (v.lignes || []).forEach(function (l) { t.push('  ' + (+l.quantite || 0) + ' × ' + (l.libelle || '') + ' à ' + money(+l.prixUnitaire || 0) + ' = ' + money(+l.total || 0)); });
  t.push('Total : ' + money(+v.total || 0), 'Paiement : ' + st.t);
  if (sv.numero) t.push('N° de facture : ' + sv.numero);
  return t.join('\n').replace(/ /g, ' ');
}
function faCopy(txt) {
  function fb() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); toast(ok ? 'Copié : collez-le dans le logiciel de facturation' : 'Copie impossible sur cet appareil'); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Copié : collez-le dans le logiciel de facturation'); }, fb); else fb();
}
function faFiltered(all) {
  var f = FA.f;
  return all.filter(function (x) {
    if (x.day.slice(0, 4) !== FA.year) return false;
    if (f.from && x.day < f.from) return false; if (f.to && x.day > f.to) return false;
    if (f.stand !== 'all' && x.pvId !== f.stand) return false;
    var st = faStatus(x.v, x.day), sv = fsGet(x.v.id, x.day);
    if (f.pay === 'np' && st.k !== 'np') return false; if (f.pay === 'ok' && st.k === 'np') return false;
    if (f.est === 'non' && sv.etablie) return false; if (f.est === 'oui' && !sv.etablie) return false;
    return true;
  });
}
function renderSapFactures() {
  var el = document.getElementById('mod');
  if (FA.files === null && !FA.loading && getToken()) { faLoad(); return; }
  var all = faAll(), years = {};
  all.forEach(function (x) { years[x.day.slice(0, 4)] = 1; });
  var yl = Object.keys(years).sort().reverse(); if (!FA.year) FA.year = yl[0] || String(new Date().getFullYear()); if (yl.indexOf(FA.year) < 0) yl.unshift(FA.year);
  var st = fsEnsure(FA.year), f = FA.f;
  var stat = st.saving ? '<span class="sv">Enregistrement du suivi…</span>' : st.ops.length ? '<span class="sv warn">' + st.ops.length + ' modification' + (st.ops.length > 1 ? 's' : '') + ' du suivi pas encore sur le serveur</span>' : '';
  var band = '<div class="band"><div class="band-top"><h1>Factures à établir</h1></div>' +
    '<div class="rsel ssbar" role="group" aria-label="Saison">' + yl.map(function (y) { return '<button class="rchip' + (y === FA.year ? ' on' : '') + '" data-fa="year" data-v="' + esc(y) + '">' + esc(y) + '</button>'; }).join('') +
    '<button class="rchip" data-fa="reload"' + (FA.loading ? ' disabled' : '') + '>' + (FA.loading ? 'Lecture des ventes…' : 'Relire les ventes') + '</button></div>' +
    '<p class="soon-lead">' + (FA.at ? 'Ventes lues à ' + String(FA.at.getHours()).padStart(2, '0') + ':' + String(FA.at.getMinutes()).padStart(2, '0') + '. ' : '') + stat + '</p></div>';
  var alerts = [];
  if (!getToken()) alerts.push('<div class="alert">Appareil verrouillé : les fichiers de ventes ne peuvent pas être lus. <button class="btn sm" data-a="go" data-v="parametres">Déverrouiller</button></div>');
  if (FA.err) alerts.push('<div class="alert err">' + FA.err + '</div>');
  if (st.err) alerts.push('<div class="alert err">Suivi des factures : ' + st.err + ' <button class="btn sm" data-fa="retry">Réessayer</button></div>');
  var main = alerts.length ? '<div class="alerts">' + alerts.join('') + '</div>' : '';
  if (FA.loading && !FA.files) { el.innerHTML = band + '<main>' + main + '<section><p class="empty">Lecture des fichiers de ventes de la Caisse…</p></section></main>' + vToast(); return; }
  var ofYear = all.filter(function (x) { return x.day.slice(0, 4) === FA.year; }), stands = {};
  ofYear.forEach(function (x) { stands[x.pvId] = x.pvNom; });
  var list = faFiltered(all), np = 0, nEt = 0;
  list.forEach(function (x) { np += faStatus(x.v, x.day).np; if (!fsGet(x.v.id, x.day).etablie) nEt++; });
  function chips(key, opts) { return opts.map(function (o) { return '<button class="chip' + (f[key] === o[0] ? ' on' : '') + '" data-fa="f" data-k="' + key + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join(''); }
  var sk = Object.keys(stands).sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); });
  var h = '<section><div class="row-between"><h3>Factures demandées ' + esc(FA.year) + '</h3><div class="cbtns"><button class="btn" data-fa="csv"' + (list.length ? '' : ' disabled') + '>Exporter pour Excel</button></div></div>' +
    '<div class="fagrp"><span class="fl">Période</span><div class="fadates"><input type="date" data-fa-d="from" value="' + esc(f.from) + '" aria-label="Du"><span>au</span><input type="date" data-fa-d="to" value="' + esc(f.to) + '" aria-label="Au">' + (f.from || f.to ? '<button class="btn sm" data-fa="nodates">Toute la saison</button>' : '') + '</div></div>' +
    (sk.length > 1 ? '<div class="fagrp"><span class="fl">Stand</span><div class="rsel">' + chips('stand', [['all', 'Tous']].concat(sk.map(function (k) { return [k, stands[k]]; }))) + '</div></div>' : '') +
    '<div class="fagrp"><span class="fl">Paiement</span><div class="rsel">' + chips('pay', [['all', 'Toutes'], ['np', 'Non payées'], ['ok', 'Payées']]) + '</div></div>' +
    '<div class="fagrp"><span class="fl">Facture</span><div class="rsel">' + chips('est', [['all', 'Toutes'], ['non', 'Pas encore établies'], ['oui', 'Établies']]) + '</div></div>' +
    '<p class="num fasum"><strong>' + list.length + '</strong> facture' + (list.length > 1 ? 's' : '') + ' · <strong>' + nEt + '</strong> à établir · non payé <strong>' + money(np) + '</strong></p>';
  if (!list.length) h += '<p class="empty">' + (ofYear.length ? 'Aucune facture ne correspond aux filtres.' : 'Aucune facture demandée en ' + esc(FA.year) + ' dans les fichiers de la Caisse.') + '</p>';
  h += list.map(vFaCard).join('');
  el.innerHTML = band + '<main>' + main + h + '</section></main>' + vToast();
}
function vFaCard(x) {
  var v = x.v, f = v.facture || {}, st = faStatus(v, x.day), sv = fsGet(v.id, x.day), id = esc(v.id);
  return '<div class="facard st-' + st.k + '"><div class="row-between"><span><strong>' + esc(shortDate(x.day)) + ' ' + esc(v.horodatage.slice(11, 16)) + '</strong> · ' + esc(x.pvNom) + ' · vente n° ' + esc(hsNum(v.id)) + '</span><span class="fastat st-' + st.k + '">' + esc(st.t) + '</span></div>' +
    '<div class="fainfo"><div><strong>' + esc(f.societe || '(société non indiquée)') + '</strong>' + (f.adresse ? '<br>' + esc(f.adresse) : '') + '</div><div>' + (f.tva ? 'TVA ' + esc(f.tva) : '<span class="faint">TVA non indiquée</span>') + (f.email ? '<br><a href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a>' : '') + '</div></div>' +
    '<p class="coart">' + faLines(v).map(esc).join(' · ') + '</p>' +
    '<p class="num"><strong>' + money(+v.total || 0) + '</strong>' + (f.horodatage ? ' <span class="faint">· données encodées le ' + esc(hsDm(f.horodatage)) + ' à ' + esc(String(f.horodatage).slice(11, 16)) + (f.modifieeLe ? ', corrigées le ' + esc(hsDm(f.modifieeLe)) + ' à ' + esc(String(f.modifieeLe).slice(11, 16)) : '') + '</span>' : '') + '</p>' +
    '<div class="fasuivi"><label class="chk"><input type="checkbox" data-fa-c="etablie" data-id="' + id + '" data-day="' + esc(x.day) + '"' + (sv.etablie ? ' checked' : '') + '> Facture établie</label>' +
    (sv.etablie ? '<input type="text" class="fanum" placeholder="N° de facture (facultatif)" data-fa-n="1" data-id="' + id + '" data-day="' + esc(x.day) + '" value="' + esc(sv.numero || '') + '" autocomplete="off" aria-label="N° de facture">' : '') +
    (vNonPaye(v) > 0 ? '<label class="chk"><input type="checkbox" data-fa-c="virement" data-id="' + id + '" data-day="' + esc(x.day) + '"' + (sv.virement ? ' checked' : '') + '> Payée par virement</label>' : '') +
    '<button class="btn sm" data-fa="copy" data-id="' + id + '">Copier</button></div></div>';
}
function faCsv() {
  var rows = [['Date', 'Heure', 'Stand', 'N° vente', 'ID vente', 'Société', 'Adresse', 'TVA', 'E-mail', 'Articles', 'Total (€)', 'Payée au stand', 'Reste dû (€)', 'Statut', 'Facture établie', 'N° de facture', 'Payée par virement', 'Encodée le', 'Corrigée le']];
  faFiltered(faAll()).forEach(function (x) {
    var v = x.v, f = v.facture || {}, st = faStatus(v, x.day), sv = fsGet(v.id, x.day);
    rows.push([x.day, v.horodatage.slice(11, 16), x.pvNom, hsNum(v.id), v.id, f.societe || '', f.adresse || '', f.tva || '', f.email || '', faLines(v).join(', '), +v.total || 0, f.payee === false ? 'non' : 'oui', vNonPaye(v), st.t.replace(/ /g, ' '), sv.etablie ? 'oui' : '', sv.numero || '', sv.virement ? 'oui' : '', f.horodatage || '', f.modifieeLe || '']);
  });
  download('factures-sapins_' + FA.year + (FA.f.from || FA.f.to ? '_' + (FA.f.from || 'debut') + '_' + (FA.f.to || 'fin') : '') + '.csv', rows); toast('Fichier pour Excel téléchargé');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-fa]'); if (!b || b.disabled) return;
  var a = b.getAttribute('data-fa');
  if (a === 'year') { FA.year = b.getAttribute('data-v'); FA.f.stand = 'all'; render(); }
  else if (a === 'reload') { FA.files === null ? faLoad() : (FA.loading || faLoad()); }
  else if (a === 'retry') fsSave(FA.year);
  else if (a === 'f') { FA.f[b.getAttribute('data-k')] = b.getAttribute('data-v'); render(); }
  else if (a === 'nodates') { FA.f.from = ''; FA.f.to = ''; render(); }
  else if (a === 'csv') faCsv();
  else if (a === 'copy') { var x = faAll().filter(function (y) { return y.v.id === b.getAttribute('data-id'); })[0]; if (x) faCopy(faCopyText(x)); }
});
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.getAttribute) return;
  if (t.hasAttribute('data-fa-d')) { FA.f[t.getAttribute('data-fa-d')] = t.value; render(); }
  else if (t.hasAttribute('data-fa-c')) {
    var k = t.getAttribute('data-fa-c'), ch = {}; ch[k] = t.checked; ch[k + 'Le'] = t.checked ? new Date().toISOString() : null;
    fsOp(t.getAttribute('data-id'), t.getAttribute('data-day'), ch); toast(k === 'etablie' ? (t.checked ? 'Facture marquée établie' : 'Facture remise « à établir »') : (t.checked ? 'Marquée payée par virement' : 'Virement retiré'));
  }
  else if (t.hasAttribute('data-fa-n')) { var cur = fsGet(t.getAttribute('data-id'), t.getAttribute('data-day')); if ((cur.numero || '') !== t.value.trim()) { fsOp(t.getAttribute('data-id'), t.getAttribute('data-day'), { numero: t.value.trim() }); toast('N° de facture enregistré'); } }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-fa-n')) e.target.blur(); });

/* Bilan des ventes : paiements par stand et par jour (cash, Bancontact, à facturer) */
function vPaiements(S) {
  if (F.caisse !== 'sapin' || !(S.nFact || S.np || S.vir)) return '';
  var rows = Object.keys(S.pay).map(function (k) { return S.pay[k]; }).sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : a.bar.localeCompare(b.bar); });
  var vir = S.vir > 0;
  function tr(r, cls, lab) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + lab + '</td><td class="r num">' + money(r.cash) + '</td><td class="r num">' + money(r.bc) + '</td><td class="r num">' + (r.np ? '<strong class="bad">' + money(r.np) + '</strong>' : money(0)) + '</td>' + (vir ? '<td class="r num">' + money(r.vir) + '</td>' : '') + '<td class="r num"><strong>' + money(r.total) + '</strong></td><td class="r num">' + (r.nFact || '—') + '</td></tr>'; }
  return '<section><h3>Paiements par stand et par jour</h3><p class="lead">Une vente « à facturer » compte dans le total du jour de la vente, mais ni en cash ni en Bancontact tant qu’elle n’est pas payée. Payée plus tard au stand, son paiement est repris ici au jour de la vente (la caisse du jour du paiement le compte dans ses ventes cash).</p>' +
    '<div class="scroll"><table class="stab bil"><thead><tr><th>Jour</th><th class="r">Cash</th><th class="r">Bancontact</th><th class="r">À facturer (non payé)</th>' + (vir ? '<th class="r">Virement</th>' : '') + '<th class="r">Total</th><th class="r">Factures</th></tr></thead><tbody>' +
    rows.map(function (r) { return tr(r, '', esc(shortDate(r.day)) + '<span class="sub">' + esc(r.bar) + '</span>'); }).join('') + (rows.length > 1 ? tr({ cash: S.cash, bc: S.bc, np: S.np, vir: S.vir, total: S.total, nFact: S.nFact }, 'tot', 'Total') : '') + '</tbody></table></div></section>';
}

/* ---------- Gestion d’événement › Livraisons : toutes les livraisons de la saison, avec leur statut ---------- */
var LV = { year: null, f: { stand: 'all', st: 'all', from: '', to: '', q: '' } };
function lvAll() {
  var best = {};
  (FA.files || []).forEach(function (f) { var s = FA.data[f.sha]; if (!s || !s.ok) return; if (!best[s.key] || s.maj > best[s.key].maj) best[s.key] = s; });
  var seen = {}, out = [];
  Object.keys(best).forEach(function (k) { best[k].ventes.forEach(function (x) { if (!(x.v.lignes || []).some(isLivLine) || seen[x.v.id]) return; seen[x.v.id] = 1; out.push({ v: x.v, id: x.v.id, yr: x.v.horodatage.slice(0, 4), day: x.v.horodatage.slice(0, 10), t: x.v.horodatage.slice(11, 16), pvId: x.pv.id || '?', pvNom: x.pv.nom || x.pv.id || '?' }); }); });
  if (LV.year && FEAT('commandes')) { var cd = coDocFor(LV.year); coList(cd).forEach(function (c) { if (c.mode !== 'livraison' || c.statut === 'annulee') return; var L = c.livraison || {};
    out.push({ cmd: c, id: c.id, yr: LV.year, day: L.date || '', t: L.creneau || '', pvId: '_cmd', pvNom: 'Commandes' }); }); }
  return out.sort(function (a, b) { var da = a.day || '9999', db = b.day || '9999'; return da < db ? -1 : da > db ? 1 : a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
}
function lvArts(v) { return (v.lignes || []).filter(function (l) { return !isLivLine(l); }).map(function (l) { return (+l.quantite || 0) + ' × ' + (l.libelle || ''); }); }
function lvPay(x) { var np = vNonPaye(x.v); if (!np) return { k: 'ok', t: 'Payée' }; if (x.v.facture && fsGet(x.v.id, x.day).virement) return { k: 'ok', t: 'Payée (virement)' }; return { k: 'np', t: 'Reste à payer ' + money(np) }; }
function lvDone(x) { return x.cmd ? x.cmd.statut === 'livree' : !!LSUIVI.get(x.id, x.day).livree; }
function lvFiltered(all) {
  var f = LV.f, q = (f.q || '').trim().toLowerCase();
  return all.filter(function (x) {
    if (x.yr !== LV.year) return false;
    if (f.from && x.day < f.from) return false; if (f.to && x.day > f.to) return false;
    if (f.stand !== 'all' && x.pvId !== f.stand) return false;
    var done = lvDone(x);
    if (f.st === 'todo' && done) return false; if (f.st === 'done' && !done) return false;
    if (q) { var c = x.cmd ? { nom: (x.cmd.client || {}).nom, adresse: (x.cmd.livraison || {}).adresse, telephone: (x.cmd.client || {}).tel } : x.v.livraison || {}, hay = [c.nom, c.adresse, c.telephone, x.cmd ? 'commande ' + x.cmd.numero : hsNum(x.v.id), x.pvNom].join(' ').toLowerCase(); if (hay.indexOf(q) < 0) return false; }
    return true;
  });
}
function renderSapLivraisons() {
  var el = document.getElementById('mod');
  if (FA.files === null && !FA.loading && getToken()) { faLoad(); return; }
  if (!LV.year) { var ys = {}; lvAll().forEach(function (x) { if (x.yr) ys[x.yr] = 1; }); LV.year = Object.keys(ys).sort().reverse()[0] || String(new Date().getFullYear()); }
  if (CO.path !== coPath(LV.year) && !CO.loading && !CO.saving && !CO.form && !CO.ops.length) { CO.year = LV.year; coOpen(); return; }
  var all = lvAll(), years = {};
  all.forEach(function (x) { if (x.yr) years[x.yr] = 1; });
  var yl = Object.keys(years).sort().reverse(); if (yl.indexOf(LV.year) < 0) yl.unshift(LV.year);
  var st = LSUIVI.ensure(LV.year); fsEnsure(LV.year);
  var f = LV.f;
  var stat = st.saving ? '<span class="sv">Enregistrement…</span>' : st.ops.length ? '<span class="sv warn">' + st.ops.length + ' modification' + (st.ops.length > 1 ? 's' : '') + ' pas encore sur le serveur</span>' : '';
  var band = '<div class="band"><div class="band-top"><h1>Livraisons</h1></div>' +
    '<div class="rsel ssbar" role="group" aria-label="Saison">' + yl.map(function (y) { return '<button class="rchip' + (y === LV.year ? ' on' : '') + '" data-lv="year" data-v="' + esc(y) + '">' + esc(y) + '</button>'; }).join('') +
    '<button class="rchip" data-lv="reload"' + (FA.loading ? ' disabled' : '') + '>' + (FA.loading ? 'Lecture des ventes…' : 'Relire les ventes') + '</button></div>' +
    '<p class="soon-lead">' + (FA.at ? 'Ventes lues à ' + String(FA.at.getHours()).padStart(2, '0') + ':' + String(FA.at.getMinutes()).padStart(2, '0') + '. ' : '') + stat + '</p></div>';
  var alerts = [];
  if (!getToken()) alerts.push('<div class="alert">Appareil verrouillé : les fichiers de ventes ne peuvent pas être lus. <button class="btn sm" data-a="go" data-v="parametres">Déverrouiller</button></div>');
  if (FA.err) alerts.push('<div class="alert err">' + FA.err + '</div>');
  if (st.err) alerts.push('<div class="alert err">Suivi des livraisons : ' + st.err + ' <button class="btn sm" data-lv="retry">Réessayer</button></div>');
  var main = alerts.length ? '<div class="alerts">' + alerts.join('') + '</div>' : '';
  if (FA.loading && !FA.files) { el.innerHTML = band + '<main>' + main + '<section><p class="empty">Lecture des fichiers de ventes de la Caisse…</p></section></main>' + vToast(); return; }
  var ofYear = all.filter(function (x) { return x.yr === LV.year; }), stands = {}, cnt = { all: 0, todo: 0, done: 0 };
  ofYear.forEach(function (x) { stands[x.pvId] = x.pvNom; });
  var f0 = LV.f.st; LV.f.st = 'all'; lvFiltered(all).forEach(function (x) { cnt.all++; lvDone(x) ? cnt.done++ : cnt.todo++; }); LV.f.st = f0;
  var list = lvFiltered(all);
  function chips(key, opts) { return opts.map(function (o) { return '<button class="chip' + (f[key] === o[0] ? ' on' : '') + '" data-lv="f" data-k="' + key + '" data-v="' + esc(o[0]) + '">' + o[1] + '</button>'; }).join(''); }
  var sk = Object.keys(stands).sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); });
  var h = '<section class="livlist"><div class="row-between"><h3>Livraisons ' + esc(LV.year) + '</h3><div class="cbtns noprint"><button class="btn" data-lv="print"' + (list.length ? '' : ' disabled') + '>Imprimer la liste</button><button class="btn" data-lv="csv"' + (list.length ? '' : ' disabled') + '>Exporter pour le livreur</button></div></div>' +
    '<div class="noprint"><div class="fagrp"><span class="fl">Période</span><div class="fadates"><input type="date" data-lv-d="from" value="' + esc(f.from) + '" aria-label="Du"><span>au</span><input type="date" data-lv-d="to" value="' + esc(f.to) + '" aria-label="Au">' + (f.from || f.to ? '<button class="btn sm" data-lv="nodates">Toute la saison</button>' : '') + '</div></div>' +
    (sk.length > 1 ? '<div class="fagrp"><span class="fl">Stand</span><div class="rsel">' + chips('stand', [['all', 'Tous']].concat(sk.map(function (k) { return [k, esc(stands[k])]; }))) + '</div></div>' : '') +
    '<div class="fagrp"><span class="fl">Statut</span><div class="rsel">' + chips('st', [['all', 'Toutes <span class="num">(' + cnt.all + ')</span>'], ['todo', 'À livrer <span class="num">(' + cnt.todo + ')</span>'], ['done', 'Livrées <span class="num">(' + cnt.done + ')</span>']]) + '</div></div>' +
    '<input type="text" class="cosearch" data-lv-q placeholder="Rechercher : nom, adresse, téléphone, n° de vente…" value="' + esc(f.q) + '" autocomplete="off"></div>';
  if (!list.length) h += '<p class="empty">' + (ofYear.length ? 'Aucune livraison ne correspond aux filtres.' : 'Aucune livraison en ' + esc(LV.year) + ' dans les fichiers de la Caisse.') + '</p>';
  var last = null;
  list.forEach(function (x) { if (x.day !== last) { var n = list.filter(function (y) { return y.day === x.day; }).length; h += '<h4 class="codate' + (x.day ? ' cap' : '') + '">' + (x.day ? esc(longDate(x.day)) + ' ' + esc(x.day.slice(0, 4)) : 'Date de livraison non fixée') + ' <span class="faint num">· ' + n + ' livraison' + (n > 1 ? 's' : '') + '</span></h4>'; last = x.day; } h += x.cmd ? vLvCmdCard(x) : vLvCard(x); });
  el.innerHTML = band + '<main>' + main + h + '</section></main>' + vToast();
}
function vLvCard(x) {
  var v = x.v, c = v.livraison && typeof v.livraison === 'object' ? v.livraison : null, sv = LSUIVI.get(v.id, x.day), done = !!sv.livree, pay = lvPay(x), id = esc(v.id), dd = esc(x.day);
  return '<div class="lvcard' + (done ? ' done' : '') + '"><div class="row-between"><span><strong>' + esc(v.horodatage.slice(11, 16)) + '</strong> · ' + esc(x.pvNom) + ' · vente n° ' + esc(hsNum(v.id)) + '</span>' +
    '<span class="lvstat' + (done ? ' done' : '') + '">' + (done ? 'Livrée' + (sv.livreeLe ? ' le ' + esc(hsDm(sv.livreeLe)) : '') : 'À livrer') + '</span></div>' +
    '<p>' + (c ? '<strong>' + esc(c.nom || '(nom non indiqué)') + '</strong>' + (c.adresse ? ' · ' + esc(c.adresse) : '') + (c.telephone ? ' · <a href="tel:' + esc(String(c.telephone).replace(/\s/g, '')) + '">' + esc(c.telephone) + '</a>' : '') : '<span class="faint">Coordonnées non enregistrées (ancienne version de la caisse)</span>') + '</p>' +
    '<p class="coart">' + (lvArts(v).map(esc).join(' · ') || '—') + '</p>' +
    '<p class="num"><span class="' + (pay.k === 'np' ? 'bad' : 'good') + '">' + esc(pay.t) + '</span>' + (v.livraisonAjoutee ? ' · <span class="faint">livraison ajoutée le ' + esc(hsDm(v.livraisonAjoutee.horodatage)) + '</span>' : '') + (v.facture ? ' · <span class="faint">facture ' + esc(v.facture.societe || '') + '</span>' : '') + '</p>' +
    '<div class="fasuivi"><label class="chk"><input type="checkbox" data-lv-c="1" data-id="' + id + '" data-day="' + dd + '"' + (done ? ' checked' : '') + '> Livrée</label>' +
    '<input type="text" class="lvnote" placeholder="Remarque (facultatif)" data-lv-n="1" data-id="' + id + '" data-day="' + dd + '" value="' + esc(sv.note || '') + '" maxlength="200" autocomplete="off" aria-label="Remarque"></div></div>';
}
function vLvCmdCard(x) {
  var c = x.cmd, cl = c.client || {}, L = c.livraison || {}, done = c.statut === 'livree', sv = LSUIVI.get(c.id, x.day || x.yr), reste = coReste(c), id = esc(c.id);
  var last = done && (c.historique || []).filter(function (h) { return h.statut === 'livree'; }).pop();
  return '<div class="lvcard cmd' + (done ? ' done' : '') + '"><div class="row-between"><span><span class="mvtag tr">Commande</span> <strong>n° ' + esc(c.numero || '…') + '</strong>' + (L.creneau ? ' · ' + esc(L.creneau) : '') + '</span>' +
    '<span class="lvstat' + (done ? ' done' : '') + '">' + (done ? 'Livrée' + (last ? ' le ' + esc(hsDm(last.le)) : '') : c.statut === 'prete' ? 'À livrer · prête' : 'À livrer · à préparer') + '</span></div>' +
    '<p><strong>' + esc(cl.nom || '?') + '</strong>' + (L.adresse ? ' · ' + esc(L.adresse) : '') + (cl.tel ? ' · <a href="tel:' + esc(String(cl.tel).replace(/\s/g, '')) + '">' + esc(cl.tel) + '</a>' : '') + '</p>' +
    '<p class="coart">' + ((c.lignes || []).filter(function (l) { return !isLivLine(l); }).map(function (l) { return esc(l.quantite + ' × ' + l.libelle); }).join(' · ') || '—') + '</p>' +
    '<p class="num">' + (reste > 0.004 ? '<span class="bad">Reste à payer ' + money(reste) + '</span>' : '<span class="good">Payée</span>') + (c.note ? ' · <span class="faint">' + esc(c.note) + '</span>' : '') + '</p>' +
    '<div class="fasuivi"><label class="chk"><input type="checkbox" data-lv-cmd="' + id + '"' + (done ? ' checked' : '') + '> Livrée</label>' +
    '<input type="text" class="lvnote" placeholder="Remarque (facultatif)" data-lv-n="1" data-id="' + id + '" data-day="' + esc(x.day || x.yr) + '" value="' + esc(sv.note || '') + '" maxlength="200" autocomplete="off" aria-label="Remarque">' +
    '<button class="btn sm" data-a="sub" data-v="sapin/commandes">Voir les commandes</button></div></div>';
}
function lvCsv() {
  var rows = [['Jour', 'Heure', 'Stand', 'N° vente', 'Nom', 'Adresse', 'Téléphone', 'Articles à livrer', 'Paiement', 'Reste à payer (€)', 'Livraison ajoutée après coup', 'Statut', 'Livrée le', 'Remarque']];
  lvFiltered(lvAll()).forEach(function (x) {
    if (x.cmd) { var k = x.cmd, kc = k.client || {}, kl = k.livraison || {}, ks = LSUIVI.get(k.id, x.day || x.yr), kr = coReste(k);
      rows.push([x.day, kl.creneau || '', 'Commande', 'commande ' + (k.numero || ''), kc.nom || '', kl.adresse || '', kc.tel || '', (k.lignes || []).filter(function (l) { return !isLivLine(l); }).map(function (l) { return l.quantite + ' x ' + l.libelle; }).join(', '), kr > 0.004 ? 'Reste à payer' : 'Payée', kr > 0.004 ? kr : '', '', k.statut === 'livree' ? 'Livrée' : 'À livrer', '', ks.note || k.note || '']); return; }
    var v = x.v, c = v.livraison || {}, sv = LSUIVI.get(v.id, x.day), pay = lvPay(x);
    rows.push([x.day, v.horodatage.slice(11, 16), x.pvNom, hsNum(v.id), c.nom || '', c.adresse || '', c.telephone || '', lvArts(v).join(', '), pay.t.replace(/ /g, ' '), pay.k === 'np' ? vNonPaye(v) : '', v.livraisonAjoutee ? 'oui' : '', sv.livree ? 'Livrée' : 'À livrer', sv.livreeLe ? String(sv.livreeLe).slice(0, 10) : '', sv.note || '']); });
  download('livraisons-sapins_' + LV.year + (LV.f.from || LV.f.to ? '_' + (LV.f.from || 'debut') + '_' + (LV.f.to || 'fin') : '') + '.csv', rows); toast('Liste des livraisons téléchargée');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-lv]'); if (!b || b.disabled) return;
  var a = b.getAttribute('data-lv');
  if (a === 'year') { LV.year = b.getAttribute('data-v'); LV.f.stand = 'all'; render(); }
  else if (a === 'reload') { if (!FA.loading) faLoad(); }
  else if (a === 'retry') LSUIVI.save(LV.year);
  else if (a === 'f') { LV.f[b.getAttribute('data-k')] = b.getAttribute('data-v'); render(); }
  else if (a === 'nodates') { LV.f.from = ''; LV.f.to = ''; render(); }
  else if (a === 'csv') lvCsv();
  else if (a === 'print') { document.body.classList.add('printliv'); window.print(); setTimeout(function () { document.body.classList.remove('printliv'); }, 500); }
});
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.getAttribute) return;
  if (t.hasAttribute('data-lv-d')) { LV.f[t.getAttribute('data-lv-d')] = t.value; render(); }
  else if (t.hasAttribute('data-lv-cmd')) { var cid = t.getAttribute('data-lv-cmd'), cc = coDoc().commandes[cid]; if (!cc || CO.path !== coPath(LV.year)) { toast('Commande introuvable : actualisez'); render(); return; } coSetStatus(cid, t.checked ? 'livree' : 'prete'); toast(t.checked ? 'Commande marquée livrée' : 'Commande remise « à livrer »'); }
  else if (t.hasAttribute('data-lv-c')) { LSUIVI.op(t.getAttribute('data-id'), t.getAttribute('data-day'), { livree: t.checked, livreeLe: t.checked ? new Date().toISOString() : null }); toast(t.checked ? 'Livraison marquée livrée' : 'Livraison remise « à livrer »'); }
  else if (t.hasAttribute('data-lv-n')) { var cur = LSUIVI.get(t.getAttribute('data-id'), t.getAttribute('data-day')); if ((cur.note || '') !== t.value.trim()) { LSUIVI.op(t.getAttribute('data-id'), t.getAttribute('data-day'), { note: t.value.trim() }); toast('Remarque enregistrée'); } }
});
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.hasAttribute || !t.hasAttribute('data-lv-q')) return;
  LV.f.q = t.value; var pos = t.selectionStart; render(); var i = document.querySelector('[data-lv-q]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) {} }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-lv-n')) e.target.blur(); });

function sapHomeStatus() {
  var st = BIL_CUR === 'sapin' ? { FILES: FILES } : BIL_ST.sapin;
  var n = st ? st.FILES.filter(function (f) { return f.status === 'ok'; }).length : 0;
  return n ? n + ' fichier' + (n > 1 ? 's' : '') + ' de ventes chargé' + (n > 1 ? 's' : '') : 'Catalogue et bilan de la Caisse';
}
function renderSoon(m) {
  document.getElementById('mod').innerHTML =
    '<div class="band"><div class="band-top"><h1>' + esc(m.nom) + '<span class="pill">Bientôt</span></h1></div><p class="soon-lead">' + esc(m.desc) + '</p></div>' +
    '<main><section><h3>Ce que ce module permettra</h3><p class="lead">Le module est prévu dans le menu ; il sera construit dans une prochaine étape.</p><ul class="plan">' +
    m.plan.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
    '<p style="margin:18px 0 0"><button class="btn" data-a="go" data-v="accueil">← Retour à l’accueil</button></p></section></main>' + vToast();
}
/* La page entière est redessinée à chaque action : on garde la position de défilement (verticale et
   celle des tableaux qui défilent en largeur), sinon la page, vidée un instant, remonte tout en haut.
   go() remet volontairement en haut quand on change de module. */
function render() {
  featApply();
  var y = window.scrollY || 0, sl = Array.prototype.map.call(document.querySelectorAll('#mod .scroll'), function (e) { return e.scrollLeft; });
  var app = document.getElementById('app'); if (app.offsetHeight) app.style.minHeight = app.offsetHeight + 'px'; // évite l'écrasement de la hauteur pendant le redessin
  _render();
  featPruneAdmin(app);
  app.style.minHeight = '';
  var sc = document.querySelectorAll('#mod .scroll'); if (sc.length === sl.length) Array.prototype.forEach.call(sc, function (e, i) { if (sl[i]) e.scrollLeft = sl[i]; });
  if (Math.abs((window.scrollY || 0) - y) > 1) window.scrollTo(0, y);
}
function _render() {
  var mm = modById(MOD), ctx = mm && mm.ctx ? mm.ctx : BIL_CUR;
  bilUse(ctx); catUse(ctx);
  document.getElementById('app').innerHTML = vShell() + '<div id="mod"></div>';
  var nv = document.querySelector('.nav'), on = nv && nv.querySelector('button.on');
  if (on && on.offsetLeft + on.offsetWidth > nv.clientWidth) nv.scrollLeft = on.offsetLeft - 8; // onglet actif visible sur téléphone
  var sn = document.querySelector('.subnav'), son = sn && sn.querySelector('.rchip.on');
  if (son && son.offsetLeft + son.offsetWidth > sn.clientWidth) sn.scrollLeft = son.offsetLeft - 8;
  var m = modById(MOD);
  if (!m) renderHome();
  else if (m.ready) m.render();
  else renderSoon(m);
}


/* ================= Publication GitHub : clé chiffrée ================= */
/* Jeton GitHub chiffré (AES-GCM, clé dérivée de la phrase de passe par PBKDF2-SHA256).
   null = pas encore installée : la préparer dans Paramètres > Préparer la clé chiffrée. */
var CLE_CHIFFREE = null; // démo : pas de clé, accès local
/* Clés supplémentaires : autres jetons GitHub chiffrés avec la MÊME phrase de passe (un seul déverrouillage pour tous). */
var CLES_SUPP = [];
var TOKEN_KEY = KP + 'admin-gh-token', LOCAL_CLE_KEY = KP + 'admin-cle-chiffree', TOKENS_KEY = KP + 'admin-gh-tokens', MAP_KEY = KP + 'admin-gh-map';
var tokensMem = null;
var tokenMem = null;
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function getToken() { return lsGet(TOKEN_KEY) || tokenMem; }
function getTokens() { try { var t = JSON.parse(lsGet(TOKENS_KEY) || 'null'); if (Array.isArray(t) && t.length) return t; } catch (e) {} if (tokensMem && tokensMem.length) return tokensMem; var one = getToken(); return one ? [one] : []; }
var TOKNAMES_KEY = KP + 'admin-gh-tokens-noms', CLENAMES_KEY = KP + 'admin-cle-noms';
function getTokenNames() { try { var n = JSON.parse(lsGet(TOKNAMES_KEY) || '[]'); return Array.isArray(n) ? n : []; } catch (e) { return []; } }
function tokenName(i) { var n = getTokenNames()[i]; return n || 'jeton ' + (i + 1); }
function setTokens(list, names) { lsSet(TOKNAMES_KEY, list && list.length && names ? JSON.stringify(names) : list && list.length ? lsGet(TOKNAMES_KEY) : null); list = list && list.length ? list : null; tokensMem = list; tokenMem = list ? list[0] : null; lsSet(TOKENS_KEY, list ? JSON.stringify(list) : null); lsSet(TOKEN_KEY, list ? list[0] : null); lsSet(MAP_KEY, null); }
function setToken(t) { setTokens(t ? [t] : null); }
function addToken(t, nom) { var l = getTokens().slice(), n = getTokenNames().slice(); while (n.length < l.length) n.push(''); if (l.indexOf(t) < 0) { l.push(t); n.push(nom || ''); } setTokens(l, n); }
/* Jeton à utiliser pour un dépôt (établi par « Tester l'accès aux dépôts », fait aussi au déverrouillage) */
function tokenFor(repo) { var ts = getTokens(); if (ts.length < 2) return ts[0] || null; var m = {}; try { m = JSON.parse(lsGet(MAP_KEY) || '{}'); } catch (e) {} return ts[m[repo]] || ts[0]; }
function localCles() { var l = lsGet(LOCAL_CLE_KEY); if (!l) return []; try { var o = JSON.parse(l); return Array.isArray(o) ? o : [o]; } catch (e) { return []; } }
/* Clés installées dans l'app mais retirées sur cet appareil (on ne peut pas les enlever du code depuis la page) */
var CLEHIDE_KEY = KP + 'admin-cle-retirees';
function hiddenCles() { try { var l = JSON.parse(lsGet(CLEHIDE_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function allEmbeddedCles() { return (CLE_CHIFFREE ? [CLE_CHIFFREE] : []).concat(CLES_SUPP); }
function embeddedCles() { var hid = hiddenCles(); return allEmbeddedCles().filter(function (c) { return hid.indexOf(String(c.data || '').slice(0, 24)) < 0; }); }
function pendingLocalCles() { var emb = allEmbeddedCles(); return localCles().filter(function (c) { return !emb.some(function (x) { return x.data === c.data; }); }); }
function allCles() { return embeddedCles().concat(pendingLocalCles()); }
function getCle() { return allCles()[0] || null; }
/* Nom d'une clé chiffrée : nom donné sur cet appareil, sinon champ « nom » de la clé, sinon « Clé n ». Le nom n'est pas secret. */
function cleSig(c) { return String(c && c.data || '').slice(0, 24); }
function cleAliases() { try { return JSON.parse(lsGet(CLENAMES_KEY) || '{}') || {}; } catch (e) { return {}; } }
function cleLabel(c, i) { var a = cleAliases()[cleSig(c)]; return a || (c && c.nom) || (i === 0 ? 'Clé principale' : 'Clé ' + (i + 1)); }
function normPass(p) { return String(p || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase(); }
function b64e(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
function b64d(str) { var s = atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function deriveKey(pass, salt, iter) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(normPass(pass)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });
}
function encryptToken(token, pass) {
  var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 600000;
  return deriveKey(pass, salt, iter).then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(token.trim())); })
    .then(function (ct) { return { v: 1, kdf: 'PBKDF2-SHA256', iter: iter, salt: b64e(salt), iv: b64e(iv), data: b64e(ct) }; });
}
function decryptToken(blob, pass) {
  return deriveKey(pass, b64d(blob.salt), blob.iter).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, k, b64d(blob.data)); })
    .then(function (pt) { return new TextDecoder().decode(pt); });
}
function passStrength(p) {
  var n = normPass(p), words = n.split(' ').filter(function (w) { return w.length >= 3; }).length;
  if (n.length >= 24 && words >= 4) return { ok: true, t: 'Phrase solide.' };
  if (n.length >= 20) return { ok: true, t: 'Acceptable. Quatre mots ou plus, c’est mieux.' };
  return { ok: false, t: 'Trop courte : au moins 20 caractères, idéalement 4 à 5 mots sans lien entre eux.' };
}

/* ================= GitHub ================= */
var REPOS = [
  { id: 'demo/bar', nom: 'Caisse Bar', format: 'caisse-bar/catalogue' },
  { id: DEMO_CAT_REPO, nom: 'Caisse', format: 'agri-garden-caisse/catalogue' },
  { id: 'demo/soiree', nom: 'Caisse Soirée', format: 'chlorophylle-caisse/catalogue' }
];
/* Catalogue de la Caisse Soirée (Chlorophylle) : entrées, tickets (prix de la case, cases par carte), boissons en cases.
   En mémoire, les boissons sont rangées dans « categories » (comme les autres caisses) ; elles redeviennent « boissons » à la publication. */
var SOIREE_FMT = 'chlorophylle-caisse/catalogue';
function isSoiree(d) { return !!d && d.format === SOIREE_FMT; }
function prixCase(d) { return d && d.tickets && +d.tickets.prixCase > 0 ? +d.tickets.prixCase : 0; }
function repoById(id) { return REPOS.filter(function (r) { return r.id === id; })[0] || REPOS[0]; }
function utf8b64(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64utf8(s) { return decodeURIComponent(escape(atob(String(s).replace(/\s/g, '')))); }
function GhError(status, msg) { this.status = status; this.message = msg; }
function ghFetch(path, opts, token) {
  opts = opts || {};
  var h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token && !opts.exact) { var rm = /^\/repos\/([^/]+\/[^/?]+)/.exec(path); if (rm) token = tokenFor(rm[1]) || token; }
  if (token) h.Authorization = 'Bearer ' + token;
  if (opts.body) h['Content-Type'] = 'application/json';
  return fetch('https://api.github.com' + path, { method: opts.method || 'GET', headers: h, body: opts.body, cache: 'no-store' })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new GhError(r.status, j.message || ''); return j; }); },
      function () { throw new GhError(0, 'network'); });
}
function ghGetCatalogue(repo, token) {
  return ghFetch('/repos/' + repo + '/contents/catalogue.json', {}, token).then(function (j) {
    return { sha: j.sha, json: JSON.parse(b64utf8(j.content)) };
  }, function (e) { if (e.status === 404) return { sha: null, json: null }; throw e; });
}
function ghErrText(e, action) {
  if (!e || e.status === undefined) return 'Erreur inattendue : ' + esc(e && e.message || e);
  if (e.status === 0) return 'Pas de réseau : impossible de joindre le serveur. Vérifiez la connexion internet de l’appareil.';
  if (e.status === 401) return 'GitHub refuse le jeton : il a expiré ou a été révoqué. Créez un nouveau jeton et une nouvelle clé dans Paramètres.';
  if (e.status === 403 || e.status === 404) return 'Le jeton n’a pas le droit ' + (action || 'd’écrire') + ' dans ce dépôt. Vérifiez qu’il donne accès au dépôt avec la permission « Contents : Read and write ».';
  if (e.status === 409 || e.status === 422) return 'Le catalogue a changé sur le serveur pendant l’envoi. Rechargez-le, refaites vos modifications et publiez à nouveau.';
  return 'GitHub a répondu une erreur ' + e.status + (e.message ? ' (' + esc(e.message) + ')' : '') + '.';
}

/* ================= Catalogue : données ================= */
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function exampleCatalogue(repo) {
  if (repo.format === SOIREE_FMT) return normalizeCat({ format: SOIREE_FMT, formatVersion: 1, version: 1, date: '2026-10-21', exemple: true, soiree: 'Soirée démo',
    entrees: [{ id: 'entree', libelle: 'Entrée', prix: 15, ordre: 1, actif: true }, { id: 'vip', libelle: 'Table VIP', prix: 300, ordre: 2, actif: true }],
    tickets: { prixCase: 3, casesParCarte: 18 },
    boissons: [{ id: 'softs', nom: 'Softs', ordre: 1, actif: true, produits: [{ id: 'eau-plate', libelle: 'Eau plate', format: 'verre', cases: 1, ordre: 1, actif: true }, { id: 'coca', libelle: 'Coca-Cola', format: 'verre', cases: 1, ordre: 2, actif: true }] },
      { id: 'bieres', nom: 'Bières', ordre: 2, actif: true, produits: [{ id: 'jupiler', libelle: 'Jupiler', format: 'verre', cases: 1, ordre: 1, actif: true }, { id: 'desperados', libelle: 'Desperados', format: 'verre', cases: 2, ordre: 2, actif: true }] },
      { id: 'bulles', nom: 'Bulles', ordre: 3, actif: true, produits: [{ id: 'cava', libelle: 'Cava', format: 'verre', cases: 2, ordre: 1, actif: true }, { id: 'cava-btl', libelle: 'Cava', format: 'bouteille', cases: 10, ordre: 2, actif: true }] }] });
  if (repo.id === DEMO_CAT_REPO) return { format: repo.format, formatVersion: 1, version: 0, date: todayIso(), exemple: true,
    pointsDeVente: [{ id: 'pdv1', nom: 'Point de vente 1', actif: true }], categories: [] };
  if (false) return { format: repo.format, formatVersion: 1, version: 1, date: '2026-10-13', exemple: true,
    pointsDeVente: [{ id: 'pdv1', nom: 'Point de vente 1', actif: true }, { id: 'pdv2', nom: 'Point de vente 2', actif: true }],
    categories: [{ id: 'nord', nom: 'Nordmann', ordre: 1, actif: true, produits: [{ id: 'n1', libelle: '100–125 cm', prix: 39, ordre: 1, actif: true }, { id: 'n2', libelle: '125–150 cm', prix: 49, ordre: 2, actif: true }, { id: 'n3', libelle: '150–175 cm', prix: 59, ordre: 3, actif: true }] },
      { id: 'acc', nom: 'Accessoires', ordre: 2, actif: true, prefixe: false, produits: [{ id: 'a1', libelle: 'Croix en bois', prix: 10, ordre: 1, actif: true }, { id: 'a2', libelle: 'Pied métal', prix: 15, ordre: 2, actif: false }] }] };
  return { format: repo.format, formatVersion: 1, version: 1, date: '2026-10-16', exemple: true,
    pointsDeVente: [{ id: 'pdv1', nom: 'Bar 1', actif: true }, { id: 'pdv2', nom: 'Bar 2', actif: true }],
    categories: [
      { id: 'softs', nom: 'Softs', ordre: 1, actif: true, prefixe: false, produits: [{ id: 's1', libelle: 'Eau plate', prix: 2, ordre: 1, actif: true }, { id: 's2', libelle: 'Eau pétillante', prix: 2, ordre: 2, actif: true }, { id: 's3', libelle: 'Cola', prix: 2.5, ordre: 3, actif: true }, { id: 's4', libelle: 'Jus d’orange', prix: 2.5, ordre: 4, actif: true }] },
      { id: 'bieres', nom: 'Bières', ordre: 2, actif: true, prefixe: false, produits: [{ id: 'b1', libelle: 'Bière pression 25 cl', prix: 2.5, ordre: 1, actif: true }, { id: 'b2', libelle: 'Bière pression 50 cl', prix: 4.5, ordre: 2, actif: true }, { id: 'b3', libelle: 'Bière spéciale', prix: 4, ordre: 3, actif: true }] },
      { id: 'vins', nom: 'Vins', ordre: 3, actif: true, prefixe: false, produits: [{ id: 'v1', libelle: 'Verre de vin rouge', prix: 4, ordre: 1, actif: true }, { id: 'v2', libelle: 'Verre de vin blanc', prix: 4, ordre: 2, actif: true }, { id: 'v4', libelle: 'Bouteille de vin', prix: 18, ordre: 3, actif: true }] },
      { id: 'cocktails', nom: 'Cocktails', ordre: 4, actif: true, prefixe: false, produits: [{ id: 'cocktails-mojito', libelle: 'Mojito', prix: 7, ordre: 1, actif: true }, { id: 'cocktails-spritz', libelle: 'Spritz', prix: 8, ordre: 2, actif: true }] }] };
}
function normalizeCat(d) {
  if (!d || typeof d !== 'object') throw new Error('Ce fichier n’est pas un catalogue.');
  if (d.format === SOIREE_FMT) {
    var cs = clone(d); cs.categories = Array.isArray(cs.categories) ? cs.categories : Array.isArray(cs.boissons) ? cs.boissons : null; delete cs.boissons;
    if (!cs.categories) throw new Error('Catalogue de la Caisse Soirée sans liste « boissons ».');
    cs.pointsDeVente = []; cs.entrees = Array.isArray(cs.entrees) ? cs.entrees : []; cs.tickets = cs.tickets && typeof cs.tickets === 'object' ? cs.tickets : { prixCase: 3, casesParCarte: 18 };
    cs.entrees.forEach(function (e) { if (e.actif === undefined) e.actif = true; }); cs.entrees.sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    cs.categories.forEach(function (k) { if (k.actif === undefined) k.actif = true; if (!Array.isArray(k.produits)) k.produits = [];
      k.produits.forEach(function (p) { if (p.actif === undefined) p.actif = true; if (!p.format) p.format = 'verre'; }); k.produits.sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); }); });
    cs.categories.sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    return cs;
  }
  if (typeof d.format !== 'string' || !/\/catalogue$/.test(d.format) || !Array.isArray(d.categories)) throw new Error('Ce fichier n’est pas un catalogue de caisse (champ « format » ou liste « categories » absent).');
  var c = clone(d);
  c.pointsDeVente = Array.isArray(c.pointsDeVente) ? c.pointsDeVente : [];
  c.pointsDeVente.forEach(function (p) { if (p.actif === undefined) p.actif = true; });
  c.categories.forEach(function (k) { if (k.actif === undefined) k.actif = true; if (!Array.isArray(k.produits)) k.produits = [];
    k.produits.forEach(function (p) { if (p.actif === undefined) p.actif = true; }); k.produits.sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); }); });
  c.categories.sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
  return c;
}
/* Ce qui est réellement publié : ordre recalculé, version et date mises à jour, plus de marque « exemple » */
function finalizeCat(d, version) {
  var c = clone(d);
  delete c.exemple; c.version = version; c.date = todayIso();
  if (isSoiree(c)) {
    c.entrees.forEach(function (e, i) { e.ordre = i + 1; e.prix = Math.round(e.prix * 100) / 100; });
    c.categories.forEach(function (k, i) { k.ordre = i + 1; k.produits.forEach(function (p, j) { p.ordre = j + 1; p.cases = Math.round(p.cases); }); });
    c.tickets = { prixCase: Math.round(+c.tickets.prixCase * 100) / 100, casesParCarte: Math.round(+c.tickets.casesParCarte) };
    var o = { format: c.format, formatVersion: c.formatVersion || 1, version: c.version, date: c.date, soiree: c.soiree || '', entrees: c.entrees, tickets: c.tickets, boissons: c.categories };
    Object.keys(c).forEach(function (k) { if (!(k in o) && k !== 'categories' && k !== 'pointsDeVente') o[k] = c[k]; });
    return o;
  }
  c.categories.forEach(function (k, i) { k.ordre = i + 1; k.produits.forEach(function (p, j) { p.ordre = j + 1; p.prix = Math.round(p.prix * 100) / 100; }); });
  var out = { format: c.format, formatVersion: c.formatVersion || 1, version: c.version, date: c.date };
  Object.keys(c).forEach(function (k) { if (!(k in out)) out[k] = c[k]; });
  return out;
}
function comparable(d) { if (!d) return ''; var c = finalizeCat(d, 0); delete c.date; return JSON.stringify(c); }

/* Catalogue : « main » (Bar, Soirée) et « sapin » (Gestion d’événement › Catalogue), chacun avec son état. */
var SAPIN_REPO = DEMO_CAT_REPO;
var CAT_CUR = 'bar', CAT_ST = {};
var CTX_REPO = { bar: 'demo/bar', soiree: 'demo/soiree', sapin: SAPIN_REPO };
function catRepos() { return REPOS.filter(function (r) { return r.id === CTX_REPO[CAT_CUR]; }); }
function catUse(c) {
  if (c === CAT_CUR) return;
  CAT_ST[CAT_CUR] = CAT;
  CAT = CAT_ST[c] || { repo: CTX_REPO[c] || REPOS[0].id, data: null, base: null, sha: null, source: null, loading: false, msg: null, confirm: null, busy: false };
  if (CAT.loading && !CAT.data) CAT.loading = false; // chargement interrompu : relancé à l'affichage
  CAT_CUR = c;
}
var CAT = { repo: REPOS[0].id, data: null, base: null, sha: null, source: null, loading: false, msg: null, confirm: null, busy: false };
function draftKey() { return KP + 'admin-cat-draft:' + CAT.repo; }
function saveDraft() { if (CAT.data) lsSet(draftKey(), JSON.stringify({ data: CAT.data, base: CAT.base, sha: CAT.sha, source: CAT.source })); }
function dirty() { return CAT.data && comparable(CAT.data) !== comparable(CAT.base); }
function loadCatFor(repoId, forceGithub) {
  var C = CAT;
  C.repo = repoId; C.msg = null; C.confirm = null;
  var dr = !forceGithub && lsGet(draftKey());
  if (dr) { try { var o = JSON.parse(dr); if (o.data && o.data.format === repoById(repoId).format) { C.data = o.data; C.base = o.base; C.sha = o.sha; C.source = o.source; render(); return; } lsSet(draftKey(), null); } catch (e) {} }
  C.loading = true; C.data = null; render();
  ghGetCatalogue(repoId, getToken()).then(function (r) {
    if (C.repo !== repoId) return; // une autre caisse a été choisie entre-temps
    C.loading = false;
    if (r.json && r.json.format !== repoById(repoId).format) { C.data = exampleCatalogue(repoById(repoId)); C.base = null; C.sha = null; C.source = 'exemple'; C.msg = { err: true, t: 'Le catalogue.json du dépôt ' + esc(repoId) + ' n\u2019a pas le format attendu (' + esc(r.json.format || '?') + ' au lieu de ' + esc(repoById(repoId).format) + '). Un catalogue d\u2019exemple est affiché ; vérifiez le dépôt avant de publier.' }; render(); return; }
    if (!r.json) { C.data = exampleCatalogue(repoById(repoId)); C.base = null; C.sha = null; C.source = 'exemple'; C.msg = { t: 'Aucun catalogue publié pour l’instant. Ajoutez les catégories et les articles, puis publiez : la caisse les recevra.' }; }
    else { C.base = normalizeCat(r.json); C.data = clone(C.base); C.sha = r.sha; C.source = 'github'; lsSet(draftKey(), null); toast('Catalogue version ' + C.base.version + ' chargé depuis le serveur'); return; }
    render();
  }, function (e) {
    if (C.repo !== repoId) return;
    C.loading = false;
    if (!C.data) { C.data = exampleCatalogue(repoById(repoId)); C.base = null; C.sha = null; C.source = 'exemple'; }
    C.msg = { err: true, t: ghErrText(e, 'de lire') + (C.source === 'exemple' ? ' Un catalogue d’exemple est affiché en attendant.' : '') };
    render();
  });
}
function uid(prefix, taken) { var i = 1, id; do { id = prefix + i++; } while (taken[id]); return id; }
function slug(s, n) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, n || 16).replace(/-$/, '') || 'cat'; }
function allProductIds() { var t = {}; CAT.data.categories.forEach(function (k) { k.produits.forEach(function (p) { t[p.id] = 1; }); }); return t; }
function parsePrice(s) { var v = String(s).replace(/\s|€/g, '').replace(',', '.'); return v === '' || isNaN(+v) ? NaN : +v; }
function catErrors(d) {
  var e = [], seenP = {}, seenC = {};
  if (!d) return e;
  if (isSoiree(d)) {
    var t = d.tickets || {}, seenE = {};
    if (!(+t.prixCase > 0)) e.push('Tickets : le prix d\u2019une case doit être un montant supérieur à 0.');
    if (!(Math.round(+t.casesParCarte) === +t.casesParCarte && +t.casesParCarte > 0)) e.push('Tickets : le nombre de cases par carte doit être un nombre entier supérieur à 0.');
    d.entrees.forEach(function (x, i) { var n = String(x.libelle || '').trim();
      if (!n) e.push('Entrée n° ' + (i + 1) + ' : le libellé est vide.');
      if (typeof x.prix !== 'number' || isNaN(x.prix) || x.prix < 0) e.push('Entrée « ' + (n || 'n° ' + (i + 1)) + ' » : le prix n\u2019est pas un montant valide.');
      if (seenE[x.id]) e.push('Identifiant d\u2019entrée en double : ' + x.id + '.'); seenE[x.id] = 1; });
    if (!d.categories.length) e.push('Le catalogue n\u2019a aucune catégorie de boissons.');
    d.categories.forEach(function (k, i) {
      var kn = String(k.nom || '').trim() || 'catégorie n° ' + (i + 1);
      if (!String(k.nom || '').trim()) e.push('Catégorie n° ' + (i + 1) + ' : le nom est vide.');
      if (seenC[k.id]) e.push('Identifiant de catégorie en double : ' + k.id + '.'); seenC[k.id] = 1;
      k.produits.forEach(function (p, j) { var pn = String(p.libelle || '').trim();
        if (!pn) e.push(kn + ', boisson n° ' + (j + 1) + ' : le libellé est vide.');
        if (!(Math.round(p.cases) === p.cases && p.cases >= 1)) e.push(kn + ', ' + (pn || 'boisson n° ' + (j + 1)) + ' : le nombre de cases doit être un entier (1 ou plus).');
        if (seenP[p.id]) e.push('Identifiant de boisson en double : ' + p.id + ' (' + (pn || '?') + ').'); seenP[p.id] = 1; });
    });
    return e;
  }
  if (!d.pointsDeVente.some(function (p) { return p.actif; })) e.push('Aucun point de vente visible : les caisses ne pourraient pas être configurées.');
  d.pointsDeVente.forEach(function (p, i) { if (!String(p.nom || '').trim()) e.push('Point de vente n° ' + (i + 1) + ' : le nom est vide.'); });
  if (!d.categories.length) e.push('Le catalogue n’a aucune catégorie.');
  d.categories.forEach(function (k, i) {
    var kn = String(k.nom || '').trim() || 'catégorie n° ' + (i + 1);
    if (!String(k.nom || '').trim()) e.push('Catégorie n° ' + (i + 1) + ' : le nom est vide.');
    if (seenC[k.id]) e.push('Identifiant de catégorie en double : ' + k.id + '.'); seenC[k.id] = 1;
    k.produits.forEach(function (p, j) {
      var pn = String(p.libelle || '').trim();
      if (!pn) e.push(kn + ', article n° ' + (j + 1) + ' : le libellé est vide.');
      if (typeof p.prix !== 'number' || isNaN(p.prix) || p.prix < 0) e.push(kn + ', ' + (pn || 'article n° ' + (j + 1)) + ' : le prix n’est pas un montant valide.');
      if (seenP[p.id]) e.push('Identifiant d’article en double : ' + p.id + ' (' + (pn || '?') + ').'); seenP[p.id] = 1;
    });
  });
  return e;
}
function catDiff(base, cur) {
  var out = { add: [], rem: [], prix: [], other: 0 };
  if (isSoiree(cur)) {
    var bs = base && isSoiree(base) ? base : null;
    function idxS(d) { var m = {}; if (d) d.categories.forEach(function (k) { k.produits.forEach(function (p) { m[p.id] = { p: p, k: k.nom }; }); }); return m; }
    function lab(p) { return p.libelle + (p.format === 'bouteille' ? ' (bouteille)' : ''); }
    var A = idxS(bs), B = idxS(cur);
    Object.keys(B).forEach(function (id) { if (!A[id]) out.add.push(lab(B[id].p)); else { var x = A[id].p, y = B[id].p;
      if (x.cases !== y.cases) out.prix.push(lab(y) + ' : ' + x.cases + ' → ' + y.cases + ' case' + (y.cases > 1 ? 's' : ''));
      else if (x.libelle !== y.libelle || x.format !== y.format || !!x.actif !== !!y.actif || A[id].k !== B[id].k) out.other++; } });
    Object.keys(A).forEach(function (id) { if (!B[id]) out.rem.push(lab(A[id].p)); });
    var ea = {}; (bs ? bs.entrees : []).forEach(function (x) { ea[x.id] = x; });
    cur.entrees.forEach(function (x) { var o = ea[x.id]; if (!o) out.add.push('Entrée ' + x.libelle); else if (Math.abs(o.prix - x.prix) > 0.001) out.prix.push('Entrée « ' + x.libelle + ' » : ' + money(o.prix) + ' → ' + money(x.prix)); else if (o.libelle !== x.libelle || !!o.actif !== !!x.actif) out.other++; delete ea[x.id]; });
    Object.keys(ea).forEach(function (k) { out.rem.push('Entrée ' + ea[k].libelle); });
    if (bs && +bs.tickets.prixCase !== +cur.tickets.prixCase) out.prix.push('Prix d\u2019une case : ' + money(+bs.tickets.prixCase) + ' → ' + money(+cur.tickets.prixCase));
    if (bs && +bs.tickets.casesParCarte !== +cur.tickets.casesParCarte) out.prix.push('Cases par carte : ' + bs.tickets.casesParCarte + ' → ' + cur.tickets.casesParCarte);
    if (bs && (bs.soiree || '') !== (cur.soiree || '')) out.prix.push('Nom de la soirée : ' + (bs.soiree || '—') + ' → ' + (cur.soiree || '—'));
    return out;
  }
  function idx(d) { var m = {}; if (d) d.categories.forEach(function (k) { k.produits.forEach(function (p) { m[p.id] = { p: p, k: k.nom }; }); }); return m; }
  var a = idx(base), b = idx(cur);
  Object.keys(b).forEach(function (id) {
    if (!a[id]) out.add.push(b[id].p.libelle);
    else { var x = a[id].p, y = b[id].p;
      if (Math.abs(x.prix - y.prix) > 0.001) out.prix.push(y.libelle + ' : ' + money(x.prix) + ' → ' + money(y.prix));
      else if (x.libelle !== y.libelle || !!x.actif !== !!y.actif || a[id].k !== b[id].k) out.other++; }
  });
  Object.keys(a).forEach(function (id) { if (!b[id]) out.rem.push(a[id].p.libelle); });
  return out;
}

/* ================= Catalogue : rendu ================= */
function catStatusLine() {
  if (!CAT.data) return CAT.loading ? 'Chargement depuis le serveur…' : '';
  var s = CAT.base ? 'En ligne : version ' + CAT.base.version + ' du ' + CAT.base.date.split('-').reverse().join('/') : (CAT.source === 'exemple' ? 'Catalogue d’exemple, pas encore publié' : 'Chargé depuis un fichier');
  return s + (dirty() ? ' · <strong>modifications non publiées</strong>' : CAT.base ? ' · à jour' : '');
}
function nextVersion() { return Math.max(CAT.base ? CAT.base.version : 0, CAT.data ? CAT.data.version || 0 : 0) + 1; }
function renderCatalogue() {
  var el = document.getElementById('mod');
  if (!CAT.data && !CAT.loading) { loadCatFor(CAT.repo); return; }
  var errs = catErrors(CAT.data), canPub = CAT.data && !errs.length && (dirty() || !CAT.base) && !CAT.busy, unlocked = !!getToken();
  var reps = catRepos();
  var band = '<div class="band"><div class="band-top"><h1>' + (CAT_CUR === 'sapin' ? 'Catalogue' : CAT_CUR === 'soiree' ? 'Catalogue Soirée démo' : 'Catalogue du bar') + '</h1></div>' +
    '<div class="cat-bar">' + (reps.length > 1 ? '<div class="rsel" role="group" aria-label="Caisse">' : '<div class="rsel" hidden>') + reps.map(function (r) { return '<button class="rchip' + (CAT.repo === r.id ? ' on' : '') + '" data-c="repo" data-v="' + r.id + '">' + esc(r.nom) + '</button>'; }).join('') + '</div>' +
    '<p class="cat-status num" id="catStatus">' + catStatusLine() + '</p>' +
    '<div class="cat-acts"><button class="ghost" data-c="reload"' + (CAT.loading ? ' disabled' : '') + '>Recharger</button>' +
    '<label class="ghost lab">Importer un fichier<input type="file" accept=".json,application/json" data-catfile></label>' +
    (CAT.data ? '<button class="ghost" data-c="catExport" title="Fichier JSON, réimportable (Importer un fichier)">Exporter</button><button class="ghost" data-c="catCsv">Exporter pour Excel</button>' : '') +
    (unlocked ? '<button class="pick" id="pubBtn" data-c="askPublish"' + (canPub ? '' : ' disabled') + '>Publier la version ' + nextVersion() + '</button>'
      : '<button class="pick" data-a="go" data-v="parametres">Déverrouiller la publication</button>') + '</div></div></div>';
  if (!CAT.data) { el.innerHTML = band + '<main><section><p class="empty">Chargement du catalogue…</p></section></main>' + vToast(); return; }
  el.innerHTML = band + '<main>' + '<div class="alerts" id="catAlerts">' + vCatAlerts(errs) + '</div>' + vPublishPanel() + (isSoiree(CAT.data) ? vSoireeTop() : vPdv()) + CAT.data.categories.map(vCategory).join('') +
    '<div class="addcat"><button class="btn" data-c="catAdd">+ Ajouter une catégorie</button>' + (dirty() ? '<button class="btn" data-c="askRevert">Annuler toutes les modifications</button>' : '') + '</div>' +
    (CAT.confirm && CAT.confirm.type === 'revert' ? '<div class="alerts"><div class="alert confirm">Revenir au catalogue ' + (CAT.base ? 'en ligne (version ' + CAT.base.version + ')' : 'd’exemple') + ' et perdre les modifications ? <span class="cbtns"><button class="btn danger" data-c="revert">Tout annuler</button><button class="btn" data-c="cancel">Garder mes modifications</button></span></div></div>' : '') +
    '</main>' + vToast();
}
function vCatAlerts(errs) {
  var h = '';
  if (CAT.msg) h += '<div class="alert' + (CAT.msg.err ? ' err' : CAT.msg.ok ? ' ok' : '') + '">' + CAT.msg.t + '</div>';
  if (errs.length) h += '<div class="alert err"><strong>À corriger avant de publier :</strong><ul>' + errs.slice(0, 8).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + (errs.length > 8 ? '<li>… et ' + (errs.length - 8) + ' autre(s)</li>' : '') + '</ul></div>';
  return h;
}
function vPublishPanel() {
  if (!CAT.confirm || CAT.confirm.type !== 'publish') return '';
  var d = catDiff(CAT.base, CAT.data), r = repoById(CAT.repo), lines = [];
  if (d.add.length) lines.push('Ajoutés : ' + d.add.map(esc).join(', '));
  if (d.rem.length) lines.push('Retirés : ' + d.rem.map(esc).join(', '));
  d.prix.forEach(function (p) { lines.push((isSoiree(CAT.data) ? 'Changé : ' : 'Prix : ') + esc(p)); });
  if (d.other) lines.push(d.other + ' autre(s) article(s) modifié(s) (libellé, visibilité ou catégorie)');
  if (!lines.length) lines.push('Ordre, catégories ou points de vente modifiés.');
  return '<section class="pubpanel"><h3>Publier la version ' + nextVersion() + ' sur ' + esc(r.nom) + ' ?</h3>' +
    '<p class="lead">Le fichier catalogue.json du dépôt <span class="mono">' + esc(r.id) + '</span> sera remplacé. Les caisses proposeront « Nouveau catalogue disponible » 1 à 2 minutes après.</p>' +
    (CAT.source !== 'github' ? '<div class="alert">Ce catalogue n’a pas été chargé depuis le serveur : il remplacera entièrement la version en ligne.</div>' : '') +
    '<ul class="plan">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
    '<div class="cbtns"><button class="pick" data-c="publish"' + (CAT.busy ? ' disabled' : '') + '>' + (CAT.busy ? 'Publication…' : 'Publier') + '</button><button class="btn" data-c="cancel"' + (CAT.busy ? ' disabled' : '') + '>Annuler</button></div></section>';
}
function vSoireeTop() {
  var d = CAT.data, t = d.tickets, pc = prixCase(d);
  var rows = d.entrees.map(function (x, i) {
    return '<tr class="' + (x.actif ? '' : 'off') + '"><td><input type="text" id="ent-' + esc(x.id) + '" aria-label="Libellé de l\u2019entrée" data-cf="e.libelle" data-i="' + i + '" value="' + esc(x.libelle) + '"></td>' +
      '<td class="r"><input type="text" inputmode="decimal" class="price num" aria-label="Prix en euros" data-cf="e.prix" data-i="' + i + '" value="' + (isNaN(x.prix) ? '' : String(x.prix).replace('.', ',')) + '"></td>' +
      '<td class="c"><input type="checkbox" aria-label="Visible en caisse" data-cf="e.actif" data-i="' + i + '"' + (x.actif ? ' checked' : '') + '></td>' +
      '<td class="r ord"><button data-c="eUp" data-i="' + i + '" aria-label="Monter"' + (i ? '' : ' disabled') + '>↑</button><button data-c="eDown" data-i="' + i + '" aria-label="Descendre"' + (i < d.entrees.length - 1 ? '' : ' disabled') + '>↓</button><button class="x" data-c="eDel" data-i="' + i + '" aria-label="Supprimer ' + esc(x.libelle) + '">✕</button></td></tr>';
  }).join('');
  return '<section><h3>Soirée</h3><div class="sogrid">' +
      '<label class="fl" for="soNom">Nom de la soirée<input type="text" id="soNom" data-cf="so.nom" value="' + esc(d.soiree || '') + '"></label>' +
      '<label class="fl" for="soPc">Prix d\u2019une case (€)<input type="text" inputmode="decimal" class="num" id="soPc" data-cf="so.prixCase" value="' + String(t.prixCase == null ? '' : t.prixCase).replace('.', ',') + '"></label>' +
      '<label class="fl" for="soCc">Cases par carte<input type="text" inputmode="numeric" class="num" id="soCc" data-cf="so.casesParCarte" value="' + esc(t.casesParCarte == null ? '' : t.casesParCarte) + '"></label></div>' +
      '<p class="hint" id="soCarte">Une carte de tickets vaut ' + (pc && +t.casesParCarte ? money(pc * t.casesParCarte) : '—') + '.</p></section>' +
    '<section><h3>Entrées</h3><p class="lead">Les tarifs proposés à la caisse Entrées.</p><div class="scroll"><table class="ptab"><thead><tr><th>Entrée</th><th class="r">Prix (€)</th><th class="c">Visible</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="empty">Aucune entrée.</td></tr>') + '</tbody></table></div>' +
    '<button class="btn" data-c="eAdd">+ Ajouter une entrée</button></section>' +
    '<p class="lead" style="grid-column:span 12;margin:0">Boissons : le prix se compte en cases à barrer (1 case = <span id="soCase">' + (pc ? money(pc) : '—') + '</span>).</p>';
}
function vPdv() {
  return '<section><h3>Points de vente</h3><p class="lead">Chaque appareil de caisse est assigné une fois à l’un d’eux. Masquer un point de vente le retire du choix sur les appareils.</p>' +
    '<div class="pdvs">' + CAT.data.pointsDeVente.map(function (p, i) {
      return '<div class="pdv"><input type="text" id="pdv-' + i + '" aria-label="Nom du point de vente" data-cf="pdv.nom" data-i="' + i + '" value="' + esc(p.nom) + '">' +
        '<label class="tog"><input type="checkbox" data-cf="pdv.actif" data-i="' + i + '"' + (p.actif ? ' checked' : '') + '>Visible</label><span class="faint mono">' + esc(p.id) + '</span></div>';
    }).join('') + '</div><button class="btn" data-c="pdvAdd">+ Ajouter un point de vente</button></section>';
}
function vCategory(k, ci) {
  var n = CAT.data.categories.length, conf = CAT.confirm && CAT.confirm.type === 'catDel' && CAT.confirm.ci === ci;
  var so = isSoiree(CAT.data), pc = prixCase(CAT.data);
  var rows = k.produits.map(function (p, pi) {
    return '<tr class="' + (p.actif ? '' : 'off') + '"><td><input type="text" id="lib-' + esc(p.id) + '" aria-label="Libellé" data-cf="p.libelle" data-ci="' + ci + '" data-pi="' + pi + '" value="' + esc(p.libelle) + '"></td>' +
      (so ? '<td><select aria-label="Format" data-cf="p.format" data-ci="' + ci + '" data-pi="' + pi + '"><option value="verre"' + (p.format !== 'bouteille' ? ' selected' : '') + '>Verre</option><option value="bouteille"' + (p.format === 'bouteille' ? ' selected' : '') + '>Bouteille</option></select></td>' +
        '<td class="r"><input type="text" inputmode="numeric" class="price num" id="cases-' + esc(p.id) + '" aria-label="Nombre de cases" data-cf="p.cases" data-ci="' + ci + '" data-pi="' + pi + '" value="' + (isNaN(p.cases) ? '' : p.cases) + '"></td>' +
        '<td class="r num faint" id="eq-' + esc(p.id) + '">' + (pc && p.cases > 0 ? money(p.cases * pc) : '—') + '</td>'
      : '<td class="r"><input type="text" inputmode="decimal" class="price num" id="prix-' + esc(p.id) + '" aria-label="Prix en euros" data-cf="p.prix" data-ci="' + ci + '" data-pi="' + pi + '" value="' + (isNaN(p.prix) ? '' : String(p.prix).replace('.', ',')) + '"></td>') +
      '<td class="c"><input type="checkbox" aria-label="Visible en caisse" data-cf="p.actif" data-ci="' + ci + '" data-pi="' + pi + '"' + (p.actif ? ' checked' : '') + '></td>' +
      '<td class="r ord"><button data-c="pUp" data-ci="' + ci + '" data-pi="' + pi + '" aria-label="Monter"' + (pi ? '' : ' disabled') + '>↑</button><button data-c="pDown" data-ci="' + ci + '" data-pi="' + pi + '" aria-label="Descendre"' + (pi < k.produits.length - 1 ? '' : ' disabled') + '>↓</button><button class="x" data-c="pDel" data-ci="' + ci + '" data-pi="' + pi + '" aria-label="Supprimer ' + esc(p.libelle) + '">✕</button></td></tr>';
  }).join('');
  return '<section class="catsec' + (k.actif ? '' : ' off') + '"><div class="cathead"><input type="text" class="cname" id="cat-' + esc(k.id) + '" aria-label="Nom de la catégorie" data-cf="c.nom" data-ci="' + ci + '" value="' + esc(k.nom) + '">' +
    '<div class="ctools"><label class="tog"><input type="checkbox" data-cf="c.actif" data-ci="' + ci + '"' + (k.actif ? ' checked' : '') + '>Visible</label>' +
    (so ? '' : '<label class="tog" title="Afficher le nom de la catégorie devant l’article dans le panier et les ventes"><input type="checkbox" data-cf="c.prefixe" data-ci="' + ci + '"' + (k.prefixe !== false ? ' checked' : '') + '>Nom devant l’article</label>') +
    '<span class="ord"><button data-c="cUp" data-ci="' + ci + '" aria-label="Monter la catégorie"' + (ci ? '' : ' disabled') + '>↑</button><button data-c="cDown" data-ci="' + ci + '" aria-label="Descendre la catégorie"' + (ci < n - 1 ? '' : ' disabled') + '>↓</button><button class="x" data-c="askCatDel" data-ci="' + ci + '">Supprimer</button></span></div></div>' +
    (conf ? '<div class="alert confirm">Supprimer « ' + esc(k.nom) + ' » et ses ' + k.produits.length + ' article(s) ? <span class="cbtns"><button class="btn danger" data-c="catDel" data-ci="' + ci + '">Supprimer</button><button class="btn" data-c="cancel">Annuler</button></span></div>' : '') +
    '<div class="scroll"><table class="ptab' + (so ? ' so' : '') + '"><thead><tr><th>' + (so ? 'Boisson' : 'Article') + '</th>' + (so ? '<th>Format</th><th class="r">Cases</th><th class="r">Soit</th>' : '<th class="r">Prix (€)</th>') + '<th class="c">Visible</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="' + (so ? 6 : 4) + '" class="empty">Aucun article.</td></tr>') + '</tbody></table></div>' +
    '<button class="btn" data-c="pAdd" data-ci="' + ci + '">+ Ajouter ' + (so ? 'une boisson' : 'un article') + '</button></section>';
}
/* Après une saisie : on met à jour seulement l'état, les alertes et le bouton Publier (le focus reste dans le champ) */
function catSoftRefresh() {
  saveDraft();
  var errs = catErrors(CAT.data), a = document.getElementById('catAlerts'), s = document.getElementById('catStatus'), b = document.getElementById('pubBtn');
  if (a) a.innerHTML = vCatAlerts(errs);
  if (s) s.innerHTML = catStatusLine();
  if (b) { b.disabled = !(!errs.length && (dirty() || !CAT.base) && !CAT.busy); b.textContent = 'Publier la version ' + nextVersion(); }
}
function publishCat() {
  var C = CAT;
  var token = getToken(); if (!token) { go('parametres'); return; }
  var r = repoById(C.repo);
  if (!C.data || C.data.format !== r.format) { C.confirm = null; C.msg = { err: true, t: 'Publication bloquée : le catalogue affiché n\u2019est pas celui de la ' + esc(r.nom) + '. Rechargez-le depuis le serveur.' }; render(); return; }
  C.busy = true; C.msg = null; render();
  ghGetCatalogue(r.id, token).then(function (cur) {
    if (cur.json && cur.json.format !== r.format) throw { status: -1 };
    if (C.source === 'github' && C.sha && cur.sha !== C.sha) throw new GhError(409, 'conflict');
    var v = Math.max(cur.json ? cur.json.version || 0 : 0, C.base ? C.base.version : 0, C.data.version || 0) + 1;
    var out = finalizeCat(C.data, v), body = { message: 'Catalogue v' + v + ' (Admin)', content: utf8b64(JSON.stringify(out, null, 2) + '\n') };
    if (cur.sha) body.sha = cur.sha;
    return ghFetch('/repos/' + r.id + '/contents/catalogue.json', { method: 'PUT', body: JSON.stringify(body) }, token).then(function (res) {
      C.base = normalizeCat(out); C.data = clone(C.base); C.sha = res.content && res.content.sha; C.source = 'github'; C.busy = false; C.confirm = null;
      lsSet(draftKey(), null);
      C.msg = { ok: true, t: 'Version ' + v + ' publiée sur ' + esc(r.nom) + '. Les caisses la proposeront dans 1 à 2 minutes.' };
      toast('Catalogue version ' + v + ' publié');
    });
  }).catch(function (e) {
    C.busy = false; C.confirm = null;
    C.msg = { err: true, t: e && e.status === -1 ? 'Publication bloquée : le catalogue en ligne de ' + esc(r.nom) + ' n\u2019a pas le format attendu.' : ghErrText(e) + (e && e.status === 409 ? ' Vos modifications sont gardées ici en attendant.' : '') };
    render();
  });
}
function catExportName(ext) { var n = slug(themeGet().nom || 'catalogue') || 'catalogue'; return 'catalogue_' + n + (isSoiree(CAT.data) ? '_soiree' : '') + '_' + todayIso() + '.' + ext; }
function catExport() { if (!CAT.data) return; saveJson(catExportName('json'), finalizeCat(CAT.data, CAT.data.version || 0)); toast('Catalogue exporté'); }
function catCsv() {
  var d = CAT.data; if (!d) return; var so = isSoiree(d), rows = [];
  if (so) { rows.push(['Type', 'Catégorie', 'Article', 'Format', 'Cases', 'Prix (€)', 'Visible']); (d.entrees || []).forEach(function (e) { rows.push(['Entrée', '', e.libelle, '', '', e.prix, e.actif === false ? 'non' : 'oui']); }); }
  else { rows.push(['Type', 'Catégorie', 'Article', 'Prix (€)', 'Visible']); (d.pointsDeVente || []).forEach(function (p) { rows.push(['Point de vente', '', p.nom, '', p.actif === false ? 'non' : 'oui']); }); }
  (d.categories || []).forEach(function (k) { (k.produits || []).forEach(function (p) { rows.push(so ? ['Boisson', k.nom, p.libelle, p.format || '', p.cases || 0, '', (k.actif === false || p.actif === false) ? 'non' : 'oui'] : ['Article', k.nom, p.libelle, p.prix, (k.actif === false || p.actif === false) ? 'non' : 'oui']); }); });
  download(catExportName('csv'), rows); toast('Catalogue exporté pour Excel');
}
function catClick(el) {
  var c = el.getAttribute('data-c'), ci = +el.getAttribute('data-ci'), pi = +el.getAttribute('data-pi'), v = el.getAttribute('data-v'), d = CAT.data;
  function mv(arr, i, j) { var x = arr.splice(i, 1)[0]; arr.splice(j, 0, x); }
  if (c === 'catExport') { catExport(); return; }
  if (c === 'catCsv') { catCsv(); return; }
  if (c === 'repo') { if (v !== CAT.repo) loadCatFor(v); return; }
  if (c === 'reload') { if (dirty() && !(CAT.confirm && CAT.confirm.type === 'reload')) { CAT.confirm = { type: 'reload' }; CAT.msg = { t: 'Recharger depuis le serveur remplacera vos modifications non publiées. <span class="cbtns"><button class="btn danger" data-c="reload">Recharger quand même</button><button class="btn" data-c="cancel">Annuler</button></span>' }; render(); return; } loadCatFor(CAT.repo, true); return; }
  if (c === 'cancel') { CAT.confirm = null; if (CAT.msg && /data-c="reload"/.test(CAT.msg.t)) CAT.msg = null; render(); return; }
  if (c === 'askPublish') { CAT.confirm = { type: 'publish' }; render(); window.scrollTo(0, 0); return; }
  if (c === 'publish') { publishCat(); return; }
  if (c === 'askRevert') { CAT.confirm = { type: 'revert' }; render(); return; }
  if (c === 'revert') { CAT.data = CAT.base ? clone(CAT.base) : exampleCatalogue(repoById(CAT.repo)); CAT.confirm = null; lsSet(draftKey(), null); toast('Modifications annulées'); return; }
  if (c === 'askCatDel') { CAT.confirm = { type: 'catDel', ci: ci }; render(); return; }
  if (c === 'catDel') { d.categories.splice(ci, 1); CAT.confirm = null; }
  else if (c === 'cUp') mv(d.categories, ci, ci - 1);
  else if (c === 'cDown') mv(d.categories, ci, ci + 1);
  else if (c === 'pUp') mv(d.categories[ci].produits, pi, pi - 1);
  else if (c === 'pDown') mv(d.categories[ci].produits, pi, pi + 1);
  else if (c === 'pDel') d.categories[ci].produits.splice(pi, 1);
  else if (c === 'eAdd') { var te = {}; d.entrees.forEach(function (x) { te[x.id] = 1; }); var eid = uid('entree', te); d.entrees.push({ id: eid, libelle: '', prix: NaN, ordre: d.entrees.length + 1, actif: true }); saveDraft(); render(); var fe = document.getElementById('ent-' + eid); if (fe) fe.focus(); return; }
  else if (c === 'eDel') d.entrees.splice(+el.getAttribute('data-i'), 1);
  else if (c === 'eUp') { var ei = +el.getAttribute('data-i'); mv(d.entrees, ei, ei - 1); }
  else if (c === 'eDown') { var ej = +el.getAttribute('data-i'); mv(d.entrees, ej, ej + 1); }
  else if (c === 'pAdd') { var k = d.categories[ci]; var id = uid(slug(k.id).slice(0, 8) + '-', allProductIds()); k.produits.push(isSoiree(d) ? { id: id, libelle: '', format: 'verre', cases: NaN, ordre: k.produits.length + 1, actif: true } : { id: id, libelle: '', prix: NaN, ordre: k.produits.length + 1, actif: true }); saveDraft(); render(); var f = document.getElementById('lib-' + id); if (f) f.focus(); return; }
  else if (c === 'catAdd') { var t = {}; d.categories.forEach(function (x) { t[x.id] = 1; }); var cid = uid('cat', t); d.categories.push({ id: cid, nom: '', ordre: d.categories.length + 1, actif: true, produits: [] }); saveDraft(); render(); var g = document.getElementById('cat-' + cid); if (g) { g.focus(); g.scrollIntoView({ block: 'center' }); } return; }
  else if (c === 'pdvAdd') { var tp = {}; d.pointsDeVente.forEach(function (x) { tp[x.id] = 1; }); d.pointsDeVente.push({ id: uid('pdv', tp), nom: '', actif: true }); saveDraft(); render(); var h = document.getElementById('pdv-' + (d.pointsDeVente.length - 1)); if (h) h.focus(); return; }
  saveDraft(); render();
}
function catInput(el) {
  var f = el.getAttribute('data-cf'), ci = +el.getAttribute('data-ci'), pi = +el.getAttribute('data-pi'), i = +el.getAttribute('data-i'), d = CAT.data, val = el.type === 'checkbox' ? el.checked : el.value;
  if (f === 'pdv.nom') d.pointsDeVente[i].nom = val;
  else if (f === 'pdv.actif') d.pointsDeVente[i].actif = val;
  else if (f === 'c.nom') d.categories[ci].nom = val;
  else if (f === 'c.actif') { d.categories[ci].actif = val; el.closest('.catsec').classList.toggle('off', !val); }
  else if (f === 'c.prefixe') { if (val) delete d.categories[ci].prefixe; else d.categories[ci].prefixe = false; }
  else if (f === 'p.libelle') d.categories[ci].produits[pi].libelle = val;
  else if (f === 'p.prix') d.categories[ci].produits[pi].prix = parsePrice(val);
  else if (f === 'p.cases') { var pp = d.categories[ci].produits[pi], cv = parsePrice(val); pp.cases = cv; var eq = document.getElementById('eq-' + pp.id); if (eq) eq.textContent = prixCase(d) && cv > 0 ? money(cv * prixCase(d)) : '—'; }
  else if (f === 'p.format') d.categories[ci].produits[pi].format = val;
  else if (f === 'e.libelle') d.entrees[i].libelle = val;
  else if (f === 'e.prix') d.entrees[i].prix = parsePrice(val);
  else if (f === 'e.actif') { d.entrees[i].actif = val; el.closest('tr').classList.toggle('off', !val); }
  else if (f === 'so.nom') d.soiree = val;
  else if (f === 'so.prixCase' || f === 'so.casesParCarte') {
    d.tickets[f === 'so.prixCase' ? 'prixCase' : 'casesParCarte'] = parsePrice(val);
    var pcx = prixCase(d), sc = document.getElementById('soCarte'), sca = document.getElementById('soCase'); if (sca) sca.textContent = pcx ? money(pcx) : '—'; if (sc) sc.textContent = 'Une carte de tickets vaut ' + (pcx && +d.tickets.casesParCarte ? money(pcx * d.tickets.casesParCarte) : '—') + '.';
    d.categories.forEach(function (k) { k.produits.forEach(function (p) { var q = document.getElementById('eq-' + p.id); if (q) q.textContent = pcx && p.cases > 0 ? money(p.cases * pcx) : '—'; }); });
  }
  else if (f === 'p.actif') { d.categories[ci].produits[pi].actif = val; el.closest('tr').classList.toggle('off', !val); }
  catSoftRefresh();
}
function catImport(file) {
  var rd = new FileReader();
  rd.onload = function () {
    try { var c = normalizeCat(JSON.parse(rd.result)), want = repoById(CAT.repo);
      if (c.format !== want.format) { var other = REPOS.filter(function (x) { return x.format === c.format; })[0]; throw new Error('ce catalogue est celui de la ' + (other ? other.nom : 'caisse « ' + c.format + ' »') + ', pas de la ' + want.nom + '. Choisissez la bonne caisse avant d\u2019importer.'); }
      CAT.data = c; CAT.source = 'fichier'; CAT.confirm = null; CAT.msg = { t: 'Catalogue « ' + esc(file.name) + ' » (version ' + c.version + ') chargé. Il n’est pas encore publié.' }; saveDraft(); render(); }
    catch (e) { CAT.msg = { err: true, t: esc(file.name) + ' : ' + esc(e instanceof SyntaxError ? 'fichier illisible (JSON invalide).' : e.message) }; render(); }
  };
  rd.readAsText(file);
}
function catHomeStatus() {
  if (!CAT.data) return 'Modifier les produits et publier';
  return repoById(CAT.repo).nom + ' · ' + (dirty() ? 'modifications non publiées' : CAT.base ? 'version ' + CAT.base.version + ' en ligne' : 'exemple');
}

/* ================= Paramètres ================= */
var PAR = { msg: null, busy: false, out: null, tests: null };
function renderParametres() {
  var P = SUB.parametres || 'apparence';
  var db = demoDb(), n = 0; Object.keys(db).forEach(function (r) { n += Object.keys(db[r]).length; });
  var used = 0; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(KP + '') === 0) used += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {}
  document.getElementById('mod').innerHTML = '<div style="height:18px"></div><main>' + (P === 'apparence' ? vApparence('app') : P === 'ticket' ? vApparence('ticket') : P === 'fonctionnalites' ? vFeatures() : vSecuriteHead() +
    (CLIENT.donnees === 'github' ? vConnexion() : '<section><h3>Données de démonstration</h3><p class="lead">Tout est rangé dans ce navigateur (aucun compte, aucun serveur). L’app Caisse ouverte sur ce même appareil voit le catalogue publié ici, et ses ventes arrivent dans le Bilan, le Stock et l’Historique.</p>' +
    '<p class="hint">' + n + ' fichier' + (n > 1 ? 's' : '') + ' sur le serveur de démonstration · ' + Math.round(used / 1024) + ' Ko utilisés.</p>' +
    (PAR.demoAsk ? '<div class="alert">' + (PAR.demoAsk === 'seed' ? 'Remplacer toutes les données par l’exemple ?' : 'Effacer toutes les données de démonstration (catalogue, ventes, stock, caisse) ?') + '</div>' : '') +
    '<div class="cbtns">' + (PAR.demoAsk ? '<button class="btn' + (PAR.demoAsk === 'reset' ? ' danger' : '') + '" data-p="demoGo">Oui, ' + (PAR.demoAsk === 'seed' ? 'charger l’exemple' : 'tout effacer') + '</button><button class="btn" data-p="demoNo">Annuler</button>'
      : '<button class="btn" data-p="demoSeed">Charger un exemple</button><button class="btn danger" data-p="demoReset">Tout effacer</button>') + '</div>' +
    '<p class="hint">L’exemple contient un catalogue (2 points de vente, 3 catégories), un stock avec livraisons et transfert, et deux jours de ventes et de caisse. Rechargez l’app Caisse après le chargement.</p></section>' +
    '<section><h3>Fonctionnement réel</h3><p class="lead">Dans la version réelle, le catalogue, les ventes, le stock et la caisse sont enregistrés sur un dépôt en ligne privé, avec un accès protégé par une phrase de passe. Plusieurs tablettes et l’Admin travaillent alors ensemble à distance.</p></section>')) +
    '</main>' + vToast();
}
function vTests() {
  if (!PAR.tests) return '';
  return '<ul class="plan tests">' + PAR.tests.map(function (t) { return '<li><strong>' + esc(t.nom) + '</strong> : ' + t.t + '</li>'; }).join('') + '</ul>';
}
function testRepos() {
  var tokens = getTokens(); PAR.busy = true; PAR.tests = null; render();
  var repos = REPOS.concat([{ id: DATA_REPO, nom: 'Données du stock (' + DATA_REPO.split('/')[1] + ')' }, { id: SALES_REPO, nom: 'Ventes des caisses (' + SALES_REPO.split('/')[1] + ' : Bilan et stock)' }]);
  Promise.all(repos.map(function (r) {
    return Promise.all(tokens.map(function (t, ti) {
      return ghFetch('/repos/' + r.id, { exact: true }, t).then(function (j) { return { ti: ti, ok: true, push: !!(j.permissions && j.permissions.push) }; }, function (e) { return { ti: ti, ok: false, e: e }; });
    })).then(function (res) {
      var best = res.filter(function (x) { return x.ok && (r.lecture || x.push); })[0] || res.filter(function (x) { return x.ok; })[0], tag = tokens.length > 1 && best ? ' <span class="faint">(' + esc(tokenName(best.ti)) + ')</span>' : '';
      if (!best) return { id: r.id, nom: r.nom, t: '<span class="bad">' + ghErrText(res[0] && res[0].e, 'd\u2019accéder') + '</span>' };
      return { id: r.id, ti: best.ti, nom: r.nom, t: (r.lecture ? '<span class="good">lecture autorisée</span>' : best.push ? '<span class="good">écriture autorisée</span>' : '<span class="bad">lecture seule : impossible d\u2019enregistrer</span>') + tag };
    });
  })).then(function (res) {
    var map = {}; res.forEach(function (x) { if (x.ti != null) map[x.id] = x.ti; }); lsSet(MAP_KEY, JSON.stringify(map));
    PAR.busy = false; PAR.tests = res; render();
  });
}
function parSubmit(form) {
  var kind = form.getAttribute('data-p-form');
  if (kind === 'unlock') {
    var pass = document.getElementById('pp').value; PAR.busy = true; PAR.msg = null; render();
    var cles = allCles();
    Promise.all(cles.map(function (c) { return decryptToken(c, pass).then(function (t) { return t; }, function () { return null; }); })).then(function (toks) {
      var ok = [], names = []; toks.forEach(function (t, i) { if (t && ok.indexOf(t) < 0) { ok.push(t); names.push(cleLabel(cles[i], i)); } });
      PAR.busy = false;
      if (!ok.length) { PAR.msg = { err: true, t: 'Phrase de passe incorrecte. Vérifiez les mots et leur ordre.' }; render(); var f = document.getElementById('pp'); if (f) f.focus(); return; }
      setTokens(ok, names);
      PAR.msg = { ok: true, t: 'Appareil déverrouillé' + (ok.length > 1 ? ' (' + ok.length + ' jetons)' : '') + (ok.length < cles.length ? '. ' + (cles.length - ok.length) + ' clé(s) n\u2019ont pas été ouvertes avec cette phrase.' : '.') };
      testRepos();
    });
  } else if (kind === 'prep') {
    var cnom = (document.getElementById('cleNom').value || '').trim().slice(0, 40), tok = document.getElementById('tok').value.trim(), p1 = document.getElementById('np1').value, p2 = document.getElementById('np2').value, also = document.getElementById('alsoUnlock').checked;
    if (!cnom) { PAR.msg = { err: true, t: 'Donnez un nom à la clé pour pouvoir la reconnaître.' }; render(); return; }
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(tok)) { PAR.msg = { err: true, t: 'Le jeton ne ressemble pas à un jeton GitHub (il commence par « github_pat_ »).' }; render(); return; }
    if (!passStrength(p1).ok) { PAR.msg = { err: true, t: 'Phrase de passe trop courte : au moins 20 caractères.' }; render(); return; }
    if (normPass(p1) !== normPass(p2)) { PAR.msg = { err: true, t: 'Les deux phrases de passe sont différentes.' }; render(); return; }
    PAR.busy = true; PAR.msg = null; render();
    var first = getCle();
    (first ? decryptToken(first, p1).then(function (t) { return t; }, function () { return false; }) : Promise.resolve(null)).then(function (chk) {
      if (chk === false) { PAR.busy = false; PAR.msg = { err: true, t: 'Utilisez la même phrase de passe que la clé déjà installée : ainsi un seul déverrouillage ouvre tous les jetons.' }; render(); return; }
      if (chk && chk === tok) { PAR.busy = false; PAR.msg = { err: true, t: 'Ce jeton est déjà dans la clé installée : rien à ajouter. Pour donner accès à un nouveau dépôt, modifiez simplement ce jeton sur le serveur (Edit).' }; render(); return; }
      return encryptToken(tok, p1).then(function (blob) {
        blob.nom = cnom;
        var list = localCles(); list.push(blob); lsSet(LOCAL_CLE_KEY, JSON.stringify(list)); PAR.out = JSON.stringify(blob);
        if (also) addToken(tok, cnom);
        PAR.busy = false; PAR.msg = { ok: true, t: 'Clé « ' + esc(cnom) + ' » chiffrée et ajoutée. Envoyez-la à Claude pour l\u2019installer dans l\u2019app' + (also ? ' ; cet appareil peut déjà l\u2019utiliser.' : '.') };
        render(); if (also) testRepos();
      });
    }).catch(function (e) { PAR.busy = false; PAR.msg = { err: true, t: 'Chiffrement impossible sur ce navigateur (' + esc(e && e.message || e) + ').' }; render(); });
  }
}
/* ---------- Paramètres › Apparence : theme.json publié à côté de catalogue.json, lu par toutes les caisses ---------- */
var TH_PUB = { busy: false, timer: null };
function thDraft() { var o = themeCopy(); return JSON.parse(JSON.stringify(o.t || {})); }
function thSet(path, v) {
  var o = themeCopy(), t = JSON.parse(JSON.stringify(o.t || {})), k = path.split('.');
  if (k[0] === 'ticket' && (k[1] === 'adr1' || k[1] === 'adr2')) { t.ticket = t.ticket || {}; var ad = (t.ticket.adresse || []).slice(); ad[k[1] === 'adr1' ? 0 : 1] = v; t.ticket.adresse = [ad[0] || '', ad[1] || '']; }
  else { var cur = t; for (var i = 0; i < k.length - 1; i++) { if (!cur[k[i]] || typeof cur[k[i]] !== 'object') cur[k[i]] = {}; cur = cur[k[i]]; } if (v === '' || v == null) delete cur[k[k.length - 1]]; else cur[k[k.length - 1]] = v; }
  if (['couleur', 'accent', 'fond', 'barre', 'tuile', 'police', 'policeTitres', 'forme', 'ombre'].indexOf(k[0]) >= 0) delete t.modele;
  themeSaveCopy({ t: t, version: o.version, publieLe: o.publieLe, pending: true, err: null }); themeApply(); thRefresh(); clearTimeout(TH_PUB.timer); TH_PUB.timer = setTimeout(thPublish, 1200); }
function thModele(id) {
  var m = TH_MODELES.filter(function (x) { return x.id === id; })[0]; if (!m) return; var o = themeCopy(), t = JSON.parse(JSON.stringify(o.t || {}));
  ['couleur', 'accent', 'fond', 'barre', 'tuile', 'police', 'policeTitres', 'forme', 'ombre'].forEach(function (k) { if (m[k] === '' ) delete t[k]; else t[k] = m[k]; }); if (m.mode === 'sombre') t.mode = 'sombre'; else delete t.mode; t.modele = m.id;
  themeSaveCopy({ t: t, version: o.version, publieLe: o.publieLe, pending: true, err: null }); themeApply(); render(); clearTimeout(TH_PUB.timer); TH_PUB.timer = setTimeout(thPublish, 800);
}
function thRefresh() { var p = document.getElementById('apPrev'); if (p) p.innerHTML = vApPreview(); var st = document.getElementById('apStatus'); if (st) st.innerHTML = thStatus(); var br = document.querySelector('.shell .brand'); if (br) { var im = br.querySelector('img'); if (im) im.src = CLIENT.logoClient || themeLogo('square'); var sp = br.querySelector('.name span'); if (sp) sp.textContent = themeGet().nom; } }
function thPublish() {
  if (TH_PUB.busy) { clearTimeout(TH_PUB.timer); TH_PUB.timer = setTimeout(thPublish, 800); return; }
  var o = themeCopy(); if (!o.pending) return;
  TH_PUB.busy = true; thRefresh();
  var url = '/repos/' + DEMO_CAT_REPO + '/contents/theme.json', snap = JSON.stringify(o.t || {});
  ghFetch(url, {}, getToken()).then(function (j) { return { sha: j.sha, json: JSON.parse(b64utf8(j.content)) }; }, function (e) { if (e.status === 404) return { sha: null, json: null }; throw e; })
    .then(function (r) {
      var v = Math.max(r.json && +r.json.version || 0, o.version || 0) + 1, file = themeFile(o.t || {}, v), body = { message: 'Apparence v' + v + ' (Admin)', content: utf8b64(JSON.stringify(file, null, 1)) };
      if (r.sha) body.sha = r.sha;
      return ghFetch(url, { method: 'PUT', body: JSON.stringify(body) }, getToken()).then(function () { return file; });
    })
    .then(function (file) {
      TH_PUB.busy = false; var n = themeCopy(), again = JSON.stringify(n.t || {}) !== snap;
      themeSaveCopy({ t: n.t, version: file.version, publieLe: file.majLe, pending: again, err: null }); thRefresh(); if (again) thPublish();
    }, function (e) { TH_PUB.busy = false; var n = themeCopy(); n.err = e && e.status === 0 ? 'Pas de réseau' : 'Erreur ' + (e && e.status || ''); themeSaveCopy(n); thRefresh(); });
}
function thSync() {
  var o = themeCopy(); if (o.pending) { thPublish(); return; }
  ghFetch('/repos/' + DEMO_CAT_REPO + '/contents/theme.json', {}, getToken()).then(function (j) {
    var f = JSON.parse(b64utf8(j.content)), cur = themeCopy();
    if (f.format === THEME_FMT && !cur.pending && +f.version > (cur.version || 0)) { themeSaveCopy({ t: f.apparence || {}, version: +f.version, publieLe: f.majLe }); themeApply(); render(); }
  }, function () {});
}
window.addEventListener('online', function () { if (themeCopy().pending) thPublish(); });
setTimeout(thSync, 350);
function thStatus() {
  var o = themeCopy();
  if (TH_PUB.busy) return '<span class="faint">Publication…</span>';
  if (o.pending) return '<span class="warnt">Pas encore publié' + (o.err ? ' (' + esc(o.err) + ')' : '') + '</span> <button class="btn sm" data-p="thPub">Publier maintenant</button>';
  if (o.version) return '<span class="okt">Publié pour les caisses · version ' + o.version + (o.publieLe ? ' du ' + new Date(o.publieLe).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '</span>';
  return '<span class="faint">Apparence par défaut (rien de publié)</span>';
}
function vApPreview(part) {
  part = part || (SUB.parametres === 'ticket' ? 'ticket' : 'app');
  var t = themeGet(), tk = t.ticket;
  if (part === 'app') {
    var F = TH_FONTS[t.police].css, FT = TH_FONTS[t.policeTitres].css, rad = t.forme === 'carre' ? '3px' : t.forme === 'pastille' ? '999px' : '10px', trad = t.forme === 'carre' ? '3px' : t.forme === 'pastille' ? '20px' : '12px';
    var dk = t.mode === 'sombre', sh = t.ombre ? 'box-shadow:0 4px 14px rgba(0,0,0,.12);' : '', bar = t.barre || (dk ? '#131A22' : '#ffffff'), fond = dk ? (t.sombre.fond || '#0B0F14') : (t.fond || '#F5F7FA'), tuile = dk ? thMix(fond, '#ffffff', .06) : (t.tuile || '#ffffff');
    var cats = (thCatList()[0] || { id: '', nom: 'Boissons', produits: [{ id: '', libelle: 'Article', prix: 2.5 }] }), cc = themeCatStyle(cats.id) || t.couleur, pr = (cats.produits || [])[0] || { libelle: 'Article', prix: 2.5 }, ph = pr.id ? thPhotoGet(pr.id) : '';
    return '<div class="apapp" style="font-family:' + F + ';background:' + fond + (t.fondImage ? ';background-image:linear-gradient(rgba(255,255,255,' + t.voile / 100 + '),rgba(255,255,255,' + t.voile / 100 + ')),url(' + t.fondImage + ');background-size:cover' : '') + '">' +
      '<div class="apbar" style="background:' + bar + ';border-color:' + t.couleur + '"><img src="' + themeLogo('text') + '" alt=""></div>' +
      '<div class="apbtns"><span class="apb" style="background:' + cc + ';color:' + thInk(cc) + ';border-radius:' + rad + ';font-family:' + FT + '">' + esc(themeCatEmoji(cats.id) + cats.nom) + '</span><span class="apb ghost" style="border-color:' + t.couleur + ';color:' + t.couleur + ';border-radius:' + rad + '">Historique</span></div>' +
      '<div class="aptile" style="color:' + thInk(tuile) + ';background:' + tuile + ';border-radius:' + trad + ';' + sh + 'border-top:5px solid ' + cc + '">' + (ph ? '<img src="' + ph + '" alt="">' : '') + '<b style="font-family:' + FT + '">' + esc(pr.libelle) + '</b><span style="color:' + t.couleur + '">' + (Number(pr.prix) || 0).toFixed(2).replace('.', ',') + ' €</span></div>' +
      '<span class="apb" style="display:block;text-align:center;background:' + t.couleur + ';color:' + thInk(t.couleur) + ';border-radius:' + rad + ';margin-top:12px;font-family:' + FT + '">Encaisser</span></div>';
  }
  var W = tk.papier === '58' ? 32 : 48, sep = Array(W + 1).join(tk.separateur), al = tk.entete === 'gauche' ? 'left' : 'center', AF = tk.afficher, lw = { petit: 45, moyen: 66, grand: 88 }[tk.logoTaille];
  function row(a, b, cls) { return '<div class="aptk-row' + (cls ? ' ' + cls : '') + '"><span>' + esc(a) + '</span><span>' + esc(b) + '</span></div>'; }
  var lines = [tk.activite].concat(tk.adresse, [tk.telephone, tk.email, tk.tva ? 'TVA ' + tk.tva : '', tk.site]).filter(Boolean);
  return '<div class="aptk" style="max-width:' + (W === 32 ? 220 : 310) + 'px">' +
    '<div style="text-align:' + al + '">' + (tk.logoTaille !== 'aucun' ? '<img src="' + themeLogo('ticket') + '" alt="" style="width:' + lw + '%;filter:grayscale(1) contrast(1.6)">' : '') +
    (tk.logoTaille === 'aucun' || tk.nomGrand ? '<div class="aptk-big">' + esc(t.nom) + '</div>' : '') + lines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') +
    (tk.messageEntete ? '<div style="margin-top:6px"><b>' + esc(tk.messageEntete) + '</b></div>' : '') + '</div><br>' +
    (AF.numero || AF.date ? row(AF.numero ? 'Ticket n° 0042' : '', AF.date ? new Date().toLocaleDateString('fr-BE') + ' 14:32' : '') : '') + (AF.pdv ? '<div style="text-align:left">Point de vente : Stand</div>' : '') +
    '<div class="aptk-sep">' + Array(W + 1).join('=') + '</div>' + row('Article A', '5,00') + row('2 x Article B', '7,00') + '<div class="aptk-sep">' + sep + '</div>' +
    row('TOTAL', '12,00 EUR', 'aptk-tot') + (tk.tauxTVA > 0 ? row('dont TVA ' + String(tk.tauxTVA).replace('.', ',') + ' %', (12 - 12 / (1 + tk.tauxTVA / 100)).toFixed(2).replace('.', ',')) : '') + (AF.nbArticles ? '<div style="text-align:left">3 articles</div>' : '') +
    '<div class="aptk-sep">' + sep + '</div>' + (AF.paiement ? row('Cash', '12,00') : '') + (AF.rendu ? row('Reçu', '20,00') + row('Rendu', '8,00') : '') + '<br>' +
    (themeSaisonActive(tk) || (tk.saison && SUB.parametres === 'ticket') ? '<div><b>' + esc(tk.saison) + '</b>' + (themeSaisonActive(tk) ? '' : ' <span class="faint">(hors période)</span>') + '</div>' : '') +
    (tk.merci ? '<div><b>' + esc(tk.merci) + '</b></div>' : '') + (tk.qr ? '<div><span class="aptk-qr">QR</span></div>' + (tk.qrTexte ? '<div>' + esc(tk.qrTexte) + '</div>' : '') : '') +
    (tk.mention ? '<div class="faint">' + esc(tk.mention) + '</div>' : '') + '</div>';
}
/* Catégories et articles du catalogue publié (couleurs, emojis, photos) */
function thCatList() {
  try { var cj = JSON.parse((demoDb()[DEMO_CAT_REPO] || {})['catalogue.json'].text); if (cj && cj.categories) return cj.categories.filter(function (k) { return k.actif !== false; }); } catch (e) {}
  return (typeof CAT !== 'undefined' && CAT && CAT.repo === DEMO_CAT_REPO && CAT.data && CAT.data.categories) ? CAT.data.categories : (TH_CATS || []);
}
var TH_CATS = null;
function thLoadCats() { if (CLIENT.donnees !== 'github' || TH_CATS) return; TH_CATS = []; ghGetCatalogue(DEMO_CAT_REPO, getToken()).then(function (r) { TH_CATS = r.json && r.json.categories ? r.json.categories : []; if (MOD === 'parametres') render(); }, function () {}); }
var TH_EMO = null, TH_EMOJIS = [
  ['Boissons', '☕ 🍵 🧃 🥤 🧋 🍺 🍻 🍷 🥂 🍾 🍸 🍹 🥃 🧉 💧 🥛'],
  ['Nourriture', '🍔 🍟 🌭 🍕 🥪 🌮 🥙 🥗 🍝 🍜 🍲 🍛 🍗 🍖 🥩 🧀 🥚 🥐 🥖 🍞 🥨 🧇 🥞 🍳'],
  ['Sucré et fruits', '🍦 🍨 🍧 🍰 🎂 🧁 🍩 🍪 🍫 🍬 🍭 🍮 🍯 🍓 🍎 🍐 🍊 🍋 🍌 🍇 🍉 🍒 🥝 🍍'],
  ['Fêtes et événements', '🎄 🎅 🤶 🎁 🎉 🎊 🎈 🎃 👻 🕯️ ⭐ ❄️ ☃️ 🔥 🎟️ 🎫 🎶 🎵 🎤 🎸 🏆 🥇'],
  ['Boutique', '👕 👚 👗 👖 🧥 🧣 🧤 👟 🧢 👜 🎒 🧸 🪀 📚 ✏️ 🖼️ 🧴 🧼 🕶️ ⌚ 💍'],
  ['Nature et jardin', '🌲 🎋 🌳 🌴 🪴 🌵 💐 🌹 🌷 🌻 🌼 🍀 🍁 🍄 🪵 🌿'],
  ['Services', '🚚 📦 🛒 🛠️ 🔧 🧹 ✂️ 💇 🚗 🅿️ 🏷️ 💳 🧾 📅 ⏰ ♻️ ℹ️'],
  ['Symboles', '✅ ⭐ ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🟢 🔴 🟡 🔵 🟣 ⚫ 🔶 🔷 ➕ 💯']
];
function vEmoGrid(cid, cur) {
  return '<div class="apemogrid">' + TH_EMOJIS.map(function (g) { return '<div class="apemog"><small>' + esc(g[0]) + '</small><div>' + g[1].split(' ').map(function (e) { return '<button class="' + (e === cur ? 'on' : '') + '" data-p="emoPick" data-cat="' + esc(cid) + '" data-v="' + e + '">' + e + '</button>'; }).join('') + '</div></div>'; }).join('') +
    '<div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" data-p="emoPick" data-cat="' + esc(cid) + '" data-v="">Aucune icône</button><button class="btn sm" data-p="emoOpen" data-v="">Fermer</button></div></div>';
}
function vApparence(part) {
  var t = themeGet(), d = themeCopy().t || {}, tk = (d.ticket || {}), ad = tk.adresse || [], TT = t.ticket;
  function fld(lab, path, val, ph, type, extra) { return '<label class="fl">' + lab + '</label><input type="' + (type || 'text') + '" data-ap="' + path + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '"' + (extra || '') + '>'; }
  function sel(lab, path, val, opts) { return '<label class="fl">' + lab + '</label><select data-ap="' + path + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function chk(lab, path, on) { return '<label class="tog"><input type="checkbox" data-ap="' + path + '"' + (on ? ' checked' : '') + '>' + esc(lab) + '</label>'; }
  function clr(lab, path, val, def) { return '<div><label class="fl">' + lab + '</label><div class="aprow" style="gap:6px;flex-wrap:nowrap"><input type="color" data-ap="' + path + '" value="' + (val || def) + '">' + (val ? '<button class="btn sm" data-p="thClr" data-v="' + path + '" title="Revenir à l’automatique">auto</button>' : '<span class="faint">auto</span>') + '</div></div>'; }
  function img(lab, id, has, del, hint) { return '<label class="fl">' + lab + '</label><div class="aprow"><input type="file" id="' + id + '" accept="image/*">' + (has ? '<button class="btn sm danger" data-p="' + del + '">Retirer</button>' : '') + '</div>' + (hint ? '<p class="hint">' + hint + '</p>' : ''); }
  function h(x) { return '<h4 class="aph">' + x + '</h4>'; }
  var fonts = Object.keys(TH_FONTS).map(function (k) { return [k, TH_FONTS[k].nom]; }), form;
  if (part === 'ticket') {
    form = h('Logo et en-tête') + img('Logo du ticket', 'apLogoTk', !!TT.logo, 'thLogoTkDel', 'Sans logo propre : celui de l’app, imprimé en noir et blanc. Préférez un logo noir sur fond blanc, bien contrasté.') +
      '<div class="aprow"><div>' + sel('Taille du logo', 'ticket.logoTaille', TT.logoTaille, [['aucun', 'Pas de logo'], ['petit', 'Petit'], ['moyen', 'Moyen'], ['grand', 'Grand']]) + '</div><div>' + sel('En-tête', 'ticket.entete', TT.entete, [['centre', 'Centré'], ['gauche', 'À gauche']]) + '</div></div>' +
      chk('Nom du commerce en grand sous le logo', 'ticket.nomGrand', TT.nomGrand) +
      h('Coordonnées') + fld('Activité (sous le logo)', 'ticket.activite', tk.activite, 'Ex. Boulangerie, Food truck…') +
      fld('Adresse, ligne 1', 'ticket.adr1', ad[0], 'Rue…') + fld('Adresse, ligne 2', 'ticket.adr2', ad[1], 'Code postal et commune') +
      '<div class="aprow"><div>' + fld('Téléphone', 'ticket.telephone', tk.telephone) + '</div><div>' + fld('E-mail', 'ticket.email', tk.email) + '</div></div>' +
      '<div class="aprow"><div>' + fld('N° de TVA', 'ticket.tva', tk.tva, 'BE 0000.000.000') + '</div><div>' + fld('Site', 'ticket.site', tk.site) + '</div></div>' +
      h('Contenu') + '<div class="apchk">' + chk('N° de ticket', 'ticket.afficher.numero', TT.afficher.numero) + chk('Date et heure', 'ticket.afficher.date', TT.afficher.date) + chk('Point de vente', 'ticket.afficher.pdv', TT.afficher.pdv) +
      chk('Nombre d’articles', 'ticket.afficher.nbArticles', TT.afficher.nbArticles) + chk('Mode de paiement', 'ticket.afficher.paiement', TT.afficher.paiement) + chk('Montant reçu et rendu', 'ticket.afficher.rendu', TT.afficher.rendu) + '</div>' +
      '<div class="aprow"><div>' + fld('TVA incluse (%)', 'ticket.tauxTVA', tk.tauxTVA || '', '0 = ne pas afficher', 'number', ' min="0" max="30" step="0.5"') + '</div><div>' + sel('Séparateurs', 'ticket.separateur', TT.separateur, [['-', '- - - tirets'], ['.', '. . . points'], ['=', '= = = doubles'], ['*', '* * * étoiles'], ['~', '~ ~ ~ vagues']]) + '</div></div>' +
      h('Messages') + fld('Message d’en-tête', 'ticket.messageEntete', tk.messageEntete, 'Ex. Bienvenue chez nous !') +
      fld('Message de fin', 'ticket.merci', tk.merci != null ? tk.merci : THEME_DEF.ticket.merci) +
      fld('Message saisonnier', 'ticket.saison', tk.saison, 'Ex. Joyeuses fêtes !') +
      '<div class="aprow"><div>' + fld('Du (JJ/MM)', 'ticket.saisonDu', tk.saisonDu, '01/12') + '</div><div>' + fld('Au (JJ/MM)', 'ticket.saisonAu', tk.saisonAu, '31/12') + '</div></div>' +
      fld('Mention', 'ticket.mention', tk.mention != null ? tk.mention : THEME_DEF.ticket.mention) +
      h('QR code') + fld('Lien du QR code', 'ticket.qr', tk.qr, 'Ex. https://g.page/r/… (avis Google), site, Facebook') + fld('Texte sous le QR code', 'ticket.qrTexte', tk.qrTexte, 'Ex. Donnez-nous votre avis !') +
      h('Imprimante') + sel('Largeur du papier', 'ticket.papier', TT.papier, [['80', '80 mm (48 caractères)'], ['58', '58 mm (32 caractères)']]) +
      '<p class="hint">Le QR code est dessiné par l’imprimante (aperçu : un carré « QR »). Le logo et la largeur sont repris par la caisse à sa prochaine relecture de l’apparence.</p>';
  } else {
    var cats = thCatList(), ctr = [];
    if (t.fond && thContrast(t.fond, '#1C2219') < 4.5) ctr.push('le fond est trop foncé pour le texte');
    if (thContrast(t.couleur, '#ffffff') < 3 && thContrast(t.couleur, '#111111') < 3) ctr.push('la couleur principale contraste peu');
    if (t.tuile && t.fond && thContrast(t.tuile, t.fond) < 1.05) ctr.push('tuiles et fond presque identiques');
    form = h('Modèles') + '<div class="apmods">' + TH_MODELES.map(function (m) {
        return '<button class="apmod' + (t.modele === m.id ? ' on' : '') + '" data-p="thModele" data-v="' + m.id + '" style="font-family:' + TH_FONTS[m.policeTitres].css + '"><span class="sw" style="background:' + (m.barre === '#FFFFFF' ? m.couleur : m.barre) + '"></span><span class="sw" style="background:' + m.couleur + '"></span><span class="sw" style="background:' + m.accent + '"></span><b>' + esc(m.nom) + '</b></button>'; }).join('') + '</div><p class="hint">Un modèle règle couleurs, polices et formes ; logo, nom, ticket, catégories et photos sont gardés.</p>' +
      h('Style') + '<div class="apmode">' + [['clair', '☀︎ Clair', 'Fond clair, texte foncé'], ['sombre', '☾ Sombre', 'Fond sombre, texte clair']].map(function (m) { return '<button class="apmod' + (t.mode === m[0] ? ' on' : '') + '" data-p="thMode" data-v="' + m[0] + '"><b>' + m[1] + '</b><small>' + m[2] + '</small></button>'; }).join('') + '</div><p class="hint">S’applique à l’Admin et à la Caisse de tous les appareils (la Caisse Soirée reste sombre).</p>' +
      h('Identité') + fld('Nom du commerce', 'nom', d.nom, 'Caisse') + img('Logo', 'apLogo', !!t.logo, 'thLogoDel', 'Sans logo : une icône et le nom du commerce. Image redimensionnée sur l’appareil (800 × 300 au plus).') +
      h('Icône de l’onglet de la caisse') + '<div class="apmode" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">' + [['defaut', 'Par défaut', '../' + RACINE.replace(/^\.\.\//, '') + 'core/icons/caisse-192.png'], ['logo', 'Logo de l’app', t.logo || themeLogo('square')]].concat(CLIENT.logoClient ? [['client', 'Logo du client', CLIENT.logoClient]] : []).concat([['image', 'Image au choix', t.ongletImage]]).map(function (o) {
        return '<button class="apmod apong' + (t.onglet === o[0] ? ' on' : '') + '" data-p="thOnglet" data-v="' + o[0] + '">' + (o[2] ? '<img src="' + o[2] + '" alt="">' : '<span class="apph0" style="width:32px;height:32px;font-size:18px">+</span>') + '<b>' + esc(o[1]) + '</b></button>'; }).join('') + '</div>' +
      (t.onglet === 'image' ? img('Image de l’onglet (carrée de préférence)', 'apOnglet', !!t.ongletImage, 'thOngletDel', '') : '') +
      '<p class="hint">Petite image affichée dans l’onglet du navigateur et dans la liste des onglets de la tablette (aussi pour la Caisse Soirée). L’Admin affiche le logo du client, réglé dans le SuperAdmin.</p>' +
      h('Couleurs') + '<div class="aprow">' + clr('Principale', 'couleur', d.couleur, t.couleur) + clr('Accent', 'accent', d.accent, t.accent) + clr('Fond', 'fond', t.fond, '#F5F7FA') + clr('Barre du haut', 'barre', t.barre, '#FFFFFF') + clr('Tuiles', 'tuile', t.tuile, '#FFFFFF') + '</div>' +
      (ctr.length ? '<p class="hint warnt">Lisibilité : ' + ctr.join(' ; ') + '.</p>' : '<p class="hint okt">Contrastes lisibles.</p>') +
      h('Polices') + '<div class="aprow"><div>' + sel('Titres', 'policeTitres', t.policeTitres, fonts) + '</div><div>' + sel('Texte', 'police', t.police, fonts) + '</div></div><p class="hint">Polices de l’appareil (aucun téléchargement, fonctionne hors ligne) : le rendu peut varier un peu d’une tablette à l’autre.</p>' +
      h('Formes') + '<div class="aprow"><div>' + sel('Boutons et tuiles', 'forme', t.forme, [['arrondi', 'Arrondis'], ['carre', 'Carrés'], ['pastille', 'Pastilles']]) + '</div><div>' + sel('Densité', 'densite', t.densite, [['normale', 'Normale'], ['compacte', 'Compacte']]) + '</div></div>' + chk('Ombres sous les tuiles et cartes', 'ombre', t.ombre) +
      h('Fond d’écran') + img('Image (accueil de la caisse, bandeau de l’Admin)', 'apFond', !!t.fondImage, 'thFondDel', '') + (t.fondImage ? '<label class="fl">Voile pour la lisibilité : ' + t.voile + ' %</label><input type="range" min="0" max="85" step="5" data-ap="voile" value="' + t.voile + '">' : '') +
      (t.mode === 'sombre' ? h('Couleurs du thème sombre') + '<div class="aprow">' + clr('Couleur principale', 'sombre.couleur', t.sombre.couleur, thMix(t.couleur, '#ffffff', .45)) + clr('Fond', 'sombre.fond', t.sombre.fond, '#0B0F14') + '</div>' : '') +
      h('Catégories') + (cats.length ? '<p class="hint">Couleur (onglet et liseré des tuiles) et icône affichée devant le nom de la catégorie sur la caisse.</p><div class="apcats">' + cats.map(function (k) { var c = t.categories[k.id] || {};
        return '<div class="apcat"><input type="color" data-ap="categories.' + esc(k.id) + '.couleur" value="' + (c.couleur || t.couleur) + '">' + '<button class="apemo' + (c.emoji ? '' : ' vide') + '" data-p="emoOpen" data-v="' + esc(k.id) + '" title="Icône de la catégorie">' + (c.emoji ? esc(c.emoji) : 'Icône') + '</button><span>' + esc(k.nom) + '</span>' + (c.couleur ? '<button class="btn sm" data-p="thClr" data-v="categories.' + esc(k.id) + '.couleur">auto</button>' : '') + '</div>' + (TH_EMO === k.id ? vEmoGrid(k.id, c.emoji) : ''); }).join('') + '</div>' : '<p class="hint">Publiez d’abord un catalogue.</p>') +
      h('Photos des articles') + (cats.length ? '<div class="apphotos">' + cats.map(function (k) { return (k.produits || []).filter(function (p) { return p.actif !== false && !/^(frais-de-)?livraison$/i.test(slug(p.libelle || '')); }).map(function (p) { var ph = thPhotoGet(p.id);
        return '<div class="apph">' + (ph ? '<img src="' + ph + '" alt="">' : '<span class="apph0">+</span>') + '<small>' + esc(p.libelle) + '</small><label class="btn sm">' + (ph ? 'Changer' : 'Photo') + '<input type="file" accept="image/*" data-photo="' + esc(p.id) + '" hidden></label>' + (ph ? '<button class="btn sm danger" data-p="thPhotoDel" data-v="' + esc(p.id) + '">Retirer</button>' : '') + '</div>'; }).join(''); }).join('') + '</div><p class="hint" id="phStatus">' + phStatus() + '</p>' : '<p class="hint">Publiez d’abord un catalogue.</p>');
  }
  if (part !== 'ticket') thLoadCats();
  return '<section><h3>' + (part === 'ticket' ? 'Apparence du ticket' : 'Apparence de l’app') + '</h3><p class="lead">' + (part === 'ticket' ? 'Logo, coordonnées, contenu et messages du ticket de caisse.' : 'Nom, couleurs, polices, formes, fond, catégories et photos de l’Admin, de la Caisse et de la Caisse Soirée.') + ' Publié dans <span class="mono">theme.json</span>, à côté du catalogue.</p>' +
    '<p class="hint" id="apStatus">' + thStatus() + '</p>' +
    '<div class="apgrid"><div class="apform">' + form + '</div><div class="apprev"><div class="fl">Aperçu</div><div id="apPrev">' + vApPreview(part) + '</div></div></div></section>';
}
document.addEventListener('input', function (e) { var el = e.target; if (el && el.hasAttribute && el.hasAttribute('data-ap')) { var v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? (el.value === '' ? '' : +el.value) : el.value; thSet(el.getAttribute('data-ap'), v); if (el.type === 'range' && el.previousElementSibling) el.previousElementSibling.textContent = 'Voile pour la lisibilité : ' + el.value + ' %'; } });
/* Images : redimensionnées sur l'appareil */
function thImage(file, maxW, maxH, cover, done) {
  var fr = new FileReader(); fr.onload = function () {
    var im = new Image(); im.onload = function () {
      var cv = document.createElement('canvas'), cx = cv.getContext('2d');
      if (cover) { cv.width = maxW; cv.height = maxH; var r = Math.max(maxW / im.width, maxH / im.height), w = im.width * r, h = im.height * r; cx.fillStyle = '#fff'; cx.fillRect(0, 0, maxW, maxH); cx.drawImage(im, (maxW - w) / 2, (maxH - h) / 2, w, h); done(cv.toDataURL('image/jpeg', 0.72)); return; }
      var r2 = Math.min(1, maxW / im.width, maxH / im.height); cv.width = Math.round(im.width * r2); cv.height = Math.round(im.height * r2); cx.drawImage(im, 0, 0, cv.width, cv.height);
      var url = cv.toDataURL('image/png'); if (url.length > 250000) { cx.globalCompositeOperation = 'destination-over'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); url = cv.toDataURL('image/jpeg', 0.8); } done(url);
    }; im.onerror = function () { toast('Image illisible'); }; im.src = fr.result;
  }; fr.readAsDataURL(file);
}
document.addEventListener('change', function (e) {
  var el = e.target; if (!el || !el.files || !el.files[0]) return;
  if (el.id === 'apLogo') thImage(el.files[0], 800, 300, false, function (u) { thSet('logo', u); render(); });
  else if (el.id === 'apLogoTk') thImage(el.files[0], 800, 300, false, function (u) { thSet('ticket.logo', u); render(); });
  else if (el.id === 'apOnglet') thImage(el.files[0], 128, 128, false, function (u) { thSet('ongletImage', u); render(); });
  else if (el.id === 'apFond') thImage(el.files[0], 1600, 1000, false, function (u) { thSet('fondImage', u); render(); });
  else if (el.hasAttribute('data-photo')) { var pid = el.getAttribute('data-photo'); thImage(el.files[0], 240, 240, true, function (u) { thPhotoSet(pid, u); render(); }); }
});
/* Photos : photos.json publié à part, puis photosVersion dans theme.json (les caisses ne relisent les photos que si elle change) */
var PH_PUB = { busy: false, timer: null };
function thPhotoGet(pid) { return ((photosCopy().photos) || {})[pid] || ''; }
function thPhotoSet(pid, url) { var o = photosCopy(), ph = Object.assign({}, o.photos || {}); if (url) ph[pid] = url; else delete ph[pid]; photosSaveCopy({ photos: ph, version: o.version || 0, pending: true }); clearTimeout(PH_PUB.timer); PH_PUB.timer = setTimeout(phPublish, 800); }
function phStatus() { var o = photosCopy(), n = Object.keys(o.photos || {}).length; return n + ' photo' + (n > 1 ? 's' : '') + ' · ' + (PH_PUB.busy ? 'publication…' : o.pending ? '<span class="warnt">pas encore publiées</span> <button class="btn sm" data-p="phPub">Publier</button>' : o.version ? '<span class="okt">publiées (version ' + o.version + ')</span>' : 'aucune publiée'); }
function phPublish() {
  var o = photosCopy(); if (!o.pending || PH_PUB.busy) return; PH_PUB.busy = true; var st = document.getElementById('phStatus'); if (st) st.innerHTML = phStatus();
  var url = '/repos/' + DEMO_CAT_REPO + '/contents/photos.json', snap = JSON.stringify(o.photos || {});
  ghFetch(url, {}, getToken()).then(function (j) { return { sha: j.sha, v: (JSON.parse(b64utf8(j.content)) || {}).version || 0 }; }, function (e) { if (e.status === 404) return { sha: null, v: 0 }; throw e; })
    .then(function (r) { var v = Math.max(r.v, o.version || 0) + 1, body = { message: 'Photos des articles v' + v + ' (Admin)', content: utf8b64(JSON.stringify({ format: 'caisse/photos', formatVersion: 1, version: v, photos: o.photos || {} })) }; if (r.sha) body.sha = r.sha;
      return ghFetch(url, { method: 'PUT', body: JSON.stringify(body) }, getToken()).then(function () { return v; }); })
    .then(function (v) { PH_PUB.busy = false; var n = photosCopy(), again = JSON.stringify(n.photos || {}) !== snap; photosSaveCopy({ photos: n.photos, version: v, pending: again }); thSet('photosVersion', v); if (again) phPublish(); else if (MOD === 'parametres') { var s2 = document.getElementById('phStatus'); if (s2) s2.innerHTML = phStatus(); } },
      function () { PH_PUB.busy = false; var s3 = document.getElementById('phStatus'); if (s3) s3.innerHTML = phStatus(); });
}
function featCount() { var n = 0, on = 0; FEATURES.forEach(function (g) { g.items.forEach(function (it) { n++; if (FEAT(it.id)) on++; }); }); return on + ' fonctionnalités actives sur ' + n; }
/* Paramètres › Fonctionnalités : une carte par groupe, un interrupteur par fonctionnalité */
function vFeatures() {
  var cfg = featCfg(), prods = [];
  try { var cj = JSON.parse((demoDb()[DEMO_CAT_REPO] || {})['catalogue.json'].text); (cj.categories || []).forEach(function (k) { (k.produits || []).forEach(function (p) { if (k.actif !== false && p.actif !== false) prods.push({ id: p.id, t: k.nom + ' · ' + p.libelle }); }); }); } catch (e) {}
  return '<section><h3>Fonctionnalités</h3><p class="lead">Choisissez ce que la caisse et l’Admin proposent. Chaque changement est <strong>publié</strong> dans le fichier de réglage <span class="mono">config.json</span>, à côté du catalogue : toutes les caisses le lisent à l’ouverture, toutes les 30 secondes, au retour sur l’app et via ⋮ › Vérifier le catalogue. Une option grisée dépend d’une autre, qui est coupée.</p>' +
    '<p class="hint">' + featPubStatus() + '</p><p class="hint">' + featCount() + ' · <button class="btn sm" data-p="featAll">Tout activer</button> <button class="btn sm" data-p="featDefault">Réglages par défaut</button></p>' +
    '<div class="featgrid">' + FEATURES.map(function (g) {
      return '<div class="featg"><h4>' + esc(g.nom) + '</h4>' + g.items.filter(function (it) { return !(it.id === 'soiree' && CLIENT.type === 'simple'); }).map(function (it) {
        var own = featOwn(it.id), dep = it.req && !FEAT(it.req), eff = FEAT(it.id);
        var extra = it.id === 'raccourci' && own ? '<select id="featRac" class="featsel"><option value="">— choisir l’article —</option>' + prods.map(function (p) { return '<option value="' + esc(p.id) + '"' + (cfg.raccourciId === p.id ? ' selected' : '') + '>' + esc(p.t) + '</option>'; }).join('') + '</select>' + (prods.length ? '' : '<span class="faint"> (publiez d’abord un catalogue)</span>') : '';
        return '<label class="featit' + (dep ? ' dep' : '') + '"><input type="checkbox" data-p="feat" data-v="' + it.id + '"' + (own ? ' checked' : '') + (dep ? ' disabled' : '') + '><span><b>' + esc(it.nom) + '</b>' +
          (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + (dep ? '<small class="warnt">Nécessite « ' + esc(FEAT_DEF[it.req].nom) + ' »</small>' : own && !eff && it.id === 'raccourci' ? '<small class="warnt">Choisissez l’article.</small>' : '') + '</span></label>' + (extra ? '<div style="padding:0 0 8px 30px">' + extra + '</div>' : '');
      }).join('') + '</div>';
    }).join('') + '</div></section>';
}
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'featRac') { var c = featCfg(); c.raccourciId = e.target.value; featChanged(c); }
});
/* Publication du réglage : config.json dans le dépôt de la caisse (à côté de catalogue.json), version + 1, avec le sha.
   Le réglage reste sur l'appareil (pending) tant que la publication n'a pas réussi. */
var FEAT_PUB = { busy: false, timer: null };
function featChanged(c) { c.pending = true; c.err = null; featSave(c); render(); clearTimeout(FEAT_PUB.timer); FEAT_PUB.timer = setTimeout(featPublish, 600); }
function featPublish() {
  if (FEAT_PUB.busy) { clearTimeout(FEAT_PUB.timer); FEAT_PUB.timer = setTimeout(featPublish, 800); return; }
  var c = featCfg(); if (!c.pending) return;
  FEAT_PUB.busy = true; render();
  var url = '/repos/' + DEMO_CAT_REPO + '/contents/config.json', snap = JSON.stringify(c.f) + '|' + (c.raccourciId || '');
  ghFetch(url, {}, getToken()).then(function (j) { return { sha: j.sha, json: JSON.parse(b64utf8(j.content)) }; }, function (e) { if (e.status === 404) return { sha: null, json: null }; throw e; })
    .then(function (r) {
      var v = Math.max(r.json && +r.json.version || 0, c.version || 0) + 1, file = featFile(c, v), body = { message: 'Réglage des fonctionnalités v' + v + ' (Admin)', content: utf8b64(JSON.stringify(file, null, 1)) };
      if (r.sha) body.sha = r.sha;
      return ghFetch(url, { method: 'PUT', body: JSON.stringify(body) }, getToken()).then(function () { return file; });
    })
    .then(function (file) {
      FEAT_PUB.busy = false; var n = featCfg(); n.version = file.version; n.publieLe = file.majLe; n.err = null;
      if (JSON.stringify(n.f) + '|' + (n.raccourciId || '') === snap) n.pending = false; else featPublish.again = true; // modifié pendant l'envoi
      featSave(n); render(); if (featPublish.again) { featPublish.again = false; featPublish(); }
    }, function (e) { FEAT_PUB.busy = false; var n = featCfg(); n.err = e && e.status === 0 ? 'Pas de réseau' : 'Erreur ' + (e && e.status || ''); featSave(n); render(); });
}
/* Au démarrage : reprendre un réglage publié depuis un autre appareil (plus récent), ou finir une publication en attente */
function featSync() {
  var c = featCfg(); if (c.pending) { featPublish(); return; }
  ghFetch('/repos/' + DEMO_CAT_REPO + '/contents/config.json', {}, getToken()).then(function (j) {
    var f = JSON.parse(b64utf8(j.content)), cur = featCfg();
    if (f.format === CONFIG_FMT && !cur.pending && +f.version > (cur.version || 0)) { featSave({ f: f.fonctionnalites || {}, raccourciId: f.raccourciId || '', remiseCodeSha: f.remiseCodeSha || '', remiseCodeLe: f.remiseCodeLe || '', version: +f.version, publieLe: f.majLe }); render(); }
  }, function () {});
}
window.addEventListener('online', function () { if (featCfg().pending) featPublish(); });
setTimeout(featSync, 300);
function featPubStatus() {
  var c = featCfg();
  if (FEAT_PUB.busy) return '<span class="faint">Publication…</span>';
  if (c.pending) return '<span class="warnt">Pas encore publié' + (c.err ? ' (' + esc(c.err) + ')' : '') + '</span> <button class="btn sm" data-p="featPub">Publier maintenant</button>';
  if (c.version) return '<span class="okt">Publié pour les caisses · version ' + c.version + (c.publieLe ? ' du ' + new Date(c.publieLe).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '</span>';
  return '<span class="faint">Réglages par défaut (rien de publié)</span>';
}
function vRemiseCode() {
  var c = featCfg(), perso = !!c.remiseCodeSha;
  return '<section><h3>Code de remise</h3><p class="lead">Code à 4 chiffres demandé sur la caisse pour accorder une remise sur le ticket (menu ⋮ › Remise ticket). Seule son empreinte est publiée, jamais le code lui-même.</p>' +
    '<p class="hint">' + (perso ? '<span class="okt">Code personnalisé' + (c.remiseCodeLe ? ', changé le ' + new Date(c.remiseCodeLe).toLocaleDateString('fr-BE') : '') + '</span>' : '<span class="warnt">Code par défaut (1234) : changez-le avant d’utiliser la caisse.</span>') +
    (FEAT('codePatron') ? '' : ' · la fonctionnalité « Remise ticket sécurisée » est coupée (Paramètres › Fonctionnalités).') + '</p>' +
    '<div class="aprow"><div><label class="fl">Nouveau code</label><input type="password" inputmode="numeric" maxlength="4" autocomplete="off" id="rc1" placeholder="4 chiffres"></div><div><label class="fl">Retaper le code</label><input type="password" inputmode="numeric" maxlength="4" autocomplete="off" id="rc2"></div></div>' +
    '<div class="cbtns" style="margin-top:12px"><button class="btn" data-p="rcSave">Enregistrer le code</button>' + (perso ? '<button class="btn danger" data-p="rcReset">Revenir au code par défaut</button>' : '') + '</div>' +
    '<p class="hint">Les caisses reçoivent le nouveau code à leur prochaine relecture des réglages (au plus tard 30 secondes, ou ⋮ › Vérifier le catalogue). Ce code freine le personnel, ce n’est pas une protection forte.</p></section>';
}
function vSecuriteHead() {
  return vRemiseCode() + (CLIENT.donnees === 'github' ? '' : '<section><h3>Accès</h3><p class="lead">Mode démonstration : aucune clé ni jeton, les données restent dans ce navigateur. Pour enregistrer les données dans un dépôt GitHub privé (plusieurs tablettes), préparez une clé d’accès et envoyez-la à la personne qui gère votre compte.</p><div class="cbtns"><a class="btn" href="' + RACINE + 'cle.html" target="_blank" rel="noopener">Préparer une clé d’accès</a></div></section>');
}
function vConnexion() {
  var acc = caisseAcces();
  return '<section><h3>Connexion</h3><p class="lead">Les données de ce commerce (catalogue, réglages, apparence, ventes, stock, caisse, commandes, factures) sont enregistrées dans son dépôt GitHub privé.</p>' +
    '<p class="hint">Dépôt : <span class="mono">' + esc(acc ? acc.depot : '—') + '</span>' + (acc && acc.le ? ' · appareil déverrouillé le ' + new Date(acc.le).toLocaleDateString('fr-BE') : '') + '</p>' +
    '<div class="cbtns"><button class="btn danger" data-p="caisseLock">Verrouiller cet appareil</button><a class="btn" href="' + RACINE + 'cle.html" target="_blank" rel="noopener">Préparer une nouvelle clé</a></div><p class="hint">Verrouiller retire l’accès de cet appareil ; la phrase de passe sera redemandée. Nouvelle clé : quand le jeton expire ou si la phrase de passe a fuité (envoyez-la à la personne qui gère votre compte).</p></section>';
}
function demoParClick(act, el) {
  if (act === 'caisseLock') { caisseLock(); return true; }
  if (act === 'rcSave') {
    var r1 = (document.getElementById('rc1') || {}).value || '', r2 = (document.getElementById('rc2') || {}).value || '';
    if (!/^\d{4}$/.test(r1)) { toast('Le code doit avoir 4 chiffres'); return true; }
    if (r1 !== r2) { toast('Les deux codes ne sont pas identiques'); return true; }
    crypto.subtle.digest('SHA-256', new TextEncoder().encode('caisse-remise:' + r1)).then(function (b) {
      var h = Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''), cc = featCfg();
      cc.remiseCodeSha = h; cc.remiseCodeLe = new Date().toISOString(); featChanged(cc); toast('Code de remise enregistré');
    });
    return true;
  }
  if (act === 'rcReset') { var cr = featCfg(); cr.remiseCodeSha = ''; cr.remiseCodeLe = ''; featChanged(cr); toast('Code par défaut (1234)'); return true; }
  if (act === 'feat') { var c = featCfg(); c.f[el.getAttribute('data-v')] = !!el.checked; featChanged(c); return true; }
  if (act === 'featAll') { var c2 = featCfg(); FEATURES.forEach(function (g) { g.items.forEach(function (it) { c2.f[it.id] = true; }); }); featChanged(c2); return true; }
  if (act === 'featDefault') { var c3 = featCfg(); c3.f = {}; featChanged(c3); return true; }
  if (act === 'featPub') { featPublish(); return true; }
  if (act === 'thPub') { thPublish(); return true; }
  if (act === 'thLogoDel') { thSet('logo', ''); render(); return true; }
  if (act === 'thLogoTkDel') { thSet('ticket.logo', ''); render(); return true; }
  if (act === 'thFondDel') { thSet('fondImage', ''); render(); return true; }
  if (act === 'thClr') { thSet(el.getAttribute('data-v'), ''); render(); return true; }
  if (act === 'thModele') { thModele(el.getAttribute('data-v')); return true; }
  if (act === 'thPhotoDel') { thPhotoSet(el.getAttribute('data-v'), ''); render(); return true; }
  if (act === 'phPub') { phPublish(); return true; }
  if (act === 'thOnglet') { thSet('onglet', el.getAttribute('data-v') === 'defaut' ? '' : el.getAttribute('data-v')); render(); return true; }
  if (act === 'thOngletDel') { thSet('ongletImage', ''); render(); return true; }
  if (act === 'thMode') { thSet('mode', el.getAttribute('data-v') === 'sombre' ? 'sombre' : ''); render(); return true; }
  if (act === 'emoOpen') { var ev = el.getAttribute('data-v'); TH_EMO = ev && TH_EMO !== ev ? ev : null; render(); return true; }
  if (act === 'emoPick') { thSet('categories.' + el.getAttribute('data-cat') + '.emoji', el.getAttribute('data-v')); TH_EMO = null; render(); return true; }
  if (act === 'demoSeed') { PAR.demoAsk = 'seed'; render(); return true; }
  if (act === 'demoReset') { PAR.demoAsk = 'reset'; render(); return true; }
  if (act === 'demoNo') { PAR.demoAsk = null; render(); return true; }
  if (act === 'demoGo') { var s = PAR.demoAsk === 'seed'; if (s) demoSeed(); else demoReset(); try { localStorage.setItem(KP + 'admin-gh-token', 'demo'); localStorage.setItem(KP + 'admin-gh-tokens', '["demo"]'); } catch (e) {} location.hash = s ? '#sapin/bilan' : '#accueil'; location.reload(); return true; }
  return false;
}
function parClick(el) {
  if (demoParClick(el.getAttribute('data-p'), el)) return;
  var p = el.getAttribute('data-p');
  if (p === 'lock') { setToken(null); PAR.tests = null; PAR.msg = { t: 'Appareil verrouillé. La phrase de passe sera demandée pour publier.' }; render(); }
  else if (p === 'test') testRepos();
  else if (p === 'ren') { PAR.rename = +el.getAttribute('data-v'); PAR.del = null; render(); }
  else if (p === 'askDelKey') { PAR.del = +el.getAttribute('data-v'); PAR.rename = null; render(); }
  else if (p === 'delCancel') { PAR.del = null; render(); }
  else if (p === 'unhide') { lsSet(CLEHIDE_KEY, null); PAR.msg = { t: 'Clés de l\u2019app remises sur cet appareil. Déverrouillez à nouveau pour les utiliser.' }; render(); }
  else if (p === 'delKey') {
    var di = +el.getAttribute('data-v'), keys0 = allCles(), dc = keys0[di], nE = embeddedCles().length, lbl = dc ? cleLabel(dc, di) : '';
    if (dc) {
      /* jeton correspondant : même position si chaque clé a donné un jeton au déverrouillage */
      var toks = getTokens(), names = getTokenNames();
      if (toks.length === keys0.length && toks.length > 1) { toks = toks.slice(); names = names.slice(); toks.splice(di, 1); names.splice(di, 1); setTokens(toks, names); }
      else if (toks.length === keys0.length && toks.length === 1) setToken(null);
      if (di < nE) { var hl = hiddenCles(); hl.push(String(dc.data || '').slice(0, 24)); lsSet(CLEHIDE_KEY, JSON.stringify(hl)); }
      else { lsSet(LOCAL_CLE_KEY, JSON.stringify(localCles().filter(function (x) { return x.data !== dc.data; }))); }
      var al = cleAliases(); delete al[cleSig(dc)]; lsSet(CLENAMES_KEY, JSON.stringify(al));
      PAR.tests = null;
    }
    PAR.del = null; toast('Clé « ' + lbl + ' » ' + (di < nE ? 'retirée de cet appareil' : 'supprimée')); render();
  }
  else if (p === 'renCancel') { PAR.rename = null; render(); }
  else if (p === 'renSave') {
    var i = +el.getAttribute('data-v'), c = allCles()[i], v = ((document.getElementById('kRen') || {}).value || '').trim().slice(0, 40);
    if (c) {
      var nEmb = embeddedCles().length;
      if (i >= nEmb) { var lc = localCles(); lc.forEach(function (x) { if (x.data === c.data) { if (v) x.nom = v; else delete x.nom; } }); lsSet(LOCAL_CLE_KEY, JSON.stringify(lc)); }
      var al = cleAliases(); if (v && v !== c.nom) al[cleSig(c)] = v; else delete al[cleSig(c)]; lsSet(CLENAMES_KEY, JSON.stringify(al));
      var tn = getTokenNames(); if (getTokens().length === allCles().length) { tn[i] = cleLabel(c, i); lsSet(TOKNAMES_KEY, JSON.stringify(tn)); }
    }
    PAR.rename = null; toast('Nom de la clé enregistré'); render();
  }
  else if (p === 'copy') {
    var ta = document.getElementById('cleOut-' + (el.getAttribute('data-v') || 0));
    var done = function () { toast('Clé copiée'); }, fail = function () { ta.focus(); ta.select(); toast('Sélectionnée : copiez-la avec Ctrl+C'); };
    try { navigator.clipboard.writeText(ta.value).then(done, fail); } catch (e) { fail(); }
  }
}
document.addEventListener('click', function (e) {
  var c = e.target.closest('[data-c]'); if (c && !c.disabled) { catClick(c); return; }
  var p = e.target.closest('[data-p]'); if (p && !p.disabled) parClick(p);
});
document.addEventListener('input', function (e) {
  if (e.target.hasAttribute('data-cf') && e.target.type !== 'checkbox') catInput(e.target);
  if (e.target.hasAttribute('data-p-strength')) { var s = document.getElementById('strength'), r = passStrength(e.target.value); if (s) { s.textContent = r.t; s.className = 'hint ' + (r.ok ? 'good' : 'bad'); } }
});
document.addEventListener('change', function (e) {
  if (e.target.hasAttribute('data-cf') && e.target.type === 'checkbox') catInput(e.target);
  if (e.target.hasAttribute('data-catfile')) { if (e.target.files[0]) catImport(e.target.files[0]); e.target.value = ''; }
});
document.addEventListener('submit', function (e) { var f = e.target.closest('[data-p-form]'); if (f) { e.preventDefault(); parSubmit(f); } });


/* ================= Module Stock ================= */
/* Un fichier JSON par événement dans le dépôt PRIVÉ DATA_REPO : stock/<id>.json
   Mise à jour par comptage du restant : consommé = début + livré − restant.
   Les modifications sont des « opérations » gardées sur l'appareil puis rejouées sur la dernière version GitHub :
   deux tablettes peuvent compter en même temps sans s'écraser. */
var DATA_REPO = 'demo/admin-donnees';
var UNITES = ['bouteilles', 'fûts', 'caisses', 'bacs', 'pièces', 'litres', 'cartons', 'sacs'];
var STK = { q: '', onlyTodo: false, onlyLow: false, deleting: false, list: null, docs: {}, loading: false, err: null, view: 'list', cur: null, tab: 'jour', day: null, msg: null, confirm: null, timer: null, newForm: null };

function stkPath(id) { return 'stock/' + id + '.json'; }
function ghGetFile(path, token) {
  return ghFetch('/repos/' + DATA_REPO + '/contents/' + path, {}, token).then(function (j) { return { sha: j.sha, json: JSON.parse(b64utf8(j.content)) }; },
    function (e) { if (e.status === 404) return null; throw e; });
}
function ghPutFile(path, json, sha, message, token) {
  var body = { message: message, content: utf8b64(JSON.stringify(json, null, 1) + '\n') }; if (sha) body.sha = sha;
  return ghFetch('/repos/' + DATA_REPO + '/contents/' + path, { method: 'PUT', body: JSON.stringify(body) }, token);
}
function fmtQ(x) { if (x == null || isNaN(x)) return ''; var r = Math.round(x * 100) / 100; return String(r).replace('.', ','); }
function parseQ(s) { var v = String(s).replace(/\s/g, '').replace(',', '.'); if (v === '') return null; return isNaN(+v) ? NaN : +v; }
function dmy(iso) { return iso ? iso.split('-').reverse().join('/') : ''; }
function addDays(iso, n) { var d = dParts(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* ---------- Opérations ---------- */
function applyOp(doc, op) {
  if (op.t === 'doc') return clone(op.v);
  if (op.t === 'set') { var o = doc, p = op.p; for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; } if (op.v == null) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = op.v; }
  else if (op.t === 'art') { var k = -1; doc.articles.forEach(function (a, j) { if (a.id === op.v.id) k = j; }); if (k < 0) doc.articles.push(clone(op.v)); else doc.articles[k] = clone(op.v); }
  else if (op.t === 'meta') { doc[op.k] = op.v; }
  else if (op.t === 'day') { if (!doc.jours[op.d]) doc.jours[op.d] = { livraisons: {}, restant: {} }; }
  else if (op.t === 'delday') { var j = doc.jours[op.d]; if (j && !Object.keys(j.livraisons || {}).length && !Object.keys(j.restant || {}).length) delete doc.jours[op.d]; }
  return doc;
}
function curDoc() { var c = STK.cur; return c.ops.reduce(function (d, op) { return applyOp(d, op); }, clone(c.remote)); }
function opsKey(id) { return KP + 'admin-stock-ops:' + id; }
function persistCur() { var c = STK.cur; if (!c || c.demo) return; lsSet(opsKey(c.id), JSON.stringify({ remote: c.remote, sha: c.sha, ops: c.ops, isNew: c.isNew, modLe: c.ops.length ? (c.modLe || new Date().toISOString()) : null, err: c.err || null, errLe: c.err ? new Date().toISOString() : null })); }
/* Événements gardés sur cette tablette (créés ou modifiés mais pas encore enregistrés sur le serveur) */
function stkLocal() {
  var out = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i); if (!k || k.indexOf(KP + 'admin-stock-ops:') !== 0) continue;
      try {
        var o = JSON.parse(localStorage.getItem(k)); if (!o || !o.remote) continue;
        if (!o.isNew && !(o.ops && o.ops.length)) continue;
        var doc = (o.ops || []).reduce(function (d, op) { return applyOp(d, op); }, clone(o.remote));
        out.push({ id: k.slice(16), doc: doc, isNew: !!o.isNew, n: (o.ops || []).length, err: o.err || null });
      } catch (e) {}
    }
  } catch (e) {}
  return out;
}
function stkLocalReason(x) {
  if (!getToken()) return 'Déverrouillez l’appareil dans Paramètres : il sera envoyé à l’ouverture.';
  if (x.err === 'offline') return 'Pas de connexion lors du dernier essai.';
  if (x.err) return 'Dernier essai : ' + x.err;
  return 'Ouvrez-le pour l’envoyer sur le serveur.';
}
function addOp(op) {
  var c = STK.cur;
  if (op.t === 'set') c.ops = c.ops.filter(function (x) { return !(x.t === 'set' && x.p.join('|') === op.p.join('|')); });
  if (op.t === 'art') c.ops = c.ops.filter(function (x) { return !(x.t === 'art' && x.v.id === op.v.id); });
  if (op.t === 'meta') c.ops = c.ops.filter(function (x) { return !(x.t === 'meta' && x.k === op.k); });
  c.ops.push(op); c.modLe = new Date().toISOString(); c.doc = curDoc(); persistCur(); scheduleSave();
}
function scheduleSave() { clearTimeout(STK.timer); if (STK.cur && !STK.cur.demo && getToken()) STK.timer = setTimeout(function () { saveCur(); }, 6000); stkStatusRefresh(); }
function saveCur(tries) {
  var c = STK.cur; if (!c || c.saving) return;
  clearTimeout(STK.timer);
  if (c.demo) { c.remote = curDoc(); c.ops = []; c.savedAt = new Date(); stkStatusRefresh(); return; }
  var token = getToken(); if (!token || (!c.ops.length && !c.isNew)) { stkStatusRefresh(); return; }
  tries = tries || 0; c.saving = true; c.err = null; stkStatusRefresh();
  var n = c.ops.length, id = c.id;
  ghGetFile(stkPath(id), token).then(function (latest) {
    if (c.isNew && latest) throw { custom: 'Un événement porte déjà cet identifiant sur le serveur. Choisissez un autre nom.' };
    var base = latest ? latest.json : c.remote, next = c.ops.slice(0, n).reduce(function (d, op) { return applyOp(d, op); }, clone(base));
    next.majLe = new Date().toISOString();
    return ghPutFile(stkPath(id), next, latest && latest.sha, 'Stock ' + next.nom + ' (' + (c.isNew ? 'création' : 'mise à jour') + ')', token).then(function (res) {
      c.remote = next; c.sha = res.content && res.content.sha; c.ops = c.ops.slice(n); c.isNew = false; c.saving = false; c.savedAt = new Date();
      c.doc = curDoc(); STK.docs[id] = c.remote; persistCur(); if (!c.ops.length) lsSet(opsKey(id), null);
      if (STK.list && !STK.list.some(function (x) { return x.id === id; })) STK.list.push(c.remote);
      stkStatusRefresh(); if (c.ops.length) scheduleSave();
    });
  }).catch(function (e) {
    c.saving = false;
    if (e && (e.status === 409 || e.status === 422) && tries < 2) return saveCur(tries + 1);
    c.err = e && e.custom ? e.custom : e && e.status === 0 ? 'offline' : stkErr(e);
    persistCur(); stkStatusRefresh();
  });
}
function stkErr(e) {
  if (e && e.status === 404) return 'Le jeton n’a pas accès au dépôt ' + DATA_REPO + '. Créez ce dépôt privé et ajoutez-le au jeton (voir Paramètres).';
  return ghErrText(e);
}

/* ---------- Calculs ---------- */
function stkCalc(doc) {
  var days = Object.keys(doc.jours || {}).sort(), per = {}, fin = {};
  doc.articles.forEach(function (a) {
    var stock = +(doc.stockInitial[a.id] || 0), pend = [];
    per[a.id] = days.map(function (d) {
      var j = doc.jours[d], liv = +((j.livraisons || {})[a.id] || 0), r = (j.restant || {})[a.id], row = { debut: stock, liv: liv, dispo: stock + liv, restant: r == null ? null : +r, conso: null, couvre: [] };
      if (row.restant != null) { row.conso = row.dispo - row.restant; row.couvre = pend; pend = []; stock = row.restant; }
      else { pend = pend.concat([d]); stock = row.dispo; }
      return row;
    });
    fin[a.id] = stock;
  });
  return { days: days, per: per, fin: fin };
}
/* Stock bas : consommé du jour plus grand que le restant compté du même jour -> renvoie le consommé, sinon null */
function lastDayOf(doc) { var l = Object.keys(doc.jours || {}).filter(function (k) { return doc.jours[k] && doc.jours[k].dernier; }).sort(); return l[0] || null; }
function isLastDay(doc, day) { return !!(day && doc.jours[day] && doc.jours[day].dernier); }
function lowAlert(rows, di) { var r = rows[di]; return r && r.restant != null && r.conso != null && r.conso > r.restant + 0.001 ? r.conso : null; }
function lowBadge(q) { return q == null ? '' : '<span class="lowb" title="Il reste moins que ce qui a été consommé ce jour">Stock bas · ' + fmtQ(q) + ' consommé' + (q > 1 ? 's' : '') + ', plus que le restant</span>'; }
function normTxt(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function dayProgress(doc, d) { var arts = doc.articles.filter(function (a) { return a.actif !== false; }), r = (doc.jours[d] || {}).restant || {}; return { n: arts.filter(function (a) { return r[a.id] != null; }).length, tot: arts.length }; }
function groupArticles(arts) {
  var g = {}, order = [];
  arts.forEach(function (a) { var k = (a.categorie || '').trim() || 'Sans catégorie'; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(a); });
  return order.map(function (k) { return { cat: k, items: g[k] }; });
}

/* ---------- Chargement ---------- */
function stkLoadList() {
  var token = getToken(); if (!token) { STK.list = null; render(); return; }
  STK.loading = true; STK.err = null; render();
  return ghFetch('/repos/' + DATA_REPO + '/contents/stock', {}, token).then(function (files) {
    var js = (files || []).filter(function (f) { return /\.json$/.test(f.name); });
    return Promise.all(js.map(function (f) { return ghGetFile('stock/' + f.name, token).then(function (r) { if (r) STK.docs[r.json.id] = r.json; return r && r.json; }); }));
  }, function (e) { if (e.status === 404 || e.status === 409) return ghFetch('/repos/' + DATA_REPO, {}, token).then(function () { return []; }); throw e; })
    .then(function (docs) { STK.loading = false; STK.list = docs.filter(Boolean); render(); })
    .catch(function (e) { STK.loading = false; STK.err = e.status === 0 ? 'offline' : stkErr(e); STK.list = STK.list || []; render(); });
}
function stkOpen(id) {
  var saved = lsGet(opsKey(id)), o = null; try { o = saved ? JSON.parse(saved) : null; } catch (e) {}
  var remote = o ? o.remote : STK.docs[id];
  STK.cur = { id: id, remote: clone(remote), sha: o ? o.sha : null, ops: o ? o.ops : [], modLe: o ? o.modLe : null, isNew: o ? o.isNew : false, saving: false, savedAt: null, err: null };
  STK.cur.doc = curDoc(); STK.view = 'event'; STK.tab = 'jour'; STK.confirm = null; STK.msg = null;
  var days = Object.keys(STK.cur.doc.jours).sort(); STK.day = days[days.length - 1] || null;
  if (!STK.cur.doc.articles.length) STK.tab = 'articles';
  render(); window.scrollTo(0, 0);
  if (STK.cur.ops.length || STK.cur.isNew) saveCur();
  else if (getToken()) ghGetFile(stkPath(id), getToken()).then(function (r) { if (r && STK.cur && STK.cur.id === id && !STK.cur.ops.length) { STK.cur.remote = r.json; STK.cur.sha = r.sha; STK.cur.doc = curDoc(); STK.docs[id] = r.json; render(); } }, function () {});
}

/* ---------- Export / import de fichiers (secours sans GitHub, transfert entre tablettes) ---------- */
function saveJson(name, obj) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/* Version la plus complète connue sur cet appareil : GitHub + modifications locales pas encore envoyées */
function stkBestDoc(id) {
  if (STK.cur && STK.cur.id === id && !STK.cur.demo) { var cd = clone(STK.cur.doc); if (STK.cur.ops.length && STK.cur.modLe) cd.majLe = STK.cur.modLe; return cd; }
  var o = null; try { o = JSON.parse(lsGet(opsKey(id)) || 'null'); } catch (e) {}
  if (o && o.remote) { var ld = (o.ops || []).reduce(function (d, op) { return applyOp(d, op); }, clone(o.remote)); if (o.ops && o.ops.length && o.modLe) ld.majLe = o.modLe; return ld; }
  return STK.docs[id] ? clone(STK.docs[id]) : null;
}
function stkCleanDoc(d) { d = clone(d); delete d.demo; return d; }
function stkExportOne(id) {
  var d = stkBestDoc(id); if (!d) { toast('Événement introuvable sur cet appareil'); return; }
  saveJson('stock_' + d.id + '_' + todayIso() + '.json', stkCleanDoc(d));
  toast('Fichier du stock téléchargé');
}
function stkExportAll() {
  var ids = {}; (STK.list || []).forEach(function (d) { ids[d.id] = 1; }); stkLocal().forEach(function (x) { ids[x.id] = 1; });
  var docs = Object.keys(ids).map(stkBestDoc).filter(Boolean).map(stkCleanDoc);
  if (!docs.length) { toast('Aucun stock à exporter sur cet appareil'); return; }
  saveJson('stocks_' + todayIso() + '.json', { format: 'admin/stock-lot', formatVersion: 1, exporteLe: new Date().toISOString(), evenements: docs });
  toast(docs.length + ' stock' + (docs.length > 1 ? 's' : '') + ' exporté' + (docs.length > 1 ? 's' : '') + ' dans un fichier');
}
function stkValid(d) { return d && d.format === 'admin/stock' && typeof d.id === 'string' && /^[a-z0-9-]{1,80}$/.test(d.id) && d.nom && Array.isArray(d.articles) && d.jours && typeof d.jours === 'object' && d.stockInitial && typeof d.stockInitial === 'object'; }
function stkImportFiles(files) {
  files = Array.prototype.slice.call(files || []); if (!files.length) return;
  var docs = [], bad = [], left = files.length;
  files.forEach(function (f) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result), list = j && j.format === 'admin/stock-lot' && Array.isArray(j.evenements) ? j.evenements : [j];
        var ok = list.filter(stkValid); if (!ok.length) throw 0; docs = docs.concat(ok);
      } catch (e) { bad.push(f.name); }
      if (--left === 0) stkImportDocs(docs, bad);
    };
    rd.onerror = function () { bad.push(f.name); if (--left === 0) stkImportDocs(docs, bad); };
    rd.readAsText(f);
  });
}
function stkImportDocs(docs, bad) {
  if (!docs.length) { STK.msg = { err: true, t: 'Aucun stock lisible dans ' + (bad.length > 1 ? 'ces fichiers' : 'ce fichier') + ' (' + esc(bad.join(', ')) + '). Choisissez un fichier exporté depuis le module Stock.' }; render(); return; }
  var go = function () {
    var fresh = [], conf = [];
    docs.forEach(function (d) {
      d = stkCleanDoc(d);
      var local = null; try { local = JSON.parse(lsGet(opsKey(d.id)) || 'null'); } catch (e) {}
      if (local || STK.docs[d.id]) conf.push(d); else fresh.push(d);
    });
    fresh.forEach(function (d) { lsSet(opsKey(d.id), JSON.stringify({ remote: d, sha: null, ops: [], isNew: true, err: null })); });
    STK.imp = conf; STK.view = 'list'; STK.cur = null;
    STK.msg = fresh.length || bad.length ? { t: (fresh.length ? fresh.length + ' stock' + (fresh.length > 1 ? 's importés' : ' importé') + ' sur cette tablette' + (getToken() ? ' : ouvrez-' + (fresh.length > 1 ? 'les' : 'le') + ' pour ' + (fresh.length > 1 ? 'les' : 'l’') + 'enregistrer sur le serveur.' : ' (enregistré' + (fresh.length > 1 ? 's' : '') + ' sur le serveur après déverrouillage).') : '') + (bad.length ? ' Fichier' + (bad.length > 1 ? 's' : '') + ' ignoré' + (bad.length > 1 ? 's' : '') + ' : ' + esc(bad.join(', ')) + '.' : '') } : null;
    render();
  };
  if (getToken() && STK.list === null) { var pr = stkLoadList(); if (pr && pr.then) pr.then(go, go); else go(); } else go();
}
function stkImportReplace(d) {
  var local = null; try { local = JSON.parse(lsGet(opsKey(d.id)) || 'null'); } catch (e) {}
  if (STK.docs[d.id] && !(local && local.isNew)) lsSet(opsKey(d.id), JSON.stringify({ remote: local && local.remote ? local.remote : STK.docs[d.id], sha: local ? local.sha : null, ops: [{ t: 'doc', v: d }], isNew: false, err: null }));
  else lsSet(opsKey(d.id), JSON.stringify({ remote: d, sha: null, ops: [], isNew: true, err: null }));
}
function vStkImp() {
  var d = STK.imp && STK.imp[0]; if (!d) return '';
  var cur = stkBestDoc(d.id) || {}, ndays = function (x) { return Object.keys((x && x.jours) || {}).length; };
  function when(x) { return x && x.majLe ? new Date(x.majLe).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'date inconnue'; }
  var older = cur.majLe && d.majLe && d.majLe < cur.majLe;
  return '<section class="stkpend"><h3>« ' + esc(d.nom) + ' » existe déjà</h3>' +
    '<p class="lead">Sur cet appareil : modifié le ' + when(cur) + ', ' + ndays(cur) + ' jour' + (ndays(cur) > 1 ? 's' : '') + ', ' + (cur.articles || []).length + ' article' + ((cur.articles || []).length > 1 ? 's' : '') + '.<br>Dans le fichier : modifié le ' + when(d) + ', ' + ndays(d) + ' jour' + (ndays(d) > 1 ? 's' : '') + ', ' + d.articles.length + ' article' + (d.articles.length > 1 ? 's' : '') + '.</p>' +
    (older ? '<div class="alert err" style="margin-bottom:12px">Le fichier est plus ancien que la version de cet appareil : le remplacer effacerait les saisies plus récentes.</div>' : '') +
    '<p class="lead">Remplacer met le contenu du fichier à la place de l’événement (sur GitHub aussi, dès que possible).</p>' +
    '<div class="cat-acts"><button class="pick" data-s="impReplace">Remplacer par le fichier</button><button class="btn" data-s="impSkip">Ne pas importer</button></div>' +
    (STK.imp.length > 1 ? '<p class="hint">Encore ' + (STK.imp.length - 1) + ' autre' + (STK.imp.length > 2 ? 's' : '') + ' après celui-ci.</p>' : '') + '</section>';
}
document.addEventListener('change', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-s-import')) { stkImportFiles(e.target.files); e.target.value = ''; } });
function demoEvent() {
  var arts = [['a1', 'Jupiler fût 50 L', 'fûts', 'Bières'], ['a2', 'Bière spéciale', 'bouteilles', 'Bières'], ['a3', 'Coca-Cola 33 cl', 'canettes', 'Softs'], ['a4', 'Eau plate 50 cl', 'bouteilles', 'Softs'], ['a5', 'Vin rouge', 'bouteilles', 'Vins'], ['a6', 'Cava', 'bouteilles', 'Bulles'], ['a7', 'Gobelets 25 cl', 'pièces', 'Matériel']];
  var init = { a1: 12, a2: 240, a3: 480, a4: 360, a5: 60, a6: 48, a7: 5000 };
  var d1 = { a1: 7, a2: 150, a3: 310, a4: 250, a5: 41, a6: 30, a7: 3400 }, d2 = { a1: 3, a2: 60, a3: 120, a4: 160, a5: 22, a6: 14, a7: 1500 };
  return { format: 'admin/stock', formatVersion: 1, id: 'exemple', nom: 'Soirée démo (exemple)', debut: '2026-10-16', statut: 'ouvert', creeLe: '2026-10-16T10:00:00Z', demo: true,
    articles: arts.map(function (a) { return { id: a[0], nom: a[1], unite: a[2], categorie: a[3], actif: true }; }), stockInitial: init,
    jours: { '2026-10-16': { livraisons: {}, restant: d1 }, '2026-10-17': { livraisons: { a1: 4, a3: 240 }, restant: d2 }, '2026-10-18': { livraisons: {}, restant: { a1: 2, a2: 31 } } } };
}

/* ---------- Rendu ---------- */
function renderStock() {
  var el = document.getElementById('mod');
  if (STK.view === 'event' && STK.cur) { el.innerHTML = vStkEvent() + vToast(); if (STK.tab === 'jour') applyStkFilter(); return; }
  if (STK.view === 'new') { el.innerHTML = vStkNew() + vToast(); return; }
  if (getToken() && STK.list === null && !STK.loading && !STK.err) { stkLoadList(); return; }
  el.innerHTML = vStkList() + vToast();
}
function vStkList() {
  var unlocked = !!getToken();
  var band = '<div class="band"><div class="band-top"><h1>Stock</h1></div><p class="soon-lead">Un stock par événement : encodez le stock de départ, comptez le restant chaque jour, clôturez en fin d’événement pour voir la consommation jour par jour.</p>' +
    '<div class="cat-acts" style="max-width:1180px;margin:16px auto 0">' + (unlocked ? '<button class="pick" data-s="new">+ Nouvel événement</button>' : '<button class="pick" data-a="go" data-v="parametres">Déverrouiller l’appareil</button>') +
    '<label class="ghost lab">Importer un fichier<input type="file" accept=".json,application/json" multiple data-s-import></label><button class="ghost" data-s="exportAll">Exporter tout</button>' +
    '<button class="ghost" data-s="demo">Essayer avec un exemple</button>' + (unlocked ? '<button class="ghost" data-s="reloadList"' + (STK.loading ? ' disabled' : '') + '>Actualiser</button>' : '') + '</div></div>';
  var body = '';
  if (!unlocked) body += '<div class="alerts"><div class="alert">Le stock est enregistré dans le dépôt privé <span class="mono">' + esc(DATA_REPO) + '</span>. Déverrouillez l’appareil dans Paramètres pour le consulter et le mettre à jour.</div></div>';
  if (STK.err) body += '<div class="alerts"><div class="alert err">' + (STK.err === 'offline' ? ghErrText({ status: 0 }) : STK.err) + '</div></div>';
  if (STK.msg) body += '<div class="alerts"><div class="alert' + (STK.msg.err ? ' err' : '') + '">' + STK.msg.t + '</div></div>';
  body += vStkImp();
  var loc = stkLocal(), onGh = {};
  (STK.list || []).forEach(function (d) { onGh[d.id] = 1; });
  var pend = loc.filter(function (x) { return !onGh[x.id] || x.isNew; }), pendOps = {};
  loc.forEach(function (x) { if (onGh[x.id] && !x.isNew) pendOps[x.id] = x.n; });
  if (pend.length) body += '<section class="stkpend"><h3>Pas encore enregistrés sur le serveur</h3><p class="lead">Ces événements sont gardés sur cette tablette seulement. Ne videz pas les données du navigateur avant qu’ils soient envoyés.</p><div class="evgrid">' +
    pend.map(function (x) { var d = x.doc, days = Object.keys(d.jours || {}).sort();
      return '<div class="evcard"><button class="evopen" data-s="open" data-v="' + esc(x.id) + '"><span class="state warn">' + (x.isNew ? 'Sur cette tablette' : x.n + ' modification' + (x.n > 1 ? 's' : '') + ' non envoyée' + (x.n > 1 ? 's' : '')) + '</span><h3>' + esc(d.nom || x.id) + '</h3>' +
        '<p class="num">' + (d.debut ? dmy(d.debut) + ' · ' : '') + days.length + ' jour' + (days.length > 1 ? 's' : '') + ' · ' + (d.articles || []).length + ' article' + ((d.articles || []).length > 1 ? 's' : '') + '</p><p class="why">' + esc(stkLocalReason(x)) + '</p></button></div>'; }).join('') + '</div></section>';
  if (STK.loading) body += '<section><p class="empty">Chargement des événements…</p></section>';
  else if (unlocked && STK.list) {
    var open = STK.list.filter(function (d) { return d.statut !== 'cloture'; }), closed = STK.list.filter(function (d) { return d.statut === 'cloture'; });
    function card(d) {
      var days = Object.keys(d.jours || {}).sort(), last = days[days.length - 1];
      return '<div class="evcard"><button class="evopen" data-s="open" data-v="' + esc(d.id) + '"><span class="state ' + (d.statut === 'cloture' ? '' : 'ok') + '">' + (d.statut === 'cloture' ? 'Clôturé' : 'En cours') + '</span><h3>' + esc(d.nom) + '</h3>' +
        '<p class="num">' + dmy(d.debut) + (last && last !== d.debut ? ' → ' + dmy(last) : '') + ' · ' + days.length + ' jour' + (days.length > 1 ? 's' : '') + ' · ' + d.articles.length + ' article' + (d.articles.length > 1 ? 's' : '') + '</p>' + (pendOps[d.id] ? '<p class="why">' + pendOps[d.id] + ' modification' + (pendOps[d.id] > 1 ? 's' : '') + ' pas encore envoyée' + (pendOps[d.id] > 1 ? 's' : '') + ' depuis cette tablette</p>' : '') + '</button></div>';
    }
    body += '<section><h3>En cours</h3>' + (open.length ? '<div class="evgrid">' + open.map(card).join('') + '</div>' : '<p class="empty">Aucun événement en cours sur le serveur. Créez-en un avec « Nouvel événement ».</p>') + '</section>';
    if (closed.length) body += '<section><h3>Clôturés</h3><div class="evgrid">' + closed.sort(function (a, b) { return a.debut < b.debut ? 1 : -1; }).map(card).join('') + '</div></section>';
  }
  return band + '<main>' + body + '</main>';
}
function vStkNew() {
  var f = STK.newForm || (STK.newForm = { nom: '', debut: todayIso(), from: '', carry: true });
  var prev = (STK.list || []).slice().sort(function (a, b) { return a.debut < b.debut ? 1 : -1; });
  return '<div class="band"><div class="band-top"><h1>Nouvel événement</h1></div></div><main><section><form class="stkform" data-s-form="new">' +
    '<label class="fl" for="evNom">Nom de l’événement</label><input type="text" id="evNom" required value="' + esc(f.nom) + '" placeholder="Ex. Soirée démo 2026">' +
    '<label class="fl" for="evDebut">Premier jour</label><input type="date" id="evDebut" required value="' + esc(f.debut) + '">' +
    (prev.length ? '<label class="fl" for="evFrom">Reprendre les articles de</label><select id="evFrom"><option value="">Aucun : je crée ma liste</option>' + prev.map(function (d) { return '<option value="' + esc(d.id) + '"' + (f.from === d.id ? ' selected' : '') + '>' + esc(d.nom) + ' (' + dmy(d.debut) + ')</option>'; }).join('') + '</select>' +
      '<label class="tog"><input type="checkbox" id="evCarry"' + (f.carry ? ' checked' : '') + '>Avec leur stock restant comme stock de départ</label>' : '') +
    '<div class="cbtns"><button class="pick" type="submit">Créer l’événement</button><button class="btn" type="button" data-s="back">Annuler</button></div></form></section></main>';
}
function stkStatusHtml() {
  var c = STK.cur; if (!c) return '';
  if (c.demo) return '<span class="sv sv-demo">Exemple : rien n’est enregistré sur le serveur</span>';
  if (c.saving) return '<span class="sv">Enregistrement…</span>';
  if (c.err === 'offline') return '<span class="sv warn">Hors ligne : ' + c.ops.length + ' modification' + (c.ops.length > 1 ? 's gardées' : ' gardée') + ' sur l’appareil</span> <button class="ghost sm" data-s="save">Réessayer</button>';
  if (c.err) return '<span class="sv err">' + c.err + '</span> <button class="ghost sm" data-s="save">Réessayer</button>';
  if (!getToken() && c.isNew) return '<span class="sv warn">Pas encore enregistré sur le serveur : déverrouillez l’appareil (gardé sur cette tablette)</span>';
  if (!getToken() && c.ops.length) return '<span class="sv warn">' + c.ops.length + ' modification(s) non enregistrée(s) : déverrouillez l’appareil</span>';
  if (c.isNew) return '<span class="sv warn">Pas encore enregistré sur le serveur</span> <button class="ghost sm" data-s="save">Enregistrer maintenant</button>';
  if (c.ops.length) return '<span class="sv warn">' + c.ops.length + ' modification' + (c.ops.length > 1 ? 's' : '') + ' en attente</span> <button class="ghost sm" data-s="save">Enregistrer maintenant</button>';
  return '<span class="sv ok">Enregistré sur le serveur' + (c.savedAt ? ' à ' + String(c.savedAt.getHours()).padStart(2, '0') + ':' + String(c.savedAt.getMinutes()).padStart(2, '0') : '') + '</span>';
}
function stkStatusRefresh() { var s = document.getElementById('stkStatus'); if (s) s.innerHTML = stkStatusHtml(); }
function vStkEvent() {
  var c = STK.cur, d = c.doc, closed = d.statut === 'cloture';
  var tabs = [['jour', 'Comptage du jour'], ['articles', 'Articles et stock de départ'], ['bilan', closed ? 'Bilan' : 'Bilan et clôture']];
  var band = '<div class="band"><p class="crumb"><button class="linkish" data-s="back">← Tous les événements</button></p><div class="band-top evtitle"><h1>' + esc(d.nom) + (closed ? '<span class="pill">Clôturé</span>' : '') + '</h1>' + (closed ? '<button class="ghost sm delbtn" data-s="askDel" data-v="' + esc(d.id) + '"' + (STK.deleting ? ' disabled' : '') + '>Supprimer</button>' : '') + '</div>' +
    '<p class="cat-status num" style="max-width:1180px;margin:6px auto 0">Depuis le ' + dmy(d.debut) + ' · <span id="stkStatus">' + stkStatusHtml() + '</span>' + (c.demo ? '' : ' <button class="ghost sm" data-s="export">Exporter (fichier)</button>') + '</p>' +
    '<div class="stabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" aria-selected="' + (STK.tab === t[0]) + '" class="' + (STK.tab === t[0] ? 'on' : '') + '" data-s="tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>';
  var body = STK.tab === 'articles' ? vStkArticles(d, closed) : STK.tab === 'bilan' ? vStkBilan(d, closed) : vStkDay(d, closed);
  var delPanel = closed && STK.confirm && STK.confirm.type === 'del' ? '<section class="pubpanel delpanel"><h3>Supprimer « ' + esc(d.nom) + ' » ?</h3><p class="lead">L\u2019événement et tous ses comptages disparaîtront de toutes les tablettes. Exportez d\u2019abord le bilan pour Excel si vous voulez le garder.</p>' +
    '<div class="cbtns"><button class="btn danger" data-s="del" data-v="' + esc(d.id) + '"' + (STK.deleting ? ' disabled' : '') + '>' + (STK.deleting ? 'Suppression…' : 'Supprimer définitivement') + '</button><button class="btn" data-s="cancel"' + (STK.deleting ? ' disabled' : '') + '>Annuler</button></div></section>' : '';
  return band + '<main>' + delPanel + (STK.msg ? '<div class="alerts"><div class="alert' + (STK.msg.err ? ' err' : STK.msg.ok ? ' ok' : '') + '">' + STK.msg.t + '</div></div>' : '') + body + '</main>';
}
function vStkDay(d, closed) {
  var calc = stkCalc(d), days = calc.days, arts = d.articles.filter(function (a) { return a.actif !== false; });
  if (!arts.length) return '<section><h3>Aucun article</h3><p class="lead">Ajoutez d’abord les articles et leur stock de départ.</p><button class="btn" data-s="tab" data-v="articles">Ajouter des articles</button></section>';
  if (STK.day && days.indexOf(STK.day) < 0) STK.day = days[days.length - 1] || null;
  var chips = days.map(function (x) { var p = dayProgress(d, x); return '<button class="chip' + (STK.day === x ? ' on' : '') + '" data-s="day" data-v="' + x + '">' + shortDate(x) + (p.n === p.tot ? ' ✓' : '') + (isLastDay(d, x) ? ' · dernier jour' : '') + '</button>'; }).join('');
  var next = days.length ? addDays(days[days.length - 1], 1) : d.debut, endDay = lastDayOf(d);
  var head = '<section class="dayhead"><div class="fgroup"><span>Jour</span>' + chips + (closed || endDay ? '' : '<button class="chip add" data-s="addDay" data-v="' + next + '">+ ' + shortDate(next) + '</button>') + '</div>' +
    (!closed && endDay ? '<p class="hint" style="margin-top:8px">Le ' + longDate(endDay) + ' est marqué comme dernier jour : pas de jour suivant à ajouter.</p>' : '') +
    (!closed ? '<p class="hint" style="margin-top:8px">Autre date : <input type="date" id="otherDay" aria-label="Ajouter un autre jour"> <button class="btn sm" data-s="addOther">Ajouter</button></p>' : '') + '</section>';
  if (!STK.day) return head + '<section><p class="empty">Ajoutez le premier jour (' + longDate(d.debut) + ') pour commencer le comptage.</p></section>';
  var di = days.indexOf(STK.day), p = dayProgress(d, STK.day), j = d.jours[STK.day], lastFlag = isLastDay(d, STK.day);
  var rows = groupArticles(arts).map(function (g) {
    return '<tr class="cat"><td colspan="5">' + esc(g.cat) + '</td></tr>' + g.items.map(function (a) {
      var r = calc.per[a.id][di], warn = r.conso != null && r.conso < -0.001, low = lastFlag ? null : lowAlert(calc.per[a.id], di);
      return '<tr id="row-' + esc(a.id) + '" class="art' + (low != null ? ' low' : '') + '" data-name="' + esc(normTxt(a.nom + ' ' + (a.categorie || ''))) + '"><td><strong>' + esc(a.nom) + '</strong><span class="sub">' + esc(a.unite || '') + '</span><span data-k="low">' + lowBadge(low) + '</span></td>' +
        '<td class="r num" data-k="debut">' + fmtQ(r.debut) + '</td>' +
        '<td class="r">' + vQtyCell('liv', a, fmtQ((j.livraisons || {})[a.id]), 'livré', 'Livré', closed) + '</td>' +
        '<td class="r">' + vQtyCell('rest', a, fmtQ((j.restant || {})[a.id]), 'à compter', 'Restant compté', closed) + '</td>' +
        '<td class="r num' + (warn ? ' neg' : '') + '" data-k="conso">' + vConsoCell(r) + '</td></tr>';
    }).join('');
  }).join('');
  return head + '<section><div class="row-between"><h3>' + longDate(STK.day).replace(/^./, function (c) { return c.toUpperCase(); }) + '</h3><span class="prog num" id="dayProg">' + p.n + ' / ' + p.tot + ' comptés</span></div>' +
    '<p class="lead">Notez les livraisons du jour et comptez ce qui reste en fin de journée. Consommé = début + livré − restant.</p>' +
    '<label class="tog lastday"><input type="checkbox" id="stkLast"' + (lastFlag ? ' checked' : '') + (closed ? ' disabled' : '') + '>Dernier jour de l\u2019événement : pas d\u2019alerte « stock bas »</label>' +
    '<div class="stkfind"><input type="search" id="stkQ" placeholder="Rechercher un article…" aria-label="Rechercher un article" value="' + esc(STK.q || '') + '" autocomplete="off">' +
    '<label class="tog"><input type="checkbox" id="stkTodo"' + (STK.onlyTodo ? ' checked' : '') + '>À compter seulement</label>' +
    '<label class="tog"><input type="checkbox" id="stkLow"' + (STK.onlyLow ? ' checked' : '') + '>Stock bas seulement</label></div>' +
    '<div class="scroll"><table class="stab"><thead><tr><th>Article</th><th class="r">Début</th><th class="r">Livré</th><th class="r">Restant compté</th><th class="r">Consommé</th></tr></thead><tbody>' + rows + '<tr class="nomatch" hidden><td colspan="5" class="empty">Aucun article ne correspond.</td></tr></tbody></table></div>' +
    (!closed && !Object.keys(j.livraisons || {}).length && !Object.keys(j.restant || {}).length ? '<p style="margin:14px 0 0"><button class="btn danger" data-s="delDay" data-v="' + STK.day + '">Retirer ce jour</button></p>' : '') + '</section>';
}
/* Recherche et filtres du comptage : appliqués sur les lignes déjà affichées (le focus reste dans les champs) */
function applyStkFilter() {
  var tb = document.querySelector('.stab:not(.bil):not(.arts) tbody'); if (!tb) return;
  var q = normTxt(STK.q).trim(), any = false, cat = null, catHas = false;
  function closeCat() { if (cat) cat.hidden = !catHas; }
  Array.prototype.forEach.call(tb.children, function (tr) {
    if (tr.classList.contains('cat')) { closeCat(); cat = tr; catHas = false; return; }
    if (!tr.classList.contains('art')) return;
    var aid = tr.id.slice(4), rest = document.getElementById('rest-' + aid), counted = rest && rest.value.trim() !== '';
    var show = (!q || tr.getAttribute('data-name').indexOf(q) >= 0) && (!STK.onlyTodo || !counted) && (!STK.onlyLow || tr.classList.contains('low'));
    tr.hidden = !show; if (show) { catHas = true; any = true; }
  });
  closeCat();
  var nm = tb.querySelector('.nomatch'); if (nm) nm.hidden = any;
}
/* Champ de quantité + bouton « + » (visible seulement quand le champ a déjà une valeur) pour ajouter un comptage */
function vQtyCell(f, a, val, ph, lab, closed) {
  var id = (f === 'liv' ? 'liv-' : 'rest-') + esc(a.id);
  return '<span class="qwrap"><input type="text" inputmode="decimal" class="qty num' + (f === 'rest' ? ' cnt' : '') + '" id="' + id + '" aria-label="' + lab + ' ' + esc(a.nom) + '" data-sf="' + f + '" data-v="' + esc(a.id) + '" value="' + val + '" placeholder="' + ph + '"' + (closed ? ' disabled' : '') + '>' +
    (closed ? '' : '<button type="button" class="qplus" data-s="plus" data-v="' + id + '" aria-label="Ajouter au ' + lab.toLowerCase() + ' de ' + esc(a.nom) + '" title="Ajouter une quantité"' + (val === '' ? ' hidden' : '') + '>+</button>') + '</span>';
}
function qtyPlusOpen(id) {
  var main = document.getElementById(id); if (!main) return;
  var wrap = main.parentNode; if (wrap.querySelector('.qadd')) { wrap.querySelector('.qadd input').focus(); return; }
  var box = document.createElement('span'); box.className = 'qadd';
  box.innerHTML = '<span class="qsign">+</span><input type="text" inputmode="decimal" class="qty num addin" aria-label="Quantité à ajouter" placeholder="à ajouter"><button type="button" class="btn sm qok">OK</button><button type="button" class="btn sm qx" aria-label="Annuler">✕</button>';
  wrap.appendChild(box);
  var inp = box.querySelector('input'), done = false;
  function close() { done = true; if (box.parentNode) box.parentNode.removeChild(box); }
  function commit() {
    if (done) return; var add = parseQ(inp.value);
    if (add === null) { close(); return; }
    if (isNaN(add) || add < 0) { inp.classList.add('bad'); inp.focus(); return; }
    var base = parseQ(main.value) || 0, tot = Math.round((base + add) * 100) / 100;
    close(); main.value = fmtQ(tot); stkInput(main);
    toast((main.getAttribute('data-sf') === 'liv' ? 'Livré' : 'Restant') + ' : ' + fmtQ(base) + ' + ' + fmtQ(add) + ' = ' + fmtQ(tot));
  }
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); close(); main.focus(); } });
  inp.addEventListener('blur', function () { setTimeout(function () { if (!done && document.activeElement !== inp && !box.contains(document.activeElement)) commit(); }, 150); });
  box.querySelector('.qok').addEventListener('click', commit);
  box.querySelector('.qx').addEventListener('click', function () { close(); });
  inp.focus();
}
function vConsoCell(r) {
  if (r.conso == null) return '<span class="faint">—</span>';
  return fmtQ(r.conso) + (r.conso < -0.001 ? '<span class="sub">restant &gt; disponible</span>' : '') + (r.couvre.length ? '<span class="sub">inclut ' + r.couvre.map(shortDate).join(', ') + '</span>' : '');
}
function vStkArticles(d, closed) {
  var rows = d.articles.map(function (a) {
    return '<tr class="' + (a.actif === false ? 'off' : '') + '"><td><input type="text" id="an-' + esc(a.id) + '" aria-label="Nom" data-sa="nom" data-v="' + esc(a.id) + '" value="' + esc(a.nom) + '"' + (closed ? ' disabled' : '') + '></td>' +
      '<td><input type="text" list="unites" id="au-' + esc(a.id) + '" aria-label="Unité" data-sa="unite" data-v="' + esc(a.id) + '" value="' + esc(a.unite || '') + '"' + (closed ? ' disabled' : '') + '></td>' +
      '<td><input type="text" list="stkcats" id="ac-' + esc(a.id) + '" aria-label="Catégorie" data-sa="categorie" data-v="' + esc(a.id) + '" value="' + esc(a.categorie || '') + '"' + (closed ? ' disabled' : '') + '></td>' +
      '<td class="r"><input type="text" inputmode="decimal" class="qty num" id="ai-' + esc(a.id) + '" aria-label="Stock de départ" data-sa="init" data-v="' + esc(a.id) + '" value="' + fmtQ(d.stockInitial[a.id]) + '" placeholder="0"' + (closed ? ' disabled' : '') + '></td>' +
      '<td class="c"><input type="checkbox" aria-label="Suivi" data-sa="actif" data-v="' + esc(a.id) + '"' + (a.actif !== false ? ' checked' : '') + (closed ? ' disabled' : '') + '></td></tr>';
  }).join('');
  var cats = {}; d.articles.forEach(function (a) { if (a.categorie) cats[a.categorie] = 1; });
  return '<section><h3>Articles et stock de départ</h3><p class="lead">Le stock de départ est ce que vous avez avant le premier jour. Un article ajouté en cours d’événement : laissez le départ à 0 et notez sa quantité en « Livré » le jour où il arrive. Décochez « Suivi » pour masquer un article sans perdre son historique.</p>' +
    '<datalist id="unites">' + UNITES.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist><datalist id="stkcats">' + Object.keys(cats).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist>' +
    '<div class="scroll"><table class="stab arts"><thead><tr><th>Article</th><th>Unité</th><th>Catégorie</th><th class="r">Départ</th><th class="c">Suivi</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="empty">Aucun article pour l’instant.</td></tr>') + '</tbody></table></div>' +
    (closed ? '' : '<p style="margin:14px 0 0"><button class="btn" data-s="addArt">+ Ajouter un article</button></p>') + '</section>';
}
function vStkBilan(d, closed) {
  var calc = stkCalc(d), days = calc.days, arts = d.articles;
  if (!days.length || !arts.length) return '<section><p class="empty">Le bilan apparaîtra après le premier comptage.</p></section>';
  var missing = []; days.forEach(function (x) { var p = dayProgress(d, x); if (p.n < p.tot) missing.push(shortDate(x) + ' (' + (p.tot - p.n) + ' non compté' + (p.tot - p.n > 1 ? 's' : '') + ')'); });
  var head = '<thead><tr><th>Article</th><th class="r">Départ</th><th class="r">Livré</th>' + days.map(function (x) { return '<th class="r">' + shortDate(x) + '</th>'; }).join('') + '<th class="r">Total consommé</th><th class="r">Restant</th></tr></thead>';
  var body = groupArticles(arts).map(function (g) {
    return '<tr class="cat"><td colspan="' + (days.length + 5) + '">' + esc(g.cat) + '</td></tr>' + g.items.map(function (a) {
      var rows = calc.per[a.id], liv = rows.reduce(function (s, r) { return s + r.liv; }, 0), tot = rows.reduce(function (s, r) { return s + (r.conso || 0); }, 0);
      var pending = rows.length && rows[rows.length - 1].restant == null;
      return '<tr><td><strong>' + esc(a.nom) + '</strong><span class="sub">' + esc(a.unite || '') + '</span></td><td class="r num">' + fmtQ(+(d.stockInitial[a.id] || 0)) + '</td><td class="r num">' + (liv ? fmtQ(liv) : '<span class="faint">0</span>') + '</td>' +
        rows.map(function (r) { return '<td class="r num' + (r.conso != null && r.conso < -0.001 ? ' neg' : '') + '">' + (r.conso == null ? '<span class="faint">—</span>' : fmtQ(r.conso)) + '</td>'; }).join('') +
        '<td class="r num"><strong>' + fmtQ(tot) + '</strong></td><td class="r num">' + fmtQ(calc.fin[a.id]) + (pending ? '<span class="sub">non compté</span>' : '') + (function () { var li = -1; rows.forEach(function (r, i) { if (r.restant != null) li = i; }); var q = li >= 0 && !isLastDay(d, days[li]) ? lowAlert(rows, li) : null; return q != null ? '<br>' + lowBadge(q) : ''; })() + '</td></tr>';
    }).join('');
  }).join('');
  var clot = '';
  if (!closed) {
    clot = STK.confirm === 'close'
      ? '<section class="pubpanel"><h3>Clôturer « ' + esc(d.nom) + ' » ?</h3><p class="lead">L’événement passe en lecture seule. Vous pourrez le rouvrir si besoin.</p>' + (missing.length ? '<div class="alert">Comptages incomplets : ' + missing.join(', ') + '. Les jours non comptés sont reportés sur le jour compté suivant.</div>' : '') +
        '<div class="cbtns" style="margin-top:12px"><button class="pick" data-s="close">Clôturer</button><button class="btn" data-s="cancel">Annuler</button></div></section>'
      : '<section><h3>Clôture</h3><p class="lead">En fin d’événement, clôturez pour figer les comptages.' + (missing.length ? ' Encore à compter : ' + missing.join(', ') + '.' : ' Tous les jours sont comptés.') + '</p><button class="pick" data-s="askClose">Clôturer l’événement</button></section>';
  } else clot = '<section><h3>Clôturé le ' + dmy((d.clotureLe || '').slice(0, 10)) + '</h3><p class="lead">Les comptages sont figés.</p><button class="btn" data-s="reopen">Rouvrir l’événement</button></section>';
  return '<section><div class="row-between"><h3>Consommation jour par jour</h3><button class="btn" data-s="csv">Exporter pour Excel</button></div>' +
    '<p class="lead">Consommé = début + livré − restant compté. Un « — » signale un jour pas encore compté : sa consommation est comptée le jour compté suivant.</p>' +
    '<div class="scroll"><table class="stab bil">' + head + '<tbody>' + body + '</tbody></table></div></section>' + clot;
}


/* ================= Bilan : charger depuis le serveur privé des ventes ================= */
/* Les caisses envoient leurs exports dans le dépôt privé SALES_REPO. On liste tous les .json du dépôt
   (API git/trees, récursif) et on les range par date trouvée dans le chemin (AAAA-MM-JJ). */
var SALES_REPO = DEMO_SALES_REPO;
var BGH = { open: false, loading: false, files: null, sel: {}, err: null, busy: false, tab: null };
function bghErr(e) {
  if (e && e.status === 0) return ghErrText(e);
  if (e && (e.status === 404 || e.status === 403)) return 'Le jeton n’a pas accès au dépôt ' + SALES_REPO + '. Ajoutez-le au jeton sur le serveur (voir Paramètres).';
  return ghErrText(e);
}
function bghParse(path) {
  var name = path.split('/').pop(), m = /(\d{4})-?(\d{2})-?(\d{2})/.exec(path), date = m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  var label = name.replace(/\.json$/i, '').replace(/(\d{4})-?(\d{2})-?(\d{2})/, '').replace(/^ventes/i, '').replace(/[_\-]+/g, ' ').trim();
  var parts = path.split('/'), top = parts.length > 1 ? parts[0] : '', sub = parts.length > 2 ? parts.slice(1, -1).join('/') : '';
  if (top === 'soiree') label = label.replace(/\s+[a-z0-9]{3,8}$/i, '') || label;
  return { path: path, name: name, date: date, label: label || name, dir: sub, top: top };
}
function bghOpen() {
  BGH.open = true; BGH.err = null;
  var token = getToken(); if (!token) { render(); return; }
  var B = BGH;
  B.loading = true; render();
  ghFetch('/repos/' + SALES_REPO + '/git/trees/HEAD?recursive=1', {}, token).then(function (t) {
    BGH.cxFiles = (t.tree || []).filter(function (x) { return x.type === 'blob' && /^sapin\/caisse\/.+\.json$/i.test(x.path); }).map(function (x) { return { path: x.path, sha: x.sha }; });
    return (t.tree || []).filter(function (x) { return x.type === 'blob' && /\.json$/i.test(x.path) && !/^(sapin\/)?(stock|caisse|commandes|factures|livraisons)\//.test(x.path); }).map(function (x) { var p = bghParse(x.path); p.sha = x.sha; return p; });
  }, function (e) { if (e.status === 409) return []; throw e; }).then(function (l) {
    B.loading = false; B.files = l.sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : (a.date || '') > (b.date || '') ? -1 : a.label.localeCompare(b.label); }); render();
  }, function (e) { B.loading = false; B.err = bghErr(e); B.files = []; render(); });
}
function bghRaw(path, token) {
  token = tokenFor(SALES_REPO) || token;
  return fetch('https://api.github.com/repos/' + SALES_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), { headers: { 'Accept': 'application/vnd.github.raw', 'Authorization': 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new GhError(r.status, ''); return r.text(); }, function () { throw new GhError(0, 'network'); });
}
function fileKey(p) { return p.replace(/\//g, ' › '); }
function bghLoad(paths, soiree, quiet) {
  var token = getToken(); if (!token || !paths.length) return;
  var ctx = BIL_CUR;
  BGH.busy = true; render();
  var have = {}, shaOf = {}; FILES.forEach(function (f) { have[f.name] = f.sha || 1; }); (BGH.files || []).forEach(function (f) { shaOf[f.path] = f.sha; });
  var todo = paths.filter(function (p) { var hv = have[fileKey(p)]; return !hv || (shaOf[p] && hv !== shaOf[p]); }), upd = 0;
  var skipped = 0, lastC = null;
  Promise.all(todo.map(function (p) { return bghRaw(p, token).then(function (txt) { return { p: p, txt: txt }; }); })).then(function (res) { var msg; bilWith(ctx, function () {
    res.forEach(function (r) {
      var entry = { name: fileKey(r.p), data: null, status: 'err', note: '', sha: shaOf[r.p] };
      for (var fi = FILES.length - 1; fi >= 0; fi--) if (FILES[fi].name === entry.name) { FILES.splice(fi, 1); upd++; }
      try { var d = JSON.parse(r.txt); if (okVentes(d) && bilAllowed(ctx).indexOf(caisseOf(d.format)) < 0) entry.note = bilWrongNote(caisseOf(d.format)); else if (okVentes(d)) { entry.data = d; entry.status = 'ok'; entry.caisse = caisseOf(d.format); lastC = entry.caisse; } else entry.note = ERR_FORMAT; } catch (e) { entry.note = 'Fichier illisible (JSON invalide).'; }
      if (entry.status === 'ok' || !quiet) FILES.push(entry); else skipped++;
    });
    if (lastC) F.caisse = lastC;
    dedupe(); fixCaisse(); BGH.busy = false; BGH.open = false; BGH.sel = {};
    F.soiree = defSoiree(); F.bar = 'all';
    var nb = res.length - skipped;
    msg = (nb ? nb + ' fichier' + (nb > 1 ? 's' : '') + ' chargé' + (nb > 1 ? 's' : '') + ' depuis le serveur' + (upd ? ' (dont ' + upd + ' mis à jour)' : '') : res.length ? 'Aucun fichier de ventes lisible pour ce jour' : 'Ces fichiers sont déjà chargés'); });
    toast(msg);
  }, function (e) { bilWith(ctx, function () { BGH.busy = false; BGH.err = bghErr(e); }); render(); });
}
function vGhPanel() {
  if (!BGH.open) return '';
  var h = '<section class="ghpanel"><div class="row-between"><h3>Charger les ventes du serveur</h3><button class="btn sm" data-g="close">Fermer</button></div>';
  if (!getToken()) return h + '<p class="lead">Déverrouillez l’appareil dans Paramètres pour accéder au dépôt privé.</p><button class="btn" data-a="go" data-v="parametres">Aller dans Paramètres</button></section>';
  if (BGH.err) h += '<div class="alert err">' + BGH.err + '</div>';
  if (BGH.loading) return h + '<p class="empty">Chargement de la liste…</p></section>';
  if (!BGH.files || !BGH.files.length || !bghTabs().length) return h + (BGH.err ? '' : '<p class="empty">Aucun fichier de ventes de la ' + CAISSE_LABEL[BIL_CUR] + ' sur le serveur pour l’instant.</p>') + '</section>';
  var tabs = bghTabs(); if (BGH.tab === null || tabs.indexOf(BGH.tab) < 0) BGH.tab = tabs.indexOf(BIL_CUR) >= 0 ? BIL_CUR : tabs[0];
  var days = {}, loaded = {}; BGH.files.forEach(function (f) { if (f.top !== BGH.tab) return; var k = f.date || 'sans-date'; (days[k] = days[k] || []).push(f); }); FILES.forEach(function (f) { loaded[f.name] = f.sha || true; });
  var stale = BGH.files.filter(function (f) { var g = loaded[fileKey(f.path)]; return g && g !== true && f.sha && g !== f.sha; });
  var n = Object.keys(BGH.sel).filter(function (k) { return BGH.sel[k]; }).length;
  h += '<div class="ghtabs" role="tablist" aria-label="Dossiers du serveur">' + tabs.map(function (t) {
      var c = BGH.files.filter(function (f) { return f.top === t; }).length;
      return '<button role="tab" aria-selected="' + (BGH.tab === t) + '" class="' + (BGH.tab === t ? 'on' : '') + '" data-g="tab" data-v="' + esc(t) + '">' + esc(bghTabName(t)) + ' <span class="faint num">' + c + '</span></button>';
    }).join('') + '</div>' +
    (stale.length ? '<div class="alert">' + stale.length + ' fichier' + (stale.length > 1 ? 's' : '') + ' déjà chargé' + (stale.length > 1 ? 's ont' : ' a') + ' été modifié' + (stale.length > 1 ? 's' : '') + ' sur le serveur depuis (livraison ajoutée, caisse comptée après coup…). <button class="btn sm" data-g="refresh">Recharger ' + (stale.length > 1 ? 'ces fichiers' : 'ce fichier') + '</button></div>' : '') +
    '<p class="lead">' + (BGH.tab === 'bar' ? 'Une soirée qui dépasse minuit est répartie sur deux jours : « Charger les ventes » prend le jour et le lendemain.' : BGH.tab === 'soiree' ? 'Un fichier par appareil et par soirée : « Charger les ventes » charge tous les appareils de la soirée.' : '« Charger les ventes » charge les fichiers du jour.') + '</p><div class="ghdays">' +
    Object.keys(days).sort().reverse().map(function (d) {
      return '<div class="ghday"><div class="ghdate"><strong>' + (d === 'sans-date' ? 'Sans date' : longDate(d)) + '</strong>' + (d === 'sans-date' ? '' : '<button class="btn sm" data-g="soiree" data-v="' + d + '">Charger les ventes</button>') + '</div>' +
        days[d].slice().sort(function (a, b) { return a.label.localeCompare(b.label); }).map(function (f) { var g0 = loaded[fileKey(f.path)], old = g0 && g0 !== true && f.sha && g0 !== f.sha, got = g0 && !old;
          return '<label class="tog' + (got ? ' got' : '') + '" title="' + esc(f.path) + '"><input type="checkbox" data-gsel="' + esc(f.path) + '"' + (got ? ' checked disabled' : BGH.sel[f.path] ? ' checked' : '') + '>' + esc(f.label) + (f.dir ? ' <span class="faint">' + esc(f.dir) + '</span>' : '') + (got ? ' <span class="faint">déjà chargé</span>' : old ? ' <span class="warnt">modifié sur le serveur</span>' : '') + '</label>'; }).join('') + '</div>';
    }).join('') + '</div>' +
    '<div class="cbtns" style="margin-top:14px"><button class="pick" data-g="loadSel"' + (n && !BGH.busy ? '' : ' disabled') + '>' + (BGH.busy ? 'Chargement…' : 'Charger la sélection' + (n ? ' (' + n + ')' : '')) + '</button></div></section>';
  return h;
}
function bghSoireePaths(d) { var nx = BGH.tab === 'bar' ? addDays(d, 1) : d; return (BGH.files || []).filter(function (f) { return f.top === BGH.tab && (f.date === d || f.date === nx); }).map(function (f) { return f.path; }); }
/* Onglets = dossier parent (1er niveau) des fichiers : bar, sapin… ; fichiers à la racine -> « Autres » */
function bghTabs() { var o = {}; (BGH.files || []).forEach(function (f) { if (BIL_CUR === 'bar' ? (f.top === 'bar' || f.top === '') : f.top === BIL_CUR) o[f.top] = 1; }); var order = ['bar', 'sapin', 'soiree']; return Object.keys(o).sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)); }); }
function bghTabName(t) { if (t === 'sapin') return 'Ventes'; if (t === 'soiree') return 'Soirée'; return t === '' ? 'Autres' : t.charAt(0).toUpperCase() + t.slice(1).replace(/[_-]+/g, ' '); }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-g]'); if (!b || b.disabled) return;
  var g = b.getAttribute('data-g'), v = b.getAttribute('data-v');
  if (g === 'open') bghOpen();
  else if (g === 'close') { BGH.open = false; render(); }
  else if (g === 'tab') { BGH.tab = v; render(); }
  else if (g === 'refresh') { var ld = {}; FILES.forEach(function (f) { ld[f.name] = f.sha; }); bghLoad((BGH.files || []).filter(function (f) { var s0 = ld[fileKey(f.path)]; return s0 && f.sha && s0 !== f.sha; }).map(function (f) { return f.path; })); }
  else if (g === 'loadSel') bghLoad(Object.keys(BGH.sel).filter(function (k) { return BGH.sel[k]; }));
  else if (g === 'soiree') bghLoad(bghSoireePaths(v), v, true);
});
document.addEventListener('change', function (e) {
  if (e.target.hasAttribute('data-gsel')) { BGH.sel[e.target.getAttribute('data-gsel')] = e.target.checked; var n = Object.keys(BGH.sel).filter(function (k) { return BGH.sel[k]; }).length, b = document.querySelector('[data-g=loadSel]'); if (b) { b.disabled = !n; b.textContent = 'Charger la sélection' + (n ? ' (' + n + ')' : ''); } }
});

/* ---------- Événements ---------- */
/* Après chaque saisie : recalcul de toutes les lignes du jour (début, consommé, alerte stock bas) */
function stkSoftRow() {
  if (!STK.cur) return;
  var d = STK.cur.doc, calc = stkCalc(d), di = calc.days.indexOf(STK.day); if (di < 0) return;
  var lastFlag = isLastDay(d, STK.day);
  d.articles.forEach(function (a) {
    var tr = document.getElementById('row-' + a.id); if (!tr || !calc.per[a.id]) return;
    var r = calc.per[a.id][di], cell = tr.querySelector('[data-k=conso]'), deb = tr.querySelector('[data-k=debut]');
    if (cell) { cell.innerHTML = vConsoCell(r); cell.classList.toggle('neg', r.conso != null && r.conso < -0.001); }
    if (deb) deb.textContent = fmtQ(r.debut);
    var low = lastFlag ? null : lowAlert(calc.per[a.id], di), lb = tr.querySelector('[data-k=low]'); tr.classList.toggle('low', low != null); if (lb) lb.innerHTML = lowBadge(low);
  });
  var p = dayProgress(d, STK.day), pe = document.getElementById('dayProg'); if (pe) pe.textContent = p.n + ' / ' + p.tot + ' comptés';
}
function stkCsv() {
  var d = STK.cur.doc, calc = stkCalc(d), rows = [['Catégorie', 'Article', 'Unité', 'Départ', 'Livré'].concat(calc.days.map(function (x) { return 'Consommé ' + dmy(x); })).concat(['Total consommé', 'Restant'])];
  d.articles.forEach(function (a) { var r = calc.per[a.id]; rows.push([a.categorie || '', a.nom, a.unite || '', +(d.stockInitial[a.id] || 0), r.reduce(function (s, x) { return s + x.liv; }, 0)].concat(r.map(function (x) { return x.conso == null ? '' : x.conso; })).concat([r.reduce(function (s, x) { return s + (x.conso || 0); }, 0), calc.fin[a.id]])); });
  download('stock_' + d.id + '.csv', rows); toast('Fichier pour Excel téléchargé');
}
function stkClick(el) {
  var s = el.getAttribute('data-s'), v = el.getAttribute('data-v'), c = STK.cur;
  if (s === 'new') { STK.view = 'new'; STK.newForm = null; render(); return; }
  if (s === 'back') { if (c && c.ops.length && !c.demo) saveCur(); STK.view = 'list'; STK.cur = null; STK.msg = null; render(); return; }
  if (s === 'reloadList') { STK.list = null; STK.err = null; stkLoadList(); return; }
  if (s === 'demo') { STK.cur = { id: 'exemple', demo: true, remote: demoEvent(), ops: [], sha: null }; STK.cur.doc = curDoc(); STK.view = 'event'; STK.tab = 'jour'; STK.day = '2026-10-18'; STK.msg = null; STK.confirm = null; render(); window.scrollTo(0, 0); return; }
  if (s === 'open') { STK.msg = null; stkOpen(v); return; }
  if (s === 'export') { if (c) stkExportOne(c.id); return; }
  if (s === 'exportAll') { stkExportAll(); return; }
  if (s === 'impSkip') { STK.imp.shift(); render(); return; }
  if (s === 'impReplace') { var di = STK.imp.shift(); if (di) { stkImportReplace(di); STK.msg = { t: '« ' + esc(di.nom) + ' » remplacé par le fichier' + (getToken() ? ' : ouvrez-le pour l’enregistrer sur le serveur.' : ' (enregistré sur le serveur après déverrouillage).') }; } render(); return; }
  if (s === 'askDel') { STK.confirm = { type: 'del', id: v }; render(); return; }
  if (s === 'del') { stkDelete(v); return; }
  if (s === 'tab') { STK.tab = v; STK.confirm = null; STK.msg = null; render(); return; }
  if (s === 'day') { STK.day = v; render(); return; }
  if (s === 'addDay') { addOp({ t: 'day', d: v }); STK.day = v; render(); return; }
  if (s === 'addOther') { var o = document.getElementById('otherDay').value, ld = lastDayOf(c.doc); if (!o) { toast('Choisissez une date'); return; } if (ld && o > ld) { toast('Impossible : le dernier jour est le ' + dmy(ld)); return; } addOp({ t: 'day', d: o }); STK.day = o; render(); return; }
  if (s === 'delDay') { addOp({ t: 'delday', d: v }); STK.day = null; render(); return; }
  if (s === 'plus') { qtyPlusOpen(v); return; }
  if (s === 'save') { if (c) { c.err = null; saveCur(); } return; }
  if (s === 'addArt') { var t = {}; c.doc.articles.forEach(function (a) { t[a.id] = 1; }); var id = uid('a', t), last = c.doc.articles[c.doc.articles.length - 1];
    addOp({ t: 'art', v: { id: id, nom: '', unite: last ? last.unite : 'bouteilles', categorie: last ? last.categorie : '', actif: true } }); render(); var f = document.getElementById('an-' + id); if (f) f.focus(); return; }
  if (s === 'askClose') { STK.confirm = 'close'; render(); return; }
  if (s === 'cancel') { if (STK.deleting) return; STK.confirm = null; render(); return; }
  if (s === 'close') { addOp({ t: 'meta', k: 'statut', v: 'cloture' }); addOp({ t: 'meta', k: 'clotureLe', v: new Date().toISOString() }); STK.confirm = null; saveCur(); STK.msg = { ok: true, t: 'Événement clôturé. Le bilan ci-dessous est définitif.' }; render(); return; }
  if (s === 'reopen') { addOp({ t: 'meta', k: 'statut', v: 'ouvert' }); addOp({ t: 'meta', k: 'clotureLe', v: null }); saveCur(); STK.msg = { t: 'Événement rouvert.' }; render(); return; }
  if (s === 'csv') { stkCsv(); return; }
}
function stkInput(el) {
  var c = STK.cur; if (!c) return;
  var f = el.getAttribute('data-sf') || el.getAttribute('data-sa'), aid = el.getAttribute('data-v');
  if (el.hasAttribute('data-sf')) {
    var q = parseQ(el.value); el.classList.toggle('bad', q !== null && (isNaN(q) || q < 0)); if (q !== null && (isNaN(q) || q < 0)) return;
    addOp({ t: 'set', p: ['jours', STK.day, f === 'liv' ? 'livraisons' : 'restant', aid], v: f === 'liv' && q === 0 ? null : q });
    var pb = el.parentNode && el.parentNode.querySelector('.qplus'); if (pb) pb.hidden = el.value.trim() === '';
    stkSoftRow(aid); return;
  }
  if (f === 'init') { var qi = parseQ(el.value); el.classList.toggle('bad', qi !== null && (isNaN(qi) || qi < 0)); if (qi !== null && (isNaN(qi) || qi < 0)) return; addOp({ t: 'set', p: ['stockInitial', aid], v: qi || null }); return; }
  var a = clone(c.doc.articles.filter(function (x) { return x.id === aid; })[0]); if (!a) return;
  if (f === 'actif') { a.actif = el.checked; el.closest('tr').classList.toggle('off', !el.checked); } else a[f] = el.value;
  addOp({ t: 'art', v: a });
}
function stkDelete(id) {
  var c = STK.cur, d = (c && c.id === id ? c.doc : STK.docs[id]) || {};
  if (d.statut !== 'cloture') { STK.confirm = null; STK.msg = { err: true, t: 'Seul un événement clôturé peut être supprimé.' }; render(); return; }
  if (c && c.demo) { STK.view = 'list'; STK.cur = null; STK.confirm = null; toast('Exemple supprimé'); return; }
  var token = getToken(); if (!token) return;
  STK.deleting = true; STK.err = null; render();
  ghGetFile(stkPath(id), token).then(function (r) {
    if (!r) return null;
    if (r.json.statut !== 'cloture') throw { custom: 'Cet événement a été rouvert sur une autre tablette : il ne peut plus être supprimé.' };
    return ghFetch('/repos/' + DATA_REPO + '/contents/' + stkPath(id), { method: 'DELETE', body: JSON.stringify({ message: 'Stock ' + (d.nom || id) + ' (suppression)', sha: r.sha }) }, token);
  }).then(function () {
    STK.deleting = false; STK.confirm = null; delete STK.docs[id]; lsSet(opsKey(id), null); clearTimeout(STK.timer);
    STK.view = 'list'; STK.cur = null; STK.msg = null;
    STK.list = (STK.list || []).filter(function (x) { return x.id !== id; });
    toast('« ' + (d.nom || id) + ' » supprimé');
  }, function (e) {
    STK.deleting = false; STK.confirm = null;
    var t = e && e.custom ? e.custom : e && (e.status === 409 || e.status === 422) ? 'L\u2019événement vient d\u2019être modifié sur une autre tablette. Rechargez-le puis recommencez.' : e && e.status === 0 ? ghErrText({ status: 0 }) : stkErr(e);
    if (STK.view === 'event') STK.msg = { err: true, t: t }; else STK.err = t;
    render();
  });
}
function stkSubmitNew() {
  var nom = document.getElementById('evNom').value.trim(), debut = document.getElementById('evDebut').value, fromEl = document.getElementById('evFrom'), from = fromEl ? fromEl.value : '', carry = document.getElementById('evCarry') ? document.getElementById('evCarry').checked : false;
  STK.newForm = { nom: nom, debut: debut, from: from, carry: carry };
  if (!nom || !debut) { toast('Indiquez le nom et le premier jour'); return; }
  var id = slug(nom, 32) + '-' + debut, taken = (STK.list || []).some(function (d) { return d.id === id; });
  if (taken) { toast('Un événement avec ce nom et cette date existe déjà'); return; }
  var doc = { format: 'admin/stock', formatVersion: 1, id: id, nom: nom, debut: debut, statut: 'ouvert', creeLe: new Date().toISOString(), articles: [], stockInitial: {}, jours: {} };
  if (from && STK.docs[from]) { var src = STK.docs[from], fin = stkCalc(src).fin; doc.articles = clone(src.articles); if (carry) src.articles.forEach(function (a) { if (fin[a.id]) doc.stockInitial[a.id] = fin[a.id]; }); }
  STK.cur = { id: id, remote: doc, sha: null, ops: [], isNew: true, saving: false }; STK.cur.doc = curDoc(); persistCur();
  STK.view = 'event'; STK.tab = 'articles'; STK.day = null; STK.msg = { ok: true, t: 'Événement créé. Vérifiez les articles et le stock de départ, puis passez au comptage du jour.' };
  render(); saveCur();
}
document.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (b && !b.disabled) stkClick(b); });
document.addEventListener('input', function (e) { if (e.target.id === 'stkQ') { STK.q = e.target.value; applyStkFilter(); return; } if ((e.target.hasAttribute('data-sf') || e.target.hasAttribute('data-sa')) && e.target.type !== 'checkbox') stkInput(e.target); });
document.addEventListener('change', function (e) {
  if (e.target.id === 'stkLast' && STK.cur && STK.day) { addOp({ t: 'set', p: ['jours', STK.day, 'dernier'], v: e.target.checked ? true : null }); render(); return; }
  if (e.target.hasAttribute('data-sf')) { stkInput(e.target); return; }
  if (e.target.id === 'stkTodo' || e.target.id === 'stkLow') { STK[e.target.id === 'stkTodo' ? 'onlyTodo' : 'onlyLow'] = e.target.checked; applyStkFilter(); return; } if (e.target.hasAttribute('data-sa') && e.target.type === 'checkbox') stkInput(e.target); });
document.addEventListener('submit', function (e) { if (e.target.closest('[data-s-form]')) { e.preventDefault(); stkSubmitNew(); } });
window.addEventListener('online', function () { if (STK.cur && STK.cur.ops.length) saveCur(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && STK.cur && STK.cur.ops.length) saveCur(); });
function stkHomeStatus() { var lp = stkLocal().filter(function (x) { return x.isNew; }).length; if (lp) return lp + ' événement' + (lp > 1 ? 's' : '') + ' pas encore sur le serveur'; if (!getToken()) return 'Déverrouillez l’appareil pour l’utiliser'; if (!STK.list) return 'Comptage quotidien par événement'; var o = STK.list.filter(function (d) { return d.statut !== 'cloture'; }).length; return o + ' événement' + (o > 1 ? 's' : '') + ' en cours'; }

/* ---------- Événements ---------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]'); if (!el) return;
  var a = el.getAttribute('data-a'), v = el.getAttribute('data-v');
  if (a === 'go') { go(v); return; }
  if (a === 'sub') { var sp = v.split('/'); SUB[sp[0]] = sp[1]; go(sp[0]); return; }
  if (a === 'demo') { FILES = demoFiles().map(function (f) { return { name: f.name, data: f.data, status: 'ok', note: '', caisse: 'bar' }; }); F.caisse = 'bar'; dedupe(); F.soiree = defSoiree(); F.bar = 'all'; toast('Exemples chargés : 2 bars, 1 soirée'); return; }
  if (a === 'cdet') { CAISSE_OPEN[v] = !CAISSE_OPEN[v]; render(); return; }
  if (a === 'caisse') { F.caisse = v; F.bar = 'all'; F.soiree = defSoiree(); render(); return; }
  if (a === 'soiree') F.soiree = v;
  else if (a === 'bar') F.bar = v;
  else if (a === 'artview') ART_VIEW = v;
  else if (a === 'rm') { FILES.splice(+v, 1); dedupe(); if ((soirees().indexOf(F.soiree) < 0 && F.soiree !== 'all') || (F.soiree === 'all' && soirees().length < 2)) F.soiree = defSoiree(); if (F.bar !== 'all' && !bars().some(function (b) { return b.id === F.bar; })) F.bar = 'all'; }
  else if (a === 'clear') { FILES = []; F = { soiree: null, bar: 'all', caisse: null }; DISMISSED = {}; }
  else if (a === 'dismiss') { var sw = shownWarnings()[+v]; if (sw) DISMISSED[sw.t] = 1; }
  else if (a === 'dismissAll') { shownWarnings().forEach(function (x) { DISMISSED[x.t] = 1; }); }
  else if (a === 'print') { window.print(); return; }
  else if (a === 'csv') { exportCsv(); return; }
  else if (a === 'theme') { var t = isDark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (er) {} }
  render();
});
document.addEventListener('change', function (e) { if (e.target.hasAttribute('data-files')) { addFiles(e.target.files); e.target.value = ''; } });
function bindDrop() {
  var z = document.getElementById('drop'); if (!z) return;
  ['dragenter', 'dragover'].forEach(function (t) { z.addEventListener(t, function (e) { e.preventDefault(); z.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { z.addEventListener(t, function (e) { e.preventDefault(); z.classList.remove('over'); }); });
  z.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
}
/* Glisser des fichiers n'importe où sur la page */
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); if (curSub() === 'bilan' && !e.target.closest('#drop') && e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
render();

;

if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
