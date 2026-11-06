// Séries enregistrées par le DataCollector du notebook (+ dérivées calculées côté moteur)
export interface VarMeta { key: string; label: string; unit: string; group: "insectes" | "fruits" | "dérivées"; color: string; dash?: string }
export const VARIABLES: VarMeta[] = [
  { key: "Wild_males", label: "Mâles sauvages (W)", unit: "individus", group: "insectes", color: "#145A3D" },
  { key: "Females", label: "Femelles (F)", unit: "individus", group: "insectes", color: "#A83D36", dash: "7 3" },
  { key: "Sterile_males", label: "Mâles stériles (S)", unit: "individus", group: "insectes", color: "#547B91", dash: "2 3" },
  { key: "Larvae", label: "Larves (L)", unit: "individus", group: "insectes", color: "#BF532E", dash: "10 3 2 3" },
  { key: "Wild_adults", label: "Adultes sauvages (W + F)", unit: "individus", group: "dérivées", color: "#347A55" },
  { key: "Wild_adults_relative", label: "Population relative (W + F) / (W₀ + F₀)", unit: "sans dimension", group: "dérivées", color: "#347A55" },
  { key: "Wild_adults_vs_control", label: "Population relative au témoin (W + F) / témoin", unit: "sans dimension", group: "dérivées", color: "#145A3D" },
  { key: "SW_ratio", label: "Ratio S / max(1, W)", unit: "sans dimension", group: "dérivées", color: "#547B91" },
  { key: "Young_fruits", label: "Fruits jeunes", unit: "fruits", group: "fruits", color: "#547B91" },
  { key: "Harvestable_fruits", label: "Fruits récoltables", unit: "fruits", group: "fruits", color: "#347A55" },
  { key: "Rotten_natural", label: "Pourris (sénescence)", unit: "fruits", group: "fruits", color: "#8E9890", dash: "6 3" },
  { key: "Rotten_sterile_only", label: "Pourris piqûres stériles seules", unit: "fruits", group: "fruits", color: "#BF532E", dash: "2 3" },
  { key: "Rotten_larvae", label: "Pourris avec larves", unit: "fruits", group: "fruits", color: "#A83D36" },
  { key: "Harvested_cumul", label: "Récoltés (cumul)", unit: "fruits", group: "fruits", color: "#145A3D", dash: "8 3" },
  { key: "Rotten_cumul", label: "Pourris (cumul)", unit: "fruits", group: "fruits", color: "#8E3519", dash: "4 2" },
];
export const VAR = Object.fromEntries(VARIABLES.map((v) => [v.key, v]));

// Métriques de fin de saison (définitions : backend/tis_engine/runner.py)
export interface MetricMeta { key: string; label: string; unit: string; lowerIsBetter: boolean; digits: number; definition: string }
export const METRICS: MetricMeta[] = [
  { key: "larval_damage_pct", label: "Dommages larvaires", unit: "% des fruits", lowerIsBetter: true, digits: 2, definition: "Fruits avec ≥ 1 ponte fertile (récoltés + pourris + restés), en % des fruits produits." },
  { key: "sterile_puncture_share_pct", label: "Piqûres stériles", unit: "% des pontes", lowerIsBetter: false, digits: 1, definition: "Part des pontes stériles parmi toutes les pontes déposées." },
  { key: "harvested_clean_pct", label: "Récolte saine", unit: "% des fruits", lowerIsBetter: false, digits: 1, definition: "Fruits récoltés sans aucune piqûre." },
  { key: "rotten_pct", label: "Fruits pourris", unit: "% des fruits", lowerIsBetter: true, digits: 1, definition: "Fruits pourris (toutes causes) sur la saison." },
  { key: "rotten_larvae_pct", label: "Pourris avec larves", unit: "% des fruits", lowerIsBetter: true, digits: 1, definition: "Fruits pourris portant au moins une ponte fertile." },
  { key: "rotten_sterile_only_pct", label: "Pourris piqûres stériles seules", unit: "% des fruits", lowerIsBetter: true, digits: 1, definition: "Fruits pourris piqués uniquement par des pontes stériles (dommage collatéral)." },
  { key: "larvae_produced", label: "Larves produites", unit: "larves", lowerIsBetter: true, digits: 0, definition: "Nombre cumulé de larves nées pendant la saison." },
  { key: "remaining_pct", label: "Restés sur la plante", unit: "% des fruits", lowerIsBetter: false, digits: 1, definition: "Fruits ni récoltés ni pourris en fin de saison." },
  { key: "sterile_released", label: "Stériles lâchés", unit: "mâles", lowerIsBetter: false, digits: 0, definition: "Nombre total de mâles stériles effectivement lâchés." },
];
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m]));
