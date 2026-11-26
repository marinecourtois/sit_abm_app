# TIS-9DA0B293 — Fraise, avec et sans immigration

Simulation enregistrée le 26 novembre 2026 avec Modelly TIS Research 1.11.0 (moteur 1.3.0,
paramètres `nb-2025.10-echelle30-ext3`, modelly 1.5.1).

**Configuration** : fraise, inoculum de départ modéré (300 mâles sauvages + 300 femelles),
9 000 mâles stériles par saison, stratégies J+3 et J+7 et témoin sans lâcher, polyandrie
(« preference »), 20 répétitions, graine 42 (répétition r : 42 + 1000·r). **Immigration** :
15 mâles sauvages et 15 femelles fécondées tous les 3 jours, dès J3. Chaque scénario est
calculé **avec et sans immigration, avec les mêmes graines**, et comparé au témoin de sa
condition.

## Devenir des fruits (en % des 90 000 fruits produits, moyenne ± écart-type, 20 répétitions)

| Stratégie | Immigration | Récoltés sains | Récoltés (total) | Pourris | Infestés par des larves | Pourris après piqûres stériles seules | Restés sur la plante | Larves produites |
|---|---|---|---|---|---|---|---|---|
| Témoin | **sans** | 53,0 ± 2,5 | 68,6 ± 1,8 | 28,5 ± 1,8 | 44,2 ± 2,6 | 0,0 ± 0,0 | 2,9 ± 0,0 | 68 955 |
| Témoin | avec | 35,2 ± 1,2 | 54,1 ± 1,0 | 43,4 ± 1,1 | 62,9 ± 1,3 | 0,0 ± 0,0 | 2,5 ± 0,0 | 119 882 |
| J+3 | **sans** | 83,8 ± 1,0 | 89,0 ± 0,5 | 7,7 ± 0,5 | 4,7 ± 0,5 | 3,4 ± 0,3 | 3,3 ± 0,0 | 5 805 |
| J+3 | avec | 57,4 ± 1,0 | 74,2 ± 0,6 | 22,8 ± 0,7 | 24,3 ± 1,1 | 7,6 ± 0,2 | 3,1 ± 0,0 | 31 324 |
| J+7 | **sans** | 85,4 ± 0,7 | 89,9 ± 0,4 | 6,8 ± 0,4 | 3,6 ± 0,4 | 3,2 ± 0,2 | 3,3 ± 0,0 | 4 308 |
| J+7 | avec | 58,1 ± 1,1 | 74,6 ± 0,7 | 22,3 ± 0,7 | 23,9 ± 1,1 | 7,5 ± 0,2 | 3,1 ± 0,0 | 30 771 |

- L'immigration dégrade tous les scénarios, témoin compris : environ −18 points de fruits
  récoltés sains pour le témoin, environ −27 points pour J+3 et J+7.
- Le lâcher de stériles reste efficace avec immigration (57–58 % de fruits sains contre 35 %
  pour le témoin).
- J+3 et J+7 restent au coude-à-coude dans les deux conditions (écart inférieur à la
  variabilité entre répétitions).

## Fichiers

| Fichier | Contenu |
|---|---|
| `protocole.json` | Configuration complète, réimportable : Studio → « Importer » (ou Expériences → importer un protocole), puis lancer. Mêmes versions et même graine : mêmes nombres. |
| `resultats.json` | Résultats complets : métriques par répétition, séries journalières moyennes ± écart-type, effets appariés vs témoin. |
| `metriques_par_repetition.csv` | Une ligne par saison (scénario × répétition), avec culture, inoculum, régime, stratégie, budget, immigration (`immigration_wild`, `immigration_females`, `immigration_every`). |
| `series_journalieres.csv` | Séries jour par jour (moyenne et écart-type) de chaque scénario. |
| `LISEZMOI.txt` | Versions, graines et empreintes SHA-256 des fichiers (`sha256sum -c` à partir des lignes d'empreinte). |
