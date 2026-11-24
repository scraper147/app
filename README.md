# Caisse

Caisse tactile hors ligne (PWA) avec son application d’administration. **Un seul code, un dossier par ami** : chaque utilisateur a son adresse, son apparence, ses fonctionnalités et ses données. Une mise à jour du code commun profite à tout le monde, sans rien déployer chez eux.

Dépôt : `scraper147/app` → https://scraper147.github.io/app/

## Organisation

```
index.html            page du produit
cle.html              « Préparer la clé d’accès » (pour un ami en mode GitHub)
superadmin/           écran SuperAdmin (gestion des dossiers d’amis)
core/                 CODE COMMUN (le même pour tous)
  caisse.js/.css  admin.js/.css  soiree.js/.css
  sw.js               service worker commun (importé par chaque dossier)
  templates.js        modèles des fichiers d’un dossier d’ami
  icons/  version.json
<ami>/                UN DOSSIER PAR AMI (créé par le SuperAdmin ; demo/ fourni)
  client.js           seul fichier propre à l’ami : { id, nom, donnees, canal, creeLe, cle? }
  index.html          accueil de l’ami
  caisse/ admin/ soiree/   index.html (charge ../../core/…), manifest, sw.js (importScripts ../../core/sw.js)
```

Les dossiers d’amis **ne dépendent pas de la version** : une mise à jour ne remplace que `core/` et les pages communes.

## Publier une mise à jour

1. Monter `VERSION` dans `build.py`, reconstruire.
2. Déposer dans le dépôt `core/`, `index.html`, `cle.html`, `superadmin/` (et `demo/` si besoin). **Ne pas supprimer** les dossiers d’amis créés par le SuperAdmin.
3. Chaque tablette prend la nouvelle version à son prochain chargement (le service worker commun change).
4. Si les modèles des dossiers ont changé : SuperAdmin › **Remettre les dossiers à jour**.

## SuperAdmin (`/app/superadmin/`)

- Première utilisation sur un appareil : jeton GitHub fine-grained de Loïc, **Contents : Read and write sur `scraper147/app` seulement**, chiffré sur l’appareil avec une phrase de passe ; déverrouillé pour la session.
- Liste des amis (dossiers contenant `client.js`), liens Accueil / Admin / Caisse, **+ Nouvel ami** (identifiant, nom, mode, clé), **Modifier**, **Supprimer** (le dépôt de données de l’ami n’est pas touché), **Remettre les dossiers à jour** (n’écrit que les fichiers qui changent).
- Le SuperAdmin n’a jamais accès aux données des amis.

## Modes de données (`client.js` › `donnees`)

- `local` : démonstration, tout dans le navigateur (un seul appareil). Admin › Paramètres › Sécurité › Charger un exemple / Tout effacer.
- `github` : dépôt **privé** de l’ami. Dossiers dans son dépôt : `caisse/` (catalogue.json, config.json, theme.json), `soiree/` (catalogue de la soirée), `ventes/` (ventes, stock, caisse, commandes, factures, livraisons, préventes), `admin/` (comptage du stock d’événement).
  - L’ami crée le dépôt privé et un jeton fine-grained (ce dépôt seul, Contents : Read and write), puis ouvre **`/app/cle.html`** : test de l’accès, phrase de passe, clé chiffrée (le jeton ET le nom du dépôt sont chiffrés). Il envoie le texte ; le SuperAdmin le colle dans « Clé chiffrée de l’ami ».
  - Chaque appareil demande la phrase de passe une fois (écran de déverrouillage commun aux trois apps). Admin › Paramètres › Sécurité : dépôt, **Verrouiller cet appareil**, Préparer une nouvelle clé.

## Admin › Paramètres

Apparence (theme.json) · Fonctionnalités (config.json) · Sécurité (accès, clé, données de démonstration).

Remise ticket sécurisée (option) : code 1234 par défaut, à changer dans Admin › Paramètres › Sécurité (empreinte publiée dans config.json).
