import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { BarChart3, Copy, Download, FileJson, Search, Trash2, Upload, X } from "../icons";
import { api, type Experiment } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { CROP_LABEL, STATUS_LABEL, fmtDate, fmtInt } from "../lib/format";
import { StudyHeader } from "../components/layout";
import { Badge, Button, EmptyState, ExperimentStatus, Panel, Select, Skeleton, useToast } from "../components/ui";

export function ExperimentTable({ rows, selected, onSelect, onOpen }: { rows: Experiment[]; selected?: Set<string>; onSelect?: (id: string) => void; onOpen: (e: Experiment) => void }) {
  const meta = useMeta();
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[860px] border-collapse text-[13px]">
        <caption className="sr-only">Liste des expériences</caption>
        <thead><tr className="border-b border-line bg-[#F6F7F3] text-left text-[12px] text-muted">
          {onSelect && <th className="w-8 px-3 py-2"><span className="sr-only">Sélection</span></th>}
          <th className="px-3 py-2 font-medium">Identifiant</th><th className="px-3 py-2 font-medium">Nom</th>
          <th className="px-3 py-2 font-medium">Cultures</th><th className="px-3 py-2 font-medium">Stratégies</th>
          <th className="px-3 py-2 text-right font-medium">Budget</th><th className="px-3 py-2 font-medium">Invasion</th>
          <th className="px-3 py-2 text-right font-medium">Rép.</th><th className="px-3 py-2 font-medium">Statut</th><th className="px-3 py-2 font-medium">Créée</th>
        </tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-sage-soft" onClick={() => onOpen(e)}>
              {onSelect && <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                <input type="checkbox" aria-label={`Sélectionner ${e.short_id}`} checked={selected?.has(e.id) ?? false} disabled={e.status !== "completed"} onChange={() => onSelect(e.id)} className="h-4 w-4 accent-[#347A55]" /></td>}
              <td className="px-3 py-2 font-mono text-[11.5px] text-muted">{e.short_id}</td>
              <td className="px-3 py-2"><button type="button" className="text-left font-medium hover:text-forest" onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}>{e.name}</button>
                {e.tags.includes("référence") && <span className="ml-2"><Badge tone="green">référence</Badge></span>}
                {e.parent_id && <span className="ml-2"><Badge>variante</Badge></span>}</td>
              <td className="px-3 py-2">{e.config.crops.map((c) => CROP_LABEL[c]).join(", ")}</td>
              <td className="px-3 py-2 text-muted">{e.config.strategies.map((s) => meta?.strategies[s.key]?.short ?? s.key).join(", ")}{e.config.include_control ? " + témoin" : ""}</td>
              <td className="px-3 py-2 text-right tnum">{fmtInt(e.config.budget)}</td>
              <td className="px-3 py-2 tnum text-muted">{e.config.invasion.wild} W : {e.config.invasion.females} F</td>
              <td className="px-3 py-2 text-right tnum">{e.config.replicates}</td>
              <td className="px-3 py-2"><ExperimentStatus status={e.status} progress={e.progress} /></td>
              <td className="px-3 py-2 whitespace-nowrap text-muted">{fmtDate(e.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Experiments() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const list = useAsync(() => api.experiments(), []);
  const all = list.data ?? [];
  const projects = Array.from(new Set(all.map((e) => e.project)));
  const rows = useMemo(() => all.filter((e) => (status === "all" || e.status === status) && (project === "all" || e.project === project)
    && (!q || `${e.name} ${e.short_id} ${e.description} ${e.config.crops.join(" ")}`.toLowerCase().includes(q.toLowerCase()))), [all, q, status, project]);
  const grouped = useMemo(() => { const g: Record<string, Experiment[]> = {}; rows.forEach((e) => (g[e.project] ??= []).push(e)); return g; }, [rows]);
  const detailId = sp.get("id");
  const detail = all.find((e) => e.id === detailId || e.short_id === detailId) ?? null;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 4) n.add(id); else toast("Quatre expériences au maximum par comparaison.", "info"); return n; });
  const importFile = async (f: File) => {
    try { const e = await api.importProtocol(JSON.parse(await f.text())); toast(`Protocole importé : ${e.short_id} (prête).`, "success"); list.reload(); }
    catch (err) { toast(`Import impossible : ${(err as Error).message}`, "error"); }
  };

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Expériences" title="Expériences" subtitle="Exécutions enregistrées, traçables et reproductibles" />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[260px] flex-1">
          <span className="sr-only">Rechercher</span>
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom, identifiant, culture…" className="h-9 w-full rounded-[5px] border border-line bg-white pl-8 pr-3 text-[13.5px] outline-none focus:border-botanic" />
        </label>
        <div className="w-44"><Select label="Statut" value={status} onChange={setStatus} options={[{ value: "all", label: "Tous les statuts" }, ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))]} /></div>
        <div className="w-44"><Select label="Projet" value={project} onChange={setProject} options={[{ value: "all", label: "Tous les projets" }, ...projects.map((p) => ({ value: p, label: p }))]} /></div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[5px] border border-[#AEB8AE] bg-white px-4 text-[14px] font-medium hover:border-ink">
          <Upload size={15} />Importer un protocole<input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
        <Button variant="primary" disabled={sel.size < 1} icon={<BarChart3 size={15} />} onClick={() => nav(`/comparaison?exp=${[...sel].join(",")}`)}>Comparer ({sel.size})</Button>
      </div>

      <div className="mt-4 space-y-5">
        {list.loading && !list.data ? <Skeleton className="h-64" /> :
          rows.length === 0 ? <EmptyState title="Aucune expérience" action={<Button variant="primary" onClick={() => nav("/simulation")}>Nouvelle simulation</Button>}>Aucun résultat pour ces filtres.</EmptyState> :
          Object.entries(grouped).map(([proj, items]) => (
            <Panel key={proj} className="overflow-hidden">
              <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5"><h2 className="font-serif text-[17px] font-semibold">{proj}</h2><span className="text-[12px] text-muted">{items.length} expérience{items.length > 1 ? "s" : ""}</span></div>
              <ExperimentTable rows={items} selected={sel} onSelect={toggle} onOpen={(e) => setSp({ id: e.id })} />
            </Panel>
          ))}
      </div>

      <ExperimentDrawer exp={detail} onClose={() => setSp({})} onChanged={() => list.reload()} />
    </>
  );
}

