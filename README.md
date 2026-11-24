# Caisse Démo

Version de démonstration, sans marque, de la caisse tactile et de son app d’administration.

- `index.html` : page d’accueil (liens vers les deux apps)
- `caisse/` : app de vente (hors ligne, PWA)
- `admin/` : Accueil · Gestion d’événement (Catalogue, Stock, Caisse, Bilan, Historique de vente) · Paramètres

## Fonctionnement

Aucun compte ni serveur : les deux apps partagent un « serveur » local rangé dans la mémoire du navigateur
(`localStorage`, clés commençant par `demo-`). Il faut donc les ouvrir **sur le même appareil et le même site**
(ex. `https://<compte>.github.io/caisse-demo/admin/` et `…/caisse-demo/caisse/`).

- Admin › Paramètres › **Charger un exemple** : catalogue, stock, ventes et caisse fictifs. **Tout effacer** : remet à zéro.
- Le catalogue publié dans l’Admin arrive dans la Caisse (menu ⋮ › Vérifier le catalogue, ou au démarrage).
- Les ventes de la Caisse arrivent dans le Bilan, le Stock et l’Historique de l’Admin.

## Mise en ligne

Déposer tout le dossier dans un dépôt GitHub Pages (ou n’importe quel hébergement statique).
