import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Experiment, type Results, type Scenario } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { CROP_LABEL, fmt, fmtInt } from "../lib/format";
import { DASHES, SERIES_PALETTE } from "../lib/colors";
import { METRIC, METRICS, VAR, VARIABLES } from "../lib/variables";
import { StudyHeader, StudyTabs } from "../components/layout";
import { EmptyState, Panel, PanelTitle, ScientificTooltip, Segmented, Select, Skeleton } from "../components/ui";
import { ResearchAnnotation, UncertaintyLegend } from "../components/science";
import { TimeSeriesChart, type ChartSeries } from "../components/charts/TimeSeriesChart";
import { ChartExportMenu } from "../components/charts/ChartExportMenu";
import { downloadText, toCsv } from "../components/charts/exportChart";

interface Sel { exp: Experiment; sc: Scenario; ctrl?: Scenario; color: string; dash: string; name: string }
type Norm = "none" | "j0" | "control";

const CRITERIA = [
  { key: "larval_damage_pct", label: "Minimiser les dommages larvaires", dir: 1 },
  { key: "harvested_clean_pct", label: "Maximiser la récolte saine", dir: -1 },
  { key: "rotten_sterile_only_pct", label: "Minimiser les pourris par piqûres stériles", dir: 1 },
  { key: "rotten_pct", label: "Minimiser les fruits pourris", dir: 1 },
];

