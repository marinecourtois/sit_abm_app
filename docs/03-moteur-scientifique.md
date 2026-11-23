# 03 — Moteur scientifique : fonctionnement et modification du backend

Ce document explique comment le modèle est organisé, puis donne des **recettes pas à pas**
pour les modifications les plus courantes.

---

## 1. Origine et fidélité

`backend/tis_engine/` est une extraction des cellules 2 à 5 du notebook
`Notebook_ABM_TIS_Optimise_Modelly.ipynb` :

| Cellule du notebook | Fichier | Contenu |
|---|---|---|
| 2 — `CropParameters`, `STRAWBERRY`, `CHERRY`, `ECHELLE` | `model.py` | Paramètres des cultures |
| 3 — `LIFESPAN_MEANS`, `sample_lifespan` | `model.py` | Durées de vie |
| 3 — agents | `model.py` | `SterileMales_Agent`, `WildMales_Agent`, `Larvae_Agent`, `Females_Agent`, `Fruit_Agent` |
| 4 — `RematingModel` | `model.py` | Modèle, récolte, prophylaxie, recensement, `advance_day()` |
| 5 — calendriers | `schedules.py` | `continuous_schedule`, `periodic_schedule`, `front_loaded_schedule`, `make_strategies` |
| 5 — `_run_factorial_season` | `runner.py` | Métriques de fin de saison |

Six ajouts, marqués `APP 1` à `APP 6` dans `model.py`, ne changent **aucun
nombre** avec les valeurs par défaut :

| Marque | Ajout | Pourquoi |
|---|---|---|
| APP 1 | Durées de vie moyennes et CV portées par le modèle (au lieu de variables globales) | Modifiables par expérience, sans effet de bord entre processus |
| APP 2 | `eta` et `eta_sperm_choice` lus sur le modèle | Paramètre « compétitivité des stériles » exposé |
| APP 3 | Compteurs cumulés de pontes fertiles / stériles | Indicateur « piqûres stériles » ; lecture seule |
| APP 4 | `CropParameters.final_harvest` remplace le test `crop.name == "cherry"` | Comportement identique, généralisable à d'autres cultures |
| APP 5 | Constantes fixes nommées (`EGGS_POISSON_MEAN`, `RF_FERTILE`, `LARVAL_MORTALITY`, `SEX_RATIO`…) | **Source unique** : le code les utilise et l'interface les affiche (page Protocole), sans recopie |
| APP 6 | `Fruit_Agent.__slots__` ; dans `advance_day`, statut des fruits **jamais piqués** et encore dans leur durée de vie naturelle mis à jour directement (« mûr si âge ≥ maturation ») au lieu d'appeler `check_status` | Performance (11 à 21 % par saison). Pour ces fruits, `check_status` ne tire aucun nombre aléatoire : l'ordre des tirages est identique. Tout autre fruit passe toujours par `check_status` |

### Source unique de vérité

Aucun chiffre du modèle n'est écrit à la main dans l'interface ni dans les textes générés :

| Information affichée | Lue depuis |
|---|---|
| Constantes biologiques fixes (ponte, périodes réfractaires, mortalité, émergence, sex-ratio) | `model.py` → `parameters.MODEL_CONSTANTS` / `FIXED_CONSTANTS` |
| Caractéristiques des cultures (cartes, résumés, protocole) | `CropParameters` → `parameters._crop_summary` |
| Paramètres et descriptions des stratégies | `runner.STRATEGY_PRESETS` → `parameters.STRATEGY_META` |
| Paramètres biologiques réglables | `parameters.BIOLOGY_PARAMS` |
| Plan factoriel du notebook (cultures, invasions, budgets, répétitions, saisons) | calculé depuis le CSV de référence (`main.reference_plan`) |
| Estimation de durée | durées mesurées des exécutions terminées de ce serveur (`main._history`) ; absente s'il n'y en a pas |
| Avertissements de validation | calendriers calculés par le moteur |

Pour modifier une de ces valeurs, modifiez la source : toutes les pages suivent.

### Règle d'or : le flux aléatoire

Tout l'aléatoire passe par `model.random` (`modelly.FastRandom`, Mersenne Twister). Les
résultats dépendent de **l'ordre exact des tirages**. Par conséquent :

- n'ajoutez **jamais** de tirage (`random()`, `randint`, `sample`, `shuffle`…) dans un chemin
  existant sans accepter que tous les résultats changent ;
- un indicateur ou une série ajouté doit être en **lecture seule** (compteur, recensement) ;
- les `model_reporters` du `DataCollector` ne doivent jamais tirer de nombre aléatoire.

