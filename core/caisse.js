/* caisse · caisse · v17 — code commun à tous les amis */
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
var SOIREE = CLIENT.type === 'soiree'; // caisse complexe : Caisse Soirée + Admin de la soirée (pas de caisse simple)
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
    { id: 'stockEvenement', nom: 'Comptage du stock d’événement', desc: 'Stock de départ, livraisons et restant compté chaque jour, alerte de stock bas.', off: true } ] }
];
var FEAT_DEF = {}; FEATURES.forEach(function (g) { g.items.forEach(function (it) { FEAT_DEF[it.id] = it; }); });
var _featRaw = null, _featCfg = { f: {}, raccourciId: '' };
function featCfg() {
  var raw = null; try { raw = localStorage.getItem(FEAT_KEY); } catch (e) {}
  if (raw !== _featRaw) { _featRaw = raw; try { _featCfg = JSON.parse(raw) || {}; } catch (e) { _featCfg = {}; } if (!_featCfg.f) _featCfg.f = {}; }
  return _featCfg;
}
function featOwn(id) { var c = featCfg(), d = FEAT_DEF[id]; if (c.f[id] != null) return !!c.f[id]; return !(d && d.off); }
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
  { id: 'ardoise', nom: 'Ardoise', couleur: '#5B8DEF', accent: '#F2B64C', fond: '', barre: '', tuile: '', police: 'moderne', policeTitres: 'moderne', forme: 'arrondi', ombre: false },
  { id: 'lounge', nom: 'Lounge', couleur: '#D4A657', accent: '#9B6FD0', fond: '', barre: '', tuile: '', police: 'moderne', policeTitres: 'elegante', forme: 'carre', ombre: true },
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
  } else {
    css += 'body,button,input,select,textarea{font-family:' + F + '}h1,h2,h3{font-family:' + FT + '}';
    /* Caisse Soirée (toujours sombre) : fond d'écran sur la page d'accueil, voile sombre */
    if (t.fondImage) css += '.home{background-image:linear-gradient(rgba(0,0,0,' + (t.voile / 100) + '),rgba(0,0,0,' + (t.voile / 100) + ')),url("' + t.fondImage + '");background-size:cover;background-position:center}';
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

var APP_VERSION = 'v17'; // à monter en même temps que le cache de sw.js
var STORE_KEY = KP + 'caisse'; // propre à chaque caisse (même compte GitHub = même mémoire navigateur)
(function () {
'use strict';
var LOGO_FULL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iMjIwIiB2aWV3Qm94PSIwIDAgOTAwIDIyMCI+PHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSIyMjAiIGZpbGw9IiNmZmYiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0MCwxMCkgc2NhbGUoMikiPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxyZWN0IHg9IjE0IiB5PSI0MCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjQ0IiByeD0iOCIvPjxwYXRoIGQ9Ik0yNiA0MFYyMmg0OHYxOCIvPjxwYXRoIGQ9Ik0zNCAzMGgzMiIvPjxwYXRoIGQ9Ik0yOCA1OGgxMk00OCA1OGgxMk0yOCA3MGgxMk00OCA3MGgxMiIvPjxwYXRoIGQ9Ik02OCA1OGg2djEyaC02eiIvPjwvZz48L2c+PHRleHQgeD0iMjcwIiB5PSIxMjgiIGZvbnQtZmFtaWx5PSJBcmlhbCxIZWx2ZXRpY2Esc2Fucy1zZXJpZiIgZm9udC1zaXplPSI4NCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzAwMCI+Q2Fpc3NlIETDqW1vPC90ZXh0Pjx0ZXh0IHg9IjI3NCIgeT0iMTc4IiBmb250LWZhbWlseT0iQXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZpbGw9IiMwMDAiPlZvdHJlIGNvbW1lcmNlPC90ZXh0Pjwvc3ZnPg==';
var LOGO_TEXT = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MjAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgNDIwIDEwMCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCwwKSI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMkY1RDhBIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+PHJlY3QgeD0iMTQiIHk9IjQwIiB3aWR0aD0iNzIiIGhlaWdodD0iNDQiIHJ4PSI4Ii8+PHBhdGggZD0iTTI2IDQwVjIyaDQ4djE4Ii8+PHBhdGggZD0iTTM0IDMwaDMyIi8+PHBhdGggZD0iTTI4IDU4aDEyTTQ4IDU4aDEyTTI4IDcwaDEyTTQ4IDcwaDEyIi8+PHBhdGggZD0iTTY4IDU4aDZ2MTJoLTZ6Ii8+PC9nPjwvZz48dGV4dCB4PSIxMDQiIHk9IjY2IiBmb250LWZhbWlseT0iQXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDQiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMyRjVEOEEiPkNhaXNzZSBEw6ltbzwvdGV4dD48L3N2Zz4=';

/* ---------- Catalogue ---------- */
var CAT_KEY = KP + 'caisse-catalogue'; // propre à chaque caisse
// Anciennes données des versions v9-v12 (articles ajoutés, articles désactivés, prix modifiés sur l'appareil) : plus utilisées, effacées
['-ajouts', '-desactives', '-prix'].forEach(function (k) { try { localStorage.removeItem(STORE_KEY + k); } catch (e) {} });

/* Livraison : article du catalogue dont le libellé est « Livraison » (ou « Frais de livraison »), dans n'importe quelle
   catégorie (par exemple une catégorie « Services »). Il n'apparaît pas dans les tuiles : bouton « Livraison » dans le
   panier (à côté de « Remise ticket »), une seule fois par vente ; aussi depuis l'Historique (livraison après coup). Sans cet article dans le catalogue, le bouton est masqué. */
function isDeliveryLabel(t) { if (!FEAT('livraison')) return false; var s = slug(t); return s === 'livraison' || s === 'frais-de-livraison'; }
function deliveryProduct() { if (!FEAT('livraison')) return null;
  var r = null;
  if (CATALOGUE) CATALOGUE.categories.forEach(function (k) { k.produits.forEach(function (p) { if (!r && isDeliveryLabel(p.libelle)) r = { p: p, cat: k }; }); });
  return r;
}
/* Raccourci à côté des onglets (à la place de « + Article libre », qui passe dans le menu ⋮) : un article du catalogue,
   désigné par son identifiant. S'il est absent ou désactivé dans le catalogue, le bouton « + Article libre » revient à sa place. */
var RACCOURCI_ID = ''; // réglé dans Admin › Paramètres › Fonctionnalités (raccourciId)
/* Remises (sur une ligne ou sur le ticket) : désactivées sur les tablettes (remises réservées aux responsables). true = réactiver. */
var REMISES = false;
/* Remise ticket par le menu ⋮, protégée par un code à 4 chiffres. Seule l'empreinte SHA-256 de
   'agri-garden-remise:<code>' est dans le code (jamais le code en clair). Pour changer le code : recalculer l'empreinte. */
var REMISE_CODE_SHA = '2c181bcaafc0b2945b26b125ec66928c87a4d35c5a087ed1bd6c337dbfac87dc'; // démo : code 1234
function sha256Hex(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
/* Livraison : nom, adresse et téléphone obligatoires (ticket vendeur à joindre à la marchandise).
   Facture : société, adresse, TVA, e-mail ; payée au stand ou non (vente « à facturer », sans encaissement). */
function livValid(x) { return !!(x && (x.nom || '').trim() && (x.adresse || '').trim() && (x.telephone || '').replace(/\D/g, '').length >= 8); }
function facValid(x) { return !!(x && (x.societe || '').trim() && (x.adresse || '').trim() && (x.tva || '').trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((x.email || '').trim())); }
function unpaid(v) { return !!(v && v.facture && v.facture.payee === false); }
function dueOf(v) { return r2(Math.max(0, v.total - (Number(v.paiement.cash) || 0) - (Number(v.paiement.bancontact) || 0))); }
function cartHasDelivery() { return S.cart.some(function (l) { return isDeliveryId(l.produitId); }); }
function shortcutProduct() {
  var r = null;
  var RACCOURCI_ID = FEAT('raccourci') ? featCfg().raccourciId : '';
  if (CATALOGUE && RACCOURCI_ID) visibleCats().forEach(function (k) { k.produits.forEach(function (p) { if (!r && p.id === RACCOURCI_ID) r = p; }); });
  return r;
}
function isDeliveryId(pid) { var d = deliveryProduct(); return !!(d && pid && d.p.id === pid); }
function visibleCats() {
  return CATALOGUE.categories.map(function (k) {
    return Object.assign({}, k, { produits: k.produits.filter(function (p) { return !isDeliveryLabel(p.libelle); }) });
  }).filter(function (k) { return k.produits.length; });
}


// Vérifie un catalogue et le prépare pour la caisse (filtre "actif", trie par "ordre").
function normalizeCatalogue(c) {
  if (!c || typeof c !== 'object') throw new Error('Le fichier ne contient pas un catalogue.');
  if (c.format && c.format !== 'agri-garden-caisse/catalogue') throw new Error('Ce fichier n’est pas un catalogue (format « ' + c.format + ' »).');
  if (!Array.isArray(c.pointsDeVente) || !Array.isArray(c.categories)) throw new Error('Il manque la liste des points de vente ou des catégories.');
  var ids = {};
  function byOrder(a, b) { return (a.ordre || 0) - (b.ordre || 0); }
  function active(x) { return x && x.actif !== false; }
  var pdv = c.pointsDeVente.filter(active).map(function (p) {
    if (!p.id || !p.nom) throw new Error('Un point de vente n’a pas d’identifiant ou de nom.');
    return { id: String(p.id), nom: String(p.nom) };
  });
  var cats = c.categories.filter(active).slice().sort(byOrder).map(function (k) {
    if (!k.id || !k.nom || !Array.isArray(k.produits)) throw new Error('Catégorie incomplète : ' + (k.nom || k.id || '?'));
    var prods = k.produits.filter(active).slice().sort(byOrder).map(function (p) {
      if (!p.id || !p.libelle) throw new Error('Produit sans identifiant ou libellé dans « ' + k.nom + ' ».');
      if (typeof p.prix !== 'number' || p.prix < 0) throw new Error('Prix invalide pour « ' + p.libelle + ' ».');
      if (ids[p.id]) throw new Error('Identifiant de produit en double : ' + p.id);
      ids[p.id] = true;
      return { id: String(p.id), libelle: String(p.libelle), prix: p.prix };
    });
    return { id: String(k.id), nom: String(k.nom), prefixe: FEAT('prefixe') && k.prefixe !== false, produits: prods };
  }).filter(function (k) { return k.produits.length; });
  if (!pdv.length) throw new Error('Aucun point de vente actif.');
  if (!FEAT('multiPdv')) pdv = pdv.slice(0, 1);
  return { version: Number(c.version) || 0, date: String(c.date || ''), exemple: !!c.exemple, pointsDeVente: pdv, categories: cats };
}
var CATALOGUE;
try { CATALOGUE = normalizeCatalogue(JSON.parse(localStorage.getItem(CAT_KEY))); } catch (e) { CATALOGUE = null; }
function frDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; }
function catalogueLabel(c) { if (!c) return 'Aucun catalogue installé'; return c.exemple ? 'Catalogue d’exemple' : 'Catalogue v' + c.version + (c.date ? ' du ' + frDate(c.date) : ''); }
function countProducts(c) { return c.categories.reduce(function (a, k) { return a + k.produits.length; }, 0); }

var BILLS = [5, 10, 20, 50, 100];
// (STORE_KEY est déclarée en tout début de script)

/* ---------- Outils ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function money(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }
function num(v) { var x = parseFloat(String(v || '').replace(',', '.')); return isNaN(x) ? 0 : x; }
function r2(n) { return Math.round(n * 100) / 100; }
function up5(x) { if (!FEAT('arrondi')) return Math.round(x * 100) / 100; var c = Math.round(x * 100); return Math.max(0, Math.ceil(c / 5) * 5) / 100; }
function applyDisc(base, d) { if (!d || !d.val) return base; var r = d.type === '%' ? base * (1 - d.val / 100) : base - d.val; return up5(Math.max(0, r)); }
function discText(d) { return d.type === '%' ? '−' + String(d.val).replace('.', ',') + ' %' : '−' + money(d.val); }
function jsonDisc(d) { return d ? { type: d.type === '%' ? 'pourcentage' : 'montant', valeur: d.val } : null; }
function fromJsonDisc(d) { return d ? { type: d.type === 'pourcentage' ? '%' : '€', val: d.valeur } : null; }
function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function isoLocal(d) { var o = -d.getTimezoneOffset(), sg = o >= 0 ? '+' : '-'; o = Math.abs(o); return isoDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + sg + pad(Math.floor(o / 60)) + ':' + pad(o % 60); }
function slug(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function findPlace(id) { if (!CATALOGUE) return null; return CATALOGUE.pointsDeVente.filter(function (p) { return p.id === id; })[0] || null; }

/* ---------- État ---------- */
var S = {
  screen: 'home', tab: 'caisse', menu: false, placeId: null, pending: null, openedDate: null,
  cat: CATALOGUE && CATALOGUE.categories.length ? CATALOGUE.categories[0].id : null, cart: [], ticketDisc: null, cartLiv: null, cartFac: null, modal: null,
  discTarget: null, discType: '%', discVal: '', freeLabel: '', freePrice: '',
  payMode: null, received: '', mix: '', days: {}, tiroir: {}, caisse: {}, fondLater: {}, cc: {}, ccMode: 'total', cxMontant: '', cxLaisse: '', toast: '', exported: {}, usedPct: 0, confirmDel: null, cartOpen: false
};
// Mémoire locale (simule le fichier de la tablette)
try {
  var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved) {
    S.placeId = saved.placeId || null;
    S.openedDate = saved.openedDate || null;
    // Ventes par jour : { "AAAA-MM-JJ": [ventes] } (reprise de l'ancien format à un seul jour)
    S.days = saved.days || {};
    S.exported = saved.exported || {};
    S.tiroir = saved.tiroir || {};
    S.caisse = saved.caisse || {};
    if (saved.sales && saved.sales.length && saved.salesDate && !S.days[saved.salesDate]) S.days[saved.salesDate] = saved.sales;
  }
} catch (e) {}
/* Mémoire de l'appareil : ~5 millions de caractères pour toute l'adresse <compte>.github.io (partagée entre les caisses) */
var STORAGE_LIMIT = 5000000;
function storageUsed() { var n = 0; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {} return n; }
function storageMo(n) { return (n / 1000000).toFixed(1).replace('.', ',') + ' Mo'; }
function refreshUsage() { S.usedPct = Math.round(storageUsed() * 100 / STORAGE_LIMIT); }
function persist(noSync) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ placeId: S.placeId, days: S.days, openedDate: S.openedDate, exported: S.exported, tiroir: S.tiroir, caisse: S.caisse }));
    refreshUsage();
    if (!noSync && typeof autoSchedule === 'function') autoSchedule(AUTO_DELAI); // modification : envoi automatique un peu plus tard
    return true;
  } catch (e) { S.modal = 'storage'; S.menu = false; refreshUsage(); return false; }
}

function lineTotal(l) { return applyDisc(l.price * l.qty, l.disc); }
function subtotal() { return S.cart.reduce(function (a, l) { return a + lineTotal(l); }, 0); }
function total() { return applyDisc(up5(subtotal()), S.ticketDisc); }
function payTotal() { return S.cmdPay ? S.cmdPay.reste : total(); }
function today() { return isoDate(new Date()); }
function validSales(list) { return (list || []).filter(function (v) { return !v.annulation; }); }
function salesOf(date) { return S.days[date || today()] || []; }
function placeOf(date) {
  var s = salesOf(date);
  if (s.length && s[0].pointDeVente) return s[0].pointDeVente;
  var p = findPlace(S.placeId); return p ? { id: p.id, nom: p.nom } : null;
}
function fileName(date) { var p = placeOf(date); return 'ventes_' + (date || today()) + '_' + slug(p ? p.nom : '') + '.json'; }

function dayFile(date) {
  date = date || today();
  var all = salesOf(date), sales = validSales(all);
  return {
    format: 'agri-garden-caisse/ventes', formatVersion: 1, date: date,
    pointDeVente: placeOf(date),
    catalogueVersion: CATALOGUE ? CATALOGUE.version : null, miseAJour: isoLocal(new Date()),
    nombreVentes: sales.length,
    nombreAnnulations: all.length - sales.length,
    totalJournee: r2(sales.reduce(function (a, v) { return a + v.total; }, 0)),
    totalCash: r2(sales.reduce(function (a, v) { return a + v.paiement.cash; }, 0)),
    totalBancontact: r2(sales.reduce(function (a, v) { return a + v.paiement.bancontact; }, 0)),
    totalNonPaye: r2(sales.reduce(function (a, v) { return a + (unpaid(v) ? dueOf(v) : 0); }, 0)),
    nombreAFacturer: sales.filter(function (v) { return !!v.facture; }).length,
    totalPayeALaCommande: r2(sales.reduce(function (a, v) { return a + (v.commande ? Number(v.commande.dejaPaye) || 0 : 0); }, 0)),
    ouverturesTiroir: S.tiroir[date] || [],
    nombreOuverturesSansVente: (S.tiroir[date] || []).filter(function (o) { return !o.venteId; }).length,
    caisse: cxExport(date),
    ventes: all
  };
}


var GH_REPO = DEMO_SALES_REPO;          // ex. 'scraper147/ventes' (dépôt privé dédié aux ventes) ; vide = fonction masquée
var GH_DOSSIER = 'sapin';  // dossier de cette caisse dans le dépôt des ventes (ex. 'bar', 'sapin')
var CLE_CHIFFREE = { demo: true }; // démo : pas de jeton, les envois vont au serveur local   // clé chiffrée des caisses (app admin > Préparer la clé chiffrée) ; null = fonction masquée
var GH_KEY = STORE_KEY + '-github';
var GH = {};
try { GH = JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch (e) { GH = {}; }
if (!GH.appareil) GH.appareil = Math.random().toString(36).slice(2, 6);
if (!GH.envois) GH.envois = {};
if (!GH.token) GH.token = 'demo';
function saveGh() { try { localStorage.setItem(GH_KEY, JSON.stringify(GH)); return true; } catch (e) { return false; } }
function ghConfigured() { return !!(GH_REPO && CLE_CHIFFREE); }
function ghReady() { return ghConfigured() && !!GH.token; }
function normPass(p) { return String(p || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase(); }
function b64d(str) { var s = atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function decryptToken(blob, pass) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(normPass(pass)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(blob.salt), iterations: blob.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, k, b64d(blob.data)); })
    .then(function (pt) { return new TextDecoder().decode(pt).trim(); });
}
function ghApi(method, url, token, body) {
  return fetch('https://api.github.com' + url, { method: method, cache: 'no-store',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined });
}
function ghError(status) {
  if (status === 0) return 'Pas de connexion internet. Réessayez quand la tablette a du réseau.';
  if (status === 401) return 'GitHub refuse le jeton : il a expiré ou a été révoqué. Une nouvelle clé doit être installée dans la caisse.';
  if (status === 403) return 'Accès refusé : le jeton n\u2019a pas le droit d\u2019écrire dans le dépôt des ventes.';
  if (status === 404) return 'Dépôt des ventes introuvable, ou le jeton n\u2019y a pas accès.';
  if (status === 422) return 'GitHub a refusé le fichier.';
  return 'Erreur GitHub (code ' + status + ').';
}
function b64utf8(s) { return btoa(unescape(encodeURIComponent(s))); }
/* bar/AAAA-MM-JJ_<point de vente>_<nom du point de vente>_<appareil>.json : l'appareil est dans le nom, pas d'écrasement entre tablettes */
function ghPath(date) {
  var pl = placeOf(date) || {};
  return GH_DOSSIER + '/' + date + '_' + (slug(pl.id || 'pdv').slice(0, 12) || 'pdv') + '_' + (slug(pl.nom || 'bar').slice(0, 24) || 'bar') + '_' + GH.appareil + '.json';
}
/* Empreinte du contenu d'un jour : si elle change depuis le dernier envoi, le jour est à renvoyer */
function daySig(date) { var l = salesOf(date), pl = placeOf(date) || {}; return cxSig(date) + '|' + l.length + '|' + r2(l.reduce(function (a, v) { return a + v.total; }, 0)) + '|' + (S.tiroir[date] || []).length + '|' + l.filter(function (v) { return v.annulation; }).length + '|' + (pl.id || '') + '|' + (pl.nom || ''); }
function ghUrl(path) { return '/repos/' + GH_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }
/* Envoi d'un jour (remplace le fichier de cette tablette). Lance une exception (code HTTP, ou 0 sans réseau) en cas d'échec. */
async function ghPut(date, auto) {
  var sig = daySig(date), path = ghPath(date), url = ghUrl(path), pl = placeOf(date);
  var body = { message: (auto ? 'Envoi automatique · ' : '') + 'Ventes du ' + date.split('-').reverse().join('/') + ', ' + (pl ? pl.nom : '') + ' (appareil ' + GH.appareil + ')',
               content: b64utf8(JSON.stringify(dayFile(date), null, 2)) };
  var old = GH.chemins && GH.chemins[date]; // ancien nom de fichier (point de vente changé) : supprimé pour ne pas compter deux fois
  for (var essai = 0; essai < 2; essai++) {
    var g = await ghApi('GET', url, GH.token);
    if (g.ok) body.sha = (await g.json()).sha; else if (g.status === 404) delete body.sha; else throw g.status;
    var r = await ghApi('PUT', url, GH.token, body);
    if (r.ok) break;
    if ((r.status === 409 || r.status === 422) && essai === 0) continue; // fichier modifié entre-temps : on relit et on réessaie
    throw r.status;
  }
  if (old && old !== path) {
    try { var go = await ghApi('GET', ghUrl(old), GH.token); if (go.ok) await ghApi('DELETE', ghUrl(old), GH.token, { message: 'Changement de point de vente, appareil ' + GH.appareil, sha: (await go.json()).sha }); } catch (e) {}
  }
  GH.envois[date] = isoLocal(new Date()); GH.chemins = GH.chemins || {}; GH.chemins[date] = path;
  GH.sig = GH.sig || {}; GH.sig[date] = sig; saveGh();
  S.exported[date] = true; persist(true);
  return path;
}
async function ghSend(date) {
  if (S.ghBusy || !ghReady()) return;
  S.ghBusy = date; S.menu = false; render();
  try {
    var path = await ghPut(date, false);
    AUTO.err = null; AUTO.last = Date.now();
    toast('Envoyé sur GitHub à ' + GH.envois[date].slice(11, 16) + ' : ' + path);
  } catch (e) {
    if (e === 401) { delete GH.token; saveGh(); } // jeton refusé : il faudra déverrouiller à nouveau
    S.ghResult = { text: ghError(typeof e === 'number' ? e : 0) }; S.modal = 'ghres';
  } finally { S.ghBusy = null; render(); }
}

/* ---------- Envoi automatique ----------
   Dès que la tablette a internet (et que l'envoi est déverrouillé), chaque jour modifié depuis son dernier envoi
   est envoyé, sans action ni message. Après une vente ou une annulation : envoi ~15 s plus tard, au plus une fois par minute.
   Vérification aussi au démarrage, au retour du réseau, au retour de l'app au premier plan et toutes les minutes. */
