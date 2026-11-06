/**
 * Jeu d'icônes Modelly TIS Research — dessiné sur mesure.
 * Grille 24 × 24, trait `currentColor` arrondi, accents botaniques (feuilles, nervures).
 * API compatible avec les usages précédents : `size`, `strokeWidth`, `className`, `fill`.
 */
import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "fill"> {
  size?: number | string;
  strokeWidth?: number;
  /** Couleur de remplissage des formes « pleines » de l'icône (ex. lecture). */
  fill?: string;
}

function icon(name: string, draw: (fill: string | undefined) => ReactNode) {
  const C = ({ size = 24, strokeWidth = 1.5, className, fill, ...rest }: IconProps) => {
    const labelled = rest["aria-label"] != null;
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        className={className} aria-hidden={labelled ? undefined : true} role={labelled ? "img" : undefined}
        focusable="false" data-icon={name} {...rest}>
        {draw(fill)}
      </svg>
    );
  };
  C.displayName = name;
  return C;
}

/* Feuille réutilisable : base (x, y), longueur l, angle a (degrés) */
const leaf = (x: number, y: number, l: number, a: number, f?: string) => (
  <g transform={`translate(${x} ${y}) rotate(${a})`}>
    <path d={`M0 0C${l * 0.25} ${-l * 0.42} ${l * 0.75} ${-l * 0.42} ${l} 0C${l * 0.75} ${l * 0.42} ${l * 0.25} ${l * 0.42} 0 0Z`} fill={f ?? "none"} />
    <path d={`M${l * 0.12} 0H${l * 0.86}`} strokeWidth={0.9} />
  </g>
);

/* ---------------------------------------------------------------- navigation */
export const Home = icon("Home", () => (<>
  <path d="M3.5 11 12 4l8.5 7" />
  <path d="M5.5 9.6V19a1.2 1.2 0 0 0 1.2 1.2h10.6a1.2 1.2 0 0 0 1.2-1.2V9.6" />
  <path d="M12 20.2v-4.6" />
  <path d="M12 16.4c-2.3 0-3.6-1.4-3.6-3.6 2.2 0 3.6 1.3 3.6 3.6Z" />
  <path d="M12 15.6c0-2.1 1.3-3.4 3.4-3.4 0 2.1-1.3 3.4-3.4 3.4Z" />
</>));

export const FlaskConical = icon("FlaskConical", () => (<>
  <path d="M9 3.5h6" />
  <path d="M10.2 3.5v5.4L5.1 17.8a1.8 1.8 0 0 0 1.6 2.7h10.6a1.8 1.8 0 0 0 1.6-2.7l-5.1-8.9V3.5" />
  <path d="M7.2 14.2c1.6-.9 3.1-.9 4.8 0s3.2.9 4.8 0" />
  <circle cx="10.4" cy="17.4" r=".7" />
  <path d="M13.4 18.4c0-1.6 1-2.6 2.6-2.6 0 1.6-1 2.6-2.6 2.6Z" />
</>));

export const Play = icon("Play", (f) => (
  <path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L8.7 4.5a.8.8 0 0 0-1.2.7Z" fill={f ?? "none"} />
));

export const BarChart3 = icon("BarChart3", () => (<>
  <path d="M3.5 3.5v17h17" />
  <path d="M6.5 15.5c2.2-5.4 4.2-8 6.1-8s3.3 3.8 7.4 4.5" />
  <path d="M6.5 18c2.4-2.6 4.4-3.6 6.2-3.2 1.9.4 3.6 1.6 7.3.7" strokeDasharray="2 2.4" />
  <circle cx="12.6" cy="7.5" r="1" fill="currentColor" stroke="none" />
</>));

export const Layers = icon("Layers", () => (<>
  <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
  <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" strokeWidth={1} />
  <rect x="9.2" y="3.5" width="5.6" height="5.7" fill="currentColor" fillOpacity=".55" stroke="none" />
  <rect x="14.8" y="9.2" width="5.7" height="5.6" fill="currentColor" fillOpacity=".3" stroke="none" />
  <rect x="3.5" y="14.8" width="5.7" height="5.7" fill="currentColor" fillOpacity=".8" stroke="none" />
</>));

