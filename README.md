# Modelly TIS Research

**Version 1.8.0** · [journal des versions](CHANGELOG.md)

Application web scientifique pour **simuler, comparer et documenter des stratégies de
Technique de l'Insecte Stérile (TIS)** sur deux systèmes agricoles : la fraise
(*Fragaria × ananassa*) et la cerise (*Prunus avium*).

Le moteur de calcul est le modèle individu-centré (agent-based) du notebook
`Notebook_ABM_TIS_Optimise_Modelly.ipynb`, extrait en module Python **sans modification des
équations** et vérifié par des tests de non-régression qui reproduisent les sorties du
notebook à l'égalité binaire.

> Cette documentation (README et dossier `docs/`) est destinée aux développeurs et aux
> chercheurs qui maintiennent l'application. Elle n'est **pas** publiée sur le site :
> le serveur ne sert que `frontend/dist/` et les routes `/api/*`.

---

## Démarrage rapide

Prérequis : Python ≥ 3.12, [uv](https://docs.astral.sh/uv/), Node.js ≥ 20.

```bash
make install   # crée backend/.venv (modelly-abm, FastAPI…) et installe les dépendances npm
make serve     # construit le frontend puis lance l'application sur http://localhost:8765
```

Au premier démarrage, l'API lance automatiquement l'**étude de référence** affichée sur la
vue d'ensemble (2 cultures × 5 stratégies + témoin, invasion Moyenne, 9 000 stériles,
10 répétitions, graine 42). Le calcul dure quelques secondes ; la page se met à jour seule.

**Minimum de l'étude : 10 répétitions par scénario** (`MIN_REPLICATES`, `backend/tis_engine/parameters.py`) ;
le Studio en propose **20** par défaut (`DEFAULT_REPLICATES`).
La page Analyses utilise le plan factoriel du notebook recalculé à 20 répétitions (`make factorial`,
`REPS=20` par défaut) ; les 576 saisons déjà calculées par le notebook y sont identiques au bit près.

