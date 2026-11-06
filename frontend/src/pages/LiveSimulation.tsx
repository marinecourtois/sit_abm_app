import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BarChart3, Copy, Play, RefreshCw, Square } from "../icons";
import { api, type Experiment, type LiveState, type Results } from "../lib/api";
import { useMeta } from "../lib/meta";
import { CROP_LABEL, fmt, fmtDate, fmtInt } from "../lib/format";
import { VAR, VARIABLES } from "../lib/variables";
import { STRATEGY_COLOR } from "../lib/colors";
import { StudyHeader } from "../components/layout";
import { Badge, Button, EmptyState, ExperimentStatus, Panel, PanelTitle, Select, useToast } from "../components/ui";
import { ResearchAnnotation, ScientificProcessDiagram, UncertaintyLegend } from "../components/science";
import { TimeSeriesChart, type ChartSeries } from "../components/charts/TimeSeriesChart";
import { ChartExportMenu } from "../components/charts/ChartExportMenu";
import { ReleaseCalendar, SimulationTimeline } from "../components/SimulationTimeline";
import { downloadText, toCsv } from "../components/charts/exportChart";

const DEFAULT_VARS = ["Wild_males", "Females", "Sterile_males", "Larvae"];
const GROUPS = [{ key: "insectes", label: "Insectes" }, { key: "fruits", label: "Fruits" }, { key: "dérivées", label: "Dérivées" }] as const;
const EV_LABEL: Record<string, string> = { release: "Intervention", harvest_start: "Récolte", harvest_end: "Récolte", peak: "Pic", larvae_peak: "Pic", threshold: "Seuil", threshold_down: "Seuil" };

