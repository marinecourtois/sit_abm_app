import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMeta } from "../lib/meta";
import type { Meta } from "../lib/api";
import { CROP_LABEL, fmtInt } from "../lib/format";
import { everyText } from "../lib/analysis";
import { StudyHeader, StudyTabs } from "../components/layout";
import { Badge, Button, Panel, PanelTitle, Tex } from "../components/ui";
import { ResearchAnnotation } from "../components/science";
import { ParameterGroups } from "../components/parameters";
import { downloadText } from "../components/charts/exportChart";
import { Download, Play, RotateCcw } from "../icons";
import { parametersJson } from "./Protocol";

const STORE = "tis-parametres";
const dec = (x: number) => String(x).replace(".", ",");

/** Paramètres des cultures affichés (CropParameters du notebook, cellule 2). */
const CROP_ROWS: [string, string, string][] = [
  ["season_length", "Durée de la saison", "jours"],
  ["total_fruits", "Fruits produits sur la saison", "fruits"],
  ["initial_fruits", "Fruits présents à J0", "fruits"],
  ["daily_fruit_production", "Production quotidienne", "fruits / jour"],
  ["maturation_min", "Maturité (min)", "jours"],
  ["maturation_max", "Maturité (max)", "jours"],
  ["natural_lifespan_min", "Durée de vie d’un fruit (min)", "jours"],
  ["natural_lifespan_max", "Durée de vie d’un fruit (max)", "jours"],
  ["harvest_frequency", "Récolte tous les", "jours (0 = récolte finale)"],
  ["prophylaxis_frequency", "Prophylaxie tous les", "jours (0 = aucune)"],
];

function load(meta: Meta): Record<string, number> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Record<string, number> | null;
    if (saved) return { ...meta.biology_defaults, ...Object.fromEntries(Object.entries(saved).filter(([k, v]) => k in meta.biology_defaults && typeof v === "number" && Number.isFinite(v))) };
  } catch { /* stockage indisponible */ }
  return { ...meta.biology_defaults };
}

