# 01 — Architecture

## Vue d'ensemble

```
┌──────────────────────────┐   HTTP JSON    ┌────────────────────────────────────────┐
│ Navigateur               │ ─────────────▶ │ FastAPI  (backend/app/main.py)          │
│ React + TypeScript (SPA) │ ◀───────────── │  ├─ schemas.py   validation             │
│ figures SVG              │  polling 450 ms│  ├─ jobs.py      file d'exécution        │
└──────────────────────────┘                │  ├─ store.py     SQLite + JSON gz       │
                                            │  └─ worker.py    fonction des processus  │
                                            └───────────────┬────────────────────────┘
                                                            │ ProcessPoolExecutor (spawn)
                                                            ▼
                                            ┌────────────────────────────────────────┐
                                            │ tis_engine  (Python pur + modelly-abm)  │
                                            │  model.py · schedules.py · runner.py    │
                                            │  parameters.py                          │
                                            └────────────────────────────────────────┘
```

Trois couches strictement séparées :

| Couche | Dossier | Responsabilité | Dépend de |
|---|---|---|---|
| **Modèle scientifique** | `backend/tis_engine/` | Équations, agents, calendriers, métriques. Aucune notion de web ni de base de données. | `modelly-abm` |
| **Logique applicative** | `backend/app/` | Validation, plan de scénarios, exécution asynchrone, agrégation, persistance, exports. | `tis_engine`, FastAPI, Pydantic |
| **Interface** | `frontend/src/` | Affichage, saisie, graphiques, rapports. **Ne calcule aucun résultat scientifique.** | API REST |

Le moteur n'a **pas** été réécrit en JavaScript : le frontend se contente d'afficher ce que
le backend calcule, ce qui évite toute divergence avec le modèle Python validé.

## Cycle de vie d'une expérience

```
 création (POST /api/experiments)
        │  validation (schemas.validate_config) ── erreurs → HTTP 422
        ▼
   ready ──run──▶ queued ──▶ running ──▶ completed   (résultats immuables)
                                 │
                                 ├──cancel──▶ cancelled
                                 └──exception─▶ error
```

1. `schemas.ExperimentConfig` décrit la configuration ; `validate_config` vérifie bornes,
   unités et compatibilités. Rien n'est corrigé silencieusement.
2. `jobs.scenario_plan` développe la configuration en scénarios
   (culture × stratégie, + témoin si `include_control`), et construit chaque calendrier
   avec les fonctions du notebook.
3. `jobs.submit` envoie une tâche par **(scénario, répétition)** au pool de processus.
   La répétition *r* utilise la graine `seed + 1000·r` dans tous les scénarios.
4. Chaque processus exécute `worker.run_task` → `runner.run_season`. La répétition 0 de
   chaque scénario envoie son état jour par jour dans une file partagée : c'est le
   « flux en direct » de la page Live.
5. À la fin, `jobs.build_results` agrège (moyenne, écart-type corrigé), calcule les séries
   dérivées, les événements et les variations appariées au témoin, puis `store.save_results`
   écrit `data/results/<id>.json.gz`.

## Pourquoi ces choix

| Choix | Raison |
|---|---|
| Processus (`spawn`) plutôt que threads | Le modèle est du Python pur, limité par le GIL. `spawn` évite les risques du `fork` dans un serveur multi-thread. |
| Une tâche par répétition | Parallélisme maximal, progression fine, annulation rapide. |
| Annulation par drapeau partagé | Vérifié chaque jour simulé : une saison s'interrompt en moins d'un jour de calcul. |
| SQLite + fichiers JSON compressés | Aucun serveur à installer ; les métadonnées sont interrogeables, les séries volumineuses restent hors de la base. |
| Polling plutôt que WebSocket | Simplicité et robustesse ; 450 ms suffit pour un suivi fluide. |
| Graphiques SVG faits main (d3-scale / d3-shape) | Contrôle typographique complet, export SVG fidèle, rendu « publication ». |

## Fichiers clés

| Fichier | À lire pour… |
|---|---|
| `backend/tis_engine/model.py` | comprendre ou modifier le modèle (agents, `RematingModel`) |
| `backend/tis_engine/runner.py` | métriques de fin de saison, séries enregistrées, agrégation |
| `backend/tis_engine/parameters.py` | paramètres exposés, libellés, unités, plages, sources |
| `backend/app/schemas.py` | contrat de configuration et règles de validation |
| `backend/app/jobs.py` | exécution, séries dérivées, événements, comparaison au témoin |
| `backend/app/main.py` | routes HTTP, exports, données de référence |
| `frontend/src/lib/api.ts` | types TypeScript miroirs des contrats backend |
| `frontend/src/lib/variables.ts` | libellés, unités et couleurs des séries et métriques |
