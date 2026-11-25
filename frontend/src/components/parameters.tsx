import type { BiologyParam } from "../lib/api";
import { useMeta } from "../lib/meta";
import { RotateCcw } from "../icons";
import { Badge, NumberField, ScientificTooltip, Tex } from "./ui";

const dec = (v: number) => String(v).replace(".", ",");

/** Un paramètre biologique : nom clair, symbole, unité, curseur avec repère de la valeur du notebook. */
export function ParameterField({ p, value, onChange }: { p: BiologyParam; value: number; onChange: (v: number) => void }) {
  const modified = value !== p.default;
  const invalid = !Number.isFinite(value) || value < p.min || value > p.max;
  const pos = (v: number) => `${((v - p.min) / (p.max - p.min)) * 100}%`;
  return (
    <div className={`rounded-md border px-3 pb-2.5 pt-2 transition-colors ${invalid ? "border-cherry/50 bg-blush/40" : modified ? "border-terracotta/35 bg-[#FCF4EF]" : "border-line bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <label htmlFor={`bio-${p.name}`} className="text-[13px] font-medium leading-snug text-ink">
          {p.label} <span className="ml-0.5 font-normal text-muted"><Tex>{p.symbol}</Tex></span>
          {p.extension && <span className="ml-1.5 align-middle"><Badge tone="terracotta">hors notebook</Badge></span>}
        </label>
        <ScientificTooltip content={<div className="space-y-1"><div>{p.description}</div><div className="text-muted">Source : {p.source}</div></div>} />
      </div>
      <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_128px] items-center gap-3">
        <div className="relative h-6">
          <input type="range" aria-label={`${p.label} (curseur)`} min={p.min} max={p.max} step={p.step} value={Number.isFinite(value) ? value : p.default}
            onChange={(e) => onChange(Number(e.target.value))} className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2 accent-[#347A55]" />
          <span aria-hidden title={`Valeur du notebook : ${dec(p.default)}`} className="pointer-events-none absolute top-0 h-6 w-px bg-ink/45" style={{ left: pos(p.default) }} />
        </div>
        <NumberField id={`bio-${p.name}`} label={p.label} value={value} onChange={onChange} min={p.min} max={p.max} step={p.step} invalid={invalid} unit={p.unit === "sans dimension" || p.unit.length > 7 ? undefined : p.unit} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="tnum">plage {dec(p.min)} – {dec(p.max)}{p.unit !== "sans dimension" ? ` ${p.unit}` : ""} · {p.extension ? `désactivé à ${dec(p.default)}` : `notebook ${dec(p.default)}`}</span>
        {modified && <button type="button" onClick={() => onChange(p.default)} className="inline-flex items-center gap-1 font-medium text-terracotta hover:underline"><RotateCcw size={11} />Rétablir</button>}
      </div>
    </div>
  );
}

/** Paramètres regroupés par thème, avec compteur et rétablissement par groupe. */
export function ParameterGroups({ params, values, onChange }: { params: BiologyParam[]; values: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const meta = useMeta();
  return (
    <div className="space-y-4">
      {(meta?.biology_groups ?? []).map((g) => {
        const items = params.filter((p) => p.group === g.key);
        if (!items.length) return null;
        const mod = items.filter((p) => values[p.name] !== p.default);
        return (
          <section key={g.key} aria-label={g.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-forest">{g.label}</h4>
              {mod.length > 0 && <button type="button" className="text-[11px] text-terracotta hover:underline"
                onClick={() => onChange({ ...values, ...Object.fromEntries(mod.map((p) => [p.name, p.default])) })}>Rétablir ce groupe ({mod.length})</button>}
            </div>
            {g.key === "extensions" && <p className="mb-2 rounded border border-terracotta/30 bg-[#FCF4EF] px-2.5 py-1.5 text-[11.5px] leading-snug text-[#6B4E16]">
              Mécanismes absents du notebook. Désactivés à leur valeur par défaut : le moteur reproduit alors le notebook au bit près.
              Activés, ils changent le modèle : les résultats ne sont plus comparables au plan factoriel de référence.</p>}
            <div className="space-y-2">{items.map((p) => <ParameterField key={p.name} p={p} value={values[p.name]} onChange={(v) => onChange({ ...values, [p.name]: v })} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

