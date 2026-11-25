import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useMeta } from "../lib/meta";
import { datasetFromReference } from "../lib/analysis";
import type { Row } from "../lib/indicators";
import { StudyHeader, StudyTabs } from "../components/layout";
import { Badge, EmptyState, Panel, PanelTitle, Skeleton } from "../components/ui";
import { ResearchAnnotation } from "../components/science";
import { AnalysisSuite } from "../components/analysis/AnalysisSuite";

export function Analytics() {
  const meta = useMeta();
  const ref = useAsync(() => api.reference<Row>("factorial"), []);
  const data = useMemo(() => (ref.data && meta ? datasetFromReference(ref.data.rows, meta) : null), [ref.data, meta]);
  const nRep = data?.nRep ?? 0;

  if (ref.error) return <EmptyState title="Données de référence indisponibles">{ref.error}</EmptyState>;

  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Étude 01" title="Research Analytics" subtitle="Plan factoriel : cultures × inoculums de départ × budgets × stratégies" />
      <StudyTabs />
      <div className="mt-4"><ResearchAnnotation>
        <strong>Source :</strong> {ref.data?.description ?? "…"} <Badge tone="green">vérifié</Badge> {ref.data?.verified}
        <span className="block font-mono text-[10.5px] opacity-80">{ref.data?.source} · sha256 {ref.data?.sha256.slice(0, 16)}…</span>
        {ref.data?.provenance && <span className="block font-mono text-[10.5px] opacity-80">calculé le {String(ref.data.provenance.computed_at)} · moteur {String(ref.data.provenance.engine_version)} · modelly {String(ref.data.provenance.modelly_version)} · {String(ref.data.provenance.duration_s)} s</span>}
        {ref.data?.origin === "notebook" && nRep < (meta?.limits.replicates[0] ?? 0) && <span className="mt-1 block font-semibold text-[#6B4E16]">Attention : ce fichier ne contient que {nRep} répétitions, sous le minimum de l’étude ({meta?.limits.replicates[0]}). Lancer <code>make factorial</code> pour le recalculer.</span>}
        <span className="mt-1 block">Ces graphiques portent sur le plan factoriel de référence. Ceux d’une expérience que vous lancez sont dans la section « Analyses » de sa page de simulation.</span>
      </ResearchAnnotation></div>
      {ref.loading || !data || !meta ? <Skeleton className="mt-4 h-96" /> : (
        <AnalysisSuite data={data} meta={meta} source="Plan factoriel du notebook" exportPrefix=""
          aside={
            <Panel className="px-5 py-4">
              <PanelTitle sub="Paramètres biologiques (η, durées de vie, taux de pourrissement…)">Sensibilité paramétrique</PanelTitle>
              <div className="mt-3 rounded-md border border-dashed border-line bg-white/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
                Le plan factoriel du notebook ne fait varier que la culture, l’inoculum de départ, le budget, la stratégie et le régime de réaccouplement : aucune
                sensibilité aux paramètres biologiques ne peut en être tirée, donc aucune n’est affichée. Pour l’étudier, créez des variantes d’un même
                scénario dans le <Link className="text-forest underline" to="/simulation">Studio</Link> (Mode Avancé, un paramètre à la fois) puis comparez-les
                dans le <Link className="text-forest underline" to="/comparaison">Comparison Lab</Link>.
              </div>
            </Panel>
          } />
      )}
    </>
  );
}