var AUTO_DELAI = 15000, AUTO_MIN_INTERVALLE = 60000;
var AUTO = { timer: null, last: 0, err: null };
function daysToSend() {
  GH.sig = GH.sig || {};
  var ds = Object.keys(S.days).concat(Object.keys(S.tiroir), cxDates()).filter(function (d, i, a) { return a.indexOf(d) === i; });
  return ds.filter(function (d) { return ((S.days[d] && S.days[d].length) || (S.tiroir[d] && S.tiroir[d].length) || cxDay(d)) && GH.sig[d] !== daySig(d); }).sort();
}
function autoSchedule(delay) { if (!ghConfigured()) return; clearTimeout(AUTO.timer); AUTO.timer = setTimeout(autoSync, delay); }
async function autoSync() { if (!FEAT('envoiAuto')) return;
  if (!ghReady() || S.ghBusy || navigator.onLine === false) return;
  stkSync(); // mouvements de stock en attente (file séparée)
  if (typeof cmdSync === 'function') cmdSync().then(function () { cmdRefresh(false); }); // commandes : mises à jour en attente puis relecture
  cxSync().then(function () { cxRefresh(false); }); // fichier de caisse partagé : envoi des saisies puis lecture des saisies de l'Admin
  var todo = daysToSend(); if (!todo.length) return;
  var wait = AUTO.last + AUTO_MIN_INTERVALLE - Date.now();
  if (wait > 0 && !AUTO.err) { autoSchedule(wait); return; }
  S.ghBusy = 'auto'; render();
  try { for (var i = 0; i < todo.length; i++) await ghPut(todo[i], true); AUTO.err = null; }
  catch (e) { if (e === 401) { delete GH.token; saveGh(); } AUTO.err = typeof e === 'number' ? e : 0; }
  finally { AUTO.last = Date.now(); S.ghBusy = null; render(); }
}
/* État de l'envoi automatique, pour le bandeau de l'accueil (t) et la mention de l'en-tête (court) */
function autoStatus() {
  if (!ghConfigured()) return null;
  if (!ghReady()) return { ko: true, court: 'Envoi auto inactif', t: 'Envoi automatique inactif : touchez pour déverrouiller GitHub' };
  if (S.ghBusy === 'auto') return { court: 'Envoi…', t: 'Envoi automatique en cours…' };
  var n = daysToSend().length, nq = (typeof STK !== 'undefined' ? STK.queue.length : 0) + (typeof CXF !== 'undefined' ? CXF.queue.length : 0) + (typeof CMD !== 'undefined' ? CMD.queue.length : 0), last = Object.keys(GH.envois).map(function (k) { return GH.envois[k]; }).sort().pop();
  if (n) {
    if (navigator.onLine === false) return { warn: true, court: 'En attente de réseau', t: 'Pas de réseau : ' + n + ' jour' + (n > 1 ? 's' : '') + ' à envoyer dès le retour d\u2019internet' };
    if (AUTO.err === 401) return { ko: true, court: 'Envoi auto inactif', t: 'GitHub refuse le jeton : touchez pour déverrouiller à nouveau' };
    if (AUTO.err != null) return { warn: true, court: 'Nouvel essai bientôt', t: 'Dernier envoi automatique échoué (' + ghError(AUTO.err) + ') : nouvel essai automatique' };
    return { court: 'Envoi prévu', t: 'Envoi automatique dans quelques instants' };
  }
  if (nq) {
    if (navigator.onLine === false) return { warn: true, court: 'En attente de réseau', t: 'Pas de réseau : ' + stkPendingText() + ' à envoyer dès le retour d\u2019internet' };
    if (STK.err != null && STK.err !== 'pasmien') return { warn: true, court: 'Nouvel essai bientôt', t: 'Stock : ' + stkErrText(STK.err) };
    return { court: 'Envoi prévu', t: 'Envoi automatique dans quelques instants (' + stkPendingText() + ')' };
  }
  return { ok: true, court: last ? 'À jour ' + last.slice(11, 16) : 'À jour', t: last ? 'Envoi automatique : à jour (dernier envoi le ' + frDate(last).slice(0, 5) + ' à ' + last.slice(11, 16) + ')' : 'Envoi automatique actif : rien à envoyer' };
}
window.addEventListener('online', function () { autoSchedule(2000); render(); });
window.addEventListener('offline', function () { render(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') autoSchedule(3000); });
setInterval(function () { autoSync(); }, 60000);

async function ghUnlock() {
  if (!CLE_CHIFFREE) { S.ghMsg = { ok: false, text: 'La clé chiffrée n\u2019est pas encore installée dans cette version de la caisse.' }; render(); return; }
  if (!normPass(S.ghPass)) { S.ghMsg = { ok: false, text: 'Saisissez la phrase de passe.' }; render(); return; }
  S.ghMsg = { ok: null, text: 'Déverrouillage…' }; render();
  var token;
  try { token = await decryptToken(CLE_CHIFFREE, S.ghPass); }
  catch (e) { S.ghMsg = { ok: false, text: 'Phrase de passe incorrecte.' }; S.ghPass = ''; render(); return; }
  GH.token = token; saveGh(); S.ghPass = '';
  S.ghMsg = { ok: true, text: 'Déverrouillé sur cet appareil. Vérification de l\u2019accès au dépôt…' }; render();
  await ghTest();
  AUTO.err = null; autoSchedule(1000);
  if (S.ghPending && S.ghMsg && S.ghMsg.ok) { var d = S.ghPending; S.ghPending = null; S.modal = S.ghBack || null; S.ghBack = null; ghSend(d); }
}
async function ghTest() {
  if (!ghReady()) return;
  try {
    var r = await ghApi('GET', '/repos/' + GH_REPO, GH.token);
    if (!r.ok) throw r.status;
    var d = await r.json();
    S.ghMsg = { ok: true, text: 'Dépôt « ' + d.full_name + ' » accessible' + (d.private ? ' (privé)' : ' — attention : ce dépôt est PUBLIC') + '. L\u2019écriture sera confirmée au premier envoi.' };
  } catch (e) { S.ghMsg = { ok: false, text: ghError(typeof e === 'number' ? e : 0) }; }
  render();
}

/* ---------- Stock : réception d'articles venus d'un autre stand ----------
   Le stock de la saison est géré par l'App admin dans le dépôt des ventes : <GH_DOSSIER>/stock/<saison>.json
   (format agri-garden-caisse/stock). La caisse y AJOUTE seulement ses transferts « vers son stand » :
   relecture du fichier, ajout d'une clé dans `mouvements` (objet indexé par identifiant), PUT avec le sha lu.
   Jamais de réécriture depuis une copie locale. Hors ligne ou appareil verrouillé : file d'attente sur la tablette. */
var STOCK_DIR = GH_DOSSIER + '/stock';
var STK_KEY = STORE_KEY + '-stock';
var STK_MAX_RECUS = 60;
var STK = { queue: [], recus: [], saison: null, lu: null, err: null, busy: false, noSeason: false };
try { var stkSaved = JSON.parse(localStorage.getItem(STK_KEY) || 'null'); if (stkSaved) { STK.queue = stkSaved.queue || []; STK.recus = stkSaved.recus || []; STK.saison = stkSaved.saison || null; STK.lu = stkSaved.lu || null; } } catch (e) {}
function saveStk() { try { localStorage.setItem(STK_KEY, JSON.stringify({ queue: STK.queue, recus: STK.recus, saison: STK.saison, lu: STK.lu })); refreshUsage(); return true; } catch (e) { return false; } }
function b64utf8d(b) { return decodeURIComponent(escape(atob(String(b || '').replace(/\s/g, '')))); }
function stkCode(e) { return typeof e === 'number' ? e : (e === 'nosaison' || e === 'pasmien' ? e : 0); }
function stkErrText(e) {
  if (e === 'nosaison') return 'Aucun stock de saison : il doit d’abord être créé dans l’App admin';
  if (e === 'pasmien') return 'Ce mouvement n’a pas été créé par cette tablette : la correction se fait dans l’App admin';
  if (e === 409) return 'Le fichier du stock change sans arrêt : nouvel essai automatique';
  return ghError(e);
}
/* Libellé d'un article pour le fichier de stock (même règle que le panier : catégorie devant, sauf prefixe false) */
function stkArticle(pid) {
  var r = null;
  if (CATALOGUE) CATALOGUE.categories.forEach(function (k) { k.produits.forEach(function (p) { if (p.id === pid) r = { libelle: k.prefixe === false ? p.libelle : k.nom + ' ' + p.libelle, categorie: k.nom }; }); });
  return r;
}
/* Lecture d'un fichier de stock : { sha, data } ; lance le code HTTP en cas d'échec */
async function stkRead(path) {
  var r = await ghApi('GET', ghUrl(path), GH.token);
  if (!r.ok) throw r.status;
  var j = await r.json();
  return { path: path, sha: j.sha, data: JSON.parse(b64utf8d(j.content)) };
}
/* Saison en cours : le fichier agri-garden-caisse/stock dont creeLe est le plus récent (null s'il n'y en a aucun) */
async function stkSeason() {
  var r = await ghApi('GET', ghUrl(STOCK_DIR), GH.token);
  if (r.status === 404) return null;
  if (!r.ok) throw r.status;
  var list = (await r.json()).filter(function (f) { return f.type === 'file' && /\.json$/i.test(f.name); });
  var best = null;
  for (var i = 0; i < list.length; i++) {
    var f;
    try { f = await stkRead(list[i].path); } catch (e) { if (typeof e === 'number' && e !== 404) throw e; continue; }
    if (!f.data || f.data.format !== 'agri-garden-caisse/stock') continue;
    if (!best || String(f.data.creeLe || '') > String(best.data.creeLe || '')) best = f;
  }
  return best;
}
/* Transferts reçus par le stand de la tablette, du plus récent au plus ancien (copie réduite gardée sur la tablette) */
function stkTakeRecus(d) {
  var mv = d.mouvements || {}, stands = d.stands || {}, arts = d.articles || {};
  STK.saison = { nom: d.nom || d.id || '', id: d.id || '' };
  STK.recus = Object.keys(mv).map(function (k) { return { id: k, m: mv[k] }; })
    .filter(function (x) { return x.m && x.m.type === 'transfert' && x.m.vers === S.placeId; })
    .sort(function (a, b) { return String(b.m.date || '').localeCompare(String(a.m.date || '')) || String(b.m.creeLe || '').localeCompare(String(a.m.creeLe || '')); })
    .slice(0, STK_MAX_RECUS)
    .map(function (x) {
      var de = findPlace(x.m.de);
      return { id: x.id, date: x.m.date || '', de: x.m.de, deNom: (stands[x.m.de] && stands[x.m.de].nom) || (de && de.nom) || x.m.de, source: x.m.source || 'admin', appareil: x.m.appareil || null,
        lignes: Object.keys(x.m.lignes || {}).map(function (pid) { var a = stkArticle(pid); return { id: pid, q: x.m.lignes[pid], libelle: (a && a.libelle) || (arts[pid] && arts[pid].libelle) || pid }; }) };
    });
  STK.lu = isoLocal(new Date()); STK.noSeason = false;
  if (typeof stkcFromDoc === 'function' && STKC.at) { stkcFromDoc(d); saveStkc(); } // stock du stand : mouvements à jour
}
/* Applique une opération de la file ({op:'add', id, mv, noms} ou {op:'del', id}) : relecture, ajout ou retrait d'une seule clé, PUT avec le sha lu.
   409/422 : le fichier a changé entre-temps, on relit et on recommence (3 essais au plus). */
async function stkApply(op) {
  var path = null;
  for (var essai = 0; essai < 3; essai++) {
    var f;
    if (!path) { f = await stkSeason(); if (!f) throw 'nosaison'; path = f.path; }
    else f = await stkRead(path);
    var d = f.data;
    if (!d.mouvements || typeof d.mouvements !== 'object' || Array.isArray(d.mouvements)) d.mouvements = {};
    if (op.op === 'add') {
      if (d.mouvements[op.id]) { stkTakeRecus(d); return; } // déjà envoyé (envoi répété) : pas de doublon
      var n = op.noms || {};
      d.stands = d.stands || {};
      [op.mv.de, op.mv.vers].forEach(function (sid) { if (!d.stands[sid]) { var p = findPlace(sid); d.stands[sid] = { nom: (p && p.nom) || (n.stands && n.stands[sid]) || sid }; } });
      d.articles = d.articles || {};
      Object.keys(op.mv.lignes).forEach(function (pid) { if (!d.articles[pid]) d.articles[pid] = stkArticle(pid) || (n.articles && n.articles[pid]) || { libelle: pid, categorie: '' }; });
      d.mouvements[op.id] = op.mv;
    } else {
      var m = d.mouvements[op.id];
      if (!m) { stkTakeRecus(d); return; } // déjà supprimé
      if (m.source !== 'caisse' || m.appareil !== GH.appareil) throw 'pasmien';
      delete d.mouvements[op.id];
    }
    d.majLe = isoLocal(new Date()); d.majPar = 'caisse';
    var pl = findPlace(S.placeId);
    var r = await ghApi('PUT', ghUrl(path), GH.token, { message: 'Stock ' + (d.nom || d.id || '') + ' (Caisse ' + (pl ? pl.nom : S.placeId) + ')', content: b64utf8(JSON.stringify(d, null, 2)), sha: f.sha });
    if (r.ok) { stkTakeRecus(d); return; }
    if (r.status === 409 || r.status === 422) continue;
    throw r.status;
  }
  throw 409;
}
/* Envoi de la file d'attente (même déclencheurs que l'envoi automatique des ventes) */
async function stkSync() {
  if (STK.busy || !STK.queue.length || !ghReady() || navigator.onLine === false) return;
  STK.busy = true; render();
  try {
    while (STK.queue.length) {
      await stkApply(STK.queue[0]);
      STK.queue.shift(); saveStk();
    }
    STK.err = null;
  } catch (e) {
    var c = stkCode(e);
    if (c === 401) { delete GH.token; saveGh(); }
    if (c === 'pasmien') { STK.queue.shift(); } // suppression refusée : on l'abandonne, le mouvement reste dans le fichier
    STK.err = c; saveStk();
  } finally { STK.busy = false; render(); }
}
/* Relecture des transferts reçus (à l'ouverture de l'écran) */
async function stkRefresh() {
  if (!ghReady() || navigator.onLine === false || STK.busy) return;
  STK.loading = true; render();
  try {
    var f = await stkSeason();
    if (!f) { STK.noSeason = true; STK.recus = []; STK.saison = null; }
    else stkTakeRecus(f.data);
    STK.err = null; saveStk();
  } catch (e) { var c = stkCode(e); if (c === 401) { delete GH.token; saveGh(); } STK.err = c; }
  finally { STK.loading = false; render(); }
  stkSync();
}
function stkPendingText() {
  var n = STK.queue.length, m = typeof CXF !== 'undefined' ? CXF.queue.length : 0, t = [];
  if (n) t.push(n + ' mouvement' + (n > 1 ? 's' : '') + ' de stock'); if (m) t.push(m + ' saisie' + (m > 1 ? 's' : '') + ' de caisse');
  var kq = typeof CMD !== 'undefined' ? CMD.queue.length : 0; if (kq) t.push(kq + ' commande' + (kq > 1 ? 's' : '') + ' retirée' + (kq > 1 ? 's' : ''));
  return t.join(' et ') || '0 mouvement';
}
S.rq = {};

/* ---------- Stock du stand (lecture seule) ----------
   Même calcul que l'App admin (Gestion d’événement › Stock) : restant = livré + reçu − envoyé − vendu, par article.
   - livré / reçu / envoyé : fichier de stock de la saison (livraisons dont stand = ce stand, transferts vers / depuis ce stand) ;
   - vendu : fichiers de ventes de la Caisse (<GH_DOSSIER>/*.json hors stock/) de ce stand, depuis le premier mouvement
     de la saison ; ventes annulées et articles libres ignorés ; pour un même stand et un même jour, le fichier dont
     miseAJour est le plus récent compte (une tablette par stand).
   Les ventes de cette tablette sont lues dans sa mémoire : le stock suit les ventes en direct, même hors ligne.
   Les réceptions encore en file d'attente sont comptées aussi. */
var STOCK_BAS = 3;            // « reste » en orange à partir de ce nombre (0 ou moins : rouge)
var AFFICHER_RESTE = true;    // restant affiché sur les tuiles de la caisse
var STKC_KEY = STORE_KEY + '-stockcalc';
var STKC = { at: null, saison: null, start: null, place: null, mv: null, arts: {}, sums: {}, err: null, loading: false, noSeason: false };
try { var stkcSaved = JSON.parse(localStorage.getItem(STKC_KEY) || 'null'); if (stkcSaved) ['at', 'saison', 'start', 'place', 'mv', 'arts', 'sums'].forEach(function (k) { if (stkcSaved[k] !== undefined) STKC[k] = stkcSaved[k]; }); } catch (e) {}
function saveStkc() { try { localStorage.setItem(STKC_KEY, JSON.stringify({ at: STKC.at, saison: STKC.saison, start: STKC.start, place: STKC.place, mv: STKC.mv, arts: STKC.arts, sums: STKC.sums })); return true; } catch (e) { return false; } }
/* Mouvements du fichier de stock → { pid: {liv, inn, out} } pour ce stand + date de début de saison */
function stkcFromDoc(d) {
  var mv = {}, start = null, arts = {};
  function add(pid, k, q) { q = Number(q) || 0; if (!q) return; (mv[pid] = mv[pid] || { liv: 0, inn: 0, out: 0 })[k] += q; }
  var all = d.mouvements || {};
  Object.keys(all).forEach(function (id) {
    var m = all[id]; if (!m || !m.lignes) return;
    if (m.date && (!start || m.date < start)) start = m.date;
    Object.keys(m.lignes).forEach(function (pid) {
      if (m.type === 'livraison' && m.stand === S.placeId) add(pid, 'liv', m.lignes[pid]);
      else if (m.type === 'transfert' && m.vers === S.placeId) add(pid, 'inn', m.lignes[pid]);
      else if (m.type === 'transfert' && m.de === S.placeId) add(pid, 'out', m.lignes[pid]);
    });
  });
  Object.keys(d.articles || {}).forEach(function (pid) { arts[pid] = d.articles[pid].libelle || pid; });
  STKC.mv = mv; STKC.start = start; STKC.arts = arts; STKC.place = S.placeId; STKC.saison = d.nom || d.id || '';
  STKC.noSeason = false;
}
/* Résumé d'un fichier de ventes : { pdv, date, maj, q: {pid: quantité} } */
function salesSummary(f) {
  var q = {};
  (f.ventes || []).forEach(function (v) {
    if (v.annulation || v.commande) return; // commande : le stock a déjà été retiré par l'App admin
    (v.lignes || []).forEach(function (l) { if (l.produitId) q[l.produitId] = (q[l.produitId] || 0) + (Number(l.quantite) || 0); });
  });
  return { pdv: f.pointDeVente ? f.pointDeVente.id : null, date: f.date || null, maj: f.miseAJour || '', q: q };
}
/* Lecture des ventes du stand sur GitHub (un appel pour la liste, puis seulement les fichiers nouveaux ou modifiés) */
async function stkcLoadSales() {
  var r = await ghApi('GET', '/repos/' + GH_REPO + '/git/trees/HEAD?recursive=1', GH.token);
  if (!r.ok) throw r.status;
  var tree = (await r.json()).tree || [], pre = GH_DOSSIER + '/', keep = {}, mine = slug(S.placeId).slice(0, 12);
  var files = tree.filter(function (t) { return t.type === 'blob' && t.path.indexOf(pre) === 0 && t.path.indexOf(pre + 'stock/') !== 0 && t.path.indexOf(pre + 'commandes/') !== 0 && t.path.indexOf(pre + 'caisse/') !== 0 && t.path.indexOf(pre + 'factures/') !== 0 && /\.json$/i.test(t.path); });
  for (var i = 0; i < files.length; i++) {
    var t = files[i], name = t.path.split('/').pop(), m = /^(\d{4}-\d{2}-\d{2})_([^_]+)_/.exec(name);
    if (m && m[2] !== mine) continue;                    // autre stand (identifiant dans le nom du fichier) : pas lu
    if (m && STKC.start && m[1] < STKC.start) continue;  // avant la saison
    keep[t.sha] = true;
    if (STKC.sums[t.sha]) continue;                      // déjà résumé (même contenu)
    var b = await ghApi('GET', '/repos/' + GH_REPO + '/git/blobs/' + t.sha, GH.token);
    if (!b.ok) throw b.status;
    var s = null;
    try { var f = JSON.parse(b64utf8d((await b.json()).content)); if (f && f.format === 'agri-garden-caisse/ventes') s = salesSummary(f); } catch (e) {}
    STKC.sums[t.sha] = s && s.pdv === S.placeId ? s : { autre: true };
  }
  Object.keys(STKC.sums).forEach(function (sha) { if (!keep[sha]) delete STKC.sums[sha]; }); // fichiers disparus ou remplacés
}
async function stkcRefresh(manual) { if (!FEAT('stockTablette') && !FEAT('restantTuiles')) return;
  if (STKC.loading || !S.placeId) return;
  if (!ghReady() || navigator.onLine === false) { if (manual) toast(!ghReady() ? 'Déverrouillez l’envoi GitHub pour calculer le stock' : 'Pas de réseau : stock du dernier calcul'); return; }
  if (STKC.place && STKC.place !== S.placeId) { STKC.sums = {}; STKC.mv = null; } // point de vente changé
  STKC.loading = true; render();
  try {
    var f = await stkSeason();
    if (!f) { STKC.noSeason = true; STKC.mv = null; STKC.at = null; STKC.err = null; saveStkc(); return; }
    stkcFromDoc(f.data);
    if (typeof stkTakeRecus === 'function') { stkTakeRecus(f.data); saveStk(); }
    await stkcLoadSales();
    STKC.at = isoLocal(new Date()); STKC.err = null; saveStkc();
  } catch (e) { var c = stkCode(e); if (c === 401) { delete GH.token; saveGh(); } STKC.err = c; }
  finally { STKC.loading = false; render(); }
}
/* Restant par article : { pid: {liv, inn, out, sold, rest} } (null si jamais calculé pour ce stand) */
function stockOfPlace() {
  if (!STKC.mv || STKC.place !== S.placeId) return null;
  var res = {};
  function row(pid) { return res[pid] = res[pid] || { liv: 0, inn: 0, out: 0, sold: 0, rest: 0 }; }
  Object.keys(STKC.mv).forEach(function (pid) { var a = row(pid), m = STKC.mv[pid]; a.liv = m.liv; a.inn = m.inn; a.out = m.out; });
  // réceptions encore en attente d'envoi
  STK.queue.forEach(function (o) {
    if (o.op === 'add' && o.mv.vers === S.placeId) Object.keys(o.mv.lignes).forEach(function (pid) { row(pid).inn += o.mv.lignes[pid]; });
  });
  // ventes : par jour, le fichier le plus récent (GitHub ou mémoire de la tablette)
  var best = {};
  Object.keys(STKC.sums).forEach(function (sha) { var s = STKC.sums[sha]; if (s && !s.autre && s.date && (!best[s.date] || s.maj > best[s.date].maj)) best[s.date] = s; });
  Object.keys(S.days).forEach(function (d) {
    var pl = placeOf(d); if (!pl || pl.id !== S.placeId || !(S.days[d] || []).length) return;
    var s = salesSummary(dayFile(d));
    if (!best[d] || s.maj >= best[d].maj) best[d] = s;
  });
  Object.keys(best).forEach(function (d) {
    if (STKC.start && d < STKC.start) return;
    var q = best[d].q; Object.keys(q).forEach(function (pid) { row(pid).sold += q[pid]; });
  });
  Object.keys(res).forEach(function (pid) { var a = res[pid]; a.rest = a.liv + a.inn - a.out - a.sold; });
  return res;
}
function restCls(n) { return n <= 0 ? 'ko' : n <= STOCK_BAS ? 'warn' : ''; }
function vRest(st, pid) { if (!FEAT('restantTuiles')) return '';
  if (!AFFICHER_RESTE || !st) return '';
  var a = st[pid], n = a ? a.rest : 0;
  return '<span class="rest ' + restCls(n) + '">reste ' + n + '</span>';
}
function vStock() {
  var pl = findPlace(S.placeId), st = stockOfPlace();
  var head = '<div class="row"><h2>Stock du stand</h2><button class="btn" data-a="close">Fermer</button></div>';
  var stat = STKC.loading ? { cls: '', t: 'Calcul du stock…' }
    : STKC.noSeason ? { cls: 'ko', t: stkErrText('nosaison') }
    : STKC.err != null ? { cls: 'warn', t: stkErrText(STKC.err) + (STKC.at ? ' · affichage du dernier calcul' : '') }
    : !STKC.at ? { cls: 'warn', t: ghReady() ? 'Pas encore calculé : il faut internet.' : 'Déverrouillez l’envoi GitHub (bandeau ☁ de l’accueil) pour calculer le stock.' }
    : navigator.onLine === false ? { cls: 'warn', t: 'Hors ligne · calculé le ' + frDate(STKC.at).slice(0, 5) + ' à ' + STKC.at.slice(11, 16) + ', ventes de la tablette ajoutées depuis' }
    : { cls: 'ok', t: 'Calculé le ' + frDate(STKC.at).slice(0, 5) + ' à ' + STKC.at.slice(11, 16) + ' · ventes de la tablette en direct' };
  var body = '';
  if (st) {
    var seen = {};
    function line(pid, label) {
      seen[pid] = true;
      var a = st[pid] || { liv: 0, inn: 0, out: 0, sold: 0, rest: 0 }, open = S.stkOpen === pid;
      return '<button class="skrow' + (open ? ' open' : '') + '" data-a="stkOpen" data-v="' + esc(pid) + '"><span class="skl">' + esc(label) + '</span><span class="skn ' + restCls(a.rest) + '">' + a.rest + '</span></button>' +
        (open ? '<div class="skdet"><span>Livré <b>' + a.liv + '</b></span><span>Reçu <b>' + a.inn + '</b></span><span>Envoyé <b>' + a.out + '</b></span><span>Vendu <b>' + a.sold + '</b></span></div>' : '');
    }
    body = CATALOGUE.categories.map(function (k) {
      var prods = k.produits.filter(function (p) { return !isDeliveryLabel(p.libelle); }); if (!prods.length) return '';
      return '<div class="rccat">' + esc(k.nom) + '</div>' + prods.map(function (p) { return line(p.id, p.libelle); }).join('');
    }).join('');
    var old = Object.keys(st).filter(function (pid) { return !seen[pid] && !isDeliveryId(pid) && st[pid].rest !== 0; });
    if (old.length) body += '<div class="rccat">Plus dans le catalogue</div>' + old.map(function (pid) { return line(pid, STKC.arts[pid] || pid); }).join('');
  } else body = '<div class="empty" style="padding:20px">Le stock apparaîtra après le premier calcul.</div>';
  return '<div class="overlay"><div class="modal rcmodal" data-keep="stk">' + head +
    '<div class="sub">Restant à <strong>' + esc(pl ? pl.nom : '') + '</strong>' + (STKC.saison ? ' · ' + esc(STKC.saison) : '') + ' = livré + reçu − envoyé − vendu. Touchez un article pour le détail.</div>' +
    '<div class="rcstat ' + stat.cls + '">' + esc(stat.t) + '</div>' +
    '<div class="actions" style="justify-content:flex-start"><button class="btn" data-a="stkRefresh"' + (STKC.loading ? ' disabled' : '') + '>Actualiser</button></div>' +
    '<div class="rclist">' + body + '</div>' +
    '<div class="sub">Consultation seulement : les livraisons, transferts et corrections se font dans l’App admin (les réceptions, aussi ici : ⋮ → Réception de stock).</div>' +
    '</div></div>';
}

/* ---------- Caisse du jour : fichier de caisse partagé avec l'App admin ----------
   Dépôt des ventes, <GH_DOSSIER>/caisse/AAAA-MM-JJ_<pdvId>.json (format agri-garden-caisse/caisse) :
   { format, formatVersion:1, date, pointDeVente{id,nom}, creeLe, majLe, majPar, entrees:{ <id>: {type:'fond'|'retrait'|'apport'|'comptage', montant,
     detail|null, motif?, horodatage, source:'caisse'|'admin', appareil?, (comptage) attendu, ecart, laisse, recette, attenduApres, viaFond} } }
   - La tablette n'écrit que ses entrées (ids « <type>-caisse-… ») : relecture, ajout / retrait d'une clé, PUT avec le sha lu (3 essais sur 409/422).
     Jamais de réécriture depuis la copie locale ; une correction = nouvelle entrée (le dernier fond fait foi) ou suppression + ajout.
   - Copie locale (CXF.snap) = dernier contenu lu, pour l'affichage hors ligne ; file d'attente (CXF.queue) = opérations pas encore envoyées.
   - Calcul : fond = dernière entrée fond ; recette d'un comptage = montant − laissé (dans le comptage, plus de retrait séparé) ;
     attendu = fond + ventes cash (calculées ici) + apports − retraits − recettes ; le dernier comptage fait foi ;
     « à recompter » si |attendu − attenduApres du dernier comptage| ≥ 0,005. */
var COUPURES = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05]; // pas de pièces de 1 et 2 cents (arrondi aux 5 cents)
var RETRAIT_MOTIFS = ['Dépôt au coffre', 'Remboursement client', 'Dépense', 'Autre'];
var APPORT_MOTIFS = ['Ajout de monnaie', 'Autre'];
var CXF_KEY = STORE_KEY + '-caissefichier';
var CXF = { snap: {}, queue: [], migre: false, busy: false, err: null, lecture: {} };
try { var cxfSaved = JSON.parse(localStorage.getItem(CXF_KEY) || 'null'); if (cxfSaved) { CXF.snap = cxfSaved.snap || {}; CXF.queue = cxfSaved.queue || []; CXF.migre = !!cxfSaved.migre; } } catch (e) {}
function saveCxf() {
  var lim = isoDate(new Date(Date.now() - 40 * 864e5)); // copie locale : 40 derniers jours (plus les jours encore gardés sur la tablette)
  Object.keys(CXF.snap).forEach(function (d) { if (d < lim && !(S.days[d] || []).length && !CXF.queue.some(function (o) { return o.date === d; })) delete CXF.snap[d]; });
  try { localStorage.setItem(CXF_KEY, JSON.stringify({ snap: CXF.snap, queue: CXF.queue, migre: CXF.migre })); refreshUsage(); return true; } catch (e) { return false; }
}
function cxD() { return S.cxDate || today(); }
function cxPdv(d) { var pl = placeOf(d); return pl && pl.id ? pl : { id: S.placeId, nom: (findPlace(S.placeId) || {}).nom || S.placeId }; }
function cxPath(d, pdvId) { return GH_DOSSIER + '/caisse/' + d + '_' + pdvId + '.json'; }
function cxStamp(iso) { return String(iso).slice(0, 19).replace(/\D/g, ''); }
function cxNewId(type) { return type + '-caisse-' + cxStamp(isoLocal(new Date())) + '-' + GH.appareil + '-' + (Math.random().toString(36).slice(2) + '0000').slice(0, 4); }
function cxOwn(e) { return e && e.source === 'caisse' && e.appareil === GH.appareil; }
function cxDates() { var o = {}; Object.keys(CXF.snap).forEach(function (d) { o[d] = 1; }); CXF.queue.forEach(function (q) { o[q.date] = 1; }); return Object.keys(o); }
/* Entrées d'un jour = dernière version lue + opérations en attente */
function cxEntries(d) {
  var sn = CXF.snap[d], pdv = cxPdv(d).id, e = {};
  if (sn && (!sn.pdv || sn.pdv === pdv)) Object.keys(sn.entrees || {}).forEach(function (k) { e[k] = sn.entrees[k]; });
  CXF.queue.forEach(function (q) { if (q.date !== d) return; if (q.op === 'add') e[q.id] = Object.assign({ attente: true }, q.entree); else delete e[q.id]; });
  return e;
}
function cxDay(d) {
  d = d || today();
  var e = cxEntries(d), list = Object.keys(e).map(function (k) { return Object.assign({ id: k }, e[k]); }).sort(function (a, b) { return String(a.horodatage).localeCompare(String(b.horodatage)); });
  if (!list.length) return null;
  var fonds = list.filter(function (x) { return x.type === 'fond'; });
  return { fond: fonds.slice(-1)[0] || null, fonds: fonds, mouvements: list.filter(function (x) { return x.type === 'retrait' || x.type === 'apport'; }),
    comptages: list.filter(function (x) { return x.type === 'comptage'; }), entrees: list };
}
function cashSalesOf(d) {
  var tot = 0;
  Object.keys(S.days).forEach(function (day) {
    (S.days[day] || []).forEach(function (v) {
      if (v.annulation) return;
      var late = [];
      if (v.livraisonAjoutee) late.push({ day: v.livraisonAjoutee.horodatage.slice(0, 10), cash: Number(v.livraisonAjoutee.paiement.cash) || 0 });
      if (v.facture && v.facture.paiement) late.push({ day: v.facture.paiement.horodatage.slice(0, 10), cash: Number(v.facture.paiement.cash) || 0 });
      if (day === d) tot += (Number(v.paiement.cash) || 0) - late.reduce(function (a, x) { return a + (x.day !== d ? x.cash : 0); }, 0);
      else late.forEach(function (x) { if (x.day === d) tot += x.cash; });
    });
  });
  return r2(tot);
}
function cxSummary(d) {
  d = d || today();
  var c = cxDay(d) || {}, mv = c.mouvements || [], cp = c.comptages || [];
  var sum = function (t) { return r2(mv.filter(function (m) { return m.type === t; }).reduce(function (a, m) { return a + (Number(m.montant) || 0); }, 0)); };
  var r = { fond: c.fond ? c.fond.montant : null, ventes: cashSalesOf(d), apports: sum('apport'), retraits: sum('retrait'),
    recettes: r2(cp.reduce(function (a, k) { return a + (Number(k.recette) || 0); }, 0)) };
  r.attendu = r2((r.fond || 0) + r.ventes + r.apports - r.retraits - r.recettes);
  r.comptage = cp.slice(-1)[0] || null;
  return r;
}
/* Écart d'argent liquide depuis le dernier comptage : null si pas de comptage */
function cxDelta(d) {
  var c = cxDay(d), k = c && c.comptages.slice(-1)[0]; if (!k) return null;
  return r2(cxSummary(d).attendu - (k.attenduApres != null ? k.attenduApres : k.attendu));
}
function cxNeedsCount(d) {
  var c = cxDay(d), has = (S.days[d] || []).length || (c && (c.fond || c.mouvements.length));
  if (!has) return false;
  var dl = cxDelta(d); return dl === null || Math.abs(dl) >= 0.005;
}
/* Fond proposé : laissé au dernier comptage d'un jour précédent + cash entré (ou sorti) après ce comptage */
function cxFondPropose(d) {
  d = d || today();
  var prev = cxDates().concat(Object.keys(S.days)).filter(function (x, i, a) { return x < d && a.indexOf(x) === i; }).sort().reverse();
  for (var i = 0; i < prev.length; i++) {
    var c = cxDay(prev[i]), k = c && c.comptages.slice(-1)[0];
    if (k) return r2((k.laisse != null ? k.laisse : k.montant) + (cxDelta(prev[i]) || 0));
  }
  return null;
}
function cxPrevUncounted() {
  var t = today(), ds = Object.keys(S.days).filter(function (d) { return (S.days[d] || []).length; }).concat(cxDates().filter(function (d) { var c = cxDay(d); return c && c.fond; }))
    .filter(function (d, i, a) { return d < t && a.indexOf(d) === i; }).sort();
  var d = ds.pop(); if (!d) return null;
  return cxNeedsCount(d) ? d : null;
}
/* Champ `caisse` du fichier de ventes (même forme qu'avant ; recettes rendues comme retraits automatiques pour la compatibilité) */
function cxExport(d) {
  var c = cxDay(d); if (!c) return null;
  var s = cxSummary(d), k = s.comptage, clean = function (x) { var o = Object.assign({}, x); delete o.attente; return o; };
  var mv = c.mouvements.map(clean).concat(c.comptages.filter(function (x) { return x.recette > 0.005; }).map(function (x) { return { id: x.id + '-recette', type: 'retrait', montant: x.recette, motif: 'Recette de fin de journée', horodatage: x.horodatage, auto: true, source: x.source }; }))
    .sort(function (a, b) { return String(a.horodatage).localeCompare(String(b.horodatage)); });
  return { source: 'fichier de caisse partagé', fondDeCaisse: s.fond, ventesCash: s.ventes, apports: s.apports, retraits: r2(s.retraits + s.recettes), attendu: s.attendu,
    compte: k ? k.montant : null, ecart: k ? k.ecart : null, laissePourDemain: k ? k.laisse : null,
    fond: c.fond ? clean(c.fond) : null, mouvements: mv, comptages: c.comptages.map(clean) };
}
function cxSig(d) { var e = cxEntries(d), ks = Object.keys(e).sort(); return ks.length ? ks.length + ':' + ks.join(',').length + ':' + r2(ks.reduce(function (a, k) { return a + (Number(e[k].montant) || 0); }, 0)) : ''; }
/* ---------- Écriture et lecture du fichier partagé ---------- */
function cxAdd(d, entree) {
  var p = cxPdv(d), id = cxNewId(entree.type);
  entree.source = 'caisse'; entree.appareil = GH.appareil;
  CXF.queue.push({ op: 'add', date: d, pdv: p.id, pdvNom: p.nom, id: id, entree: entree });
  saveCxf(); delete S.exported[d]; if (typeof autoSchedule === 'function') autoSchedule(AUTO_DELAI);
  return id;
}
function cxRemove(d, id) {
  var qi = CXF.queue.findIndex(function (o) { return o.op === 'add' && o.id === id; });
  if (qi >= 0) CXF.queue.splice(qi, 1);
  else { var p = cxPdv(d); CXF.queue.push({ op: 'del', date: d, pdv: p.id, pdvNom: p.nom, id: id }); }
  saveCxf(); delete S.exported[d]; if (typeof autoSchedule === 'function') autoSchedule(AUTO_DELAI);
}
function cxNewDoc(d, pdv, nom) { var now = isoLocal(new Date()); return { format: 'agri-garden-caisse/caisse', formatVersion: 1, date: d, pointDeVente: { id: pdv, nom: nom }, creeLe: now, majLe: now, majPar: 'caisse', entrees: {} }; }
async function cxApplyFile(d, pdv, nom, ops) {
  var path = cxPath(d, pdv), refused = [];
  for (var essai = 0; essai < 3; essai++) {
    var g = await ghApi('GET', ghUrl(path), GH.token), doc, sha = null;
    if (g.status === 404) doc = cxNewDoc(d, pdv, nom);
    else if (!g.ok) throw g.status;
    else { var j = await g.json(); sha = j.sha; doc = JSON.parse(b64utf8d(j.content)); }
    if (!doc.entrees || typeof doc.entrees !== 'object' || Array.isArray(doc.entrees)) doc.entrees = {};
    refused = [];
    ops.forEach(function (o) {
      if (o.op === 'add') { if (!doc.entrees[o.id]) doc.entrees[o.id] = o.entree; } // déjà là (envoi répété, migration) : pas de doublon
      else { var e = doc.entrees[o.id]; if (!e) return; if (cxOwn(e)) delete doc.entrees[o.id]; else refused.push(o.id); }
    });
    doc.majLe = isoLocal(new Date()); doc.majPar = 'caisse';
    var body = { message: 'Caisse ' + d + ' ' + nom + ' (Caisse, appareil ' + GH.appareil + ')', content: b64utf8(JSON.stringify(doc, null, 2)) };
    if (sha) body.sha = sha;
    var r = await ghApi('PUT', ghUrl(path), GH.token, body);
    if (r.ok) { CXF.snap[d] = { pdv: pdv, entrees: doc.entrees, majLe: doc.majLe, lu: isoLocal(new Date()) }; return refused; }
    if (r.status === 409 || r.status === 422) continue;
    throw r.status;
  }
  throw 409;
}
async function cxSync() {
  if (CXF.busy || !CXF.queue.length || !ghReady() || navigator.onLine === false) return;
  CXF.busy = true;
  try {
    while (CXF.queue.length) {
      var f = CXF.queue[0], grp = CXF.queue.filter(function (o) { return o.date === f.date && o.pdv === f.pdv; });
      var refused = await cxApplyFile(f.date, f.pdv, f.pdvNom, grp);
      CXF.queue = CXF.queue.filter(function (o) { return grp.indexOf(o) < 0; });
      if (refused.length) CXF.err = 'pasmien'; else CXF.err = null;
      saveCxf();
    }
  } catch (e) { var c = typeof e === 'number' ? e : 0; if (c === 401) { delete GH.token; saveGh(); } CXF.err = c; saveCxf(); }
  finally { CXF.busy = false; render(); }
}
async function cxRead(d) {
  var p = cxPdv(d);
  try {
    var g = await ghApi('GET', ghUrl(cxPath(d, p.id)), GH.token);
    if (g.status === 404) CXF.snap[d] = { pdv: p.id, entrees: {}, lu: isoLocal(new Date()) };
    else if (g.ok) { var doc = JSON.parse(b64utf8d((await g.json()).content)); CXF.snap[d] = { pdv: p.id, entrees: doc.entrees || {}, majLe: doc.majLe, lu: isoLocal(new Date()) }; }
    else { if (g.status === 401) { delete GH.token; saveGh(); } return; }
    CXF.lecture[d] = Date.now(); saveCxf();
  } catch (e) {}
}
/* Lecture des saisies de l'Admin : jour en cours, jour affiché et veille pas comptée (au plus une fois toutes les 20 s par jour, sauf à la demande) */
async function cxRefresh(force) {
  if (!ghReady() || navigator.onLine === false || !S.placeId) return;
  var ds = [today(), cxD(), cxPrevUncounted()].filter(function (d, i, a) { return d && a.indexOf(d) === i; });
  var changed = false;
  for (var i = 0; i < ds.length; i++) {
    if (!force && CXF.lecture[ds[i]] && Date.now() - CXF.lecture[ds[i]] < 20000) continue;
    var before = cxSig(ds[i]); await cxRead(ds[i]); if (cxSig(ds[i]) !== before) changed = true;
  }
  if (changed) render();
}
/* Reprise des saisies faites avant le fichier partagé (S.caisse, v26 à v29) : identifiants stables, pas de doublon */
function cxMigrate() {
  if (!Object.keys(S.caisse || {}).length) { if (!CXF.migre) { CXF.migre = true; saveCxf(); } return; } // rien (ou plus rien) à reprendre ; identifiants stables : relancer ne crée pas de doublon
  var app = GH.appareil;
  Object.keys(S.caisse || {}).forEach(function (d) {
    var c = S.caisse[d] || {}, p = cxPdv(d), add = function (id, e) { e.source = 'caisse'; e.appareil = app; if (!CXF.queue.some(function (o) { return o.id === id; })) CXF.queue.push({ op: 'add', date: d, pdv: p.id, pdvNom: p.nom, id: id, entree: e }); };
    if (c.fond) add('fond-caisse-' + cxStamp(c.fond.horodatage) + '-' + app + '-mig0', { type: 'fond', montant: c.fond.montant, detail: c.fond.detail || null, horodatage: c.fond.horodatage });
    (c.mouvements || []).forEach(function (m) {
      if (m.auto) return; // l'ancienne recette automatique va dans le comptage
      add(m.type + '-caisse-' + cxStamp(m.horodatage) + '-' + app + '-' + String(m.id || 'm000').slice(-4), { type: m.type, montant: m.montant, motif: m.motif, horodatage: m.horodatage });
    });
    (c.comptages || []).forEach(function (k, i) {
      var laisse = k.laisse != null ? k.laisse : k.montant, recette = k.recette != null ? k.recette : r2(k.montant - laisse);
      add('comptage-caisse-' + cxStamp(k.horodatage) + '-' + app + '-mig' + i, { type: 'comptage', montant: k.montant, detail: k.detail || null, attendu: k.attendu, ecart: k.ecart,
        laisse: laisse, recette: recette, attenduApres: k.attenduApres != null ? k.attenduApres : r2(k.attendu - recette), viaFond: !!k.viaFond, horodatage: k.horodatage });
    });
  });
  CXF.migre = true; saveCxf();
  if (Object.keys(S.caisse || {}).length) { S.caisse = {}; persist(true); }
}
/* Comptage par coupure : { '50': 2, '0.2': 7 } → total */
function ccTotal(det) { return r2(COUPURES.reduce(function (a, v) { return a + v * (parseInt(det[String(v)], 10) || 0); }, 0)); }
function coupLabel(v) { return v >= 1 ? v + ' €' : Math.round(v * 100) + ' c'; }
function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n)); }
function srcLabel(e) { return e.source === 'admin' ? 'Admin' : cxOwn(e) ? 'Tablette' : 'Autre tablette'; }
/* Rapport de caisse (impression ePOS + aperçu), à partir des données fusionnées */
function cxReportXml(d) {
  d = d || today();
  var x = '<text lang="fr"/>', all = salesOf(d), ok = validSales(all), s = cxSummary(d), c = cxDay(d) || { mouvements: [], comptages: [] }, pl = placeOf(d) || findPlace(S.placeId);
  function t(str) { x += '<text>' + xmlEsc(tkTxt(str)) + '&#10;</text>'; }
  function st(a) { x += '<text ' + a + '/>'; }
  function hm(iso) { return (iso.slice(0, 10) !== d ? frDate(iso).slice(0, 5) + ' ' : '') + iso.slice(11, 16); }
  var SEP = Array(TK_W + 1).join('-'), now = isoLocal(new Date());
  st('align="center"'); st('em="true" dw="true" dh="true"'); t('Rapport de caisse'); st('em="false" dw="false" dh="false"');
  t('Caisse Démo · ' + (pl ? pl.nom : '')); t('Journée du ' + frDate(d)); t('Imprimé le ' + frDate(now) + ' à ' + now.slice(11, 16));
  st('align="left"'); t(SEP);
  st('em="true"'); t('Ventes'); st('em="false"');
  t(tkLine('Nombre de ventes', String(ok.length)));
  if (all.length - ok.length) t(tkLine('Ventes annulées (non comptées)', String(all.length - ok.length)));
  t(tkLine('Total des ventes', tkMoney(ok.reduce(function (a, v) { return a + v.total; }, 0))));
  t(tkLine('  dont cash', tkMoney(ok.reduce(function (a, v) { return a + v.paiement.cash; }, 0))));
  t(tkLine('  dont Bancontact', tkMoney(ok.reduce(function (a, v) { return a + v.paiement.bancontact; }, 0))));
  var cmds = ok.filter(function (v) { return v.commande; });
  if (cmds.length) {
    t(tkLine('  dont payé à la commande', tkMoney(cmds.reduce(function (a, v) { return a + (Number(v.commande.dejaPaye) || 0); }, 0))));
    t('Commandes retirées : ' + cmds.length);
    cmds.forEach(function (v) { t(tkLine('  Commande n° ' + cmdNum(v.commande.numero) + ' · déjà payé ' + tkMoney(v.commande.dejaPaye || 0), 'encaissé ' + tkMoney(v.paiement.cash + v.paiement.bancontact))); });
  }
  t(SEP); st('em="true"'); t('Caisse (argent liquide)'); st('em="false"');
  t(tkLine('Fond de caisse' + (c.fond && c.fond.source === 'admin' ? ' (Admin)' : ''), s.fond == null ? 'non saisi' : tkMoney(s.fond)));
  t(tkLine('+ Ventes en cash', tkMoney(s.ventes)));
  c.mouvements.forEach(function (m) { t(tkLine((m.type === 'retrait' ? '- ' : '+ ') + hm(m.horodatage) + ' ' + m.motif + (m.source === 'admin' ? ' (Admin)' : ''), tkMoney(m.montant))); });
  c.comptages.forEach(function (k) { if (k.recette > 0.005) t(tkLine('- ' + hm(k.horodatage) + ' Recette de fin de journée', tkMoney(k.recette))); });
  st('em="true"'); t(tkLine('= Attendu en caisse', tkMoney(s.attendu))); st('em="false"');
  if (s.comptage) {
    var k = s.comptage;
    t(tkLine((k.horodatage.slice(0, 10) !== d ? 'Compté le ' + frDate(k.horodatage).slice(0, 5) + ' à ' : 'Compté à ') + k.horodatage.slice(11, 16) + (k.source === 'admin' ? ' (Admin)' : ''), tkMoney(k.montant)));
    st('em="true"'); t(tkLine('Écart', (k.ecart > 0 ? '+' : '') + tkMoney(k.ecart))); st('em="false"');
    if (k.laisse != null) t(tkLine('Laissé en caisse pour demain', tkMoney(k.laisse)));
    if (k.detail) {
      t(SEP); t('Détail du comptage');
      COUPURES.forEach(function (v) { var q = parseInt(k.detail[String(v)], 10) || 0; if (q) t(tkLine('  ' + q + ' × ' + coupLabel(v), tkMoney(q * v))); });
    }
  } else t('Caisse pas encore comptée');
  var sans = (S.tiroir[d] || []).filter(function (o) { return !o.venteId; }).length;
  t(SEP); t(tkLine('Ouvertures du tiroir sans vente', String(sans)));
  return x + '<feed line="3"/><cut type="feed"/>';
}
function cxPrint(d) {
  S.prBusy = true; render();
  eposSend(cxReportXml(d), 15000).then(function (r) { S.prBusy = false; toast(r.ok ? 'Rapport imprimé' : 'Rapport non imprimé : ' + r.text); render(); });
}

