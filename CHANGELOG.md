# Journal des versions

Format : une section par version de l'application (`APP_VERSION`, `backend/app/__init__.py`).
Les versions du moteur (`ENGINE_VERSION`), des paramètres et du schéma sont indépendantes et
enregistrées avec chaque expérience (voir docs/03 § 4).

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
