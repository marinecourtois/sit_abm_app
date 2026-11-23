# 05 — Frontend : structure, design system et modification

Stack : React 18, TypeScript, Vite, Tailwind CSS 4, composants accessibles Radix UI
(Select, Dialog, Tooltip, Collapsible), d3-scale / d3-shape pour les figures SVG, KaTeX pour
les formules, polices auto-hébergées (`@fontsource-variable` : Source Serif 4, Inter).

```bash
cd frontend
npm run dev      # http://localhost:5173 (API attendue sur 8765)
npm run build    # vérification TypeScript + build dans dist/
npm test         # tests Vitest (frontend/src/**/*.test.ts(x))
npm run typecheck  # application + tests
```

Les tests utilisent `src/test/fixtures/meta.json`, instantané du vrai registre du backend
(régénéré par `make fixtures`, vérifié par `backend/tests/test_frontend_contract.py`).

## Arborescence

```
frontend/src/
├── main.tsx                 routes (chargées à la demande, React.lazy), fournisseurs (méta, info-bulles, notifications)
├── index.css                jetons de couleur/typo (@theme), styles globaux, impression
├── lib/
│   ├── api.ts               client HTTP + types miroirs des contrats backend, mergeLive (flux incrémental)
│   ├── meta.tsx             contexte React du registre /api/meta
│   ├── useAsync.ts          chargement asynchrone simple
│   ├── format.ts            nombres, dates et durées (fmtDuration) au format français
│   ├── colors.ts            couleurs des cultures, stratégies et séries
│   ├── indicators.ts        indicateurs du plan factoriel : libellé, unité, définition exacte, calcul
│   ├── analysis.ts          jeu de données des analyses (référence ou expérience), planSize, scenarioLabel, paretoFront
│   └── variables.ts         libellés/unités des séries (VARIABLES) et indicateurs (METRICS)
├── components/
│   ├── layout.tsx           AppShell, ResearchSidebar, ActivityIndicator (useActiveRuns),
│   │                        StudyHeader, StudyTabs, raccourcis
│   ├── CommandPalette.tsx   palette Ctrl/⌘ K (chargée à la première ouverture), filterItems
│   ├── ui.tsx               Button, Select, Segmented, NumberField, ScientificTooltip, Tex (KaTeX à la demande),
│   │                        ExperimentStatus, Panel, Collapsible, EmptyState, Skeleton, Toast
│   ├── science.tsx          BotanicalSpeciesCard, ScientificProcessDiagram, ResearchMetric,
│   │                        UncertaintyLegend, ResearchAnnotation
│   ├── SimulationTimeline.tsx  SimulationTimeline (frise), ReleaseCalendar
│   ├── analysis/AnalysisSuite.tsx  heatmap, dose-réponse, Pareto, incertitude, polyandrie vs monandrie :
│   │                        page Analyses ET section « Analyses de l'expérience » d'une simulation
│   └── charts/
│       ├── TimeSeriesChart.tsx  courbes + bandes ± écart-type, curseur, zoom, annotations, événements
│       ├── ScatterChart.tsx     nuage de points, front de Pareto
│       ├── Heatmap.tsx          matrice colorée
│       ├── ChartExportMenu.tsx  menu d'export d'une figure
│       └── exportChart.ts       SVG, PNG, format publication, CSV
├── icons/index.tsx          jeu d'icônes SVG dessiné sur mesure (aucune bibliothèque d'icônes)
├── illustrations/           planches botaniques et entomologiques en SVG (React)
└── pages/                   une page par route
```

