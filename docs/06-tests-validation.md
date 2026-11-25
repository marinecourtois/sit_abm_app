# 06 — Tests et validation scientifique

```bash
make test-smart    # uniquement les tests touchés par vos modifications (SmartTest) — usage quotidien
make test-all      # tout, via SmartTest, avec rapport .smarttest/reports/report.html
make test          # tout, directement : pytest (backend) puis Vitest (frontend)
```

| Suite | Outil | Fichiers | Tests |
|---|---|---|---|
| Backend : non-régression, API, contrat | pytest (`backend/tests/`) | 3 | 61 |
| Frontend : unitaires, composants, contrat | Vitest + Testing Library (`frontend/src/**/*.test.ts(x)`) | 14 | 100 |

## SmartTest : ne lancer que les tests affectés

[SmartTest](https://github.com/RemiPelloux/SmarttyTest) (`@tkmremi/smarttest`, installé à la
racine du dépôt) construit le graphe de dépendances des deux projets — imports TypeScript du
frontend, imports Python du backend — et ne lance que les tests qu'une modification peut
atteindre, chacun avec la raison de sa sélection.

```bash
npx smarttest run                    # tests affectés par les modifications non commitées
npx smarttest run --staged           # tests affectés par ce qui est indexé (avant un commit)
npx smarttest run --base main        # tests affectés par la branche courante
npx smarttest explain <fichier>      # quels tests protègent ce fichier, et par quel chemin
npx smarttest run --all              # tout, par le même pipeline
```

Exemples de sélection réelle :

| Fichier modifié | Tests sélectionnés |
|---|---|
| `frontend/src/lib/format.ts` | `format.test.ts`, et les tests des composants qui l'importent (`TimeSeriesChart`, `science`, `ui`) |
| `backend/tis_engine/schedules.py` | `test_regression.py`, `test_api.py` (via `runner.py`), `test_frontend_contract.py` |
| `backend/app/store.py` | `test_api.py` |

Configuration : `smarttest.config.ts` (mode `balanced`, runners Vitest dans `frontend/` et
pytest dans `backend/`). `backend/pytest.ini` déclare `pythonpath = .`, indispensable pour que
SmartTest (comme pytest) résolve `import tis_engine` / `import app`.

**Crochet pre-commit (facultatif)** : `npx smarttest hook install` lance les tests affectés à
chaque commit. Il n'est pas installé par défaut : le dossier `.git/hooks` est partagé par
tous les worktrees du dépôt et bloquerait les commits là où SmartTest n'est pas installé.

### Contournements de SmartTest 1.1.1 (à retirer après correction)

1. **`vitest.config.ts` à la racine** : avec plusieurs projets, l'adaptateur Vitest passe
   `--config <racine>/vitest.config.ts` au lieu de `frontend/vitest.config.ts`. Le fichier racine
   ne fait que réexporter la configuration du frontend.
2. **`minWorkers: 1`** dans `frontend/vitest.config.ts` : SmartTest partage les cœurs entre
   Vitest et pytest (`--maxWorkers=n`) ; Vitest 2 refuse de démarrer si `n` est inférieur à son
   minimum par défaut (cœurs − 1).

Sans ces deux réglages, `smarttest run --all` signale les 8 fichiers Vitest en « infrastructure
error ».

## Ce qui est testé

### `tests/test_regression.py` — non-régression vis-à-vis du notebook

| Test | Référence | Exigence |
|---|---|---|
| `test_reference_files_unchanged` | sha256 des CSV de `data/reference/` | Les fichiers de référence n'ont pas été altérés |
| `test_schedules_match_make_strategies` | `make_strategies` du notebook | Calendriers identiques, somme = budget |
| `test_cell9_quick_test` | Sortie affichée de la cellule de test rapide | Valeurs identiques à l'arrondi affiché |
| `test_factorial_bit_exact` | 26 lignes de `resultats_experience_factorielle.csv` | **Égalité exacte** des 13 colonnes (aucune tolérance) |
| `test_dynamics_bit_exact` | `dynamiques_temporelles_journalieres.csv` | Égalité exacte des 11 séries, jour par jour |
| `test_worker_skips_seasons_of_cancelled_runs` | — | Une saison d'une expérience déjà annulée n'est pas calculée et n'émet rien |

Ces tests protègent aussi les **optimisations** du moteur (APP 6) : une optimisation qui
ajoute, retire ou réordonne un tirage aléatoire les fait échouer.

Les graines utilisées sont celles du notebook (`42 + 1000·rep + 7·B + 13·len(stratégie) +
19·len(invasion)` pour le plan factoriel, `42 + 1000·rep + 17·len(stratégie)` pour les
dynamiques).

### Séries et extensions hors notebook (1.9.0, `tests/test_regression.py`)