export const BookOpen = icon("BookOpen", () => (<>
  <path d="M12 6.6C10.2 5.2 7.6 4.6 3.5 4.8v13.4c4.1-.2 6.7.4 8.5 1.8 1.8-1.4 4.4-2 8.5-1.8V4.8c-4.1-.2-6.7.4-8.5 1.8Z" />
  <path d="M12 6.6V20" />
  <path d="M6 8.8h3.4M6 11.4h3.4" strokeWidth={1.1} />
  {leaf(14.4, 13.6, 4.6, -40)}
</>));

export const Menu = icon("Menu", () => (<path d="M4 7h16M4 12h16M4 17h10" />));
export const X = icon("X", () => (<path d="M6 6l12 12M18 6 6 18" />));

/* ---------------------------------------------------------------- actions */
export const Plus = icon("Plus", () => (<path d="M12 5v14M5 12h14" />));

export const Download = icon("Download", () => (<>
  <path d="M12 3.8v10.4" />
  <path d="m7.6 10 4.4 4.4 4.4-4.4" />
  <path d="M4.5 15.5v2.7a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-2.7" />
</>));

export const Upload = icon("Upload", () => (<>
  <path d="M12 14.6V4.2" />
  <path d="m7.6 8.4 4.4-4.4 4.4 4.4" />
  <path d="M4.5 15.5v2.7a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-2.7" />
</>));

export const Copy = icon("Copy", () => (<>
  <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.8" />
  <path d="M15.5 8.5V5.8A1.8 1.8 0 0 0 13.7 4H5.8A1.8 1.8 0 0 0 4 5.8v7.9a1.8 1.8 0 0 0 1.8 1.8h2.7" />
</>));

export const Save = icon("Save", () => (<>
  <path d="M5.8 4h10.1L20 8.1v10.1a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2V5.8A1.8 1.8 0 0 1 5.8 4Z" />
  <path d="M8 4v4.4h7V4" />
  <path d="M8 20v-5.6h8V20" />
</>));

export const Trash2 = icon("Trash2", () => (<>
  <path d="M4.5 6.5h15" />
  <path d="M9.5 6.5V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8v1.7" />
  <path d="m6.3 6.5.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5l.9-12.2" />
  <path d="M10.2 10.5v6M13.8 10.5v6" />
</>));

export const Search = icon("Search", () => (<>
  <circle cx="10.5" cy="10.5" r="6.5" />
  <path d="m15.4 15.4 4.6 4.6" />
  <path d="M8 12.8c0-2.6 1.6-4.4 4.6-4.6 0 2.8-1.8 4.6-4.6 4.6Z" strokeWidth={1.1} />
</>));

export const Printer = icon("Printer", () => (<>
  <path d="M7 8.5V4h10v4.5" />
  <rect x="3.5" y="8.5" width="17" height="8" rx="1.8" />
  <path d="M7 14h10v6H7z" />
  <circle cx="17" cy="11.4" r=".6" fill="currentColor" stroke="none" />
</>));

export const RotateCcw = icon("RotateCcw", () => (<>
  <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 8.9" />
  <path d="M4.5 4.6v4.3h4.3" />
</>));

export const RefreshCw = icon("RefreshCw", () => (<>
  <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9" />
  <path d="M4.5 12a7.5 7.5 0 0 1 13.2-4.9" />
  <path d="M17.9 3.6v3.6h-3.6M6.1 20.4v-3.6h3.6" />
</>));

