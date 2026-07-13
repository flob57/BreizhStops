# BreizhStops V2 stable

Cette version ne contient volontairement **aucun service worker** afin d’éviter
les anciens problèmes de cache.

## Fichiers à déployer

- `index.html`
- `style.css`
- `app.js`
- `data/stops.json`

## Données

Nombre d’arrêts inclus : 13230

Sources fusionnées :
- GTFS Bretagne
- Base QUB
- points inRoute de confiance

## Déploiement GitHub

1. Supprimer ou ignorer les anciens fichiers PWA :
   - `service-worker.js`
   - `manifest.webmanifest`
2. Remplacer les quatre fichiers listés ci-dessus.
3. Faire un commit.
4. Attendre Cloudflare Pages.
5. Recharger avec Ctrl + F5.