| Test | Vérifie |
|---|---|
| `test_new_series_are_consistent_and_draw_nothing` | Femelles fécondées ≤ femelles ; probabilité d'accouplement stérile dans [0, 1], nulle sans stériles. Les tests bit à bit ci-dessus prouvent qu'elles ne tirent aucun nombre |
| `test_immigration_extension` | `immigrants` = (m_W + m_F) × jours ; plus de larves qu'en parcelle fermée |
| `test_carrying_capacity_extension` | Émergences bloquées > 0 et W + F ≤ K_a, sur un témoin dont la population dépasse K_a sans l'extension |
| `test_turning_stage_extension` | p_y = 0 et d_t ≥ maturité max avec p_t = 0,3 est **identique au bit près** au modèle du notebook avec p_y = 0,3 ; un stade plus court change les résultats |
| `test_turning_window_lasts_exactly_d_t_days` | Un fruit jeune aux âges 0 … M n'est « tournant » qu'aux d_t derniers (M − d_t + 1 … M) |

### `tests/test_frontend_contract.py` — contrat backend → frontend

| Test | Vérifie |
|---|---|
| `test_frontend_meta_fixture_matches_engine` | L'instantané du registre utilisé par les tests du frontend (`frontend/src/test/fixtures/meta.json`) est identique au registre du moteur. Sinon : `make fixtures` |
| `test_every_parameter_has_a_label_and_a_group` | Chaque paramètre exposé a un libellé court et un groupe d'affichage |
| `test_engine_produces_everything_the_interface_displays` | Une vraie saison courte : chaque indicateur et chaque série déclarés dans `frontend/src/lib/variables.ts` sont produits par le moteur (ou dérivés par `app/jobs.py`) |

### Tests du frontend (Vitest)

