# Journal des versions

Format : une section par version de l'application (`APP_VERSION`, `backend/app/__init__.py`).
Les versions du moteur (`ENGINE_VERSION`), des paramètres et du schéma sont indépendantes et
enregistrées avec chaque expérience (voir docs/03 § 4).

## 1.11.0 — 26 novembre 2026

### Changements

- **L'immigration fait partie du modèle et du notebook** (plus « hors notebook »). Par
  culture : nombre de **mâles sauvages**, nombre de **femelles fécondées** et **fréquence**
  (une arrivée tous les X jours, à partir de J1). Désactivée par défaut : parcelle fermée, les
  résultats du notebook ne changent pas. Le notebook
  `Notebook_ABM_TIS_Optimise_Modelly.ipynb` (dépôt Modelly) a reçu le même mécanisme
  (`RematingModel(immigration_males, immigration_females, immigration_every)` et un dictionnaire
  `IMMIGRATION` par culture, à 0 par défaut) : il donne exactement les mêmes nombres que le
  moteur de l'application, avec et sans immigration (vérifié, y compris tous les 3 jours).
  Copie d'avant la modification : `Notebook_ABM_TIS_Optimise_Modelly.avant-immigration.ipynb`.
- **Comparer avec et sans immigration** dans une même expérience (case du Studio) : chaque
  scénario est calculé dans les deux conditions avec les mêmes graines, et apparié au témoin de
  sa condition. Les analyses ajoutent un sélecteur « Immigration : sans / avec », une section
  « Avec ou sans immigration » (répétitions des deux conditions par stratégie, écart
  avec − sans) et une réponse de la synthèse : *l'optimum change-t-il avec l'immigration ?*
- Les valeurs pré-remplies ne sont plus attribuées dans l'interface.
- Le message « Extension hors notebook active » ne concerne plus que la capacité de charge et
  le stade « tournant » ; l'immigration active est signalée à part (résultats non comparables au
  plan factoriel de référence, calculé sans immigration).

### Corrections (revue indépendante avant publication)

- Immigration sur une seule culture (sans comparaison) : les analyses séparaient les cultures
  entre « avec » et « sans » et vidaient les graphiques de l'autre culture. La dimension
  avec / sans n'existe plus que dans une comparaison.
- Intervalle d'arrivée égal à la durée de la saison : aucune arrivée n'avait lieu ; il est
  maintenant limité à la durée − 1 (99 j fraise, 24 j cerise).
- Studio : une culture ajoutée affichait des valeurs d'immigration qui n'étaient pas dans la
  configuration ; la comparaison ne pouvait plus être décochée quand les apports passaient à 0.
- Exports des figures : la condition (avec / sans immigration) est indiquée dans le nom et la
  légende ; CSV : colonne `immigration_every` ; Comparaison : avertissement si l'immigration
  diffère ; textes : première arrivée « dès JX ».

### Versions

`PARAMS_VERSION` `nb-2025.10-echelle30-ext3`, `SCHEMA_VERSION` 4 (`immigration.every`,
`immigration_compare`). Moteur inchangé dans ses résultats (1.3.0 ; `immigration_every`
ajouté, 1 par défaut). Empreintes inchangées pour « tous les jours » et sans comparaison.

## 1.10.0 — 25 novembre 2026

Retours de Marine (et de son encadrante) après essai de la 1.9.

### Changements

- **« Inoculum de départ »** remplace « pression d'invasion » partout dans l'interface, les
  exports et le rapport. Les niveaux deviennent **faible / modéré / fort** (« moyenne » dans le
  notebook). L'API garde ses clés (`invasion`, `faible`, `moyenne`, `forte`).
- **Inoculum fort = pic du témoin, propre à chaque culture.** Dans ce modèle, la population sans
  lâcher croît jusqu'au dernier jour : le pic est la population d'adultes sauvages en fin de
  saison. Partie de l'inoculum modéré (300 + 300), moyenne de 20 répétitions :
  **fraise 621 + 621** (pic 1 242 à J100), **cerise 6 638 + 6 639** (pic 13 277 à J25). Calcul :
  `tis_engine/calibration.py` ; un test vérifie que les valeurs figées sont exactement celles
  que calcule le moteur. Le plan factoriel du notebook (page Analyses) garde ses 900 + 900
  (« Fort (900 W : 900 F) »).
- **Immigration quotidienne visible et réglable par culture** dans le Studio (Mode Essentiel et
  Avancé), avec les valeurs proposées par Marine pré-remplies (fraise 15 + 15, cerise 8 + 8 par
  jour). Désactivée par défaut : une case à cocher l'active. Elle était auparavant cachée en Mode
  Avancé, d'où des résultats inchangés.