Si `tests/test_regression.py` échoue après votre modification, vous avez changé le modèle :
voir [06-tests-validation.md](06-tests-validation.md).

---

## 2. Déroulement d'une saison

`runner.run_season(task)` reçoit une configuration **entièrement résolue** :

```python
task = {
    "crop": "strawberry",           # clé de model.CROPS
    "wild": 300, "females": 300,    # effectifs initiaux
    "remating": "preference",       # preference | first | last | mixed
    "seed": 42,
    "schedule": {0: 265, 3: 265, ...},   # jour -> mâles stériles lâchés
    "biology": {...},               # toutes les clés de parameters.BIOLOGY_PARAMS
}
```

Elle construit un `RematingModel`, appelle `advance_day()` `season_length` fois, puis renvoie :

- `metrics` : indicateurs de fin de saison (voir §3) ;
- `series` : une liste par variable enregistrée (`Time`, `Wild_males`, `Sterile_males`,
  `Females`, `Larvae`, catégories de fruits, cumuls), longueur `season_length + 1`.
  La valeur d'indice *t* est l'état **au matin du jour t** (convention FIGURE 1 du notebook).

Une journée (`advance_day`) :

1. production des fruits du jour (fraise) ;
2. lâcher des stériles prévus `schedule[time]`, puis des femelles éventuelles ;
3. activation de tous les agents dans un ordre aléatoire (`shuffle`) ;
4. `check_status()` de chaque fruit (un seul tirage de pourrissement par jour) ;
5. récolte / prophylaxie selon la culture ; récolte finale de la cerise au dernier jour ;
6. `time += 1`, puis enregistrement.

`runner.aggregate(replicates)` calcule ensuite moyenne, écart-type corrigé (n − 1), min,
max et valeurs individuelles, ainsi que les séries dérivées `Wild_adults`, `SW_ratio`
(S / max(1, W), comme le notebook) et `Wild_adults_relative`. `jobs.build_results` ajoute
`Wild_adults_vs_control` (rapport au témoin apparié), les événements et `vs_control`.

---

## 3. Indicateurs calculés

Tous les pourcentages sont rapportés à `crop.total_fruits` (90 000 fruits produits).

| Clé | Définition | Origine |
|---|---|---|
| `harvested_clean_pct` / `_sterile_only_pct` / `_larvae_pct` / `harvested_pct` | Fruits récoltés, par catégorie | notebook |
| `rotten_pct`, `rotten_larvae_pct`, `rotten_sterile_only_pct`, `rotten_clean_pct` | Fruits pourris, par catégorie | notebook |
| `remaining_*_pct` | Fruits restés sur la plante en fin de saison | notebook |
| `larvae_produced` | Larves nées sur la saison | notebook |
| `sterile_released` | Stériles effectivement lâchés | notebook (`total_sterile_released`) |
| `larval_damage_pct` | Fruits avec ≥ 1 ponte fertile (récoltés + pourris + restés) | app — axe « Infestés » du radar du notebook |
| `sterile_puncture_share_pct` | Pontes stériles / toutes les pontes | app — compteurs APP 3 |

---

## 4. Versions

Trois numéros de version accompagnent chaque expérience :

| Constante | Fichier | À incrémenter quand… |
|---|---|---|
| `ENGINE_VERSION` | `tis_engine/model.py` | le code du moteur change (même si les nombres ne changent pas) |
| `PARAMS_VERSION` | `tis_engine/parameters.py` | une valeur par défaut, une plage ou la liste des paramètres change |
| `SCHEMA_VERSION` | `tis_engine/parameters.py` | la structure de la configuration ou des résultats change |

Les expériences existantes conservent les versions avec lesquelles elles ont été calculées.

Historique de `ENGINE_VERSION` : **1.1.0** (extraction du notebook, APP 1 à 5) → **1.2.0**
(application 1.6.0, APP 6, performance seule : mêmes nombres au bit près).

La version de l'**application** (`APP_VERSION`, `backend/app/__init__.py`) est distincte : elle
suit les évolutions de l'interface et de l'API (voir `CHANGELOG.md`) et est enregistrée dans
`runtime.app_version` de chaque nouvelle expérience.

---

## 5. Recettes

Après chaque recette : `make test`, puis relancer le serveur (`make serve` ou `make dev`).

### 5.1 Modifier la valeur par défaut d'un paramètre exposé

1. `tis_engine/parameters.py` → `BIOLOGY_PARAMS["<nom>"]` : changer le 3ᵉ élément (défaut).
   Mettre à jour la source (7ᵉ élément) si la valeur ne vient plus du notebook.