| Fichier | Vérifie |
|---|---|
| `lib/contract.test.ts` | Indicateurs et séries affichés présents dans le code du moteur ; stratégies colorées = registre ; descriptions de stratégies cohérentes avec leurs paramètres réels |
| `components/science.test.tsx` | Cartes botaniques générées depuis `CropParameters` (et suivent une modification des paramètres) |
| `components/charts/TimeSeriesChart.test.tsx` | Une courbe par série, bande ± écart-type seulement si elle existe, jamais d'axe négatif pour des données positives, accessibilité |
| `components/ui.test.tsx` | Segmented (souris, clavier, ARIA), bornes de NumberField, libellés de statut |
| `icons/icons.test.tsx` | Les 46 icônes : grille 24 × 24, `currentColor`, décoratives par défaut, nommées avec `aria-label` |
| `lib/api.test.ts` | Messages d'erreur du backend, configuration transmise telle quelle, URL d'export (dont l'archive), curseur `since` du flux en direct |
| `lib/live.test.ts` | Fusion du flux incrémental (`mergeLive`) : ajout à la bonne position, aucune ligne dupliquée, scénarios absents conservés ; format des durées |
| `components/CommandPalette.test.tsx` | Filtrage de la palette : sans accents ni casse, identifiant et mots-clés, tous les mots requis |
| `lib/format.test.ts` | Format français, tiret (jamais zéro) pour une valeur absente, signes |
| `lib/indicators.test.ts` | Chaque indicateur en % précise son dénominateur ; somme des fruits infestés ; écarts en points de % ; écart-type n − 1 |
| `components/charts/exportChart.test.ts` | CSV : échappement et précision complète |
| `pages/Model.test.tsx` | Page Modèle : les cinq classes d'agents du moteur et leurs valeurs lues dans le registre ; les trois mécanismes absents du notebook marqués « option hors notebook » |
| `pages/Protocol.test.ts` | Export JSON des paramètres : chaque paramètre biologique avec sa valeur du notebook, sa plage, son unité et sa source |
| `lib/analysis.test.ts` | Synthèse décisionnelle (classement, écart au témoin, sens de l'indicateur, écart inférieur à la variabilité, réponses aux deux questions) ; jeu de données des analyses d'une expérience : une ligne par saison aux colonnes du CSV du notebook, valeurs non modifiées ; invasion et régime propres à chaque scénario d'un plan ; variantes d'une même stratégie distinctes ; noms du notebook → clés du moteur ; libellés de scénario ; front de Pareto |

Les deux tests de contrat ont été vérifiés par mutation : ajouter dans l'interface un
indicateur que le moteur ne calcule pas fait échouer le test Vitest **et** le test pytest.

### `tests/test_api.py` — de bout en bout

| Test | Vérifie |
|---|---|
| `test_validation_rejects_invalid` | Valeurs hors plage refusées (422), messages explicites |
| `test_parameters_reach_engine_exactly` | Les résultats stockés par l'API sont **identiques** à un appel direct du moteur avec la même configuration (y compris paramètres biologiques modifiés) |
| `test_reproducible_and_immutable` | Même configuration → mêmes résultats ; relance d'une expérience terminée refusée ; duplication avec `parent_id` |
| `test_cancel` | Annulation effective, aucun résultat partiel enregistré |
| `test_exports_and_protocol_roundtrip` | Exports CSV, aller-retour export/import de protocole |
| `test_live_stream_is_incremental_and_gapless` | Le curseur `since` ne renvoie que les nouvelles lignes ; recollées, elles forment une série sans trou ; temps écoulé publié ; flux libéré à la fin |
| `test_queue_lists_active_runs` | `/api/queue` liste une exécution en cours avec son nombre de saisons, puis plus après l'annulation |
| `test_results_are_served_precompressed_and_cacheable` | Résultats envoyés en gzip tels que stockés (et décompressés si le client ne l'accepte pas), cache immuable ; références compressées ; `no-store` sur le reste de l'API |
| `test_reproducibility_archive` | L'archive contient les 5 fichiers attendus, chaque SHA-256 du LISEZMOI correspond, le protocole se réimporte à l'identique |
| `test_health_reports_app_version` | `/api/health` renvoie `app_version` |
| `test_plan_crosses_budgets_invasions_and_regimes` | Plan 2 invasions × 2 régimes × 2 budgets : chaque scénario est **identique au bit près** à un appel direct du moteur (répétitions 0 et 9), graines communes, effet apparié calculé contre le témoin de sa cellule, colonnes du CSV |
| `test_plan_limits_and_legacy_hash` | Plan trop grand ou valeurs en double refusés ; une configuration sans plan garde l'empreinte d'avant la 1.7.0 ; liste à une valeur = valeur unique |
| `test_configs_before_extensions_still_validate_and_run_identically` | Une configuration d'avant la 1.9.0 (sans clés d'extension) est acceptée, garde son empreinte et donne exactement les mêmes nombres |
| `test_active_extension_is_flagged` | Une extension active et un stade « tournant » couvrant toute la phase jeune produisent les avertissements attendus |

Les tests de l'API utilisent une base et un dossier de résultats temporaires : ils ne
touchent pas `data/app.db`.

## Plan factoriel à 20 répétitions

Le notebook ne calcule que 3 répétitions par scénario ; l'étude en exige au moins 10, et la
page Analyses en utilise 20 depuis la 1.8.0.
`make factorial` (`backend/scripts/factorial.py --reps $(REPS)`, `REPS=20` par défaut) recalcule le même plan (2 cultures ×
3 invasions × 4 budgets × 2 régimes × stratégies) avec la **même formule de graine** que le
notebook (3 840 saisons à 20 répétitions, 9 min 19 s sur 6 processus). Avant d'écrire le résultat, le script
vérifie que les 576 saisons déjà présentes dans le CSV du notebook (répétitions 0 à 2) sont
**identiques au bit près** ; sinon il s'arrête sans rien écrire.

Sortie : `backend/data/factorial/factorial_r<N>.csv` et `factorial_r<N>.json` (provenance : date,
moteur, modelly, durée, sha256). La page Analyses prend automatiquement le fichier qui a le plus
de répétitions.

## Que faire si la non-régression échoue

1. **Vous n'aviez pas l'intention de changer le modèle** : c'est un bogue. Cherchez un tirage
   aléatoire ajouté, déplacé ou supprimé, un changement d'ordre d'itération (listes de
   fruits, agents), ou une modification d'arrondi.
2. **Vous changez volontairement le modèle** (nouvelle hypothèse, correction) :
   - documentez le changement (docs/03 et page Protocole si nécessaire) ;
   - incrémentez `ENGINE_VERSION` (et `PARAMS_VERSION` si des défauts changent) ;
   - régénérez les références depuis le notebook mis à jour (procédure ci-dessous) ;
   - n'éditez jamais les CSV de référence à la main.

## Mettre à jour la référence depuis un nouveau notebook

1. Exécuter le notebook complet (*Restart Kernel and Run All Cells*) ; il régénère
   `resultats_experience_factorielle.csv` et `dynamiques_temporelles_journalieres.csv`.
2. Reporter les modifications de code des cellules 2 à 5 dans `tis_engine/` en conservant
   les marques `APP n`.
3. Copier les deux CSV dans `backend/data/reference/`.
4. Mettre à jour les préfixes sha256 dans `test_reference_files_unchanged`, ainsi que
   `CELL9` si la sortie de la cellule de test rapide a changé.
5. `make test` doit passer.

## Vérifications manuelles avant une livraison

- [ ] `make test-all` vert (SmartTest, 135 tests).
- [ ] `APP_VERSION` (`backend/app/__init__.py`), `frontend/package.json` et `CHANGELOG.md` à jour ; `make fixtures` si `ENGINE_VERSION` a changé.
- [ ] `cd frontend && npx tsc -b && npx vite build` sans erreur.
- [ ] Vue d'ensemble : l'étude de référence se calcule au démarrage et s'affiche.
- [ ] Studio → Lancer : la page Live suit la progression (temps restant, titre de l'onglet), l'indicateur d'activité de la barre latérale apparaît, puis les résultats s'affichent.
- [ ] `Ctrl K` : la palette ouvre une page et une expérience au clavier.
- [ ] Archive (.zip) d'une expérience terminée : `sha256sum -c` des empreintes du LISEZMOI.
- [ ] Interrompre une simulation : statut « Interrompue », relance possible.
- [ ] Comparaison de 2 à 4 scénarios, export CSV et SVG d'une figure.
- [ ] Rapport (Publications) : aperçu avant impression correct (sans barre latérale).
- [ ] Affichage correct à 390 px, 1280 px et 2560 px de large.
