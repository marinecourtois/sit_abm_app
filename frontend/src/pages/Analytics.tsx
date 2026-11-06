import { forwardRef, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { CROP_LABEL, fmt, fmtInt } from "../lib/format";
import { STRATEGY_COLOR, STRATEGY_ORDER } from "../lib/colors";
import { StudyHeader, StudyTabs } from "../components/layout";
import { Badge, EmptyState, Panel, PanelTitle, ScientificTooltip, Segmented, Select, Skeleton } from "../components/ui";
import { ResearchAnnotation } from "../components/science";
import { Heatmap } from "../components/charts/Heatmap";
import { ScatterChart, type ScatterPoint } from "../components/charts/ScatterChart";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { ChartExportMenu } from "../components/charts/ChartExportMenu";

type Row = Record<string, string | number>;
const COLS: Record<string, { col: string | ((r: Row) => number); label: string; unit: string; palette: "green" | "terracotta" | "blue"; max: number }> = {
  harvested_clean_pct: { col: "Harvested - clean (%)", label: "Récolte saine", unit: "% des fruits", palette: "green", max: 100 },
  larval_damage_pct: { col: (r) => Number(r["Harvested - larvae (%)"]) + Number(r["Rotten - larvae (%)"]) + Number(r["Remaining - larvae (%)"]), label: "Dommages larvaires", unit: "% des fruits", palette: "terracotta", max: 70 },
  rotten_pct: { col: "Rotten (%)", label: "Fruits pourris (total)", unit: "% des fruits", palette: "terracotta", max: 100 },
  rotten_larvae_pct: { col: "Rotten - larvae (%)", label: "Pourris avec larves", unit: "% des fruits", palette: "terracotta", max: 70 },
  rotten_sterile_only_pct: { col: "Rotten - sterile only (%)", label: "Pourris piqûres stériles seules", unit: "% des fruits", palette: "blue", max: 35 },
  larvae_produced: { col: "Larvae produced", label: "Larves produites", unit: "larves", palette: "terracotta", max: 300000 },
};
const val = (r: Row, k: string) => { const c = COLS[k].col; return typeof c === "function" ? c(r) : Number(r[c]); };
const stats = (v: number[]) => { const n = v.length, m = v.reduce((a, b) => a + b, 0) / n; return { mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0, n, values: v }; };

export function Analytics() {
  const meta = useMeta();
  const ref = useAsync(() => api.reference<Row>("factorial"), []);
  const nb2key = useMemo(() => Object.fromEntries(Object.entries((meta as unknown as { strategy_nb_names: Record<string, string> })?.strategy_nb_names ?? {}).map(([k, v]) => [v, k])), [meta]);
  const [crop, setCrop] = useState<"strawberry" | "cherry">("strawberry");
  const [metric, setMetric] = useState("harvested_clean_pct");
  const [remating, setRemating] = useState("preference");
  const [invasion, setInvasion] = useState<string>("");
  const [budget, setBudget] = useState(9000);
  const hmRef = useRef<SVGSVGElement>(null), drRef = useRef<SVGSVGElement>(null), paRef = useRef<SVGSVGElement>(null), stRef = useRef<SVGSVGElement>(null);

  const rows = ref.data?.rows ?? [];
  const invasions = useMemo(() => Array.from(new Set(rows.map((r) => String(r.Invasion)))).sort((a, b) => parseInt(a.split("(")[1]) - parseInt(b.split("(")[1])), [rows]);
  const inv = invasion || invasions[1] || "";
  const budgets = useMemo(() => Array.from(new Set(rows.map((r) => Number(r.Budget)))).sort((a, b) => a - b), [rows]);
  const sub = rows.filter((r) => r.Crop === crop && r.Remating === remating);
  const group = (f: (r: Row) => boolean, k = metric) => stats(sub.filter(f).map((r) => val(r, k)));
  const strategies = STRATEGY_ORDER.filter((k) => k !== "no_tis");
  const m = COLS[metric];
  const label = (k: string) => meta?.strategies[k]?.label ?? k;
  const isK = (r: Row, k: string) => nb2key[String(r.Strategy)] === k;

  if (ref.error) return <EmptyState title="Données de référence indisponibles">{ref.error}</EmptyState>;

  // Heatmap : lignes = invasion × budget, colonnes = témoin + stratégies
  const hmRows = invasions.flatMap((i) => budgets.filter((b) => b > 0).map((b) => ({ i, b })));
  const hm = hmRows.map(({ i, b }) => [group((r) => r.Invasion === i && isK(r, "no_tis")), ...strategies.map((k) => group((r) => r.Invasion === i && Number(r.Budget) === b && isK(r, k)))]);

  // Dose-réponse
  const dose = strategies.map((k) => {
    const pts = budgets.map((b) => (b === 0 ? group((r) => r.Invasion === inv && isK(r, "no_tis")) : group((r) => r.Invasion === inv && Number(r.Budget) === b && isK(r, k))));
    return { id: k, label: label(k), color: STRATEGY_COLOR[k], x: budgets, y: pts.map((p) => p.mean), sd: pts.map((p) => p.sd), marker: (["circle", "square", "triangle", "diamond", "circle"] as const)[strategies.indexOf(k)] };
  });

  // Pareto : dommages larvaires vs pourris piqûres stériles (moyennes par scénario), toutes cultures
  const pts: ScatterPoint[] = [];
  for (const c of ["strawberry", "cherry"] as const) for (const i of invasions) for (const b of budgets.filter((x) => x > 0)) for (const k of strategies) {
    const g = rows.filter((r) => r.Crop === c && r.Remating === remating && r.Invasion === i && Number(r.Budget) === b && isK(r, k));
    if (!g.length) continue;
    const x = stats(g.map((r) => val(r, "rotten_larvae_pct"))).mean, y = stats(g.map((r) => val(r, "rotten_sterile_only_pct"))).mean;
    pts.push({ id: `${c}|${i}|${b}|${k}`, x, y, size: b, color: STRATEGY_COLOR[k], shape: c === "strawberry" ? "circle" : "triangle", group: c,
      label: `${CROP_LABEL[c]} · ${label(k)}`, detail: [`Invasion ${i.split(" (")[0]}`, `Budget ${fmtInt(b)} stériles`, `n = ${g.length} répétitions`] });
  }
  const pCrop = pts.filter((p) => p.group === crop);
  const frontier = paretoFront(pCrop);

  // Distribution des répétitions
  const strip = ["no_tis", ...strategies].map((k) => ({ k, vals: sub.filter((r) => r.Invasion === inv && (k === "no_tis" ? isK(r, "no_tis") : Number(r.Budget) === budget && isK(r, k))).map((r) => val(r, metric)) }));

  // Sensibilité au régime de réaccouplement
  const sens = strategies.map((k) => {
    const g = (rem: string) => stats(rows.filter((r) => r.Crop === crop && r.Remating === rem && r.Invasion === inv && Number(r.Budget) === budget && isK(r, k)).map((r) => val(r, metric))).mean;
    return { k, pref: g("preference"), first: g("first") };
  });

  const hdr = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="w-44 text-[12px]"><span className="text-muted">Culture</span><Select label="Culture" value={crop} onChange={(v) => setCrop(v as "strawberry")} options={[{ value: "strawberry", label: "Fraise" }, { value: "cherry", label: "Cerise" }]} /></label>
      <label className="w-72 text-[12px]"><span className="text-muted">Indicateur</span><Select label="Indicateur" value={metric} onChange={setMetric} options={Object.entries(COLS).map(([k, v]) => ({ value: k, label: `${v.label} (${v.unit})` }))} /></label>
      <label className="w-60 text-[12px]"><span className="text-muted">Réaccouplement</span><Select label="Régime" value={remating} onChange={setRemating} options={[{ value: "preference", label: "Préférence (polyandrie)" }, { value: "first", label: "Premier (monandrie)" }]} /></label>
    </div>
  );

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Étude 01" title="Research Analytics" subtitle="Plan factoriel : cultures × invasions × budgets × stratégies" />
      <StudyTabs />
      <div className="mt-4"><ResearchAnnotation>
        <strong>Source :</strong> {ref.data?.description ?? "…"} <Badge tone="green">vérifié</Badge> {ref.data?.verified}
        <span className="block font-mono text-[10.5px] opacity-80">{ref.data?.source} · sha256 {ref.data?.sha256.slice(0, 16)}…</span>
      </ResearchAnnotation></div>
      <Panel className="sticky top-0 z-20 mt-4 px-5 py-3 lg:top-2">{hdr}</Panel>
      {ref.loading ? <Skeleton className="mt-4 h-96" /> : (<>
        <Panel className="mt-4 px-5 py-4">
          <PanelTitle sub={`${CROP_LABEL[crop]} · régime ${remating} · moyenne ± écart-type (n = 3 répétitions par case) · témoin : budget 0`}
            right={<ChartExportMenu getSvg={() => hmRef.current} meta={{ title: `Matrice décisionnelle — ${m.label} (${CROP_LABEL[crop]})`, filename: `heatmap-${crop}-${metric}`, caption: `Plan factoriel du notebook, régime ${remating}, moyenne de 3 répétitions. ${m.unit}.` }} />}>
            Heatmap : invasion × budget × stratégie</PanelTitle>
          <div className="mt-3"><Heatmap ref={hmRef} rows={hmRows.map(({ i, b }) => `${i.split(" (")[0]} · ${fmtInt(b)}`)} cols={["Témoin", ...strategies.map((k) => meta?.strategies[k].short ?? k)]}
            values={hm.map((r) => r.map((c) => (c.n ? c.mean : null)))} sd={hm.map((r) => r.map((c) => (c.n ? c.sd : null)))}
            domain={[0, Math.max(m.max === 300000 ? Math.max(...hm.flat().map((c) => c.mean || 0)) : m.max, 1)]} palette={m.palette} unit={m.unit.replace("% des fruits", "%")}
            ariaLabel={`Heatmap ${m.label}`} colGroupLabel="Stratégie de distribution (budget identique par ligne)" /></div>
        </Panel>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel className="px-5 py-4">
            <PanelTitle sub="Intensité de l'intervention (mâles stériles / saison) → réponse modélisée · barres : ± écart-type"
              right={<div className="flex items-center gap-2"><div className="w-40"><Select label="Invasion" value={inv} onChange={setInvasion} options={invasions.map((i) => ({ value: i, label: i.split(" (")[0] }))} /></div>
                <ChartExportMenu getSvg={() => drRef.current} meta={{ title: `Dose-réponse — ${m.label} (${CROP_LABEL[crop]}, invasion ${inv.split(" (")[0]})`, filename: `dose-reponse-${crop}`, caption: `Budget 0 = témoin sans TIS, commun à toutes les stratégies. Moyenne ± écart-type, 3 répétitions, régime ${remating}.` }} /></div>}>
              Courbes dose-réponse</PanelTitle>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">{dose.map((d) => <span key={d.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.label}</span>)}</div>
            <TimeSeriesChart ref={drRef} series={dose} height={320} xLabel="Budget (mâles stériles par saison)" yLabel={`${m.label} (${m.unit})`} errorBars showMarkers curve="linear" showBands={false} zoomable={false}
              xFormat={(v) => fmtInt(v)} valueFormat={(v) => fmt(v, 1)} ariaLabel="Courbes dose-réponse du budget" />
          </Panel>

          <Panel className="px-5 py-4">
            <PanelTitle sub="Compromis entre pourris avec larves et pourris par piqûres stériles · moyenne par scénario · taille ∝ budget"
              right={<ChartExportMenu getSvg={() => paRef.current} meta={{ title: `Front de Pareto — ${CROP_LABEL[crop]}`, filename: `pareto-${crop}`, caption: "Points cerclés : scénarios non dominés (minimisation des deux axes). Plan factoriel du notebook." }} />}>
              Frontière de Pareto</PanelTitle>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">{strategies.map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STRATEGY_COLOR[k] }} />{label(k)}</span>)}
              <span className="flex items-center gap-1.5 text-muted"><svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke="#1B201C" strokeDasharray="5 3" /></svg>front non dominé</span></div>
            <ScatterChart ref={paRef} points={pCrop} frontier={frontier} xLabel="Pourris avec larves (% des fruits)" yLabel="Pourris piqûres stériles seules (%)" ariaLabel="Frontière de Pareto" height={320} />
            <p className="text-[11.5px] text-muted">Critère : minimiser simultanément les deux axes. {frontier.length} scénario(s) non dominé(s) sur {pCrop.length}. Les autres scénarios sont dominés sur ces deux critères seulement.</p>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel className="px-5 py-4">
            <PanelTitle sub={`Valeurs de chaque répétition (points) et moyenne (trait) · invasion ${inv.split(" (")[0]}`}
              right={<div className="flex items-center gap-2"><div className="w-64"><Segmented size="sm" label="Budget" value={String(budget)} onChange={(v) => setBudget(Number(v))} options={budgets.filter((b) => b > 0).map((b) => ({ value: String(b), label: fmtInt(b) }))} /></div>
                <ChartExportMenu getSvg={() => stRef.current} meta={{ title: `Distribution des répétitions — ${m.label}`, filename: `repetitions-${crop}` }} /></div>}>
              Incertitude entre répétitions</PanelTitle>
            <StripPlot ref={stRef} data={strip.map((s) => ({ label: s.k === "no_tis" ? "Témoin" : meta?.strategies[s.k].short ?? s.k, color: STRATEGY_COLOR[s.k], values: s.vals }))} unit={m.unit} />
            <p className="text-[11.5px] text-muted">Avec 3 répétitions, ni quartiles ni intervalles de confiance ne sont calculés : les valeurs individuelles sont affichées.</p>
          </Panel>
          <Panel className="px-5 py-4">
            <PanelTitle sub={`Effet du mode d'utilisation du sperme · ${CROP_LABEL[crop]}, invasion ${inv.split(" (")[0]}, budget ${fmtInt(budget)}`}>Sensibilité au réaccouplement</PanelTitle>
            <table className="mt-3 w-full text-[12.5px]">
              <thead><tr className="border-b border-line text-left text-[11.5px] text-muted"><th className="py-1.5 font-medium">Stratégie</th><th className="py-1.5 text-right font-medium">preference</th><th className="py-1.5 text-right font-medium">first</th><th className="py-1.5 text-right font-medium">Écart (pref. − first)</th></tr></thead>
              <tbody>{sens.map((s) => (
                <tr key={s.k} className="border-b border-line/60"><td className="py-1.5">{label(s.k)}</td><td className="py-1.5 text-right tnum">{fmt(s.pref, 1)}</td><td className="py-1.5 text-right tnum">{fmt(s.first, 1)}</td>
                  <td className="py-1.5 text-right tnum"><span className="inline-flex items-center gap-2"><span className="inline-block h-2 rounded-sm" style={{ width: Math.min(80, Math.abs(s.pref - s.first) * 6), background: s.pref - s.first < 0 ? "#BF532E" : "#347A55" }} />{fmt(s.pref - s.first, 1)}</span></td></tr>))}</tbody>
            </table>
            <p className="mt-2 text-[11.5px] text-muted">{m.unit}. Différence des moyennes (3 répétitions par régime), sans test statistique.</p>
            <div className="mt-4 rounded-md border border-dashed border-line bg-white/60 px-4 py-3 text-[12px] text-muted">
              <strong className="text-ink">Sensibilité paramétrique (η, durées de vie, taux de pourrissement).</strong> Le plan factoriel du notebook ne fait pas varier ces paramètres : aucune analyse n’est affichée.
              Créez des variantes en Mode Avancé du <Link className="text-forest underline" to="/simulation">Studio</Link> puis comparez-les dans le <Link className="text-forest underline" to="/comparaison">Comparison Lab</Link>.
            </div>
          </Panel>
        </div>

        <Panel className="mt-4 px-5 py-4">
          <PanelTitle>Méthodes statistiques appliquées</PanelTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed">
            <li>Moyenne arithmétique et écart-type corrigé (n − 1) entre répétitions indépendantes, pour chaque scénario.</li>
            <li>Variation relative au témoin appariée par répétition (même graine) dans les expériences de l’application.</li>
            <li>Front de Pareto : dominance stricte sur deux critères à minimiser, calculée sur les moyennes.</li>
            <li>Aucun test d’hypothèse, p-value, intervalle de confiance ni corrélation n’est calculé : avec n = 3, ces quantités ne seraient pas fiables. <ScientificTooltip content="Le notebook indique un écart-type entre réplicats d'environ 0,65 point sur la récolte saine à l'échelle 1 ; il ne réalise pas de test statistique." /></li>
          </ul>
        </Panel>
      </>)}
    </>
  );
}

