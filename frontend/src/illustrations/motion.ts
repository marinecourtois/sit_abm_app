import type { CSSProperties } from "react";

/**
 * Style d'un balancement ambiant (classe CSS `m-sway`, voir index.css).
 * (x, y) : point d'attache dans le repère utilisateur du parent ; amp : amplitude en degrés ;
 * t : période en secondes ; delay : décalage de phase (négatif = déjà en mouvement au chargement).
 */
export function sway(x: number, y: number, amp = 1.6, t = 9, delay = 0): CSSProperties {
  return {
    transformOrigin: `${x}px ${y}px`,
    animationDelay: `${-Math.abs(delay)}s`,
    ["--sway-a" as string]: `${-amp}deg`,
    ["--sway-b" as string]: `${amp}deg`,
    ["--sway-t" as string]: `${t}s`,
  } as CSSProperties;
}
