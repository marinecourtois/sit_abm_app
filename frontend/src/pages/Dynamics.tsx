import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Experiment, type Results, type Scenario } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { fmt, fmtInt } from "../lib/format";
import { activeExtensions, scenarioLabel } from "../lib/analysis";
import { StudyHeader, StudyTabs } from "../components/layout";
import { EmptyState, Panel, PanelTitle, Select, Skeleton } from "../components/ui";
import { ResearchAnnotation, UncertaintyLegend } from "../components/science";
import { TimeSeriesChart, type ChartSeries } from "../components/charts/TimeSeriesChart";

type Line = { v: string; label: string; color: string; dash?: string };
const INSECTS: Line[] = [
  { v: "Sterile_males", label: "Mâles stériles (S)", color: "#547B91", dash: "2 3" },
  { v: "Females", label: "Femelles (F)", color: "#A83D36", dash: "7 3" },
  { v: "Fertile_females", label: "Femelles fécondées", color: "#7A2E28", dash: "1 2" },
  { v: "Wild_males", label: "Mâles sauvages (W)", color: "#145A3D" },
  { v: "Larvae", label: "Larves (L)", color: "#BF532E", dash: "10 3 2 3" },
];
const FRUITS: Line[] = [
  { v: "Young_fruits", label: "Fruits jeunes", color: "#547B91" },
  { v: "Harvestable_fruits", label: "Fruits récoltables", color: "#347A55" },
  { v: "Rotten_larvae", label: "Pourris avec larves", color: "#A83D36" },
  { v: "Rotten_sterile_only", label: "Pourris piqûres stériles seules", color: "#BF532E", dash: "2 3" },
  { v: "Rotten_natural", label: "Pourris (sénescence)", color: "#8E9890", dash: "6 3" },
];

/** Légende d'un graphique : une entrée par série du scénario (trait et tirets du graphique). */
function Legend({ defs, ctrl }: { defs: Line[]; ctrl: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px]">
      {defs.map((d) => (
        <span key={d.v} className="inline-flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden><line x1="0" x2="20" y1="3" y2="3" stroke={d.color} strokeWidth="2.5" strokeDasharray={d.dash} /></svg>{d.label}
        </span>
      ))}
      {ctrl && <span className="inline-flex items-center gap-1.5 text-muted"><svg width="20" height="6" aria-hidden><line x1="0" x2="20" y1="3" y2="3" stroke="#657068" strokeWidth="1.6" strokeDasharray="2 4" /></svg>témoin (même couleur, tirets fins)</span>}
    </div>
  );
}

/** Témoin sans lâcher de la même cellule (culture, invasion, régime), mêmes graines. */
function controlOf(res: Results, sc: Scenario) {
  return res.scenarios.find((c) => c.is_control && c.crop === sc.crop && c.remating === sc.remating
    && (c.invasion?.wild ?? -1) === (sc.invasion?.wild ?? -1) && (c.invasion?.females ?? -1) === (sc.invasion?.females ?? -1));
}

function peak(s: Scenario | undefined, v: string) {
  const y = s?.series[v]?.mean;
  if (!y?.length) return null;
  let i = 0;
  y.forEach((x, j) => { if (x > y[i]) i = j; });
  return { day: s!.series.Time[i], value: y[i] };
}

