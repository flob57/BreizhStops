# BreizhStops

BreizhStops est une application web de recherche d'arrêts de transport en Bretagne.

## Fonctions incluses

- recherche par arrêt, commune ou réseau ;
- filtres réseau et commune liés ;
- carte Leaflet ;
- création d'itinéraires ;
- optimisation des étapes ;
- Google Maps ;
- inRoute ;
- export GPX ;
- installation comme PWA.

## Mise en ligne sur GitHub et Cloudflare Pages

1. Décompresser l'archive.
2. Copier tous les fichiers dans le dépôt GitHub BreizhStops.
3. Remplacer les anciens fichiers quand GitHub le demande.
4. Faire un commit.
5. Attendre le redéploiement Cloudflare Pages.
6. Recharger le site avec Ctrl + F5.

## Vérification

Le bandeau supérieur doit afficher le nombre d'arrêts chargés.

## Mise à jour des données

Pour mettre à jour les arrêts, remplacer uniquement :

`data/stops.json`

Puis faire un nouveau commit. Cloudflare republiera automatiquement le site.
