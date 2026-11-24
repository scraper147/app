# Caisse

Caisse tactile hors ligne (PWA) avec son application d’administration. **Un seul code, un dossier par ami** : chaque utilisateur a son adresse, son apparence, ses fonctionnalités et ses données. Une mise à jour du code commun profite à tout le monde, sans rien déployer chez eux.

Dépôt : `scraper147/caisse` → https://scraper147.github.io/caisse/

## Organisation

```
index.html            page du produit
app/                  CODE COMMUN (le même pour tous)
  caisse.js / .css    app de vente
  admin.js / .css     administration
  soiree.js / .css    caisse de soirée (option « Soirée à tickets »)
  icons/              icônes des trois apps
  version.json
demo/                 UN DOSSIER PAR AMI (ici : la démonstration)
  client.js           seul fichier propre à l’ami : identifiant, type de données
  index.html          page d’accueil de l’ami (liens vers ses apps)
  caisse/ admin/ soiree/   index.html (charge app/…), manifest, sw.js
```

- **Le code** est dans `app/`. Les pages des dossiers d’amis ne font que le charger (`../../app/caisse.js?v=<version>`).
- **L’apparence** (nom du commerce, couleurs, logo, coordonnées du ticket) n’est pas dans le code : l’ami la règle dans **Admin › Paramètres › Apparence**. Elle est publiée dans `theme.json`, à côté de `catalogue.json` et `config.json`, et lue par la Caisse et la Caisse Soirée (au démarrage, toutes les 30 s, au retour sur l’app, ⋮ › Vérifier le catalogue). L’Admin, la Caisse et la Caisse Soirée d’un même ami ont donc le même design.
- **Les fonctionnalités** : Admin › Paramètres › Fonctionnalités → `config.json`.
- **La mémoire du navigateur** est préfixée par ami (`caisse:<id>:…`) : deux amis ne mélangent jamais leurs données, même sur le même appareil.
- **Hors ligne** : un service worker par ami et par app (cache `caisse-<id>-<app>-v<version>`).

## Publier une mise à jour (pour tous les amis)

1. Modifier le code, monter `VERSION` dans `build.py`, relancer la construction.
2. Déposer le contenu du dossier dans le dépôt `scraper147/caisse` (tout le dossier, une seule fois).
3. Chaque tablette prend la nouvelle version à son prochain chargement (nouveau numéro de cache et `?v=` des fichiers).

Règles : une nouvelle version lit toujours les anciens fichiers ; une nouvelle fonctionnalité arrive coupée dans `config.json`.

## Ajouter un ami

Ajouter une ligne dans `CLIENTS` de `build.py` (`{'id': 'jardin', 'nom': 'Jardin', 'donnees': 'local'}`), reconstruire, déposer. Son adresse : `https://scraper147.github.io/caisse/jardin/`. Il règle ensuite lui-même apparence, fonctionnalités et catalogue dans son Admin.

## Données (étape actuelle)

`donnees: 'local'` : tout est rangé dans le navigateur (démonstration, un seul appareil). Le mode « dépôt GitHub privé par ami » (plusieurs tablettes, envois réels, clé chiffrée par ami) est la prochaine étape.

- Admin › Paramètres › **Charger un exemple** (garde apparence et fonctionnalités) / **Tout effacer**.
- Code patron de la remise ticket (option) dans la démo : 1234.
