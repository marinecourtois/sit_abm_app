import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CircleX, Download, Play, Plus, RotateCcw, Save, Trash2, Upload } from "../icons";
import { api, type BiologyParam, type CropKey, type ExperimentConfig, type StrategySpec, type Validation } from "../lib/api";
import { useMeta } from "../lib/meta";
import { CROP_LABEL, fmt, fmtInt } from "../lib/format";
import { CROP_COLOR, STRATEGY_COLOR } from "../lib/colors";
import { StudyHeader } from "../components/layout";
import { Badge, Button, Collapsible, NumberField, Panel, PanelTitle, ScientificTooltip, Segmented, Select, Tex, useToast } from "../components/ui";
import { ReleaseCalendar } from "../components/SimulationTimeline";
import { downloadText } from "../components/charts/exportChart";
import { CherryDot, StrawberryDot } from "./Overview";

const PRESETS: StrategySpec["key"][] = ["daily", "every_3", "every_7", "front_70", "front_100"];

function useMode(): ["essentiel" | "avance", (m: "essentiel" | "avance") => void] {
  const [m, setM] = useState<"essentiel" | "avance">(() => { try { return (localStorage.getItem("tis-mode") as "avance") || "essentiel"; } catch { return "essentiel"; } });
  return [m, (v) => { setM(v); try { localStorage.setItem("tis-mode", v); } catch { /* */ } }];
}

export function ParameterField({ p, value, onChange }: { p: BiologyParam; value: number; onChange: (v: number) => void }) {
  const modified = value !== p.default;
  const invalid = !Number.isFinite(value) || value < p.min || value > p.max;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-x-3 gap-y-0.5 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="truncate">{p.description.split(".")[0].replace(/\s*\(.*$/, "")}</span>
          <ScientificTooltip content={<div className="space-y-1"><div><Tex>{p.symbol}</Tex> — {p.description}</div><div className="text-muted">Unité : {p.unit} · plage admise [{p.min} ; {p.max}] · défaut {p.default}</div><div className="text-muted">Source : {p.source}</div></div>} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Tex>{p.symbol}</Tex><span>{p.unit}</span>
          {modified && <button type="button" onClick={() => onChange(p.default)} className="inline-flex items-center gap-0.5 text-terracotta hover:underline"><RotateCcw size={10} />défaut {p.default}</button>}
        </div>
      </div>
      <NumberField label={p.name} value={value} onChange={onChange} min={p.min} max={p.max} step={p.step} invalid={invalid} />
    </div>
  );
}