function paretoFront(p: ScatterPoint[]) {
  const nd = p.filter((a) => !p.some((b) => b !== a && b.x <= a.x && b.y <= a.y && (b.x < a.x || b.y < a.y)));
  return nd.sort((a, b) => a.x - b.x).map((d) => d.id);
}

const StripPlot = forwardRef<SVGSVGElement, { data: { label: string; color: string; values: number[] }[]; unit: string }>(function StripPlot({ data, unit }, ref) {
  const W = 640, H = 260, L = 56, B = 40, T = 12;
  const all = data.flatMap((d) => d.values);
  const max = Math.max(1, ...all) * 1.08, min = Math.min(0, ...all);
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const bw = (W - L - 10) / data.length;
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Distribution des répétitions par stratégie">
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} stroke="#E3E8E1" /><text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="tnum">{fmt(t, max > 100 ? 0 : 1)}</text></g>)}
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="#1B201C" /><line x1={L} x2={W - 10} y1={H - B} y2={H - B} stroke="#1B201C" />
      {data.map((d, i) => {
        const cx = L + bw * (i + 0.5); const mean = d.values.reduce((a, b) => a + b, 0) / (d.values.length || 1);
        return (
          <g key={d.label}>
            {d.values.map((v, j) => <circle key={j} cx={cx - 12 + (j * 24) / Math.max(1, d.values.length - 1)} cy={y(v)} r={4.5} fill={d.color} fillOpacity={0.7} stroke="#fff"><title>{`${d.label} — répétition ${j + 1} : ${fmt(v, 2)}`}</title></circle>)}
            {d.values.length > 0 && <line x1={cx - 22} x2={cx + 22} y1={y(mean)} y2={y(mean)} stroke="#1B201C" strokeWidth={2.2} />}
            <text x={cx} y={H - B + 17} textAnchor="middle" fontSize={11}>{d.label}</text>
          </g>
        );
      })}
      <text transform={`translate(14,${(H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12}>{unit}</text>
    </svg>
  );
});