- **Page Dynamiques** : les cartes « pic d'adultes / pic de stériles / pic de larves » (le
  « pic d'adultes 600 à J0 » n'était que l'inoculum de départ) sont remplacées par des valeurs
  de fin de saison comparées au témoin : adultes sauvages, larves produites, femelles
  fécondées, part des accouplements stériles, chacune avec une phrase d'explication. Une
  expérience encore en calcul affiche « Calcul en cours » au lieu d'une erreur.
- Exports CSV : colonnes `immigration_wild` et `immigration_females` (repli sur l'immigration
  globale des expériences 1.9.0).

### Corrections (revue indépendante avant publication)

- Liste des expériences et rapport : l'inoculum fort affichait 900 W : 900 F au lieu des
  effectifs réellement simulés par culture.
- Plan avec l'inoculum fort et un inoculum personnalisé aux mêmes effectifs : scénarios en
  double (même clé) ; c'est maintenant refusé à la validation.
- Rapport : l'immigration et les autres extensions actives sont indiquées dans le protocole.
- Duplication ou import d'une configuration 1.9.0 avec immigration globale : convertie en
  immigration par culture équivalente (elle était appliquée sans être visible).
- Immigration d'une culture non sélectionnée ou nulle : ignorée (plus d'avertissement ni
  d'empreinte différente).
- Ancien « Fort » 900 + 900 dupliqué : affiché comme inoculum personnalisé, avec un nom court
  distinct de l'inoculum fort actuel.
- Page Dynamiques : se met à jour seule à la fin d'un calcul ; les variations par rapport au
  témoin sont les variations appariées (même graine), comme sur les autres pages.

### Versions

`PARAMS_VERSION` `nb-2025.10-echelle30-ext2`, `SCHEMA_VERSION` 3 (`invasion.by_crop`,
`immigration` par culture, `immigration` par scénario). Moteur inchangé (1.3.0). Les
configurations antérieures gardent leur empreinte.

## 1.9.1 — 25 novembre 2026

### Nouveautés

- **`make doctor`** (`scripts/doctor.sh`) : vérifie les outils (git, uv, Node.js ≥ 20), le
  dépôt, l'environnement Python (dont **SQLite**), les dépendances de l'interface, la base, le
  port 8765, puis essaie le backend et le moteur. Répare ce qui peut l'être : installe uv,
  recrée un environnement Python 3.12 géré par uv, installe les dépendances npm, met de côté une
  base corrompue dans `backend/data/sauvegarde-<date>/`. Ne supprime aucune donnée et n'arrête
  aucun processus. Testé sur une copie cassée exprès (environnement sans dépendances, modules npm
  absents, base illisible) : trois réparations, application fonctionnelle.
- **`make clean`** : remise à zéro de l'installation, en gardant `backend/data`.
- `make install` est découpé en `install-backend` et `install-frontend`.
- Vérifié : l'application fonctionne avec modelly 1.5.2 de PyPI (installation sans dépôt
  Modelly local) ; les 44 tests de non-régression passent.

## 1.9.0 — 25 novembre 2026

Sprint « tout ce que Marine voulait ». Les vues de son prototype qui restaient (Paramètres,
Modèle & Hypothèses, Dynamiques Agents) et ses trois mécanismes (immigration, capacité de charge,
stade « tournant »), sur le vrai moteur. Les mécanismes sont **optionnels et désactivés par
défaut** : le moteur reproduit toujours le notebook au bit près (38 tests de non-régression).

### Nouveautés

- **Page Paramètres** (`/parametres`) : tous les paramètres par catégorie, avec curseur et repère
  de la valeur du notebook ; catalogue (symbole, valeur, valeur du notebook, plage, unité,
  source) ; paramètres des cultures, invasions et constantes fixes ; export JSON avec les valeurs
  choisies ; **« Ouvrir dans le Studio »** lance une expérience avec ces valeurs.
- **Page Modèle** (`/modele`) : les cinq agents (rôle, état, ce qu'ils font chaque jour, valeurs
  lues dans le registre du moteur), une journée simulée en cinq étapes, et les hypothèses H1–H8
  en distinguant le notebook des options.
- **Page Dynamiques** (`/dynamiques`) : pour un scénario de n'importe quelle expérience, quatre
  graphiques (insectes avec **femelles fécondées**, état des fruits, fruits pourris par jour,
  probabilité d'accouplement stérile), les pics (adultes sauvages, stériles, larves, comparés au
  témoin) et le témoin superposé en tirets.
