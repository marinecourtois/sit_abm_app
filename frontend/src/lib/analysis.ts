// Jeu de données commun aux graphiques d'analyse (heatmap, dose-réponse, Pareto, incertitude,
// polyandrie vs monandrie) : une ligne par saison simulée, aux colonnes du CSV du plan factoriel
// du notebook. Deux sources : le plan factoriel de référence (page Analyses) et les répétitions
// d'une expérience de l'application (page Simulation).
import type { CropKey, Counts, Experiment, ExperimentConfig, Invasion, Meta, Results, Scenario } from "./api";
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
  /** « sans » et/ou « avec » immigration (comparaison 1.11.0). Les lignes portent la colonne Immigration. */
  immigrations: string[];
  nRep: number;
}

/** Ordre d'affichage des inoculums : par effectif, l'inoculum fort calé sur le pic du témoin en dernier. */
const invasionCount = (label: string) => (label.includes("pic du témoin") ? Number.MAX_SAFE_INTEGER : parseInt(label.split("(")[1] ?? "0", 10) || 0);

/** Nom court d'un inoculum : « Modéré », ou les effectifs pour un inoculum personnalisé. */
export const invasionShort = (label: string) => (/^Personnalisée? \(/.test(label) ? label.replace(/^Personnalisée? \(/, "").replace(")", "")
  : /^Fort \(\d/.test(label) ? `Fort ${label.split(" (")[1].replace(")", "")}` : label.split(" (")[0]);

/** Libellé de l'inoculum de départ : « Modéré (300 W : 300 F) », « Fort (pic du témoin) »… */
export function invasionLabel(inv: { preset?: string | null; wild: number; females: number; by_crop?: Record<string, Counts> | null }, meta: Meta | null): string {
  const p = inv.preset ? meta?.invasions[inv.preset] : undefined;
  if (p) {
    if (p.by_crop && (inv.by_crop || Object.values(p.by_crop).some((c) => c.wild === inv.wild && c.females === inv.females))) return p.label;
    if (p.wild === inv.wild && p.females === inv.females && !inv.by_crop) return p.by_crop ? `${p.label.split(" (")[0]} (${inv.wild} W : ${inv.females} F)` : p.label;
  }
  return `Personnalisé (${inv.wild} W : ${inv.females} F)`;
}

/** Effectifs de l'inoculum pour une culture (inoculum fort : propres à la culture). */
export const invasionFor = (inv: Invasion, crop: string): Counts => inv.by_crop?.[crop] ?? { wild: inv.wild, females: inv.females };

function dimensions(rows: Row[]) {
  const uniq = <T,>(f: (r: Row) => T) => Array.from(new Set(rows.map(f)));
  return {
    crops: ["strawberry", "cherry"].filter((c) => rows.some((r) => r.Crop === c)),
    invasions: uniq((r) => String(r.Invasion)).sort((a, b) => invasionCount(a) - invasionCount(b) || a.localeCompare(b)),
    budgets: uniq((r) => Number(r.Budget)).sort((a, b) => a - b),
    regimes: ["preference", "first", "last", "mixed"].filter((g) => rows.some((r) => r.Remating === g)),
    immigrations: ["sans", "avec"].filter((m) => rows.some((r) => (r.Immigration ?? "sans") === m)),
    nRep: uniq((r) => r.Replicate).length,
  };
}

/** Plan factoriel de référence (CSV du notebook ou recalcul de l'application). */
export function datasetFromReference(raw: Row[], meta: Meta | null): AnalysisDataset {
  const nb = (meta as unknown as { strategy_nb_names?: Record<string, string> } | null)?.strategy_nb_names ?? {};
  const nb2key = Object.fromEntries(Object.entries(nb).map(([k, v]) => [v, k]));
  // Noms du notebook (« Moyenne (300 W : 300 F) ») → noms de l'application (« Modéré (300 W : 300 F) »), mêmes effectifs
  const invName = Object.fromEntries(Object.values(meta?.invasions ?? {}).filter((p) => p.nb_label)
    .map((p) => [p.nb_label!, `${p.label.split(" (")[0]} (${p.nb_label!.split(" (")[1]}`]));
  const rows = raw.map((r) => ({ ...r, Strategy: nb2key[String(r.Strategy)] ?? String(r.Strategy), Invasion: invName[String(r.Invasion)] ?? String(r.Invasion) }));
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
      // La condition « avec / sans » n'est une dimension que dans une comparaison : sinon l'immigration
      // propre à une culture séparerait les cultures entre « avec » et « sans ».
      if (exp.config.immigration_compare) r.Immigration = s.immigration ? "avec" : "sans";
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
  p: { crop: string; strategy_label: string; is_control: boolean; budget: number; invasion?: Invasion; remating?: string; immigration?: Counts | null },
  cfg: ExperimentConfig, meta: Meta | null,
): string {
  const d = planSize(cfg);
  const parts = [CROP_LABEL[p.crop] ?? p.crop, p.strategy_label];
  if (d.invasions.length > 1 && p.invasion) parts.push(`inoculum ${invasionShort(invasionLabel(p.invasion, meta)).toLowerCase()}`);
  if (d.budgets.length > 1 && !p.is_control) parts.push(`${fmtInt(p.budget)} stériles`);
  if (d.rematings.length > 1 && p.remating) parts.push(meta?.remating[p.remating]?.short ?? p.remating);
  if (cfg.immigration_compare) parts.push(p.immigration ? "avec immigration" : "sans immigration");
  return parts.join(" · ");
}

/* ---------------------------------------------------------------- Synthèse décisionnelle
 * Réponses descriptives aux deux questions de l'étude, calculées sur les données affichées :
 * la stratégie en tête diffère-t-elle entre fraise et cerise ? dépend-elle du régime de
 * réaccouplement ? Aucun test statistique : un écart est dit « net » s'il dépasse la somme des
 * écarts-types des deux stratégies comparées, sinon il est signalé comme inférieur à la
 * variabilité entre répétitions. */
export interface Ranked { strategy: AnalysisStrategy; mean: number; sd: number; n: number; budget: number }
export interface SynthesisCell {
  crop: string; remating: string;
  ranking: Ranked[];               // stratégies traitées au budget choisi, la meilleure d'abord
  control: { mean: number; sd: number; n: number } | null;
  clear: boolean;                  // écart 1er − 2e supérieur à sd₁ + sd₂
  gain: number | null;             // meilleure − témoin, dans l'unité de l'indicateur
  bestAnyBudget: Ranked | null;    // meilleure combinaison stratégie × budget, tous budgets du plan
}
export interface Synthesis { cells: SynthesisCell[]; byCrop: string | null; byRegime: string | null }

const mstat = (v: number[]) => {
  const n = v.length, m = v.reduce((a, b) => a + b, 0) / (n || 1);
  return { mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0, n };
};

export function synthesize(data: AnalysisDataset, value: (r: Row) => number, higherIsBetter: boolean, invasion: string, budget: number,
  label: (crop: string) => string, regimeLabel: (r: string) => string): Synthesis {
  const better = (a: Ranked, b: Ranked) => (higherIsBetter ? b.mean - a.mean : a.mean - b.mean);
  const cells: SynthesisCell[] = [];
  for (const crop of data.crops) for (const remating of data.regimes) {
    const rows = data.rows.filter((r) => r.Crop === crop && r.Remating === remating && r.Invasion === invasion);
    if (!rows.length) continue;
    const at = (s: AnalysisStrategy, b: number): Ranked | null => {
      const v = rows.filter((r) => r.Strategy === s.id && Number(r.Budget) === b).map(value);
      return v.length ? { strategy: s, budget: b, ...mstat(v) } : null;
    };
    const treated = data.strategies.filter((s) => !s.control);
    const ranking = treated.map((s) => at(s, budget)).filter((x): x is Ranked => !!x).sort(better);
    const ctrlS = data.strategies.find((s) => s.control);
    const cv = ctrlS ? rows.filter((r) => r.Strategy === ctrlS.id).map(value) : [];
    const control = cv.length ? mstat(cv) : null;
    const all = treated.flatMap((s) => data.budgets.filter((b) => b > 0).map((b) => at(s, b))).filter((x): x is Ranked => !!x).sort(better);
    const [a, b] = ranking;
    cells.push({ crop, remating, ranking, control, clear: !!a && (!b || Math.abs(a.mean - b.mean) > a.sd + b.sd),
      gain: a && control ? a.mean - control.mean : null, bestAnyBudget: all[0] ?? null });
  }
  const lead = (c?: SynthesisCell) => c?.ranking[0]?.strategy;
  const main = data.regimes.includes("preference") ? "preference" : data.regimes[0];
  let byCrop: string | null = null;
  if (data.crops.length > 1) {
    const cs = data.crops.map((crop) => cells.find((c) => c.crop === crop && c.remating === main));
    if (cs.every((c) => lead(c))) {
      const same = cs.every((c) => lead(c)!.id === lead(cs[0])!.id);
      const unclear = cs.some((c) => !c!.clear);
      byCrop = (same ? `Même stratégie en tête pour ${data.crops.map(label).join(" et ")} : ${lead(cs[0])!.label}.`
        : `Stratégie en tête différente : ${cs.map((c) => `${label(c!.crop)} → ${lead(c)!.label}`).join(" ; ")}.`)
        + (unclear ? " Attention : pour au moins une culture, l’écart entre les deux premières stratégies est inférieur à la variabilité entre répétitions." : "");
    }
  }
  let byRegime: string | null = null;
  if (data.regimes.includes("preference") && data.regimes.includes("first")) {
    const parts = data.crops.map((crop) => {
      const p = cells.find((c) => c.crop === crop && c.remating === "preference"), f = cells.find((c) => c.crop === crop && c.remating === "first");
      if (!lead(p) || !lead(f)) return null;
      return lead(p)!.id === lead(f)!.id
        ? `${label(crop)} : même stratégie en tête (${lead(p)!.label}) en ${regimeLabel("preference").toLowerCase()} et en ${regimeLabel("first").toLowerCase()}`
        : `${label(crop)} : ${lead(p)!.label} en ${regimeLabel("preference").toLowerCase()}, ${lead(f)!.label} en ${regimeLabel("first").toLowerCase()}`;
    }).filter(Boolean);
    if (parts.length) byRegime = parts.join(" ; ") + ".";
  }
  return { cells, byCrop, byRegime };
}

/** Extensions hors notebook actives dans des paramètres biologiques (miroir de parameters.active_extensions). */
/** « tous les jours », « tous les 3 jours ». */
export const everyText = (n?: number) => (!n || n <= 1 ? "tous les jours" : `tous les ${n} jours`);

/** Immigration d'une expérience, en clair ; null si la parcelle est fermée. Fait partie du modèle
 *  (et du notebook) depuis la 1.11.0, désactivée par défaut. */
export function immigrationSummary(cfg: ExperimentConfig): string | null {
  const imm = Object.entries(cfg.immigration ?? {}).filter(([crop, c]) => (c.wild || c.females) && cfg.crops.includes(crop as CropKey));
  const bio = cfg.biology ?? {};
  const text = imm.length
    ? imm.map(([crop, c]) => `${CROP_LABEL[crop] ?? crop} : ${c.wild} mâles sauvages et ${c.females} femelles fécondées ${everyText(c.every)} (dès J${Math.max(1, c.every ?? 1)})`).join(" ; ")
    : (bio.immigration_wild_males ?? 0) || (bio.immigration_females ?? 0)
      ? `${bio.immigration_wild_males ?? 0} mâles sauvages et ${bio.immigration_females ?? 0} femelles fécondées ${everyText(bio.immigration_every)} (dès J${Math.max(1, bio.immigration_every ?? 1)})` : null;
  return text && cfg.immigration_compare ? `${text} (comparée à sans immigration)` : text;
}

/** Extensions hors notebook actives (capacité de charge, stade « tournant ») ; l'immigration n'en fait plus partie. */
export function activeExtensions(bio: Record<string, number> | undefined, immigration?: Record<string, Counts> | null, crops?: string[]): string[] {
  if (!bio) return [];
  const on: string[] = [];
  void immigration; void crops;
  if (bio.carrying_capacity ?? 0) on.push(`capacité de charge K_a = ${bio.carrying_capacity}`);
  if (bio.turning_days ?? 0) on.push(`stade « tournant » (${bio.turning_days} j, p_t = ${bio.turning_puncture_probability})`);
  return on;
}

/** Inoculum d'un préréglage : l'inoculum fort porte les effectifs propres à chaque culture. */
export function presetInvasion(meta: Meta, key: string): Invasion {
  const p = meta.invasions[key];
  return { preset: key, wild: p.wild, females: p.females, ...(p.by_crop ? { by_crop: p.by_crop } : {}) };
}

/** Clé d'identité d'un inoculum (préréglage par culture ou effectifs). */
export const invasionKey = (i: Invasion) => (i.by_crop ? `${i.preset ?? ""}:par-culture` : `${i.wild}:${i.females}`);

/** Effectifs d'un inoculum, en clair : par culture pour l'inoculum fort. */
export function invasionCounts(inv: Invasion, crops: string[], fmt: (n: number) => string = String): string {
  if (!inv.by_crop) return `${fmt(inv.wild)} W : ${fmt(inv.females)} F`;
  return crops.map((c) => { const n = invasionFor(inv, c); return `${CROP_LABEL[c] ?? c} ${fmt(n.wild)} W : ${fmt(n.females)} F`; }).join(", ");
}

/** Configuration chargée (duplication, import) : l'immigration globale d'avant la 1.10.0 devient
 *  l'immigration par culture équivalente, et l'inoculum garde ses effectifs réels. */
export function normalizeLoadedConfig(cfg: ExperimentConfig, defaults: Record<string, number>): ExperimentConfig {
  const biology = { ...defaults, ...cfg.biology };
  const w = biology.immigration_wild_males ?? 0, f = biology.immigration_females ?? 0;
  if ((w || f) && !cfg.immigration) {
    return { ...cfg, biology: { ...biology, immigration_wild_males: 0, immigration_females: 0 },
      immigration: Object.fromEntries(cfg.crops.map((c) => [c, { wild: w, females: f }])) };
  }
  return { ...cfg, biology };
}

/** Même cellule : culture, inoculum, régime et présence d'immigration (le témoin apparié en dépend). */
export function sameCell(a: Scenario, b: Scenario): boolean {
  return a.crop === b.crop && a.remating === b.remating && !!a.immigration === !!b.immigration
    && (a.invasion?.wild ?? -1) === (b.invasion?.wild ?? -1) && (a.invasion?.females ?? -1) === (b.invasion?.females ?? -1);
}
