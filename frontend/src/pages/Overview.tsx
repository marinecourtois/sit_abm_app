import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, Database, Play, Settings, SignalMedium, Worm } from "../icons";
import { api, type Results, type Scenario } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { fmt, fmtInt, fmtPct } from "../lib/format";
import { CROP_COLOR } from "../lib/colors";
import { StudyHeader, StudyTabs } from "../components/layout";
import { BotanicalSpeciesCard, ResearchMetric, ScientificProcessDiagram } from "../components/science";
import { Button, NumberField, Panel, PanelTitle, ScientificTooltip, Segmented, Select, Skeleton, useToast } from "../components/ui";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { ChartExportMenu } from "../components/charts/ChartExportMenu";

const TABLE_STRATS = ["daily", "every_3", "every_7", "front_70", "front_100"] as const;

export function StrawberryDot() {
  return <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden><path d="M8 4.5c3.6 0 5.6 1.8 4.6 5.2C11.8 12.6 9.6 15 8 15S4.2 12.6 3.4 9.7C2.4 6.3 4.4 4.5 8 4.5z" fill="#C7302A" /><path d="M8 5 5 2.6M8 5l3-2.4M8 5V1.6M8 5 4.5 5.2M8 5l3.5.2" stroke="#3E7B3E" strokeWidth="1.4" strokeLinecap="round" /><g fill="#F2D27A"><circle cx="6" cy="8" r=".5" /><circle cx="9.6" cy="8.4" r=".5" /><circle cx="7.8" cy="10.6" r=".5" /><circle cx="6.4" cy="12" r=".5" /><circle cx="9.6" cy="11.6" r=".5" /></g></svg>;
}
export function CherryDot() {
  return <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden><path d="M8 1.5c-.5 3-2 5.5-3.5 7M8 1.5c.8 3 2.2 5.2 3.5 6.5" stroke="#5E7A34" strokeWidth="1.1" fill="none" /><circle cx="4.6" cy="11" r="3.6" fill="#A83D36" /><circle cx="11.4" cy="10.4" r="3.4" fill="#8E2C28" /><circle cx="3.6" cy="9.8" r=".9" fill="#fff" fillOpacity=".55" /></svg>;
}