/* ---------- Commandes à retirer au stand ----------
   Fichier écrit par l'App admin : <GH_DOSSIER>/commandes/<AAAA>.json (format agri-garden-caisse/commandes, `commandes` indexé par id).
   La caisse lit le fichier (copie locale réduite aux commandes « retrait » de son stand, pour le hors ligne) et met à jour SEULEMENT
   la commande encaissée : statut, paye, encaissement, historique, modifieLe (+ majLe/majPar du fichier). Relecture + PUT avec le sha lu,
   3 essais sur 409/422, file d'attente hors ligne. Les articles d'une commande ont déjà été retirés du stock par l'Admin :
   une vente avec `commande` n'est jamais déduite du stock. */
var CMD_DIR = GH_DOSSIER + '/commandes';
var CMD_KEY = STORE_KEY + '-commandes';
var CMD = { files: {}, queue: [], alerts: [], lu: null, err: null, busy: false, loading: false, last: 0 };
try { var cmdSaved = JSON.parse(localStorage.getItem(CMD_KEY) || 'null'); if (cmdSaved) { CMD.files = cmdSaved.files || {}; CMD.queue = cmdSaved.queue || []; CMD.alerts = cmdSaved.alerts || []; CMD.lu = cmdSaved.lu || null; } } catch (e) {}
function saveCmd() { try { localStorage.setItem(CMD_KEY, JSON.stringify({ files: CMD.files, queue: CMD.queue, alerts: CMD.alerts, lu: CMD.lu })); refreshUsage(); return true; } catch (e) { return false; } }
function cmdYears() { var d = new Date(), y = d.getFullYear(); return d.getMonth() === 0 ? [y - 1, y] : [y]; }
function cmdPaid(c) { return r2(Number(c && c.paye && c.paye.montant) || 0); }
function cmdReste(c) { return r2(Math.max(0, (Number(c.total) || 0) - cmdPaid(c))); }
function cmdNum(n) { return n != null && n !== '' ? String(n) : '…'; }
function cmdModeTxt(m) { return m === 'cash' ? 'cash' : m === 'bancontact' ? 'Bancontact' : m === 'virement' ? 'virement' : m === 'mixte' ? 'mixte' : ''; }
function cmdMine(c) { return !!(c && c.mode === 'retrait' && c.retrait && c.retrait.stand && c.retrait.stand.id === S.placeId); }
/* Copie locale : seulement les commandes « retrait » de ce stand (moins de données personnelles sur la tablette) */
function cmdTakeFile(y, d) {
  var keep = {}, cs = (d && d.commandes) || {};
  Object.keys(cs).forEach(function (id) { if (cmdMine(cs[id])) keep[id] = cs[id]; });
  CMD.files[y] = { place: S.placeId, commandes: keep }; CMD.lu = isoLocal(new Date());
}
function cmdYearOf(id) {
  var y = null; Object.keys(CMD.files).forEach(function (k) { if (CMD.files[k].commandes && CMD.files[k].commandes[id]) y = k; });
  if (!y) { var m = /^cmd-(\d{4})/.exec(id || ''); y = m ? m[1] : String(new Date().getFullYear()); }
  return y;
}
/* Vente non annulée de la tablette liée à cette commande */
function cmdLocalSale(id) { var r = null; Object.keys(S.days).forEach(function (d) { (S.days[d] || []).forEach(function (v) { if (v.commande && v.commande.id === id && !v.annulation) r = { date: d, v: v }; }); }); return r; }
/* Commandes du stand : dernière lecture + opérations en attente d'envoi */
function cmdList() {
  var out = [];
  Object.keys(CMD.files).forEach(function (y) {
    var f = CMD.files[y]; if (!f || f.place !== S.placeId) return;
    Object.keys(f.commandes || {}).forEach(function (id) {
      var c = f.commandes[id]; if (!cmdMine(c) || c.statut === 'annulee') return;
      var x = { id: id, annee: y, c: c, statut: c.statut, enc: c.encaissement || null, attente: false };
      var pend = CMD.queue.filter(function (o) { return o.id === id; }).pop(), loc = cmdLocalSale(id);
      if (pend && pend.op === 'encaisser') { x.statut = 'livree'; x.attente = true; x.enc = { venteId: pend.venteId, horodatage: pend.horodatage }; }
      else if (pend && pend.op === 'annuler') { x.statut = 'prete'; x.enc = null; x.attente = true; }
      else if (loc && x.statut !== 'livree') { x.statut = 'livree'; x.attente = true; x.enc = { venteId: loc.v.id, horodatage: loc.v.horodatage }; }
      out.push(x);
    });
  });
  return out;
}
function cmdTodoCount() { var t = today(); return cmdList().filter(function (x) { return x.statut !== 'livree' && x.c.retrait.date && x.c.retrait.date <= t; }).length; }
async function cmdReadYear(y) {
  var r = await ghApi('GET', ghUrl(CMD_DIR + '/' + y + '.json'), GH.token);
  if (r.status === 404) return null;
  if (!r.ok) throw r.status;
  var j = await r.json();
  return { sha: j.sha, data: JSON.parse(b64utf8d(j.content)) };
}
/* Lecture : à l'ouverture de l'écran (force), au démarrage et à chaque passage de l'envoi automatique (20 s mini) */
async function cmdRefresh(force) { if (!FEAT('commandesCaisse')) return;
  if (!ghReady() || navigator.onLine === false || CMD.loading || CMD.busy || !S.placeId) return;
  if (!force && Date.now() - CMD.last < 20000) return;
  CMD.loading = true; CMD.last = Date.now(); render();
  try {
    var ys = cmdYears(), seen = {};
    for (var i = 0; i < ys.length; i++) {
      var f = await cmdReadYear(ys[i]);
      if (f && f.data && f.data.format === 'agri-garden-caisse/commandes') { cmdTakeFile(String(ys[i]), f.data); seen[ys[i]] = true; }
      else delete CMD.files[String(ys[i])];
    }
    Object.keys(CMD.files).forEach(function (y) { if (!seen[y] && ys.indexOf(Number(y)) < 0) delete CMD.files[y]; });
    CMD.lu = isoLocal(new Date()); CMD.err = null; saveCmd();
  } catch (e) { var c = typeof e === 'number' ? e : 0; if (c === 401) { delete GH.token; saveGh(); } CMD.err = c; }
  finally { CMD.loading = false; render(); }
}
/* Applique une opération ({op:'encaisser'|'annuler', annee, id, venteId, …}) sur la seule commande concernée */
async function cmdApply(op) {
  var url = ghUrl(CMD_DIR + '/' + op.annee + '.json'), pl = findPlace(S.placeId);
  for (var essai = 0; essai < 3; essai++) {
    var r = await ghApi('GET', url, GH.token);
    if (r.status === 404) { if (op.op === 'encaisser') throw 'annulee'; return null; }
    if (!r.ok) throw r.status;
    var j = await r.json(), d = JSON.parse(b64utf8d(j.content)), cs = d.commandes || {}, c = cs[op.id], now = isoLocal(new Date());
    if (op.op === 'encaisser') {
      if (!c || c.statut === 'annulee') throw 'annulee';
      if (c.encaissement) { if (c.encaissement.venteId === op.venteId) return d; throw 'deja'; }
      c.statut = 'livree';
      c.paye = { montant: r2(op.dejaPaye + op.montant), mode: op.montant > 0 ? op.paiement.mode : ((c.paye && c.paye.mode) || '') };
      c.encaissement = { venteId: op.venteId, horodatage: op.horodatage, montant: op.montant, paiement: op.paiement, pointDeVente: op.pdv, appareil: GH.appareil };
      c.historique = Array.isArray(c.historique) ? c.historique : [];
      c.historique.push({ statut: 'livree', le: op.horodatage, source: 'caisse' });
    } else {
      if (!c || !c.encaissement || c.encaissement.venteId !== op.venteId) return d; // rien à défaire
      delete c.encaissement; c.statut = 'prete';
      c.paye = { montant: r2(op.dejaPaye), mode: op.modeAvant || '' };
      c.historique = Array.isArray(c.historique) ? c.historique : [];
      c.historique.push({ statut: 'prete', le: now, source: 'caisse', motif: 'Vente n° ' + saleNum(op.venteId) + ' annulée à la caisse' });
    }
    c.modifieLe = now; d.majLe = now; d.majPar = 'caisse';
    var w = await ghApi('PUT', url, GH.token, { message: 'Commande n° ' + cmdNum(c.numero) + (op.op === 'encaisser' ? ' retirée' : ' remise à retirer') + ' (Caisse ' + (pl ? pl.nom : S.placeId) + ')', content: b64utf8(JSON.stringify(d, null, 2)), sha: j.sha });
    if (w.ok) return d;
    if (w.status === 409 || w.status === 422) continue;
    throw w.status;
  }
  throw 409;
}
/* Envoi de la file d'attente (mêmes déclencheurs que l'envoi automatique des ventes) */
async function cmdSync() {
  if (CMD.busy || !CMD.queue.length || !ghReady() || navigator.onLine === false) return;
  CMD.busy = true; render();
  try {
    while (CMD.queue.length) {
      var op = CMD.queue[0], d;
      try { d = await cmdApply(op); if (d) cmdTakeFile(String(op.annee), d); }
      catch (e) {
        if (e !== 'annulee' && e !== 'deja') throw e;
        var txt = e === 'annulee' ? 'Commande n° ' + cmdNum(op.numero) + ' annulée dans l’Admin : prévenir le responsable (la vente n° ' + saleNum(op.venteId) + ' est gardée).'
          : 'Commande n° ' + cmdNum(op.numero) + ' déjà retirée avec une autre vente : prévenir le responsable (la vente n° ' + saleNum(op.venteId) + ' est gardée).';
        CMD.alerts.push({ id: op.id, texte: txt, le: isoLocal(new Date()) }); toast(txt);
      }
      CMD.queue.shift(); saveCmd();
    }
    CMD.err = null;
  } catch (e) { var c = typeof e === 'number' ? e : 0; if (c === 401) { delete GH.token; saveGh(); } CMD.err = c; saveCmd(); }
  finally { CMD.busy = false; render(); }
}