export function LiveSimulation() {
  const { id = "" } = useParams();
  const meta = useMeta();
  const nav = useNavigate();
  const toast = useToast();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [res, setRes] = useState<Results | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scen, setScen] = useState<string>("");
  const [vars, setVars] = useState<string[]>(DEFAULT_VARS);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("insectes");
  const [day, setDay] = useState(0);
  const [follow, setFollow] = useState(true);
  const chartRef = useRef<SVGSVGElement>(null);

  const refresh = useCallback(async () => {
    try {
      const e = await api.experiment(id); setExp(e);
      if (e.status === "completed" && !res) { const r = await api.results(id); setRes(r); }
      if (e.status !== "ready") setLive(await api.live(id));
    } catch (x) { setErr((x as Error).message); }
  }, [id, res]);
  useEffect(() => { setRes(null); setLive(null); setScen(""); refresh(); }, [id]);
  useEffect(() => {
    if (!exp || !["queued", "running"].includes(exp.status)) return;
    const t = setInterval(refresh, 450);
    return () => clearInterval(t);
  }, [exp?.status, refresh]);

  const plan = res?.scenarios ?? live?.plan ?? [];
  useEffect(() => { if (!scen && plan.length) setScen((plan.find((p) => !p.is_control) ?? plan[0]).key); }, [plan.length]);
  const sc = res?.scenarios.find((s) => s.key === scen);
  const planItem = plan.find((p) => p.key === scen);
  const crop = planItem?.crop ?? exp?.config.crops[0] ?? "strawberry";
  const L = Number(meta?.crops[crop]?.params.season_length ?? 100);
  const liveRows = live?.live[scen]?.rows ?? [];
  const liveDay = live?.live[scen]?.day ?? 0;
  const available = sc ? L : liveDay;
  useEffect(() => { if (follow && !sc) setDay(liveDay); }, [liveDay, follow, sc]);
  useEffect(() => { if (sc && follow) setDay(L); }, [sc]);

  const chartSeries: ChartSeries[] = useMemo(() => vars.filter((v) => (sc ? !!sc.series[v] : v !== "Wild_adults_vs_control")).map((v) => {
    const m = VAR[v];
    if (sc) return { id: v, label: m.label, color: m.color, dash: m.dash, x: sc.series.Time, y: sc.series[v].mean, sd: sc.series[v].sd };
    // en direct : répétition 1, valeurs brutes reçues jour par jour (pas de moyenne)
    const init = initialRow(exp, Number(meta?.crops[crop]?.params.initial_fruits ?? 0));
    const rows = [init, ...liveRows];
    const val = (r: Record<string, number>) => v === "Wild_adults" ? r.Wild_males + r.Females : v === "SW_ratio" ? r.Sterile_males / Math.max(1, r.Wild_males)
      : v === "Wild_adults_relative" ? (r.Wild_males + r.Females) / Math.max(1, init.Wild_males + init.Females) : r[v];
    return { id: v, label: m.label, color: m.color, dash: m.dash, x: rows.map((_, i) => i), y: rows.map(val) };
  }), [vars, sc, liveRows.length, exp, crop, meta]);

  const units = Array.from(new Set(vars.map((v) => VAR[v].unit)));
  const ratioOnly = vars.length > 0 && vars.every((v) => v === "SW_ratio");
  const status = exp?.status;
  const schedule = sc?.schedule ?? {};

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok, "success"); refresh(); } catch (e) { toast((e as Error).message, "error"); } };

  if (err) return <EmptyState title="Expérience introuvable">{err}<div className="mt-3"><Link className="text-forest underline" to="/experiences">Retour aux expériences</Link></div></EmptyState>;
  if (!exp || !meta) return <div className="skeleton mt-6 h-[520px]" />;

  const atDay = (v: string) => { const s = chartSeries.find((c) => c.id === v); if (!s) return null; const i = s.x.indexOf(day); return i < 0 ? null : { v: s.y[i], sd: s.sd?.[i] }; };

  return (
    <>
      <StudyHeader crumb={`Simulation / ${exp.short_id}`} title={exp.name}
        subtitle={<span className="text-[16px] sm:text-[18px]">{exp.config.crops.map((c) => CROP_LABEL[c]).join(" · ")} — {fmtInt(exp.config.budget)} stériles · {exp.config.replicates} répétitions · graine {exp.config.seed}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExperimentStatus status={exp.status} progress={live?.progress ?? exp.progress} />
            {status === "ready" && <Button variant="primary" icon={<Play size={15} fill="currentColor" />} onClick={() => act(() => api.run(id), "Simulation lancée.")}>Lancer</Button>}
            {(status === "running" || status === "queued") && <Button variant="danger" icon={<Square size={14} />} onClick={() => act(() => api.cancel(id), "Annulation demandée.")}>Interrompre</Button>}
            {(status === "cancelled" || status === "error") && <Button variant="primary" icon={<RefreshCw size={15} />} onClick={async () => { const e = await api.run(id); toast(`Nouvelle exécution ${e.short_id}.`, "success"); nav(`/simulation/${e.id}`); }}>Relancer (nouvelle exécution)</Button>}
            {status === "completed" && <>
              <Button icon={<Copy size={15} />} onClick={() => nav(`/simulation?from=${id}`)}>Dupliquer et modifier</Button>
              <Button variant="primary" icon={<BarChart3 size={15} />} onClick={() => nav(`/comparaison?exp=${id}`)}>Comparer</Button>
            </>}
          </div>
        } />

      {/* barre de progression */}
      {(status === "running" || status === "queued") && (
        <div className="mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((live?.progress ?? 0) * 100)} aria-label="Progression du calcul">
          <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-botanic transition-[width] duration-300" style={{ width: `${(live?.progress ?? 0) * 100}%` }} /></div>
          <div className="mt-1 text-[12px] text-muted tnum">{live?.done ?? 0} / {live?.total ?? "…"} saisons terminées</div>
        </div>
      )}
      {status === "error" && <div className="mt-4"><ResearchAnnotation tone="warning"><strong>Simulation en erreur.</strong> {exp.error}</ResearchAnnotation></div>}
      {status === "cancelled" && <div className="mt-4"><ResearchAnnotation tone="warning"><strong>Simulation interrompue.</strong> {exp.error} — aucun résultat partiel n’est enregistré. Une relance crée une nouvelle exécution identifiable.</ResearchAnnotation></div>}
      {status === "ready" && <div className="mt-4"><ResearchAnnotation>Simulation prête : la configuration est enregistrée ({exp.short_id}) et peut être lancée.</ResearchAnnotation></div>}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="min-w-0 px-5 pb-4 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-[21px] font-semibold">Évolution temporelle des populations</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                {sc ? <UncertaintyLegend n={exp.config.replicates} /> : <Badge tone="blue">Flux en direct · répétition 1, valeurs brutes</Badge>}
                <span>Unités : {units.join(" · ") || "—"}</span>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="w-full sm:w-64"><Select label="Scénario" value={scen} onChange={(v) => { setScen(v); setFollow(true); }}
                options={plan.map((p) => ({ value: p.key, label: `${CROP_LABEL[p.crop]} · ${p.strategy_label}` }))} /></div>
              <ChartExportMenu getSvg={() => chartRef.current}
                meta={{ title: `${planItem ? `${CROP_LABEL[planItem.crop]} — ${planItem.strategy_label}` : ""}`, filename: `${exp.short_id}-dynamique`,
                  caption: `${sc ? `Moyenne ± écart-type, ${exp.config.replicates} répétitions` : "Répétition 1 (calcul en cours)"}. Invasion ${exp.config.invasion.wild} W : ${exp.config.invasion.females} F, budget ${exp.config.budget} stériles, régime ${exp.config.remating}, graine ${exp.config.seed}. ${exp.short_id}, moteur ${exp.engine_version}.` }}
                onCsv={() => downloadText(toCsv([["jour", ...chartSeries.flatMap((s) => [s.id + "_moyenne", s.id + "_ecart_type"])], ...chartSeries[0]?.x.map((t, i) => [t, ...chartSeries.flatMap((s) => [s.y[i], s.sd?.[i] ?? ""])]) ?? []]), `${exp.short_id}-series.csv`)} />
            </div>
          </div>
          <fieldset className="mt-3 rounded-md border border-line bg-[#F8F9F5] px-3 py-2.5">
            <legend className="sr-only">Variables affichées</legend>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div role="tablist" aria-label="Groupe de variables" className="inline-flex rounded-[5px] border border-line bg-white p-[2px]">
                {GROUPS.map((g) => {
                  const n = vars.filter((v) => VAR[v]?.group === g.key).length;
                  return (
                    <button key={g.key} type="button" role="tab" aria-selected={group === g.key} onClick={() => setGroup(g.key)}
                      className={`rounded-[4px] px-2.5 py-1 text-[12.5px] ${group === g.key ? "bg-botanic text-white" : "text-ink hover:bg-sage-soft"}`}>
                      {g.label}{n > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-[10.5px] tnum ${group === g.key ? "bg-white/25" : "bg-sage text-forest"}`}>{n}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex min-w-0 basis-full flex-wrap gap-1.5 sm:basis-0 sm:flex-1" role="tabpanel">
                {VARIABLES.filter((v) => v.group === group).map((v) => {
                  const on = vars.includes(v.key);
                  return (
                    <button key={v.key} type="button" aria-pressed={on} onClick={() => setVars(on ? vars.filter((x) => x !== v.key) : [...vars, v.key])}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] ${on ? "border-ink/40 bg-white text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)]" : "border-line bg-transparent text-muted hover:border-ink/30 hover:text-ink"}`}>
                      <svg width="16" height="6" aria-hidden><line x1="0" x2="16" y1="3" y2="3" stroke={on ? v.color : "#B9C2B8"} strokeWidth="2.5" strokeDasharray={v.dash} /></svg>{v.label}
                    </button>
                  );
                })}
              </div>
              {vars.join() !== DEFAULT_VARS.join() && <button type="button" onClick={() => { setVars(DEFAULT_VARS); setGroup("insectes"); }} className="text-[12px] text-muted underline underline-offset-2 hover:text-ink">Réinitialiser</button>}
            </div>
          </fieldset>
          {units.length > 1 && <p className="mt-2 text-[11.5px] text-terracotta">Attention : variables d’unités différentes ({units.join(", ")}) sur un même axe. Sélectionnez des variables de même unité pour une lecture quantitative.</p>}
          <div className="mt-2">
            {chartSeries.length && chartSeries[0].x.length > 0 ? (
              <TimeSeriesChart ref={chartRef} series={chartSeries} height={360} xLabel="Jour de saison" yLabel={units.length === 1 ? cap(units[0]) : "Valeur"}
                xDomain={[0, L]} cursorX={day} onCursor={(x) => { if (x != null) { setDay(x); setFollow(false); } }}
                yScale={ratioOnly ? "symlog" : "linear"} referenceLines={ratioOnly ? [{ y: 1, label: "Parité S/W = 1" }] : undefined}
                events={sc?.events.filter((e) => e.type !== "peak" && e.type !== "larvae_peak").map((e) => ({ x: e.day, label: EV_LABEL[e.type] ?? "" }))}
                ariaLabel="Évolution temporelle des variables sélectionnées" uncertaintyLabel={sc ? `± écart-type, ${exp.config.replicates} répétitions` : "Répétition 1, valeur brute"} />
            ) : <div className="flex h-[340px] items-center justify-center text-[13px] text-muted">{status === "ready" ? "Lancez la simulation pour voir les dynamiques." : "En attente des premiers jours simulés…"}</div>}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <SimulationTimeline max={L} value={Math.min(day, L)} available={available} onChange={(d) => { setDay(d); setFollow(d >= available); }} events={sc?.events} />
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between text-[12.5px]"><span className="font-medium">Calendrier des lâchers</span><span className="text-muted tnum">{Object.keys(schedule).length ? `${Object.keys(schedule).length} lâchers · ${fmtInt(Object.values(schedule).reduce((a, b) => a + b, 0))} stériles` : planItem?.is_control ? "témoin : aucun lâcher" : "—"}</span></div>
            <ReleaseCalendar schedule={schedule} seasonLength={L} cursor={day} label="Calendrier des lâchers" color={STRATEGY_COLOR[sc?.strategy_key ?? ""] ?? "#347A55"} />
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="px-5 py-4">
            <PanelTitle sub={sc ? "Moyenne ± écart-type" : "Répétition 1"}>État au jour {day}</PanelTitle>
            <dl className="mt-3 space-y-1.5 text-[12.5px]">
              {["Wild_males", "Females", "Sterile_males", "Larvae", "SW_ratio"].map((v) => {
                const s = chartSeries.find((c) => c.id === v) ? atDay(v) : null;
                const i = sc ? sc.series.Time.indexOf(day) : day;
                const val = s ?? (sc && i >= 0 ? { v: sc.series[v].mean[i], sd: sc.series[v].sd[i] } : liveRows[day - 1] ? { v: v === "SW_ratio" ? liveRows[day - 1].Sterile_males / Math.max(1, liveRows[day - 1].Wild_males) : liveRows[day - 1][v], sd: undefined } : null);
                return (
                  <div key={v} className="flex items-baseline justify-between gap-2 border-b border-line/60 pb-1">
                    <dt className="text-muted">{VAR[v].label}</dt>
                    <dd className="tnum">{val ? fmt(val.v, v === "SW_ratio" ? 2 : 0) : "—"}{val?.sd ? <span className="text-muted"> ± {fmt(val.sd, v === "SW_ratio" ? 2 : 0)}</span> : null}</dd>
                  </div>
                );
              })}
            </dl>
          </Panel>
          <Panel className="px-5 py-4">
            <PanelTitle sub="Calculés à partir des séries moyennes">Événements du scénario</PanelTitle>
            {sc ? (
              <ol className="mt-3 space-y-1.5 text-[12.5px]">
                {sc.events.map((e, i) => (
                  <li key={i}><button type="button" onClick={() => { setDay(e.day); setFollow(false); }} className="flex w-full items-baseline gap-3 rounded px-1 py-0.5 text-left hover:bg-sage-soft">
                    <span className="w-9 shrink-0 font-mono text-[11.5px] text-muted">J{e.day}</span><span>{e.label}</span></button></li>
                ))}
              </ol>
            ) : <p className="mt-3 text-[12.5px] text-muted">Disponibles à la fin du calcul.</p>}
          </Panel>
          {sc && !sc.is_control && sc.vs_control && (
            <Panel className="px-5 py-4">
              <PanelTitle sub="Variation relative appariée (mêmes graines)">Effet vs témoin</PanelTitle>
              <dl className="mt-3 space-y-1.5 text-[12.5px]">
                {([["larval_damage_pct", "Dommages larvaires"], ["larvae_produced", "Larves produites"], ["wild_adults_final", `Adultes sauvages à J${L}`], ["harvested_clean_pct", "Récolte saine"]] as const).map(([k, l]) => (
                  <div key={k} className="flex justify-between border-b border-line/60 pb-1"><dt className="text-muted">{l}</dt>
                    <dd className="tnum">{sc.vs_control?.[k] ? `${fmt(sc.vs_control[k]!.mean, 1).replace("-", "−")} %` : "—"}<span className="text-muted"> ± {fmt(sc.vs_control?.[k]?.sd, 1)}</span></dd></div>
                ))}
              </dl>
            </Panel>
          )}
          <Panel className="px-5 py-4">
            <div className="flex items-center justify-between"><h3 className="text-[13.5px] font-semibold">Schéma pédagogique</h3><Badge tone="demo">non quantitatif</Badge></div>
            <p className="mt-1 text-[11.5px] text-muted">Illustration du mécanisme, sans lien avec les valeurs calculées.</p>
            <div className="mt-3"><ScientificProcessDiagram compact bare /></div>
          </Panel>
          <Panel className="px-5 py-4">
            <h3 className="text-[13.5px] font-semibold">Journal d’exécution</h3>
            <ol className="mt-2 max-h-44 space-y-1 overflow-auto font-mono text-[11px] text-muted">
              <li>{fmtDate(exp.created_at)} — création ({exp.short_id}, hash {exp.config_hash})</li>
              {live?.log.map((l, i) => <li key={i}>{fmtDate(l.t)} — {l.msg}</li>)}
              {exp.finished_at && !live?.log.length && <li>{fmtDate(exp.finished_at)} — {exp.status} ({exp.duration_s} s)</li>}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function initialRow(exp: Experiment | null, initialFruits: number) {
  // État à J0 (avant le premier jour) : effectifs initiaux de la configuration et stock initial de fruits (CropParameters.initial_fruits)
  const w = exp?.config.invasion.wild ?? 0, f = exp?.config.invasion.females ?? 0;
  return { Wild_males: w, Females: f, Sterile_males: 0, Larvae: 0, Young_fruits: initialFruits, Harvestable_fruits: 0, Rotten_natural: 0, Rotten_sterile_only: 0, Rotten_larvae: 0, Harvested_cumul: 0, Rotten_cumul: 0 } as Record<string, number>;
}