/** Catalogue des paramètres du modèle : valeurs modifiables, sources, puis lancement dans le Studio. */
export function Parameters() {
  const meta = useMeta();
  const nav = useNavigate();
  const [cat, setCat] = useState("all");
  const [values, setValues] = useState<Record<string, number> | null>(null);
  useEffect(() => { if (meta && !values) setValues(load(meta)); }, [meta]);
  useEffect(() => { if (values) try { sessionStorage.setItem(STORE, JSON.stringify(values)); } catch { /* */ } }, [values]);
  const modified = useMemo(() => (meta && values ? meta.biology.filter((p) => values[p.name] !== p.default) : []), [meta, values]);

  if (!meta || !values) return <div className="skeleton mt-6 h-96" />;
  const groups = meta.biology_groups;
  const cats = [{ value: "all", label: "Tous" }, ...groups.map((g) => ({ value: g.key, label: g.label.replace(" (désactivées par défaut)", "") })),
    { value: "cultures", label: "Cultures" }, { value: "constantes", label: "Constantes fixes" }];
  // L'immigration se règle par culture (Studio, section « Immigration quotidienne ») : pas dans les réglages globaux
  const shown = meta.biology.filter((p) => (cat === "all" || p.group === cat) && !p.name.startsWith("immigration_"));
  const exportJson = () => {
    const doc = JSON.parse(parametersJson(meta));
    doc.current = values;   // valeurs choisies sur cette page
    downloadText(JSON.stringify(doc, null, 2), `parametres-${meta.params_version}${modified.length ? "-modifies" : ""}.json`, "application/json");
  };

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Paramètres" title="Paramètres du modèle"
        subtitle="Valeurs du notebook, plages admises et sources ; ajustez-les puis lancez une simulation"
        actions={<div className="flex flex-wrap gap-2">
          <Button icon={<RotateCcw size={14} />} disabled={!modified.length} onClick={() => setValues({ ...meta.biology_defaults })}>Valeurs du notebook</Button>
          <Button icon={<Download size={14} />} onClick={exportJson}>Exporter JSON</Button>
          <Button variant="primary" icon={<Play size={14} fill="currentColor" />} onClick={() => nav("/simulation", { state: { biology: values } })}>Ouvrir dans le Studio</Button>
        </div>} />
      <StudyTabs />
      <div className="mt-4"><ResearchAnnotation>
        {modified.length
          ? <><strong>{modified.length} paramètre{modified.length > 1 ? "s" : ""} modifié{modified.length > 1 ? "s" : ""}</strong> : {modified.map((p) => p.label).join(", ")}. « Ouvrir dans le Studio » reprend ces valeurs pour une nouvelle expérience.</>
          : <>Toutes les valeurs sont celles du notebook ({meta.params_version}). Les plages admises sont des bornes de validité technique, pas des plages d’incertitude biologique.</>}
      </ResearchAnnotation></div>

      <Panel className="mt-4 px-5 py-3">
        <div role="tablist" aria-label="Catégorie" className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c.value} type="button" role="tab" aria-selected={cat === c.value} onClick={() => setCat(c.value)}
              className={`rounded-[5px] border px-2.5 py-1 text-[12.5px] ${cat === c.value ? "border-botanic bg-botanic text-white" : "border-line bg-white text-ink hover:border-botanic/50"}`}>{c.label}</button>
          ))}
        </div>
      </Panel>

      {cat !== "cultures" && cat !== "constantes" && (
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Panel className="px-5 py-4">
            <PanelTitle sub="Curseur : valeur choisie · repère vertical : valeur du notebook">Réglages</PanelTitle>
            <div className="mt-3"><ParameterGroups params={shown} values={values} onChange={setValues} /></div>
          </Panel>
          <Panel className="min-w-0 px-5 py-4">
            <PanelTitle sub="Symbole, valeur, plage admise et source de chaque paramètre">Catalogue</PanelTitle>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead><tr className="border-b border-line text-left text-[11.5px] text-muted">
                  <th className="py-1.5 pr-3 font-medium">Symbole</th><th className="py-1.5 pr-3 font-medium">Paramètre</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Valeur</th><th className="py-1.5 pr-3 text-right font-medium">Notebook</th>
                  <th className="py-1.5 pr-3 font-medium">Plage</th><th className="py-1.5 pr-3 font-medium">Unité</th><th className="py-1.5 font-medium">Source</th>
                </tr></thead>
                <tbody>{shown.map((p) => {
                  const mod = values[p.name] !== p.default;
                  return (
                    <tr key={p.name} className="border-b border-line/60 align-top">
                      <td className="py-1.5 pr-3"><Tex>{p.symbol}</Tex></td>
                      <td className="py-1.5 pr-3">{p.label}{p.extension && <span className="ml-1.5"><Badge tone="terracotta">hors notebook</Badge></span>}
                        <div className="text-[11px] leading-snug text-muted">{p.description}</div></td>
                      <td className={`py-1.5 pr-3 text-right tnum ${mod ? "font-semibold text-terracotta" : ""}`}>{dec(values[p.name])}</td>
                      <td className="py-1.5 pr-3 text-right tnum text-muted">{p.extension ? `${dec(p.default)} (désactivé)` : dec(p.default)}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 tnum text-muted">{dec(p.min)} – {dec(p.max)}</td>
                      <td className="py-1.5 pr-3 text-muted">{p.unit}</td>
                      <td className="max-w-[180px] py-1.5 font-mono text-[11px] text-muted [overflow-wrap:anywhere]">{p.source}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {(cat === "all" || cat === "cultures") && (
        <Panel className="mt-4 px-5 py-4">
          <PanelTitle sub="CropParameters du notebook (cellule 2) — fixés, non modifiables dans l’application">Cultures</PanelTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead><tr className="border-b border-line text-left text-[11.5px] text-muted"><th className="py-1.5 font-medium">Paramètre</th>
                {(["strawberry", "cherry"] as const).map((c) => <th key={c} className="py-1.5 text-right font-medium">{CROP_LABEL[c]} <span className="font-normal italic">{meta.crops[c].latin}</span></th>)}
                <th className="py-1.5 pl-4 font-medium">Unité</th></tr></thead>
              <tbody>{CROP_ROWS.map(([k, l, u]) => (
                <tr key={k} className="border-b border-line/60"><td className="py-1.5">{l}</td>
                  {(["strawberry", "cherry"] as const).map((c) => <td key={c} className="py-1.5 text-right tnum">{fmtInt(Number(meta.crops[c].params[k]))}</td>)}
                  <td className="py-1.5 pl-4 text-muted">{u}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <h3 className="mt-4 text-[13.5px] font-semibold">Inoculum de départ (préréglages)</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">{Object.entries(meta.invasions).map(([k, v]) => (
            <div key={k} className="rounded-md border border-line bg-white px-3 py-2 text-[12.5px]"><strong>{v.label.split(" (")[0]}</strong>
              {v.by_crop
                ? <>{Object.entries(v.by_crop).map(([c, n]) => <div key={c} className="tnum text-muted">{CROP_LABEL[c]} : {fmtInt(n.wild)} mâles, {fmtInt(n.females)} femelles à J0</div>)}
                    <div className="mt-1 text-[11px] leading-snug text-muted">{v.description} Plan factoriel du notebook : {fmtInt(v.wild)} + {fmtInt(v.females)}.</div></>
                : <div className="tnum text-muted">{fmtInt(v.wild)} mâles sauvages, {fmtInt(v.females)} femelles à J0</div>}
            </div>
          ))}</div>
          <h3 className="mt-4 text-[13.5px] font-semibold">Immigration pré-remplie <span className="font-normal text-muted">(désactivée par défaut ; à activer et régler dans le Studio)</span></h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(meta.immigration_defaults ?? {}).map(([c, n]) => (
            <div key={c} className="rounded-md border border-line bg-white px-3 py-2 text-[12.5px]"><strong>{CROP_LABEL[c]}</strong>
              <div className="tnum text-muted">{n.wild} mâles sauvages et {n.females} femelles fécondées {everyText(n.every)}, à partir de J1</div></div>
          ))}</div>
        </Panel>
      )}

      {(cat === "all" || cat === "constantes") && (
        <Panel className="mt-4 px-5 py-4">
          <PanelTitle sub="Valeurs écrites dans le code du notebook ; voir le Protocole pour leur rôle dans les équations">Constantes fixes du modèle</PanelTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12.5px]">
              <thead><tr className="border-b border-line text-left text-[11.5px] text-muted"><th className="py-1.5 pr-3 font-medium">Symbole</th><th className="py-1.5 pr-3 font-medium">Nom</th><th className="py-1.5 pr-3 font-medium">Valeur</th><th className="py-1.5 pr-3 font-medium">Unité</th><th className="py-1.5 font-medium">Source</th></tr></thead>
              <tbody>{meta.fixed_constants.map((c) => (
                <tr key={c.name} className="border-b border-line/60"><td className="py-1.5 pr-3"><Tex>{c.symbol}</Tex></td><td className="py-1.5 pr-3">{c.name}</td>
                  <td className="py-1.5 pr-3 tnum">{c.value}</td><td className="py-1.5 pr-3 text-muted">{c.unit}</td><td className="py-1.5 font-mono text-[11px] text-muted">{c.source}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Équations et ordre des opérations : <Link className="text-forest underline" to="/protocole">Protocole</Link> · architecture des agents : <Link className="text-forest underline" to="/modele">Modèle</Link>.</p>
        </Panel>
      )}
    </>
  );
}
