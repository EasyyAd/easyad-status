# Statut des services EasyAd

La page **[status.easyyad.com](https://status.easyyad.com)** indique en temps réel si les services
[EasyAd](https://easyyad.com) fonctionnent : site, application, programme partenaires, API, diffusion
des annonces et paiements, bot Telegram. Elle donne aussi la disponibilité des 90 derniers jours et
le suivi des incidents.

> **English** — [status.easyyad.com](https://status.easyyad.com) shows in real time whether
> [EasyAd](https://easyyad.com) services are up, with 90-day uptime and incident updates.

## Comment c'est mesuré

- Toutes les 5 minutes, une tâche GitHub Actions appelle chaque service **depuis l'extérieur** de nos
  serveurs. La page reste donc en ligne même quand nos serveurs ne répondent plus.
- On ne se contente pas de vérifier que le serveur répond : la base de données, les tâches automatiques
  (diffusion des annonces, règlements, paiements) et le bot Telegram sont contrôlés aussi.
- Un échec est revérifié quelques secondes plus tard avant d'être compté : un hoquet du réseau n'est
  pas une panne.
- Un service qui répond en plus de 5 secondes est indiqué comme perturbé.

Les mesures brutes sont publiques, dans la branche [`data`](../../tree/data) de ce dépôt.

## Un problème ?

Si un service ne fonctionne pas alors que cette page dit le contraire, écrivez-nous à
**support@easyyad.com**.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `config.json` | Les services surveillés et leurs adresses |
| `check.mjs`, `lib.mjs` | Un passage de vérification (Node.js 20, sans dépendance) |
| `site/index.html` | La page publique |
| `incidents.json` | Les incidents annoncés par l'équipe |

Licence MIT. Pour les mainteneurs : voir [MAINTENANCE.md](MAINTENANCE.md).