| Route | Page | Fichier |
|---|---|---|
| `/` | Vue d'ensemble | `pages/Overview.tsx` |
| `/experiences` | Expériences (+ tiroir `?id=`) | `pages/Experiments.tsx` |
| `/simulation` | Simulation Studio (`?from=<id>` pour partir d'une expérience) | `pages/Studio.tsx` |
| `/simulation/:id` | Simulation en direct | `pages/LiveSimulation.tsx` |
| `/comparaison` | Comparison Lab (`?exp=id1,id2`) | `pages/Comparison.tsx` |
| `/resultats` | Research Analytics | `pages/Analytics.tsx` |
| `/protocole` | Protocole scientifique | `pages/Protocol.tsx` |
| `/publications` | Rapport et exports (`?exp=<id>`) | `pages/Publications.tsx` |

## Design system « Scientific Botanical Editorial »

Les jetons sont définis dans `src/index.css` (`@theme`) et utilisables comme classes
Tailwind (`bg-ivory`, `text-forest`, `border-line`…).

| Jeton | Valeur | Usage |
|---|---|---|
| `ivory` | `#F8F7F2` | fond principal |
| `paper` | `#F0F2EB` | fond secondaire |
| `forest` | `#145A3D` | vert scientifique profond (boutons principaux) |
| `botanic` | `#347A55` | identité, onglet actif, série « fraise » |
| `sage` / `sage-soft` | `#DDEADF` / `#EEF4EE` | sélection, survol |
| `ink` | `#1B201C` | texte |
| `muted` | `#657068` | texte secondaire |
| `line` | `#D6DDD4` | bordures |
| `terracotta` | `#BF532E` | série « cerise », alertes |
| `cherry` | `#A83D36` | erreurs, valeurs cerise du tableau |
| `analytic` | `#547B91` | séries analytiques |

Typographie : `font-serif` (Source Serif 4) pour les titres et le texte éditorial,
`font-sans` (Inter) pour l'interface et les données ; `tnum` pour les chiffres tabulaires.

Règles :

- jamais la couleur seule pour distinguer des séries : chaque série a aussi un type de trait
  (`dash`) ou une forme de marqueur ;
- tout chiffre affiché indique son unité et son contexte (légende, info-bulle ou titre) ;
- états vides explicites (`EmptyState`), chargements en `Skeleton` ;
- interface exclusivement en français.

## Recettes

### Ajouter une page

1. Créer `src/pages/MaPage.tsx` : commencer par `<StudyHeader crumb=… title=… />`,
   éventuellement `<StudyTabs />`, puis des `<Panel>`.
2. Déclarer la route dans `src/main.tsx` avec `lazy(() => import("./pages/MaPage")…)`, sur le
   modèle des routes existantes (le découpage en bundles est configuré dans `vite.config.ts`).
3. Ajouter l'entrée de navigation dans `NAV` (`src/components/layout.tsx`), avec son
   raccourci `g <lettre>`.

### Appeler une nouvelle route de l'API

Ajouter la fonction et le type dans `src/lib/api.ts`, puis l'utiliser via
`useAsync(() => api.maRoute(), [deps])`. Les erreurs remontent en `Error` avec le message
français du backend ; les afficher avec `useToast()`.

### Tracer une nouvelle figure

```tsx
const ref = useRef<SVGSVGElement>(null);
<ChartExportMenu getSvg={() => ref.current} meta={{ title: "…", filename: "…", caption: "Moyenne ± écart-type…" }} />
<TimeSeriesChart ref={ref} series={[{ id, label, color, dash, x, y, sd }]}
  xLabel="Jour de saison" yLabel="Individus" ariaLabel="…" />
```

Propriétés utiles de `TimeSeriesChart` : `yScale="symlog"` (ratios), `errorBars` +
`showMarkers` (points discrets), `annotations`, `events`, `referenceLines`, `cursorX` /
`onCursor` (synchronisation avec une frise), `zoomable`.

### Afficher une nouvelle série ou un nouvel indicateur

Après l'avoir ajouté côté moteur (docs/03, §5.5–5.6), déclarer son libellé, son unité et sa
couleur dans `src/lib/variables.ts`. Les pages Live, Comparaison et Publications le
proposent alors automatiquement.

### Modifier le texte de l'interface

Les libellés scientifiques (paramètres, stratégies, cultures) viennent du backend
(`tis_engine/parameters.py`) : les modifier là-bas pour qu'ils restent cohérents partout.
Les autres textes sont directement dans les pages.

## Paramètres (Studio)

`pages/Studio.tsx` :

- `ParameterField` : libellé court (`label` du registre), symbole KaTeX, curseur avec **repère
  de la valeur du notebook**, champ numérique exact avec unité, plage admise, état « modifié »
  mis en évidence et bouton « Rétablir ».
- `ParameterGroups` : regroupe les paramètres par thème (`group`, ordre de `biology_groups`),
  avec un « Rétablir ce groupe ». En Mode Essentiel, seuls les paramètres `advanced: false`.
- `RematingSelector` : cartes des régimes avec leur formule ; polyandrie et monandrie (plan du
  notebook) en Mode Essentiel, les quatre régimes en Mode Avancé.

Libellés, groupes et formules viennent du backend : ne pas les écrire dans le frontend.

## Analyses : page de référence et page d'une simulation

Les graphiques d'analyse sont **un seul composant**, `components/analysis/AnalysisSuite.tsx`,
alimenté par un `AnalysisDataset` (`lib/analysis.ts`) : une ligne par saison aux colonnes du CSV
du plan factoriel du notebook (`Crop, Invasion, Budget, Remating, Strategy, Replicate` +
métriques).

- Page **Analyses** (`/resultats`) : `datasetFromReference` sur le plan factoriel de référence.
- Page d'une **simulation** (`/simulation/:id`, section `#analyses`, bouton « Analyses ») :
  `datasetFromResults` sur les répétitions de l'expérience (valeurs de `metrics[k].values`, sans
  recalcul). À côté de l'incertitude : l'effet apparié vs témoin de chaque stratégie.