- **Extensions hors notebook** (Mode Avancé, désactivées par défaut, `ENGINE_VERSION` 1.3.0) :
  - immigration quotidienne (à partir de J1) de mâles sauvages et de femelles fécondées
    (métrique `immigrants`) ;
  - capacité de charge K_a des adultes sauvages : une larve qui émerge au-delà meurt (métrique
    `emergences_blocked`) ;
  - stade « tournant » : réussite de ponte p_t pendant les d_t derniers jours de la phase jeune.
  
  Une expérience qui en active une porte un avertissement (validation, page de la simulation,
  Dynamiques). Les stades de Gemini (J0–12, J12–17, J17–22) ne correspondent pas aux maturités du
  modèle (2–4 j fraise, 10–15 j cerise) : la validation prévient si d_t couvre toute la phase jeune.
- **Nouvelles séries** (lectures sans tirage) : femelles fécondées, probabilité d'accouplement
  stérile η·S / (W + η·S), fruits pourris dans la journée. Disponibles aussi sur le graphique
  d'une simulation.
- Navigation : Paramètres, Modèle et Dynamiques dans la barre latérale (`g a`, `g m`, `g d`), les
  onglets d'étude et la palette de commandes.

### Corrections (revue de code indépendante des versions 1.7 et 1.8)

