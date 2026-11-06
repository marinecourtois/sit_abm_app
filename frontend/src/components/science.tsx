import type { ReactNode } from "react";
import { BarChart3, CalendarDays, Leaf } from "../icons";
import { CherryBranch, NoOffspring, StrawberryPlant, SterileMaleFly, WildFemaleFly } from "../illustrations";
import type { Meta } from "../lib/api";
import { useMeta } from "../lib/meta";
import { fmtInt } from "../lib/format";
import { Panel, Tex } from "./ui";

/** Carte botanique d'une culture — caractéristiques lues dans les paramètres du moteur. */
export function BotanicalSpeciesCard({ crop, meta }: { crop: "strawberry" | "cherry"; meta: Meta | null }) {
  const m = meta?.crops[crop];
  const p = m?.params as Record<string, number> | undefined;
  const bio = meta?.biology_defaults;
  const pct = (x?: number) => (x == null ? "—" : `${Math.round(x * 100)} %`);
  const two = (a: ReactNode, b: ReactNode, title: string) => <span title={title}>{a}<br /><span className="text-muted">{b}</span></span>;
  // Toutes les lignes sont générées depuis CropParameters / biology_defaults (aucun texte qualitatif écrit à la main)
  const closedStock = !!p && p.initial_fruits > 0 && !p.daily_fruit_production;
  const feats: { icon: ReactNode; text: ReactNode }[] = !p ? [] : [
    { icon: <CalendarDays size={19} strokeWidth={1.4} />, text: p.harvest_frequency
      ? two(`Récolte tous les ${p.harvest_frequency} j`, `(${pct(bio?.harvest_fraction)} des fruits mûrs)`, "CropParameters.harvest_frequency · harvest_fraction")
      : two(`Récolte unique à J${p.season_length - 1}`, `(saison de ${p.season_length} jours)`, "CropParameters.final_harvest · season_length") },
    { icon: <Leaf size={19} strokeWidth={1.4} />, text: closedStock
      ? two("Stock fermé", `(${fmtInt(p.initial_fruits)} fruits à J0)`, "CropParameters.initial_fruits")
      : two("Production continue", `(${fmtInt(p.daily_fruit_production)} fruits / jour, ${p.season_length} j)`, "CropParameters.daily_fruit_production · season_length") },
    { icon: <BarChart3 size={19} strokeWidth={1.4} />, text: p.prophylaxis_frequency
      ? two(`Prophylaxie tous les ${p.prophylaxis_frequency} j`, `(${pct(bio?.prophylaxis_fraction)} des fruits pourris)`, "CropParameters.prophylaxis_frequency · prophylaxis_fraction")
      : two(`Maturation en ${p.maturation_min}–${p.maturation_max} j`, `(sénescence ${p.natural_lifespan_min}–${p.natural_lifespan_max} j)`, "CropParameters.maturation_* · natural_lifespan_*") },
  ];
  const Illu = crop === "strawberry" ? StrawberryPlant : CherryBranch;
  return (
    <Panel className="flex h-full min-h-[184px] items-stretch overflow-hidden">
      <div className="relative flex w-[52%] shrink-0 items-center justify-center"><span aria-hidden className="absolute inset-3 rounded-full bg-[radial-gradient(closest-side,rgba(221,234,223,0.75),transparent)]" /><Illu className="relative h-auto max-h-[190px] w-full drop-shadow-[0_6px_8px_rgba(20,60,30,0.14)]" /></div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3">
        <h3 className={`font-serif text-[26px] font-semibold italic leading-none ${crop === "strawberry" ? "text-botanic" : "text-forest"}`}>{m?.label ?? "…"}</h3>
        <p className="mt-1 font-serif text-[14px] italic text-ink">{m?.latin}</p>
        <ul className="mt-2.5 space-y-1.5">
          {feats.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 font-serif text-[13px] leading-[1.22] text-ink">
              <span className="mt-0.5 shrink-0 text-ink">{f.icon}</span><span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Schéma : mâle stérile + femelle sauvage → accouplement stérile, pontes non viables.
 *  Mise en page pilotée par la largeur du conteneur (container queries) : horizontale si ≥ 20rem, sinon empilée. */
export function ScientificProcessDiagram({ compact = false, bare = false }: { compact?: boolean; bare?: boolean }) {
  const meta = useMeta();
  const cap = "font-serif text-[13px] leading-tight text-muted @max-xs:text-[12px]";
  const Male = <figure className="flex flex-col items-center"><SterileMaleFly className="h-auto w-full max-w-[104px]" /><figcaption className={cap}>Mâle stérile<br />(lâché)</figcaption></figure>;
  const Female = <figure className="flex flex-col items-center"><WildFemaleFly className="h-auto w-full max-w-[104px]" /><figcaption className={cap}>Femelle sauvage<br />(terrain)</figcaption></figure>;
  const body = (
    <div className="@container flex h-full w-full flex-col items-center text-center">
      {!bare && <>
        <h3 className="font-serif text-[18px] font-semibold leading-tight">Principe de la TIS</h3>
        <p className="font-serif text-[15px] text-ink">(Technique de l’Insecte Stérile)</p>
      </>}
      {/* large : une ligne */}
      <div className="mt-1 hidden w-full grid-cols-[1fr_auto_1fr_auto_0.8fr] items-center gap-1 @xs:grid">
        {Male}
        <span aria-hidden className="pb-7 text-[24px] font-light text-ink">+</span>
        {Female}
        <span aria-hidden className="pb-7 text-[26px] font-light leading-none text-ink"><span className="m-nudge">⟶</span></span>
        <figure className="flex flex-col items-center">
          <NoOffspring className="h-auto w-[58px]" />
          <figcaption className={`mt-1 ${cap}`}>Pas de<br />descendance</figcaption>
        </figure>
      </div>
      {/* étroit : deux lignes */}
      <div className="mt-1 w-full @xs:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
          {Male}<span aria-hidden className="pb-7 text-[22px] font-light text-ink">+</span>{Female}
        </div>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span aria-hidden className="text-[20px] font-light leading-none text-ink">↓</span>
          <NoOffspring className="h-auto w-[44px]" />
          <span className={`${cap} text-left`}>Pas de descendance</span>
        </div>
      </div>
      {!compact && (
        <p className="mt-auto pt-1 text-[11.5px] text-muted">
          Accouplement fertile avec probabilité <Tex>{"\\dfrac{W}{W+\\eta S}"}</Tex>, <Tex>{`\\eta = ${String(meta?.biology_defaults.eta ?? "").replace(".", "{,}")}`}</Tex>
        </p>
      )}
    </div>
  );
  if (bare) return body;
  return <Panel className="flex h-full min-h-[184px] flex-col items-center px-4 pt-2.5 pb-2">{body}</Panel>;
}

/** Indicateur scientifique : valeur + unité + contexte, jamais seul. */
export function ResearchMetric({ value, unit, context, tone, sd, title }: { value: string; unit?: string; context: string; tone: "green" | "terracotta"; sd?: string; title?: string }) {
  return (
    <div title={title} className={`flex flex-1 flex-col items-center justify-center rounded-[5px] px-2 py-2.5 text-center ${tone === "green" ? "bg-[linear-gradient(180deg,#E7F0E8,#DCEADF)]" : "bg-[linear-gradient(180deg,#FCEDE6,#F8DFD3)]"}`}>
      <div className={`font-serif text-[40px] font-semibold leading-none tnum ${tone === "green" ? "text-forest" : "text-terracotta"}`}>
        {value}<span className="ml-1 text-[34px]">{unit}</span>
      </div>
      <div className="mt-1.5 font-serif text-[14.5px] text-ink">{context}</div>
      {sd && <div className="text-[10.5px] text-muted tnum">± {sd} (écart-type)</div>}
    </div>
  );
}

export function UncertaintyLegend({ n, kind = "sd" }: { n: number; kind?: "sd" }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11.5px] text-muted">
      <svg width="26" height="12" aria-hidden><rect x="0" y="2" width="26" height="8" fill="#347A55" fillOpacity="0.15" /><line x1="0" x2="26" y1="6" y2="6" stroke="#347A55" strokeWidth="2" /></svg>
      Moyenne ± {kind === "sd" ? "écart-type" : ""} ({n} répétition{n > 1 ? "s" : ""})
    </span>
  );
}

export function ResearchAnnotation({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "demo" }) {
  const s = { info: "border-[#C9D8E1] bg-[#F3F7F9] text-[#2E4A5A]", warning: "border-[#E5D3AE] bg-[#FBF6EA] text-[#6B4E16]", demo: "border-[#E5D3AE] bg-[#FFF8E6] text-[#6B4E16]" }[tone];
  return <div className={`rounded-md border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${s}`}>{children}</div>;
}
