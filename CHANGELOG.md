# Journal des versions

Format : une section par version de l'application (`APP_VERSION`, `backend/app/__init__.py`).
Les versions du moteur (`ENGINE_VERSION`), des paramètres et du schéma sont indépendantes et
enregistrées avec chaque expérience (voir docs/03 § 4).

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
