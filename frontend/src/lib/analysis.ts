// Jeu de données commun aux graphiques d'analyse (heatmap, dose-réponse, Pareto, incertitude,
// polyandrie vs monandrie) : une ligne par saison simulée, aux colonnes du CSV du plan factoriel
// du notebook. Deux sources : le plan factoriel de référence (page Analyses) et les répétitions
// d'une expérience de l'application (page Simulation).
import type { Experiment, ExperimentConfig, Invasion, Meta, Results, Scenario } from "./api";
import { CROP_LABEL, fmtInt } from "./format";
import type { Row } from "./indicators";
import { SERIES_PALETTE, STRATEGY_COLOR, STRATEGY_ORDER } from "./colors";

/** Métrique du moteur → colonne du CSV du notebook (même table que backend/scripts/factorial.py). */
export const METRIC_COLUMN: Record<string, string> = {
  harvested_clean_pct: "Harvested - clean (%)", harvested_sterile_only_pct: "Harvested - sterile only (%)",
  harvested_larvae_pct: "Harvested - larvae (%)", harvested_pct: "Harvested (%)", rotten_pct: "Rotten (%)",
  rotten_larvae_pct: "Rotten - larvae (%)", rotten_sterile_only_pct: "Rotten - sterile only (%)",
  rotten_clean_pct: "Rotten - clean (%)", larvae_produced: "Larvae produced",
  remaining_pct: "Remaining on plant (%)", remaining_clean_pct: "Remaining - clean (%)",
  remaining_sterile_only_pct: "Remaining - sterile only (%)", remaining_larvae_pct: "Remaining - larvae (%)",
};

export interface AnalysisStrategy { id: string; label: string; short: string; color: string; control: boolean }
export interface AnalysisDataset {
  /** Colonnes : Crop, Invasion, Budget, Remating, Strategy (= AnalysisStrategy.id), Replicate + colonnes de METRIC_COLUMN. */
  rows: Row[];
  strategies: AnalysisStrategy[];     // témoin d'abord, puis l'ordre de l'étude
  crops: string[]; invasions: string[]; budgets: number[]; regimes: string[];
  nRep: number;
}

const invasionCount = (label: string) => parseInt(label.split("(")[1] ?? "0", 10) || 0;

/** « Moyenne (300 W : 300 F) » : même libellé que le CSV du notebook, trié par effectif. */
export function invasionLabel(inv: { preset?: string | null; wild: number; females: number }, meta: Meta | null): string {
  const p = inv.preset ? meta?.invasions[inv.preset] : undefined;
  if (p && p.wild === inv.wild && p.females === inv.females) return p.label;
  return `Personnalisée (${inv.wild} W : ${inv.females} F)`;
}

function dimensions(rows: Row[]) {
  const uniq = <T,>(f: (r: Row) => T) => Array.from(new Set(rows.map(f)));
  return {
    crops: ["strawberry", "cherry"].filter((c) => rows.some((r) => r.Crop === c)),
    invasions: uniq((r) => String(r.Invasion)).sort((a, b) => invasionCount(a) - invasionCount(b) || a.localeCompare(b)),
    budgets: uniq((r) => Number(r.Budget)).sort((a, b) => a - b),
    regimes: ["preference", "first", "last", "mixed"].filter((g) => rows.some((r) => r.Remating === g)),
    nRep: uniq((r) => r.Replicate).length,
  };
}

/** Plan factoriel de référence (CSV du notebook ou recalcul de l'application). */
export function datasetFromReference(raw: Row[], meta: Meta | null): AnalysisDataset {
  const nb = (meta as unknown as { strategy_nb_names?: Record<string, string> } | null)?.strategy_nb_names ?? {};
  const nb2key = Object.fromEntries(Object.entries(nb).map(([k, v]) => [v, k]));
  const rows = raw.map((r) => ({ ...r, Strategy: nb2key[String(r.Strategy)] ?? String(r.Strategy) }));
  const present = new Set(rows.map((r) => String(r.Strategy)));
  const strategies = STRATEGY_ORDER.filter((k) => present.has(k)).map((k) => ({
    id: k, label: meta?.strategies[k]?.label ?? k, short: meta?.strategies[k]?.short ?? k, color: STRATEGY_COLOR[k], control: k === "no_tis",
  }));
  return { rows, strategies, ...dimensions(rows) };
}