export const Square = icon("Square", (f) => (<rect x="6" y="6" width="12" height="12" rx="1.6" fill={f ?? "none"} />));
export const Pause = icon("Pause", () => (<path d="M9 5.5v13M15 5.5v13" strokeWidth={2.2} />));
export const StepForward = icon("StepForward", () => (<><path d="M7 6.2v11.6L15.6 12Z" /><path d="M18 6v12" /></>));
export const StepBack = icon("StepBack", () => (<><path d="M17 6.2v11.6L8.4 12Z" /><path d="M6 6v12" /></>));
export const SkipForward = icon("SkipForward", () => (<><path d="M4.5 6.5v11L11 12Z" /><path d="M11.5 6.5v11L18 12Z" /><path d="M19.5 6v12" /></>));
export const SkipBack = icon("SkipBack", () => (<><path d="M19.5 6.5v11L13 12Z" /><path d="M12.5 6.5v11L6 12Z" /><path d="M4.5 6v12" /></>));

/* ---------------------------------------------------------------- documents */
export const FileText = icon("FileText", () => (<>
  <path d="M14 3.5H7.3a1.8 1.8 0 0 0-1.8 1.8v13.4a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V8Z" />
  <path d="M14 3.5V8h4.5" />
  <path d="M8.5 12h7M8.5 15h7M8.5 18h4" strokeWidth={1.1} />
</>));

export const FileJson = icon("FileJson", () => (<>
  <path d="M14 3.5H7.3a1.8 1.8 0 0 0-1.8 1.8v13.4a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V8Z" />
  <path d="M14 3.5V8h4.5" />
  <path d="M10.2 11.5c-1 0-1.2.6-1.2 1.4s-.4 1.1-1 1.1c.6 0 1 .3 1 1.1s.2 1.4 1.2 1.4M13.8 11.5c1 0 1.2.6 1.2 1.4s.4 1.1 1 1.1c-.6 0-1 .3-1 1.1s-.2 1.4-1.2 1.4" strokeWidth={1.1} />
</>));

/* ---------------------------------------------------------------- science */
export const CalendarDays = icon("CalendarDays", () => (<>
  <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
  <path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" />
  <circle cx="8" cy="13" r=".7" fill="currentColor" stroke="none" />
  <circle cx="12" cy="13" r=".7" fill="currentColor" stroke="none" />
  <circle cx="8" cy="16.6" r=".7" fill="currentColor" stroke="none" />
  <path d="M13.8 17.8c0-2.2 1.4-3.6 3.6-3.6 0 2.2-1.4 3.6-3.6 3.6Z" strokeWidth={1.1} />
</>));

export const Leaf = icon("Leaf", () => (<>
  <path d="M4.5 19.5C4 11.4 8.9 5 19.8 4.2c.7 10.6-5.8 15.6-15.3 15.3Z" />
  <path d="M4.5 19.5c3.6-4.4 7-7.6 11.4-11" />
  <path d="M9 14.8l-.4-3.6M11.6 12.4 11.4 9M9.4 15.2l3.4.3M12.3 12.6l3.3.1" strokeWidth={1} />
</>));

/** Pression d'invasion : effectifs croissants (barres + insecte stylisé). */
export const SignalMedium = icon("SignalMedium", () => (<>
  <path d="M5 19.5v-3.5M9.5 19.5V13M14 19.5v-9M18.5 19.5V7.5" strokeWidth={2} />
  <path d="M3.5 19.5h17" strokeWidth={1.1} />
</>));

/** Budget : tube de lâcher contenant des mâles stériles. */
export const Database = icon("Database", () => (<>
  <path d="M8 3.5h8" />
  <path d="M9 3.5v14.2a3 3 0 0 0 6 0V3.5" />
  <path d="M9 9h6" strokeWidth={1.1} />
  <ellipse cx="11.2" cy="12.4" rx=".9" ry=".55" fill="currentColor" stroke="none" />
  <ellipse cx="13" cy="15" rx=".9" ry=".55" fill="currentColor" stroke="none" />
  <ellipse cx="11.4" cy="17.4" rx=".9" ry=".55" fill="currentColor" stroke="none" />
</>));

/** Paramètres : roue en pétales (rosette botanique). */
export const Settings = icon("Settings", () => (<>
  {Array.from({ length: 8 }, (_, i) => (
    <path key={i} transform={`rotate(${i * 45} 12 12)`} d="M10.6 4.2c.3-1 2.5-1 2.8 0l.4 1.8c-1.2-.5-2.4-.5-3.6 0Z" />
  ))}
  <circle cx="12" cy="12" r="6" />
  <circle cx="12" cy="12" r="2.3" />
</>));

