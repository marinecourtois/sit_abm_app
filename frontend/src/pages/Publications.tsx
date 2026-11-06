import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileJson, FileText, Printer } from "../icons";
import { api, type Experiment, type Results, type Scenario } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { CROP_LABEL, fmt, fmtDate, fmtInt } from "../lib/format";
import { CROP_COLOR, STRATEGY_COLOR } from "../lib/colors";
import { METRIC } from "../lib/variables";
import { StudyHeader } from "../components/layout";
import { Button, EmptyState, Panel, PanelTitle, Select, Skeleton } from "../components/ui";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { ProtocolViewer } from "./Protocol";

const PARTS = ["Titre et contexte", "Objectifs", "Description du modèle", "Protocole expérimental", "Paramètres", "Résultats", "Graphiques", "Comparaisons", "Analyse des incertitudes", "Limites", "Conclusion descriptive", "Métadonnées de reproductibilité"];

/** Boîte d'export : formats disponibles pour une expérience. */
export function ExportDialog({ exp }: { exp: Experiment }) {
  const a = "inline-flex h-9 items-center gap-2 rounded-[5px] border border-line bg-white px-3 text-[13px] hover:border-ink";
  return (
    <div className="grid gap-2">
      <a className={a} href={api.exportUrl(exp.id, "csv-metrics")}><Download size={14} />CSV — métriques par répétition</a>
      <a className={a} href={api.exportUrl(exp.id, "csv-series")}><Download size={14} />CSV — séries journalières</a>
      <a className={a} href={api.exportUrl(exp.id, "json")}><FileJson size={14} />JSON — expérience complète</a>
      <a className={a} href={api.exportUrl(exp.id, "protocol")}><FileJson size={14} />JSON — protocole reproductible</a>
      <button className={a} onClick={() => window.print()}><Printer size={14} />PDF — rapport (impression)</button>
      <span className="self-center text-[11.5px] text-muted">SVG / PNG : menu « Exporter » de chaque figure.</span>
    </div>
  );
}

function describe(res: Results, crop: string) {
  const sc = res.scenarios.filter((s) => s.crop === crop);
  const ctrl = sc.find((s) => s.is_control); const tis = sc.filter((s) => !s.is_control);
  if (!tis.length) return null;
  const by = (k: string) => [...tis].sort((a, b) => a.metrics[k].mean - b.metrics[k].mean);
  const lo = by("larval_damage_pct")[0], hi = by("larval_damage_pct").at(-1)!;
  const st = by("rotten_sterile_only_pct");
  return { ctrl, lo, hi, stLo: st[0], stHi: st.at(-1)!, n: lo.seeds.length };
}