/** Dynamiques des agents d'un scénario : insectes, fruits, dommages du jour, compétition sexuelle. */
export function Dynamics() {
  const meta = useMeta();
  const [sp, setSp] = useSearchParams();
  const list = useAsync(() => api.experiments(), []);
  const done = useMemo(() => (list.data ?? []).filter((e) => e.status === "completed"), [list.data]);
  const eid = sp.get("exp") || (done.find((e) => e.tags.includes("référence")) ?? done[0])?.id || "";
  const exp = done.find((e) => e.id === eid);
  const [res, setRes] = useState<Results | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scen, setScen] = useState("");
  const [ctrlOn, setCtrlOn] = useState(true);
  useEffect(() => {
    if (!eid) return;
    let alive = true;   // une réponse arrivée après un changement d'expérience est ignorée
    setRes(null); setErr(null);
    api.results(eid).then((r) => { if (alive) setRes(r); }).catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, [eid]);
  useEffect(() => { if (res && !res.scenarios.some((s) => s.key === scen)) setScen((res.scenarios.find((s) => !s.is_control) ?? res.scenarios[0])?.key ?? ""); }, [res]);

  const sc = res?.scenarios.find((s) => s.key === scen);
  const ctrl = res && sc && !sc.is_control ? controlOf(res, sc) : undefined;
  const hasNew = !!sc?.series.Fertile_females;
  const lines = (defs: Line[], withCtrl: string[]): ChartSeries[] => {
    if (!sc) return [];
    const out: ChartSeries[] = defs.filter((d) => sc.series[d.v]).map((d) => ({ id: d.v, label: d.label, color: d.color, dash: d.dash, x: sc.series.Time, y: sc.series[d.v].mean, sd: sc.series[d.v].sd }));
    if (ctrlOn && ctrl) for (const v of withCtrl) {
      const d = defs.find((x) => x.v === v);
      if (d && ctrl.series[v]) out.push({ id: `ctrl:${v}`, label: `Témoin · ${d.label}`, color: d.color, dash: "2 4", width: 1.4, opacity: 0.6, x: ctrl.series.Time, y: ctrl.series[v].mean });
    }
    return out;
  };

  if (list.error) return <EmptyState title="Expériences indisponibles">{list.error}</EmptyState>;
  const n = exp?.config.replicates ?? 0;
  const pkW = peak(sc, "Wild_adults"), pkWc = peak(ctrl, "Wild_adults"), pkS = peak(sc, "Sterile_males"), pkL = peak(sc, "Larvae"), pkLc = peak(ctrl, "Larvae");
  const pS = sc?.series.Sterile_mating_prob?.mean;
  const pSmean = pS?.length ? pS.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, pS.length - 1) : null;

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Dynamiques" title="Dynamiques des agents" subtitle="Insectes, fruits et dommages jour après jour, comparés au témoin sans lâcher" />
      <StudyTabs />
      <Panel className="mt-4 px-5 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full text-[12px] sm:w-[22rem]"><span className="text-muted">Expérience</span>
            <Select label="Expérience" value={eid} onChange={(v) => { setSp({ exp: v }); }} options={done.map((e: Experiment) => ({ value: e.id, label: `${e.short_id} · ${e.name}` }))} /></label>
          <label className="w-full text-[12px] sm:w-[24rem]"><span className="text-muted">Scénario</span>
            <Select label="Scénario" value={scen} onChange={setScen} options={(res?.scenarios ?? []).map((s) => ({ value: s.key, label: exp ? scenarioLabel(s, exp.config, meta) : s.strategy_label }))} /></label>
          {ctrl && <label className="inline-flex cursor-pointer items-center gap-1.5 pb-2 text-[12.5px]"><input type="checkbox" className="h-3.5 w-3.5 accent-[#347A55]" checked={ctrlOn} onChange={(e) => setCtrlOn(e.target.checked)} />Superposer le témoin (tirets)</label>}
          {exp && <Link to={`/simulation/${exp.id}`} className="pb-2 text-[12.5px] text-forest underline">Ouvrir la simulation</Link>}
        </div>
      </Panel>
      {exp && activeExtensions(exp.config.biology).length > 0 && <div className="mt-3"><ResearchAnnotation tone="warning"><strong>Extensions hors notebook actives :</strong> {activeExtensions(exp.config.biology).join(" ; ")}.</ResearchAnnotation></div>}
      {err && <div className="mt-4"><EmptyState title="Résultats indisponibles">{err}</EmptyState></div>}
      {!list.loading && !done.length && <div className="mt-4"><EmptyState title="Aucune expérience terminée">Lancez une simulation dans le <Link className="text-forest underline" to="/simulation">Studio</Link>.</EmptyState></div>}
      {(list.loading || (eid && !res && !err)) && <Skeleton className="mt-4 h-96" />}
      {sc && meta && (<>
        {!hasNew && <div className="mt-3"><ResearchAnnotation>Expérience calculée avant la version 1.9.0 : les femelles fécondées, la probabilité d’accouplement stérile et les fruits pourris par jour n’ont pas été enregistrés. Dupliquez-la pour les obtenir (mêmes graines, mêmes autres résultats).</ResearchAnnotation></div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pic d’adultes sauvages (W + F)", pkW ? `${fmtInt(Math.round(pkW.value))} à J${pkW.day}` : "—", pkWc ? `témoin : ${fmtInt(Math.round(pkWc.value))} à J${pkWc.day}` : ""],
            ["Pic de mâles stériles", pkS && pkS.value > 0 ? `${fmtInt(Math.round(pkS.value))} à J${pkS.day}` : "aucun lâcher", ""],
            ["Pic de larves", pkL ? `${fmtInt(Math.round(pkL.value))} à J${pkL.day}` : "—", pkLc ? `témoin : ${fmtInt(Math.round(pkLc.value))} à J${pkLc.day}` : ""],
            ["Accouplements stériles (probabilité moyenne)", pSmean != null ? `${fmt(100 * pSmean, 1)} %` : "—", pSmean != null ? `η·S / (W + η·S), moyenne sur la saison` : "non enregistrée"],
          ].map(([t, v, s]) => (
            <Panel key={t} className="px-4 py-3"><div className="text-[11.5px] text-muted">{t}</div><div className="mt-0.5 font-serif text-[22px] font-semibold tnum">{v}</div>{s && <div className="text-[11.5px] text-muted tnum">{s}</div>}</Panel>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel className="px-5 py-4">
            <PanelTitle sub={<span className="inline-flex flex-wrap items-center gap-2"><UncertaintyLegend n={n} /> · témoin en tirets</span>}>Populations d’insectes</PanelTitle>
            <Legend defs={INSECTS.filter((d) => sc.series[d.v])} ctrl={ctrlOn && !!ctrl} />
            <TimeSeriesChart series={lines(INSECTS, ["Females", "Larvae"])} height={300} xLabel="Jour de saison" yLabel="Individus" zoomable={false} ariaLabel="Populations d’insectes" />
            <p className="text-[11.5px] leading-snug text-muted">Femelles fécondées : femelles vivantes capables de pondre des œufs viables dans leur régime (au moins un accouplement fertile ; en monandrie, le premier doit l’être).</p>
          </Panel>
          <Panel className="px-5 py-4">
            <PanelTitle sub={`Effectifs de fruits sur la plante · ${fmtInt(Number(meta.crops[sc.crop].params.total_fruits))} fruits produits sur la saison`}>État des fruits</PanelTitle>
            <Legend defs={FRUITS.filter((d) => sc.series[d.v])} ctrl={ctrlOn && !!ctrl} />
            <TimeSeriesChart series={lines(FRUITS, ["Rotten_larvae"])} height={300} xLabel="Jour de saison" yLabel="Fruits" zoomable={false} ariaLabel="État des fruits" />
            <p className="text-[11.5px] leading-snug text-muted">Le modèle du notebook a deux stades de fruit, jeune puis récoltable (maturité en {String(meta.crops[sc.crop].params.maturation_min)}–{String(meta.crops[sc.crop].params.maturation_max)} j pour cette culture).</p>
          </Panel>
          <Panel className="px-5 py-4">
            <PanelTitle sub="Fruits qui ont pourri ce jour-là (toutes causes) · différence du cumul, par répétition">Dommages au jour le jour</PanelTitle>
            {sc.series.Rotten_daily
              ? <><Legend defs={[{ v: "Rotten_daily", label: "Pourris dans la journée", color: "#8E3519" }]} ctrl={ctrlOn && !!ctrl} /><TimeSeriesChart series={lines([{ v: "Rotten_daily", label: "Pourris dans la journée", color: "#8E3519" }], ["Rotten_daily"])} height={260} xLabel="Jour de saison" yLabel="Fruits / jour" zoomable={false} ariaLabel="Fruits pourris par jour" /></>
              : <p className="mt-3 text-[12.5px] text-muted">Non enregistré pour cette expérience.</p>}
          </Panel>
          <Panel className="px-5 py-4">
            <PanelTitle sub="Probabilité qu’un accouplement soit stérile, η·S / (W + η·S), moyenne ± écart-type">Compétition sexuelle</PanelTitle>
            {sc.series.Sterile_mating_prob
              ? <TimeSeriesChart series={[{ id: "p", label: "Accouplement stérile", color: "#355A70", x: sc.series.Time, y: sc.series.Sterile_mating_prob.mean.map((x) => 100 * x), sd: sc.series.Sterile_mating_prob.sd.map((x) => 100 * x) }]}
                  height={260} xLabel="Jour de saison" yLabel="% des accouplements" zoomable={false} valueFormat={(v) => `${fmt(v, 1)} %`} ariaLabel="Probabilité d’accouplement stérile" />
              : <p className="mt-3 text-[12.5px] text-muted">Non enregistrée pour cette expérience.</p>}
          </Panel>
        </div>
      </>)}
    </>
  );
}