Chaque graphique n'utilise que les dimensions présentes. Une dimension à une seule valeur est
indiquée (« Fixés dans ce plan ») et le graphique qui en a besoin dit ce qui manque, avec un lien
« Dupliquer en plan » (`/simulation?from=<id>&plan=1`). Pour tout voir dans une expérience, le
Studio propose la section **Plan d'expérience** (plusieurs budgets, invasions, régimes ; bouton
« Plan du notebook (3 × 3 × 2) »).

## Indicateurs de la page Analyses

`lib/indicators.ts` définit chaque indicateur du plan factoriel avec un **nom précis** et une
**définition qui précise le dénominateur** (« en % des fruits produits pendant la saison »).
Les écarts entre pourcentages s'affichent en « points de % » (`diffUnit`). La définition de
l'indicateur choisi est affichée sous les filtres.

## Motion design

Principes : mouvement organique et discret, jamais sur les valeurs (aucun nombre animé, aucun
« compteur »), uniquement `transform` et `opacity`, arrêt complet avec
`prefers-reduced-motion: reduce` et à l'impression, boucles mises en pause quand l'onglet est
masqué (classe `is-hidden` posée sur `<html>` par `layout.tsx`).

| Classe (`index.css`) | Où | Effet |
|---|---|---|
| `m-sway` + `sway(x, y, amplitude, période, phase)` (`illustrations/motion.ts`) | feuilles, fleur, fraises, grappe de cerises, rameau de la barre latérale | balancement depuis un point d'attache |
| `m-buzz`, `m-buzz-near` | ailes des mouches (schéma TIS) | battement rapide |
| `m-hover`, `m-hover-b` | mouches | vol stationnaire |
| `m-mist`, `m-flight` | paysage de la barre latérale | brume qui dérive, insecte qui traverse |
| `m-nudge` | flèche « ⟶ Pas de descendance » | impulsion |
| `m-route` ; `.panel` (animation `m-rise`) | pages, panneaux | entrée en fondu / montée décalée |
| tracé des courbes (`TimeSeriesChart`) | graphiques | dessin de gauche à droite au premier affichage ; bandes et annotations ensuite |
| `m-cell`, `m-pop` | heatmap, nuages de points, répétitions | apparition en cascade (une fois) |
| `m-pulse`, `m-shimmer` | badge « Flux en direct », barre de progression (page Live) | activité du calcul |
| indicateur de navigation, curseur du `Segmented` | barre latérale, contrôles | glissement vers l'élément actif |

