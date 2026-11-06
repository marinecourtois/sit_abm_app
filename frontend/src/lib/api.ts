// Contrats de données — miroir de backend/app/schemas.py et jobs.build_results
export type CropKey = "strawberry" | "cherry";
export type StrategyKey = "no_tis" | "daily" | "every_3" | "every_7" | "front_70" | "front_100" | "periodic" | "front_loaded";
export type Status = "ready" | "queued" | "running" | "completed" | "cancelled" | "error";

export interface StrategySpec { key: StrategyKey; interval?: number; first_day?: number; initial_fraction?: number; maintenance_interval?: number; label?: string }
export interface ExperimentConfig {
  crops: CropKey[]; strategies: StrategySpec[];
  invasion: { preset?: string | null; wild: number; females: number };
  budget: number; remating: string; replicates: number; seed: number; include_control: boolean;
  biology: Record<string, number>;
}
export interface Experiment {
  id: string; short_id: string; name: string; project: string; description: string;
  config: ExperimentConfig; config_hash: string; status: Status; progress: number;
  engine_version: string; params_version: string; schema_version: number; seed: number;
  created_at: string; started_at?: string; finished_at?: string; error?: string | null;
  parent_id?: string | null; tags: string[]; duration_s?: number | null; has_results: boolean;
}
export interface Stat { mean: number; sd: number; min: number; max: number; n: number; values: number[] }
export interface Band { mean: number[]; sd: number[] }
export interface ScenarioEvent { type: string; day: number; label: string }
export interface Scenario {
  key: string; crop: CropKey; strategy: StrategySpec; strategy_key: StrategyKey; strategy_label: string;
  is_control: boolean; budget: number; schedule: Record<string, number>; seeds: number[];
  metrics: Record<string, Stat>; series: Record<string, Band> & { Time: number[] };
  events: ScenarioEvent[];
  vs_control?: Record<string, { mean: number; sd: number; n: number; values: number[] } | null>;
}
export interface Results { experiment_id: string; schema_version: number; series_vars: string[]; scenarios: Scenario[]; computed_at: string; duration_s: number }
export interface BiologyParam { name: string; symbol: string; unit: string; default: number; min: number; max: number; step: number; source: string; description: string; advanced: boolean }
export interface Meta {
  engine_version: string; params_version: string; schema_version: number;
  crops: Record<CropKey, { label: string; latin: string; summary: string; params: Record<string, number | string> }>;
  strategies: Record<string, { label: string; short: string; nb: string; description: string }>;
  remating: Record<string, { label: string; description: string }>;
  invasions: Record<string, { label: string; wild: number; females: number }>;
  budget_presets: number[]; biology: BiologyParam[]; biology_defaults: Record<string, number>;
  fixed_constants: { name: string; symbol: string; value: string; unit: string; source: string }[];
  limits: Record<string, [number, number]>;
  versions: Record<string, string | number>; workers: number;
}
export interface Validation { ok: boolean; errors: string[]; warnings: string[]; scenarios: { crop: CropKey; strategy: string; strategy_key: StrategyKey; release_days: number; total_released: number; season_length: number; schedule: Record<string, number> }[]; estimate: { seasons: number; seconds: number; basis: string } }
export interface LiveState { status: Status; progress: number; done?: number; total?: number; live: Record<string, { day: number; rows: Record<string, number>[] }>; log: { t: string; msg: string }[]; plan: { key: string; crop: CropKey; strategy_label: string; is_control: boolean; budget: number }[] }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : (j.detail?.errors?.join(" · ") ?? JSON.stringify(j.detail)); } catch { /* */ }
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  meta: () => req<Meta>("/api/meta"),
  overview: () => req<{ experiment: Experiment | null; results: Results | null }>("/api/overview"),
  experiments: (q = "") => req<Experiment[]>(`/api/experiments${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  experiment: (id: string) => req<Experiment>(`/api/experiments/${id}`),
  results: (id: string) => req<Results>(`/api/experiments/${id}/results`),
  live: (id: string) => req<LiveState>(`/api/experiments/${id}/live`),
  validate: (cfg: ExperimentConfig) => req<Validation>("/api/validate", { method: "POST", body: JSON.stringify(cfg) }),
  create: (body: { name: string; project?: string; description?: string; config: ExperimentConfig; run?: boolean; parent_id?: string }) =>
    req<Experiment>("/api/experiments", { method: "POST", body: JSON.stringify(body) }),
  run: (id: string) => req<Experiment>(`/api/experiments/${id}/run`, { method: "POST" }),
  cancel: (id: string) => req<{ ok: boolean }>(`/api/experiments/${id}/cancel`, { method: "POST" }),
  duplicate: (id: string, body: object = {}) => req<Experiment>(`/api/experiments/${id}/duplicate`, { method: "POST", body: JSON.stringify(body) }),
  remove: (id: string) => req<{ ok: boolean }>(`/api/experiments/${id}`, { method: "DELETE" }),
  patch: (id: string, body: object) => req<Experiment>(`/api/experiments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  importProtocol: (doc: object) => req<Experiment>("/api/protocol/import", { method: "POST", body: JSON.stringify(doc) }),
  reference: <T = Record<string, number | string>>(which: "factorial" | "dynamics") =>
    req<{ source: string; sha256: string; description: string; verified: string; rows: T[] }>(`/api/reference/${which}`),
  exportUrl: (id: string, format: "json" | "csv-metrics" | "csv-series" | "protocol") => `/api/experiments/${id}/export?format=${format}`,
};
