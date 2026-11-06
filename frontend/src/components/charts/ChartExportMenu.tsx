import { useEffect, useRef, useState } from "react";
import { Download } from "../../icons";
import { exportPng, exportSvg, type ExportMeta } from "./exportChart";

/** Menu d'export d'une figure. `getSvg` renvoie l'élément SVG à exporter. */
export function ChartExportMenu({ getSvg, meta, onCsv, iconOnly }: { getSvg: () => SVGSVGElement | null; meta: ExportMeta; onCsv?: () => void; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const run = (fn: (s: SVGSVGElement) => void) => () => { const s = getSvg(); if (s) fn(s); setOpen(false); };
  const item = "block w-full text-left px-3 py-1.5 text-[13px] hover:bg-sage-soft rounded";
  return (
    <div className="relative no-print" ref={ref}>
      {iconOnly ? (
        <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Exporter la figure" title="Exporter la figure (SVG, PNG, format publication)" onClick={() => setOpen((o) => !o)}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted opacity-60 transition-opacity hover:bg-sage-soft hover:text-ink hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100">
          <Download size={15} aria-hidden />
        </button>
      ) : (
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded border border-line bg-white px-2 py-1 text-[12px] text-muted hover:text-ink hover:border-botanic/50">
          <Download size={13} aria-hidden /> Exporter
        </button>
      )}
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-60 rounded-md border border-line bg-white p-1 shadow-lg">
          <button role="menuitem" className={item} onClick={run((s) => exportSvg(s, meta))}>SVG vectoriel</button>
          <button role="menuitem" className={item} onClick={run((s) => exportPng(s, meta, { scale: 3 }))}>PNG haute résolution (×3)</button>
          <div className="my-1 border-t border-line" />
          <div className="px-3 pt-1 pb-0.5 text-[10.5px] uppercase tracking-wider text-muted">Format publication</div>
          <button role="menuitem" className={item} onClick={run((s) => exportSvg(s, meta, true))}>SVG — 170 mm, légende de figure</button>
          <button role="menuitem" className={item} onClick={run((s) => exportPng(s, meta, { publication: true }))}>PNG — 170 mm à 600 dpi</button>
          {onCsv && (<><div className="my-1 border-t border-line" />
            <button role="menuitem" className={item} onClick={() => { onCsv(); setOpen(false); }}>Données de la figure (CSV)</button></>)}
        </div>
      )}
    </div>
  );
}
