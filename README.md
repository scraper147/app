# Caisse Démo

Version de démonstration, sans marque, de la caisse tactile et de son app d’administration.

- `index.html` : page d’accueil (liens vers les deux apps)
- `caisse/` : app de vente (hors ligne, PWA)
- `soiree/` : Caisse Soirée (option « Soirée à tickets » : entrées, cartes à cases, boissons, préventes)
- `admin/` : Accueil · Gestion d’événement (Catalogue, Stock, Comptage du stock, Caisse, Bilan, Historique de vente) · Soirée à tickets · Paramètres

## Fonctionnement

Aucun compte ni serveur : les deux apps partagent un « serveur » local rangé dans la mémoire du navigateur
(`localStorage`, clés commençant par `demo-`). Il faut donc les ouvrir **sur le même appareil et le même site**
(ex. `https://<compte>.github.io/caisse-demo/admin/` et `…/caisse-demo/caisse/`).

- Admin › Paramètres › **Charger un exemple** : catalogue, stock, ventes et caisse fictifs. **Tout effacer** : remet à zéro.
- Le catalogue publié dans l’Admin arrive dans la Caisse (menu ⋮ › Vérifier le catalogue, ou au démarrage).
- Les ventes de la Caisse arrivent dans le Bilan, le Stock et l’Historique de l’Admin.

## Fonctionnalités

Admin › Paramètres › Fonctionnalités : 25 interrupteurs en 9 groupes (Vente, Paiement, Historique, Imprimante et tiroir, Caisse du jour, Stock, Catalogue, Suivi des ventes, Modules en option). Réglage enregistré sous `demo-config`, appliqué tout de suite dans l’Admin et dans les caisses ouvertes sur le même appareil.

## Mise en ligne

Déposer tout le dossier dans un dépôt GitHub Pages (ou n’importe quel hébergement statique).
