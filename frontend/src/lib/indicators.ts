// Indicateurs du plan factoriel (colonnes du CSV produit par le notebook / scripts/factorial.py).
// Chaque indicateur porte une définition exacte : ce qui est compté, et par rapport à quoi.
export type Row = Record<string, string | number>;

export interface Indicator {
  key: string;
  label: string;          // nom précis, affiché partout
  unit: string;           // unité courte pour les axes
  definition: string;     // phrase complète : quoi, quand, rapporté à quoi
  palette: "green" | "terracotta" | "blue";
  higherIsBetter: boolean;
  value: (r: Row) => number;
}

const num = (r: Row, c: string) => Number(r[c]);

export const INDICATORS: Indicator[] = [
  { key: "harvested_clean_pct", label: "Fruits récoltés sains", unit: "% des fruits produits", palette: "green", higherIsBetter: true,
    definition: "Fruits cueillis lors des récoltes sans aucune piqûre (ni ponte fertile ni ponte stérile), en % de tous les fruits produits pendant la saison.",
    value: (r) => num(r, "Harvested - clean (%)") },
  { key: "larval_damage_pct", label: "Fruits infestés par des larves", unit: "% des fruits produits", palette: "terracotta", higherIsBetter: false,
    definition: "Fruits ayant reçu au moins une ponte fertile, quel que soit leur devenir (récoltés, pourris ou restés sur la plante), en % des fruits produits.",
    value: (r) => num(r, "Harvested - larvae (%)") + num(r, "Rotten - larvae (%)") + num(r, "Remaining - larvae (%)") },
  { key: "rotten_pct", label: "Fruits pourris (toutes causes)", unit: "% des fruits produits", palette: "terracotta", higherIsBetter: false,
    definition: "Fruits pourris pendant la saison, quelle qu'en soit la cause (sénescence naturelle, piqûres stériles ou larves), en % des fruits produits.",
    value: (r) => num(r, "Rotten (%)") },
  { key: "rotten_larvae_pct", label: "Fruits pourris avec larves", unit: "% des fruits produits", palette: "terracotta", higherIsBetter: false,
    definition: "Fruits pourris portant au moins une ponte fertile, en % des fruits produits.",
    value: (r) => num(r, "Rotten - larvae (%)") },
  { key: "rotten_sterile_only_pct", label: "Fruits pourris après piqûres stériles seules", unit: "% des fruits produits", palette: "blue", higherIsBetter: false,
    definition: "Fruits pourris piqués uniquement par des pontes stériles (aucune larve) : dommage collatéral de la TIS, en % des fruits produits.",
    value: (r) => num(r, "Rotten - sterile only (%)") },
  { key: "larvae_produced", label: "Larves produites", unit: "larves (nombre)", palette: "terracotta", higherIsBetter: false,
    definition: "Nombre total de larves nées pendant la saison sur la parcelle simulée.",
    value: (r) => num(r, "Larvae produced") },
];
export const INDICATOR = Object.fromEntries(INDICATORS.map((i) => [i.key, i]));

/** Unité d'un écart entre deux valeurs de l'indicateur. */
export const diffUnit = (i: Indicator) => (i.unit.startsWith("%") ? "points de %" : i.unit);

export const stats = (v: number[]) => {
  const n = v.length, m = v.reduce((a, b) => a + b, 0) / (n || 1);
  return { mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0, n, values: v };
};