function ExperimentDrawer({ exp, onClose, onChanged }: { exp: Experiment | null; onClose: () => void; onChanged: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const meta = useMeta();
  const [confirm, setConfirm] = useState(false);
  return (
    <Dialog.Root open={!!exp} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] overflow-y-auto border-l border-line bg-ivory shadow-2xl focus:outline-none">
          {exp && (
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-mono text-[11.5px] text-muted">{exp.short_id}</div>
                  <Dialog.Title className="mt-1 font-serif text-[24px] font-semibold leading-tight">{exp.name}</Dialog.Title>
                  <Dialog.Description className="mt-1 text-[13px] text-muted">{exp.description || "Sans description."}</Dialog.Description></div>
                <Dialog.Close aria-label="Fermer" className="rounded p-1.5 hover:bg-sage"><X size={18} /></Dialog.Close>
              </div>
              <div className="mt-3"><ExperimentStatus status={exp.status} progress={exp.progress} /></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => nav(`/simulation/${exp.id}`)}>Ouvrir la simulation</Button>
                <Button size="sm" icon={<Copy size={13} />} onClick={() => nav(`/simulation?from=${exp.id}`)}>Dupliquer et modifier</Button>
                {exp.status === "completed" && <Button size="sm" icon={<BarChart3 size={13} />} onClick={() => nav(`/comparaison?exp=${exp.id}`)}>Comparer</Button>}
              </div>

              <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-wider text-muted">Reproductibilité</h3>
              <dl className="mt-2 grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                {([["Version du moteur", exp.engine_version], ["Version des paramètres", exp.params_version], ["Schéma de données", `v${exp.schema_version}`],
                  ["Empreinte de configuration", exp.config_hash], ["Graine de base", String(exp.seed)], ["Graines des répétitions", Array.from({ length: exp.config.replicates }, (_, r) => exp.seed + 1000 * r).join(", ")],
                  ["Créée", fmtDate(exp.created_at)], ["Démarrée", fmtDate(exp.started_at)], ["Terminée", fmtDate(exp.finished_at)],
                  ["Durée", exp.duration_s ? `${exp.duration_s} s` : "—"], ["Erreur", exp.error ?? "—"], ["Expérience parente", exp.parent_id ? exp.parent_id.slice(0, 8).toUpperCase() : "—"],
                  ["Python / modelly", `${meta?.versions.python} / ${meta?.versions.modelly_version}`]] as [string, string][]).map(([k, v]) => (
                  <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="break-all font-mono text-[11.5px]">{v}</dd></Fragment>
                ))}
              </dl>
              {exp.status === "completed" && <p className="mt-2 text-[11.5px] text-muted">Expérience terminée : configuration et résultats immuables. Toute modification crée une nouvelle exécution.</p>}

              <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-wider text-muted">Configuration complète</h3>
              <pre className="mt-2 max-h-64 overflow-auto rounded border border-line bg-white p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify(exp.config, null, 2)}</pre>

              <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-wider text-muted">Exports</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-white px-3 text-[12.5px] hover:border-ink" href={api.exportUrl(exp.id, "protocol")}><FileJson size={13} />Protocole (JSON)</a>
                {exp.has_results && <>
                  <a className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-white px-3 text-[12.5px] hover:border-ink" href={api.exportUrl(exp.id, "json")}><Download size={13} />Expérience + résultats (JSON)</a>
                  <a className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-white px-3 text-[12.5px] hover:border-ink" href={api.exportUrl(exp.id, "csv-metrics")}><Download size={13} />Métriques par répétition (CSV)</a>
                  <a className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-white px-3 text-[12.5px] hover:border-ink" href={api.exportUrl(exp.id, "csv-series")}><Download size={13} />Séries journalières (CSV)</a>
                </>}
              </div>

              <div className="mt-8 border-t border-line pt-4">
                {!confirm ? <Button variant="danger" size="sm" icon={<Trash2 size={13} />} disabled={exp.status === "running" || exp.status === "queued"} onClick={() => setConfirm(true)}>Supprimer l’expérience</Button> : (
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]"><span>Supprimer définitivement {exp.short_id} et ses résultats ?</span>
                    <Button variant="danger" size="sm" onClick={async () => { try { await api.remove(exp.id); toast("Expérience supprimée.", "success"); setConfirm(false); onClose(); onChanged(); } catch (e) { toast((e as Error).message, "error"); } }}>Confirmer</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button></div>
                )}
              </div>
              <p className="mt-4 text-[11.5px] text-muted"><Link to="/protocole" className="underline">Protocole scientifique</Link> du modèle utilisé.</p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