/* ---------- Vues ---------- */
function vCxDays() {
  var t = today(), ds = [t].concat(Object.keys(S.days).filter(function (d) { return (S.days[d] || []).length; }), cxDates().filter(function (d) { return cxDay(d); })).filter(function (d, i, a) { return d <= t && a.indexOf(d) === i; }).sort().reverse();
  if (ds.length < 2) return '';
  return '<div class="hdays cxdays">' + ds.map(function (d) {
    var todo = d !== t && cxNeedsCount(d);
    return '<button class="choice' + (d === cxD() ? ' on' : '') + '" data-a="cxDay" data-v="' + d + '">' + (d === t ? 'Aujourd’hui' : frDate(d).slice(0, 5)) + (todo ? ' <span class="todo">à compter</span>' : '') + '</button>';
  }).join('') + '</div>';
}
function vCxSync(d) {
  var n = CXF.queue.filter(function (o) { return o.date === d; }).length, sn = CXF.snap[d];
  if (CXF.busy) return '<div class="rcstat">Envoi des saisies…</div>';
  if (n) {
    var why = !ghReady() ? 'envoi GitHub verrouillé : touchez le bandeau ☁ de l’accueil' : navigator.onLine === false ? 'pas de réseau : envoi dès le retour d’internet' : CXF.err != null && CXF.err !== 'pasmien' ? ghError(CXF.err) : 'envoi dans quelques instants';
    return '<div class="rcstat warn">' + n + ' saisie' + (n > 1 ? 's' : '') + ' en attente sur la tablette (' + esc(why) + ')</div>';
  }
  if (CXF.err === 'pasmien') return '<div class="rcstat ko">Une suppression a été refusée : cette saisie a été faite dans l’App admin.</div>';
  return sn && sn.lu ? '<div class="rcstat ok">Fichier de caisse partagé avec l’App admin · lu le ' + frDate(sn.lu).slice(0, 5) + ' à ' + sn.lu.slice(11, 16) + '</div>' : '';
}
function vCcGrid() {
  function row(v) { var k = String(v), q = S.cc[k] || ''; return '<label class="ccrow"><span>' + coupLabel(v) + '</span><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0" data-f="cc:' + k + '" value="' + esc(q) + '"><b id="ccs-' + k.replace('.', '_') + '">' + (q ? money(v * q) : '') + '</b></label>'; }
  return '<div class="ccgrid"><div class="cccol"><div class="rccat">Billets</div>' + COUPURES.filter(function (v) { return v >= 5; }).map(row).join('') + '</div>' +
    '<div class="cccol"><div class="rccat">Pièces</div>' + COUPURES.filter(function (v) { return v < 5; }).map(row).join('') + '</div></div>';
}
function ccAmount() { return S.ccMode === 'detail' ? ccTotal(S.cc) : r2(num(S.cxMontant)); }
function vFond() {
  var isT = cxD() === today(), prop = isT ? cxFondPropose() : null, c = cxDay(cxD());
  return '<div class="overlay"><div class="modal rcmodal" data-keep="fond"><div class="row"><h2>Fond de caisse</h2><button class="btn" data-a="close">' + (c && c.fond ? 'Fermer' : 'Plus tard') + '</button></div>' +
    '<div class="sub">Argent présent dans le tiroir à l’ouverture du ' + frDate(cxD()) + (prop != null ? '. Estimé dans le tiroir à la dernière fermeture : <strong>' + money(prop) + '</strong>.' : '.') + (c && c.fond ? ' Fond actuel : ' + money(c.fond.montant) + (c.fond.source === 'admin' ? ' (Admin)' : '') + ' ; un nouveau montant le remplace.' : '') + '</div>' +
    '<div class="seg" style="align-self:flex-start"><button class="' + (S.ccMode !== 'detail' ? 'on' : '') + '" data-a="ccMode" data-v="total">Montant total</button><button class="' + (S.ccMode === 'detail' ? 'on' : '') + '" data-a="ccMode" data-v="detail">Billets et pièces</button></div>' +
    (function () { var pd = isT ? cxPrevUncounted() : null; if (!pd) return ''; var ps = cxSummary(pd);
      var pk = (cxDay(pd) || { comptages: [] }).comptages.slice(-1)[0], pdl = cxDelta(pd);
      return '<div class="cxprev"><div><strong>' + (pk ? 'La caisse du ' + frDate(pd).slice(0, 5) + ' a changé depuis son comptage de ' + pk.horodatage.slice(11, 16) + ' (' + signed(pdl) + ' en cash).' : 'La caisse du ' + frDate(pd).slice(0, 5) + ' n’a pas été comptée.') + '</strong> Attendu en fin de journée : ' + money(ps.attendu) + '.</div>' +
        '<button class="rcchip' + (S.fondPrev ? ' on' : '') + '" data-a="fondPrevTog">' + (S.fondPrev ? '✓ ' : '') + 'Compter aussi comme fin de journée du ' + frDate(pd).slice(0, 5) + '</button>' +
        '<div class="sub">À laisser coché si personne n’a touché au tiroir depuis la fermeture : le montant saisi devient le comptage du ' + frDate(pd).slice(0, 5) + ' (avec son écart) et le fond d’aujourd’hui.</div></div>'; })() +
    (S.ccMode === 'detail' ? vCcGrid() : '<label class="f">Montant (€)<input type="text" inputmode="decimal" data-f="cxMontant" value="' + esc(S.cxMontant) + '" placeholder="0,00" autocomplete="off"></label>') +
    '<div class="rcfoot"><span class="rctot">Fond : <span id="ccTot">' + money(ccAmount()) + '</span></span><button class="btn btn-primary" data-a="fondSave">Enregistrer le fond</button></div></div></div>';
}
function vCxMv() {
  var ret = S.cxType === 'retrait', motifs = ret ? RETRAIT_MOTIFS : APPORT_MOTIFS, s = cxSummary(cxD());
  return '<div class="overlay"><div class="modal"><div class="row"><h2>' + (ret ? 'Retrait d’argent' : 'Apport d’argent') + '</h2><button class="btn" data-a="cxBack">Retour</button></div>' +
    '<div class="sub">' + (ret ? 'Billets ou pièces sortis du tiroir en cours de journée. ' : 'Argent ajouté dans le tiroir en cours de journée. ') + 'Attendu en caisse avant : <strong>' + money(s.attendu) + '</strong>.</div>' +
    '<label class="f">Montant (€)<input type="text" inputmode="decimal" data-f="cxMontant" value="' + esc(S.cxMontant) + '" placeholder="0,00" autocomplete="off"></label>' +
    '<div class="f"><span class="sub" style="font-weight:700">Motif</span><div class="rcchips">' + motifs.map(function (m) { return '<button class="rcchip' + (S.cxMotif === m ? ' on' : '') + '" data-a="cxMotif" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') + '</div></div>' +
    (S.cxMotif === 'Autre' ? '<label class="f">Précisez<input type="text" data-f="cxAutre" value="' + esc(S.cxAutre) + '" maxlength="80" autocomplete="off"></label>' : '') +
    (S.cxMsg ? '<div class="rcmsg warn">' + esc(S.cxMsg) + '</div>' : '') +
    '<div class="actions"><button class="btn" data-a="cxBack">Annuler</button><button class="btn btn-primary" data-a="cxMvSave">' + (ret ? 'Enregistrer le retrait' : 'Enregistrer l’apport') + '</button></div></div></div>';
}
function vComptage() {
  var s = cxSummary(cxD()), amt = ccAmount(), ec = r2(amt - s.attendu);
  return '<div class="overlay"><div class="modal rcmodal" data-keep="cpt"><div class="row"><h2>Compter la caisse</h2><button class="btn" data-a="cxBack">Retour</button></div>' +
    '<div class="sub">Comptez tout l’argent du tiroir. Attendu : <strong>' + money(s.attendu) + '</strong> (fond ' + (s.fond == null ? 'non saisi' : money(s.fond)) + ' + ventes cash ' + money(s.ventes) + (s.apports ? ' + apports ' + money(s.apports) : '') + (s.retraits ? ' − retraits ' + money(s.retraits) : '') + (s.recettes ? ' − recettes ' + money(s.recettes) : '') + ').</div>' +
    '<div class="seg" style="align-self:flex-start"><button class="' + (S.ccMode === 'detail' ? 'on' : '') + '" data-a="ccMode" data-v="detail">Billets et pièces</button><button class="' + (S.ccMode !== 'detail' ? 'on' : '') + '" data-a="ccMode" data-v="total">Montant total</button></div>' +
    (S.ccMode === 'detail' ? vCcGrid() : '<label class="f">Montant compté (€)<input type="text" inputmode="decimal" data-f="cxMontant" value="' + esc(S.cxMontant) + '" placeholder="0,00" autocomplete="off"></label>') +
    '<div class="cxres"><div><span class="sub">Compté</span><strong id="ccTot">' + money(amt) + '</strong></div><div><span class="sub">Attendu</span><strong>' + money(s.attendu) + '</strong></div><div><span class="sub">Écart</span><strong id="ccEc" class="' + (Math.abs(ec) < 0.005 ? 'okc' : 'koc') + '">' + signed(ec) + '</strong></div></div>' +
    '<label class="f">Laisser en caisse pour demain (€)<input type="text" inputmode="decimal" data-f="cxLaisse" value="' + esc(S.cxLaisse) + '" placeholder="Obligatoire" autocomplete="off"></label>' +
    '<div class="rcchips"><button class="rcchip' + (S.cxLaisse === '0' ? ' on' : '') + '" data-a="cxLaisseSet" data-v="0">Tout retirer (0 €)</button><button class="rcchip" data-a="cxLaisseSet" data-v="tout">Tout laisser</button></div>' +
    '<div class="sub">La recette (compté − laissé) est retirée du tiroir et notée dans le comptage.</div>' +
    (S.cxMsg ? '<div class="rcmsg warn">' + esc(S.cxMsg) + '</div>' : '') +
    '<div class="actions"><button class="btn" data-a="cxBack">Annuler</button><button class="btn btn-primary" data-a="cptSave">Enregistrer le comptage</button></div></div></div>';
}
function vCaisseDuJour() {
  var d = cxD(), s = cxSummary(d), c = cxDay(d) || { mouvements: [], comptages: [], entrees: [] }, k = s.comptage, ok = validSales(salesOf(d)), bc = r2(ok.reduce(function (a, v) { return a + v.paiement.bancontact; }, 0));
  var line = function (l, v, cls, act) { return '<div class="cxl ' + (cls || '') + '"><span>' + l + '</span><span class="cxv">' + v + (act || '') + '</span></div>'; };
  var adm = function (e) { return e && e.source === 'admin' ? ' <span class="adm">Admin</span>' : ''; };
  var TYP = { fond: 'Fond de caisse', retrait: 'Retrait', apport: 'Apport', comptage: 'Comptage' };
  var journal = c.entrees.slice().reverse().map(function (e) {
    var hm = (e.horodatage.slice(0, 10) !== d ? frDate(e.horodatage).slice(0, 5) + ' ' : '') + e.horodatage.slice(11, 16);
    var txt = TYP[e.type] + (e.motif ? ' · ' + esc(e.motif) : '') + (e.type === 'comptage' ? ' · laissé ' + money(e.laisse) + (e.recette > 0.005 ? ', recette ' + money(e.recette) : '') + (e.viaFond ? ' (avec le fond du lendemain)' : '') : '');
    var val = e.type === 'retrait' ? '−' + money(e.montant) : e.type === 'apport' ? '+' + money(e.montant) : money(e.montant);
    var replaced = e.type === 'fond' && c.fond && c.fond.id !== e.id;
    var act = !cxOwn(e) ? '' : S.cxDel === e.id ? '<button class="btn btn-danger" data-a="cxDelGo" data-v="' + esc(e.id) + '" style="border:1px solid var(--red)">Confirmer la suppression</button><button class="btn" data-a="cxDelNo">Annuler</button>' : '<button class="btn btn-danger" data-a="cxDelAsk" data-v="' + esc(e.id) + '">Supprimer</button>';
    return '<div class="rchist' + (replaced ? ' repl' : '') + '"><div class="rch-top"><strong>' + hm + ' · ' + txt + '</strong><strong>' + val + '</strong></div>' +
      '<div class="rch-a"><span class="sub" style="margin-right:auto">' + srcLabel(e) + (e.attente ? ' · <b class="rcwait">en attente d’envoi</b>' : '') + (replaced ? ' · remplacé' : '') + '</span>' + act + '</div></div>';
  }).join('');
  return '<div class="overlay"><div class="modal rcmodal" data-keep="cx"><div class="row"><h2>' + (d === today() ? 'Caisse du jour' : 'Caisse du ' + frDate(d).slice(0, 5)) + '</h2><button class="btn" data-a="close">Fermer</button></div>' +
    vCxDays() + '<div class="sub">' + frDate(d) + ' · argent liquide du tiroir. Bancontact du jour : ' + money(bc) + ' (hors tiroir).</div>' +
    vCxSync(d) +
    (S.cxDone ? '<div class="rcmsg ' + (S.cxDone.ok ? 'ok' : 'warn') + '">' + esc(S.cxDone.text) + '</div>' : '') +
    (function () { var dl = cxDelta(d); if (dl === null || Math.abs(dl) < 0.005) return ''; return '<div class="rcstat ko">Depuis le comptage de ' + k.horodatage.slice(11, 16) + ' : ' + signed(dl) + ' en cash (ventes, retraits, apports ou fond modifié). Recomptez la caisse.</div>'; })() +
    '<div class="cxsum">' +
      line('Fond de caisse' + adm(c.fond), s.fond == null ? '<em>non saisi</em>' : money(s.fond), '', ' <button class="small" data-a="fondOpen">' + (s.fond == null ? 'Saisir' : 'Modifier') + '</button>') +
      line('+ Ventes en cash', money(s.ventes)) +
      (s.apports ? line('+ Apports', money(s.apports)) : '') +
      (s.retraits ? line('− Retraits', money(s.retraits)) : '') +
      (s.recettes ? line('− Recettes retirées', money(s.recettes)) : '') +
      line('= Attendu en caisse', money(s.attendu), 'tot') +
      (k ? line((k.horodatage.slice(0, 10) !== d ? 'Compté le ' + frDate(k.horodatage).slice(0, 5) + ' à ' : 'Compté à ') + k.horodatage.slice(11, 16) + adm(k), money(k.montant)) + line('Écart au comptage', signed(k.ecart), Math.abs(k.ecart) < 0.005 ? 'okl' : 'kol') + (k.laisse != null ? line('Laissé pour demain', money(k.laisse)) : '') : '') +
    '</div>' +
    '<div class="cxbtns"><button class="btn" data-a="cxMvOpen" data-v="retrait">− Retrait</button><button class="btn" data-a="cxMvOpen" data-v="apport">+ Apport</button><button class="btn btn-primary" data-a="cptOpen">' + (k ? 'Recompter la caisse' : 'Compter la caisse') + '</button></div>' +
    (prConfigured() ? '<div class="actions" style="justify-content:flex-start"><button class="btn" data-a="cxPrint"' + (S.prBusy ? ' disabled' : '') + '>Imprimer le rapport</button></div>' : '') +
    '<h3 class="rch3">Journal de la caisse</h3>' +
    (journal || '<div class="sub">Aucune saisie ce jour-là.</div>') +
    '<div class="sub">Les saisies faites dans l’App admin (Gestion d’événement › Caisse) apparaissent ici avec la mention « Admin » ; seules celles de cette tablette peuvent être supprimées ici.</div>' +
    '<h3 class="rch3">Aperçu du rapport</h3><div class="tkpaper">' + ticketHtml(cxReportXml(d)) + '</div>' +
    '</div></div>';
}

/* ---------- Imprimante de tickets et tiroir-caisse (Epson TM-m30III, service ePOS-Print) ----------
   La caisse envoie les ordres en HTTPS à l'imprimante (même réseau Wi-Fi que la tablette). Le tiroir-caisse est branché
   sur la prise « DK » de l'imprimante : il ne s'ouvre que sur ordre de la caisse (ou avec sa clé).
   Une vente n'est JAMAIS bloquée par l'imprimante : en cas d'échec, la vente reste enregistrée et un message s'affiche. */
var PR_KEY = STORE_KEY + '-imprimante';
/* Adresse par défaut : celle des TM-m30III en Wi-Fi direct (SimpleAP). Utilisée tant que l'imprimante n'a jamais été
   réglée sur la tablette ; après « Retirer l'imprimante », elle n'est plus remise. */
var PR_IP_DEFAUT = ''; // démo : pas d'imprimante par défaut
var PR = {}, prStored = null;
try { prStored = localStorage.getItem(PR_KEY); PR = JSON.parse(prStored) || {}; } catch (e) { PR = {}; }
function savePr() { try { localStorage.setItem(PR_KEY, JSON.stringify(PR)); return true; } catch (e) { return false; } }
if (prStored === null && PR_IP_DEFAUT) { PR.ip = PR_IP_DEFAUT; savePr(); }
function prConfigured() { return FEAT('imprimante') && !!PR.ip; }
function prBase(ip) { ip = String(ip || '').trim().replace(/\/+$/, ''); return /^https?:\/\//i.test(ip) ? ip : 'https://' + ip; }
var EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';
var PR_ST = { state: null, text: '', at: 0 }; // dernier état connu de l'imprimante
function xmlEsc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
/* Lecture des bits d'état ePOS-Print (ASB) */
function prDecode(st, ok, code) {
  if (st & 0x20) return { state: 'ko', text: 'Capot ouvert' };
  if (st & 0x80000) return { state: 'ko', text: 'Plus de papier' };
  if (st & (0x400 | 0x800 | 0x2000)) return { state: 'ko', text: 'Erreur imprimante' };
  if (st & 0x8) return { state: 'ko', text: 'Imprimante hors ligne' };
  if (!ok) return { state: 'ko', text: code === 'EX_TIMEOUT' ? 'Imprimante occupée (délai dépassé)' : 'Imprimante : ' + (code || 'erreur') };
  if (st & 0x20000) return { state: 'warn', text: 'Papier bientôt fini' };
  return { state: 'ok', text: 'Imprimante prête' };
}
/* Envoi d'un document ePOS-Print. Résout toujours : { ok, text, state }. */
function eposSend(inner, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  var url = prBase(PR.ip) + '/cgi-bin/epos/service.cgi?devid=' + encodeURIComponent(PR.devid || 'local_printer') + '&timeout=' + timeoutMs;
  var soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    '<epos-print xmlns="' + EPOS_NS + '">' + inner + '</epos-print></s:Body></s:Envelope>';
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs + 5000);
  return fetch(url, { method: 'POST', body: soap, cache: 'no-store', signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT', 'SOAPAction': '""' } })
    .then(function (r) { return r.text(); })
    .then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'text/xml'), res = doc.getElementsByTagName('response')[0];
      if (!res) return { ok: false, state: 'ko', text: 'Réponse inattendue de l’imprimante' };
      var ok = res.getAttribute('success') === 'true', st = parseInt(res.getAttribute('status') || '0', 10) || 0;
      var d = prDecode(st, ok, res.getAttribute('code'));
      return { ok: ok, state: d.state, text: d.text };
    })
    .catch(function () { return { ok: false, state: 'off', text: 'Imprimante injoignable' }; })
    .then(function (r) { clearTimeout(timer); PR_ST = { state: r.state, text: r.text, at: Date.now() }; return r; });
}
function prHelp(r) { return r.state === 'off' ? ' Vérifiez que l\u2019imprimante est allumée, sur le même Wi-Fi que la tablette, que l\u2019adresse est juste, et que son certificat a été accepté (bouton « Accepter le certificat »).' : ''; }
function prCheck() { if (!prConfigured()) return Promise.resolve(null); return eposSend('', 5000).then(function (r) { render(); return r; }); }
/* Ouverture du tiroir (impulsion sur la prise DK). Toujours notée dans le journal du jour. */
function drawerOpen(motif, venteId) {
  if (!prConfigured() || !FEAT('tiroir')) return Promise.resolve({ ok: false });
  logDrawer(motif, venteId);
  return drawerPulse();
}
function payDrawerOpen() { if (prConfigured() && FEAT('tiroir') && !S.payDrawer) { S.payDrawer = logDrawer('Encaissement abandonné', null); drawerPulse(); } }
function drawerPulse() {
  return eposSend('<pulse drawer="drawer_1" time="pulse_100"/>', 5000).then(function (r) {
    if (!r.ok) toast('Tiroir non ouvert : ' + r.text + '. Utilisez la clé du tiroir.');
    render(); return r;
  });
}
function logDrawer(motif, venteId) {
  var d = today(), l = S.tiroir[d] || (S.tiroir[d] = []);
  var e = { horodatage: isoLocal(new Date()), motif: motif, venteId: venteId || null };
  l.push(e); persist(); return e;
}
/* Ticket (mise en page provisoire, à retravailler avec le gérant) : 48 caractères par ligne en police A */
/* ---------- Ticket : contenu et mise en page (proposition 1, à valider avec le gérant) ----------
   Les champs vides ne sont pas imprimés ; dans l'aperçu, ils apparaissent comme « [à compléter] ». */