function StrategySelector({ value, onChange, mode, includeControl, setIncludeControl }: {
  value: StrategySpec[]; onChange: (v: StrategySpec[]) => void; mode: string; includeControl: boolean; setIncludeControl: (b: boolean) => void;
}) {
  const meta = useMeta();
  const has = (k: string) => value.some((s) => s.key === k && s.interval == null && s.initial_fraction == null);
  const toggle = (k: StrategySpec["key"]) => onChange(has(k) ? value.filter((s) => !(s.key === k && s.interval == null && s.initial_fraction == null)) : [...value, { key: k }]);
  const custom = value.filter((s) => s.key === "periodic" || s.key === "front_loaded");
  const upd = (i: number, patch: Partial<StrategySpec>) => { const c = [...custom]; c[i] = { ...c[i], ...patch }; onChange([...value.filter((s) => !custom.includes(s)), ...c]); };
  return (
    <div className="space-y-1.5">
      {PRESETS.map((k) => (
        <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded px-1.5 py-1 hover:bg-sage-soft">
          <input type="checkbox" checked={has(k)} onChange={() => toggle(k)} className="mt-0.5 h-4 w-4 accent-[#347A55]" />
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STRATEGY_COLOR[k] }} aria-hidden />
          <span className="min-w-0"><span className="text-[13.5px]">{meta?.strategies[k].label}</span>
            <span className="block text-[11.5px] leading-snug text-muted">{meta?.strategies[k].description}</span></span>
        </label>
      ))}
      <label className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1 hover:bg-sage-soft">
        <input type="checkbox" checked={includeControl} onChange={(e) => setIncludeControl(e.target.checked)} className="h-4 w-4 accent-[#347A55]" />
        <span className="text-[13.5px]">Inclure le témoin sans TIS</span><Badge>recommandé</Badge>
      </label>
      {mode === "avance" && (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          <div className="text-[12px] font-medium text-muted">Stratégies personnalisées (calendrier)</div>
          {custom.map((s, i) => (
            <div key={i} className="rounded border border-line bg-white p-2.5">
              <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium">
                {s.key === "periodic" ? "Lâchers périodiques" : "Lâcher initial + maintenance"}
                <button aria-label="Retirer" onClick={() => onChange(value.filter((x) => x !== s))} className="text-muted hover:text-cherry"><Trash2 size={14} /></button>
              </div>
              {s.key === "periodic" ? (
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <label>Fréquence (jours)<NumberField label="Intervalle" value={s.interval ?? 3} min={1} max={100} onChange={(v) => upd(i, { interval: v })} /></label>
                  <label>Début (jour)<NumberField label="Premier jour" value={s.first_day ?? 0} min={0} max={99} onChange={(v) => upd(i, { first_day: v })} /></label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <label>Part initiale<NumberField label="Fraction initiale" value={s.initial_fraction ?? 0.7} min={0} max={1} step={0.05} onChange={(v) => upd(i, { initial_fraction: v })} /></label>
                  <label>Maintenance (jours)<NumberField label="Intervalle de maintenance" value={s.maintenance_interval ?? 7} min={0} max={100} onChange={(v) => upd(i, { maintenance_interval: v })} /></label>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-muted">Fin : dernier jour de la saison de chaque culture. Budget réparti par les fonctions du notebook ({s.key === "periodic" ? "periodic_schedule" : "front_loaded_schedule"}).</p>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Plus size={13} />} onClick={() => onChange([...value, { key: "periodic", interval: 5, first_day: 0 }])}>Périodique</Button>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => onChange([...value, { key: "front_loaded", initial_fraction: 0.5, maintenance_interval: 5 }])}>Initial + maintenance</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SimulationConfigurator() {
  const meta = useMeta();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [mode, setMode] = useMode();
  const [name, setName] = useState("Nouvelle expérience");
  const [project, setProject] = useState("Étude 01");
  const [parent, setParent] = useState<string | undefined>();
  const [cfg, setCfg] = useState<ExperimentConfig | null>(null);
  const [val, setVal] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!meta || cfg) return;
    const from = sp.get("from");
    const base: ExperimentConfig = { crops: ["strawberry", "cherry"], strategies: [{ key: "every_3" }, { key: "every_7" }],
      invasion: { preset: "moyenne", wild: meta.invasions.moyenne.wild, females: meta.invasions.moyenne.females },
      budget: 9000, remating: "preference", replicates: 3, seed: 42, include_control: true, biology: { ...meta.biology_defaults } };
    if (from) api.experiment(from).then((e) => { setCfg(e.config); setName(`${e.name} (variante)`); setProject(e.project); setParent(e.id); }).catch(() => setCfg(base));
    else setCfg(base);
  }, [meta]);

  useEffect(() => {
    if (!cfg) return;
    const t = setTimeout(() => api.validate(cfg).then(setVal).catch((e) => setVal({ ok: false, errors: [e.message], warnings: [], scenarios: [], estimate: { seasons: 0, seconds: 0, basis: "" } })), 250);
    return () => clearTimeout(t);
  }, [cfg]);

  const set = <K extends keyof ExperimentConfig>(k: K, v: ExperimentConfig[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));
  const bio = meta?.biology ?? [];
  const modifiedBio = cfg ? bio.filter((p) => cfg.biology[p.name] !== p.default).length : 0;
  const maxRelease = useMemo(() => Math.max(1, ...(val?.scenarios ?? []).flatMap((s) => Object.values(s.schedule))), [val]);

  if (!cfg || !meta) return <div className="mt-6 grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-96" />)}</div>;

  const submit = async (run: boolean) => {
    if (!val?.ok) return;
    setBusy(true);
    try {
      const e = await api.create({ name, project, config: cfg, run, parent_id: parent });
      toast(run ? `Simulation ${e.short_id} lancée.` : `Expérience ${e.short_id} enregistrée.`, "success");
      nav(run ? `/simulation/${e.id}` : `/experiences?id=${e.id}`);
    } catch (err) { toast((err as Error).message, "error"); } finally { setBusy(false); }
  };
  const exportProtocol = () => downloadText(JSON.stringify({ format: "modelly-tis-protocol", schema_version: 1, name, config: cfg, versions: meta.versions }, null, 2), `${name.replace(/\W+/g, "-")}-protocole.json`, "application/json");
  const importProtocol = async (f: File) => {
    try { const doc = JSON.parse(await f.text()); if (doc.format !== "modelly-tis-protocol") throw new Error("Format « modelly-tis-protocol » attendu."); setCfg(doc.config); setName(doc.name ?? name); toast("Protocole importé : vérifiez la validation avant de lancer.", "info"); }
    catch (e) { toast(`Import impossible : ${(e as Error).message}`, "error"); }
  };

  const invPreset = cfg.invasion.preset && meta.invasions[cfg.invasion.preset] ? cfg.invasion.preset : "custom";
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)_330px]">
      {/* ---------- Gauche : paramètres */}
      <Panel className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle>Paramètres scientifiques</PanelTitle>
        </div>
        <div className="mt-3"><Segmented label="Niveau d'utilisation" size="sm" value={mode} onChange={setMode} options={[{ value: "essentiel", label: "Mode Essentiel" }, { value: "avance", label: "Mode Avancé" }]} /></div>
        <div className="mt-4 space-y-3.5 text-[13px]">
          <label className="block"><span className="font-medium">Nom de l’expérience</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 w-full rounded-[5px] border border-line bg-white px-2.5 text-[13.5px] outline-none focus:border-botanic" /></label>
          {mode === "avance" && <label className="block"><span className="font-medium">Projet</span>
            <input value={project} onChange={(e) => setProject(e.target.value)} className="mt-1 h-9 w-full rounded-[5px] border border-line bg-white px-2.5 text-[13.5px] outline-none focus:border-botanic" /></label>}
          <fieldset><legend className="font-medium">Culture</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["strawberry", "cherry"] as CropKey[]).map((c) => {
                const on = cfg.crops.includes(c);
                return (
                  <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-[5px] border px-2.5 py-2 ${on ? "border-botanic bg-sage-soft" : "border-line bg-white"}`}>
                    <input type="checkbox" className="h-4 w-4 accent-[#347A55]" checked={on} onChange={() => set("crops", on ? cfg.crops.filter((x) => x !== c) : [...cfg.crops, c])} />
                    {c === "strawberry" ? <StrawberryDot /> : <CherryDot />}
                    <span><span className="block">{meta.crops[c].label}</span><span className="block font-serif text-[11px] italic text-muted">{meta.crops[c].latin}</span></span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div>
            <div className="flex items-center gap-1.5 font-medium">Pression d’invasion <ScientificTooltip content="Effectifs initiaux d'adultes sauvages à J0 : mâles (W) et femelles (F). Préréglages du notebook (cellule 6), échelle 30." /></div>
            <div className="mt-1"><Select label="Pression d'invasion" value={invPreset}
              onChange={(v) => v === "custom" ? set("invasion", { ...cfg.invasion, preset: null }) : set("invasion", { preset: v, wild: meta.invasions[v].wild, females: meta.invasions[v].females })}
              options={[...Object.entries(meta.invasions).map(([k, v]) => ({ value: k, label: v.label })), ...(mode === "avance" ? [{ value: "custom", label: "Personnalisée…" }] : [])]} /></div>
            {(mode === "avance" || invPreset === "custom") && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <label>Mâles sauvages W<NumberField label="Mâles sauvages" value={cfg.invasion.wild} min={0} max={100000} step={10} unit="ind." onChange={(v) => set("invasion", { ...cfg.invasion, preset: null, wild: v })} /></label>
                <label>Femelles F<NumberField label="Femelles" value={cfg.invasion.females} min={0} max={100000} step={10} unit="ind." onChange={(v) => set("invasion", { ...cfg.invasion, preset: null, females: v })} /></label>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium">Budget <span className="font-normal text-muted">(mâles stériles lâchés par saison)</span>
              <ScientificTooltip content="Nombre total de mâles stériles lâchés sur la saison, réparti selon le calendrier de chaque stratégie. Le modèle ne contient pas de coût monétaire : aucune conversion n'est appliquée." /></div>
            <div className="mt-1"><NumberField label="Budget" value={cfg.budget} min={0} max={1000000} step={500} unit="stériles" onChange={(v) => set("budget", v)} invalid={!Number.isFinite(cfg.budget)} /></div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {meta.budget_presets.filter((b) => b > 0).map((b) => (
                <button key={b} type="button" onClick={() => set("budget", b)} className={`rounded border px-2 py-0.5 text-[11.5px] tnum ${cfg.budget === b ? "border-botanic bg-sage text-forest" : "border-line bg-white hover:border-botanic/50"}`}>{fmtInt(b)}</button>
              ))}
            </div>
          </div>
          <div><div className="font-medium">Stratégies de lâcher <span className="font-normal text-muted">et calendrier</span></div>
            <div className="mt-1"><StrategySelector value={cfg.strategies} onChange={(v) => set("strategies", v)} mode={mode} includeControl={cfg.include_control} setIncludeControl={(b) => set("include_control", b)} /></div></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="flex items-center gap-1 font-medium">Répétitions <ScientificTooltip content="Saisons indépendantes par scénario. La répétition r utilise la graine s₀ + 1000·r, identique dans tous les scénarios (nombres aléatoires communs)." /></span>
              <div className="mt-1"><NumberField label="Répétitions" value={cfg.replicates} min={1} max={30} onChange={(v) => set("replicates", v)} /></div></label>
            <label className="block"><span className="flex items-center gap-1 font-medium">Graine aléatoire <ScientificTooltip content="Graine de base s₀. Même configuration + même graine = mêmes résultats, au bit près (générateur Mersenne Twister du notebook)." /></span>
              <div className="mt-1"><NumberField label="Graine aléatoire" value={cfg.seed} min={0} max={2147483647} onChange={(v) => set("seed", v)} /></div></label>
          </div>
        </div>
        {mode === "avance" ? (
          <div className="mt-4">
            <Collapsible title="Accouplement et réaccouplement" defaultOpen>
              <Select label="Régime de réaccouplement" value={cfg.remating} onChange={(v) => set("remating", v)} options={Object.entries(meta.remating).map(([k, v]) => ({ value: k, label: v.label }))} />
              <p className="mt-1.5 text-[11.5px] text-muted">{meta.remating[cfg.remating]?.description}</p>
            </Collapsible>
            <Collapsible title="Paramètres biologiques" badge={modifiedBio ? <Badge tone="terracotta">{modifiedBio} modifié{modifiedBio > 1 ? "s" : ""}</Badge> : undefined}>
              <div className="divide-y divide-line/70">{bio.map((p) => <ParameterField key={p.name} p={p} value={cfg.biology[p.name]} onChange={(v) => set("biology", { ...cfg.biology, [p.name]: v })} />)}</div>
              <Button size="sm" variant="ghost" className="mt-2" icon={<RotateCcw size={13} />} onClick={() => set("biology", { ...meta.biology_defaults })}>Rétablir les valeurs du notebook</Button>
            </Collapsible>
          </div>
        ) : (
          <div className="mt-4 border-t border-line pt-3">
            <Collapsible title="Paramètres biologiques essentiels">
              <div className="divide-y divide-line/70">{bio.filter((p) => !p.advanced).map((p) => <ParameterField key={p.name} p={p} value={cfg.biology[p.name]} onChange={(v) => set("biology", { ...cfg.biology, [p.name]: v })} />)}</div>
              <p className="mt-2 text-[11.5px] text-muted">Le Mode Avancé donne accès aux {bio.length} paramètres exposés par le moteur et au régime de réaccouplement.</p>
            </Collapsible>
          </div>
        )}
      </Panel>

      {/* ---------- Centre : visualisation du scénario */}
      <Panel className="min-w-0 px-5 py-4">
        <PanelTitle sub="Calendrier des lâchers calculé par le moteur, pour chaque culture et stratégie">Visualisation du scénario</PanelTitle>
        <div className="mt-4 space-y-5">
          {cfg.crops.map((c) => {
            const sc = (val?.scenarios ?? []).filter((s) => s.crop === c);
            const p = meta.crops[c].params as Record<string, number>;
            return (
              <section key={c} aria-label={meta.crops[c].label}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-1.5">
                  <h3 className="flex items-center gap-2 font-serif text-[17px] font-semibold" style={{ color: CROP_COLOR[c] }}>{c === "strawberry" ? <StrawberryDot /> : <CherryDot />}{meta.crops[c].label} <span className="font-normal italic text-muted text-[13px]">{meta.crops[c].latin}</span></h3>
                  <span className="text-[11.5px] text-muted">{p.season_length} jours · {fmtInt(p.total_fruits)} fruits · {meta.crops[c].summary}</span>
                </div>
                {cfg.include_control && <div className="mt-2 flex items-center gap-3 text-[12.5px] text-muted"><span className="w-[84px] shrink-0 sm:w-40">Témoin (sans TIS)</span><span>aucun lâcher</span></div>}
                <div className="mt-1 space-y-1">
                  {sc.filter((s) => s.strategy_key !== "no_tis").map((s, i) => (
                    <div key={i} className="grid grid-cols-[84px_minmax(0,1fr)_64px] items-center gap-2 sm:grid-cols-[160px_minmax(0,1fr)_92px] sm:gap-3">
                      <span className="truncate text-[12.5px]">{s.strategy}</span>
                      <ReleaseCalendar schedule={s.schedule} seasonLength={s.season_length} color={STRATEGY_COLOR[s.strategy_key] ?? "#547B91"} label={`${s.strategy} ${c}`} height={30} maxValue={maxRelease} />
                      <span className="text-right text-[11.5px] tnum text-muted">{s.release_days} lâcher{s.release_days > 1 ? "s" : ""}<br />{fmtInt(s.total_released)} st.</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {cfg.crops.length === 0 && <p className="text-[13px] text-muted">Sélectionnez au moins une culture.</p>}
        </div>
        <div className="mt-5 rounded-md bg-[#F6F7F3] px-4 py-3 text-[12px] leading-relaxed text-muted">
          Hauteur des barres ∝ √(stériles lâchés le jour J), échelle commune à toutes les lignes. Un lâcher au jour J est effectué au début du jour, avant les accouplements ;
          l’état enregistré au « Jour t » est celui du matin du jour t (convention du notebook, FIGURE 1).
        </div>
      </Panel>

      {/* ---------- Droite : récapitulatif et lancement */}
      <div className="flex flex-col gap-4">
        <Panel className="px-5 py-4">
          <PanelTitle>Récapitulatif</PanelTitle>
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
            <dt className="text-muted">Cultures</dt><dd>{cfg.crops.map((c) => CROP_LABEL[c]).join(", ") || "—"}</dd>
            <dt className="text-muted">Invasion</dt><dd className="tnum">{fmtInt(cfg.invasion.wild)} W : {fmtInt(cfg.invasion.females)} F</dd>
            <dt className="text-muted">Budget</dt><dd className="tnum">{fmtInt(cfg.budget)} mâles stériles / saison</dd>
            <dt className="text-muted">Stratégies</dt><dd>{cfg.strategies.length}{cfg.include_control ? " + témoin" : ""}</dd>
            <dt className="text-muted">Réaccouplement</dt><dd>{meta.remating[cfg.remating]?.label}</dd>
            <dt className="text-muted">Répétitions</dt><dd className="tnum">{cfg.replicates} · graines {cfg.seed} … {cfg.seed + 1000 * (cfg.replicates - 1)}</dd>
            <dt className="text-muted">Biologie</dt><dd>{modifiedBio ? `${modifiedBio} paramètre(s) modifié(s)` : "valeurs du notebook"}</dd>
            <dt className="text-muted">Moteur</dt><dd className="font-mono text-[11px]">{meta.engine_version} · {meta.params_version}</dd>
          </dl>
        </Panel>
        <Panel className="px-5 py-4" aria-live="polite">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            {val == null ? "Validation…" : val.ok ? <><CheckCircle2 size={17} className="text-botanic" /> Configuration valide</> : <><CircleX size={17} className="text-cherry" /> {val.errors.length} erreur{val.errors.length > 1 ? "s" : ""}</>}
          </div>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-snug">
            {val?.errors.map((e) => <li key={e} className="flex gap-1.5 text-cherry"><CircleX size={13} className="mt-0.5 shrink-0" />{e}</li>)}
            {val?.warnings.map((w) => <li key={w} className="flex gap-1.5 text-[#6B4E16]"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{w}</li>)}
          </ul>
          {val?.ok && <p className="mt-3 text-[12px] text-muted">Charge estimée : <strong className="text-ink tnum">{val.estimate.seasons}</strong> saisons, ≈ <strong className="text-ink tnum">{fmt(val.estimate.seconds, 0)} s</strong>. <span className="block text-[11px]">({val.estimate.basis})</span></p>}
          <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!val?.ok || busy} onClick={() => submit(true)} icon={<Play size={16} fill="currentColor" />}>Lancer la simulation</Button>
          <Button className="mt-2 w-full" disabled={!val?.ok || busy} onClick={() => submit(false)} icon={<Save size={15} />}>Enregistrer sans lancer</Button>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1" icon={<Download size={13} />} onClick={exportProtocol}>Exporter le protocole</Button>
            <label className="inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[5px] text-[13px] font-medium hover:bg-sage-soft">
              <Upload size={13} />Importer<input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importProtocol(e.target.files[0])} />
            </label>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function Studio() {
  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Simulation" title="Simulation Studio" subtitle="Configurer, valider et lancer une expérience reproductible" actions={<span />} />
      <SimulationConfigurator />
    </>
  );
}