2. Incrémenter `PARAMS_VERSION`.
3. Les tests de non-régression utilisent `biology_defaults()` : ils échoueront, c'est
   normal puisque le modèle de référence change. Pour garder la référence du notebook,
   figez les valeurs du notebook dans les tests (dictionnaire explicite au lieu de
   `biology_defaults()`).
4. L'étude de référence existante n'est pas recalculée : supprimez-la (page Expériences)
   pour qu'elle soit relancée au prochain démarrage avec les nouvelles valeurs.

### 5.2 Exposer un nouveau paramètre biologique

Exemple : rendre réglable la ponte moyenne `mean_eggs_per_day` (6 dans le notebook).

1. **Modèle** (`model.py`) : ajouter l'argument au constructeur avec la valeur du notebook
   comme défaut, et le lire dans l'agent :

   ```python
   class RematingModel(modelly.Model):
       def __init__(self, ..., mean_eggs_per_day=6):
           ...
           self.mean_eggs_per_day = mean_eggs_per_day

   class Females_Agent(modelly.Agent):
       def __init__(...):
           ...
           self.mean_eggs_per_day = model.mean_eggs_per_day   # APP 4
   ```

2. **Registre** (`parameters.py`) : ajouter l'entrée

   ```python
   "mean_eggs_per_day": ("\\lambda", "œufs / femelle / jour", 6, 0.0, 30.0, 0.5,
                         "Cellule 3 — Females_Agent.mean_eggs_per_day",
                         "Ponte journalière moyenne (loi de Poisson plafonnée à 6).", True),
   ```

   Le dernier booléen place le paramètre en Mode Avancé (`True`) ou Essentiel (`False`).
   Ajouter aussi son **libellé court et son groupe** dans `PARAM_UI` (groupes définis dans
   `PARAM_GROUPS` : accouplement, durées, ponte, pourrissement, récolte) :

   ```python
   "mean_eggs_per_day": ("Ponte journalière moyenne", "ponte"),
   ```

   `tests/test_frontend_contract.py` échoue si un paramètre n'a pas de libellé ou de groupe.
   Retirer la ligne correspondante de `FIXED_CONSTANTS` si elle y figure.

3. **Exécution** (`runner.run_season`) : transmettre la valeur
   `mean_eggs_per_day=float(bio["mean_eggs_per_day"])`.
4. Incrémenter `ENGINE_VERSION` et `PARAMS_VERSION` ; marquer l'ajout `APP n` dans `model.py`.
5. `make test` doit passer **sans modifier les tests** (valeur par défaut = notebook).
6. Le frontend n'a rien à faire : le Studio, le Protocole et le rapport lisent la liste via
   `GET /api/meta`.

> Les anciennes expériences n'ont pas cette clé dans `config.biology`. Leur duplication
> affichera « Paramètres biologiques manquants » dans le Studio : cliquer sur « Rétablir les
> valeurs du notebook ». Ce comportement est voulu : aucune valeur n'est complétée
> silencieusement.

### 5.3 Ajouter une stratégie de lâcher

0. **Paramètres** : ajouter la stratégie dans `runner.STRATEGY_PRESETS` (`kind` = `continuous`,
   `periodic` ou `front_loaded`, avec ses paramètres). Si c'est un des types existants, les
   étapes 1 et 2 ne sont pas nécessaires.
1. **Calendrier** : si possible, réutiliser `continuous_schedule`, `periodic_schedule` ou
   `front_loaded_schedule` (`schedules.py`). Sinon, y ajouter une fonction
   `budget, season_length → {jour: nombre}` dont la somme vaut exactement le budget.
2. `runner.py` : ajouter la clé dans `STRATEGIES` et une branche dans `build_schedule`.
3. `parameters.py` : ajouter le nom dans `_NAMES` (`label`, `short`, nom du notebook). La
   description est générée automatiquement depuis `STRATEGY_PRESETS`.
4. `app/schemas.py` : ajouter la clé au `Literal` de `StrategySpec.key`, et un libellé dans
   `strategy_label` si la stratégie a des paramètres.
5. Frontend :
   - `src/lib/api.ts` → type `StrategyKey` ;
   - `src/lib/colors.ts` → `STRATEGY_COLOR` et `STRATEGY_ORDER` ;
   - `src/pages/Studio.tsx` → tableau `PRESETS` pour la proposer dans le Studio ;
   - facultatif : `TABLE_STRATS` dans `src/pages/Overview.tsx`.
6. Ajouter un test dans `tests/test_regression.py` vérifiant que la somme du calendrier égale
   le budget (voir `test_schedules_match_make_strategies`).