- Rapport (Publications) d'un plan : la conclusion et les comparaisons mélangeaient les cellules
  (même stratégie citée comme meilleure et pire, témoin d'une autre cellule). Elles sont faites
  par culture × invasion × régime, avec le témoin de la même cellule et des libellés qui précisent
  budget, invasion et régime.
- Comparaison : avertissement quand les scénarios choisis n'ont pas la même invasion ou le même
  régime (il ne couvrait que culture et budget).
- Deux invasions personnalisées avaient le même nom court (« Personnalisée ») : elles affichent
  maintenant leurs effectifs.
- Empreinte de configuration normalisée : une liste de plan vide ou à une valeur équivaut à la
  valeur unique, et la valeur unique remplacée par une liste n'y entre plus.
- Aperçu du Studio : un témoin listé explicitement affichait un budget au lieu de 0.
- Page Paramètres et Studio : valeur masquée par les unités longues dans les champs numériques.
- Seconde revue indépendante (1.9.0, avant publication) : stade « tournant » d'un jour trop long
  (corrigé avant toute expérience) ; expériences d'avant la 1.9.0 affichées avec des paramètres
  « modifiés » vides dans le rapport et le Studio (les clés d'extension sont complétées à la
  lecture) ; titres de cellule vides dans le rapport d'un plan sans témoin ; résultat d'une autre
  expérience affiché après un changement rapide sur la page Dynamiques ; valeurs non entières
  acceptées pour des paramètres entiers ; erreur 500 sur une valeur non numérique ; immigrants de
  J0 traités comme la population initiale (l'immigration commence à J1).

### Versions

`ENGINE_VERSION` 1.3.0, `PARAMS_VERSION` `nb-2025.10-echelle30-ext1`, `SCHEMA_VERSION` 2.
Les configurations d'avant la 1.9.0 restent acceptées (extensions désactivées, même empreinte) ;
les expériences déjà calculées gardent leurs versions.

## 1.8.0 — 25 novembre 2026

Sprint « reprise des ajouts de Marine ». Marine avait prototypé avec Gemini, dans son dépôt
séparé `marinecourtois/tis-suzukii-app`, des vues supplémentaires. Gemini y avait aussi remplacé
le moteur par un moteur JavaScript inventé (capacité de charge K, immigration quotidienne, stades
de maturité vert/tournant/mûr : aucun de ces mécanismes n'existe dans le modèle du notebook),
écrit les chiffres de la synthèse en dur et supprimé l'onglet Publications/Protocole ainsi que le
graphique Fraise vs Cerise des analyses. Cette version reprend ce qu'elle voulait, calculé sur le
vrai moteur. Le moteur ne change pas (`ENGINE_VERSION` 1.2.0) : les 38 tests de non-régression
reproduisent toujours le notebook au bit près.

### Nouveautés

- **Synthèse décisionnelle** (page Analyses et analyses d'une simulation) : pour l'indicateur,
  l'invasion et le budget choisis, la stratégie en tête par culture et par régime, sa valeur, le
  témoin, l'écart au témoin, l'écart avec la deuxième (« net » ou « inférieur à la variabilité
  entre répétitions ») et la meilleure combinaison stratégie × budget. Deux réponses calculées sur
  les données : *fraise et cerise ont-elles le même optimum ?* et *l'optimum change-t-il entre
  monandrie et polyandrie ?* Lecture descriptive, sans test statistique.
- **Fraise vs cerise, par stratégie** : barres moyenne ± écart-type des deux cultures côte à côte
  (même invasion, budget et régime), avec export.
- **Superposer le témoin** sur le graphique d'évolution temporelle d'une simulation : trajectoire
  moyenne du témoin sans lâcher de la même cellule, mêmes graines (activé par défaut, inclus dans
  l'export CSV).
- **20 répétitions** : valeur proposée par défaut dans le Studio et le lancement rapide
  (`DEFAULT_REPLICATES`, `/api/meta`), le minimum accepté reste 10. Le plan factoriel de la page
  Analyses est recalculé à 20 répétitions (`make factorial`, `REPS=20` par défaut).
- **Paramètres (JSON)** sur la page Protocole : tous les paramètres du modèle (valeur du
  notebook, plage admise, unité, source), constantes et paramètres des cultures.

### Tests

- Frontend : 95 tests (+5) : synthèse décisionnelle (classement, écart au témoin, sens de
  l'indicateur, écart inférieur à la variabilité, réponses aux deux questions) et export des
  paramètres.

## 1.7.0 — 23 novembre 2026

Sprint « analyses de chaque simulation ». Le moteur ne change pas (`ENGINE_VERSION` 1.2.0) :
les 38 tests de non-régression reproduisent toujours le notebook au bit près.

### Nouveautés

- **Analyses de l'expérience** sur la page d'une simulation (bouton « Analyses ») : la heatmap
  invasion × budget × stratégie, les courbes dose-réponse, le front de Pareto, l'incertitude
  entre répétitions et polyandrie vs monandrie, calculés sur les répétitions de cette expérience
  (et non plus seulement sur le plan factoriel de référence). À côté : l'effet apparié de chaque
  stratégie vs témoin. Mêmes exports (SVG, PNG, CSV) que la page Analyses, préfixés par
  l'identifiant de l'expérience.
- **Plan d'expérience** dans le Studio : plusieurs budgets, invasions et régimes de
  réaccouplement croisés dans une même expérience, avec les mêmes graines. Le bouton « Plan du
  notebook (3 × 3 × 2) » reprend le plan factoriel du notebook. Le témoin est calculé une fois
  par culture, invasion et régime. Exemple mesuré : 2 cultures × 3 invasions × 3 budgets ×
  2 régimes × (J+3, J+7, témoin) × 10 répétitions = 840 saisons en 126 s (122 s estimées).
- Quand une dimension n'a qu'une valeur, chaque graphique l'indique et propose « Dupliquer en
  plan ».
- Configuration : champs facultatifs `budgets`, `invasions`, `rematings`. Chaque scénario
  des résultats porte son `strategy_id`, son `invasion` et son `remating`. Une configuration
  sans plan garde son empreinte et ses clés de scénario d'avant la 1.7.0. Au plus
  10 000 saisons par expérience.
- Exports CSV : colonnes `invasion, wild, females, remating` et `budget` ajoutées (aussi dans
  l'archive).
- Comparaison, liste des expériences et rapport : invasion, budget et régime de chaque scénario
  d'un plan affichés.
- Page d'une simulation réorganisée : le scénario affiché se choisit en haut, puis quatre cartes
  (état au jour choisi, événements, effet vs témoin, schéma pédagogique) au-dessus du graphique
  d'évolution temporelle ; le journal d'exécution passe sous le graphique.

### Corrections

- Front de Pareto : graduations en double quand l'étendue des axes est faible (« 1, 1, 2, 2… ») ;
  les décimales s'adaptent maintenant au pas.
- Incertitude entre répétitions : les points s'écartent selon le nombre de répétitions (lisible
  à 20 ou 50 répétitions).

### Tests

- Backend : 54 tests (+2). Un plan 2 invasions × 2 régimes × 2 budgets est identique au bit
  près au moteur appelé directement, et son témoin apparié est celui de sa cellule ; limites du
  plan et empreinte inchangée sans plan.
- Frontend : 90 tests (+7) : jeu de données des analyses d'une expérience, libellés de
  scénario, front de Pareto.

## 1.6.0 — 23 novembre 2026

Sprint « vitesse et confort de travail ». **Aucun résultat scientifique ne change** : les
38 tests de non-régression reproduisent toujours le notebook au bit près.

### Plus rapide

Mesures sur la machine de développement (Intel Core Ultra 7, 8 processus de calcul).

| Mesure | avant 1.6.0 | 1.6.0 |
|---|---|---|
| Saison de cerise, un cœur (moyenne sur l'étude de référence) | 0,70 s | 0,55 s (−21 %) |
| Saison de fraise, un cœur | 0,25 s | 0,22 s (−11 %) |
| Coût du flux en direct + annulation par saison de fraise | +48 % | ≈ +5 % |
| `GET /experiments/{id}/results` (étude de référence) | 32 ms, 356 ko | 3 ms, 147 ko transférés |
| `GET /reference/factorial` | 62 ms, 1,2 Mo | 3 ms (en cache), 124 ko transférés |
| `GET /overview` | 25 ms, 358 ko | 3 ms, 148 ko transférés |
| JavaScript chargé à l'ouverture (gzip) | 174 ko | 99 ko (KaTeX chargé à la demande) |
| Sondage du flux en direct | toute la série à chaque appel | seulement les nouvelles lignes |

- **Moteur (APP 6, `ENGINE_VERSION` 1.2.0)** : `Fruit_Agent` déclare `__slots__`, et la mise à
  jour quotidienne des fruits jamais piqués se fait directement dans `advance_day`. Ces fruits ne
  consomment aucun tirage aléatoire, donc l'ordre des tirages et tous les nombres sont inchangés.
- **Processus de calcul** : l'annulation est vérifiée tous les 10 jours simulés, et non plus
  chaque jour (un aller-retour inter-processus d'environ 1 ms à chaque fois). Une saison d'une
  expérience déjà annulée n'est plus calculée du tout. La file du flux en direct est un tube
  direct, transmis une fois à la création du processus.
- **Ordonnancement** : la répétition 0 de chaque scénario part en premier (flux en direct), puis
  les saisons les plus coûteuses d'abord. La fin du calcul n'attend plus une saison isolée.
- **API** : les résultats sont envoyés tels qu'ils sont stockés (gzip), sans décompression ni
  re-sérialisation, et mis en cache par le navigateur (immuables). Les données de référence et la
  vue d'ensemble sont sérialisées une seule fois. Compression gzip de toutes les réponses JSON de
  plus de 1 ko. Fichiers `/assets/*` servis avec `Cache-Control: immutable`.
- **Flux en direct incrémental** : `GET /live?since=<seq>` ne renvoie que les lignes postérieures
  au curseur. Les lignes sont libérées de la mémoire à la fin du calcul.
- **Interface** : KaTeX (formules) n'est chargé qu'à la première formule affichée. Le sondage du
  direct n'envoie jamais deux requêtes à la fois et ralentit à 3 s quand l'onglet est masqué.

### Nouveautés

- **Palette de commandes** (`Ctrl K` / `⌘ K`, ou « Rechercher… » dans la barre latérale) : aller
  à une page ou ouvrir une expérience par nom, identifiant, culture ou projet, sans accents ni
  casse, entièrement au clavier.
- **Indicateur d'activité** dans la barre latérale : les calculs en file ou en cours, avec
  progression et temps restant, depuis n'importe quelle page.
- **Temps écoulé et temps restant estimé** pendant un calcul. L'estimation est extrapolée du
  débit mesuré de l'exécution en cours (saisons terminées / temps écoulé), sans hypothèse.
- **Progression dans le titre de l'onglet**, avis de fin (toast) et, sur demande, une
  **notification système** quand le calcul se termine onglet masqué (« M'avertir à la fin »).
- **Archive de reproductibilité (.zip)** : protocole réimportable, résultats complets, CSV des
  métriques et des séries, et un `LISEZMOI.txt` avec versions, graines et empreintes SHA-256
  de chaque fichier. Disponible dans le tiroir d'une expérience et dans Publications.
- **Version de l'application** (`app_version`) affichée dans la barre latérale, renvoyée par
  `/api/health` et `/api/meta`, et enregistrée avec chaque nouvelle expérience.
- `GET /api/queue` : exécutions actives du serveur.
- `HEAD` accepté sur les pages de l'application (sondes de disponibilité des reverse proxies).

### Tests

- Backend : 52 tests (+6), dont le flux en direct incrémental sans trou, la file active, la
  compression et la mise en cache des résultats, l'archive (empreintes vérifiées et protocole
  réimporté) et l'abandon d'une saison d'une expérience annulée.
- Frontend : 83 tests (+9), dont la fusion du flux incrémental, le format des durées et le
  filtrage de la palette.

## Versions antérieures

Application initiale : moteur extrait du notebook, studio de simulation, suivi en direct,
comparaison, analyses du plan factoriel recalculé à 10 répétitions, polyandrie vs monandrie,
rapport imprimable, exports CSV/JSON, motion design. L'application n'avait pas encore de
numéro de version propre ; les expériences enregistrent `engine_version` 1.1.0.