/** Larve de diptère, segmentée. */
export const Worm = icon("Worm", () => (<>
  <path d="M4.5 16a7.5 7.5 0 0 1 15 0 2 2 0 0 1-4 0 3.5 3.5 0 0 0-7 0 2 2 0 0 1-4 0Z" />
  <path d="M9.5 13.5 6.7 10.7M11.1 12.6l-1-3.8M12.9 12.6l1-3.8M14.5 13.5l2.8-2.8" strokeWidth={1} />
  <circle cx="17.5" cy="15.4" r=".6" fill="currentColor" stroke="none" />
</>));

/** Insecte ailé (vue dorsale), pour les piqûres stériles. */
export const Bug = icon("Bug", () => (<>
  <circle cx="12" cy="5.4" r="1.6" />
  <path d="M12 7.2c1.3 0 2 1.2 2 2.6s-.7 2.4-2 2.4-2-1-2-2.4.7-2.6 2-2.6Z" />
  <path d="M12 12.2c1.2 0 1.8 1.6 1.8 3.6S13.2 20 12 20s-1.8-2.2-1.8-4.2.6-3.6 1.8-3.6Z" />
  <path d="M12 14.4v0M10.4 15.6h3.2M10.5 17.6h3" strokeWidth={0.9} />
  <path d="M10 9.2C7 6.6 3.6 7 3.4 9.2c-.2 2.4 3.2 3.4 6.6 1.8M14 9.2c3-2.6 6.4-2.2 6.6 0 .2 2.4-3.2 3.4-6.6 1.8" />
  <path d="M10.2 11.6 7 14.4M13.8 11.6l3.2 2.8M10.4 13.2 8 17.4M13.6 13.2l2.4 4.2" strokeWidth={1} />
</>));

/* ---------------------------------------------------------------- états et interface */
export const Check = icon("Check", () => (<path d="m5 12.5 4.5 4.5L19 7.5" />));
export const ChevronDown = icon("ChevronDown", () => (<path d="m6.5 9.5 5.5 5.5 5.5-5.5" />));
export const ChevronUp = icon("ChevronUp", () => (<path d="m6.5 14.5 5.5-5.5 5.5 5.5" />));

export const CircleHelp = icon("CircleHelp", () => (<>
  <circle cx="12" cy="12" r="8.5" />
  <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" />
  <circle cx="12" cy="16.9" r=".7" fill="currentColor" stroke="none" />
</>));

export const Loader2 = icon("Loader2", () => (<path d="M20.5 12A8.5 8.5 0 1 1 12 3.5" />));

export const CheckCircle2 = icon("CheckCircle2", () => (<>
  <circle cx="12" cy="12" r="8.5" />
  <path d="m8.4 12.3 2.5 2.5 5-5.2" />
</>));

export const CircleX = icon("CircleX", () => (<>
  <circle cx="12" cy="12" r="8.5" />
  <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
</>));

export const AlertTriangle = icon("AlertTriangle", () => (<>
  <path d="M10.4 4.6 3.3 17.2A1.8 1.8 0 0 0 4.9 20h14.2a1.8 1.8 0 0 0 1.6-2.8L13.6 4.6a1.8 1.8 0 0 0-3.2 0Z" />
  <path d="M12 9.5v4.2" />
  <circle cx="12" cy="16.6" r=".7" fill="currentColor" stroke="none" />
</>));

/** Pousse (carte « Modélisation TIS »). */
export const Seedling = icon("Seedling", () => (<>
  <path d="M12 20.5V11" />
  <path d="M12 13c-4.2.2-6.6-2.2-6.6-6.4 4.2 0 6.6 2.4 6.6 6.4Z" />
  <path d="M12 11.4c0-3.6 2.2-5.8 6.2-5.8 0 3.8-2.2 5.8-6.2 5.8Z" />
  <path d="M8 20.5h8" />
</>));