export function ComparisonChart({ sel, variable, norm, mode, bands, sync, showCtrl }: { sel: Sel[]; variable: string; norm: Norm; mode: "overlay" | "split"; bands: boolean; sync: boolean; showCtrl: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const v = VAR[variable];
  const unit = norm === "none" ? v.unit : norm === "j0" ? "relatif à J0" : "% du témoin (même jour)";
  const toSeries = (s: Sel): ChartSeries[] => {
    const b = s.sc.series[variable];
    if (!b) return [];
    let y = b.mean, sd = b.sd;
    if (norm === "j0") { const y0 = b.mean[0] || 1; y = y.map((x) => x / y0); sd = sd.map((x) => x / y0); }
    if (norm === "control" && s.ctrl) { const c = s.ctrl.series[variable].mean; y = y.map((x, i) => (c[i] ? (100 * x) / c[i] : NaN)); sd = sd.map((x, i) => (c[i] ? (100 * x) / c[i] : NaN)); }
    const out: ChartSeries[] = [{ id: s.sc.key + s.exp.id, label: s.name, color: s.color, dash: s.dash, x: s.sc.series.Time, y, sd: bands ? sd : undefined }];
    if (showCtrl && s.ctrl?.series[variable] && norm !== "control") {
      const cb = s.ctrl.series[variable]; const y0 = norm === "j0" ? cb.mean[0] || 1 : 1;
      out.push({ id: "ctrl" + s.sc.key + s.exp.id, label: `Témoin ${CROP_LABEL[s.sc.crop]}`, color: s.color, dash: "1 3", width: 1.4, opacity: 0.8, x: s.ctrl.series.Time, y: cb.mean.map((x) => x / y0) });
    }
    return out;
  };
  const all = sel.flatMap(toSeries);
  const xMax = Math.max(...sel.map((s) => s.sc.series.Time[s.sc.series.Time.length - 1]));
  const yMax = Math.max(...all.flatMap((s) => s.y.map((y, i) => y + (s.sd?.[i] ?? 0)).filter(Number.isFinite)));
  const yDom: [number, number] | undefined = sync ? [0, yMax * 1.06] : undefined;
  const csv = () => downloadText(toCsv([["serie", "jour", "moyenne", "ecart_type", "unite"], ...all.flatMap((s) => s.x.map((t, i) => [s.label, t, s.y[i], s.sd?.[i] ?? "", unit]))]), `comparaison-${variable}.csv`);
  const meta = { title: `${v.label} — comparaison de ${sel.length} scénarios`, filename: `comparaison-${variable}`, caption: `Moyenne ± écart-type entre répétitions. ${sel.map((s) => `${s.name} [${s.exp.short_id}]`).join(" ; ")}. Unité : ${unit}.` };
  if (mode === "overlay") return (
    <div>
      <div className="flex justify-end"><ChartExportMenu getSvg={() => ref.current} meta={meta} onCsv={csv} /></div>
      <TimeSeriesChart ref={ref} series={all} height={360} xLabel="Jour de saison" yLabel={unit === "sans dimension" ? v.label.split(" (")[0] : cap(unit)} xDomain={sync ? [0, xMax] : undefined} yDomain={yDom}
        showBands={bands} ariaLabel={`Comparaison : ${v.label}`} uncertaintyLabel="± écart-type entre répétitions" />
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sel.map((s) => <SplitChart key={s.sc.key + s.exp.id} s={s} series={toSeries(s)} unit={unit} xMax={sync ? xMax : undefined} yDom={yDom} bands={bands} title={s.name} />)}
    </div>
  );
}
function SplitChart({ s, series, unit, xMax, yDom, bands, title }: { s: Sel; series: ChartSeries[]; unit: string; xMax?: number; yDom?: [number, number]; bands: boolean; title: string }) {
  const ref = useRef<SVGSVGElement>(null);
  return (
    <figure className="rounded border border-line bg-white px-3 pt-2">
      <figcaption className="flex items-center justify-between gap-2 text-[13px] font-medium"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{title}</span>
        <ChartExportMenu getSvg={() => ref.current} meta={{ title, filename: `scenario-${s.exp.short_id}`, caption: `${s.exp.short_id}, ${unit}` }} /></figcaption>
      <TimeSeriesChart ref={ref} series={series} height={250} xLabel="Jour de saison" yLabel={unit === "sans dimension" ? "Sans dimension" : cap(unit)} xDomain={xMax ? [0, xMax] : undefined} yDomain={yDom} showBands={bands} ariaLabel={title} />
    </figure>
  );
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function Comparison() {
  const meta = useMeta();
  const [sp] = useSearchParams();
  const exps = useAsync(() => api.experiments(), []);
  const done = (exps.data ?? []).filter((e) => e.status === "completed");
  const [results, setResults] = useState<Record<string, Results>>({});
  const [picked, setPicked] = useState<string[]>([]); // `${expId}::${scenarioKey}`
  const [variable, setVariable] = useState("Wild_adults_vs_control");
  const [norm, setNorm] = useState<Norm>("none");
  const [mode, setMode] = useState<"overlay" | "split">("overlay");
  const [bands, setBands] = useState(true);
  const [sync, setSync] = useState(true);
  const [showCtrl, setShowCtrl] = useState(false);
  const [crit, setCrit] = useState(CRITERIA[0].key);

  const want = useMemo(() => { const p = sp.get("exp"); if (p) return p.split(","); const ref = done.find((e) => e.tags.includes("référence")) ?? done[0]; return ref ? [ref.id] : []; }, [sp, done.length]);
  useEffect(() => {
    want.forEach((id) => { if (!results[id]) api.results(id).then((r) => setResults((x) => ({ ...x, [id]: r }))).catch(() => {}); });
  }, [want.join(",")]);
  // sélection initiale : jusqu'à 4 scénarios TIS des expériences demandées
  useEffect(() => {
    if (picked.length) return;
    const ready = want.filter((id) => results[id]);
    if (ready.length !== want.length || !ready.length) return;
    const ref = ready.flatMap((id) => results[id].scenarios.filter((s) => !s.is_control).map((s) => `${id}::${s.key}`));
    const pref = ref.filter((k) => /every_3|every_7/.test(k));
    setPicked((pref.length >= 2 ? pref : ref).slice(0, 4));
  }, [results, want.join(",")]);

  const loadExp = (id: string) => { if (!results[id]) api.results(id).then((r) => setResults((x) => ({ ...x, [id]: r }))); };
  const sel: Sel[] = picked.map((k, i) => {
    const [eid, skey] = [k.slice(0, k.indexOf("::")), k.slice(k.indexOf("::") + 2)];
    const exp = done.find((e) => e.id === eid); const r = results[eid];
    const sc = r?.scenarios.find((s) => s.key === skey);
    if (!exp || !sc) return null;
    const ctrl = r.scenarios.find((s) => s.is_control && s.crop === sc.crop);
    return { exp, sc, ctrl, color: SERIES_PALETTE[i % SERIES_PALETTE.length], dash: DASHES[i % DASHES.length], name: `${CROP_LABEL[sc.crop]} · ${sc.strategy_label}${new Set(picked.map((p) => p.split("::")[0])).size > 1 ? ` · ${exp.short_id}` : ""}` };
  }).filter(Boolean) as Sel[];
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 4 ? p : [...p, k]));

  const c = CRITERIA.find((x) => x.key === crit)!;
  const ranked = [...sel].sort((a, b) => c.dir * (a.sc.metrics[crit].mean - b.sc.metrics[crit].mean));
  const crops = new Set(sel.map((s) => s.sc.crop));
  const budgets = new Set(sel.map((s) => s.sc.budget));

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Étude 01" title="Comparison Lab" subtitle="Comparer deux à quatre scénarios simulés" />
      <StudyTabs />
      <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel className="px-4 py-4 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
          <PanelTitle sub={`${sel.length} / 4 sélectionnés`}>Scénarios</PanelTitle>
          {exps.loading ? <Skeleton className="mt-3 h-40" /> : done.length === 0 ? <p className="mt-3 text-[13px] text-muted">Aucune expérience terminée.</p> : (
            <div className="mt-3 space-y-3">
              {done.map((e) => (
                <details key={e.id} open={want.includes(e.id)} onToggle={(ev) => (ev.target as HTMLDetailsElement).open && loadExp(e.id)} className="rounded border border-line bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-[12.5px]"><span className="font-mono text-[11px] text-muted">{e.short_id}</span> <span className="font-medium">{e.name}</span></summary>
                  <div className="space-y-0.5 border-t border-line px-2 py-2">
                    {results[e.id] ? results[e.id].scenarios.map((s) => {
                      const k = `${e.id}::${s.key}`; const on = picked.includes(k);
                      return (
                        <label key={k} className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-sage-soft ${!on && picked.length >= 4 ? "opacity-50" : ""}`}>
                          <input type="checkbox" checked={on} disabled={!on && picked.length >= 4} onChange={() => toggle(k)} className="h-3.5 w-3.5 accent-[#347A55]" />
                          {on && <span className="h-2 w-2 rounded-full" style={{ background: SERIES_PALETTE[picked.indexOf(k) % SERIES_PALETTE.length] }} />}
                          <span>{CROP_LABEL[s.crop]} · {s.strategy_label}</span>
                        </label>
                      );
                    }) : <Skeleton className="h-16" />}
                  </div>
                </details>
              ))}
            </div>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          {sel.length < 2 ? (
            <EmptyState title="Sélectionnez au moins deux scénarios">Choisissez de 2 à 4 scénarios dans les expériences terminées. Les scénarios de cultures différentes sont superposés sur un axe commun de jours de saison.</EmptyState>
          ) : (<>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {sel.map((s) => (
                <Panel key={s.sc.key + s.exp.id} className="px-3.5 py-3" style={{ borderTop: `3px solid ${s.color}` }}>
                  <div className="flex items-center gap-2"><svg width="22" height="6" aria-hidden><line x1="0" x2="22" y1="3" y2="3" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} /></svg><span className="font-serif text-[15px] font-semibold">{s.name}</span></div>
                  <dl className="mt-2 grid grid-cols-[78px_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
                    <dt className="text-muted">Culture</dt><dd><em className="font-serif">{meta?.crops[s.sc.crop].latin}</em></dd>
                    <dt className="text-muted">Budget</dt><dd className="tnum">{fmtInt(s.sc.budget)} stériles</dd>
                    <dt className="text-muted">Période</dt><dd className="tnum">J0 – J{s.sc.series.Time[s.sc.series.Time.length - 1]}</dd>
                    <dt className="text-muted">Invasion</dt><dd className="tnum">{s.exp.config.invasion.wild} W : {s.exp.config.invasion.females} F</dd>
                    <dt className="text-muted">Régime</dt><dd>{s.exp.config.remating}</dd>
                    <dt className="text-muted">Identifiant</dt><dd className="font-mono text-[10.5px]">{s.exp.short_id} · graines {s.sc.seeds.join(", ")}</dd>
                  </dl>
                </Panel>
              ))}
            </div>
            {(crops.size > 1 || budgets.size > 1) && <ResearchAnnotation>
              {crops.size > 1 && <>Cultures différentes : durées de saison distinctes (fraise 100 j, cerise 25 j) et dynamiques de fruits différentes{VAR[variable]?.unit === "individus" && norm === "none" ? <> ; les populations sont comparées en effectifs absolus (individus) sur la même parcelle de {fmtInt(90000)} fruits</> : null}. </>}
              {budgets.size > 1 && <>Budgets différents entre scénarios. </>}
              Utilisez la normalisation pour une comparaison relative explicite.
            </ResearchAnnotation>}
            <Panel className="px-5 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="w-72 text-[12px]"><span className="text-muted">Variable</span><Select label="Variable" value={variable} onChange={setVariable} options={VARIABLES.map((v) => ({ value: v.key, label: `${v.label} (${v.unit})` }))} /></label>
                <label className="w-60 text-[12px]"><span className="text-muted">Normalisation</span><Select label="Normalisation" value={norm} onChange={(v) => setNorm(v as Norm)} options={[{ value: "none", label: "Aucune (unités du modèle)" }, { value: "j0", label: "Relative à J0 (÷ valeur initiale)" }, { value: "control", label: "% du témoin, même jour" }]} /></label>
                <div className="w-56 text-[12px]"><span className="text-muted">Affichage</span><Segmented size="sm" label="Affichage" value={mode} onChange={setMode} options={[{ value: "overlay", label: "Superposés" }, { value: "split", label: "Séparés" }]} /></div>
                <label className="flex items-center gap-1.5 pb-2 text-[12.5px]"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} className="accent-[#347A55]" />Axes synchronisés</label>
                <label className="flex items-center gap-1.5 pb-2 text-[12.5px]"><input type="checkbox" checked={bands} onChange={(e) => setBands(e.target.checked)} className="accent-[#347A55]" />Incertitude</label>
                <label className="flex items-center gap-1.5 pb-2 text-[12.5px]"><input type="checkbox" checked={showCtrl} onChange={(e) => setShowCtrl(e.target.checked)} className="accent-[#347A55]" />Témoin</label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px]">
                {sel.map((s) => <span key={s.sc.key + s.exp.id} className="flex items-center gap-1.5"><svg width="24" height="6" aria-hidden><line x1="0" x2="24" y1="3" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} /></svg>{s.name}</span>)}
                {showCtrl && norm !== "control" && <span className="flex items-center gap-1.5 text-muted"><svg width="24" height="6" aria-hidden><line x1="0" x2="24" y1="3" y2="3" stroke="#657068" strokeWidth="1.5" strokeDasharray="1 3" /></svg>Témoin de la même culture</span>}
                <UncertaintyLegend n={sel[0].sc.seeds.length} />
                <span className="text-muted">Glisser pour zoomer · double-clic pour réinitialiser</span>
              </div>
              <div className="mt-2"><ComparisonChart sel={sel} variable={variable} norm={norm} mode={mode} bands={bands} sync={sync} showCtrl={showCtrl} /></div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
                <PanelTitle sub="Indicateurs de fin de saison calculés par le moteur · moyenne ± écart-type entre répétitions">Tableau comparatif</PanelTitle>
                <label className="w-80 text-[12px]"><span className="text-muted">Ordonner selon le critère</span><Select label="Critère d'ordre" value={crit} onChange={setCrit} options={CRITERIA.map((x) => ({ value: x.key, label: x.label }))} /></label>
              </div>
              <div className="scroll-x mt-3">
                <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
                  <thead><tr className="border-y border-line bg-[#F6F7F3] text-left text-[11.5px] text-muted">
                    <th className="px-4 py-2 font-medium">Rang</th><th className="px-3 py-2 font-medium">Stratégie</th><th className="px-3 py-2 font-medium">Culture</th><th className="px-3 py-2 text-right font-medium">Budget</th>
                    {["larval_damage_pct", "sterile_puncture_share_pct", "harvested_clean_pct", "rotten_sterile_only_pct"].map((k) => <th key={k} className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">{METRIC[k].label}<ScientificTooltip content={METRIC[k].definition} /></span><div className="font-normal">{METRIC[k].unit}</div></th>)}
                    <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">Réduction relative<ScientificTooltip content="Variation des dommages larvaires par rapport au témoin de la même expérience, appariée par répétition (mêmes graines)." /></span><div className="font-normal">vs témoin</div></th>
                    <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">Variabilité<ScientificTooltip content="Coefficient de variation des dommages larvaires entre répétitions (écart-type / moyenne)." /></span><div className="font-normal">CV</div></th>
                  </tr></thead>
                  <tbody>
                    {ranked.map((s, i) => {
                      const d = s.sc.metrics.larval_damage_pct; const r = s.sc.vs_control?.larval_damage_pct;
                      return (
                        <tr key={s.sc.key + s.exp.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-2 tnum">{i + 1}</td>
                          <td className="px-3 py-2"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.sc.strategy_label}</span></td>
                          <td className="px-3 py-2">{CROP_LABEL[s.sc.crop]}</td>
                          <td className="px-3 py-2 text-right tnum">{fmtInt(s.sc.budget)}</td>
                          {["larval_damage_pct", "sterile_puncture_share_pct", "harvested_clean_pct", "rotten_sterile_only_pct"].map((k) => (
                            <td key={k} className={`px-3 py-2 text-right tnum ${k === crit ? "font-semibold" : ""}`}>{fmt(s.sc.metrics[k].mean, 2)}<span className="text-muted"> ± {fmt(s.sc.metrics[k].sd, 2)}</span></td>
                          ))}
                          <td className="px-3 py-2 text-right tnum">{r ? `${fmt(r.mean, 1).replace("-", "−")} %` : "—"}</td>
                          <td className="px-3 py-2 text-right tnum">{d.mean ? fmt(d.sd / d.mean, 2) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-2.5 text-[11.5px] text-muted">Rang établi uniquement selon le critère « {c.label.toLowerCase()} », sur les moyennes ; il ne constitue pas un classement global. n = {sel[0].sc.seeds.length} répétitions par scénario : aucun test statistique n’est appliqué.
                <button type="button" className="ml-2 underline" onClick={() => downloadText(toCsv([["experience", "culture", "strategie", "budget", ...METRICS.flatMap((m) => [m.key + "_mean", m.key + "_sd"])], ...sel.map((s) => [s.exp.short_id, s.sc.crop, s.sc.strategy_label, s.sc.budget, ...METRICS.flatMap((m) => [s.sc.metrics[m.key].mean, s.sc.metrics[m.key].sd])])]), "tableau-comparatif.csv")}>Exporter (CSV)</button></p>
            </Panel>
          </>)}
        </div>
      </div>
    </>
  );
}
