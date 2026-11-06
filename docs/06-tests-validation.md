# 06 — Tests et validation scientifique

```bash
make test          # = cd backend && .venv/bin/python -m pytest -q tests
```

Durée : environ une minute (des saisons complètes sont simulées).

## Ce qui est testé

### `tests/test_regression.py` — non-régression vis-à-vis du notebook

| Test | Référence | Exigence |
|---|---|---|
| `test_reference_files_unchanged` | sha256 des CSV de `data/reference/` | Les fichiers de référence n'ont pas été altérés |
| `test_schedules_match_make_strategies` | `make_strategies` du notebook | Calendriers identiques, somme = budget |
| `test_cell9_quick_test` | Sortie affichée de la cellule de test rapide | Valeurs identiques à l'arrondi affiché |
| `test_factorial_bit_exact` | 26 lignes de `resultats_experience_factorielle.csv` | **Égalité exacte** des 13 colonnes (aucune tolérance) |
| `test_dynamics_bit_exact` | `dynamiques_temporelles_journalieres.csv` | Égalité exacte des 11 séries, jour par jour |

Les graines utilisées sont celles du notebook (`42 + 1000·rep + 7·B + 13·len(stratégie) +
19·len(invasion)` pour le plan factoriel, `42 + 1000·rep + 17·len(stratégie)` pour les
dynamiques).

### `tests/test_api.py` — de bout en bout

| Test | Vérifie |
|---|---|
| `test_validation_rejects_invalid` | Valeurs hors plage refusées (422), messages explicites |
| `test_parameters_reach_engine_exactly` | Les résultats stockés par l'API sont **identiques** à un appel direct du moteur avec la même configuration (y compris paramètres biologiques modifiés) |
| `test_reproducible_and_immutable` | Même configuration → mêmes résultats ; relance d'une expérience terminée refusée ; duplication avec `parent_id` |
| `test_cancel` | Annulation effective, aucun résultat partiel enregistré |
| `test_exports_and_protocol_roundtrip` | Exports CSV, aller-retour export/import de protocole |

Les tests de l'API utilisent une base et un dossier de résultats temporaires : ils ne
touchent pas `data/app.db`.

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

- [ ] `make test` vert.
- [ ] `cd frontend && npx tsc -b && npx vite build` sans erreur.
- [ ] Vue d'ensemble : l'étude de référence se calcule au démarrage et s'affiche.
- [ ] Studio → Lancer : la page Live suit la progression puis affiche les résultats.
- [ ] Interrompre une simulation : statut « Interrompue », relance possible.
- [ ] Comparaison de 2 à 4 scénarios, export CSV et SVG d'une figure.
- [ ] Rapport (Publications) : aperçu avant impression correct (sans barre latérale).
- [ ] Affichage correct à 390 px, 1280 px et 2560 px de large.
