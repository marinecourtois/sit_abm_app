# 05 — Frontend : structure, design system et modification

Stack : React 18, TypeScript, Vite, Tailwind CSS 4, composants accessibles Radix UI
(Select, Dialog, Tooltip, Collapsible), d3-scale / d3-shape pour les figures SVG, KaTeX pour
les formules, polices auto-hébergées (`@fontsource-variable` : Source Serif 4, Inter).

```bash
cd frontend
npm run dev      # http://localhost:5173 (API attendue sur 8765)
npm run build    # vérification TypeScript + build dans dist/
```

## Arborescence

```
frontend/src/
├── main.tsx                 routes (chargées à la demande, React.lazy), fournisseurs (méta, info-bulles, notifications)
├── index.css                jetons de couleur/typo (@theme), styles globaux, impression
├── lib/
│   ├── api.ts               client HTTP + types miroirs des contrats backend
│   ├── meta.tsx             contexte React du registre /api/meta
│   ├── useAsync.ts          chargement asynchrone simple
│   ├── format.ts            nombres et dates au format français
│   ├── colors.ts            couleurs des cultures, stratégies et séries
│   └── variables.ts         libellés/unités des séries (VARIABLES) et indicateurs (METRICS)
├── components/
│   ├── layout.tsx           AppShell, ResearchSidebar, StudyHeader, StudyTabs, raccourcis
│   ├── ui.tsx               Button, Select, Segmented, NumberField, ScientificTooltip, Tex,
│   │                        ExperimentStatus, Panel, Collapsible, EmptyState, Skeleton, Toast
│   ├── science.tsx          BotanicalSpeciesCard, ScientificProcessDiagram, ResearchMetric,
│   │                        UncertaintyLegend, ResearchAnnotation
│   ├── SimulationTimeline.tsx  SimulationTimeline (frise), ReleaseCalendar
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