export function Publications() {
  const meta = useMeta();
  const [sp, setSp] = useSearchParams();
  const exps = useAsync(() => api.experiments(), []);
  const done = (exps.data ?? []).filter((e) => e.status === "completed");
  const id = sp.get("exp") ?? done.find((e) => e.tags.includes("référence"))?.id ?? done[0]?.id;
  const exp = done.find((e) => e.id === id) ?? null;
  const [res, setRes] = useState<Results | null>(null);
  const [parts, setParts] = useState<Set<string>>(new Set(PARTS));
  useEffect(() => { setRes(null); if (id) api.results(id).then(setRes).catch(() => setRes(null)); }, [id]);
  const crops = useMemo(() => Array.from(new Set(res?.scenarios.map((s) => s.crop) ?? [])), [res]);
  const has = (p: string) => parts.has(p);
  let n = 0; const H = (t: string) => <h2 className="mt-8 font-serif text-[21px] font-semibold">{++n}. {t}</h2>;

  if (exps.loading) return <Skeleton className="mt-6 h-96" />;
  if (!done.length) return <><StudyHeader crumb="Publications" title="Rapport scientifique" /><div className="mt-6"><EmptyState title="Aucune expérience terminée">Lancez une simulation pour générer un rapport.</EmptyState></div></>;

  return (
    <>
      <div className="no-print">
        <StudyHeader crumb="Recherche agronomique / Publications" title="Rapport scientifique" subtitle="Rapport structuré généré à partir des résultats enregistrés"
          actions={<Button variant="primary" size="lg" icon={<Printer size={18} />} onClick={() => window.print()}>Exporter en PDF</Button>} />
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Panel className="px-5 py-4">
            <PanelTitle>Expérience source</PanelTitle>
            <div className="mt-3"><Select label="Expérience" value={id ?? ""} onChange={(v) => setSp({ exp: v })} options={done.map((e) => ({ value: e.id, label: `${e.short_id} — ${e.name}` }))} /></div>
            <fieldset className="mt-4"><legend className="text-[12.5px] font-medium">Sections du rapport</legend>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[12.5px] sm:grid-cols-3">
                {PARTS.map((p) => <label key={p} className="flex items-center gap-2"><input type="checkbox" className="accent-[#347A55]" checked={parts.has(p)} onChange={() => setParts((s) => { const x = new Set(s); x.has(p) ? x.delete(p) : x.add(p); return x; })} />{p}</label>)}
              </div></fieldset>
          </Panel>
          <Panel className="px-5 py-4"><PanelTitle>Exports</PanelTitle><div className="mt-3">{exp && <ExportDialog exp={exp} />}</div></Panel>
        </div>
      </div>

      {exp && meta && (res ? (
        <article className="panel mx-auto mt-6 max-w-[900px] bg-white px-8 py-10 font-serif text-[15.5px] leading-[1.65] print:border-0 print:px-0 print:py-0 sm:px-14">
          {has("Titre et contexte") && <header>
            <div className="eyebrow font-sans">Modelly TIS Research · Rapport {exp.short_id}</div>
            <h1 className="mt-2 text-[32px] font-semibold leading-tight">Impact des stratégies <em className="text-botanic">TIS</em> selon la culture</h1>
            <p className="mt-1 text-[18px] text-muted">{exp.name}</p>
            {H("Titre et contexte")}<p className="mt-2">Ce rapport présente les résultats de simulations individu-centrées de la Technique de l’Insecte Stérile sur {crops.map((c) => `${meta.crops[c].label.toLowerCase()} (${meta.crops[c].latin})`).join(" et ")}. Les résultats proviennent du moteur extrait du notebook de référence, exécuté le {fmtDate(exp.finished_at)}.</p>
          </header>}
          {has("Objectifs") && <>{H("Objectifs")}<p>Décrire l’effet de différentes stratégies de lâchers de mâles stériles, à budget égal ({fmtInt(exp.config.budget)} stériles par saison), sur les populations de ravageurs et sur les dommages aux fruits, et comparer ces effets entre cultures.</p></>}
          {has("Description du modèle") && <>{H("Description du modèle")}<p>Modèle individu-centré journalier sans espace : mâles sauvages et stériles, femelles, larves et fruits. Les équations sont présentées en annexe (Protocole).</p></>}
          {has("Protocole expérimental") && <>{H("Protocole expérimental")}
            <ul className="list-disc pl-6"><li>Cultures : {crops.map((c) => meta.crops[c].label).join(", ")}.</li>
              <li>Stratégies : {res.scenarios.filter((s) => s.crop === crops[0]).map((s) => s.strategy_label).join(", ")}.</li>
              <li>Invasion initiale : {fmtInt(exp.config.invasion.wild)} mâles sauvages et {fmtInt(exp.config.invasion.females)} femelles.</li>
              <li>Réaccouplement : {meta.remating[exp.config.remating]?.label}. Répétitions : {exp.config.replicates} (graines {exp.config.seed} + 1000·r, communes à tous les scénarios).</li></ul></>}
          {has("Paramètres") && <>{H("Paramètres")}
            <table className="w-full font-sans text-[12px]"><tbody>{meta.biology.map((p) => (
              <tr key={p.name} className="border-b border-line/60"><td className="py-1">{p.description.split(".")[0]}</td><td className="py-1 text-right tnum">{String(exp.config.biology[p.name]).replace(".", ",")}</td><td className="py-1 pl-2 text-muted">{p.unit}</td><td className="py-1 pl-2 text-muted">{exp.config.biology[p.name] !== p.default ? `modifié (notebook : ${String(p.default).replace(".", ",")})` : ""}</td></tr>))}</tbody></table></>}
          {has("Résultats") && <>{H("Résultats")}
            {crops.map((c) => (
              <div key={c} className="mt-3">
                <h3 className="text-[17px] font-semibold" style={{ color: CROP_COLOR[c] }}>{meta.crops[c].label}</h3>
                <table className="mt-1 w-full font-sans text-[12px]">
                  <thead><tr className="border-b border-line text-left text-muted"><th className="py-1 font-medium">Stratégie</th>{["larval_damage_pct", "harvested_clean_pct", "rotten_sterile_only_pct", "sterile_puncture_share_pct", "larvae_produced"].map((k) => <th key={k} className="py-1 text-right font-medium">{METRIC[k].label}<div className="font-normal">{METRIC[k].unit}</div></th>)}</tr></thead>
                  <tbody>{res.scenarios.filter((s) => s.crop === c).map((s) => (
                    <tr key={s.key} className="border-b border-line/60"><td className="py-1">{s.strategy_label}</td>
                      {["larval_damage_pct", "harvested_clean_pct", "rotten_sterile_only_pct", "sterile_puncture_share_pct", "larvae_produced"].map((k) => <td key={k} className="py-1 text-right tnum">{fmt(s.metrics[k].mean, METRIC[k].digits)}<span className="text-muted"> ± {fmt(s.metrics[k].sd, METRIC[k].digits)}</span></td>)}</tr>))}</tbody>
                </table>
              </div>
            ))}</>}
          {has("Graphiques") && <>{H("Graphiques")}
            {crops.map((c) => <figure key={c} className="mt-3 font-sans">
              <TimeSeriesChart height={240} xLabel="Jour de saison" yLabel="Population relative" zoomable={false} ariaLabel={`Population relative, ${c}`}
                series={res.scenarios.filter((s) => s.crop === c).map((s) => ({ id: s.key, label: s.strategy_label, color: STRATEGY_COLOR[s.strategy_key] ?? "#547B91", dash: s.is_control ? "4 3" : undefined, x: s.series.Time, y: s.series.Wild_adults_relative.mean, sd: s.series.Wild_adults_relative.sd }))} />
              <figcaption className="text-[11.5px] text-muted">Figure — {meta.crops[c].label} : adultes sauvages (W + F) rapportés à J0, moyenne ± écart-type ({exp.config.replicates} répétitions). Témoin en tirets. {res.scenarios.filter((s) => s.crop === c).map((s) => <span key={s.key} className="mr-2 inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: STRATEGY_COLOR[s.strategy_key] }} />{s.strategy_label}</span>)}</figcaption>
            </figure>)}</>}
          {has("Comparaisons") && <>{H("Comparaisons")}{crops.map((c) => <p key={c}><strong>{meta.crops[c].label}.</strong> Variation des dommages larvaires par rapport au témoin (appariée) : {res.scenarios.filter((s) => s.crop === c && s.vs_control).map((s) => `${s.strategy_label} ${fmt(s.vs_control!.larval_damage_pct?.mean, 1)} %`).join(" ; ")}.</p>)}</>}
          {has("Analyse des incertitudes") && <>{H("Analyse des incertitudes")}<p>Les incertitudes reflètent uniquement la variabilité stochastique entre {exp.config.replicates} répétitions (écart-type corrigé). L’écart-type des dommages larvaires varie de {fmt(Math.min(...res.scenarios.map((s) => s.metrics.larval_damage_pct.sd)), 2)} à {fmt(Math.max(...res.scenarios.map((s) => s.metrics.larval_damage_pct.sd)), 2)} point. L’incertitude sur les paramètres n’est pas évaluée et aucun test statistique n’est appliqué.</p></>}
          {has("Limites") && <>{H("Limites")}<p>Modèle sans espace, paramètres non calibrés dans ce document, budget exprimé en nombre d’insectes, trois répétitions par défaut. Voir l’annexe pour le détail.</p></>}
          {has("Conclusion descriptive") && <>{H("Conclusion descriptive")}{crops.map((c) => { const d = describe(res, c); if (!d) return null; return (
            <p key={c}><strong>{meta.crops[c].label}.</strong> Sur ces {d.n} répétitions, les dommages larvaires moyens les plus faibles sont observés avec « {d.lo.strategy_label} » ({fmt(d.lo.metrics.larval_damage_pct.mean, 2)} % des fruits) et les plus élevés parmi les stratégies TIS avec « {d.hi.strategy_label} » ({fmt(d.hi.metrics.larval_damage_pct.mean, 2)} %){d.ctrl ? `, contre ${fmt(d.ctrl.metrics.larval_damage_pct.mean, 2)} % pour le témoin` : ""}. Les pourris par piqûres stériles seules vont de {fmt(d.stLo.metrics.rotten_sterile_only_pct.mean, 2)} % (« {d.stLo.strategy_label} ») à {fmt(d.stHi.metrics.rotten_sterile_only_pct.mean, 2)} % (« {d.stHi.strategy_label} »). Ces constats sont descriptifs et propres aux hypothèses du modèle.</p>); })}</>}
          {has("Métadonnées de reproductibilité") && <>{H("Métadonnées de reproductibilité")}
            <dl className="grid grid-cols-[200px_1fr] gap-x-3 font-sans text-[12px]">
              {([["Expérience", `${exp.short_id} (${exp.id})`], ["Empreinte de configuration", exp.config_hash], ["Moteur", exp.engine_version], ["Paramètres", exp.params_version], ["Schéma", `v${exp.schema_version}`], ["modelly / Python", `${meta.versions.modelly_version} / ${meta.versions.python}`], ["Graine de base", String(exp.seed)], ["Exécution", `${fmtDate(exp.started_at)} → ${fmtDate(exp.finished_at)} (${exp.duration_s} s)`]] as [string, string][]).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="font-mono">{v}</dd></Fragment>)}
            </dl></>}
          <section className="mt-12 border-t border-line pt-8" style={{ breakBefore: "page" }}><div className="eyebrow mb-6 font-sans">Annexe — Protocole scientifique</div><ProtocolViewer meta={meta} /></section>
        </article>
      ) : <Skeleton className="mt-6 h-96" />)}
      {!exp && <EmptyState title="Sélectionnez une expérience" illustration={<FileText />} />}
    </>
  );
}