export function Overview() {
  const meta = useMeta();
  const nav = useNavigate();
  const toast = useToast();
  const ov = useAsync(() => api.overview(), []);
  const chartRef = useRef<SVGSVGElement>(null);
  const chartBox = useRef<HTMLDivElement>(null);
  const [chartH, setChartH] = useState(236);
  useEffect(() => {
    const el = chartBox.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setChartH(Math.round(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rafraîchit tant que l'étude de référence calcule
  useEffect(() => {
    if (ov.data && !ov.data.results && ov.data.experiment) {
      const t = setInterval(() => ov.reload(), 1200);
      return () => clearInterval(t);
    }
  }, [ov.data]);

  const [crop, setCrop] = useState<"strawberry" | "cherry">("strawberry");
  const [invasion, setInvasion] = useState("moyenne");
  const [strategy, setStrategy] = useState<"daily" | "every_3" | "every_7">("every_3");
  const [budget, setBudget] = useState(9000);
  const [shown, setShown] = useState<{ strawberry: string; cherry: string }>({ strawberry: "every_3", cherry: "every_7" });
  const [launching, setLaunching] = useState(false);

  const res: Results | null = ov.data?.results ?? null;
  const exp = ov.data?.experiment ?? null;
  const cfg = exp?.config;
  const find = (c: string, s: string): Scenario | undefined => res?.scenarios.find((x) => x.crop === c && x.strategy_key === s);
  const refMatches = !!cfg && cfg.invasion.preset === invasion && cfg.budget === budget;

  // Le panneau pilote la série de la culture choisie lorsque ce scénario existe dans l'étude de référence
  useEffect(() => { if (refMatches) setShown((s) => ({ ...s, [crop]: strategy })); }, [crop, strategy, refMatches]);

  const sF = find("strawberry", shown.strawberry), sC = find("cherry", shown.cherry);
  const lab = (s?: Scenario) => (s ? meta?.strategies[s.strategy_key]?.short ?? s.strategy_label : "");
  const nRep = cfg?.replicates ?? 0;

  const series = useMemo(() => [sF, sC].filter(Boolean).map((s, i) => ({
    id: s!.key, label: `${i === 0 ? "Fraise" : "Cerise"} (lâcher ${lab(s)})`, color: CROP_COLOR[s!.crop],
    dash: i === 0 ? undefined : undefined, x: s!.series.Time, y: s!.series.Wild_adults_vs_control.mean, sd: s!.series.Wild_adults_vs_control.sd,
  })), [sF, sC, meta]);

  const ann = (s: Scenario | undefined, tone: "green" | "terracotta", name: string) => {
    const v = s?.vs_control?.wild_adults_final;
    if (!s || !v) return null;
    const last = s.series.Time[s.series.Time.length - 1];
    return { seriesId: s.key, x: last, tone, dx: tone === "green" ? -262 : 18, dy: tone === "green" ? -58 : -30,
      lines: [`Réduction ≈ ${fmt(v.mean, Math.abs(v.mean) >= 99 ? 1 : 0).replace("-", "−")} %`, `(${name}, ${lab(s)}, J${last} vs témoin)`] };
  };
  const annotations = [ann(sF, "green", "Fraise"), ann(sC, "terracotta", "Cerise")].filter(Boolean) as NonNullable<ReturnType<typeof ann>>[];

  const launch = async () => {
    if (!meta) return;
    setLaunching(true);
    try {
      const inv = meta.invasions[invasion];
      const e = await api.create({
        name: `${crop === "strawberry" ? "Fraise" : "Cerise"} · ${meta.strategies[strategy].label} · ${fmtInt(budget)} stériles`,
        config: { crops: [crop], strategies: [{ key: strategy }], invasion: { preset: invasion, wild: inv.wild, females: inv.females },
          budget, remating: "preference", replicates: 3, seed: 42, include_control: true, biology: meta.biology_defaults },
      });
      toast(`Simulation ${e.short_id} lancée.`, "success");
      nav(`/simulation/${e.id}`);
    } catch (err) { toast((err as Error).message, "error"); }
    finally { setLaunching(false); }
  };

  const dmg = (s?: Scenario) => s?.vs_control?.larval_damage_pct;
  const share = (s?: Scenario) => s?.metrics.sterile_puncture_share_pct;

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Étude 01"
        title={<>Impact des stratégies <em className="font-semibold text-botanic">TIS</em> selon la culture</>}
        subtitle={<>Comparaison expérimentale <span className="mx-1.5">·</span> Fraise vs Cerise</>} />
      <StudyTabs />

      <div className="lg:flex lg:min-h-[min(calc(100vh-216px),860px)] lg:flex-col">
      {/* Section 1 — cultures et principe */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.09fr_1fr_1.28fr]">
        <BotanicalSpeciesCard crop="strawberry" meta={meta} />
        <div className="md:col-span-2 md:order-last xl:order-none xl:col-span-1"><ScientificProcessDiagram compact /></div>
        <BotanicalSpeciesCard crop="cherry" meta={meta} />
      </div>

      {/* Section 2 — dynamique + paramètres */}
      <div className="mt-4 grid gap-4 lg:flex-1 xl:grid-cols-[minmax(0,1fr)_352px]">
        <Panel className="group flex flex-col px-5 pb-2.5 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <ScientificTooltip side="bottom" content={<>Adultes sauvages (mâles W + femelles F) du scénario rapportés à ceux du témoin sans TIS, même jour et même graine. Moyenne ± écart-type sur {nRep} répétitions · invasion {meta?.invasions[cfg?.invasion.preset ?? ""]?.label ?? "—"} · {fmtInt(cfg?.budget)} mâles stériles par saison · régime « {cfg?.remating} » · expérience {exp?.short_id}.</>}>
              <h2 tabIndex={0} className="cursor-help font-serif text-[21px] font-semibold outline-none">Dynamique des populations au cours du temps</h2>
            </ScientificTooltip>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] sm:text-[14px]" aria-label="Légende">
                {series.map((s) => <li key={s.id} className="flex items-center gap-2"><svg width="30" height="8" aria-hidden><line x1="0" x2="30" y1="4" y2="4" stroke={s.color} strokeWidth="3" /></svg>{s.label}</li>)}
              </ul>
              <ChartExportMenu iconOnly getSvg={() => chartRef.current}
                meta={{ title: "Dynamique des populations sauvages (adultes W + F, relatif au témoin sans TIS)", filename: `dynamique-${exp?.short_id ?? "ref"}`,
                  caption: `Moyenne ± écart-type sur ${nRep} répétitions. Invasion ${meta?.invasions[cfg?.invasion.preset ?? ""]?.label ?? ""}, budget ${fmtInt(cfg?.budget)} mâles stériles, régime « ${cfg?.remating} ». Expérience ${exp?.short_id}, moteur ${exp?.engine_version}, paramètres ${exp?.params_version}.` }} />
            </div>
          </div>
          <div ref={chartBox} className="relative min-h-[236px] flex-1">
          <div className="absolute inset-0">
          {res ? (
            <TimeSeriesChart ref={chartRef} series={series} height={Math.max(236, chartH)} xLabel="Jours après intervention" yLabel="Population relative"
              yFormat={(v) => fmt(v, 1)} valueFormat={(v) => fmt(v, 3)} annotations={annotations} areaFill ariaLabel="Population relative d'adultes sauvages en fonction du temps, fraise et cerise"
              yDomain={[0, 1]} uncertaintyLabel={`Moyenne ± écart-type, ${nRep} répétitions · (W+F) scénario / (W+F) témoin, même jour et même graine`} />
          ) : <ChartLoading exp={exp} />}
          </div>
          </div>
        </Panel>

        <Panel className="flex flex-col px-5 pb-4 pt-3">
          <PanelTitle icon={<Settings size={22} strokeWidth={1.5} />}>Paramètres du scénario</PanelTitle>
          <div className="mt-3 grid grid-cols-[134px_1fr] items-center gap-x-3 gap-y-2.5 text-[13px]">
            <label htmlFor="ov-crop" className="font-medium">Culture</label>
            <Select id="ov-crop" label="Culture" value={crop} onChange={(v) => setCrop(v as "strawberry")}
              options={[{ value: "strawberry", label: "Fraise", icon: <StrawberryDot /> }, { value: "cherry", label: "Cerise", icon: <CherryDot /> }]} />
            <label htmlFor="ov-inv" className="font-medium">Pression d’invasion</label>
            <Select id="ov-inv" label="Pression d'invasion" value={invasion} onChange={setInvasion} icon={<SignalMedium size={16} />}
              options={Object.entries(meta?.invasions ?? {}).map(([k, v]) => ({ value: k, label: v.label.split(" (")[0], icon: <SignalMedium size={16} /> }))} />
            <span className="font-medium">Stratégie de lâcher</span>
            <Segmented label="Stratégie de lâcher" value={strategy} onChange={setStrategy}
              options={[{ value: "daily", label: "Quotidien" }, { value: "every_3", label: "J+3" }, { value: "every_7", label: "J+7" }]} />
            <label htmlFor="ov-budget" className="font-medium leading-tight" title="Nombre total de mâles stériles lâchés sur la saison">Budget <span className="font-normal">(stériles)</span></label>
            <NumberField thousands id="ov-budget" label="Budget en mâles stériles par saison" value={budget} onChange={setBudget} min={0} max={1_000_000} step={500}
              icon={<Database size={16} strokeWidth={1.5} />} invalid={!Number.isFinite(budget) || budget < 0} />
          </div>
          <Button variant="primary" size="lg" className="mt-5 w-full !h-[42px] pt-0 lg:mt-auto" title={refMatches ? "Scénario de l’étude de référence : déjà affiché sur le graphique. Relancer crée une nouvelle expérience." : "Scénario non simulé : lancez-le (témoin sans TIS inclus)."} disabled={launching || !meta || !Number.isFinite(budget) || budget < 0}
            icon={<Play size={17} fill="currentColor" />} onClick={launch}>
            {launching ? "Lancement…" : "Lancer une simulation"}
          </Button>
        </Panel>
      </div>

      {/* Section 3 — indicateurs et tableau */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[348fr_343fr_652fr]">
        <Panel className="px-4 pb-3.5 pt-3">
          <div className="flex items-start gap-3">
            <Worm size={26} strokeWidth={1.3} className="mt-0.5 text-forest" aria-hidden />
            <div className="min-w-0">
              <ScientificTooltip content={<>Fruits ayant reçu au moins une ponte fertile (récoltés, pourris ou restés sur la plante), en % des fruits produits. Valeurs : variation relative appariée au témoin sans TIS (mêmes graines), moyenne ± écart-type sur {nRep} répétitions — fraise {fmt(dmg(sF)?.mean, 1)} ± {fmt(dmg(sF)?.sd, 1)} %, cerise {fmt(dmg(sC)?.mean, 1)} ± {fmt(dmg(sC)?.sd, 1)} %. Témoin : fraise {fmtPct(find("strawberry", "no_tis")?.metrics.larval_damage_pct.mean)}, cerise {fmtPct(find("cherry", "no_tis")?.metrics.larval_damage_pct.mean)} de fruits infestés.</>}>
                <h2 tabIndex={0} className="cursor-help font-serif text-[20px] font-semibold outline-none">Dommages larvaires</h2>
              </ScientificTooltip>
              <p className="font-serif text-[13.5px] text-muted">Part de fruits endommagés, vs témoin</p>
            </div>
          </div>
          <div className="mt-3 flex gap-px overflow-hidden rounded-[5px]">
            {res ? (<>
              <ResearchMetric tone="green" value={fmt(dmg(sF)?.mean, 0).replace("-", "−")} unit="%" title={dmg(sF) ? `${fmt(dmg(sF)!.mean, 1)} ± ${fmt(dmg(sF)!.sd, 1)} % (moyenne ± écart-type)` : undefined} context={`(Fraise, ${lab(sF)})`} />
              <ResearchMetric tone="terracotta" value={fmt(dmg(sC)?.mean, 0).replace("-", "−")} unit="%" title={dmg(sC) ? `${fmt(dmg(sC)!.mean, 1)} ± ${fmt(dmg(sC)!.sd, 1)} % (moyenne ± écart-type)` : undefined} context={`(Cerise, ${lab(sC)})`} />
            </>) : <Skeleton className="h-[104px] w-full" />}
          </div>
        </Panel>

        <Panel className="px-4 pb-3.5 pt-3">
          <div className="flex items-start gap-3">
            <Bug size={26} strokeWidth={1.3} className="mt-0.5 text-forest" aria-hidden />
            <div className="min-w-0">
              <ScientificTooltip content={<>Part des pontes stériles (issues d’un accouplement avec un mâle stérile) parmi toutes les pontes déposées dans les fruits pendant la saison. Ces piqûres ne produisent pas de larve mais peuvent déclencher le pourrissement (taux h<sub>s</sub>). Moyenne ± écart-type, {nRep} répétitions : fraise {fmt(share(sF)?.mean, 1)} ± {fmt(share(sF)?.sd, 1)} %, cerise {fmt(share(sC)?.mean, 1)} ± {fmt(share(sC)?.sd, 1)} %.</>}>
                <h2 tabIndex={0} className="cursor-help font-serif text-[20px] font-semibold outline-none">Piqûres stériles</h2>
              </ScientificTooltip>
              <p className="font-serif text-[13.5px] text-muted">Proportion de piqûres non viables</p>
            </div>
          </div>
          <div className="mt-3 flex gap-px overflow-hidden rounded-[5px]">
            {res ? (<>
              <ResearchMetric tone="green" value={fmt(share(sF)?.mean, 0)} unit="%" title={share(sF) ? `${fmt(share(sF)!.mean, 1)} ± ${fmt(share(sF)!.sd, 1)} % (moyenne ± écart-type)` : undefined} context={`(Fraise, ${lab(sF)})`} />
              <ResearchMetric tone="terracotta" value={fmt(share(sC)?.mean, 0)} unit="%" title={share(sC) ? `${fmt(share(sC)!.mean, 1)} ± ${fmt(share(sC)!.sd, 1)} % (moyenne ± écart-type)` : undefined} context={`(Cerise, ${lab(sC)})`} />
            </>) : <Skeleton className="h-[104px] w-full" />}
          </div>
        </Panel>

        <Panel className="overflow-hidden md:col-span-2 xl:col-span-1">
          <div className="scroll-x">
            <table className="w-full min-w-[520px] border-collapse text-[13.5px] leading-[1.45]">
              <caption className="sr-only">Dommages larvaires par stratégie et culture</caption>
              <thead>
                <tr className="border-b border-[#CBD5C6] bg-[linear-gradient(180deg,#F0F4EC,#E7EEE3)] text-left">
                  <th scope="col" className="px-4 py-2 font-semibold"><ScientificTooltip content={<>Dommages : fruits avec ≥ 1 ponte fertile, en % des fruits produits, moyenne de {nRep} répétitions (survol d’une valeur : ± écart-type). Témoin sans TIS : fraise {fmtPct(find("strawberry", "no_tis")?.metrics.larval_damage_pct.mean)}, cerise {fmtPct(find("cherry", "no_tis")?.metrics.larval_damage_pct.mean)}. Ligne surlignée : stratégie affichée sur le graphique.</>}><span tabIndex={0} className="cursor-help outline-none">Stratégie</span></ScientificTooltip></th>
                  <th scope="col" className="border-l border-line px-3 py-2 text-center font-semibold">Fraise <span className="font-serif text-[12.5px] font-normal text-muted">(dommages)</span></th>
                  <th scope="col" className="border-l border-line px-3 py-2 text-center font-semibold">Cerise <span className="font-serif text-[12.5px] font-normal text-muted">(dommages)</span></th>
                  <th scope="col" className="border-l border-line px-3 py-2 text-center font-semibold">
                    <ScientificTooltip content={<>Mâles stériles réellement lâchés rapportés au budget de l’étude ({fmtInt(cfg?.budget)}). Le plan du notebook fixe un budget identique pour toutes les stratégies : seul le calendrier change.</>}><span tabIndex={0} className="cursor-help outline-none">Budget relatif</span></ScientificTooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE_STRATS.map((k) => {
                  const f = find("strawberry", k), c = find("cherry", k);
                  const on = k === (crop === "strawberry" ? shown.strawberry : shown.cherry);
                  const rel = f && cfg?.budget ? f.metrics.sterile_released.mean / cfg.budget : null;
                  return (
                    <tr key={k} className={`border-b border-line last:border-b-0 ${on ? "bg-[#D8E8DB]" : ""}`} aria-current={on || undefined}>
                      <th scope="row" className="px-4 py-[3.5px] text-left font-normal">{meta?.strategies[k]?.label ?? k}</th>
                      <td className="border-l border-line px-3 py-[3.5px] text-center tnum text-forest" title={f ? `${fmt(f.metrics.larval_damage_pct.mean, 2)} ± ${fmt(f.metrics.larval_damage_pct.sd, 2)} %` : ""}>{res ? fmtPct(f?.metrics.larval_damage_pct.mean) : <Skeleton className="mx-auto h-3.5 w-12" />}</td>
                      <td className="border-l border-line px-3 py-[3.5px] text-center tnum text-cherry" title={c ? `${fmt(c.metrics.larval_damage_pct.mean, 2)} ± ${fmt(c.metrics.larval_damage_pct.sd, 2)} %` : ""}>{res ? fmtPct(c?.metrics.larval_damage_pct.mean) : <Skeleton className="mx-auto h-3.5 w-12" />}</td>
                      <td className="border-l border-line px-3 py-[3.5px] text-center tnum">{rel != null ? `${fmt(rel, 2)} ×` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      </div>
    </>
  );
}

function ChartLoading({ exp }: { exp: { status: string; progress: number; short_id: string } | null }) {
  return (
    <div className="relative h-full min-h-[236px]">
      <Skeleton className="absolute inset-x-12 inset-y-4" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-md border border-line bg-white px-4 py-3 text-center text-[13px] shadow-sm" role="status">
          {exp ? <>Étude de référence {exp.short_id} en cours de calcul · {Math.round((exp.progress ?? 0) * 100)} %</> : "Chargement des résultats…"}
        </div>
      </div>
    </div>
  );
}
