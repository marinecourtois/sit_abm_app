import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Meta } from "../../lib/api";
import { CROP_LABEL, fmt, fmtInt } from "../../lib/format";
import { INDICATOR, INDICATORS, diffUnit, stats, type Indicator, type Row } from "../../lib/indicators";
import { invasionShort, paretoFront, synthesize, type AnalysisDataset, type AnalysisStrategy } from "../../lib/analysis";
import { CROP_COLOR } from "../../lib/colors";
import { Panel, PanelTitle, ScientificTooltip, Segmented, Select } from "../ui";
import { Heatmap } from "../charts/Heatmap";
import { ScatterChart, type ScatterPoint } from "../charts/ScatterChart";
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { ChartExportMenu } from "../charts/ChartExportMenu";

const MARKERS = ["circle", "square", "triangle", "diamond"] as const;

export interface AnalysisSelection { crop: string; remating: string; invasion: string; budget: number; metric: string }
const short = invasionShort;

/**
 * Graphiques d'analyse d'un plan (cultures × invasions × budgets × stratégies × régimes) :
 * heatmap, dose-réponse, front de Pareto, incertitude entre répétitions, polyandrie vs monandrie.
 * Utilisés par la page Analyses (plan factoriel de référence) et par la page d'une simulation
 * (ses propres répétitions). Chaque graphique n'utilise que les dimensions présentes dans les
 * données et dit ce qu'il manque quand une dimension n'a qu'une valeur.
 */
