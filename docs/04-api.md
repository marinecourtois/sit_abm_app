# 04 — Référence de l'API

Base : `http://localhost:8765/api`. Toutes les réponses sont en JSON (sauf les exports).
Les erreurs de validation renvoient `422` avec `{"detail": {"errors": [...]}}` ; les
conflits d'état renvoient `409` avec un message en français.

Une documentation interactive (Swagger) est disponible sur `http://localhost:8765/api/docs`
**uniquement** lorsque la variable `TIS_API_DOCS=1` est définie (c'est le cas avec `make dev`).
En production (`make serve`), elle est désactivée : aucune documentation n'est exposée sur le site.

## Contrat de configuration (`ExperimentConfig`)

```jsonc
{
  "crops": ["strawberry", "cherry"],          // au moins une culture
  "strategies": [                             // au moins une stratégie
    { "key": "every_3" },
    { "key": "periodic", "interval": 5, "first_day": 2 },
    { "key": "front_loaded", "initial_fraction": 0.5, "maintenance_interval": 5 }
  ],
  "invasion": { "preset": "moyenne", "wild": 300, "females": 300 },
  "budget": 9000,                             // mâles stériles lâchés par saison (aucune unité monétaire)
  "remating": "preference",                   // preference | first | last | mixed
  "replicates": 3,                            // 1 à 30
  "seed": 42,                                 // graine de base ; répétition r → seed + 1000·r
  "include_control": true,                    // ajoute le témoin sans TIS (même graines)
  "biology": { "eta": 0.8, "lifespan_sterile": 7.0, "...": "..." }   // TOUTES les clés de /api/meta
}
```

Clés de stratégie : `no_tis`, `daily`, `every_3`, `every_7`, `front_70`, `front_100`
(stratégies du notebook) et `periodic`, `front_loaded` (calendriers personnalisés).

## Méta-données

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État du serveur et versions (moteur, paramètres, schéma, modelly, Python) |
| GET | `/meta` | Registre complet : cultures, stratégies, régimes, préréglages d'invasion et de budget, paramètres biologiques (symbole, unité, défaut, plage, source), constantes fixes, limites, nombre de processus |
| POST | `/validate` | Corps : `ExperimentConfig`. Renvoie `{ok, errors, warnings, scenarios[], estimate}` ; `scenarios` contient le calendrier calculé de chaque culture × stratégie |

## Expériences

| Méthode | Route | Description |
|---|---|---|
| GET | `/experiments?q=&project=&status=` | Liste (plus récente d'abord), filtres facultatifs |
| POST | `/experiments` | Corps : `{name, project?, description?, config, parent_id?, tags?, run?=true}`. Crée et lance par défaut |
| GET | `/experiments/{id}` | Détail (accepte l'UUID ou l'identifiant court `TIS-XXXXXXXX`) |
| PATCH | `/experiments/{id}` | Modifie uniquement `name`, `description`, `tags`, `project` |
| DELETE | `/experiments/{id}` | Supprime l'expérience et ses résultats (`409` si en cours) |
| POST | `/experiments/{id}/run` | `ready` → lance ; `cancelled`/`error` → crée une **nouvelle** exécution (parent = l'ancienne) ; `completed` → `409` |
| POST | `/experiments/{id}/cancel` | Demande l'annulation (`409` si rien n'est en cours) |
| POST | `/experiments/{id}/duplicate` | Corps facultatif : `{name?, project?, config?: {…surcharges}, run?=false}`. Nouvelle expérience avec `parent_id` |
| GET | `/experiments/{id}/live` | État en mémoire : `{status, progress, done, total, live: {scénario: {day, rows[]}}, log[], plan[]}` |
| GET | `/experiments/{id}/results` | Résultats complets (`404` si absents) |

Statuts : `ready`, `queued`, `running`, `completed`, `cancelled`, `error`.

### Structure des résultats

```jsonc
{
  "experiment_id": "…", "schema_version": 1, "computed_at": "…", "duration_s": 7.1,
  "series_vars": ["Time", "Wild_males", …, "Wild_adults_vs_control"],
  "scenarios": [{
    "key": "strawberry::every_3", "crop": "strawberry",
    "strategy": {"key": "every_3"}, "strategy_key": "every_3", "strategy_label": "J+3",
    "is_control": false, "budget": 9000,
    "schedule": {"0": 265, "3": 265, …},
    "seeds": [42, 1042, 2042],
    "metrics": { "larval_damage_pct": {"mean", "sd", "min", "max", "n", "values": [...]}, … },
    "series":  { "Time": [0, 1, …], "Wild_males": {"mean": [...], "sd": [...]}, … },
    "events":  [{"type": "release" | "harvest_start" | "harvest_end" | "peak" | "larvae_peak" | "threshold" | "threshold_down", "day", "label"}],
    "vs_control": { "larval_damage_pct": {"mean", "sd", "n", "values"}, "larvae_produced": …, "rotten_pct": …,
                    "wild_adults_final": …, "harvested_clean_pct": … }   // variations relatives appariées, en %
  }]
}
```

## Exports

`GET /experiments/{id}/export?format=…` (téléchargement) :

| `format` | Contenu |
|---|---|
| `json` | Métadonnées + configuration + versions + résultats complets |
| `csv-metrics` | Une ligne par scénario × répétition, toutes les métriques |
| `csv-series` | Une ligne par scénario × jour, moyenne et écart-type de chaque série |
| `protocol` | Protocole réimportable (`format: "modelly-tis-protocol"`), sans résultats |

`POST /protocol/import` (corps : le JSON du protocole) crée une expérience `ready`.

## Données de référence et vue d'ensemble

| Méthode | Route | Description |
|---|---|---|
| GET | `/reference/factorial` | Plan factoriel du notebook (576 lignes), avec source, sha256 et mention de vérification |
| GET | `/reference/dynamics` | Dynamiques journalières du notebook |
| GET | `/overview` | Dernière étude de référence terminée et ses résultats (ou l'étude en cours) |

## Exemples

```bash
# Valider une configuration
curl -s -X POST localhost:8765/api/validate -H 'Content-Type: application/json' -d @config.json

# Lancer puis suivre
ID=$(curl -s -X POST localhost:8765/api/experiments -H 'Content-Type: application/json' \
      -d '{"name":"Essai","config":'"$(cat config.json)"'}' | jq -r .id)
curl -s localhost:8765/api/experiments/$ID/live | jq '.status, .progress'

# Récupérer les métriques en CSV
curl -s "localhost:8765/api/experiments/$ID/export?format=csv-metrics" -o metriques.csv
```

## Ajouter une route

Les routes sont dans `backend/app/main.py`. Conventions :

- préfixe `/api/` ;
- chercher l'expérience avec `_get(eid)` (gère `404` et l'identifiant court) ;
- ne jamais modifier une expérience `completed` (utiliser `store.update`, qui refuse) ;
- messages d'erreur en français ;
- ajouter le type correspondant dans `frontend/src/lib/api.ts` et un test dans
  `backend/tests/test_api.py`.