/** Identifiant de stratégie d'un scénario (clé moteur + paramètres modifiés). */
export const scenarioStrategyId = (s: Scenario) => s.strategy_id ?? s.key.split("::").pop() ?? s.strategy_key;

/** Répétitions d'une expérience de l'application, une ligne par saison. */
export function datasetFromResults(res: Results, exp: Experiment, meta: Meta | null): AnalysisDataset {
  const rows: Row[] = [];
  const strategies: AnalysisStrategy[] = [];
  const used = new Set<string>();
  for (const s of res.scenarios) {
    const id = scenarioStrategyId(s);
    if (!strategies.some((x) => x.id === id)) {
      const plain = s.strategy_key in STRATEGY_COLOR && id === s.strategy_key;
      let color = STRATEGY_COLOR[s.strategy_key] ?? SERIES_PALETTE[strategies.length % SERIES_PALETTE.length];
      if (used.has(color)) color = SERIES_PALETTE.find((c) => !used.has(c)) ?? color;
      used.add(color);
      strategies.push({ id, label: s.strategy_label, short: plain ? meta?.strategies[s.strategy_key]?.short ?? s.strategy_label : s.strategy_label, color, control: s.is_control });
    }
    const inv = invasionLabel(s.invasion ?? exp.config.invasion, meta);
    const remating = s.remating ?? exp.config.remating;
    const n = s.seeds.length;
    for (let i = 0; i < n; i++) {
      const r: Row = { Crop: s.crop, Invasion: inv, Budget: s.budget, Remating: remating, Strategy: id, Replicate: i, Seed: s.seeds[i] };
      for (const [k, col] of Object.entries(METRIC_COLUMN)) if (s.metrics[k]) r[col] = s.metrics[k].values[i];
      rows.push(r);
    }
  }
  strategies.sort((a, b) => Number(b.control) - Number(a.control));
  return { rows, strategies, ...dimensions(rows) };
}

/** Points non dominés (minimisation des deux axes), ordonnés par x. */
export function paretoFront<P extends { id: string; x: number; y: number }>(p: P[]): string[] {
  const nd = p.filter((a) => !p.some((b) => b !== a && b.x <= a.x && b.y <= a.y && (b.x < a.x || b.y < a.y)));
  return nd.sort((a, b) => a.x - b.x).map((d) => d.id);
}

/** Dimensions du plan d'une configuration : listes (plan, 1.7.0) ou valeur unique. */
export function planSize(cfg: ExperimentConfig) {
  return {
    budgets: cfg.budgets?.length ? cfg.budgets : [cfg.budget],
    invasions: cfg.invasions?.length ? cfg.invasions : [cfg.invasion],
    rematings: cfg.rematings?.length ? cfg.rematings : [cfg.remating],
  };
}

/** « Fraise · J+3 », complété par l'invasion, le budget et le régime quand le plan les fait varier. */
export function scenarioLabel(
  p: { crop: string; strategy_label: string; is_control: boolean; budget: number; invasion?: Invasion; remating?: string },
  cfg: ExperimentConfig, meta: Meta | null,
): string {
  const d = planSize(cfg);
  const parts = [CROP_LABEL[p.crop] ?? p.crop, p.strategy_label];
  if (d.invasions.length > 1 && p.invasion) parts.push(`invasion ${invasionLabel(p.invasion, meta).split(" (")[0].toLowerCase()}`);
  if (d.budgets.length > 1 && !p.is_control) parts.push(`${fmtInt(p.budget)} stériles`);
  if (d.rematings.length > 1 && p.remating) parts.push(meta?.remating[p.remating]?.short ?? p.remating);
  return parts.join(" · ");
}