export function AnalysisSuite({ data, meta, source, exportPrefix, planHint, aside, sticky = true }: {
  data: AnalysisDataset; meta: Meta;
  /** Origine des données, reprise dans les légendes des exports. */
  source: string;
  exportPrefix: string;
  /** Lien ou texte expliquant comment ajouter une dimension manquante (budgets, invasions, régimes). */
  planHint?: ReactNode;
  /** Panneau affiché à côté du graphique d'incertitude (reçoit la sélection courante). */
  aside?: ReactNode | ((sel: AnalysisSelection) => ReactNode);
  sticky?: boolean;
}) {
  const { rows, strategies, crops, invasions, budgets, regimes, nRep } = data;
  const [crop, setCrop] = useState(crops[0] ?? "strawberry");
  const [metric, setMetric] = useState("harvested_clean_pct");
  const [remating, setRemating] = useState(regimes.includes("preference") ? "preference" : regimes[0] ?? "preference");
  const [invasion, setInvasion] = useState("");
  const tis = budgets.filter((b) => b > 0);
  const [budget, setBudget] = useState(tis.includes(9000) ? 9000 : tis[0] ?? 0);
  useEffect(() => { if (!crops.includes(crop) && crops[0]) setCrop(crops[0]); }, [crops.join()]);
  useEffect(() => { if (!regimes.includes(remating) && regimes[0]) setRemating(regimes[0]); }, [regimes.join()]);
  useEffect(() => { if (!tis.includes(budget) && tis.length) setBudget(tis.includes(9000) ? 9000 : tis[0]); }, [tis.join()]);
  const hmRef = useRef<SVGSVGElement>(null), drRef = useRef<SVGSVGElement>(null), paRef = useRef<SVGSVGElement>(null), stRef = useRef<SVGSVGElement>(null);

  const inv = invasions.includes(invasion) ? invasion : invasions[Math.min(1, invasions.length - 1)] ?? "";
  const control = strategies.find((s) => s.control);
  const treated = strategies.filter((s) => !s.control);
  const m = INDICATOR[metric];
  const val = (r: Row, k = metric) => INDICATOR[k].value(r);
  const sub = useMemo(() => rows.filter((r) => r.Crop === crop && r.Remating === remating), [rows, crop, remating]);
  const group = (f: (r: Row) => boolean, k = metric) => stats(sub.filter(f).map((r) => val(r, k)));
  const is = (r: Row, s: AnalysisStrategy) => r.Strategy === s.id;

  // Heatmap : lignes = invasion × budget, colonnes = témoin (s'il existe) + stratégies
  const hmRows = invasions.flatMap((i) => tis.map((b) => ({ i, b })));
  const cols = [...(control ? [control] : []), ...treated];
  const hm = hmRows.map(({ i, b }) => cols.map((s) => group((r) => r.Invasion === i && is(r, s) && (s.control || Number(r.Budget) === b))));
  const hmMax = Math.max(1, ...hm.flat().map((c) => (c.n ? c.mean : 0)));

  // Dose-réponse : budget 0 = témoin, commun à toutes les stratégies
  const xs = control ? budgets : tis;
  const dose = treated.map((s, n) => {
    const pts = xs.map((b) => ({ b, g: b === 0 ? group((r) => r.Invasion === inv && is(r, control!)) : group((r) => r.Invasion === inv && Number(r.Budget) === b && is(r, s)) })).filter((p) => p.g.n > 0);
    return { id: s.id, label: s.label, color: s.color, x: pts.map((p) => p.b), y: pts.map((p) => p.g.mean), sd: pts.map((p) => p.g.sd), marker: MARKERS[n % MARKERS.length] };
  });
  const doseOk = dose.some((d) => d.x.length > 1);

  // Pareto : dommages larvaires vs pourris par piqûres stériles (moyennes par scénario)
  const pts: ScatterPoint[] = [];
  for (const i of invasions) for (const b of tis) for (const s of treated) {
    const g = sub.filter((r) => r.Invasion === i && Number(r.Budget) === b && is(r, s));
    if (!g.length) continue;
    pts.push({ id: `${crop}|${i}|${b}|${s.id}`, x: stats(g.map((r) => val(r, "rotten_larvae_pct"))).mean, y: stats(g.map((r) => val(r, "rotten_sterile_only_pct"))).mean,
      size: b, color: s.color, shape: crop === "strawberry" ? "circle" : "triangle", group: crop,
      label: `${CROP_LABEL[crop]} · ${s.label}`, detail: [`Invasion ${short(i)}`, `Budget ${fmtInt(b)} stériles`, `n = ${g.length} répétitions`] });
  }
  const frontier = paretoFront(pts);

  // Distribution des répétitions
  const strip = cols.map((s) => ({ s, vals: sub.filter((r) => r.Invasion === inv && is(r, s) && (s.control || Number(r.Budget) === budget)).map((r) => val(r)) }));

  const fixed = [
    invasions.length === 1 && `invasion ${short(invasions[0])}`,
    tis.length === 1 && `budget ${fmtInt(tis[0])}`,
    regimes.length === 1 && `régime ${meta.remating[regimes[0]]?.short ?? regimes[0]}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <Panel className={`${sticky ? "sticky top-0 z-20 lg:top-2" : ""} mt-4 px-5 py-3`}>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
            {crops.length > 1 && <div className="w-56 text-[12px]"><span className="text-muted">Culture</span>
              <Segmented size="sm" label="Culture" value={crop} onChange={setCrop} options={crops.map((c) => ({ value: c, label: CROP_LABEL[c] }))} /></div>}
            <label className="w-[22rem] max-w-full text-[12px]"><span className="text-muted">Indicateur</span>
              <Select label="Indicateur" value={metric} onChange={setMetric} options={INDICATORS.map((v) => ({ value: v.key, label: v.label }))} /></label>
            {regimes.length > 1 && <div className="w-64 text-[12px]"><span className="text-muted">Réaccouplement (heatmap, dose-réponse, Pareto)</span>
              <Segmented size="sm" label="Régime de réaccouplement" value={remating} onChange={setRemating}
                options={regimes.map((k) => ({ value: k, label: meta.remating[k]?.short ?? k }))} /></div>}
            {fixed.length > 0 && <p className="pb-1 text-[12px] text-muted">Fixés dans ce plan : {fixed.join(" · ")}{crops.length === 1 && ` · culture ${CROP_LABEL[crops[0]]}`}</p>}
          </div>
          <p className="rounded bg-[#F3F5EF] px-3 py-1.5 text-[12px] leading-snug text-ink">
            <strong>{m.label}</strong> <span className="text-muted">({m.unit})</span> — {m.definition}
            {m.unit.startsWith("%") && <span className="text-muted"> Fruits produits sur la saison : {fmtInt(Number(meta.crops[crop as "strawberry"]?.params.total_fruits))}.</span>}
          </p>
        </div>
      </Panel>

      <DecisionSynthesis data={data} meta={meta} metric={metric} invasion={inv} setInvasion={setInvasion} budget={budget} setBudget={setBudget} budgets={tis} planHint={planHint} />

      <Panel className="mt-4 px-5 py-4">
        <PanelTitle sub={`${CROP_LABEL[crop]} · régime ${remating} · moyenne ± écart-type (n = ${nRep} répétitions par case)${control ? " · témoin : budget 0" : ""}`}
          right={<ChartExportMenu getSvg={() => hmRef.current} meta={{ title: `Matrice décisionnelle — ${m.label} (${CROP_LABEL[crop]})`, filename: `${exportPrefix}heatmap-${crop}-${metric}`, caption: `${source}, régime ${remating}, moyenne de ${nRep} répétitions. ${m.unit}.` }} />}>
          Heatmap : invasion × budget × stratégie</PanelTitle>
        {hmRows.length ? (
          <div className="mt-3"><Heatmap ref={hmRef} rows={hmRows.map(({ i, b }) => `${short(i)} · ${fmtInt(b)}`)} cols={cols.map((s) => (s.control ? "Témoin" : s.short))}
            values={hm.map((r) => r.map((c) => (c.n ? c.mean : null)))} sd={hm.map((r) => r.map((c) => (c.n ? c.sd : null)))}
            domain={[0, m.unit.startsWith("%") ? Math.min(100, Math.ceil(hmMax / 5) * 5) : hmMax]} palette={m.palette} unit={m.unit.startsWith("%") ? "%" : "larves"}
            ariaLabel={`Heatmap ${m.label}`} colGroupLabel="Stratégie de distribution (budget identique par ligne)" /></div>
        ) : <Missing>Aucun scénario avec lâchers dans ces données.</Missing>}
        {hmRows.length === 1 && <Missing>Une seule ligne : ce plan n’a qu’une invasion et qu’un budget. {planHint}</Missing>}
      </Panel>

      {crops.length > 1 && <CropComparison data={data} meta={meta} metric={metric} remating={remating} invasion={inv} budget={budget} exportPrefix={exportPrefix} source={source} />}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel className="px-5 py-4">
          <PanelTitle sub="Intensité de l'intervention (mâles stériles / saison) → réponse modélisée · barres : ± écart-type"
            right={<div className="flex items-center gap-2">{invasions.length > 1 && <div className="w-40"><Select label="Invasion" value={inv} onChange={setInvasion} options={invasions.map((i) => ({ value: i, label: short(i) }))} /></div>}
              <ChartExportMenu getSvg={() => drRef.current} meta={{ title: `Dose-réponse — ${m.label} (${CROP_LABEL[crop]}, invasion ${short(inv)})`, filename: `${exportPrefix}dose-reponse-${crop}`, caption: `${source}. ${control ? "Budget 0 = témoin sans TIS, commun à toutes les stratégies. " : ""}Moyenne ± écart-type, ${nRep} répétitions, régime ${remating}.` }} /></div>}>
            Courbes dose-réponse</PanelTitle>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">{dose.map((d) => <span key={d.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.label}</span>)}</div>
          {dose.some((d) => d.x.length) ? (
            <TimeSeriesChart ref={drRef} series={dose} height={320} xLabel="Budget (mâles stériles par saison)" yLabel={`${m.label} (${m.unit})`} errorBars showMarkers curve="linear" showBands={false} zoomable={false}
              xFormat={(v) => fmtInt(v)} valueFormat={(v) => fmt(v, 1)} ariaLabel="Courbes dose-réponse du budget" />
          ) : <Missing>Aucun point à tracer.</Missing>}
          {!doseOk && <Missing>Un seul budget{control ? "" : " et pas de témoin"} : pas de courbe. {planHint}</Missing>}
          {doseOk && tis.length === 1 && <Missing>Deux points seulement (témoin et {fmtInt(tis[0])}) : ajoutez des budgets pour voir la forme de la courbe. {planHint}</Missing>}
        </Panel>

        <Panel className="px-5 py-4">
          <PanelTitle sub="Compromis entre pourris avec larves et pourris par piqûres stériles · moyenne par scénario · taille ∝ budget"
            right={<ChartExportMenu getSvg={() => paRef.current} meta={{ title: `Front de Pareto — ${CROP_LABEL[crop]}`, filename: `${exportPrefix}pareto-${crop}`, caption: `Points cerclés : scénarios non dominés (minimisation des deux axes). ${source}.` }} />}>
            Frontière de Pareto</PanelTitle>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">{treated.map((s) => <span key={s.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
            <span className="flex items-center gap-1.5 text-muted"><svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke="#1B201C" strokeDasharray="5 3" /></svg>front non dominé</span></div>
          <ScatterChart ref={paRef} points={pts} frontier={frontier} xLabel="Pourris avec larves (% des fruits)" yLabel="Pourris piqûres stériles seules (%)" ariaLabel="Frontière de Pareto" height={320} />
          <p className="text-[11.5px] text-muted">Critère : minimiser simultanément les deux axes. {frontier.length} scénario(s) non dominé(s) sur {pts.length}. Les autres scénarios sont dominés sur ces deux critères seulement.</p>
        </Panel>
      </div>

      <div className={`mt-4 grid gap-4 ${aside ? "xl:grid-cols-2" : ""}`} style={aside ? undefined : { maxWidth: 880 }}>
        <Panel className="px-5 py-4">
          <PanelTitle sub={`Valeurs de chaque répétition (points) et moyenne (trait) · invasion ${short(inv)}`}
            right={<div className="flex items-center gap-2">{tis.length > 1 && <div className="w-64"><Segmented size="sm" label="Budget" value={String(budget)} onChange={(v) => setBudget(Number(v))} options={tis.map((b) => ({ value: String(b), label: fmtInt(b) }))} /></div>}
              <ChartExportMenu getSvg={() => stRef.current} meta={{ title: `Distribution des répétitions — ${m.label}`, filename: `${exportPrefix}repetitions-${crop}`, caption: `${source}. Invasion ${short(inv)}, budget ${fmtInt(budget)}, régime ${remating}.` }} /></div>}>
            Incertitude entre répétitions</PanelTitle>
          <StripPlot ref={stRef} data={strip.map(({ s, vals }) => ({ label: s.control ? "Témoin" : s.short, color: s.color, values: vals }))} unit={m.unit} />
          <p className="text-[11.5px] text-muted">Avec {nRep} répétitions, ni quartiles ni intervalles de confiance ne sont calculés : les valeurs individuelles sont affichées.</p>
        </Panel>
        {typeof aside === "function" ? aside({ crop, remating, invasion: inv, budget, metric }) : aside}
      </div>

      {regimes.includes("preference") && regimes.includes("first")
        ? <PolyMonoSection rows={rows} meta={meta} metric={metric} crops={crops} invasions={invasions} budgets={tis} strategies={cols} nRep={nRep} exportPrefix={exportPrefix} />
        : (
          <Panel className="mt-4 px-5 py-4">
            <h2 className="font-serif text-[21px] font-semibold">Polyandrie vs monandrie</h2>
            <Missing>Cette comparaison demande les deux régimes de réaccouplement (polyandrie et monandrie) dans le même plan ; celui-ci n’utilise que « {meta.remating[regimes[0]]?.label ?? regimes[0]} ». {planHint}</Missing>
          </Panel>
        )}

      <Panel className="mt-4 px-5 py-4">
        <PanelTitle>Méthodes statistiques appliquées</PanelTitle>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed">
          <li>Moyenne arithmétique et écart-type corrigé (n − 1) entre répétitions indépendantes, pour chaque scénario.</li>
          <li>Variation relative au témoin appariée par répétition (même graine) dans les expériences de l’application.</li>
          <li>Front de Pareto : dominance stricte sur deux critères à minimiser, calculée sur les moyennes.</li>
          <li>Aucun test d’hypothèse, p-value, intervalle de confiance ni corrélation n’est calculé : avec n = {nRep}, ces quantités ne seraient pas fiables. <ScientificTooltip content="Le notebook indique un écart-type entre réplicats d'environ 0,65 point sur la récolte saine à l'échelle 1 ; il ne réalise pas de test statistique." /></li>
        </ul>
      </Panel>
    </>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="mt-2 rounded border border-dashed border-line bg-white/60 px-3 py-2 text-[12px] leading-snug text-muted">{children}</p>;
}

/** Lien « dupliquer en plan » pour compléter les dimensions manquantes d'une expérience. */
export function PlanHint({ id }: { id: string }) {
  return <Link className="text-forest underline" to={`/simulation?from=${id}&plan=1`}>Dupliquer en plan (plusieurs budgets, invasions, régimes)</Link>;
}

export const StripPlot = forwardRef<SVGSVGElement, { data: { label: string; color: string; values: number[] }[]; unit: string }>(function StripPlot({ data, unit }, ref) {
  const W = 640, H = 260, L = 56, B = 40, T = 12;
  const all = data.flatMap((d) => d.values);
  const max = Math.max(1, ...all) * 1.08, min = Math.min(0, ...all);
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const bw = (W - L - 10) / Math.max(1, data.length);
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Distribution des répétitions par stratégie">
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} stroke="#E3E8E1" /><text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="tnum">{fmt(t, max > 100 ? 0 : 1)}</text></g>)}
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="#1B201C" /><line x1={L} x2={W - 10} y1={H - B} y2={H - B} stroke="#1B201C" />
      {data.map((d, i) => {
        const cx = L + bw * (i + 0.5); const mean = d.values.reduce((a, b) => a + b, 0) / (d.values.length || 1);
        const n = d.values.length, spread = Math.min(bw * 0.55, 18 + n * 1.2), r = n > 20 ? 3.2 : 4.5;
        return (
          <g key={d.label + i}>
            {d.values.map((v, j) => <circle key={j} className="m-pop" style={{ animationDelay: `${(i * 4 + j) * 12}ms` }} cx={cx - spread / 2 + (j * spread) / Math.max(1, n - 1)} cy={y(v)} r={r} fill={d.color} fillOpacity={0.7} stroke="#fff"><title>{`${d.label} — répétition ${j + 1} : ${fmt(v, 2)}`}</title></circle>)}
            {n > 0 && <line x1={cx - spread / 2 - 8} x2={cx + spread / 2 + 8} y1={y(mean)} y2={y(mean)} stroke="#1B201C" strokeWidth={2.2} />}
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

function PolyMonoSection({ rows, meta, metric, crops, invasions, budgets, strategies, nRep, exportPrefix }: {
  rows: Row[]; meta: Meta; metric: string; crops: string[]; invasions: string[]; budgets: number[]; strategies: AnalysisStrategy[]; nRep: number; exportPrefix: string;
}) {
  const [inv, setInv] = useState("");
  const [budget, setBudget] = useState(9000);
  const ind = INDICATOR[metric];
  const invasion = invasions.includes(inv) ? inv : invasions[Math.min(1, invasions.length - 1)] ?? "";
  const b = budgets.includes(budget) ? budget : budgets.includes(9000) ? 9000 : budgets[0];
  const data = (crop: string) => strategies.map((s) => ({
    s,
    regimes: REGIMES.map((g) => stats(rows.filter((r) => r.Crop === crop && r.Remating === g.key && r.Invasion === invasion && r.Strategy === s.id
      && (s.control || Number(r.Budget) === b)).map((r) => ind.value(r)))),
  }));
  return (
    <Panel className="mt-4 px-5 py-4" aria-labelledby="polymono-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="polymono-h" className="font-serif text-[21px] font-semibold">Polyandrie vs monandrie</h2>
          <p className="font-serif text-[13.5px] text-muted">Effet du régime de réaccouplement des femelles sur « {ind.label} » · {nRep} répétitions par point · figure 1 du notebook</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {invasions.length > 1 && <div className="w-64 text-[12px]"><span className="text-muted">Invasion</span>
            <Segmented size="sm" label="Invasion" value={invasion} onChange={setInv} options={invasions.map((i) => ({ value: i, label: short(i) }))} /></div>}
          {budgets.length > 1 && <div className="w-64 text-[12px]"><span className="text-muted">Budget (mâles stériles / saison)</span>
            <Segmented size="sm" label="Budget" value={String(b)} onChange={(v) => setBudget(Number(v))} options={budgets.map((x) => ({ value: String(x), label: fmtInt(x) }))} /></div>}
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

      <div className={`mt-4 grid gap-6 ${crops.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {crops.map((crop) => {
          const d = data(crop);
          const c = meta.crops[crop as "strawberry"];
          return (
            <section key={crop} aria-label={c.label}>
              <h3 className="font-serif text-[17px] font-semibold">{c.label} <span className="text-[13px] font-normal italic text-muted">{c.latin}</span></h3>
              <DodgedStrip crop={crop} data={d} ind={ind} exportPrefix={exportPrefix} title={`${ind.label} — ${c.label}, invasion ${short(invasion)}, budget ${fmtInt(b)}`} />
              <table className="mt-2 w-full text-[12.5px]">
                <caption className="sr-only">Moyennes par régime et écart</caption>
                <thead><tr className="border-b border-line text-left text-[11.5px] text-muted">
                  <th className="py-1.5 font-medium">Stratégie</th>
                  <th className="py-1.5 text-right font-medium">{meta.remating.preference.short}<div className="font-normal">moy. ± é.-t.</div></th>
                  <th className="py-1.5 text-right font-medium">{meta.remating.first.short}<div className="font-normal">moy. ± é.-t.</div></th>
                  <th className="py-1.5 text-right font-medium">Écart polyandrie − monandrie<div className="font-normal">{diffUnit(ind)}</div></th>
                </tr></thead>
                <tbody>{d.map(({ s, regimes: [p, f] }) => {
                  const diff = p.mean - f.mean;
                  const worse = ind.higherIsBetter ? diff < 0 : diff > 0;
                  return (
                    <tr key={s.id} className="border-b border-line/60">
                      <td className="py-1.5">{s.label}{s.control && <span className="block text-[10.5px] text-muted">même modèle dans les deux régimes : écart = variabilité</span>}</td>
                      <td className="py-1.5 text-right tnum">{p.n ? fmt(p.mean, ind.unit.startsWith("%") ? 1 : 0) : "—"}{p.n > 0 && <span className="text-muted"> ± {fmt(p.sd, 1)}</span>}</td>
                      <td className="py-1.5 text-right tnum">{f.n ? fmt(f.mean, ind.unit.startsWith("%") ? 1 : 0) : "—"}{f.n > 0 && <span className="text-muted"> ± {fmt(f.sd, 1)}</span>}</td>
                      <td className="py-1.5 text-right tnum">{p.n && f.n ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-2 rounded-sm" style={{ width: Math.min(70, Math.abs(diff) * (ind.unit.startsWith("%") ? 7 : 0.002)), background: worse ? "#BF532E" : "#347A55" }} />
                          {diff > 0 ? "+" : diff < 0 ? "−" : ""}{fmt(Math.abs(diff), ind.unit.startsWith("%") ? 1 : 0)}
                        </span>) : "—"}
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

function DodgedStrip({ crop, data, ind, title, exportPrefix }: { crop: string; data: { s: AnalysisStrategy; regimes: ReturnType<typeof stats>[] }[]; ind: Indicator; title: string; exportPrefix: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const I = ind;
  const W = 640, H = 250, L = 58, B = 34, T = 10, R = 8;
  const all = data.flatMap((d) => d.regimes.flatMap((g) => g.values));
  const max = Math.max(1, ...all) * 1.06;
  const min = Math.min(0, ...all);
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const bw = (W - L - R) / Math.max(1, data.length);
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5);
  const ctrlIdx = data.findIndex((d) => d.s.control);
  return (
    <figure className="mt-1">
      <div className="flex justify-end"><ChartExportMenu getSvg={() => ref.current} meta={{ title, filename: `${exportPrefix}polyandrie-monandrie-${crop}`, caption: `${I.label} (${I.unit}). Points : répétitions ; trait : moyenne. Cercles : polyandrie (preference) ; triangles : monandrie (first).` }} /></div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E3E8E1" /><text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="tnum" fill="#1B201C">{fmt(t, 0)}</text></g>)}
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="#1B201C" /><line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#1B201C" />
        {data.map((d, i) => (
          <g key={d.s.id}>
            {ctrlIdx === 0 && i === 1 && <line x1={L + bw * i} x2={L + bw * i} y1={T} y2={H - B} stroke="#9AA59D" strokeDasharray="3 3" />}
            {d.regimes.map((g, j) => {
              const cx = L + bw * (i + 0.5) + (j === 0 ? -bw * 0.18 : bw * 0.18);
              const reg = REGIMES[j];
              return (
                <g key={j}>
                  {g.values.map((v, n) => {
                    const jx = cx + ((n * 37) % 11 - 5) * (bw * 0.012);
                    return reg.shape === "circle"
                      ? <circle key={n} className="m-pop" style={{ animationDelay: `${(i * 2 + j) * 40 + n * 12}ms` }} cx={jx} cy={y(v)} r={3.2} fill={reg.color} fillOpacity={0.55}><title>{`${d.s.short} · ${reg.key} · rép. ${n + 1} : ${fmt(v, 2)}`}</title></circle>
                      : <path key={n} className="m-pop" style={{ animationDelay: `${(i * 2 + j) * 40 + n * 12}ms` }} d={`M${jx},${y(v) - 3.6}L${jx + 3.4},${y(v) + 2.6}L${jx - 3.4},${y(v) + 2.6}Z`} fill={reg.color} fillOpacity={0.55}><title>{`${d.s.short} · ${reg.key} · rép. ${n + 1} : ${fmt(v, 2)}`}</title></path>;
                  })}
                  {g.n > 0 && <line x1={cx - bw * 0.13} x2={cx + bw * 0.13} y1={y(g.mean)} y2={y(g.mean)} stroke={reg.color} strokeWidth={2.6} strokeLinecap="round" />}
                </g>
              );
            })}
            <text x={L + bw * (i + 0.5)} y={H - B + 16} textAnchor="middle" fontSize={11} fill="#1B201C">{d.s.control ? "Témoin" : d.s.short}</text>
          </g>
        ))}
        <text transform={`translate(14,${(H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="#1B201C">{I.unit}</text>
      </svg>
    </figure>
  );
}

/* ---------------------------------------------------------------- Synthèse décisionnelle */
function DecisionSynthesis({ data, meta, metric, invasion, setInvasion, budget, setBudget, budgets, planHint }: {
  data: AnalysisDataset; meta: Meta; metric: string; invasion: string; setInvasion: (v: string) => void;
  budget: number; setBudget: (v: number) => void; budgets: number[]; planHint?: ReactNode;
}) {
  const ind = INDICATOR[metric];
  const pct = ind.unit.startsWith("%");
  const syn = useMemo(() => synthesize(data, (r) => ind.value(r), ind.higherIsBetter, invasion, budget,
    (c) => CROP_LABEL[c] ?? c, (r) => meta.remating[r]?.short ?? r), [data, metric, invasion, budget]);
  const v = (x: number) => fmt(x, pct ? 1 : 0);
  const gainTxt = (g: number) => `${g > 0 ? "+" : g < 0 ? "−" : ""}${v(Math.abs(g))}${pct ? " pt" : ""}`;
  const good = (g: number) => (ind.higherIsBetter ? g > 0 : g < 0);
  return (
    <Panel className="mt-4 px-5 py-4" aria-labelledby="synthese-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="synthese-h" className="font-serif text-[21px] font-semibold">Synthèse décisionnelle</h2>
          <p className="font-serif text-[13.5px] text-muted">Stratégie en tête pour « {ind.label} » {ind.higherIsBetter ? "(plus haut = meilleur)" : "(plus bas = meilleur)"}, calculée sur ces données · {data.nRep} répétitions par scénario</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {data.invasions.length > 1 && <div className="w-64 text-[12px]"><span className="text-muted">Invasion</span>
            <Segmented size="sm" label="Invasion (synthèse)" value={invasion} onChange={setInvasion} options={data.invasions.map((i) => ({ value: i, label: short(i) }))} /></div>}
          {budgets.length > 1 && <div className="w-64 text-[12px]"><span className="text-muted">Budget (stériles / saison)</span>
            <Segmented size="sm" label="Budget (synthèse)" value={String(budget)} onChange={(x) => setBudget(Number(x))} options={budgets.map((b) => ({ value: String(b), label: fmtInt(b) }))} /></div>}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-line bg-white px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Fraise et cerise : même optimum ?</div>
          <p className="mt-1 text-[13px] leading-snug">{syn.byCrop ?? (data.crops.length < 2 ? <>Une seule culture dans ces données. {planHint}</> : "Pas assez de données à ce budget.")}</p>
        </div>
        <div className="rounded-md border border-line bg-white px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Monandrie ou polyandrie : l’optimum change-t-il ?</div>
          <p className="mt-1 text-[13px] leading-snug">{syn.byRegime ?? <>Les deux régimes (polyandrie et monandrie) sont nécessaires dans le même plan. {planHint}</>}</p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-[12.5px] [&_td+td]:pl-4 [&_th+th]:pl-4 [&_td.tnum]:whitespace-nowrap">
          <caption className="sr-only">Stratégie en tête par culture et régime</caption>
          <thead><tr className="border-b border-line text-left text-[11.5px] text-muted">
            <th className="py-1.5 font-medium">Culture</th><th className="py-1.5 font-medium">Régime</th>
            <th className="py-1.5 font-medium">En tête au budget {fmtInt(budget)}</th>
            <th className="py-1.5 text-right font-medium">Valeur<div className="font-normal">moy. ± é.-t.</div></th>
            <th className="py-1.5 text-right font-medium">Témoin<div className="font-normal">moy. ± é.-t.</div></th>
            <th className="py-1.5 text-right font-medium">Écart au témoin<div className="font-normal">{diffUnit(ind)}</div></th>
            <th className="py-1.5 font-medium">Écart avec la 2e</th>
            {budgets.length > 1 && <th className="py-1.5 font-medium">Meilleure combinaison (tous budgets)</th>}
          </tr></thead>
          <tbody>{syn.cells.map((c) => {
            const [a, b] = c.ranking;
            return (
              <tr key={c.crop + c.remating} className="border-b border-line/60 align-top">
                <td className="whitespace-nowrap py-1.5"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: CROP_COLOR[c.crop] }} />{CROP_LABEL[c.crop]}</td>
                <td className="py-1.5">{meta.remating[c.remating]?.short ?? c.remating}</td>
                <td className="py-1.5">{a ? <><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: a.strategy.color }} /><strong className="font-semibold">{a.strategy.label}</strong></> : "—"}</td>
                <td className="py-1.5 text-right tnum">{a ? <>{v(a.mean)}<span className="text-muted"> ± {v(a.sd)}</span></> : "—"}</td>
                <td className="py-1.5 text-right tnum">{c.control ? <>{v(c.control.mean)}<span className="text-muted"> ± {v(c.control.sd)}</span></> : "—"}</td>
                <td className={`py-1.5 text-right tnum ${c.gain != null ? (good(c.gain) ? "text-forest" : "text-terracotta") : ""}`}>{c.gain != null ? gainTxt(c.gain) : "—"}</td>
                <td className="py-1.5 text-[12px]">{a && b ? <>{b.strategy.short} à {v(Math.abs(a.mean - b.mean))}{pct ? " pt" : ""} — {c.clear ? <span className="text-forest">écart net</span> : <span className="text-[#6B4E16]">inférieur à la variabilité</span>}</> : "seule stratégie"}</td>
                {budgets.length > 1 && <td className="py-1.5 text-[12px]">{c.bestAnyBudget ? `${c.bestAnyBudget.strategy.label} à ${fmtInt(c.bestAnyBudget.budget)} (${v(c.bestAnyBudget.mean)})` : "—"}</td>}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        Invasion {short(invasion)}. Lecture descriptive, sans test statistique : un écart est « net » quand il dépasse la somme des écarts-types des deux
        premières stratégies ; sinon, leur classement peut s’inverser d’un jeu de répétitions à l’autre. Ces résultats portent sur le modèle simulé, pas
        sur des parcelles réelles.
      </p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Fraise vs cerise */
function CropComparison({ data, meta, metric, remating, invasion, budget, exportPrefix, source }: {
  data: AnalysisDataset; meta: Meta; metric: string; remating: string; invasion: string; budget: number; exportPrefix: string; source: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const ind = INDICATOR[metric];
  const cols = [...data.strategies.filter((s) => s.control), ...data.strategies.filter((s) => !s.control)];
  const cell = (crop: string, s: AnalysisStrategy) => stats(data.rows.filter((r) => r.Crop === crop && r.Remating === remating && r.Invasion === invasion
    && r.Strategy === s.id && (s.control || Number(r.Budget) === budget)).map((r) => ind.value(r)));
  const groups = cols.map((s) => ({ s, crops: data.crops.map((c) => ({ c, g: cell(c, s) })) }));
  const W = 760, H = 270, L = 58, B = 40, T = 14, R = 10;
  const all = groups.flatMap((g) => g.crops.filter((x) => x.g.n).map((x) => x.g.mean + x.g.sd));
  const max = Math.max(1, ...all) * 1.08;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const bw = (W - L - R) / Math.max(1, groups.length);
  const barW = Math.min(34, (bw * 0.7) / data.crops.length);
  const ticks = Array.from({ length: 6 }, (_, i) => (max * i) / 5);
  const pct = ind.unit.startsWith("%");
  return (
    <Panel className="mt-4 px-5 py-4">
      <PanelTitle sub={`Même stratégie, même invasion (${short(invasion)}), même budget (${fmtInt(budget)}), régime ${meta.remating[remating]?.short ?? remating} · moyenne ± écart-type, ${data.nRep} répétitions`}
        right={<ChartExportMenu getSvg={() => ref.current} meta={{ title: `Fraise vs cerise — ${ind.label}`, filename: `${exportPrefix}fraise-vs-cerise-${metric}`, caption: `${source}. ${ind.label} (${ind.unit}), invasion ${short(invasion)}, budget ${fmtInt(budget)}, régime ${remating}. Barres : moyenne ; traits : ± écart-type.` }} />}>
        Fraise vs cerise, par stratégie</PanelTitle>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">{data.crops.map((c) => <span key={c} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CROP_COLOR[c] }} />{meta.crops[c as "strawberry"]?.label ?? c}</span>)}</div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Comparaison fraise et cerise, ${ind.label}`}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E3E8E1" /><text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="tnum" fill="#1B201C">{fmt(t, pct ? 0 : 0)}</text></g>)}
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="#1B201C" /><line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#1B201C" />
        {groups.map(({ s, crops }, i) => (
          <g key={s.id}>
            {crops.map(({ c, g }, j) => {
              if (!g.n) return null;
              const x = L + bw * (i + 0.5) + (j - (crops.length - 1) / 2) * (barW + 4) - barW / 2;
              return (
                <g key={c} className="m-pop" style={{ animationDelay: `${(i * 2 + j) * 40}ms` }}>
                  <rect x={x} y={y(g.mean)} width={barW} height={Math.max(0, y(0) - y(g.mean))} fill={CROP_COLOR[c]} fillOpacity={0.85} rx={2}>
                    <title>{`${meta.crops[c as "strawberry"]?.label} · ${s.label} : ${fmt(g.mean, 2)} ± ${fmt(g.sd, 2)} (n = ${g.n})`}</title></rect>
                  <line x1={x + barW / 2} x2={x + barW / 2} y1={y(g.mean + g.sd)} y2={y(Math.max(0, g.mean - g.sd))} stroke="#1B201C" strokeWidth={1.3} />
                  <line x1={x + barW / 2 - 4} x2={x + barW / 2 + 4} y1={y(g.mean + g.sd)} y2={y(g.mean + g.sd)} stroke="#1B201C" strokeWidth={1.3} />
                </g>
              );
            })}
            <text x={L + bw * (i + 0.5)} y={H - B + 17} textAnchor="middle" fontSize={11} fill="#1B201C">{s.control ? "Témoin" : s.short}</text>
          </g>
        ))}
        <text transform={`translate(14,${(H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="#1B201C">{ind.unit}</text>
      </svg>
      {!pct && <p className="text-[11.5px] text-muted">Attention : valeur absolue, les deux cultures ne produisent pas le même nombre de fruits ni sur la même durée.</p>}
    </Panel>
  );
}