| Commande | Effet |
|---|---|
| `make install` | Installation complète (backend + frontend) |
| `make serve` | Build du frontend + serveur unique sur le port 8765 |
| `make dev` | Développement : API avec rechargement (8765) + Vite (5173, proxy `/api`) |
| `make build` | Build du frontend seul (`frontend/dist/`) |
| `make test-smart` | Uniquement les tests affectés par vos modifications ([SmartTest](https://github.com/RemiPelloux/SmarttyTest)) |
| `make test-all` | Tous les tests (pytest + Vitest) via SmartTest, rapport HTML |
| `make test` | Tous les tests, directement (pytest puis Vitest) |

Arrêter le serveur : `Ctrl+C`, ou `pkill -f "uvicorn app.main:app"` s'il tourne en arrière-plan.

---

## Ce que fait l'application

| Espace | Rôle |
|---|---|
| **Vue d'ensemble** | Synthèse de l'étude : cultures, principe de la TIS, dynamique des populations, dommages larvaires, piqûres stériles, tableau des stratégies. Lancement rapide d'une simulation. |
| **Expériences** | Liste, recherche, filtres, regroupement par projet, métadonnées de reproductibilité, duplication, exports, **archive de reproductibilité (.zip)**, import de protocole, suppression. |
| **Simulation** | *Studio* : configuration en Mode Essentiel ou Avancé, **plan d'expérience** (plusieurs budgets, invasions et régimes croisés dans une même expérience) (paramètres groupés par thème, curseurs avec repère de la valeur du notebook, régime de réaccouplement avec sa formule), validation scientifique, durée estimée à partir des exécutions mesurées, aperçu des calendriers de lâchers. *Live* : suivi en direct, temps écoulé et restant (débit mesuré), progression dans le titre de l'onglet, notification de fin, frise chronologique, calendrier, événements, annulation. **Analyses de l'expérience** : les graphiques de la page Analyses (heatmap, dose-réponse, Pareto, incertitude, polyandrie vs monandrie) calculés sur ses propres répétitions, et l'effet apparié vs témoin. |
| **Comparaison** | 2 à 4 scénarios : courbes superposées ou séparées, normalisation explicite, axes synchronisés, incertitude, tableau ordonné selon un critère choisi. |
| **Résultats** | Plan factoriel du notebook recalculé à 20 répétitions : **synthèse décisionnelle** (stratégie en tête par culture et régime, écart au témoin), **fraise vs cerise**, heatmaps, dose-réponse, front de Pareto, distribution des répétitions, **polyandrie vs monandrie** ; chaque indicateur affiche sa définition exacte. |
| **Publications** | Rapport scientifique structuré (12 sections) imprimable en PDF, exports CSV/JSON. |
| **Protocole** | Hypothèses, paramètres, équations (KaTeX), méthodologie, limites, références. |
| *Partout* | **Palette de commandes** (`Ctrl K` / `⌘ K`) pour ouvrir une page ou une expérience ; **indicateur d'activité** des calculs en cours dans la barre latérale ; version de l'application et du moteur. |

---

## Organisation du dépôt

```
.
├── README.md                 ← ce fichier
├── Makefile
├── docs/                     ← documentation technique détaillée (non publiée)
├── backend/
│   ├── tis_engine/           ← moteur scientifique (aucune dépendance web)
│   ├── app/                  ← API FastAPI, file d'exécution, stockage
│   ├── data/reference/       ← CSV produits par le notebook (références de validation)
│   ├── data/app.db           ← base SQLite des expériences (créée au démarrage)
│   ├── data/results/         ← résultats JSON compressés (un fichier par expérience, servis tels quels)
│   └── tests/                ← non-régression scientifique + tests de l'API
└── frontend/
    └── src/                  ← React + TypeScript + Tailwind, figures SVG
```

## Documentation détaillée

| Document | Contenu |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | Vue d'ensemble technique, flux de données, choix de conception |
| [docs/02-installation-exploitation.md](docs/02-installation-exploitation.md) | Installation, configuration, déploiement, sauvegarde, dépannage |
| [docs/03-moteur-scientifique.md](docs/03-moteur-scientifique.md) | Le modèle, et **comment modifier le backend** : paramètre, stratégie, culture, indicateur |
| [docs/04-api.md](docs/04-api.md) | Référence complète de l'API REST et des contrats de données |
| [docs/05-frontend.md](docs/05-frontend.md) | Structure du frontend, design system, composants, ajout d'une page ou d'un graphique |
| [docs/06-tests-validation.md](docs/06-tests-validation.md) | Stratégie de tests, non-régression, procédure de mise à jour du notebook |
| [docs/07-reproductibilite-donnees.md](docs/07-reproductibilite-donnees.md) | Graines, immuabilité, métadonnées, formats d'export |

## Performance

La version 1.6.0 accélère l'application sans changer un seul nombre (détail et mesures dans
[CHANGELOG.md](CHANGELOG.md)) :

- moteur 11 à 21 % plus rapide par saison (APP 6, docs/03), tests de non-régression au bit près ;
- flux en direct et annulation quasi gratuits pour les processus de calcul, saisons longues
  ordonnancées en premier ;
- résultats servis compressés et mis en cache, données de référence sérialisées une seule fois ;
- flux en direct incrémental, KaTeX chargé à la demande (−43 % de JavaScript à l'ouverture).

## Branches

`main` est la branche par défaut et contient tout le travail ; développez sur une branche
dédiée puis fusionnez dans `main` après `make test-all` vert.

## Principes non négociables

1. **Aucun résultat inventé.** Tout chiffre affiché provient d'une simulation exécutée par le
   moteur, ou des fichiers de résultats du notebook, présentés comme tels.
2. **Fidélité au notebook.** Toute modification du moteur doit laisser passer
   `tests/test_regression.py` (sinon, c'est un changement de modèle : voir docs/06).
3. **Traçabilité.** Chaque exécution enregistre sa configuration complète, ses graines et les
   versions du moteur, des paramètres et du schéma de données.
4. **Pas de statistique artificielle.** Aucune p-value, aucun intervalle de confiance ni
   « meilleure stratégie » sans critère explicite.

Raccourcis clavier : `Ctrl K` / `⌘ K` palette de commandes · `n` nouvelle simulation · `g` puis `o`/`e`/`s`/`c`/`r`/`p` pour naviguer ·
flèches ←/→ sur un graphique pour parcourir les jours · `Échap` pour réinitialiser le zoom.
