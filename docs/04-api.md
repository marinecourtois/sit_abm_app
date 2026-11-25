# 04 — Référence de l'API

Base : `http://localhost:8765/api`. Toutes les réponses sont en JSON (sauf les exports).

**Transport (1.6.0).** Les réponses JSON de plus de 1 ko sont compressées (gzip) si le client
envoie `Accept-Encoding: gzip`. Les routes de l'API renvoient `Cache-Control: no-store`, sauf
`/experiments/{id}/results` (`private, max-age=31536000, immutable` : une expérience terminée ne
change plus). Les fichiers `/assets/*` du build sont servis avec `public, max-age=31536000,
immutable` (noms hachés par contenu).
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
  "replicates": 10,                           // 10 (minimum de l'étude) à 50
  "seed": 42,                                 // graine de base ; répétition r → seed + 1000·r
  "include_control": true,                    // ajoute le témoin sans TIS (même graines)
  "biology": { "eta": 0.8, "lifespan_sterile": 7.0, "...": "..." },  // TOUTES les clés de /api/meta

  // Plan (1.7.0, facultatif) : listes croisées dans la même expérience. Absentes ou null :
  // la valeur unique ci-dessus. Une liste remplace la valeur unique correspondante.
  "budgets": [4500, 9000, 18000],
  "invasions": [{ "preset": "faible", "wild": 90, "females": 90 }, { "preset": "forte", "wild": 900, "females": 900 }],
  "rematings": ["preference", "first"]
}
```

**Plan d'expérience.** Les scénarios sont culture × invasion × régime × (témoin + stratégie ×
budget) : le témoin (budget 0) est calculé une fois par culture, invasion et régime, et sert de
référence appariée à tous les budgets de sa cellule. Toutes les cellules utilisent les mêmes
graines (`seed + 1000·r`). Validation : valeurs en double refusées, au plus `MAX_SEASONS`
(10 000) saisons par expérience (`backend/app/schemas.py`). Une configuration sans champ de plan
garde l'empreinte (`config_hash`) et les clés de scénario d'avant la 1.7.0.

Clés de stratégie : `no_tis`, `daily`, `every_3`, `every_7`, `front_70`, `front_100`
(stratégies du notebook) et `periodic`, `front_loaded` (calendriers personnalisés).

## Méta-données

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État du serveur et versions : `app_version` (application), moteur, paramètres, schéma, modelly, Python |
| GET | `/queue` | Exécutions en file ou en cours : `{workers, active: [{id, short_id, name, status, progress, done, total, elapsed_s, eta_s}]}` |
| GET | `/meta` | Registre complet : cultures, stratégies (avec leurs paramètres), régimes de réaccouplement (libellé, formule LaTeX, description), préréglages d'invasion et de budget, paramètres biologiques (libellé, groupe, symbole, unité, défaut, plage, source), groupes, constantes fixes du modèle, limites (répétitions 10 – 50), répétitions proposées par défaut (`default_replicates`, 20), résumé du plan factoriel servi, versions |
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
| GET | `/experiments/{id}/live?since=` | État en mémoire, voir ci-dessous |
| GET | `/experiments/{id}/results` | Résultats complets (`404` si absents). Envoyés tels que stockés (gzip) ; décompressés côté serveur seulement si le client n'accepte pas gzip |

Statuts : `ready`, `queued`, `running`, `completed`, `cancelled`, `error`.

### Flux en direct (`/live`)

```jsonc
{
  "status": "running", "progress": 0.42, "done": 50, "total": 120,
  "seq": 1834,                       // curseur : à renvoyer dans ?since= au prochain appel
  "elapsed_s": 5.2, "eta_s": 7.1,    // eta = écoulé / done × (total − done) ; null avant la 1re saison et après la fin
  "live": { "strawberry::daily": { "day": 63, "from": 58, "rows": [ {"Wild_males": …, …}, … ] } },
  "log": [{"t": "…", "msg": "…"}], "plan": [{"key", "crop", "strategy_label", "is_control", "budget", "invasion", "remating"}]
}
```

- Sans `since` (ou `since=0`) : toutes les lignes reçues, `from = 0`.
- Avec `since=<seq>` : seules les lignes dont le numéro dépasse `seq`. `from` est l'index de la
  première ligne renvoyée : le client remplace ses lignes à partir de `from` (fusion idempotente,
  voir `mergeLive` dans `frontend/src/lib/api.ts`). `len(lignes) == day` après fusion.
- Une ligne = état de la **répétition 0** à la fin d'un jour (valeurs brutes, pas de moyenne).
- À la fin du calcul, `live` est vidé : les séries complètes sont dans `/results`.

### Structure des résultats

```jsonc
{
  "experiment_id": "…", "schema_version": 1, "computed_at": "…", "duration_s": 7.1,
  "series_vars": ["Time", "Wild_males", …, "Wild_adults_vs_control"],
  "scenarios": [{
    "key": "strawberry::every_3", "crop": "strawberry",   // plan : "strawberry::inv=90:90::rem=first::b=4500::every_3"
    "strategy": {"key": "every_3"}, "strategy_key": "every_3", "strategy_id": "every_3", "strategy_label": "J+3",
    "is_control": false, "budget": 9000,
    "invasion": {"preset": "moyenne", "wild": 300, "females": 300}, "remating": "preference",   // depuis 1.7.0
    "schedule": {"0": 265, "3": 265, …},
    "seeds": [42, 1042, 2042],
    "metrics": { "larval_damage_pct": {"mean", "sd", "min", "max", "n", "values": [...]}, … },
    "series":  { "Time": [0, 1, …], "Wild_males": {"mean": [...], "sd": [...]}, … },
    "events":  [{"type": "release" | "harvest_start" | "harvest_end" | "peak" | "larvae_peak" | "threshold" | "threshold_down", "day", "label"}],
    "vs_control": { "larval_damage_pct": {"mean", "sd", "n", "values"}, "larvae_produced": …, "rotten_pct": …,
                    "wild_adults_final": …, "harvested_clean_pct": … }   // variations relatives appariées, en %, vs le témoin de la même culture, invasion et régime
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
| `archive` | ZIP `<ID>-archive.zip` : `LISEZMOI.txt` (versions, graines, hash de configuration, SHA-256 de chaque fichier), `protocole.json`, `resultats.json`, `metriques_par_repetition.csv`, `series_journalieres.csv` (mêmes contenus que les formats ci-dessus). Voir docs/07 |

`POST /protocol/import` (corps : le JSON du protocole) crée une expérience `ready`.

## Données de référence et vue d'ensemble

| Méthode | Route | Description |
|---|---|---|
| GET | `/reference/factorial` | Plan factoriel : recalcul de l'application à ≥ 10 répétitions (`data/factorial/`, avec provenance) s'il existe, sinon le CSV du notebook (3 répétitions). Champ `origin` : `application` ou `notebook` |
| GET | `/reference/dynamics` | Dynamiques journalières du notebook |
| GET | `/overview` | Dernière étude de référence terminée et ses résultats (ou l'étude en cours) |

Les données de référence sont lues, sérialisées et compressées **une fois** par version du
fichier (clé : chemin + date de modification), puis servies depuis la mémoire ; relancer
`make factorial` est donc pris en compte sans redémarrer. Même principe pour `/overview` (clé :
identifiant, nom, description, projet et étiquettes de l'étude).

## Exemples

```bash
# Valider une configuration
curl -s -X POST localhost:8765/api/validate -H 'Content-Type: application/json' -d @config.json

# Lancer puis suivre
ID=$(curl -s -X POST localhost:8765/api/experiments -H 'Content-Type: application/json' \
      -d '{"name":"Essai","config":'"$(cat config.json)"'}' | jq -r .id)
curl -s localhost:8765/api/experiments/$ID/live | jq '.status, .progress, .eta_s'
curl -s localhost:8765/api/queue | jq '.active[] | {short_id, progress, eta_s}'
curl -s "localhost:8765/api/experiments/$ID/export?format=archive" -o archive.zip

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
