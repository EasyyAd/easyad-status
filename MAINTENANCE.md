# Fonctionnement et maintenance

Ce dépôt fait tourner la page [status.easyyad.com](https://status.easyyad.com) sans serveur :
GitHub Actions vérifie les services, GitHub Pages publie la page. Ce document décrit comment
l'équipe annonce un incident, et comment réutiliser ce modèle pour vos propres services.

## Annoncer un incident

Les incidents vivent dans `incidents.json`. Une modification sur `main` republie la page en une
minute environ.

```json
[
  {
    "id": "2026-11-20-paiements",
    "title": { "fr": "Retraits Mobile Money retardés", "en": "Mobile Money withdrawals delayed" },
    "components": ["delivery"],
    "started_at": "2026-11-20T09:10:00Z",
    "resolved_at": null,
    "updates": [
      { "at": "2026-11-20T09:15:00Z", "status": "investigating",
        "message": { "fr": "L'opérateur répond lentement. Vos fonds sont en sécurité.", "en": "The operator is responding slowly. Your funds are safe." } }
    ]
  }
]
```

- `components` : identifiants des services de `config.json` (`site`, `app`, `partners`, `api`, `delivery`, `bot`).
- `status` d'une mise à jour : `investigating`, `identified`, `monitoring` ou `resolved`.
- Pour clore un incident : une mise à jour `resolved`, et la date dans `resolved_at`. Il reste affiché
  30 jours, puis disparaît de la page.
- Les heures sont en UTC (`AAAA-MM-JJTHH:MM:SSZ`). Un texte peut être une simple chaîne s'il est le
  même dans les deux langues.

## Comment les mesures sont prises

- Le workflow `check.yml` tourne toutes les 5 minutes. Il appelle chaque service décrit dans
  `config.json` (avec `url`, et le texte attendu dans la réponse avec `expect`), puis lit la route
  publique `/api/v1/status` de l'API pour les composants internes (`from_api`).
- Un échec est revérifié 5 secondes plus tard avant d'être compté. Une réponse de plus de 5 secondes
  compte comme « perturbé ».
- Les mesures sont publiées dans la branche `data` (`status.json`), réécrite à chaque passage :
  l'historique du dépôt ne grossit pas. La page garde 90 jours d'historique, jour par jour.
- Le workflow `pages.yml` publie la page à chaque changement de `site/`, de `config.json` ou de
  `incidents.json`.

Bon à savoir : GitHub lance les tâches planifiées « au mieux » (comptez 5 à 15 minutes entre deux
passages aux heures chargées), et la page lit les mesures sur `raw.githubusercontent.com`, mis en
cache quelques minutes.

## Réutiliser ce modèle

1. Créez un dépôt public à partir de celui-ci et adaptez `config.json` (nom, services, adresses).
2. *Settings → Pages → Source : GitHub Actions*.
3. Dans l'onglet *Actions*, lancez « Vérification » (qui crée la branche `data`), puis « Publication
   de la page ».
4. Domaine personnalisé : remplacez le contenu de `CNAME`, ajoutez chez votre fournisseur DNS un
   enregistrement `CNAME` vers `<compte>.github.io`, puis saisissez le domaine dans *Settings → Pages*
   et cochez *Enforce HTTPS*.
5. Alertes Telegram (facultatif) : secrets `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans
   *Settings → Secrets and variables → Actions*. Un message part à chaque changement d'état.

GitHub met en pause les tâches planifiées d'un dépôt public sans activité pendant 60 jours. Si
l'onglet *Actions* affiche « This scheduled workflow is disabled », cliquez sur *Enable workflow*.

## Tests

```bash
node --test
```