### 5.4 Ajouter une culture

1. `model.py` : créer un `CropParameters` et l'ajouter à `CROPS`.
   Une culture à stock fermé et récolte unique au dernier jour prend `final_harvest=True`
   (comme la cerise).
2. `parameters.py` → `CROP_META` (`label`, `latin`) ; le résumé et les paramètres affichés sont
   générés depuis `CropParameters`. Pour une récolte unique au dernier jour, `final_harvest=True`.
3. `app/jobs.py` → `_events` : dates de récolte de la culture.
4. Frontend :
   - `src/lib/api.ts` → type `CropKey` ;
   - `src/lib/format.ts` → `CROP_LABEL` ; `src/lib/colors.ts` → `CROP_COLOR` ;
   - `src/pages/Studio.tsx` : liste des cultures proposées ;
   - illustration éventuelle dans `src/illustrations/` et `BotanicalSpeciesCard`.

### 5.5 Ajouter un indicateur de fin de saison

1. `runner.run_season` : ajouter la clé dans le dictionnaire `metrics` (calcul en lecture
   seule à partir de l'état du modèle). `aggregate` le prend en compte automatiquement.
2. Si l'indicateur a besoin d'un compteur, l'incrémenter dans le modèle **sans tirage
   aléatoire** (comme APP 3).
3. Frontend : ajouter l'entrée dans `METRICS` de `src/lib/variables.ts` (libellé, unité,
   sens, définition). Il apparaît alors dans les exports, le tableau comparatif et le rapport.
4. Documenter la définition dans ce fichier (§3).

### 5.6 Ajouter une série temporelle

1. `model.py` → `model_reporters` du `DataCollector` : `"Ma_serie": lambda m: ...`
   (aucun tirage aléatoire).
2. `runner.py` → ajouter le nom à `SERIES_VARS`.
3. Pour une série **dérivée** (calculée à partir d'autres) : l'ajouter dans `derived` de
   `runner.aggregate`, ou dans `jobs.build_results` si elle compare au témoin.
4. Frontend : `VARIABLES` dans `src/lib/variables.ts` (libellé, unité, couleur, tirets).

### 5.7 Modifier les règles de validation

Toutes les règles sont dans `app/schemas.py`, fonction `validate_config` :

- `errors` bloquent la création (HTTP 422) ;
- `warnings` sont affichés dans le Studio sans bloquer.

Les plages des paramètres biologiques viennent de `BIOLOGY_PARAMS` ; les limites
générales (répétitions, budget) sont codées dans `validate_config` et rappelées dans
`parameters.registry()["limits"]`.

### 5.8 Régimes de réaccouplement et nombre de répétitions

- Les régimes (`preference` = polyandrie, `first` = monandrie, `last`, `mixed`) sont implémentés
  dans `Females_Agent.use_fertile_sperm` ; leurs libellés, formules (LaTeX) et descriptions sont
  dans `parameters.REMATING_META`. Un nouveau régime demande une branche dans
  `use_fertile_sperm`, une entrée dans `REMATING_META` et dans `runner.REMATING_MODES`.
- Le minimum de répétitions de l'étude est `parameters.MIN_REPLICATES` (10) et le plafond
  `MAX_REPLICATES` (50) : validation, Studio, vue d'ensemble et étude de référence les lisent.
  Après un changement, relancer `make factorial` (plan factoriel à N répétitions) et
  `make fixtures`.

### 5.9 Changer la formule des graines

`jobs.replicate_seed(base, rep)` renvoie `base + 1000 * rep`. La modifier change la
reproductibilité de toutes les **nouvelles** expériences : incrémenter `SCHEMA_VERSION`
et mettre à jour [07-reproductibilite-donnees.md](07-reproductibilite-donnees.md).

---

## 6. Utiliser le moteur sans l'application

```python
# depuis backend/, avec .venv/bin/python
from tis_engine.parameters import biology_defaults
from tis_engine.runner import build_schedule, run_season

res = run_season({
    "crop": "cherry", "wild": 300, "females": 300, "remating": "preference", "seed": 42,
    "schedule": build_schedule({"key": "front_70"}, 9000, 25),
    "biology": biology_defaults(),
})
print(res["metrics"]["larval_damage_pct"])
```

Ou directement avec la classe du notebook :

```python
from tis_engine.model import RematingModel, STRAWBERRY
m = RematingModel(STRAWBERRY, sterile_release_schedule={0: 9000}, num_agents_wild=300,
                  num_agents_females=300, seed=42)
for _ in range(STRAWBERRY.season_length):
    m.advance_day()
```