var TICKET = {}; themeTicket(TICKET); // coordonnées du commerce : Admin › Paramètres › Apparence (theme.json)
var TK_W = 48; // caractères par ligne (police A) : 48 en 80 mm, 32 en 58 mm (Apparence du ticket)
function tkSync() { TK_W = themeGet().ticket.papier === '58' ? 32 : 48; }
tkSync();
/* caractères absents de la page de codes de l'imprimante */
function tkTxt(s) { return String(s).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/−/g, '-').replace(/ /g, ' '); }
function tkDiscLabel(r, base) { return r.type === 'pourcentage' ? base + ' ' + String(r.valeur).replace('.', ',') + ' %' : base; }
function tkMoney(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); }
function tkLine(left, right, w) { w = w || TK_W; left = String(left); right = String(right || ''); var sp = w - left.length - right.length; if (sp < 1) return tkWrap(left, w).concat([pad2(right, w)]).join('\n'); return left + Array(sp + 1).join(' ') + right; }
function pad2(right, w) { return Array(Math.max(0, w - right.length) + 1).join(' ') + right; }
/* coupe un texte en lignes de w caractères (au niveau des espaces) */
function tkWrap(s, w) {
  w = w || TK_W; var out = [], line = '';
  String(s).split(/\s+/).forEach(function (word) {
    while (word.length > w) { if (line) { out.push(line); line = ''; } out.push(word.slice(0, w)); word = word.slice(w); }
    if (!word) return;
    if (!line) line = word; else if (line.length + 1 + word.length <= w) line += ' ' + word; else { out.push(line); line = word; }
  });
  if (line) out.push(line);
  return out;
}
/* Logo en noir et blanc pour l'imprimante (raster 1 bit, 384 points de large ≈ 2/3 du papier). Préparé une fois au démarrage. */
var LOGO_RASTER = null;
function tkPrepLogo() {
  var TT = themeGet().ticket; if (TT.logoTaille === 'aucun') { LOGO_RASTER = null; return; }
  try {
    var img = new Image();
    img.onload = function () {
      var maxw = TT.papier === '58' ? 384 : 576, w = Math.min(maxw, TT.logoTaille === 'petit' ? 256 : TT.logoTaille === 'grand' ? 512 : 384); w -= w % 8; var h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      var px = g.getImageData(0, 0, w, h).data, bpr = Math.ceil(w / 8), bytes = new Uint8Array(bpr * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4, m = Math.min(px[i], px[i + 1], px[i + 2]); // gris du dessin et vert du texte → noir
        if (m < 175) bytes[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
      }
      var s = ''; for (var k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
      LOGO_RASTER = { w: w, h: h, data: btoa(s) };
      if (S.modal === 'tkprev') render();
    };
    img.src = themeLogo('ticket');
  } catch (e) {}
}
tkPrepLogo();
function ticketXml(v, opts) {
  opts = opts || {}; tkSync();
  var TT = themeGet().ticket, AF = TT.afficher;
  var p = v.paiement, x = '<text lang="fr"/>', ap = !!opts.apercu, SEP = Array(TK_W + 1).join(TT.separateur), SEP2 = Array(TK_W + 1).join('=');
  function t(s) { x += '<text>' + xmlEsc(tkTxt(s)) + '&#10;</text>'; }
  function st(a) { x += '<text ' + a + '/>'; }
  function opt(val, label) { if (val) t(val); else if (ap) t('[' + label + ' à compléter]'); }
  st('align="' + (TT.entete === 'gauche' ? 'left' : 'center') + '"');
  if (opts.duplicata) { st('reverse="true" em="true" dw="true" dh="true"'); t(' DUPLICATA '); st('reverse="false" em="false" dw="false" dh="false"'); x += '<feed line="1"/>'; }
  if (LOGO_RASTER) x += '<image width="' + LOGO_RASTER.w + '" height="' + LOGO_RASTER.h + '" color="color_1" mode="mono">' + LOGO_RASTER.data + '</image>';
  if (!LOGO_RASTER || TT.nomGrand) { st('dw="true" dh="true" em="true"'); tkWrap(themeGet().nom, TK_W / 2).forEach(function (s) { t(s); }); st('dw="false" dh="false" em="false"'); }
  if (TICKET.activite) { st('em="true"'); t(TICKET.activite); st('em="false"'); }
  (TICKET.adresse.length ? TICKET.adresse : ap ? [''] : []).forEach(function (l) { opt(l, 'Adresse'); });
  opt(TICKET.telephone || '', 'Téléphone');
  opt(TICKET.email || '', 'E-mail');
  opt(TICKET.tva ? 'TVA ' + TICKET.tva : '', 'N° TVA');
  if (TICKET.site) t(TICKET.site);
  if (TT.messageEntete) { x += '<feed line="1"/>'; st('em="true"'); tkWrap(TT.messageEntete).forEach(function (s) { t(s); }); st('em="false"'); }
  x += '<feed line="1"/>';
  st('align="left"');
  var num = v.id.split('-').pop();
  if (AF.numero || AF.date) t(tkLine(AF.numero ? 'Ticket n° ' + num : '', AF.date ? frDate(v.horodatage) + ' ' + v.horodatage.slice(11, 16) : ''));
  if (v.pointDeVente && AF.pdv) t('Point de vente : ' + v.pointDeVente.nom);
  if (v.commande) { st('em="true"'); t('Commande n° ' + cmdNum(v.commande.numero)); st('em="false"'); }
  if (v.livraisonAjoutee) t('Livraison ajoutée le ' + frDate(v.livraisonAjoutee.horodatage).slice(0, 5) + ' à ' + v.livraisonAjoutee.horodatage.slice(11, 16));
  if (v.venteLiee) { var lo = findSale(v.venteLiee); t('Livraison de la vente n° ' + saleNum(v.venteLiee) + (lo ? ' du ' + frDate(lo.date).slice(0, 5) : '')); }
  t(SEP2);
  var nb = 0, isDl = function (l) { return isDeliveryId(l.produitId) || isDeliveryLabel(l.libelle); };
  /* livraison toujours en dernier, séparée des articles par 10 tirets */
  var arts = v.lignes.filter(function (l) { return !isDl(l); }), livs = v.lignes.filter(isDl);
  arts.concat(livs).forEach(function (l, i) {
    if (livs.length && arts.length && i === arts.length) t('----------');
    nb += l.quantite;
    var brut = r2(l.prixUnitaire * l.quantite);
    if (l.quantite === 1 && !l.remise) { t(tkLine(l.libelle, tkMoney(l.total))); return; }
    tkWrap(l.libelle).forEach(function (s) { t(s); });
    t(tkLine('   ' + l.quantite + ' x ' + tkMoney(l.prixUnitaire), tkMoney(brut)));
    if (l.remise) t(tkLine('   ' + tkDiscLabel(l.remise, 'Remise'), '-' + tkMoney(brut - l.total)));
  });
  t(SEP);
  if (v.remiseTicket) {
    t(tkLine('Sous-total', tkMoney(v.sousTotal)));
    t(tkLine(tkDiscLabel(v.remiseTicket, 'Remise sur le ticket'), '-' + tkMoney(v.sousTotal - v.total)));
  }
  st('em="true" dw="true" dh="true"'); t(tkLine('TOTAL', tkMoney(v.total) + ' EUR', TK_W / 2)); st('em="false" dw="false" dh="false"');
  if (TT.tauxTVA > 0) t(tkLine('dont TVA ' + String(TT.tauxTVA).replace('.', ',') + ' %', tkMoney(v.total - v.total / (1 + TT.tauxTVA / 100))));
  if (AF.nbArticles) t(nb + ' article' + (nb > 1 ? 's' : ''));
  t(SEP);
  if (v.commande) { t(tkLine('Déjà payé à la commande', tkMoney(v.commande.dejaPaye || 0))); t(tkLine('Encaissé maintenant', tkMoney(p.cash + p.bancontact))); }
  if (p.cash > 0 && AF.paiement) t(tkLine('Cash', tkMoney(p.cash)));
  if (p.bancontact > 0 && AF.paiement) t(tkLine('Bancontact', tkMoney(p.bancontact)));
  if (p.mode === 'cash' && opts.recu && AF.rendu) { t(tkLine('Reçu', tkMoney(opts.recu))); t(tkLine('Rendu', tkMoney(Math.max(0, opts.recu - v.total)))); }
  if (unpaid(v)) { st('em="true"'); t(tkLine('A FACTURER - NON PAYÉ', tkMoney(dueOf(v)))); st('em="false"'); }
  if (v.facture) tkWrap('Facture au nom de : ' + v.facture.societe).forEach(function (s) { t(s); });
  if (v.annulation) { x += '<feed line="1"/>'; st('em="true"'); t('VENTE ANNULÉE le ' + frDate(v.annulation.horodatage) + ' à ' + v.annulation.horodatage.slice(11, 16)); st('em="false"'); }
  x += '<feed line="1"/>';
  st('align="center"');
  if (themeSaisonActive(TT)) { st('em="true"'); tkWrap(TT.saison).forEach(function (s) { t(s); }); st('em="false"'); }
  if (TICKET.merci) { st('em="true"'); tkWrap(TICKET.merci).forEach(function (s) { t(s); }); st('em="false"'); }
  if (TT.qr) { x += '<feed line="1"/><symbol type="qrcode_model_2" level="level_m" width="' + (TK_W === 32 ? 4 : 6) + '" size="0">' + xmlEsc(TT.qr) + '</symbol>'; if (TT.qrTexte) t(TT.qrTexte); }
  if (TICKET.mention) tkWrap(TICKET.mention).forEach(function (s) { t(s); });
  if (opts.duplicata) { var now = isoLocal(new Date()); t('Duplicata imprimé le ' + frDate(now) + ' à ' + now.slice(11, 16)); }
  return x + '<feed line="3"/><cut type="feed"/>';
}
/* Ticket vendeur de livraison, à joindre à la marchandise : coordonnées du client et articles (sans les prix) */
function ticketLivXml(v) {
  tkSync(); var x = '<text lang="fr"/>', SEP = Array(TK_W + 1).join(themeGet().ticket.separateur), SEP2 = Array(TK_W + 1).join('='), L = v.livraison || {};
  function t(s) { x += '<text>' + xmlEsc(tkTxt(s)) + '&#10;</text>'; }
  function st(a) { x += '<text ' + a + '/>'; }
  var big = 'em="true" dw="true" dh="true"', nobig = 'em="false" dw="false" dh="false"';
  st('align="center"'); st('reverse="true" ' + big); t(' LIVRAISON '); st('reverse="false" ' + nobig);
  t('Ticket vendeur - à joindre à la marchandise'); x += '<feed line="1"/>';
  st('align="left"');
  t(tkLine('Vente n° ' + v.id.split('-').pop(), frDate(v.horodatage) + ' ' + v.horodatage.slice(11, 16)));
  if (v.pointDeVente) t('Point de vente : ' + v.pointDeVente.nom);
  t(SEP2);
  st(big); tkWrap(L.nom || '?', TK_W / 2).forEach(function (s) { t(s); }); st(nobig);
  st('em="true"'); tkWrap(L.adresse || '?').forEach(function (s) { t(s); }); st('em="false"');
  st(big); t('Tél ' + (L.telephone || '?')); st(nobig);
  t(SEP2);
  var nb = 0;
  v.lignes.filter(function (l) { return !(isDeliveryId(l.produitId) || isDeliveryLabel(l.libelle)); }).forEach(function (l) {
    nb += l.quantite; st('em="true"'); tkWrap(l.quantite + ' x ' + l.libelle).forEach(function (s) { t(s); }); st('em="false"');
  });
  if (!nb) t('(aucun article : livraison seule)');
  t(SEP);
  if (unpaid(v)) { st('em="true"'); t(tkLine('A FACTURER - NON PAYÉ', tkMoney(dueOf(v)) + ' EUR')); st('em="false"'); }
  else t(tkLine('Payé', tkMoney(v.total) + ' EUR'));
  if (v.facture) tkWrap('Facture : ' + v.facture.societe).forEach(function (s) { t(s); });
  if (v.annulation) { st('em="true"'); t('VENTE ANNULÉE'); st('em="false"'); }
  return x + '<feed line="3"/><cut type="feed"/>';
}
/* Aperçu : rendu en page web du document envoyé à l'imprimante (mêmes données que l'impression) */
window.caisseTicketApercu = function () { return ticketHtml(ticketXml(sampleSale(), { apercu: true, recu: 20 })); }; // aperçu (tests)
function ticketHtml(xml) {
  var doc = new DOMParser().parseFromString('<r xmlns="' + EPOS_NS + '">' + xml + '</r>', 'text/xml');
  var stt = { align: 'left', em: false, dw: false, dh: false, reverse: false }, out = '', line = '';
  function flush(force) { out += '<div class="tkl" style="text-align:' + stt.align + '">' + (line || (force ? '&nbsp;' : '&nbsp;')) + '</div>'; line = ''; }
  Array.prototype.forEach.call(doc.documentElement.childNodes, function (n) {
    if (n.nodeType !== 1) return;
    if (n.localName === 'text') {
      ['align'].forEach(function (a) { if (n.hasAttribute(a)) stt.align = n.getAttribute(a); });
      ['em', 'dw', 'dh', 'reverse'].forEach(function (a) { if (n.hasAttribute(a)) stt[a] = n.getAttribute(a) === 'true'; });
      var txt = n.textContent; if (!txt) return;
      txt.split('\n').forEach(function (part, i, arr) {
        if (part) line += '<span class="' + (stt.em ? 'b ' : '') + (stt.dw && stt.dh ? 'dd ' : '') + (stt.reverse ? 'rv' : '') + '">' + esc(part).replace(/ /g, '&nbsp;') + '</span>';
        if (i < arr.length - 1) flush();
      });
    } else if (n.localName === 'feed') { for (var k = +(n.getAttribute('line') || 1); k > 0; k--) flush(true); }
    else if (n.localName === 'image') {
      var w = +n.getAttribute('width'), h = +n.getAttribute('height'), bin = atob(n.textContent), bpr = Math.ceil(w / 8);
      var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'), id = g.createImageData(w, h);
      for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) { var on = bin.charCodeAt(y * bpr + (xx >> 3)) & (0x80 >> (xx & 7)), j = (y * w + xx) * 4; id.data[j] = id.data[j + 1] = id.data[j + 2] = on ? 20 : 255; id.data[j + 3] = 255; }
      g.putImageData(id, 0, 0);
      out += '<div style="text-align:' + stt.align + '"><img src="' + c.toDataURL() + '" style="width:' + (w / (TK_W === 32 ? 384 : 576) * 100) + '%;image-rendering:pixelated" alt=""></div>';
    } else if (n.localName === 'symbol') { out += '<div style="text-align:' + stt.align + '"><span class="tkqr" title="' + esc(n.textContent) + '">QR</span></div>';
    } else if (n.localName === 'cut') { out += '<div class="tkcut">✂ - - - - - - - - - - - - - - - - - - -</div>'; }
  });
  if (line) flush();
  return out;
}
/* Vente d'exemple (s'il n'y a encore aucune vente sur l'appareil) */
function sampleSale() {
  var prods = []; (CATALOGUE ? CATALOGUE.categories : []).forEach(function (k) { k.produits.forEach(function (pp) { prods.push({ k: k, p: pp }); }); });
  var a = prods[2] || prods[0], b = prods[prods.length - 1];
  var l1 = a ? { produitId: a.p.id, categorie: a.k.nom, libelle: (a.k.prefixe ? a.k.nom + ' ' : '') + a.p.libelle, articleLibre: false, prixUnitaire: a.p.prix, quantite: 1, remise: null, total: a.p.prix } : null;
  var l2 = b ? { produitId: b.p.id, categorie: b.k.nom, libelle: (b.k.prefixe ? b.k.nom + ' ' : '') + b.p.libelle, articleLibre: false, prixUnitaire: b.p.prix, quantite: 2, remise: { type: 'pourcentage', valeur: 10 }, total: applyDisc(b.p.prix * 2, { type: '%', val: 10 }) } : null;
  var lignes = [l1, l2].filter(Boolean), tot = r2(lignes.reduce(function (s, l) { return s + l.total; }, 0)), pl = findPlace(S.placeId) || (CATALOGUE && CATALOGUE.pointsDeVente[0]) || { id: 'pdv', nom: 'Point de vente' };
  return { id: pl.id + '-' + today().replace(/-/g, '') + '-0042', horodatage: isoLocal(new Date()), pointDeVente: { id: pl.id, nom: pl.nom }, lignes: lignes, sousTotal: tot, remiseTicket: null, total: tot, paiement: { mode: 'cash', cash: tot, bancontact: 0 }, exemple: true };
}
function exampleRecu(t) { var b = [5, 10, 20, 50, 100, 200, 500].filter(function (x) { return x >= t; })[0]; return b || Math.ceil(t / 100) * 100; }
function testXml() {
  return '<text lang="fr"/><text align="center"/><text dw="true" dh="true"/><text>Ticket test&#10;</text><text dw="false" dh="false"/>' +
    '<text>' + xmlEsc('Caisse Démo') + '&#10;</text><text>' + xmlEsc(frDate(isoLocal(new Date())) + ' ' + isoLocal(new Date()).slice(11, 16)) + '&#10;</text>' +
    '<text>' + xmlEsc('L’imprimante fonctionne.') + '&#10;</text><feed line="3"/><cut type="feed"/>';
}
/* Impression d'un ticket : en cas d'échec, fenêtre avec « Réessayer » (la vente reste enregistrée) */
var PRQ = Promise.resolve();
function printSale(date, id, opts) {
  var v = salesOf(date).filter(function (x) { return x.id === id; })[0]; if (!v) return;
  var liv = !!(opts && opts.livraison);
  S.prBusy = true; render();
  PRQ = PRQ.then(function () {
    return eposSend(liv ? ticketLivXml(v) : ticketXml(v, opts), 15000).then(function (r) {
      S.prBusy = false;
      if (r.ok) toast(liv ? 'Ticket livraison imprimé' : opts && opts.duplicata ? 'Duplicata imprimé' : 'Ticket imprimé');
      else if (S.modal !== 'prerr') { S.prErr = { text: r.text, date: date, id: id, opts: opts || {} }; S.modal = 'prerr'; }
      render();
    });
  });
}
setInterval(function () { if (prConfigured() && S.screen === 'pos' && !S.prBusy && document.visibilityState === 'visible') prCheck(); }, 30000);

var toastTimer;
function toast(t) { S.toast = t; clearTimeout(toastTimer); toastTimer = setTimeout(function () { S.toast = ''; render(); }, 3500); }

refreshUsage();

/* ---------- Actions ---------- */
var A = {
  goSetup: function () { S.screen = 'setup'; S.pending = S.placeId; S.prIp = PR.ip || ''; S.prMsg = null; },
  pickPending: function (id) { S.pending = id; },
  saveSetup: function () { S.placeId = S.pending; A.prSaveIp(); S.screen = 'home'; persist(); if (prConfigured()) prCheck(); },
  goHome: function () { S.screen = 'home'; S.menu = false; if (S.siteUpdate && !S.modal) { S.importing = S.siteUpdate; S.modal = 'import'; } },
  openPos: function () { S.screen = 'pos'; S.tab = 'caisse'; S.openedDate = today(); persist();
    S.cxDate = today(); var c = cxDay(); if (FEAT('fond') && (!c || !c.fond) && !S.fondLater[today()]) A.fondOpen(); }, // début de journée : fond de caisse demandé
  fullscreen: function () { var el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el); },
  tab: function (t) { S.tab = t; S.menu = false; S.cartOpen = false; if (t === 'hist') S.histDay = today(); if (t === 'cmd') { S.cmdTab = S.cmdTab || 'todo'; cmdSync().then(function () { cmdRefresh(true); }); } },
  toggleMenu: function () { S.menu = !S.menu; },
  openCart: function () { S.cartOpen = true; S.menu = false; },
  closeCart: function () { S.cartOpen = false; },
  toggleTheme: function () { var t = isDark() ? 'light' : 'dark'; applyTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch (e) {} },
  cat: function (id) { S.cat = id; },
  add: function (pid) {
    var c, it;
    CATALOGUE.categories.forEach(function (k) { k.produits.forEach(function (p) { if (p.id === pid) { c = k; it = p; } }); });
    var i = S.cart.findIndex(function (l) { return l.produitId === pid && l.price === it.prix; });
    if (i >= 0) S.cart[i].qty++;
    else S.cart.push({ produitId: pid, categorie: c.nom, name: c.prefixe ? c.nom + ' ' + it.libelle : it.libelle, price: it.prix, qty: 1, disc: null });
  },
  /* Livraison ajoutée après coup : la ligne et le paiement s'ajoutent à la vente d'origine (même jour de vente) */
  validateAfter: function (t, pay, msg) {
    var o = findSale(S.after.id); if (!o || o.v.annulation) { restoreCart(); S.modal = null; return; }
    var v = o.v, now = isoLocal(new Date());
    if (S.after.kind === 'pay') { // vente à facturer finalement payée au stand
      var pp = v.paiement; pp.cash = r2(pp.cash + pay.cash); pp.bancontact = r2(pp.bancontact + pay.bancontact);
      pp.mode = pp.cash > 0 && pp.bancontact > 0 ? 'mixte' : pp.bancontact > 0 ? 'bancontact' : 'cash';
      v.facture.payee = true; v.facture.paiement = { horodatage: now, mode: pay.mode, cash: pay.cash, bancontact: pay.bancontact };
      if (!S.payDrawer && pay.cash > 0) payDrawerOpen();
      if (S.payDrawer) { S.payDrawer.motif = 'Paiement de la vente à facturer n° ' + saleNum(v.id); S.payDrawer.venteId = v.id; S.payDrawer = null; }
      delete S.exported[o.date];
      S.lastSale = { date: o.date, id: v.id, recu: 0, msg: 'Vente payée', titre: 'Vente n° ' + saleNum(v.id) + ' payée', rendu: S.payMode === 'cash' ? Math.max(0, num(S.received) - t) : null };
      S.modal = null; restoreCart();
      if (!persist()) { S.storageMsg = 'Paiement NON enregistré dans l\u2019appareil'; return; }
      if (prConfigured()) S.modal = 'ticket'; else toast('Vente n° ' + saleNum(v.id) + ' payée');
      return;
    }
    S.cart.forEach(function (l) { v.lignes.push({ produitId: l.produitId, categorie: l.categorie, libelle: l.name, articleLibre: !l.produitId, prixUnitaire: r2(l.price), quantite: l.qty, remise: jsonDisc(l.disc), total: r2(lineTotal(l)) }); });
    v.sousTotal = r2(v.sousTotal + t); v.total = r2(v.total + t);
    var p = v.paiement; p.cash = r2(p.cash + pay.cash); p.bancontact = r2(p.bancontact + pay.bancontact);
    p.mode = unpaid(v) ? 'a-facturer' : p.cash > 0 && p.bancontact > 0 ? 'mixte' : p.bancontact > 0 ? 'bancontact' : 'cash';
    v.livraisonAjoutee = { horodatage: now, montant: r2(t), paiement: pay };
    if (S.afterLiv) v.livraison = S.afterLiv;
    if (!S.payDrawer && pay.cash > 0) payDrawerOpen();
    if (S.payDrawer) { S.payDrawer.motif = 'Livraison ajoutée à la vente n° ' + saleNum(v.id) + (pay.cash > 0 ? '' : ' (payée par Bancontact, tiroir ouvert pendant l\u2019encaissement)'); S.payDrawer.venteId = v.id; S.payDrawer = null; }
    delete S.exported[o.date]; // le fichier de ce jour change : il sera renvoyé (ou à re-télécharger)
    msg = msg.replace('Vente enregistrée', 'Livraison ajoutée à la vente de ' + v.horodatage.slice(11, 16));
    S.lastSale = { date: o.date, id: v.id, recu: 0, msg: msg, titre: 'Livraison ajoutée', rendu: S.payMode === 'cash' ? Math.max(0, num(S.received) - t) : null, liv: !!v.livraison };
    S.modal = null; restoreCart();
    if (!persist()) { S.storageMsg = 'Livraison NON enregistrée dans l\u2019appareil'; return; }
    if (prConfigured()) { if (v.livraison) printSale(o.date, v.id, { livraison: true }); S.modal = 'ticket'; } else toast(msg);
  },
  cxOpen: function () { S.menu = false; S.cartOpen = false; S.modal = 'cx'; S.cxDate = today(); S.cxDone = null; S.cxDel = null; cxSync().then(function () { cxRefresh(true); }); },
  fondOpen: function () { if (!S.cxDate || S.modal !== 'cx') S.cxDate = today(); var c = cxDay(cxD()), prop = cxD() === today() ? cxFondPropose() : null; S.cxFrom = S.modal === 'cx' ? 'cx' : null; S.modal = 'fond'; S.fondPrev = true; S.ccMode = 'total'; S.cc = {}; S.cxMontant = c && c.fond ? String(c.fond.montant).replace('.', ',') : prop != null ? String(prop).replace('.', ',') : ''; },
  ccMode: function (m) { S.ccMode = m; },
  fondPrevTog: function () { S.fondPrev = !S.fondPrev; },
  fondSave: function () {
    var amt = ccAmount(); if (!(amt >= 0)) return;
    var d = cxD(), c = cxDay(d), first = !(c && c.fond), isT = d === today(), now = isoLocal(new Date()), det = S.ccMode === 'detail' ? Object.assign({}, S.cc) : null;
    var pd = S.fondPrev && isT ? cxPrevUncounted() : null, pmsg = '';
    if (pd) { // comptage de la veille fait le matin, avec le fond : entrée dans le fichier de la veille
      var ps = cxSummary(pd), pec = r2(amt - ps.attendu);
      cxAdd(pd, { type: 'comptage', montant: amt, detail: det, attendu: ps.attendu, ecart: pec, laisse: amt, recette: 0, attenduApres: ps.attendu, viaFond: true, horodatage: now });
      pmsg = ' · caisse du ' + frDate(pd).slice(0, 5) + ' : ' + (Math.abs(pec) < 0.005 ? 'juste' : 'écart ' + signed(pec));
    }
    cxAdd(d, { type: 'fond', montant: amt, detail: det, horodatage: now });
    if (first && isT && prConfigured()) drawerOpen('Fond de caisse', null);
    S.modal = S.cxFrom === 'cx' ? 'cx' : null; S.cxFrom = null; toast('Fond de caisse : ' + money(amt) + pmsg);
  },
  cxMvOpen: function (t) { S.modal = 'cxmv'; S.cxType = t; S.cxMontant = ''; S.cxMotif = null; S.cxAutre = ''; S.cxMsg = null; },
  cxMotif: function (m) { S.cxMotif = m; S.cxMsg = null; },
  cxBack: function () { S.modal = 'cx'; },
  cxMvSave: function () {
    var amt = r2(num(S.cxMontant));
    if (!(amt > 0)) { S.cxMsg = 'Indiquez le montant.'; return; }
    if (!S.cxMotif || (S.cxMotif === 'Autre' && !(S.cxAutre || '').trim())) { S.cxMsg = 'Choisissez le motif.'; return; }
    var motif = S.cxMotif === 'Autre' ? 'Autre : ' + S.cxAutre.trim().slice(0, 80) : S.cxMotif, ret = S.cxType === 'retrait';
    cxAdd(cxD(), { type: S.cxType, montant: amt, detail: null, motif: motif, horodatage: isoLocal(new Date()) });
    if (cxD() === today() && prConfigured()) drawerOpen((ret ? 'Retrait' : 'Apport') + ' : ' + motif, null);
    S.modal = 'cx'; S.cxDone = { ok: true, text: (ret ? 'Retrait' : 'Apport') + ' de ' + money(amt) + ' enregistré (' + motif + ').' };
  },
  cxDelAsk: function (id) { S.cxDel = id; },
  cxDelNo: function () { S.cxDel = null; },
  cxDelGo: function (id) {
    var e = cxEntries(cxD())[id]; S.cxDel = null; if (!e) return;
    if (!cxOwn(e)) { S.cxDone = { ok: false, text: 'Cette saisie a été faite dans l’App admin : elle se corrige dans l’App admin.' }; return; }
    cxRemove(cxD(), id); S.cxDone = { ok: true, text: 'Saisie supprimée.' };
  },
  cptOpen: function () { S.cxMsg = null; S.modal = 'comptage'; S.ccMode = 'detail'; S.cc = {}; S.cxMontant = ''; S.cxLaisse = ''; if (cxD() === today() && prConfigured()) drawerOpen('Comptage de la caisse', null); },
  cxLaisseSet: function (v) { S.cxLaisse = v === 'tout' ? String(ccAmount()).replace('.', ',') : '0'; S.cxMsg = null; },
  cptSave: function () {
    var amt = ccAmount(), s = cxSummary(cxD()), ec = r2(amt - s.attendu), ls = (S.cxLaisse || '').trim();
    if (!ls) { S.cxMsg = 'Indiquez ce que vous laissez en caisse pour demain (0 si vous retirez tout).'; return; }
    var laisse = r2(num(ls));
    if (laisse > amt + 0.005) { S.cxMsg = 'Le montant laissé pour demain ne peut pas dépasser le montant compté (' + money(amt) + ').'; return; }
    var recette = r2(amt - laisse);
    cxAdd(cxD(), { type: 'comptage', montant: amt, detail: S.ccMode === 'detail' ? Object.assign({}, S.cc) : null, attendu: s.attendu, ecart: ec, laisse: laisse, recette: recette, attenduApres: r2(s.attendu - recette), viaFond: false, horodatage: isoLocal(new Date()) });
    S.modal = 'cx'; S.cxMsg = null;
    var rmsg = ' Recette retirée : ' + money(recette) + ' ; laissé en caisse : ' + money(laisse) + '.';
    S.cxDone = Math.abs(ec) < 0.005 ? { ok: true, text: 'Caisse juste : ' + money(amt) + ', aucun écart.' + rmsg }
      : { ok: false, text: 'Écart de ' + signed(ec) + ' (compté ' + money(amt) + ', attendu ' + money(s.attendu) + '). ' + (ec < 0 ? 'Il manque de l’argent : vérifiez le comptage et les retraits.' : 'Il y a trop d’argent : une vente n’a peut-être pas été encodée, ou un apport n’a pas été noté.') + rmsg };
  },
  cxPrint: function () { cxPrint(cxD()); },
  cxDay: function (d) { S.cxDate = d; S.cxDone = null; S.cxDel = null; cxRefresh(true); },
  histDeliv: function (id) { A.livOpen('after:' + id); },
  histDelivGo: function (id) {
    var d = deliveryProduct(), o = findSale(id); if (!d || !o || o.v.annulation || linkedDelivery(id)) return;
    S.savedCart = { cart: S.cart, ticketDisc: S.ticketDisc, cartLiv: S.cartLiv, cartFac: S.cartFac }; S.cartLiv = null; S.cartFac = null;
    S.cart = [{ produitId: d.p.id, categorie: d.cat.nom, name: d.cat.prefixe ? d.cat.nom + ' ' + d.p.libelle : d.p.libelle, price: d.p.prix, qty: 1, disc: null }];
    S.ticketDisc = null; S.after = { id: id, date: o.date, heure: o.v.horodatage.slice(11, 16) };
    A.openPay();
  },
  addDelivery: function () { if (deliveryProduct()) A.livOpen('cart'); },
  addDeliveryLine: function () {
    var d = deliveryProduct(); if (!d) return;
    if (S.cart.some(function (l) { return l.produitId === d.p.id; })) return;
    S.cart.push({ produitId: d.p.id, categorie: d.cat.nom, name: d.cat.prefixe ? d.cat.nom + ' ' + d.p.libelle : d.p.libelle, price: d.p.prix, qty: 1, disc: null });
  },
  inc: function (i) { var l = S.cart[+i]; if (isDeliveryId(l.produitId)) { toast('La livraison ne compte qu\u2019une fois par vente'); return; } l.qty++; },
  dec: function (i) { i = +i; if (--S.cart[i].qty <= 0) S.cart.splice(i, 1); if (!S.cart.length) S.ticketDisc = null; if (!cartHasDelivery()) S.cartLiv = null; },
  clear: function () { S.cart = []; S.ticketDisc = null; S.cartLiv = null; S.cartFac = null; },
  /* Formulaire de livraison. ctx : 'cart' (vente en cours), 'after:<id>' (livraison après coup), 'edit:<jour>|<id>' (Historique) */
  livOpen: function (ctx) {
    var src = null;
    if (ctx === 'cart') src = S.cartLiv;
    else if (ctx.indexOf('edit:') === 0) { var o = findSale(ctx.split('|')[1]); if (!o) return; src = o.v.livraison || null; }
    S.livCtx = ctx; S.fNom = src ? src.nom : ''; S.fAdr = src ? src.adresse : ''; S.fTel = src ? src.telephone : ''; S.livMsg = null; S.modal = 'liv';
  },
  livSave: function () {
    var info = { nom: (S.fNom || '').trim().slice(0, 80), adresse: (S.fAdr || '').trim().slice(0, 200), telephone: (S.fTel || '').trim().slice(0, 30) };
    if (!livValid(info)) { S.livMsg = !info.nom ? 'Indiquez le nom.' : !info.adresse ? 'Indiquez l\u2019adresse de livraison.' : 'Indiquez un numéro de téléphone complet.'; return; }
    var ctx = S.livCtx; S.modal = null; S.livCtx = null;
    if (ctx === 'cart') { S.cartLiv = info; A.addDeliveryLine(); return; }
    if (ctx.indexOf('after:') === 0) { var id = ctx.slice(6); A.histDelivGo(id); if (S.after) S.afterLiv = info; return; }
    var o = findSale(ctx.split('|')[1]); if (!o) return;
    o.v.livraison = info; delete S.exported[o.date];
    if (!persist()) return;
    if (prConfigured()) printSale(o.date, o.v.id, { livraison: true }); else toast('Coordonnées de livraison enregistrées');
  },
  /* Facture. ctx : 'cart' (avant d'encaisser : payé ou non) ou '<jour>|<id>' (Historique : vente déjà enregistrée) */
  facOpen: function (ctx) {
    var src = null, o = null;
    if (ctx === 'cart') src = S.cartFac; else { o = findSale(ctx.split('|')[1]); if (!o) return; src = o.v.facture || null; }
    S.facCtx = ctx; S.fSoc = src ? src.societe : ''; S.fFAdr = src ? src.adresse : ''; S.fTva = src ? src.tva : ''; S.fMail = src ? src.email : '';
    S.fPaye = ctx === 'cart' ? (src ? src.payee : null) : null; S.facMsg = null; S.modal = 'fac';
  },
  facPaye: function (v) { S.fPaye = v === '1'; S.facMsg = null; },
  facSave: function () {
    var f = { societe: (S.fSoc || '').trim().slice(0, 100), adresse: (S.fFAdr || '').trim().slice(0, 200), tva: (S.fTva || '').trim().slice(0, 30), email: (S.fMail || '').trim().slice(0, 100) };
    if (!facValid(f)) { S.facMsg = !f.societe ? 'Indiquez le nom de la société.' : !f.adresse ? 'Indiquez l\u2019adresse de la société.' : !f.tva ? 'Indiquez le numéro de TVA.' : 'Indiquez une adresse e-mail valide.'; return; }
    var ctx = S.facCtx;
    if (ctx === 'cart') {
      if (S.fPaye !== true && S.fPaye !== false) { S.facMsg = 'Indiquez si le client paie maintenant ou non.'; return; }
      f.payee = S.fPaye; S.cartFac = f; S.modal = null; S.facCtx = null; return;
    }
    var o = findSale(ctx.split('|')[1]); if (!o) { S.modal = null; return; }
    var old = o.v.facture;
    o.v.facture = Object.assign({}, old || {}, f, { payee: old ? old.payee : true, horodatage: old ? old.horodatage : isoLocal(new Date()) });
    if (old) o.v.facture.modifieeLe = isoLocal(new Date());
    delete S.exported[o.date]; S.modal = null; S.facCtx = null;
    if (persist()) toast('Données de facturation enregistrées');
  },
  facRemove: function () { S.cartFac = null; S.modal = null; S.facCtx = null; },
  /* Vente à facturer non payée : le client paie finalement au stand (Historique) */
  histPay: function (id) {
    var o = findSale(id); if (!o || o.v.annulation || !unpaid(o.v) || !(dueOf(o.v) > 0)) return;
    S.savedCart = { cart: S.cart, ticketDisc: S.ticketDisc, cartLiv: S.cartLiv, cartFac: S.cartFac }; S.cartLiv = null; S.cartFac = null;
    S.cart = [{ produitId: null, categorie: '', name: 'Paiement de la vente', price: dueOf(o.v), qty: 1, disc: null }];
    S.ticketDisc = null; S.after = { id: id, date: o.date, heure: o.v.horodatage.slice(11, 16), kind: 'pay' };
    A.openPay();
  },
  openFree: function () { S.modal = 'free'; S.freeLabel = ''; S.freePrice = ''; },
  openFreeMenu: function () { S.menu = false; A.openFree(); },
  cmdTab: function (t) { S.cmdTab = t; },
  cmdAlertOk: function () { CMD.alerts = []; saveCmd(); },
  cmdReload: function () { cmdSync().then(function () { cmdRefresh(true); }); },
  /* Encaisser une commande : montant = reste à payer ; reste 0 → « Remettre au client », sans paiement */
  cmdPay: function (id) {
    var x = cmdList().filter(function (k) { return k.id === id; })[0];
    if (!x || x.statut === 'livree' || x.enc) { toast('Cette commande est déjà retirée'); return; }
    if (cmdLocalSale(id)) { toast('Cette commande est déjà retirée'); return; }
    var c = x.c;
    S.cmdPay = { id: id, annee: x.annee, numero: c.numero != null ? c.numero : null, dejaPaye: cmdPaid(c), modeAvant: (c.paye && c.paye.mode) || '', total: r2(Number(c.total) || 0), reste: cmdReste(c), lignes: c.lignes || [] };
    if (S.cmdPay.reste <= 0) { S.payMode = null; A.validateCmd(); return; }
    A.openPay();
  },
  validateCmd: function () {
    var k = S.cmdPay; if (!k) return;
    var t = k.reste, d = new Date(), p = findPlace(S.placeId), pay, nm = 'Commande n° ' + cmdNum(k.numero);
    if (t <= 0) pay = { mode: 'deja-paye', cash: 0, bancontact: 0 };
    else if (S.payMode === 'cash') pay = { mode: 'cash', cash: r2(t), bancontact: 0 };
    else if (S.payMode === 'bc') pay = { mode: 'bancontact', cash: 0, bancontact: r2(t) };
    else if (S.payMode === 'mix') { var mc = num(S.mix); pay = { mode: 'mixte', cash: r2(mc), bancontact: r2(t - mc) }; }
    else return;
    var list = S.days[today()] || (S.days[today()] = []), n = list.length + 1;
    var sale = {
      id: p.id + '-' + today().replace(/-/g, '') + '-' + ('000' + n).slice(-4), horodatage: isoLocal(d), pointDeVente: { id: p.id, nom: p.nom },
      lignes: k.lignes.map(function (l) { var a = l.produitId ? stkArticle(l.produitId) : null, q = Number(l.quantite) || 0; return { produitId: l.produitId || null, categorie: a ? a.categorie : '', libelle: l.libelle || (a && a.libelle) || '', articleLibre: !l.produitId, prixUnitaire: r2(Number(l.prixUnitaire) || 0), quantite: q, remise: null, total: r2(l.total != null ? Number(l.total) : (Number(l.prixUnitaire) || 0) * q) }; }),
      sousTotal: k.total, remiseTicket: null, total: k.total, paiement: pay,
      commande: { id: k.id, numero: k.numero, dejaPaye: k.dejaPaye, modeDejaPaye: k.modeAvant }
    };
    list.push(sale);
    if (!S.payDrawer && pay.cash > 0) payDrawerOpen();
    if (S.payDrawer) { S.payDrawer.motif = pay.cash > 0 ? nm + ' retirée' : nm + ' payée par Bancontact (tiroir ouvert pendant l’encaissement)'; S.payDrawer.venteId = sale.id; S.payDrawer = null; }
    CMD.queue.push({ op: 'encaisser', annee: k.annee, id: k.id, numero: k.numero, venteId: sale.id, horodatage: sale.horodatage, montant: r2(pay.cash + pay.bancontact), paiement: pay, dejaPaye: k.dejaPaye, pdv: { id: p.id, nom: p.nom } });
    saveCmd();
    var msg = t > 0 ? nm + ' encaissée' : nm + ' remise au client';
    S.lastSale = { date: today(), id: sale.id, recu: 0, msg: msg, titre: msg, rendu: t > 0 && S.payMode === 'cash' ? Math.max(0, num(S.received) - t) : null };
    S.cmdPay = null; S.modal = null;
    if (!persist()) { S.storageMsg = nm + ' NON enregistrée dans l’appareil'; return; }
    cmdSync();
    if (prConfigured()) S.modal = 'ticket'; else toast(msg);
  },
  /* Remise ticket : code, puis la fenêtre de remise habituelle */
  discAsk: function () { if (!S.cart.length) return; S.menu = false; S.modal = 'code'; S.codeVal = ''; S.codeMsg = null; },
  codeKey: function (k) {
    if (S.codeBusy) return;
    if (S.codeLock && Date.now() < S.codeLock) { S.codeMsg = 'Trop d\u2019essais : réessayez dans ' + Math.ceil((S.codeLock - Date.now()) / 1000) + ' s.'; return; }
    if (k === 'del') { S.codeVal = (S.codeVal || '').slice(0, -1); S.codeMsg = null; return; }
    if ((S.codeVal || '').length >= 4) return;
    S.codeVal = (S.codeVal || '') + k; S.codeMsg = null;
    if (S.codeVal.length < 4) return;
    S.codeBusy = true;
    sha256Hex('caisse-remise:' + S.codeVal).then(function (h) {
      S.codeBusy = false;
      if (h === remiseCodeSha()) { S.codeTries = 0; S.codeVal = ''; A.ticketDisc(); }
      else {
        S.codeTries = (S.codeTries || 0) + 1; S.codeVal = '';
        if (S.codeTries >= 5) { S.codeTries = 0; S.codeLock = Date.now() + 60000; S.codeMsg = 'Code incorrect. Trop d\u2019essais : réessayez dans 60 s.'; }
        else S.codeMsg = 'Code incorrect.';
      }
      render();
    });
  },
  addFree: function () { S.cart.push({ produitId: null, categorie: 'Article libre', name: S.freeLabel.trim(), price: num(S.freePrice), qty: 1, disc: null }); S.modal = null; },
  lineDisc: function (i) { var l = S.cart[+i]; S.modal = 'disc'; S.discTarget = +i; S.discType = l.disc ? l.disc.type : '%'; S.discVal = l.disc ? String(l.disc.val).replace('.', ',') : ''; },
  ticketDisc: function () { S.modal = 'disc'; S.discTarget = 'ticket'; S.discType = S.ticketDisc ? S.ticketDisc.type : '%'; S.discVal = S.ticketDisc ? String(S.ticketDisc.val).replace('.', ',') : ''; },
  discType: function (t) { S.discType = t; },
  applyDisc: function () {
    var v = num(S.discVal), d = v > 0 ? { type: S.discType, val: v } : null;
    if (S.discTarget === 'ticket') S.ticketDisc = d; else S.cart[S.discTarget].disc = d;
    S.modal = null;
  },
  removeDisc: function () { if (S.discTarget === 'ticket') S.ticketDisc = null; else S.cart[S.discTarget].disc = null; S.modal = null; },
  close: function () { if (S.modal === 'pay' && S.payDrawer) { S.payDrawer = null; persist(); }
    if (S.modal === 'fond') { S.fondLater[today()] = true; if (S.cxFrom === 'cx') { S.modal = 'cx'; S.cxFrom = null; return; } }
    if (S.modal === 'pay' && S.after) restoreCart();
    if (S.modal === 'pay') S.cmdPay = null;
    S.modal = S.modal === 'ghcfg' && S.ghBack ? S.ghBack : null; S.ghBack = null; S.ghPending = null; S.storageMsg = ''; },
  checkCatalogue: function () { loadSiteCatalogue(true); },
  checkCatMenu: function () { S.menu = false; if (!S.catLoading) loadSiteCatalogue(true); },
  installCatalogue: function () {
    var im = S.importing;
    try { localStorage.setItem(CAT_KEY, JSON.stringify(im.raw)); } catch (e) {}
    CATALOGUE = im.cat;
    S.cat = CATALOGUE.categories.length ? CATALOGUE.categories[0].id : null; S.cart = []; S.ticketDisc = null; S.modal = null; S.importing = null; S.siteUpdate = null;
    if (S.placeId && !findPlace(S.placeId)) { S.placeId = null; S.pending = null; persist(); }
    if (S.pending && !findPlace(S.pending)) S.pending = null;
    toast(catalogueLabel(CATALOGUE) + ' installé');
  },
  histDay: function (d) { S.histDay = d; },
  askCancel: function (ref) { S.modal = 'cancel'; S.cancelRef = ref; S.cancelMotif = ''; },
  doCancel: function () {
    var parts = (S.cancelRef || '').split('|'), v = salesOf(parts[0]).filter(function (x) { return x.id === parts[1]; })[0];
    if (!v || v.annulation) { S.modal = null; return; }
    var motif = (S.cancelMotif || '').trim().slice(0, 120);
    v.annulation = { horodatage: isoLocal(new Date()), motif: motif };
    if (v.commande) { // la commande redevient « à retirer »
      var qi = CMD.queue.findIndex(function (o) { return o.op === 'encaisser' && o.venteId === v.id; });
      if (qi >= 0) CMD.queue.splice(qi, 1);
      else CMD.queue.push({ op: 'annuler', annee: cmdYearOf(v.commande.id), id: v.commande.id, numero: v.commande.numero, venteId: v.id, dejaPaye: Number(v.commande.dejaPaye) || 0, modeAvant: v.commande.modeDejaPaye || '' });
      saveCmd(); cmdSync();
    }
    var wasExported = !!S.exported[parts[0]]; delete S.exported[parts[0]];
    S.modal = null;
    if (persist()) toast('Vente de ' + v.horodatage.slice(11, 16) + ' annulée' + (wasExported ? ' · pensez à re-télécharger ce jour' : ''));
  },
  openPay: function () { S.modal = 'pay'; S.payMode = !S.after && !S.cmdPay && S.cartFac && S.cartFac.payee === false ? 'fac' : null; S.received = ''; S.mix = ''; S.payDrawer = null; },
  /* Le mode de paiement peut être changé à tout moment avant de valider (le client change d'avis) */
  mode: function (m) { if (S.payMode !== 'fac') S.payMode = m; },
  /* Le tiroir s'ouvre quand le vendeur indique l'argent reçu (billet rapide ou montant exact), une seule fois par encaissement.
     Montant tapé au clavier : le tiroir s'ouvre à la validation. L'ouverture est rattachée à la vente à la validation. */
  bill: function (b) { var f = S.payMode === 'mix' ? 'mix' : 'received'; S[f] = String(r2(num(S[f]) + +b)).replace('.', ','); payDrawerOpen(); },
  exact: function () { S.received = payTotal().toFixed(2).replace('.', ','); payDrawerOpen(); },
  resetReceived: function () { S.received = ''; },
  resetMix: function () { S.mix = ''; },
  validate: function () {
    if (S.cmdPay) { if (S.cmdPay.reste > 0 && !S.payMode) return; A.validateCmd(); return; }
    if (!S.payMode) return;
    var t = total(), d = new Date(), p = findPlace(S.placeId), pay, msg = 'Vente enregistrée';
    if (S.payMode === 'cash') { pay = { mode: 'cash', cash: r2(t), bancontact: 0 }; msg += ' · À rendre : ' + money(Math.max(0, num(S.received) - t)); }
    else if (S.payMode === 'bc') pay = { mode: 'bancontact', cash: 0, bancontact: r2(t) };
    else if (S.payMode === 'fac') { pay = { mode: 'a-facturer', cash: 0, bancontact: 0 }; msg = 'Vente à facturer enregistrée (non payée)'; }
    else { var c = num(S.mix); pay = { mode: 'mixte', cash: r2(c), bancontact: r2(t - c) }; }
    if (S.after) { A.validateAfter(t, pay, msg); return; }
    var list = S.days[today()] || (S.days[today()] = []);
    var n = list.length + 1;
    list.push({
      id: p.id + '-' + today().replace(/-/g, '') + '-' + ('000' + n).slice(-4),
      horodatage: isoLocal(d),
      pointDeVente: { id: p.id, nom: p.nom },
      lignes: S.cart.map(function (l) { return { produitId: l.produitId, categorie: l.categorie, libelle: l.name, articleLibre: !l.produitId, prixUnitaire: r2(l.price), quantite: l.qty, remise: jsonDisc(l.disc), total: r2(lineTotal(l)) }; }),
      sousTotal: r2(up5(subtotal())), remiseTicket: jsonDisc(S.ticketDisc), total: r2(t), paiement: pay
    });
    var sale = list[list.length - 1];
    if (S.cartLiv && cartHasDelivery()) sale.livraison = S.cartLiv;
    if (S.cartFac) sale.facture = Object.assign({}, S.cartFac, { horodatage: isoLocal(d) });
    if (S.after) { sale.venteLiee = S.after.id; msg = msg.replace('Vente enregistrée', 'Livraison enregistrée'); }
    if (!S.payDrawer && pay.cash > 0) payDrawerOpen(); // montant tapé au clavier : ouverture à la validation
    if (S.payDrawer) { S.payDrawer.motif = pay.cash > 0 ? 'Vente' : 'Vente payée par Bancontact (tiroir ouvert pendant l\u2019encaissement)'; S.payDrawer.venteId = sale.id; S.payDrawer = null; }
    S.lastSale = { date: today(), id: sale.id, recu: S.payMode === 'cash' ? num(S.received) : 0, msg: msg, liv: !!sale.livraison, titre: pay.mode === 'a-facturer' ? 'Vente à facturer enregistrée' : null };
    S.cart = []; S.ticketDisc = null; S.cartLiv = null; S.cartFac = null; S.modal = null; S.cartOpen = false;
    if (S.after) restoreCart(); // la vente en cours avant la livraison après coup est remise dans le panier
    if (!persist()) { S.storageMsg = msg.replace('Vente enregistrée', 'Vente NON enregistrée dans l\u2019appareil'); return; }
    if (prConfigured()) { if (sale.livraison) printSale(today(), sale.id, { livraison: true }); S.modal = 'ticket'; } else toast(msg);
  },
  ticketYes: function () { var l = S.lastSale; S.modal = null; if (l) printSale(l.date, l.id, { recu: l.recu }); },
  ticketNo: function () { S.modal = null; },
  reprint: function (ref) { var p = (ref || '').split('|'); printSale(p[0], p[1], { duplicata: true }); },
  prRetry: function () { var e = S.prErr; S.modal = null; S.prErr = null; if (e) printSale(e.date, e.id, e.opts); },
  drawerAsk: function () { S.menu = false; S.modal = 'drawer'; S.drMotif = null; S.drAutre = ''; },
  drMotif: function (m) { S.drMotif = m; },
  drawerGo: function () {
    var m = S.drMotif === 'Autre' ? 'Autre : ' + (S.drAutre || '').trim().slice(0, 80) : S.drMotif; if (!m) return;
    S.modal = null; drawerOpen(m, null).then(function (r) { if (r && r.ok) toast('Tiroir ouvert (' + m + ')'); });
  },
  prCheckNow: function () { prCheck().then(function (r) { if (r) toast(r.text); }); },
  prSaveIp: function () { PR.ip = (S.prIp || '').trim(); savePr(); },
  prTest: function () { A.prSaveIp(); if (!prConfigured()) { S.prMsg = { ok: false, text: 'Indiquez l\u2019adresse de l\u2019imprimante.' }; return; }
    S.prMsg = { ok: null, text: 'Impression du ticket test…' }; eposSend(testXml(), 10000).then(function (r) { S.prMsg = { ok: r.ok, text: r.ok ? 'Ticket test imprimé.' : r.text + prHelp(r) }; render(); }); },
  prDrawerTest: function () { A.prSaveIp(); if (!prConfigured()) { S.prMsg = { ok: false, text: 'Indiquez l\u2019adresse de l\u2019imprimante.' }; return; }
    S.prMsg = { ok: null, text: 'Ouverture du tiroir…' }; logDrawer('Test du tiroir', null); drawerPulse().then(function (r) { S.prMsg = { ok: r.ok, text: r.ok ? 'Le tiroir s\u2019est ouvert.' : r.text + prHelp(r) }; render(); }); },
  prForget: function () { delete PR.ip; savePr(); S.prIp = ''; S.prMsg = null; PR_ST = { state: null, text: '', at: 0 }; },
  tkPrev: function () { S.menu = false; S.modal = 'tkprev'; S.tkDay = today(); S.tkId = null; S.tkDup = false; },
  tkDay: function (d) { S.tkDay = d; S.tkId = null; },
  tkSel: function (id) { S.tkId = id; },
  tkDup: function (v) { S.tkDup = v === '1'; },
  tkPrint: function () { var v = tkPrevSale(); if (!v || v.exemple) return; S.modal = null; printSale(S.tkDay, v.id, { duplicata: true }); },
  stkShow: function () { S.menu = false; S.cartOpen = false; S.modal = 'stock'; S.stkOpen = null; stkcRefresh(false); },
  stkOpen: function (pid) { S.stkOpen = S.stkOpen === pid ? null : pid; },
  stkRefresh: function () { stkcRefresh(true); },
  rcOpen: function () { S.menu = false; S.cartOpen = false; S.modal = 'reception'; S.rcStep = null; S.rq = {}; S.rcDate = today(); S.rcMsg = null; S.rcDel = null; stkRefresh(); },
  rcDe: function (id) { S.rcDe = id; S.rcMsg = null; },
  rcAsk: function () {
    var err = !/^\d{4}-\d{2}-\d{2}$/.test(S.rcDate || '') ? 'Indiquez la date de la réception.'
      : !S.rcDe || S.rcDe === S.placeId || !findPlace(S.rcDe) ? 'Choisissez le stand d’où viennent les articles.'
      : !rcLines().length ? 'Indiquez la quantité reçue pour au moins un article.' : null;
    if (err) { S.rcMsg = { ok: false, text: err }; return; }
    S.rcMsg = null; S.rcStep = 'confirm';
  },
  rcBack: function () { S.rcStep = null; },
  rcSave: function () {
    var lines = rcLines(); if (!lines.length) { S.rcStep = null; return; }
    var now = new Date(), pl = findPlace(S.placeId), de = findPlace(S.rcDe);
    var stamp = isoDate(now).replace(/-/g, '') + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    var rnd = (Math.random().toString(36).slice(2) + '0000').slice(0, 4);
    var id = 'tr-' + stamp + '-' + ((slug(pl ? pl.nom : '') || 'stand').slice(0, 24)) + '-' + rnd;
    var mv = { type: 'transfert', date: S.rcDate, de: S.rcDe, vers: S.placeId, lignes: {}, creeLe: isoLocal(now), source: 'caisse', appareil: GH.appareil };
    var noms = { stands: {}, articles: {} };
    noms.stands[S.rcDe] = de ? de.nom : S.rcDe; noms.stands[S.placeId] = pl ? pl.nom : S.placeId;
    lines.forEach(function (x) { mv.lignes[x.id] = x.q; noms.articles[x.id] = stkArticle(x.id); });
    STK.queue.push({ op: 'add', id: id, mv: mv, noms: noms });
    if (!saveStk()) { STK.queue.pop(); S.rcStep = null; S.rcMsg = { ok: false, text: 'Mémoire de la tablette pleine : réception NON enregistrée. Effacez d’anciens jours de ventes.' }; return; }
    S.rq = {}; S.rcStep = null; STK.err = null;
    var offline = !ghReady() || navigator.onLine === false;
    S.rcMsg = offline ? { ok: false, text: 'Mouvement gardé sur la tablette, il sera envoyé dès qu’il y aura internet' + (ghReady() ? '.' : ' et que l’envoi GitHub sera déverrouillé.') }
      : { ok: true, text: 'Envoi de la réception…' };
    if (!offline) stkSync().then(function () {
      var left = STK.queue.some(function (o) { return o.id === id; });
      S.rcMsg = left ? { ok: false, text: 'Mouvement gardé sur la tablette, il sera envoyé dès qu’il y aura internet.' } : { ok: true, text: 'Réception enregistrée dans le stock de la saison.' };
      render();
    });
  },
  rcDelAsk: function (id) { S.rcDel = id; },
  rcDelNo: function () { S.rcDel = null; },
  rcDelGo: function (id) {
    S.rcDel = null;
    var qi = STK.queue.findIndex(function (o) { return o.op === 'add' && o.id === id; });
    if (qi >= 0) { STK.queue.splice(qi, 1); saveStk(); S.rcMsg = { ok: true, text: 'Réception supprimée (elle n’avait pas encore été envoyée).' }; return; }
    var r = STK.recus.filter(function (x) { return x.id === id; })[0];
    if (!r || r.source !== 'caisse' || r.appareil !== GH.appareil) return;
    STK.queue.push({ op: 'del', id: id }); saveStk();
    var offline = !ghReady() || navigator.onLine === false;
    S.rcMsg = offline ? { ok: false, text: 'Suppression gardée sur la tablette, elle sera envoyée dès qu’il y aura internet.' } : { ok: true, text: 'Suppression en cours…' };
    if (!offline) stkSync().then(function () {
      var left = STK.queue.some(function (o) { return o.op === 'del' && o.id === id; });
      S.rcMsg = left ? { ok: false, text: 'Suppression gardée sur la tablette, elle sera envoyée dès qu’il y aura internet.' }
        : STK.err === 'pasmien' ? { ok: false, text: stkErrText('pasmien') } : { ok: true, text: 'Réception supprimée du stock de la saison.' };
      render();
    });
  },
  download: function (date) {
    date = date || today();
    var name = fileName(date);
    var blob = new Blob([JSON.stringify(dayFile(date), null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    S.exported[date] = true; persist();
    S.menu = false; toast(name + ' téléchargé');
  },
  openGh: function () { S.modal = 'ghcfg'; S.ghPass = ''; S.ghMsg = null; S.ghPending = null; S.ghBack = null; },
  ghUnlock: function () { ghUnlock(); },
  ghAsk: function (d) { S.ghPending = d; S.ghBack = S.modal; S.modal = 'ghcfg'; S.ghPass = ''; S.ghMsg = { ok: null, text: 'Pour envoyer les ventes du ' + d.split('-').reverse().join('/') + ', déverrouillez d\u2019abord l\u2019envoi sur cette tablette.' }; },
  ghTest: function () { S.ghMsg = { ok: null, text: 'Test en cours…' }; ghTest(); },
  ghLock: function () { delete GH.token; saveGh(); S.ghMsg = null; S.modal = null; toast('Envoi sur GitHub verrouillé sur cet appareil'); },
  ghSend: function (d) { ghSend(d || today()); },
  showDays: function () { S.menu = false; S.modal = 'days'; S.confirmDel = null; S.storageMsg = ''; },
  askDel: function (d) { S.confirmDel = d; },
  delDay: function (d) {
    if (d === today() || !S.exported[d]) return;
    delete S.days[d]; delete S.exported[d]; delete S.caisse[d]; if (!CXF.queue.some(function (o) { return o.date === d; })) { delete CXF.snap[d]; saveCxf(); } S.confirmDel = null;
    if (persist()) toast('Ventes du ' + frDate(d) + ' effacées de l\u2019appareil');
  }
};

/* ---------- Vues ---------- */
var ICON_PIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="stroke:var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
/* Smartphone ou tablette ? Pour la vraie app : téléphone si le plus petit côté de l'écran est < 600 px. */
function detectPhone() { return Math.min(screen.width, screen.height) < 600; }
var PHONE = detectPhone(); // fixé au démarrage : pas de bascule en cours de vente
if (PHONE) document.documentElement.classList.add('phone');
// Orientation : portrait sur téléphone, paysage sur tablette (effectif dans l'app installée)
try { screen.orientation.lock(PHONE ? 'portrait' : 'landscape').catch(function () {}); } catch (e) {}
var ICON_MOON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
var ICON_SUN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
var THEME_KEY = STORE_KEY + '-theme';
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light'); }
try { applyTheme(themeGet().mode === 'sombre' ? 'dark' : 'light'); } catch (e) { applyTheme('light'); }
var ICON_PEN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
var ICON_DOTS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

function vHome() {
  var p = findPlace(S.placeId);
  var opened = S.openedDate === today();
  return '<div class="center">' +
    '<img src="' + themeLogo('full') + '" alt="' + esc(themeGet().nom) + '" style="width:min(420px,60vw)">' +
    (!CATALOGUE
      ? '<button class="btn btn-primary btn-big" data-a="goSetup">Configurer la tablette</button>' +
        '<div class="sub">' + (S.catLoading ? 'Chargement du catalogue…' : 'Catalogue introuvable : connectez la tablette à internet et rouvrez l\u2019app. Le fichier catalogue.json doit avoir été publié par l\u2019app Admin.') + '</div>'
      : p
      ? '<button class="btn btn-primary btn-big" data-a="openPos">' + (opened ? 'Reprendre la caisse' : 'Ouvrir la caisse') + '</button>' +
        '<div style="font-size:18px;font-weight:700">' + esc(p.nom) + '</div>'
      : '<button class="btn btn-primary btn-big" data-a="goSetup">Configurer la tablette</button>' +
        '<div class="sub">Première utilisation : assignez cette tablette à son point de vente.</div>') +
    (CATALOGUE ? vAutoBar() : '') +
    (S.usedPct >= 80 ? vStorageBar() : '') +
    '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">' +
      '<div style="font-size:14px;color:var(--faint)">' + catalogueLabel(CATALOGUE) + ' · Application ' + APP_VERSION + '</div>' +
      '<div style="display:flex;gap:8px">' +
        (p ? '<button class="btn-link" data-a="goSetup">Paramètres de la tablette</button>' : '') +
      '</div>' +
    '</div></div>';
}

function vSetup() {
  var c = CATALOGUE;
  var info = c ? '<span class="sub">' + c.categories.length + ' catégories · ' + countProducts(c) + ' produits · ' + c.pointsDeVente.length + ' points de vente</span>' : '<span class="sub">Pas encore chargé : la tablette doit avoir du réseau.</span>';
  var places = c ? '<div class="grid2">' + c.pointsDeVente.map(function (p) {
        return '<button class="choice' + (S.pending === p.id ? ' on' : '') + '" data-a="pickPending" data-v="' + esc(p.id) + '">' + esc(p.nom) + '</button>';
      }).join('') + '</div>' : '<div class="empty" style="padding:16px;border:1px dashed var(--line2);border-radius:12px">Disponible après le chargement du catalogue.</div>';
  return '<div class="center" style="background:var(--ground);overflow-y:auto;justify-content:flex-start;padding:28px 0"><div class="card">' +
    '<h1 style="margin:0;font-size:28px;font-weight:800">Paramètres de la tablette</h1>' +
    '<section style="display:flex;flex-direction:column;gap:12px">' +
      '<h2 style="margin:0;font-size:19px;font-weight:800">Catalogue</h2>' +
      '<div class="row" style="gap:16px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--ground)">' +
        '<div style="display:flex;flex-direction:column;gap:2px"><strong style="font-size:17px">' + esc(catalogueLabel(c)) + '</strong>' +
        info + '</div>' +
        '<button class="btn" data-a="checkCatalogue" style="flex-shrink:0"' + (S.catLoading ? ' disabled' : '') + '>' + (S.catLoading ? 'Vérification…' : 'Vérifier les mises à jour') + '</button>' +
      '</div>' +
      '<div class="sub">Le catalogue est publié par l\u2019app Admin dans le dépôt de la caisse (il ne fait pas partie de l\u2019application). La tablette le vérifie à chaque ouverture avec du réseau et propose de l\u2019installer.</div>' +
    '</section>' +
    '<section style="display:flex;flex-direction:column;gap:12px">' +
      '<h2 style="margin:0;font-size:19px;font-weight:800">Point de vente</h2>' +
      '<div class="sub" style="font-size:16px">Choisissez le point de vente de cette tablette. Ce choix est mémorisé et toutes les ventes y seront liées.</div>' +
      places +
    '</section>' +
    '<section data-feat="imprimante" style="display:flex;flex-direction:column;gap:12px">' +
      '<h2 style="margin:0;font-size:19px;font-weight:800">Imprimante de tickets et tiroir-caisse <span class="sub" style="font-weight:600">(facultatif)</span></h2>' +
      '<div class="sub">Epson TM-m30III sur le même Wi-Fi que la tablette, tiroir branché sur l\u2019imprimante. Adresse IP de l\u2019imprimante (imprimée sur la feuille d\u2019état, en maintenant le bouton FEED à l\u2019allumage). Laisser vide s\u2019il n\u2019y a pas d\u2019imprimante.</div>' +
      '<label class="f">Adresse de l\u2019imprimante<input type="text" inputmode="url" data-f="prIp" value="' + esc(S.prIp || '') + '" placeholder="ex. ' + PR_IP_DEFAUT + '" autocomplete="off" autocapitalize="none" spellcheck="false"></label>' +
      '<div class="actions stack" style="justify-content:flex-start">' +
        ((S.prIp || '').trim() ? '<a class="btn" href="' + esc(prBase(S.prIp)) + '/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none;color:var(--text)">Accepter le certificat</a>' : '') +
        '<button class="btn" data-a="prTest"' + ((S.prIp || '').trim() ? '' : ' disabled') + '>Ticket test</button>' +
        '<button class="btn" data-a="prDrawerTest"' + ((S.prIp || '').trim() ? '' : ' disabled') + '>Tester le tiroir</button>' +
        (PR.ip ? '<button class="btn btn-danger" data-a="prForget">Retirer l\u2019imprimante</button>' : '') +
      '</div>' +
      (S.prMsg ? '<div class="result' + (S.prMsg.ok === false ? ' ko' : '') + '" style="display:block;font-size:15px;line-height:1.45">' + esc(S.prMsg.text) + '</div>' : '') +
      '<div class="sub">Première fois sur cette tablette : touchez « Accepter le certificat », choisissez « Paramètres avancés » puis « Continuer », revenez dans la caisse, puis « Ticket test ». Si Chrome demande l\u2019accès aux appareils du réseau local, autorisez-le.</div>' +
    '</section>' +
    (!ghConfigured() ? '' : '<section style="display:flex;flex-direction:column;gap:12px">' +
      '<h2 style="margin:0;font-size:19px;font-weight:800">Envoi des ventes sur GitHub <span class="sub" style="font-weight:600">(facultatif)</span></h2>' +
      '<div class="row" style="gap:16px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--ground)">' +
        '<div style="display:flex;flex-direction:column;gap:2px"><strong style="font-size:17px">' + (ghReady() ? 'Déverrouillé sur cet appareil' : 'Verrouillé') + '</strong>' +
        '<span class="sub">' + (ghReady() ? 'Dépôt ' + esc(GH_REPO) + ', appareil ' + esc(GH.appareil) + '. Les ventes partent automatiquement dès que la tablette a internet (aussi à la main : menu ⋮ ou Ventes des jours précédents).' : 'Déverrouillez avec la phrase de passe des caisses : les ventes partiront ensuite automatiquement dès que la tablette a internet.') + '</span></div>' +
        '<button class="btn" data-a="openGh" style="flex-shrink:0">' + (ghReady() ? 'Gérer' : 'Déverrouiller') + '</button>' +
      '</div>' +
    '</section>') +
    '<div class="actions"><button class="btn" data-a="goHome">Annuler</button>' +
    '<button class="btn btn-primary" data-a="saveSetup"' + (S.pending ? '' : ' disabled') + '>Enregistrer</button></div>' +
    '</div></div>';
}

function vImport() {
  var im = S.importing;
  if (im.error) {
    return '<div class="overlay"><div class="modal"><h2>Catalogue non valide</h2>' +
      '<div class="result ko" style="font-size:16px;display:block">' + esc(im.error) + '</div>' +
      '<div class="sub">Le catalogue actuel reste en place. Prévenez la personne qui gère l\u2019application.</div>' +
      '<div class="actions"><button class="btn" data-a="close">Fermer</button></div></div></div>';
  }
  var c = im.cat, warns = [];
  if (S.placeId && !c.pointsDeVente.some(function (p) { return p.id === S.placeId; })) warns.push('Le point de vente de cette tablette n’existe pas dans ce catalogue : il faudra le choisir à nouveau.');
  if (S.cart.length) warns.push('Le panier en cours sera vidé.');
  return '<div class="overlay"><div class="modal"><h2>Nouveau catalogue disponible</h2>' +
    '<div class="sub">Installé actuellement : ' + esc(catalogueLabel(CATALOGUE)) + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--line);border-radius:12px">' +
      '<strong style="font-size:18px">' + esc(catalogueLabel(c)) + '</strong>' +
      '<span class="sub">' + c.categories.map(function (k) { return esc(k.nom) + ' (' + k.produits.length + ')'; }).join(' · ') + '</span>' +
      '<span class="sub">Points de vente : ' + c.pointsDeVente.map(function (p) { return esc(p.nom); }).join(', ') + '</span>' +
    '</div>' +
    warns.map(function (w) { return '<div style="padding:10px 14px;border-radius:10px;background:var(--warn-bg);color:var(--warn-text);font-weight:700;font-size:15px">' + w + '</div>'; }).join('') +
    '<div class="sub">Les ventes déjà enregistrées ne changent pas : elles gardent le nom et le prix de chaque produit.</div>' +
    '<div class="actions"><button class="btn" data-a="close">Plus tard</button><button class="btn btn-primary" data-a="installCatalogue">Installer</button></div></div></div>';
}

/* Bouton Livraison : dans le panier, à côté de « Remise ticket » (toujours au même endroit, quelle que soit la largeur) */
var TRUCK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4h13v12H1zM14 8h4l4 4v4h-8z"/><circle cx="5.5" cy="18" r="2"/><circle cx="18.5" cy="18" r="2"/></svg>';
function vDelivBtn() {
  var d = deliveryProduct(); if (!d) return '';
  var inCart = S.cart.some(function (l) { return l.produitId === d.p.id; });
  return '<button class="small deliv' + (inCart ? ' set' : '') + '" data-a="addDelivery">' + TRUCK + '<span>' + (inCart ? 'Livraison ✓' : 'Livraison') + '</span></button>';
}
var DOC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>';
function vFacBtn() {
  var f = S.cartFac;
  return '<button class="small deliv' + (f ? ' set' : '') + '" data-a="facOpen" data-v="cart">' + DOC + '<span>' + (f ? (f.payee ? 'Facture ✓' : 'Facture · non payé') : 'À facturer') + '</span></button>';
}
var PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
function vShortcut() {
  var p = shortcutProduct();
  if (!p) return '<button class="free" data-a="openFree">+ Article libre</button>';
  return '<button class="free short" data-a="add" data-v="' + esc(p.id) + '">' + PLUS + '<span>' + esc(p.libelle) + '</span></button>';
}
function vCaisse() {
  var CATS = visibleCats();
  var cat = CATS.filter(function (c) { return c.id === S.cat; })[0] || CATS[0] || { nom: '', produits: [] };
  var html = '<div class="body"><div class="catalog"><div class="cats">' +
    CATS.map(function (c) { var cc = themeCatStyle(c.id); return '<button class="cat' + (c.id === cat.id ? ' on' : '') + '" data-a="cat" data-v="' + c.id + '"' + (cc ? ' style="' + (c.id === cat.id ? 'background:' + cc + ';border-color:' + cc + ';color:' + thInk(cc) : 'border-color:' + cc) + '"' : '') + '>' + esc(themeCatEmoji(c.id)) + esc(c.nom) + '</button>'; }).join('') +
    vShortcut() + '</div><div class="products">' +
    (CATS.length ? '' : '<div class="emptycat">Aucun article dans le catalogue. Ajoutez-les dans l\u2019app Admin (Gestion d\u2019événement › Catalogue), ou utilisez « + Article libre ».' + '</div>') +
    (function () { var st = stockOfPlace(); return cat.produits.map(function (p) {
      var ph = themePhoto(p.id), cc = themeCatStyle(cat.id); return '<button class="prod' + (ph ? ' ph' : '') + '" data-a="add" data-v="' + p.id + '"' + (cc ? ' style="border-top:5px solid ' + cc + '"' : '') + '>' + (ph ? '<img class="pph" src="' + ph + '" alt="">' : '') + '<div style="display:flex;flex-direction:column;gap:2px"><span class="m">' + esc(p.libelle) + '</span><span class="s">' + esc(cat.nom) + '</span></div>' + vRest(st, p.id) + '<span class="p">' + money(p.prix) + '</span></button>';
    }).join(''); })() + '</div></div>';

  if (PHONE && S.cart.length && !S.cartOpen) {
    var nb = S.cart.reduce(function (a, l) { return a + l.qty; }, 0);
    html += '<button class="cartbar" data-a="openCart"><span class="n">' + nb + '</span><span>Voir le panier</span><span class="tt">' + money(total()) + '</span></button>';
  }
  html += '<div class="cart' + (S.cartOpen ? ' open' : '') + '"><div class="cart-h">' + (PHONE ? '<button class="back" data-a="closeCart">← Produits</button>' : '') + '<h2>Panier</h2>' + (S.cart.length ? '<button class="small btn-danger" data-a="clear">Vider</button>' : '') + '</div><div class="lines">';
  if (!S.cart.length) html += '<div class="empty">Touchez un produit pour l\'ajouter</div>';
  S.cart.forEach(function (l, i) {
    html += '<div class="line">' + (FEAT('remiseLigne') ? '<button class="info" data-a="lineDisc" data-v="' + i + '" aria-label="Remise sur cet article">' : '<div class="info">') + '<span class="n">' + esc(l.name) + '</span><span class="u">' + money(l.price) + ' / pièce</span>' +
      (l.disc ? '<span class="d">Remise ' + discText(l.disc) + '</span>' : '') + (FEAT('remiseLigne') ? '</button>' : '</div>') +
      '<div class="qty"><button data-a="dec" data-v="' + i + '" aria-label="Retirer un">−</button><span>' + l.qty + '</span><button data-a="inc" data-v="' + i + '" aria-label="Ajouter un"' + (isDeliveryId(l.produitId) ? ' disabled' : '') + '>+</button></div>' +
      '<span class="t">' + money(lineTotal(l)) + '</span></div>';
  });
  html += '</div><div class="cart-f">' +
    '<div class="row" style="font-size:16px;color:var(--muted)"><span>Sous-total</span><span>' + money(up5(subtotal())) + '</span></div>' +
    '<div class="row"><div class="tacts">' + (FEAT('remiseTicket') ? '<button class="small" data-a="ticketDisc"' + (S.cart.length ? '' : ' disabled') + '>Remise ticket</button>' : '') + vDelivBtn() + vFacBtn() + '</div><span style="font-weight:700;color:var(--amber)">' + (S.ticketDisc ? discText(S.ticketDisc) : '') + '</span></div>' +
    '<div class="row"><span style="font-size:22px;font-weight:800">TOTAL</span><span class="total">' + money(total()) + '</span></div>' +
    '<button class="pay" data-a="openPay"' + (S.cart.length ? '' : ' disabled') + '>Encaisser</button></div></div></div>';
  return html;
}

function histDays() {
  var t = today(), ds = Object.keys(S.days).filter(function (d) { return S.days[d] && S.days[d].length; });
  if (ds.indexOf(t) < 0) ds.push(t);
  return ds.sort().reverse().slice(0, 7);
}
/* Livraison ajoutée après coup (Historique) : nouvelle vente « Livraison » liée à la vente d'origine (champ venteLiee),
   encaissée avec le même écran d'encaissement (tiroir, ticket). La vente d'origine et son ticket ne changent pas. */
function saleNum(id) { return String(id || '').split('-').pop(); }
function findSale(id) { var r = null; Object.keys(S.days).forEach(function (d) { (S.days[d] || []).forEach(function (v) { if (v.id === id) r = { date: d, v: v }; }); }); return r; }
function linkedDelivery(id) { var r = null; Object.keys(S.days).forEach(function (d) { (S.days[d] || []).forEach(function (v) { if (v.venteLiee === id && !v.annulation) r = { date: d, v: v }; }); }); return r; }
function hasDeliveryLine(v) { return v.lignes.some(function (l) { return isDeliveryId(l.produitId) || isDeliveryLabel(l.libelle); }); }
function restoreCart() { if (S.savedCart) { S.cart = S.savedCart.cart; S.ticketDisc = S.savedCart.ticketDisc; S.cartLiv = S.savedCart.cartLiv || null; S.cartFac = S.savedCart.cartFac || null; } S.savedCart = null; S.after = null; S.afterLiv = null; }
function vHist() {
  var days = histDays(), day = days.indexOf(S.histDay) >= 0 ? S.histDay : today();
  var all = salesOf(day), ok = validSales(all), nAnn = all.length - ok.length;
  var tot = ok.reduce(function (a, v) { return a + v.total; }, 0);
  var html = '<div class="hist"><div class="hhead"><h2>Ventes du ' + frDate(day) + '</h2>' +
    (days.length > 1 ? '<div class="hdays">' + days.map(function (d) {
      return '<button class="choice' + (d === day ? ' on' : '') + '" data-a="histDay" data-v="' + d + '">' + (d === today() ? 'Aujourd\u2019hui' : frDate(d).slice(0, 5)) + '</button>'; }).join('') + '</div>' : '') + '</div>';
  if (!all.length) return html + '<div class="empty" style="padding:60px">Aucune vente ce jour-là</div></div>';
  html += '<div class="hsum"><strong>' + ok.length + ' vente' + (ok.length > 1 ? 's' : '') + ' · ' + money(tot) + '</strong>' +
    (nAnn ? '<span class="sub">' + nAnn + ' vente' + (nAnn > 1 ? 's' : '') + ' annulée' + (nAnn > 1 ? 's' : '') + ', non comptée' + (nAnn > 1 ? 's' : '') + '</span>' : '') + '</div>';
  html += '<div class="table">';
  all.slice().reverse().forEach(function (v) {
    var lines = v.lignes.map(function (l) { return l.quantite + ' × ' + esc(l.libelle) + (l.remise ? ' (' + discText(fromJsonDisc(l.remise)) + ')' : ''); });
    if (v.remiseTicket) lines.push('Remise ticket ' + discText(fromJsonDisc(v.remiseTicket)));
    var p = v.paiement, pay = v.commande ? (p.cash + p.bancontact > 0 ? (p.mode === 'cash' ? 'Cash ' : p.mode === 'bancontact' ? 'Bancontact ' : 'Mixte ') + money(p.cash + p.bancontact) + '<br>' : '') + 'Payé à la commande ' + money(v.commande.dejaPaye || 0) : unpaid(v) ? '<span style="color:var(--red);font-weight:800">À facturer · non payé</span>' + (p.cash + p.bancontact > 0 ? '<br>déjà payé ' + money(p.cash + p.bancontact) : '') : p.mode === 'cash' ? 'Cash' : p.mode === 'bancontact' ? 'Bancontact' : 'Mixte · cash ' + money(p.cash) + ' + Bancontact ' + money(p.bancontact);
    var an = v.annulation;
    html += '<div class="sale' + (an ? ' cancelled' : '') + '"><span class="h">' + v.horodatage.slice(11, 16) + '</span><div class="l">' + lines.map(function (x) { return '<span>' + x + '</span>'; }).join('') +
      (v.venteLiee ? (function () { var o = findSale(v.venteLiee); return '<span class="link">Livraison de la vente n° ' + esc(saleNum(v.venteLiee)) + (o ? ' (' + (o.date !== day ? frDate(o.date).slice(0, 5) + ' ' : '') + o.v.horodatage.slice(11, 16) + ')' : '') + '</span>'; })() : '') +
      (v.livraisonAjoutee ? '<span class="link">Livraison ajoutée' + (v.livraisonAjoutee.horodatage.slice(0, 10) !== day ? ' le ' + frDate(v.livraisonAjoutee.horodatage).slice(0, 5) : '') + ' à ' + v.livraisonAjoutee.horodatage.slice(11, 16) + ' · ' + money(v.livraisonAjoutee.montant) + ' ' + (v.livraisonAjoutee.paiement.mode === 'cash' ? 'en cash' : v.livraisonAjoutee.paiement.mode === 'bancontact' ? 'par Bancontact' : 'en mixte') + '</span>' : '') +
      (!an && !v.venteLiee ? (function () { var ld = linkedDelivery(v.id); return ld ? '<span class="link">Livraison ajoutée' + (ld.date !== day ? ' le ' + frDate(ld.date).slice(0, 5) : '') + ' à ' + ld.v.horodatage.slice(11, 16) + ' (vente n° ' + esc(saleNum(ld.v.id)) + ')</span>' : ''; })() : '') +
      (v.commande ? '<span class="link">Commande n° ' + esc(cmdNum(v.commande.numero)) + ' · déjà payé ' + money(v.commande.dejaPaye || 0) + '</span>' : '') +
      (v.livraison ? '<span class="link">Livraison : ' + esc(v.livraison.nom) + ' · ' + esc(v.livraison.adresse) + ' · ' + esc(v.livraison.telephone) + '</span>' : '') +
      (v.facture ? '<span class="link">Facture : ' + esc(v.facture.societe) + ' · TVA ' + esc(v.facture.tva) + (v.facture.paiement ? ' · payée le ' + frDate(v.facture.paiement.horodatage).slice(0, 5) : '') + '</span>' : '') +
      (an ? '<span class="annul">Annulée à ' + an.horodatage.slice(11, 16) + (an.horodatage.slice(0, 10) !== day ? ' le ' + frDate(an.horodatage) : '') + (an.motif ? ' · ' + esc(an.motif) : '') + '</span>' : '') +
      '</div><span class="pm">' + pay + '</span><span class="tt">' + money(v.total) + '</span>' +
      '<span class="act">' + (an ? '' : (prConfigured() ? '<button class="btn" data-a="reprint" data-v="' + esc(day + '|' + v.id) + '"' + (S.prBusy ? ' disabled' : '') + '>Ticket</button>' : '') +
        (deliveryProduct() && !v.commande && !v.venteLiee && !hasDeliveryLine(v) && !linkedDelivery(v.id) ? '<button class="btn hdeliv" data-a="histDeliv" data-v="' + esc(v.id) + '">' + TRUCK + '<span>Livraison</span></button>' : '') +
        (hasDeliveryLine(v) ? '<button class="btn hdeliv" data-a="livOpen" data-v="' + esc('edit:' + day + '|' + v.id) + '">' + TRUCK + '<span>' + (prConfigured() ? 'Ticket livraison' : 'Infos livraison') + '</span></button>' : '') +
        '<button class="btn hdeliv" data-a="facOpen" data-v="' + esc(day + '|' + v.id) + '">' + DOC + '<span>' + (v.facture ? 'Facture ✓' : 'À facturer') + '</span></button>' +
        (unpaid(v) && dueOf(v) > 0 ? '<button class="btn btn-primary" data-a="histPay" data-v="' + esc(v.id) + '">Encaisser</button>' : '') +
        '<button class="btn btn-danger" data-a="askCancel" data-v="' + esc(day + '|' + v.id) + '">Annuler</button>') + '</span></div>';
  });
  return html + '</div></div>';
}

var MI = {
  percent: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18H6a4 4 0 0 1-.6-7.96A6 6 0 0 1 17.3 8.5 4.5 4.5 0 0 1 17 18h-1"/><path d="M12 12v8M9 15l3-3 3 3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8"/><path d="M20 3v5h-5"/></svg>',
  drawer: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="9" rx="2"/><path d="M5 11V6h14v5M10 15.5h4"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  cash: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg>'
};
/* Bandeau ☁ de l'accueil et mention de l'en-tête : état de l'envoi automatique (toucher = fenêtre GitHub) */
function vAutoBar() {
  var a = autoStatus(); if (!a) return '';
  var st = a.ko ? 'background:var(--warn-bg);color:var(--red);border-color:var(--red)' : a.warn ? 'background:var(--warn-bg);color:var(--warn-text)' : 'color:var(--muted)';
  return '<button class="autobar" data-a="openGh" style="' + st + '">☁ ' + esc(a.t) + '</button>';
}
function vAutoMini(sep) {
  var a = autoStatus(); if (!a) return '';
  return sep + '<span data-a="openGh" style="cursor:pointer;font-weight:700;white-space:nowrap;color:' + (a.ko ? 'var(--red)' : a.warn ? 'var(--amber)' : 'var(--faint)') + '">☁ ' + esc(PHONE ? a.court.replace('Envoi auto inactif', 'Envoi inactif').replace('En attente de réseau', 'Attente réseau') : a.court) + '</span>';
}
function vPrMini(sep) {
  if (!prConfigured()) return '';
  var s = PR_ST.state, txt = S.prBusy ? 'Impression…' : s === 'ok' ? 'Prête' : s === null ? 'Vérification…' : PR_ST.text;
  if (PHONE) txt = txt.replace(/^Imprimante (injoignable|hors ligne|occupée).*$/, function (m, w) { return w.charAt(0).toUpperCase() + w.slice(1); }).replace(/^Erreur imprimante$/, 'Erreur').replace(/^Imprimante : /, '');
  return sep + '<span data-a="prCheckNow" style="cursor:pointer;font-weight:700;white-space:nowrap;color:' + (s === 'ok' || s === null ? 'var(--faint)' : s === 'warn' ? 'var(--amber)' : 'var(--red)') + '">🖨 ' + esc(txt) + '</span>';
}
/* ---------- Écran « Réception de stock » ---------- */
function rcLines() {
  var out = [];
  if (!CATALOGUE) return out;
  CATALOGUE.categories.forEach(function (k) { k.produits.forEach(function (p) { if (isDeliveryLabel(p.libelle)) return; var q = parseInt(S.rq[p.id], 10); if (q > 0) out.push({ id: p.id, q: q, libelle: stkArticle(p.id).libelle }); }); });
  return out;
}
function rcTotalText(l) {
  if (!l.length) return 'Aucun article';
  var pcs = l.reduce(function (a, x) { return a + x.q; }, 0);
  return l.length + ' article' + (l.length > 1 ? 's' : '') + ' · ' + pcs + ' pièce' + (pcs > 1 ? 's' : '');
}
function rcStatus() {
  var n = STK.queue.length;
  if (STK.busy) return { cls: '', t: 'Envoi en cours…' };
  if (n) {
    var why = !ghReady() ? 'envoi GitHub verrouillé : touchez le bandeau ☁ de l’accueil pour déverrouiller'
      : navigator.onLine === false ? 'pas de réseau : envoi dès le retour d’internet'
      : STK.err != null ? stkErrText(STK.err) : 'envoi dans quelques instants';
    return { cls: 'warn', t: stkPendingText() + ' en attente sur la tablette (' + why + ')' };
  }
  if (STK.err != null) return { cls: 'ko', t: stkErrText(STK.err) };
  if (STK.noSeason) return { cls: 'ko', t: stkErrText('nosaison') };
  return { cls: 'ok', t: 'Tout est envoyé' + (STK.lu ? ' · liste lue le ' + frDate(STK.lu).slice(0, 5) + ' à ' + STK.lu.slice(11, 16) : '') };
}
function rcLineText(l) { return l.map(function (x) { return x.q + ' × ' + esc(x.libelle); }).join(', '); }
function vReception() {
  var pl = findPlace(S.placeId), others = CATALOGUE.pointsDeVente.filter(function (p) { return p.id !== S.placeId; });
  var lines = rcLines(), st = rcStatus();
  var head = '<div class="row"><h2>Réception de stock</h2><button class="btn" data-a="close">Fermer</button></div>';
  if (S.rcStep === 'confirm') {
    var de = findPlace(S.rcDe);
    return '<div class="overlay"><div class="modal rcmodal">' + head +
      '<div class="rcbox"><div><span class="sub">Date</span><strong>' + frDate(S.rcDate) + '</strong></div><div><span class="sub">Depuis</span><strong>' + esc(de ? de.nom : '') + '</strong></div><div><span class="sub">Vers</span><strong>' + esc(pl ? pl.nom : '') + '</strong></div></div>' +
      '<div class="rclist">' + lines.map(function (x) { return '<div class="rcrow"><span>' + esc(x.libelle) + '</span><strong>' + x.q + '</strong></div>'; }).join('') + '</div>' +
      '<div class="rctot">' + rcTotalText(lines) + '</div>' +
      '<div class="actions"><button class="btn" data-a="rcBack">Modifier</button><button class="btn btn-primary" data-a="rcSave">Confirmer la réception</button></div></div></div>';
  }
  var cats = CATALOGUE.categories.map(function (k) {
    var prods = k.produits.filter(function (p) { return !isDeliveryLabel(p.libelle); }); if (!prods.length) return '';
    return '<div class="rccat">' + esc(k.nom) + '</div>' + prods.map(function (p) {
      return '<label class="rcrow"><span>' + esc(p.libelle) + '</span><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0" data-f="rq:' + esc(p.id) + '" value="' + esc(S.rq[p.id] || '') + '"></label>';
    }).join('');
  }).join('');
  var queued = STK.queue.filter(function (o) { return o.op === 'add' && o.mv.vers === S.placeId; }).map(function (o) {
    var de = findPlace(o.mv.de);
    return { id: o.id, date: o.mv.date, deNom: (de && de.nom) || o.mv.de, source: 'caisse', appareil: GH.appareil, attente: true,
      lignes: Object.keys(o.mv.lignes).map(function (pid) { var a = stkArticle(pid); return { q: o.mv.lignes[pid], libelle: (a && a.libelle) || (o.noms && o.noms.articles && o.noms.articles[pid] && o.noms.articles[pid].libelle) || pid }; }) };
  });
  var dels = {}; STK.queue.forEach(function (o) { if (o.op === 'del') dels[o.id] = true; });
  var hist = queued.reverse().concat(STK.recus.filter(function (r) { return !queued.some(function (q) { return q.id === r.id; }); })).map(function (r) {
    var mine = r.source === 'caisse' && r.appareil === GH.appareil;
    var orig = r.source === 'caisse' ? 'Caisse' + (mine ? ' (cette tablette)' : r.appareil ? ' (appareil ' + esc(r.appareil) + ')' : '') : 'Admin';
    var act = dels[r.id] ? '<span class="sub">Suppression en attente d’envoi</span>'
      : !mine ? ''
      : S.rcDel === r.id ? '<button class="btn btn-danger" data-a="rcDelGo" data-v="' + esc(r.id) + '" style="border:1px solid var(--red)">Confirmer la suppression</button><button class="btn" data-a="rcDelNo">Annuler</button>'
      : '<button class="btn btn-danger" data-a="rcDelAsk" data-v="' + esc(r.id) + '">Supprimer</button>';
    return '<div class="rchist"><div class="rch-top"><strong>' + frDate(r.date) + ' · depuis ' + esc(r.deNom) + '</strong><span class="sub">' + orig + (r.attente ? ' · <b class="rcwait">en attente d’envoi</b>' : '') + '</span></div>' +
      '<div class="rch-l">' + rcLineText(r.lignes) + '</div>' + (act ? '<div class="rch-a">' + act + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="overlay"><div class="modal rcmodal" data-keep="rc">' + head +
    '<div class="sub">Articles arrivés d’un autre stand vers <strong>' + esc(pl ? pl.nom : '') + '</strong>. Ils sont ajoutés au stock de la saison géré par l’App admin.</div>' +
    (S.rcMsg ? '<div class="rcmsg ' + (S.rcMsg.ok ? 'ok' : 'warn') + '">' + esc(S.rcMsg.text) + '</div>' : '') +
    '<div class="rcstat ' + st.cls + '">' + esc(st.t) + '</div>' +
    '<label class="f">Date<input type="date" data-f="rcDate" value="' + esc(S.rcDate) + '"></label>' +
    '<div class="f"><span class="sub" style="font-weight:700">Depuis le stand</span><div class="rcchips">' +
      (others.length ? others.map(function (p) { return '<button class="rcchip' + (S.rcDe === p.id ? ' on' : '') + '" data-a="rcDe" data-v="' + esc(p.id) + '">' + esc(p.nom) + '</button>'; }).join('') : '<span class="sub">Aucun autre point de vente dans le catalogue.</span>') +
    '</div></div>' +
    '<div class="rclist">' + cats + '</div>' +
    '<div class="rcfoot"><span class="rctot" id="rcTot">' + rcTotalText(lines) + '</span><button class="btn btn-primary" data-a="rcAsk">Enregistrer la réception</button></div>' +
    '<h3 class="rch3">Reçus par ' + esc(pl ? pl.nom : '') + (STK.saison && STK.saison.nom ? ' · ' + esc(STK.saison.nom) : ' cette saison') + '</h3>' +
    (STK.loading ? '<div class="sub">Lecture du stock…</div>' : '') +
    (hist || '<div class="empty" style="padding:16px">' + (ghReady() ? 'Aucun transfert reçu pour l’instant.' : 'Déverrouillez l’envoi GitHub pour voir les transferts reçus.') + '</div>') +
    '<div class="sub">Seuls les transferts encodés sur cette tablette peuvent être supprimés ici. Les autres corrections se font dans l’App admin.</div>' +
    '</div></div>';
}
function vMenu() {
  if (!S.menu) return '';
  function tile(a, icon, label, sub, extra) {
    return '<button class="mtile" data-a="' + a + '"' + (extra || '') + '>' + icon + '<span class="mt-l">' + label + '</span>' + (sub ? '<span class="mt-s">' + sub + '</span>' : '') + '</button>';
  }
  var cs = cxSummary();
  /* Ordre voulu (3 par ligne sur tablette) : Envoyer maintenant, Caisse du jour, Ventes des jours précédents /
     Vérifier le catalogue, Stock du stand, Réception de stock / Article libre, Remise ticket (+ Ouvrir le tiroir si imprimante) */
  var tiles =
    (ghConfigured() ? (ghReady() ? tile('ghSend', MI.up, S.ghBusy ? 'Envoi en cours…' : 'Envoyer maintenant', 'Vers l\u2019Admin · ' + (autoStatus() || {}).court, S.ghBusy ? ' disabled' : '')
      : tile('openGh', MI.up, 'Envoyer maintenant', 'Verrouillé : toucher pour déverrouiller')) : '') +
    tile('cxOpen', MI.cash, 'Caisse du jour', cs.comptage && Math.abs(cxDelta(today())) >= 0.005 ? 'À recompter' : cs.comptage ? 'Comptée · écart ' + signed(cs.comptage.ecart) : cs.fond == null ? 'Fond de caisse à saisir' : 'Attendu : ' + money(cs.attendu)) +
    tile('showDays', MI.cal, 'Ventes des jours précédents', 'Télécharger, envoyer, effacer') +
    tile('checkCatMenu', MI.refresh, S.catLoading ? 'Vérification…' : 'Vérifier le catalogue', S.siteUpdate ? 'Mise à jour disponible' : 'Installé : v' + CATALOGUE.version, S.siteUpdate ? ' style="border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)"' : '') +
    (ghConfigured() ? tile('stkShow', MI.chart, 'Stock du stand', STKC.at && STKC.place === S.placeId ? 'Calculé le ' + frDate(STKC.at).slice(0, 5) + ' à ' + STKC.at.slice(11, 16) : 'Restant par article') : '') +
    (ghConfigured() ? tile('rcOpen', MI.box, 'Réception de stock', STK.queue.length ? STK.queue.length + ' en attente d\u2019envoi' : 'Articles venus d\u2019un autre stand') : '') +
    tile('openFreeMenu', MI.tag, 'Article libre', 'Hors catalogue : libellé et prix') +
    tile('discAsk', MI.percent, 'Remise ticket', !S.cart.length ? 'Panier vide' : S.ticketDisc ? 'Remise : ' + discText(S.ticketDisc) : 'Code demandé', S.cart.length ? '' : ' disabled') +
    (prConfigured() ? tile('drawerAsk', MI.drawer, 'Ouvrir le tiroir', 'Sans vente (motif demandé)') : '');
  return '<div class="menu-back" data-a="toggleMenu"></div><div class="menu tiles" role="menu">' +
    '<div class="mgrid m3">' + tiles + '</div>' +
    '<button class="mhome" data-a="goHome">' + MI.home + '<span>Retour à l\u2019accueil</span><span class="mt-s">Paramètres de la tablette</span></button>' +
    '<div class="meta">' + catalogueLabel(CATALOGUE) + '</div></div>';
}
function vCmdTab() {
  if (!ghConfigured() || !FEAT('commandesCaisse')) return '';
  var n = cmdTodoCount();
  return '<button class="' + (S.tab === 'cmd' ? 'on' : '') + '" data-a="tab" data-v="cmd">Commandes' + (n ? '<span class="cbadge">' + n + '</span>' : '') + '</button>';
}
function vCmd() {
  var list = cmdList(), t = today(), q = (S.cmdQ || '').trim().toLowerCase().replace(/^n°\s*/, ''), done = S.cmdTab === 'done';
  var todo = list.filter(function (x) { return x.statut !== 'livree'; }), ret = list.filter(function (x) { return x.statut === 'livree'; });
  var rows = (done ? ret : todo).filter(function (x) { var c = x.c; return !q || String(c.numero) === q || ((c.client && c.client.nom) || '').toLowerCase().indexOf(q) >= 0; });
  if (done) rows.sort(function (a, b) { return String((b.enc && b.enc.horodatage) || '').localeCompare(String((a.enc && a.enc.horodatage) || '')); });
  else rows.sort(function (a, b) { return String(a.c.retrait.date || '').localeCompare(String(b.c.retrait.date || '')) || (Number(a.c.numero) || 0) - (Number(b.c.numero) || 0); });
  var stat = !ghReady() ? { cls: 'warn', t: 'Déverrouillez l’envoi GitHub (bandeau ☁ de l’accueil) pour lire les commandes.' + (CMD.lu ? ' Affichage de la lecture du ' + frDate(CMD.lu).slice(0, 5) + ' à ' + CMD.lu.slice(11, 16) + '.' : '') }
    : CMD.loading ? { cls: '', t: 'Lecture des commandes…' }
    : CMD.err != null ? { cls: 'warn', t: ghError(CMD.err) + (CMD.lu ? ' · lecture du ' + frDate(CMD.lu).slice(0, 5) + ' à ' + CMD.lu.slice(11, 16) : '') }
    : navigator.onLine === false ? { cls: 'warn', t: 'Hors ligne · commandes lues le ' + (CMD.lu ? frDate(CMD.lu).slice(0, 5) + ' à ' + CMD.lu.slice(11, 16) : '—') }
    : CMD.lu ? { cls: 'ok', t: 'Lues à ' + CMD.lu.slice(11, 16) + (CMD.queue.length ? ' · ' + CMD.queue.length + ' mise' + (CMD.queue.length > 1 ? 's' : '') + ' à jour en attente d’envoi' : '') } : { cls: 'warn', t: 'Pas encore lues : il faut internet.' };
  var html = '<div class="hist cmdv"><div class="hhead"><h2>Commandes à retirer</h2><div class="seg">' +
    '<button class="' + (done ? '' : 'on') + '" data-a="cmdTab" data-v="todo">À retirer (' + todo.length + ')</button>' +
    '<button class="' + (done ? 'on' : '') + '" data-a="cmdTab" data-v="done">Retirées (' + ret.length + ')</button></div></div>' +
    CMD.alerts.map(function (a) { return '<div class="result ko" style="display:block;font-size:16px;margin-bottom:8px">' + esc(a.texte) + '</div>'; }).join('') +
    (CMD.alerts.length ? '<div style="margin-bottom:10px"><button class="btn" data-a="cmdAlertOk">J’ai compris</button></div>' : '') +
    '<div class="cmdtools"><input type="search" data-f="cmdQ" value="' + esc(S.cmdQ || '') + '" placeholder="Rechercher un nom ou un n°" autocomplete="off"><button class="btn" data-a="cmdReload"' + (CMD.loading || CMD.busy ? ' disabled' : '') + '>Actualiser</button></div>' +
    '<div class="rcstat ' + stat.cls + '">' + esc(stat.t) + '</div>';
  if (!rows.length) return html + '<div class="empty" style="padding:40px">' + (q ? 'Aucune commande trouvée' : done ? 'Aucune commande retirée' : 'Aucune commande à retirer à ce stand') + '</div></div>';
  html += '<div class="cmdlist">' + rows.map(function (x) {
    var c = x.c, d = c.retrait.date || '', late = !done && d && d < t, isT = !done && d === t, reste = cmdReste(c), cl = c.client || {};
    var when = d ? (isT ? 'Aujourd’hui' : frDate(d)) : 'Date non fixée';
    var act;
    if (x.statut === 'livree') {
      var e = x.enc || {};
      act = '<div class="cmddone">' + (x.attente ? 'Retirée (envoi en attente)' : 'Retirée' + (e.horodatage ? ' le ' + frDate(e.horodatage).slice(0, 5) + ' à ' + e.horodatage.slice(11, 16) : '') + (e.venteId ? ' (vente n° ' + esc(saleNum(e.venteId)) + ')' : '')) + '</div>';
    } else act = '<button class="btn btn-primary" data-a="cmdPay" data-v="' + esc(x.id) + '">' + (reste > 0 ? 'Encaisser ' + money(reste) : 'Remettre au client') + '</button>';
    return '<div class="cmd' + (late ? ' late' : isT ? ' today' : '') + '">' +
      '<div class="cmdh"><strong>N° ' + esc(cmdNum(c.numero)) + ' · ' + esc(cl.nom || '') + '</strong><span class="cmdd' + (late ? ' ko' : isT ? ' ok' : '') + '">' + (late ? 'En retard · ' : '') + when + '</span></div>' +
      (cl.tel ? '<div class="sub">Tél ' + esc(cl.tel) + '</div>' : '') +
      '<div class="cmdl">' + (c.lignes || []).map(function (l) { return '<span>' + (Number(l.quantite) || 0) + ' × ' + esc(l.libelle || '') + '</span>'; }).join('') + '</div>' +
      '<div class="cmdm"><span>Total <b>' + money(Number(c.total) || 0) + '</b></span><span>Déjà payé <b>' + money(cmdPaid(c)) + '</b>' + (cmdPaid(c) > 0 && c.paye && c.paye.mode ? ' (' + esc(cmdModeTxt(c.paye.mode)) + ')' : '') + '</span>' +
        (x.statut === 'livree' ? '' : '<span>Reste à payer <b class="' + (reste > 0 ? 'koc' : 'okc') + '">' + money(reste) + '</b></span>') + '</div>' +
      (c.note ? '<div class="sub">Remarque : ' + esc(c.note) + '</div>' : '') +
      '<div class="cmdf"><span class="cmds">' + (x.statut === 'livree' ? 'retirée' : x.statut === 'prete' ? 'prête' : 'à préparer') + '</span>' + act + '</div></div>';
  }).join('') + '</div>';
  return html + '</div>';
}
function vPosPhone(d, p) {
  return '<div class="full"><div class="header"><img src="' + themeLogo('text') + '" alt="' + esc(themeGet().nom) + '"><div class="place hplace"><span>' + esc(p ? p.nom : '') + ' · ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + vAutoMini('<br>') + vPrMini('<br>') + '</span></div>' +
    '<button class="iconbtn" data-a="toggleTheme" aria-label="' + (isDark() ? 'Mode clair' : 'Mode sombre') + '">' + (isDark() ? ICON_SUN : ICON_MOON) + '</button>' +
    '<button class="iconbtn" data-a="toggleMenu" aria-label="Menu">' + ICON_DOTS + '</button></div>' +
    '<div class="subbar"><div class="seg"><button class="' + (S.tab === 'caisse' ? 'on' : '') + '" data-a="tab" data-v="caisse">Caisse</button><button class="' + (S.tab === 'hist' ? 'on' : '') + '" data-a="tab" data-v="hist">Historique</button>' + vCmdTab() + '</div></div>' +
    vStorageBar() + (S.tab === 'caisse' ? vCaisse() : S.tab === 'cmd' ? vCmd() : vHist()) + '</div>' +
    vMenu();
}

function vPos() {
  var d = new Date(), p = findPlace(S.placeId);
  if (PHONE) return vPosPhone(d, p);
  return '<div class="full"><div class="header"><img src="' + themeLogo('text') + '" alt="' + esc(themeGet().nom) + '">' +
    '<div class="seg"><button class="' + (S.tab === 'caisse' ? 'on' : '') + '" data-a="tab" data-v="caisse">Caisse</button><button class="' + (S.tab === 'hist' ? 'on' : '') + '" data-a="tab" data-v="hist">Historique</button>' + vCmdTab() + '</div>' +
    '<div style="flex:1"></div><div class="place">' + ICON_PIN + '<span>' + esc(p ? p.nom : '') + ' · ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + vAutoMini('<br>') + vPrMini(ghConfigured() ? ' · ' : '<br>') + '</span></div>' +
    '<button class="iconbtn" data-a="toggleTheme" aria-label="' + (isDark() ? 'Mode clair' : 'Mode sombre') + '">' + (isDark() ? ICON_SUN : ICON_MOON) + '</button>' + '<button class="iconbtn" data-a="toggleMenu" aria-label="Menu">' + ICON_DOTS + '</button></div>' +
    vStorageBar() + (S.tab === 'caisse' ? vCaisse() : S.tab === 'cmd' ? vCmd() : vHist()) + '</div>' +
    vMenu();
}




function vCancel() {
  var parts = (S.cancelRef || '').split('|'), v = salesOf(parts[0]).filter(function (x) { return x.id === parts[1]; })[0];
  if (!v) return '';
  var p = v.paiement, pay = p.mode === 'deja-paye' ? 'payée à la commande' : p.mode === 'a-facturer' ? 'à facturer' : p.mode === 'cash' ? 'cash' : p.mode === 'bancontact' ? 'Bancontact' : 'cash ' + money(p.cash) + ' + Bancontact ' + money(p.bancontact);
  return '<div class="overlay"><div class="modal" style="width:min(560px,96vw)"><h2>Annuler cette vente ?</h2>' +
    (v.commande ? '<div class="sub">Commande n° ' + esc(cmdNum(v.commande.numero)) + ' : elle redeviendra « à retirer » dans l’écran Commandes.</div>' : '') +
    '<div class="result" style="display:block;line-height:1.5"><strong>' + frDate(parts[0]) + ' à ' + v.horodatage.slice(11, 16) + ' · ' + money(v.total) + '</strong> (' + pay + ')<br>' +
      v.lignes.map(function (l) { return l.quantite + ' × ' + esc(l.libelle); }).join(', ') + '</div>' +
    '<label class="f">Motif (facultatif)<input type="text" data-f="cancelMotif" value="' + esc(S.cancelMotif || '') + '" placeholder="ex. erreur de saisie, client remboursé" autocomplete="off"></label>' +
    '<div class="sub">La vente reste visible dans l\u2019historique et dans l\u2019export, marquée « annulée », mais n\u2019est plus comptée dans les totaux. ' +
    (p.cash > 0 ? 'Pensez à rendre <strong>' + money(p.cash) + '</strong> en cash si le client est remboursé. ' : '') +
    (p.bancontact > 0 ? 'Un paiement Bancontact se rembourse sur le terminal. ' : '') + 'Cette action ne peut pas être défaite.</div>' +
    (S.exported[parts[0]] ? '<div class="sub" style="color:var(--amber);font-weight:700">Ce jour a déjà été exporté : il faudra le télécharger à nouveau.</div>' : '') +
    '<div class="actions stack"><button class="btn" data-a="close">Retour</button><button class="btn btn-primary" data-a="doCancel" style="background:var(--red);border-color:var(--red);color:#fff">Annuler la vente</button></div></div></div>';
}



function vGhCfg() {
  var m = S.ghMsg;
  var body = ghReady()
    ? '<div class="sub" style="font-size:15px;line-height:1.5">L\u2019envoi est déverrouillé sur cet appareil (dépôt <strong>' + esc(GH_REPO) + '</strong>, appareil <strong>' + esc(GH.appareil) + '</strong>). Verrouiller efface le jeton de cet appareil ; il faudra la phrase de passe pour le réactiver.</div>'
    : '<div class="sub" style="font-size:15px;line-height:1.5">Saisissez la <strong>phrase de passe des caisses</strong>. Elle n\u2019est demandée qu\u2019une fois sur cet appareil et n\u2019est jamais enregistrée.</div>' +
      '<label class="f">Phrase de passe<input type="password" data-f="ghPass" value="' + esc(S.ghPass || '') + '" autocomplete="off" autocapitalize="none" spellcheck="false"></label>';
  return '<div class="overlay"><div class="modal ghcfg" style="width:min(600px,96vw)"><h2>Envoi des ventes sur GitHub</h2>' + body +
    (m ? '<div class="result' + (m.ok === false ? ' ko' : '') + '" style="display:block;font-size:15px;line-height:1.45">' + esc(m.text) + '</div>' : '') +
    '<div class="actions stack"><button class="btn" data-a="close">Fermer</button>' +
      (ghReady() ? '<button class="btn btn-danger" data-a="ghLock">Verrouiller cet appareil</button><button class="btn btn-primary" data-a="ghTest">Tester l\u2019accès</button>'
                 : '<button class="btn btn-primary" data-a="ghUnlock">Déverrouiller</button>') + '</div></div></div>';
}
function vGhRes() {
  var r = S.ghResult || {};
  return '<div class="overlay"><div class="modal" style="width:min(520px,96vw)"><h2 style="color:var(--red)">Envoi impossible</h2>' +
    '<div style="font-size:17px;line-height:1.5">' + esc(r.text || '') + '</div>' +
    '<div class="sub">Les ventes restent enregistrées sur la tablette. Vous pouvez réessayer plus tard ou utiliser l\u2019export en fichier.</div>' +
    '<div class="actions"><button class="btn btn-primary" data-a="close">OK</button></div></div></div>';
}

function vTicket() {
  var l = S.lastSale || {};
  return '<div class="overlay"><div class="modal" style="width:min(520px,96vw)"><h2>' + esc(l.titre || 'Vente enregistrée') + '</h2>' +
    (l.rendu != null ? '<div class="result"><b>À rendre</b><span>' + money(l.rendu) + '</span></div>' : '') +
    (l.recu ? '<div class="result"><b>À rendre</b><span>' + money(Math.max(0, l.recu - (salesOf(l.date).filter(function (v) { return v.id === l.id; })[0] || { total: 0 }).total)) + '</span></div>' : '') +
    (l.liv ? '<div class="sub" style="font-size:16px">' + TRUCK + ' Le ticket livraison (à joindre à la marchandise) s\u2019imprime.</div>' : '') +
    '<div style="font-size:19px;font-weight:700">Imprimer le ticket ' + (l.liv ? 'client' : '') + ' ?</div>' +
    '<div class="actions"><button class="btn" data-a="ticketNo" style="height:60px;min-width:120px">Non</button><button class="btn btn-primary" data-a="ticketYes" style="height:60px;min-width:160px">Imprimer</button></div></div></div>';
}
var DRAWER_MOTIFS = ['Faire de la monnaie', 'Comptage', 'Erreur de manipulation', 'Autre'];
function vDrawer() {
  var ok = S.drMotif && (S.drMotif !== 'Autre' || (S.drAutre || '').trim());
  return '<div class="overlay"><div class="modal" style="width:min(560px,96vw)"><h2>Ouvrir le tiroir sans vente</h2>' +
    '<div class="sub">Choisissez le motif. L\u2019ouverture est enregistrée avec l\u2019heure dans le fichier du jour.</div>' +
    '<div class="grid2">' + DRAWER_MOTIFS.map(function (m) { return '<button class="choice' + (S.drMotif === m ? ' on' : '') + '" data-a="drMotif" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') + '</div>' +
    (S.drMotif === 'Autre' ? '<label class="f">Précisez<input type="text" data-f="drAutre" value="' + esc(S.drAutre || '') + '" autocomplete="off"></label>' : '') +
    '<div class="actions stack"><button class="btn" data-a="close">Annuler</button><button class="btn btn-primary" data-a="drawerGo"' + (ok ? '' : ' disabled') + '>Ouvrir le tiroir</button></div></div></div>';
}
function vPrErr() {
  var e = S.prErr || {};
  return '<div class="overlay"><div class="modal" style="width:min(520px,96vw)"><h2 style="color:var(--red)">Ticket non imprimé</h2>' +
    '<div style="font-size:17px;line-height:1.5">' + esc(e.text || '') + '.' + esc(prHelp({ state: PR_ST.state })) + '</div>' +
    '<div class="sub">La vente est bien enregistrée. Vous pouvez réessayer, ou réimprimer plus tard depuis l\u2019Historique.</div>' +
    '<div class="actions stack"><button class="btn" data-a="close">Fermer</button><button class="btn btn-primary" data-a="prRetry">Réessayer</button></div></div></div>';
}
function tkPrevSale() {
  var list = salesOf(S.tkDay); if (!list.length) return sampleSale();
  return list.filter(function (v) { return v.id === S.tkId; })[0] || list[list.length - 1];
}
function vTkPrev() {
  var days = histDays(), list = salesOf(S.tkDay), v = tkPrevSale();
  var opts = { apercu: true, duplicata: S.tkDup, recu: !S.tkDup && v.paiement.mode === 'cash' ? exampleRecu(v.total) : 0 };
  var left = '<div style="display:flex;flex-direction:column;gap:10px;min-width:0">' +
    (days.length > 1 ? '<div class="hdays">' + days.map(function (d) { return '<button class="choice' + (d === S.tkDay ? ' on' : '') + '" data-a="tkDay" data-v="' + d + '">' + (d === today() ? 'Aujourd\u2019hui' : frDate(d).slice(0, 5)) + '</button>'; }).join('') + '</div>' : '') +
    '<div class="tklist">' + (list.length ? list.slice().reverse().map(function (s) {
      return '<button class="tkitem' + (s.id === v.id ? ' on' : '') + '" data-a="tkSel" data-v="' + esc(s.id) + '"><span><strong>' + s.horodatage.slice(11, 16) + '</strong> · ' + esc(s.lignes.map(function (l) { return l.quantite + ' × ' + l.libelle; }).join(', ')) + (s.annulation ? ' <em style="color:var(--red)">(annulée)</em>' : '') + '</span><strong style="white-space:nowrap">' + money(s.total) + '</strong></button>';
    }).join('') : '<div class="sub">Aucune vente ce jour-là : aperçu sur une vente d\u2019exemple.</div>') + '</div>' +
    '<div class="seg" style="align-self:flex-start"><button class="' + (S.tkDup ? '' : 'on') + '" data-a="tkDup" data-v="0">Ticket</button><button class="' + (S.tkDup ? 'on' : '') + '" data-a="tkDup" data-v="1">Duplicata</button></div>' +
    '<div class="sub">Aperçu provisoire : les mentions « [à compléter] » ne sont pas imprimées tant qu\u2019elles sont vides.' + (opts.recu ? ' Montant reçu d\u2019exemple : ' + money(opts.recu) + '.' : '') + '</div>' +
    '</div>';
  return '<div class="overlay"><div class="modal" style="width:min(980px,98vw);max-height:96%"><div class="row"><h2>Aperçu du ticket</h2><div style="display:flex;gap:8px">' +
    (prConfigured() && !v.exemple ? '<button class="btn" data-a="tkPrint"' + (S.prBusy ? ' disabled' : '') + '>Imprimer</button>' : '') + '<button class="btn" data-a="close">Fermer</button></div></div>' +
    '<div class="tkprev">' + left + '<div class="tkpaper">' + ticketHtml(ticketXml(v, opts)) + '</div></div></div></div>';
}
function vLiv() {
  var ctx = S.livCtx || '', after = ctx.indexOf('after:') === 0, edit = ctx.indexOf('edit:') === 0;
  var go = ctx === 'cart' ? (cartHasDelivery() ? 'Enregistrer' : 'Ajouter la livraison') : after ? 'Continuer vers l\u2019encaissement' : prConfigured() ? 'Imprimer le ticket livraison' : 'Enregistrer';
  return '<div class="overlay"><div class="modal" style="width:min(600px,96vw)"><h2>Livraison</h2>' +
    '<div class="sub">Coordonnées imprimées sur le ticket vendeur, à joindre à la marchandise.</div>' +
    '<label class="f">Nom<input type="text" data-f="fNom" value="' + esc(S.fNom || '') + '" autocomplete="off" autocapitalize="words"></label>' +
    '<label class="f">Adresse de livraison<input type="text" data-f="fAdr" value="' + esc(S.fAdr || '') + '" placeholder="Rue, numéro, code postal, localité" autocomplete="off"></label>' +
    '<label class="f">Téléphone<input type="tel" inputmode="tel" data-f="fTel" value="' + esc(S.fTel || '') + '" autocomplete="off"></label>' +
    (S.livMsg ? '<div class="result ko" style="display:block;font-size:16px">' + esc(S.livMsg) + '</div>' : '') +
    '<div class="actions"><button class="btn" data-a="close">Retour</button><button class="btn btn-primary" data-a="livSave">' + go + '</button></div></div></div>';
}
function vFac() {
  var cart = S.facCtx === 'cart', o = cart ? null : findSale((S.facCtx || '').split('|')[1]);
  return '<div class="overlay"><div class="modal" style="width:min(600px,96vw)" data-keep="fac"><h2>À facturer</h2>' +
    '<div class="sub">La facture sera établie plus tard avec ces données.' + (o ? ' Vente n° ' + esc(saleNum(o.v.id)) + ' de ' + o.v.horodatage.slice(11, 16) + '.' : '') + '</div>' +
    '<label class="f">Nom de la société<input type="text" data-f="fSoc" value="' + esc(S.fSoc || '') + '" autocomplete="off"></label>' +
    '<label class="f">Adresse de la société<input type="text" data-f="fFAdr" value="' + esc(S.fFAdr || '') + '" placeholder="Rue, numéro, code postal, localité" autocomplete="off"></label>' +
    '<label class="f">Numéro de TVA<input type="text" data-f="fTva" value="' + esc(S.fTva || '') + '" placeholder="BE 0123.456.789" autocomplete="off" autocapitalize="characters"></label>' +
    '<label class="f">Adresse e-mail<input type="email" inputmode="email" data-f="fMail" value="' + esc(S.fMail || '') + '" autocomplete="off" autocapitalize="none" spellcheck="false"></label>' +
    (cart ? '<div class="sub" style="font-weight:700">Le client paie-t-il maintenant ?</div><div class="grid2">' +
      '<button class="choice' + (S.fPaye === true ? ' on' : '') + '" data-a="facPaye" data-v="1">Payé maintenant</button>' +
      '<button class="choice' + (S.fPaye === false ? ' on' : '') + '" data-a="facPaye" data-v="0">Non payé (à facturer)</button></div>'
      : '<div class="sub">' + (o && unpaid(o.v) ? 'Vente non payée : bouton <strong>Encaisser</strong> dans l\u2019Historique si le client paie au stand.' : 'Vente déjà payée.') + '</div>') +
    (S.facMsg ? '<div class="result ko" style="display:block;font-size:16px">' + esc(S.facMsg) + '</div>' : '') +
    '<div class="actions">' + (cart && S.cartFac ? '<button class="btn btn-danger" data-a="facRemove">Retirer</button>' : '') + '<button class="btn" data-a="close">Retour</button><button class="btn btn-primary" data-a="facSave">Enregistrer</button></div></div></div>';
}
function vFree() {
  return '<div class="overlay"><div class="modal"><h2>Article libre</h2>' +
    '<label class="f">Libellé<input type="text" data-f="freeLabel" value="' + esc(S.freeLabel) + '" placeholder="ex. Article abîmé" autocomplete="off"></label>' +
    '<label class="f">Prix (€)<input type="text" inputmode="decimal" data-f="freePrice" value="' + esc(S.freePrice) + '" placeholder="0,00" autocomplete="off"></label>' +
    '<div class="actions"><button class="btn" data-a="close">Annuler</button><button class="btn btn-primary" data-a="addFree"' + (S.freeLabel.trim() && num(S.freePrice) > 0 ? '' : ' disabled') + '>Ajouter</button></div></div></div>';
}

function vCode() {
  var n = (S.codeVal || '').length, keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return '<div class="overlay"><div class="modal" style="width:min(400px,96vw)"><h2>Remise ticket</h2>' +
    '<div class="sub">Code de remise (4 chiffres)</div>' +
    '<div class="codedots">' + [0, 1, 2, 3].map(function (i) { return '<span class="' + (i < n ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
    (S.codeMsg ? '<div class="result ko" style="display:block;font-size:16px;text-align:center">' + esc(S.codeMsg) + '</div>' : '') +
    '<div class="codepad">' + keys.map(function (k) { return k === '' ? '<span></span>' : '<button class="btn" data-a="codeKey" data-v="' + k + '">' + (k === 'del' ? '\u232B' : k) + '</button>'; }).join('') + '</div>' +
    '<div class="actions"><button class="btn" data-a="close">Annuler</button></div></div></div>';
}
function vDisc() {
  var base, title, sub;
  if (S.discTarget === 'ticket') { base = up5(subtotal()); title = 'Remise sur le ticket'; sub = 'Sous-total : ' + money(base); }
  else { var l = S.cart[S.discTarget]; base = l.price * l.qty; title = 'Remise sur l’article'; sub = l.qty + ' × ' + esc(l.name) + ' · ' + money(base); }
  return '<div class="overlay"><div class="modal"><div><h2>' + title + '</h2><div class="sub">' + sub + '</div></div>' +
    '<div class="seg" style="align-self:flex-start"><button class="' + (S.discType === '%' ? 'on' : '') + '" data-a="discType" data-v="%">en %</button><button class="' + (S.discType === '€' ? 'on' : '') + '" data-a="discType" data-v="€">en €</button></div>' +
    '<label class="f">Valeur<input type="text" inputmode="decimal" data-f="discVal" value="' + esc(S.discVal) + '" placeholder="0" autocomplete="off"></label>' +
    '<div style="font-size:16px">Nouveau prix (arrondi aux 5 cts supérieurs) : <strong>' + money(applyDisc(base, { type: S.discType, val: num(S.discVal) })) + '</strong></div>' +
    '<div class="actions"><button class="btn btn-danger" data-a="removeDisc">Retirer la remise</button><div style="flex:1"></div><button class="btn" data-a="close">Annuler</button><button class="btn btn-primary" data-a="applyDisc">Appliquer</button></div></div></div>';
}

function vPay() {
  var t = payTotal(), rec = num(S.received), ch = rec - t, mixC = num(S.mix);
  var can = S.payMode === 'cash' ? rec >= t - 0.001 : S.payMode === 'mix' ? (mixC > 0 && mixC < t) : S.payMode === 'bc' || S.payMode === 'fac';
  var html = '<div class="overlay"><div class="modal paymodal" style="width:min(660px,96vw)"><div class="row"><h2>' + (S.cmdPay ? 'Commande n° ' + esc(cmdNum(S.cmdPay.numero)) + ' · reste à payer' : S.after && S.after.kind === 'pay' ? 'Paiement · vente à facturer n° ' + esc(saleNum(S.after.id)) : S.after ? 'Livraison · vente n° ' + esc(saleNum(S.after.id)) + ' (' + (S.after.date !== today() ? frDate(S.after.date).slice(0, 5) + ' ' : '') + S.after.heure + ')' : 'Encaissement') + '</h2><span style="font-size:40px;font-weight:800">' + money(t) + '</span></div>' +
    (S.payMode === 'fac' ? '<div class="modes"><button class="mode on" disabled style="grid-column:1/-1">À facturer · non payé</button></div>' : '<div class="modes"><button class="mode' + (S.payMode === 'cash' ? ' on' : '') + '" data-a="mode" data-v="cash">Cash</button><button class="mode' + (S.payMode === 'bc' ? ' on' : '') + '" data-a="mode" data-v="bc">Bancontact</button><button class="mode' + (S.payMode === 'mix' ? ' on' : '') + '" data-a="mode" data-v="mix">Mixte</button></div>');
  function cashBody() {
    return '<div class="sub" style="font-weight:700">Billets reçus</div><div class="bills">' +
      BILLS.map(function (b) { return '<button class="bill" data-a="bill" data-v="' + b + '">' + b + ' €</button>'; }).join('') +
      '<button class="bill exact" data-a="exact">Montant exact</button></div>' +
      '<div style="display:flex;gap:12px;align-items:flex-end"><label class="f" style="flex:1">Montant reçu (€)<input type="text" inputmode="decimal" data-f="received" value="' + esc(S.received) + '" placeholder="0,00" autocomplete="off"></label><button class="btn btn-danger" data-a="resetReceived">Effacer</button></div>' +
      '<div class="result' + (ch >= -0.001 ? '' : ' ko') + '"><b>' + (ch >= -0.001 ? 'À rendre' : 'Il manque') + '</b><span>' + money(Math.abs(ch)) + '</span></div>';
  }
  /* Taille fixe : la place du mode Cash (le plus haut) est toujours réservée par une copie invisible */
  var body;
  if (S.payMode === 'cash') {
    body = cashBody();
  } else if (S.payMode === 'fac') {
    body = '<div class="result" style="display:block;font-size:18px;line-height:1.5">Vente <strong>à facturer, non payée</strong> : rien à encaisser, le tiroir reste fermé. Facture au nom de <strong>' + esc(S.cartFac.societe) + '</strong>.<div class="sub" style="margin-top:6px">Pour encaisser quand même, touchez Retour puis À facturer et choisissez « Payé maintenant ».</div></div>';
  } else if (!S.payMode) {
    body = '<div class="result" style="display:block;font-size:19px;line-height:1.5;text-align:center"><strong>Choisissez le mode de paiement</strong>' +
      (prConfigured() ? '<div class="sub" style="margin-top:6px">Le tiroir-caisse s\u2019ouvre quand vous indiquez l\u2019argent reçu. Le mode peut être changé jusqu\u2019à la validation.</div>' : '') + '</div>';
  } else if (S.payMode === 'bc') {
    body = '<div class="result" style="display:block;font-size:18px;line-height:1.5">Encaissez <strong style="white-space:nowrap;font-size:1.25em">' + money(t) + '</strong> sur le terminal, puis validez.</div>';
  } else {
    body = '<div class="sub" style="font-weight:700">Billets reçus (part cash)</div><div class="bills five">' +
      BILLS.map(function (b) { return '<button class="bill" data-a="bill" data-v="' + b + '">' + b + ' €</button>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:12px;align-items:flex-end"><label class="f" style="flex:1">Part payée en cash (€)<input type="text" inputmode="decimal" data-f="mix" value="' + esc(S.mix) + '" placeholder="0,00" autocomplete="off"></label><button class="btn btn-danger" data-a="resetMix">Effacer</button></div>' +
      (mixC >= t - 0.001 && mixC > 0
        ? '<div class="result ko"><b>Le cash couvre tout</b><span style="font-size:18px">Choisissez « Cash »</span></div>'
        : '<div class="result"><b>Reste en Bancontact</b><span>' + money(Math.max(0, t - mixC)) + '</span></div>');
  }
  var ghost = S.payMode === 'cash' ? '' : '<div class="payghost" aria-hidden="true">' + cashBody().replace(/ data-(a|v|f)="[^"]*"/g, '') + '</div>';
  html += '<div class="paybody">' + ghost + '<div class="paycur' + (S.payMode === 'bc' || S.payMode === 'fac' || !S.payMode ? ' mid' : '') + '">' + body + '</div></div>';
  return html + '<div class="actions"><button class="btn" data-a="close" style="height:60px">Retour</button><button class="btn btn-primary" data-a="validate" style="height:60px;font-size:20px;padding:0 36px"' + (can ? '' : ' disabled') + '>Valider la vente</button></div></div></div>';
}

function vStorageBar() {
  if (S.usedPct < 80) return '';
  return '<button class="memwarn" data-a="showDays">⚠ Mémoire de l\u2019appareil pleine à ' + S.usedPct + ' % : touchez ici pour effacer les anciens jours exportés</button>';
}

function vStorage() {
  return '<div class="overlay"><div class="modal" style="width:min(600px,96vw)">' +
    '<h2 style="color:var(--red)">Mémoire pleine : enregistrement impossible</h2>' +
    (S.storageMsg ? '<div class="result ko" style="display:block;font-size:18px;font-weight:800">' + esc(S.storageMsg) + '</div>' : '') +
    '<div style="font-size:17px;line-height:1.5">L\u2019appareil n\u2019a plus de place pour enregistrer les ventes. Elles restent disponibles <strong>tant que l\u2019app reste ouverte</strong>.</div>' +
    '<div style="font-size:17px;line-height:1.5"><strong>1.</strong> Exportez tout de suite les ventes du jour.<br><strong>2.</strong> Effacez les anciens jours déjà exportés.</div>' +
    '<div class="actions stack"><button class="btn" data-a="close">Fermer</button><button class="btn" data-a="showDays">Effacer d\u2019anciens jours</button><button class="btn btn-primary" data-a="download">Exporter les ventes du jour</button></div>' +
    '</div></div>';
}

function vDays() {
  var dates = Object.keys(S.days).filter(function (d) { return S.days[d] && S.days[d].length; }).sort().reverse();
  var rows = dates.map(function (d) {
    var s = validSales(S.days[d]), nAnn = S.days[d].length - s.length, tot = s.reduce(function (a, v) { return a + v.total; }, 0);
    var isToday = d === today();
    return '<div class="row" style="gap:12px;padding:12px 4px;border-bottom:1px solid var(--soft)">' +
      '<div style="display:flex;flex-direction:column;gap:2px"><strong style="font-size:18px">' + frDate(d) + (isToday ? ' <span class="sub">(aujourd’hui)</span>' : '') + '</strong>' +
      '<span class="sub">' + s.length + ' vente' + (s.length > 1 ? 's' : '') + ' · ' + money(tot) + (nAnn ? ' · ' + nAnn + ' annulée' + (nAnn > 1 ? 's' : '') : '') + (GH.envois[d] ? ' · envoyé sur GitHub le ' + GH.envois[d].slice(8, 10) + '/' + GH.envois[d].slice(5, 7) + ' à ' + GH.envois[d].slice(11, 16) : '') + '</span></div>' +
      '<div class="dayact">' + (isToday ? '' : !S.exported[d] ? '<span class="sub">Pas encore exporté</span>'
        : S.confirmDel === d ? '<button class="btn btn-danger" data-a="delDay" data-v="' + d + '" style="border:1px solid var(--red)">Confirmer l\u2019effacement</button>'
        : '<button class="btn btn-danger" data-a="askDel" data-v="' + d + '">Effacer</button>') +
      (!ghConfigured() ? '' : '<button class="btn" data-a="' + (ghReady() ? 'ghSend' : 'ghAsk') + '" data-v="' + d + '" style="flex-shrink:0"' + (S.ghBusy ? ' disabled' : '') + ' title="' + (GH.envois[d] ? 'Envoyé le ' + GH.envois[d].slice(0, 16).replace('T', ' à ') : 'Pas encore envoyé') + '">' + (S.ghBusy === d ? 'Envoi…' : GH.envois[d] ? 'Renvoyer sur GitHub' : 'Envoyer sur GitHub') + '</button>') +
      '<button class="btn" data-a="download" data-v="' + d + '" style="flex-shrink:0">Télécharger</button></div></div>';
  }).join('');
  return '<div class="overlay"><div class="modal" style="width:min(640px,96vw);max-height:90%">' +
    '<div class="row"><h2>Ventes enregistrées</h2><button class="btn" data-a="close">Fermer</button></div>' +
    '<div class="memgauge"><div class="row"><span>Mémoire de l\u2019appareil</span><strong' + (S.usedPct >= 80 ? ' style="color:var(--red)"' : '') + '>' + storageMo(storageUsed()) + ' sur ' + storageMo(STORAGE_LIMIT) + ' (' + S.usedPct + ' %)</strong></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, S.usedPct) + '%;background:' + (S.usedPct >= 80 ? 'var(--red)' : 'var(--green)') + '"></i></div></div>' +
    '<div class="sub">Les ventes de chaque jour restent dans l\u2019appareil. Un jour ne peut être effacé qu\u2019après avoir été téléchargé. Le jour en cours ne peut pas être effacé.</div>' +
    '<div style="overflow-y:auto">' + (rows || '<div class="empty">Aucune vente enregistrée</div>') + '</div>' +
    '</div></div>';
}


/* ---------- Rendu ---------- */
var app = document.getElementById('app');
/* Boutons des fonctionnalités coupées : retirés après chaque affichage */
var FEAT_ACTIONS = {
  openFree: 'articleLibre', openFreeMenu: function () { return FEAT('articleLibre') && !!shortcutProduct(); },
  lineDisc: 'remiseLigne', ticketDisc: 'remiseTicket', askCancel: 'annulation', download: 'export',
  reprint: 'imprimante', tkPrev: 'imprimante', tkPrint: 'imprimante', ticketYes: 'imprimante', drawerAsk: 'tiroir', prDrawerTest: 'tiroir',
  cxOpen: 'fond', fondOpen: 'fond', cxMvOpen: 'mouvements', cptOpen: 'decompte',
  stkShow: 'stockTablette', stkOpen: 'stockTablette', rcOpen: 'reception', rcAsk: 'reception', ghSend: 'envoiAuto', facOpen: 'facture', discAsk: 'codePatron', toggleTheme: function () { return false; },
  mode: function (v) { return v === 'bc' ? FEAT('bancontact') : v === 'mix' ? FEAT('mixte') : true; }
};
function featPrune(root) {
  root.querySelectorAll('[data-a]').forEach(function (el) {
    var r = FEAT_ACTIONS[el.getAttribute('data-a')]; if (!r) return;
    if (!(typeof r === 'function' ? r(el.getAttribute('data-v')) : FEAT(r))) el.remove();
  });
  root.querySelectorAll('[data-feat]').forEach(function (el) { if (!FEAT(el.getAttribute('data-feat'))) el.remove(); });
}
/* Réglage changé dans l'Admin (autre onglet) : catalogue relu (points de vente, préfixes) et écran redessiné */
window.addEventListener('storage', function (e) {
  if (e.key !== FEAT_KEY && e.key !== null) return;
  try { var cc = normalizeCatalogue(JSON.parse(localStorage.getItem(CAT_KEY))); if (cc) { CATALOGUE = cc; if (S.placeId && !findPlace(S.placeId)) { S.placeId = null; persist(); } } } catch (er) {}
  render();
});
/* Réglage des fonctionnalités publié par l'Admin (config.json à côté de catalogue.json) : copie gardée sur la tablette */
function cfgApply() {
  try { applyTheme(themeGet().mode === 'sombre' ? 'dark' : 'light'); } catch (e) {}
  try { var cc = normalizeCatalogue(JSON.parse(localStorage.getItem(CAT_KEY))); if (cc) { CATALOGUE = cc; if (S.cat && !CATALOGUE.categories.some(function (k) { return k.id === S.cat; })) S.cat = CATALOGUE.categories.length ? CATALOGUE.categories[0].id : null; if (S.placeId && !findPlace(S.placeId)) { S.placeId = null; persist(); } } } catch (er) {}
  render();
}
function cfgCheck(manual) {
  if (navigator.onLine === false) return;
  themeCheck(function () { applyTheme(themeGet().mode === 'sombre' ? 'dark' : 'light'); tkPrepLogo(); photosCheck(render); render(); if (manual) toast('Apparence mise à jour'); });
  photosCheck(render);
  fetch('config.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (j) {
      var cur = featCfg();
      if (!j || j.format !== CONFIG_FMT) { if (!j && cur.version) { featSave({ f: {}, raccourciId: '' }); cfgApply(); } return; }
      if (+j.version === cur.version) return;
      featSave({ f: j.fonctionnalites || {}, raccourciId: j.raccourciId || '', remiseCodeSha: j.remiseCodeSha || '', version: +j.version, majLe: j.majLe });
      cfgApply(); toast('Réglages mis à jour (version ' + j.version + ')');
    }).catch(function () {});
}
setInterval(function () { if (document.visibilityState !== 'hidden') cfgCheck(false); }, 30000);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') cfgCheck(false); });
setTimeout(function () { cfgCheck(false); }, 400);
function render() {
  if (S.tab === 'cmd' && !FEAT('commandesCaisse')) S.tab = 'caisse';
  var act = document.activeElement, f = act && act.dataset ? act.dataset.f : null, pos = f ? act.selectionStart : null;
  var keep = {}; app.querySelectorAll('[data-keep]').forEach(function (el) { keep[el.dataset.keep] = el.scrollTop; });
  var html = S.screen === 'home' ? vHome() : S.screen === 'setup' ? vSetup() : vPos();
  if (S.modal === 'free') html += vFree();
  else if (S.modal === 'liv') html += vLiv();
  else if (S.modal === 'fac') html += vFac();
  else if (S.modal === 'disc') html += vDisc();
  else if (S.modal === 'code') html += vCode();
  else if (S.modal === 'pay') html += vPay();
  else if (S.modal === 'days') html += vDays();
  else if (S.modal === 'storage') html += vStorage();
  else if (S.modal === 'cancel') html += vCancel();
  else if (S.modal === 'ghcfg') html += vGhCfg();
  else if (S.modal === 'ghres') html += vGhRes();
  else if (S.modal === 'import') html += vImport();
  else if (S.modal === 'ticket') html += vTicket();
  else if (S.modal === 'tkprev') html += vTkPrev();
  else if (S.modal === 'drawer') html += vDrawer();
  else if (S.modal === 'prerr') html += vPrErr();
  else if (S.modal === 'reception') html += vReception();
  else if (S.modal === 'cx') html += vCaisseDuJour();
  else if (S.modal === 'fond') html += vFond();
  else if (S.modal === 'cxmv') html += vCxMv();
  else if (S.modal === 'comptage') html += vComptage();
  else if (S.modal === 'stock') html += vStock();
  if (S.toast) html += '<div class="toast">' + esc(S.toast) + '</div>';
  app.innerHTML = html;
  featPrune(app);
  app.querySelectorAll('[data-keep]').forEach(function (el) { if (keep[el.dataset.keep]) el.scrollTop = keep[el.dataset.keep]; });
  if (f) { var el = app.querySelector('[data-f="' + f + '"]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
}
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  var fn = A[el.dataset.a]; if (!fn) return;
  fn(el.dataset.v); render();
});
document.addEventListener('input', function (e) {
  var f = e.target.dataset && e.target.dataset.f;
  if (f && f.indexOf('cc:') === 0) { // comptage par coupure : mise à jour sans rendu complet
    var cv = e.target.value.replace(/\D/g, '').slice(0, 4), ck = f.slice(3); if (cv !== e.target.value) e.target.value = cv;
    S.cc[ck] = cv; var se = document.getElementById('ccs-' + ck.replace('.', '_')); if (se) se.textContent = cv ? money(Number(ck) * cv) : '';
    var amt = ccTotal(S.cc), te = document.getElementById('ccTot'); if (te) te.textContent = money(amt);
    var ee = document.getElementById('ccEc'); if (ee) { var ec = r2(amt - cxSummary(cxD()).attendu); ee.textContent = signed(ec); ee.className = Math.abs(ec) < 0.005 ? 'okc' : 'koc'; }
    return;
  }
  if (f && f.indexOf('rq:') === 0) { // quantité reçue : pas de rendu complet (garde le défilement et le clavier)
    var v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v !== e.target.value) e.target.value = v;
    S.rq[f.slice(3)] = v; var tt = document.getElementById('rcTot'); if (tt) tt.textContent = rcTotalText(rcLines()); return;
  }
  if (f) { S[f] = e.target.value; render(); }
});
document.addEventListener('keydown', function (e) { // Entrée = article suivant
  var f = e.target.dataset && e.target.dataset.f;
  if (e.key !== 'Enter' || !f || (f.indexOf('rq:') !== 0 && f.indexOf('cc:') !== 0)) return;
  e.preventDefault();
  var all = Array.prototype.slice.call(app.querySelectorAll('[data-f^="' + f.slice(0, 3) + '"]')), nx = all[all.indexOf(e.target) + 1];
  if (nx) { nx.focus(); try { nx.select(); } catch (er) {} } else e.target.blur();
});
// Catalogue publié par l'app Admin (catalogue.json à côté de index.html, hors paquet de l'app)
function installCat(raw, cat) {
  try { localStorage.setItem(CAT_KEY, JSON.stringify(raw)); } catch (e) {}
  CATALOGUE = cat; S.cat = cat.categories.length ? cat.categories[0].id : null;
  if (S.placeId && !findPlace(S.placeId)) { S.placeId = null; persist(); }
}
function loadSiteCatalogue(manual) {
  if (manual) cfgCheck(true);
  /* hors ligne, le service worker renverrait la copie en cache : on ne peut rien vérifier */
  if (manual && CATALOGUE && navigator.onLine === false) { toast('Pas de réseau : impossible de vérifier le catalogue'); render(); return; }
  S.catLoading = true; render();
  fetch('catalogue.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (raw) {
      S.catLoading = false;
      var cat;
      try { cat = normalizeCatalogue(raw); }
      catch (err) { S.importing = { error: err.message }; S.modal = 'import'; render(); return; }
      if (!CATALOGUE) { installCat(raw, cat); toast(catalogueLabel(cat) + ' installé'); }
      else if (cat.version !== CATALOGUE.version || cat.exemple !== CATALOGUE.exemple || JSON.stringify(raw) !== localStorage.getItem(CAT_KEY)) {
        /* le contenu compte aussi : un ordre ou un prix changé sans changer la version est détecté */
        S.siteUpdate = { raw: raw, cat: cat };
        if ((manual || S.screen !== 'pos') && !S.modal) { S.importing = S.siteUpdate; S.modal = 'import'; } // pendant le service : seulement sur demande
      } else { S.siteUpdate = null; if (manual) toast('Le catalogue est à jour (' + catalogueLabel(CATALOGUE) + ')'); }
      render();
    })
    .catch(function () {
      S.catLoading = false;
      if (manual) toast('Pas de réseau : impossible de vérifier le catalogue');
      render();
    });
}
render();
loadSiteCatalogue(false);
autoSchedule(5000);
if (prConfigured()) setTimeout(prCheck, 1500);
// Fichier de caisse partagé : reprise des anciennes saisies (une fois), puis envoi / lecture
cxMigrate(); render();
setTimeout(function () { cxSync().then(function () { cxRefresh(true); }); }, 3000);
// Stock du stand : calcul au démarrage, au retour du réseau et toutes les 15 minutes (lecture seule, sans message)
setTimeout(function () { stkcRefresh(false); }, 4000);
setTimeout(function () { cmdSync().then(function () { cmdRefresh(true); }); }, 5000);
window.addEventListener('online', function () { setTimeout(function () { stkcRefresh(false); }, 3000); });
setInterval(function () { stkcRefresh(false); }, 15 * 60000);
// Stockage protégé : Chrome n'efface pas ces données de lui-même
if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }
// Fonctionnement hors ligne
if ('serviceWorker' in navigator && location.protocol !== 'file:') { navigator.serviceWorker.register('sw.js').catch(function () {}); }
})();
