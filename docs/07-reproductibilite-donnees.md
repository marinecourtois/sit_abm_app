# 07 — Reproductibilité et données

## Ce qui est enregistré pour chaque exécution

| Champ | Description |
|---|---|
| `id`, `short_id` | UUID et identifiant court lisible (`TIS-XXXXXXXX`) |
| `config` | Configuration **complète**, y compris toutes les valeurs biologiques |
| `config_hash` | Empreinte SHA-256 (16 caractères) de la configuration triée |
| `seed` | Graine de base ; les graines des répétitions sont `seed + 1000·r` |
| `engine_version`, `params_version`, `schema_version` | Versions au moment de la création |
| `created_at`, `started_at`, `finished_at`, `duration_s` | Horodatages UTC (ISO 8601) et durée |
| `status`, `error` | État d'exécution et message d'erreur éventuel |
| `parent_id` | Expérience d'origine (duplication ou relance) |
| `runtime` | Versions de l'environnement d'exécution : **application** (`app_version`, depuis 1.6.0), moteur, paramètres, schéma, modelly, **origine de modelly** (PyPI ou chemin du dépôt local), Python |

Les expériences créées avant l'ajout de `runtime` affichent « non enregistré » : la valeur
n'est jamais reconstituée après coup.

## Garanties

- **Déterminisme** : même configuration + même graine + même version du moteur ⇒ mêmes
  résultats, au bit près, quel que soit le nombre de processus et l'ordre de calcul des saisons
  (chaque saison est indépendante et rangée par clé de scénario et numéro de répétition).
  Les moteurs 1.1.0 et 1.2.0 produisent les mêmes nombres (1.2.0 = optimisation seule, APP 6).
- **Nombres aléatoires communs** : dans une expérience, la répétition *r* de chaque scénario
  (y compris le témoin) utilise la même graine. Les variations relatives au témoin
  (`vs_control`, `Wild_adults_vs_control`) sont donc **appariées** répétition par répétition.
- **Immuabilité** : une expérience `completed` ne peut plus être relancée ni modifiée, sauf
  son nom, sa description, son projet et ses étiquettes. Toute variante passe par
  « Dupliquer et modifier », qui crée une nouvelle expérience liée par `parent_id`.
- **Relance après échec** : relancer une expérience `cancelled` ou `error` crée une nouvelle
  exécution ; l'ancienne est conservée avec son message.

## Différence avec les graines du notebook

Le plan factoriel du notebook dérive une graine différente pour chaque stratégie
(`42 + 1000·rep + 7·B + 13·len(nom) + 19·len(invasion)`). L'application utilise une graine
commune à tous les scénarios d'une expérience, ce qui permet une comparaison appariée.
Pour reproduire une saison précise du notebook, appeler `run_season` avec la graine du
notebook (voir `tests/test_regression.py`).

## Formats d'export

| Format | Où | Contenu |
|---|---|---|
| CSV métriques | Expériences, Publications | `experiment, crop, strategy, budget, replicate, seed, <métriques…>` |
| CSV séries | Expériences, Publications | `experiment, crop, strategy, day, <série>_mean, <série>_sd…` |
| CSV figure | Menu « Exporter » d'un graphique | Les données exactement tracées (après normalisation éventuelle) |
| JSON expérience | Expériences, Publications | Métadonnées, configuration, versions, résultats complets |
| JSON protocole | Studio, Expériences | `{format: "modelly-tis-protocol", schema_version, name, config, versions}` — réimportable |
| Archive de reproductibilité (.zip) | Expériences (tiroir), Publications | Tout ce qui précède dans un seul fichier, avec un LISEZMOI d'empreintes (voir ci-dessous) |
| SVG / PNG | Menu « Exporter » d'un graphique | Figure avec titre et légende ; PNG ×3 |
| Format publication | Menu « Exporter » | SVG 170 mm ou PNG 170 mm à 600 dpi, légende de figure incluse |
| PDF | Publications → « Exporter en PDF » | Rapport en 12 sections + annexe protocole, via l'impression du navigateur |

Les CSV utilisent le point décimal et la virgule comme séparateur (compatibles pandas / R).

### Archive de reproductibilité

`GET /api/experiments/{id}/export?format=archive` → `TIS-XXXXXXXX-archive.zip` :

```
TIS-XXXXXXXX/
├── LISEZMOI.txt                   nom, projet, dates, hash de configuration, graine et règle des
│                                  graines, versions de l'exécution (runtime), SHA-256 des fichiers
├── protocole.json                 identique à l'export « protocol » (réimportable)
├── resultats.json                 identique à l'export « json »
├── metriques_par_repetition.csv   identique à l'export « csv-metrics »
└── series_journalieres.csv        identique à l'export « csv-series »
```

Vérifier l'intégrité d'une archive reçue :

```bash
unzip TIS-XXXXXXXX-archive.zip && cd TIS-XXXXXXXX
sed -n '/SHA-256/,/^$/p' LISEZMOI.txt | tail -n +2 | sed 's/^  //' | sha256sum -c
```

Reproduire : importer `protocole.json` (Expériences → Importer), lancer, comparer
`resultats.json` ; avec les mêmes versions, les nombres sont identiques.

## Stockage

- Métadonnées : `backend/data/app.db` (SQLite, table `experiments`).
- Résultats : `backend/data/results/<uuid>.json.gz` (JSON compressé, ~150 Ko pour l'étude
  de référence). Ce fichier est envoyé tel quel au navigateur (`Content-Encoding: gzip`).
- Les données de référence du notebook (`backend/data/reference/`) sont en lecture seule.
