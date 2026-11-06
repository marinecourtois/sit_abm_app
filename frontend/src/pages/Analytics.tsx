import { forwardRef, useMemo, useRef, useState } from "react";
import type { Meta } from "../lib/api";
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
import { INDICATOR, INDICATORS, diffUnit, stats, type Indicator, type Row } from "../lib/indicators";

const val = (r: Row, k: string) => INDICATOR[k].value(r);

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
  const nRep = new Set(rows.map((r) => r.Replicate)).size;   // répétitions réellement présentes dans le fichier
  const invasions = useMemo(() => Array.from(new Set(rows.map((r) => String(r.Invasion)))).sort((a, b) => parseInt(a.split("(")[1]) - parseInt(b.split("(")[1])), [rows]);
  const inv = invasion || invasions[1] || "";
  const budgets = useMemo(() => Array.from(new Set(rows.map((r) => Number(r.Budget)))).sort((a, b) => a - b), [rows]);
  const sub = rows.filter((r) => r.Crop === crop && r.Remating === remating);
  const group = (f: (r: Row) => boolean, k = metric) => stats(sub.filter(f).map((r) => val(r, k)));
  const strategies = STRATEGY_ORDER.filter((k) => k !== "no_tis");
  const m = INDICATOR[metric];
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

  const hdr = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
        <div className="w-56 text-[12px]"><span className="text-muted">Culture</span>
          <Segmented size="sm" label="Culture" value={crop} onChange={setCrop} options={[{ value: "strawberry", label: "Fraise" }, { value: "cherry", label: "Cerise" }]} /></div>
        <label className="w-[22rem] text-[12px]"><span className="text-muted">Indicateur</span>
          <Select label="Indicateur" value={metric} onChange={setMetric} options={INDICATORS.map((v) => ({ value: v.key, label: v.label }))} /></label>
        <div className="w-64 text-[12px]"><span className="text-muted">Réaccouplement (heatmap, dose-réponse, Pareto)</span>
          <Segmented size="sm" label="Régime de réaccouplement" value={remating} onChange={setRemating}
            options={["preference", "first"].map((k) => ({ value: k, label: meta?.remating[k]?.short ?? k }))} /></div>
      </div>
      <p className="rounded bg-[#F3F5EF] px-3 py-1.5 text-[12px] leading-snug text-ink">
        <strong>{m.label}</strong> <span className="text-muted">({m.unit})</span> — {m.definition}
        {m.unit.startsWith("%") && <span className="text-muted"> Fruits produits sur la saison : {fmtInt(Number(meta?.crops[crop].params.total_fruits))}.</span>}
      </p>
    </div>
  );

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Étude 01" title="Research Analytics" subtitle="Plan factoriel : cultures × invasions × budgets × stratégies" />
      <StudyTabs />
      <div className="mt-4"><ResearchAnnotation>
        <strong>Source :</strong> {ref.data?.description ?? "…"} <Badge tone="green">vérifié</Badge> {ref.data?.verified}
        <span className="block font-mono text-[10.5px] opacity-80">{ref.data?.source} · sha256 {ref.data?.sha256.slice(0, 16)}…</span>
        {ref.data?.provenance && <span className="block font-mono text-[10.5px] opacity-80">calculé le {String(ref.data.provenance.computed_at)} · moteur {String(ref.data.provenance.engine_version)} · modelly {String(ref.data.provenance.modelly_version)} · {String(ref.data.provenance.duration_s)} s</span>}
        {ref.data?.origin === "notebook" && nRep < (meta?.limits.replicates[0] ?? 0) && <span className="mt-1 block font-semibold text-[#6B4E16]">Attention : ce fichier ne contient que {nRep} répétitions, sous le minimum de l’étude ({meta?.limits.replicates[0]}). Lancer <code>make factorial</code> pour le recalculer.</span>}
      </ResearchAnnotation></div>
      <Panel className="sticky top-0 z-20 mt-4 px-5 py-3 lg:top-2">{hdr}</Panel>
      {ref.loading ? <Skeleton className="mt-4 h-96" /> : (<>
        <Panel className="mt-4 px-5 py-4">
          <PanelTitle sub={`${CROP_LABEL[crop]} · régime ${remating} · moyenne ± écart-type (n = ${nRep} répétitions par case) · témoin : budget 0`}
            right={<ChartExportMenu getSvg={() => hmRef.current} meta={{ title: `Matrice décisionnelle — ${m.label} (${CROP_LABEL[crop]})`, filename: `heatmap-${crop}-${metric}`, caption: `Plan factoriel du notebook, régime ${remating}, moyenne de ${nRep} répétitions. ${m.unit}.` }} />}>
            Heatmap : invasion × budget × stratégie</PanelTitle>
          <div className="mt-3"><Heatmap ref={hmRef} rows={hmRows.map(({ i, b }) => `${i.split(" (")[0]} · ${fmtInt(b)}`)} cols={["Témoin", ...strategies.map((k) => meta?.strategies[k].short ?? k)]}
            values={hm.map((r) => r.map((c) => (c.n ? c.mean : null)))} sd={hm.map((r) => r.map((c) => (c.n ? c.sd : null)))}
            domain={[0, Math.max(m.unit.startsWith("%") ? Math.min(100, Math.ceil(Math.max(...hm.flat().map((c) => c.mean || 0)) / 5) * 5) : Math.max(...hm.flat().map((c) => c.mean || 0)), 1)]} palette={m.palette} unit={m.unit.startsWith("%") ? "%" : "larves"}
            ariaLabel={`Heatmap ${m.label}`} colGroupLabel="Stratégie de distribution (budget identique par ligne)" /></div>
        </Panel>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel className="px-5 py-4">
            <PanelTitle sub="Intensité de l'intervention (mâles stériles / saison) → réponse modélisée · barres : ± écart-type"
              right={<div className="flex items-center gap-2"><div className="w-40"><Select label="Invasion" value={inv} onChange={setInvasion} options={invasions.map((i) => ({ value: i, label: i.split(" (")[0] }))} /></div>
                <ChartExportMenu getSvg={() => drRef.current} meta={{ title: `Dose-réponse — ${m.label} (${CROP_LABEL[crop]}, invasion ${inv.split(" (")[0]})`, filename: `dose-reponse-${crop}`, caption: `Budget 0 = témoin sans TIS, commun à toutes les stratégies. Moyenne ± écart-type, ${nRep} répétitions, régime ${remating}.` }} /></div>}>
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
            <p className="text-[11.5px] text-muted">Avec {nRep} répétitions, ni quartiles ni intervalles de confiance ne sont calculés : les valeurs individuelles sont affichées.</p>
          </Panel>
          <Panel className="px-5 py-4">
            <PanelTitle sub="Paramètres biologiques (η, durées de vie, taux de pourrissement…)">Sensibilité paramétrique</PanelTitle>
            <div className="mt-3 rounded-md border border-dashed border-line bg-white/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
              Le plan factoriel du notebook ne fait varier que la culture, l’invasion, le budget, la stratégie et le régime de réaccouplement : aucune
              sensibilité aux paramètres biologiques ne peut en être tirée, donc aucune n’est affichée. Pour l’étudier, créez des variantes d’un même
              scénario dans le <Link className="text-forest underline" to="/simulation">Studio</Link> (Mode Avancé, un paramètre à la fois) puis comparez-les
              dans le <Link className="text-forest underline" to="/comparaison">Comparison Lab</Link>.
            </div>
          </Panel>
        </div>

        {meta && <PolyMonoSection rows={rows} meta={meta} metric={metric} invasions={invasions} budgets={budgets.filter((b) => b > 0)} isK={isK} nRep={nRep} />}

        <Panel className="mt-4 px-5 py-4">
          <PanelTitle>Méthodes statistiques appliquées</PanelTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed">
            <li>Moyenne arithmétique et écart-type corrigé (n − 1) entre répétitions indépendantes, pour chaque scénario.</li>
            <li>Variation relative au témoin appariée par répétition (même graine) dans les expériences de l’application.</li>
            <li>Front de Pareto : dominance stricte sur deux critères à minimiser, calculée sur les moyennes.</li>
            <li>Aucun test d’hypothèse, p-value, intervalle de confiance ni corrélation n’est calculé : avec n = {nRep}, ces quantités ne seraient pas fiables. <ScientificTooltip content="Le notebook indique un écart-type entre réplicats d'environ 0,65 point sur la récolte saine à l'échelle 1 ; il ne réalise pas de test statistique." /></li>
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
            {d.values.map((v, j) => <circle key={j} className="m-pop" style={{ animationDelay: `${(i * 4 + j) * 18}ms` }} cx={cx - 12 + (j * 24) / Math.max(1, d.values.length - 1)} cy={y(v)} r={4.5} fill={d.color} fillOpacity={0.7} stroke="#fff"><title>{`${d.label} — répétition ${j + 1} : ${fmt(v, 2)}`}</title></circle>)}
            {d.values.length > 0 && <line x1={cx - 22} x2={cx + 22} y1={y(mean)} y2={y(mean)} stroke="#1B201C" strokeWidth={2.2} />}
            <text x={cx} y={H - B + 17} textAnchor="middle" fontSize={11}>{d.label}</text>
          </g>
        );
      })}
      <text transform={`translate(14,${(H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12}>{unit}</text>
    </svg>
  );
});

/* ---------------------------------------------------------------- Polyandrie vs monandrie
 * Reproduit la figure 1 du notebook (cellule 11) : pour chaque culture et chaque stratégie, les
 * répétitions des deux régimes de réaccouplement (points) et leur moyenne (trait), même invasion
 * et même budget. Le témoin (sans stériles) est le même modèle dans les deux régimes : son écart
 * mesure la seule variabilité entre répétitions. */
const REGIMES = [
  { key: "preference", color: "#BF532E", shape: "circle" as const },
  { key: "first", color: "#145A3D", shape: "triangle" as const },
];

function PolyMonoSection({ rows, meta, metric, invasions, budgets, isK, nRep }: {
  rows: Row[]; meta: Meta; metric: string; invasions: string[]; budgets: number[]; isK: (r: Row, k: string) => boolean; nRep: number;
}) {
  const [inv, setInv] = useState("");
  const [budget, setBudget] = useState(9000);
  const ind = INDICATOR[metric];
  const invasion = inv || invasions[1] || invasions[0] || "";
  const order = STRATEGY_ORDER;
  const data = (crop: string) => order.map((k) => ({
    k,
    regimes: REGIMES.map((g) => stats(rows.filter((r) => r.Crop === crop && r.Remating === g.key && r.Invasion === invasion
      && (k === "no_tis" ? isK(r, "no_tis") : Number(r.Budget) === budget && isK(r, k))).map((r) => ind.value(r)))),
  }));
  return (
    <Panel className="mt-4 px-5 py-4" aria-labelledby="polymono-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="polymono-h" className="font-serif text-[21px] font-semibold">Polyandrie vs monandrie</h2>
          <p className="font-serif text-[13.5px] text-muted">Effet du régime de réaccouplement des femelles sur « {ind.label} » · {nRep} répétitions par point · figure 1 du notebook</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64 text-[12px]"><span className="text-muted">Invasion</span>
            <Segmented size="sm" label="Invasion" value={invasion} onChange={setInv} options={invasions.map((i) => ({ value: i, label: i.split(" (")[0] }))} /></div>
          <div className="w-64 text-[12px]"><span className="text-muted">Budget (mâles stériles / saison)</span>
            <Segmented size="sm" label="Budget" value={String(budget)} onChange={(v) => setBudget(Number(v))} options={budgets.map((b) => ({ value: String(b), label: fmtInt(b) }))} /></div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {REGIMES.map((g) => (
          <div key={g.key} className="flex gap-2.5 rounded-md border border-line bg-white px-3 py-2">
            <svg width="14" height="14" className="mt-0.5 shrink-0" aria-hidden>{g.shape === "circle" ? <circle cx="7" cy="7" r="5" fill={g.color} /> : <path d="M7 1.5 12.5 12H1.5Z" fill={g.color} />}</svg>
            <div className="text-[12px] leading-snug"><strong>{meta.remating[g.key].short}</strong> <span className="text-muted">({g.key})</span> — {meta.remating[g.key].description}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        {(["strawberry", "cherry"] as const).map((crop) => {
          const d = data(crop);
          return (
            <section key={crop} aria-label={meta.crops[crop].label}>
              <h3 className="font-serif text-[17px] font-semibold">{meta.crops[crop].label} <span className="text-[13px] font-normal italic text-muted">{meta.crops[crop].latin}</span></h3>
              <DodgedStrip crop={crop} data={d} ind={ind} labels={Object.fromEntries(order.map((k) => [k, meta.strategies[k].short]))} title={`${ind.label} — ${meta.crops[crop].label}, invasion ${invasion.split(" (")[0]}, budget ${fmtInt(budget)}`} />
              <table className="mt-2 w-full text-[12.5px]">
                <caption className="sr-only">Moyennes par régime et écart</caption>
                <thead><tr className="border-b border-line text-left text-[11.5px] text-muted">
                  <th className="py-1.5 font-medium">Stratégie</th>
                  <th className="py-1.5 text-right font-medium">{meta.remating.preference.short}<div className="font-normal">moy. ± é.-t.</div></th>
                  <th className="py-1.5 text-right font-medium">{meta.remating.first.short}<div className="font-normal">moy. ± é.-t.</div></th>
                  <th className="py-1.5 text-right font-medium">Écart polyandrie − monandrie<div className="font-normal">{diffUnit(ind)}</div></th>
                </tr></thead>
                <tbody>{d.map(({ k, regimes: [p, f] }) => {
                  const diff = p.mean - f.mean;
                  const worse = ind.higherIsBetter ? diff < 0 : diff > 0;
                  return (
                    <tr key={k} className="border-b border-line/60">
                      <td className="py-1.5">{meta.strategies[k].label}{k === "no_tis" && <span className="block text-[10.5px] text-muted">même modèle dans les deux régimes : écart = variabilité</span>}</td>
                      <td className="py-1.5 text-right tnum">{fmt(p.mean, ind.unit.startsWith("%") ? 1 : 0)}<span className="text-muted"> ± {fmt(p.sd, 1)}</span></td>
                      <td className="py-1.5 text-right tnum">{fmt(f.mean, ind.unit.startsWith("%") ? 1 : 0)}<span className="text-muted"> ± {fmt(f.sd, 1)}</span></td>
                      <td className="py-1.5 text-right tnum">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-2 rounded-sm" style={{ width: Math.min(70, Math.abs(diff) * (ind.unit.startsWith("%") ? 7 : 0.002)), background: worse ? "#BF532E" : "#347A55" }} />
                          {diff > 0 ? "+" : diff < 0 ? "−" : ""}{fmt(Math.abs(diff), ind.unit.startsWith("%") ? 1 : 0)}
                        </span>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
        Écart en terre cuite : la polyandrie est défavorable pour cet indicateur ; en vert : favorable. Différence de moyennes entre {nRep} répétitions
        de chaque régime, sans test statistique ; comparez-la à l’écart du témoin, qui ne reflète que la variabilité entre répétitions.
      </p>
    </Panel>
  );
}

function DodgedStrip({ crop, data, ind, labels, title }: { crop: string; data: { k: string; regimes: ReturnType<typeof stats>[] }[]; ind: Indicator; labels: Record<string, string>; title: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const I = ind;
  const W = 640, H = 250, L = 58, B = 34, T = 10, R = 8;
  const all = data.flatMap((d) => d.regimes.flatMap((g) => g.values));
  const max = Math.max(1, ...all) * 1.06;
  const min = Math.min(0, ...all);
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const bw = (W - L - R) / data.length;
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5);
  const isPct = I.unit.startsWith("%");
  return (
    <figure className="mt-1">
      <div className="flex justify-end"><ChartExportMenu getSvg={() => ref.current} meta={{ title, filename: `polyandrie-monandrie-${crop}`, caption: `${I.label} (${I.unit}). Points : répétitions ; trait : moyenne. Cercles : polyandrie (preference) ; triangles : monandrie (first).` }} /></div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E3E8E1" /><text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="tnum" fill="#1B201C">{fmt(t, isPct ? 0 : 0)}</text></g>)}
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="#1B201C" /><line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#1B201C" />
        {data.map((d, i) => (
          <g key={d.k}>
            {i === 1 && <line x1={L + bw * i} x2={L + bw * i} y1={T} y2={H - B} stroke="#9AA59D" strokeDasharray="3 3" />}
            {d.regimes.map((g, j) => {
              const cx = L + bw * (i + 0.5) + (j === 0 ? -bw * 0.18 : bw * 0.18);
              const reg = REGIMES[j];
              return (
                <g key={j}>
                  {g.values.map((v, n) => {
                    const jx = cx + ((n * 37) % 11 - 5) * (bw * 0.012);
                    return reg.shape === "circle"
                      ? <circle key={n} className="m-pop" style={{ animationDelay: `${(i * 2 + j) * 40 + n * 12}ms` }} cx={jx} cy={y(v)} r={3.2} fill={reg.color} fillOpacity={0.55}><title>{`${labels[d.k]} · ${reg.key} · rép. ${n + 1} : ${fmt(v, 2)}`}</title></circle>
                      : <path key={n} className="m-pop" style={{ animationDelay: `${(i * 2 + j) * 40 + n * 12}ms` }} d={`M${jx},${y(v) - 3.6}L${jx + 3.4},${y(v) + 2.6}L${jx - 3.4},${y(v) + 2.6}Z`} fill={reg.color} fillOpacity={0.55}><title>{`${labels[d.k]} · ${reg.key} · rép. ${n + 1} : ${fmt(v, 2)}`}</title></path>;
                  })}
                  {g.n > 0 && <line x1={cx - bw * 0.13} x2={cx + bw * 0.13} y1={y(g.mean)} y2={y(g.mean)} stroke={reg.color} strokeWidth={2.6} strokeLinecap="round" />}
                </g>
              );
            })}
            <text x={L + bw * (i + 0.5)} y={H - B + 16} textAnchor="middle" fontSize={11} fill="#1B201C">{labels[d.k]}</text>
          </g>
        ))}
        <text transform={`translate(14,${(H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="#1B201C">{I.unit}</text>
      </svg>
    </figure>
  );
}