Ajouter un mouvement : réutiliser une de ces classes ; pour un élément SVG, préciser
`transform-box` / `transform-origin` ; vérifier le rendu en temps réel (les captures headless
avec `--virtual-time-budget` n'avancent pas les animations de `transform`) ; ajouter la
classe à la liste `.is-hidden …` si elle boucle.

## Mise en page et responsive

- Contenu centré, largeur maximale ~1640 px, marges latérales constantes (`AppShell` dans
  `layout.tsx`) : rien ne s'étire bord à bord sur les grands écrans.
- La vue d'ensemble reproduit la maquette à 1672 × 941 (tout visible sans défilement) ; sur
  un écran plus haut, la rangée du graphique s'agrandit.
- Points de rupture Tailwind : `md` (tablette), `lg` (barre latérale fixe), `xl` (colonnes de
  la maquette). Sous `lg`, la navigation passe dans un menu.
- `ScientificProcessDiagram` s'adapte à son conteneur (une rangée ou deux) ; variante `bare`
  sans cadre pour les panneaux latéraux.
- Règle globale `.grid > * { min-width: 0 }` : les graphiques et tableaux se rétrécissent au
  lieu de déborder ; les tableaux larges défilent horizontalement (`.scroll-x`).

## Performance du chargement

- Chaque page est un fragment chargé à la demande (`React.lazy` dans `main.tsx`) ; React, Radix et
  d3 sont des fragments partagés (`manualChunks` de `vite.config.ts`).
- **KaTeX n'est jamais chargé à l'ouverture** : `Tex` (`ui.tsx`) importe `katex` et sa feuille de
  style à la première formule affichée (`loadKatex`), et montre la source LaTeX en attendant.
  N'importez pas `katex` directement ailleurs : vous le remettriez dans le fragment initial.
- La palette de commandes est elle aussi chargée à sa première ouverture.
- Vérifier après un build : `grep -o 'modulepreload[^>]*' dist/index.html` ne doit lister que
  `react` et `radix`.

## Suivi des calculs

| Élément | Fichier | Fonctionnement |
|---|---|---|
| Flux en direct | `pages/LiveSimulation.tsx` | Sondage toutes les 450 ms, une requête à la fois, 3 s quand l'onglet est masqué. Envoie `since=<seq>` et fusionne avec `mergeLive` : seules les nouvelles lignes transitent |
| Temps écoulé / restant | idem | `elapsed_s`, `eta_s` de `/live` (débit mesuré de l'exécution) ; jamais d'estimation inventée avant la première saison terminée |
| Titre de l'onglet | idem | `42 % · TIS-XXXX — Modelly TIS` pendant le calcul ; rétabli à la fin et en quittant la page |
| Avis de fin | idem | Toast au changement de statut ; notification système si l'utilisateur l'a demandée (« M'avertir à la fin ») et que l'onglet est masqué |
| Indicateur d'activité | `components/layout.tsx` | `useActiveRuns` interroge `/api/queue` toutes les 2 s s'il y a des calculs, 8 s sinon, jamais onglet masqué ; réveillé immédiatement par l'évènement `tis:run-started` (émis par `api.create/run/duplicate`) |

## Palette de commandes

`Ctrl K` / `⌘ K` (y compris depuis un champ de saisie) ou le bouton « Rechercher… » de la barre
latérale (évènement `tis:palette`). Elle liste les pages et toutes les expériences (chargées à
l'ouverture) ; `filterItems` exige que chaque mot de la requête apparaisse dans le libellé,
l'indication (identifiant, statut) ou les mots-clés, sans accents ni casse. Pour ajouter une
entrée fixe, compléter `PAGES` dans `CommandPalette.tsx`.

## Icônes

Toutes les icônes sont dessinées sur mesure dans `src/icons/index.tsx` (aucune dépendance
externe). Règles du jeu :

- grille 24 × 24, trait `currentColor` de 1,5 px, extrémités et angles arrondis ;
- accents botaniques discrets (feuilles, nervures) sur les icônes de navigation et de domaine
  (accueil, expériences, publications, calendrier, paramètres en rosette, tube de lâcher,
  larve, insecte ailé) ;
- propriétés : `size`, `strokeWidth`, `className`, `fill` (formes pleines, ex. `Play`),
  `aria-label` (sinon l'icône est décorative, `aria-hidden`).

Ajouter une icône :

```tsx
export const MonIcone = icon("MonIcone", () => (<>
  <path d="M4 12h16" />
</>));
```

puis `import { MonIcone } from "../icons"`. Vérifier le rendu à 16, 24 et 36 px.

## Accessibilité

- Navigation clavier complète ; focus visible ; lien d'évitement « Aller au contenu ».
- Graphiques : `role="img"` + `aria-label`, focusables ; flèches ←/→ pour parcourir les
  jours, `Début`/`Fin`, `Échap` pour réinitialiser.
- Info-bulles Radix accessibles au clavier ; notifications dans une région `aria-live`.
- Respect de `prefers-reduced-motion`.

## Impression et PDF

La page Publications utilise l'impression du navigateur. Les éléments marqués `no-print`
(barre latérale, menus, boutons) sont masqués ; le format est A4 avec marges de 16 mm
(`@media print` dans `index.css`).
