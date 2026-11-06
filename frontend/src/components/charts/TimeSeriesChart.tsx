import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleSymlog } from "d3-scale";
import { area, line, curveMonotoneX, curveLinear } from "d3-shape";
import { fmt } from "../../lib/format";

export interface ChartSeries {
  id: string; label: string; color: string; dash?: string;
  x: number[]; y: number[]; sd?: number[];
  marker?: "circle" | "square" | "triangle" | "diamond";
  width?: number; opacity?: number;
}
export interface ChartAnnotation { seriesId: string; x: number; lines: string[]; dx?: number; dy?: number; tone?: "green" | "terracotta" | "blue" }
export interface ChartEvent { x: number; label: string; type?: string }

export interface TimeSeriesChartProps {
  series: ChartSeries[];
  xLabel: string; yLabel: string;
  height?: number;
  yDomain?: [number, number];
  xDomain?: [number, number];
  yScale?: "linear" | "symlog";
  yFormat?: (v: number) => string;
  valueFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  annotations?: ChartAnnotation[];
  events?: ChartEvent[];
  showBands?: boolean;
  errorBars?: boolean;      // pour les points discrets (dose-réponse)
  showMarkers?: boolean;
  curve?: "smooth" | "linear";
  cursorX?: number | null;  // curseur contrôlé (frise chronologique)
  onCursor?: (x: number | null) => void;
  zoomable?: boolean;
  ariaLabel: string;
  referenceLines?: { y: number; label: string }[];
  uncertaintyLabel?: string;
  areaFill?: boolean;       // lavis décoratif dégradé sous les courbes (distinct des bandes d'incertitude)
}

const M = { top: 14, right: 22, bottom: 46, left: 62 };
const TONES = {
  green: { fill: "#EEF5EF", stroke: "#8DBA9C", text: "#1D4D35" },
  terracotta: { fill: "#FBEDE7", stroke: "#E2A48D", text: "#6F2C17" },
  blue: { fill: "#EAF1F5", stroke: "#9DB7C6", text: "#2E4A5A" },
};

export const TimeSeriesChart = forwardRef<SVGSVGElement | null, TimeSeriesChartProps>(function TimeSeriesChart(p, fwd) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(fwd, () => svgRef.current as SVGSVGElement);
  const [width, setWidth] = useState(720);
  const height = p.height ?? 300;
  const [hover, setHover] = useState<number | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allX = useMemo(() => Array.from(new Set(p.series.flatMap((s) => s.x))).sort((a, b) => a - b), [p.series]);
  const xExtent: [number, number] = zoom ?? p.xDomain ?? [allX[0] ?? 0, allX[allX.length - 1] ?? 1];
  const yExtent = useMemo<[number, number]>(() => {
    if (p.yDomain) return p.yDomain;
    // Les bandes ± écart-type n'étendent jamais l'axe sous 0 quand toutes les valeurs sont ≥ 0 (effectifs, proportions).
    let hi = 0, lo = Infinity;
    for (const s of p.series) s.y.forEach((v, i) => {
      if (s.x[i] < xExtent[0] || s.x[i] > xExtent[1] || !Number.isFinite(v)) return;
      const sd = p.showBands !== false || p.errorBars ? (s.sd?.[i] ?? 0) : 0;
      hi = Math.max(hi, v + sd); lo = Math.min(lo, v);
    });
    return [lo === Infinity || lo >= 0 ? 0 : lo, hi === 0 ? 1 : hi * 1.06];
  }, [p.series, p.yDomain, xExtent[0], xExtent[1], p.showBands, p.errorBars]);

  const iw = width - M.left - M.right, ih = height - M.top - M.bottom;
  const x = scaleLinear().domain(xExtent).range([0, iw]);
  const y = (p.yScale === "symlog" ? scaleSymlog().constant(1) : scaleLinear()).domain(yExtent).range([ih, 0]);
  if (p.yScale !== "symlog") (y as ReturnType<typeof scaleLinear>).nice(6);
  const yf = p.yFormat ?? ((v: number) => fmt(v, Math.abs(yExtent[1]) <= 2 ? 1 : 0));
  const vf = p.valueFormat ?? ((v: number) => fmt(v, Math.abs(v) < 10 ? 2 : 0));
  const xf = p.xFormat ?? ((v: number) => fmt(v, 0));
  const curve = p.curve === "linear" ? curveLinear : curveMonotoneX;
  const clipId = useMemo(() => "clip-" + Math.random().toString(36).slice(2, 8), []);
  const cursor = p.cursorX ?? hover;

  const xTicks = x.ticks(Math.max(3, Math.min(12, Math.floor(iw / 70))));
  const yTicks = p.yScale === "symlog" ? symlogTicks(yExtent[1]) : (y as ReturnType<typeof scaleLinear>).ticks(6);

  const nearestX = (px: number) => {
    const xv = x.invert(px);
    let best = allX[0], bd = Infinity;
    for (const v of allX) { const d = Math.abs(v - xv); if (d < bd && v >= xExtent[0] && v <= xExtent[1]) { bd = d; best = v; } }
    return best;
  };
  const toLocal = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return ((e.clientX - r.left) * width) / r.width - M.left;
  };
  const setCur = (v: number | null) => { setHover(v); p.onCursor?.(v); };

  const onKey = (e: React.KeyboardEvent) => {
    if (!allX.length) return;
    const i = cursor == null ? -1 : allX.indexOf(cursor);
    if (e.key === "ArrowRight") { setCur(allX[Math.min(allX.length - 1, i + 1)]); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { setCur(allX[Math.max(0, i - 1)]); e.preventDefault(); }
    else if (e.key === "Home") { setCur(allX[0]); e.preventDefault(); }
    else if (e.key === "End") { setCur(allX[allX.length - 1]); e.preventDefault(); }
    else if (e.key === "Escape") { setCur(null); setZoom(null); }
  };

  const tipRows = hover == null ? [] : p.series.map((s) => {
    const i = s.x.indexOf(hover);
    return i < 0 ? null : { s, v: s.y[i], sd: s.sd?.[i] };
  }).filter(Boolean) as { s: ChartSeries; v: number; sd?: number }[];
  const tipLeft = hover == null ? 0 : M.left + x(hover);

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {zoom && (
        <button type="button" onClick={() => setZoom(null)} data-export-hide
          className="no-print absolute right-6 top-1 z-10 rounded border border-line bg-white/90 px-2 py-0.5 text-[11px] text-muted hover:text-ink">
          Réinitialiser le zoom (J{xf(zoom[0])}–J{xf(zoom[1])})
        </button>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={p.ariaLabel}
        tabIndex={0} onKeyDown={onKey} className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-botanic/50 rounded"
        onPointerMove={(e) => {
          const lx = toLocal(e);
          if (drag) setDrag([drag[0], lx]);
          if (lx >= 0 && lx <= iw) setCur(nearestX(lx)); else if (!drag) setCur(null);
        }}
        onPointerLeave={() => { if (!drag) setCur(null); }}
        onPointerDown={(e) => { if (p.zoomable !== false) { const lx = toLocal(e); if (lx >= 0 && lx <= iw) setDrag([lx, lx]); } }}
        onPointerUp={() => {
          if (drag && Math.abs(drag[1] - drag[0]) > 12) {
            const a = x.invert(Math.min(drag[0], drag[1])), b = x.invert(Math.max(drag[0], drag[1]));
            setZoom([Math.max(xExtent[0], Math.floor(a)), Math.min(xExtent[1], Math.ceil(b))]);
          }
          setDrag(null);
        }}
        onDoubleClick={() => setZoom(null)}>
        <defs><clipPath id={clipId}><rect x={0} y={-4} width={iw} height={ih + 8} /></clipPath></defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {/* grille */}
          {yTicks.map((t) => <line key={"gy" + t} x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="#E3E8E1" strokeWidth={1} />)}
          {xTicks.map((t) => <line key={"gx" + t} y1={0} y2={ih} x1={x(t)} x2={x(t)} stroke="#EEF1EC" strokeWidth={1} />)}
          {p.referenceLines?.map((r) => (
            <g key={r.label}>
              <line x1={0} x2={iw} y1={y(r.y)} y2={y(r.y)} stroke="#657068" strokeDasharray="4 3" strokeWidth={1} />
              <text x={iw - 4} y={y(r.y) - 4} textAnchor="end" fontSize={10.5} fill="#657068">{r.label}</text>
            </g>
          ))}
          {/* événements */}
          {(() => {
            // libellés d'événements uniquement s'ils ne se chevauchent pas (sinon : repère seul, libellé en infobulle)
            let lastEnd = -Infinity;
            return p.events?.filter((e) => e.x >= xExtent[0] && e.x <= xExtent[1]).map((e, i) => {
              const px = x(e.x); const w = e.label.length * 5.4 + 6;
              const show = px > lastEnd + 4 && px + w < iw + M.right; if (show) lastEnd = px + w;
              return (
                <g key={"ev" + i}>
                  <title>{`J${e.x} — ${e.label}`}</title>
                  <line x1={px} x2={px} y1={0} y2={ih} stroke="#9AA59D" strokeDasharray="2 3" strokeWidth={1} />
                  {show && <text x={px + 3} y={10} fontSize={9.5} fill="#657068">{e.label}</text>}
                </g>
              );
            });
          })()}
          <g clipPath={`url(#${clipId})`}>
            {p.areaFill && p.series.map((s, k) => (
              <g key={"wash" + s.id}>
                <defs><linearGradient id={`${clipId}-w${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity={0.085} /><stop offset="0.85" stopColor={s.color} stopOpacity={0} />
                </linearGradient></defs>
                <path fill={`url(#${clipId}-w${k})`} d={area<number>().curve(curve).x((_, i) => x(s.x[i])).y0(ih).y1((v) => y(v))(s.y) ?? ""} />
              </g>
            ))}
            {p.showBands !== false && !p.errorBars && p.series.map((s) => s.sd && (
              <path key={"b" + s.id} fill={s.color} fillOpacity={0.2}
                d={area<number>().curve(curve).x((_, i) => x(s.x[i])).y0((_, i) => y(Math.max(yExtent[0], s.y[i] - (s.sd![i] ?? 0))))
                  .y1((_, i) => y(s.y[i] + (s.sd![i] ?? 0)))(s.y) ?? ""} />
            ))}
            {p.series.map((s) => (
              <path key={"l" + s.id} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.6} strokeDasharray={s.dash}
                strokeLinejoin="round" strokeLinecap="round" opacity={s.opacity ?? 1}
                d={line<number>().curve(curve).x((_, i) => x(s.x[i])).y((v) => y(v))(s.y) ?? ""} />
            ))}
            {p.errorBars && p.series.map((s) => s.y.map((v, i) => s.sd && (
              <g key={`eb${s.id}${i}`} stroke={s.color} strokeWidth={1.2}>
                <line x1={x(s.x[i])} x2={x(s.x[i])} y1={y(Math.max(yExtent[0], v - s.sd[i]))} y2={y(v + s.sd[i])} />
                <line x1={x(s.x[i]) - 4} x2={x(s.x[i]) + 4} y1={y(Math.max(yExtent[0], v - s.sd[i]))} y2={y(Math.max(yExtent[0], v - s.sd[i]))} />
                <line x1={x(s.x[i]) - 4} x2={x(s.x[i]) + 4} y1={y(v + s.sd[i])} y2={y(v + s.sd[i])} />
              </g>
            )))}
            {p.showMarkers && p.series.map((s) => s.y.map((v, i) => <Marker key={`m${s.id}${i}`} kind={s.marker ?? "circle"} cx={x(s.x[i])} cy={y(v)} color={s.color} />))}
          </g>
          {/* axes */}
          <line x1={0} x2={iw} y1={ih} y2={ih} stroke="#1B201C" strokeWidth={1} />
          <line x1={0} x2={0} y1={0} y2={ih} stroke="#1B201C" strokeWidth={1} />
          {xTicks.map((t) => (
            <g key={"tx" + t} transform={`translate(${x(t)},${ih})`}>
              <line y2={5} stroke="#1B201C" />
              <text y={18} textAnchor="middle" fontSize={11.5} fill="#1B201C" className="tnum">{xf(t)}</text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={"ty" + t} transform={`translate(0,${y(t)})`}>
              <line x2={-5} stroke="#1B201C" />
              <text x={-9} dy="0.32em" textAnchor="end" fontSize={11.5} fill="#1B201C" className="tnum">{yf(t)}</text>
            </g>
          ))}
          <text x={iw / 2} y={ih + 38} textAnchor="middle" fontSize={13} fill="#1B201C">{p.xLabel}</text>
          <text transform={`translate(${-46},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="#1B201C">{p.yLabel}</text>

          {/* annotations calculées */}
          {width >= 560 && p.annotations?.map((a, k) => {
            const s = p.series.find((ss) => ss.id === a.seriesId); if (!s) return null;
            const i = s.x.indexOf(a.x); if (i < 0 || a.x < xExtent[0] || a.x > xExtent[1]) return null;
            const px = x(a.x), py = y(s.y[i]);
            const tone = TONES[a.tone ?? "green"];
            const bw = Math.max(...a.lines.map((l) => l.length)) * 6.6 + 18, bh = a.lines.length * 15 + 10;
            let bx = px + (a.dx ?? -bw - 20), by = py + (a.dy ?? -bh - 18);
            bx = Math.max(4, Math.min(iw - bw - 2, bx)); by = Math.max(2, Math.min(ih - bh - 2, by));
            const ax = bx + bw / 2 < px ? bx + bw : bx, ay = by + bh / 2;
            return (
              <g key={"an" + k}>
                <path d={`M${ax},${ay} Q${(ax + px) / 2},${ay} ${px},${py}`} fill="none" stroke={s.color} strokeWidth={1.2} markerEnd="" />
                <circle cx={px} cy={py} r={4.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />
                <rect x={bx} y={by} width={bw} height={bh} rx={4} fill={tone.fill} stroke={tone.stroke} />
                {a.lines.map((l, j) => <text key={j} x={bx + 9} y={by + 18 + j * 15} fontSize={12} fill={tone.text} fontWeight={j === 0 ? 500 : 400}>{l}</text>)}
              </g>
            );
          })}

          {/* curseur */}
          {cursor != null && cursor >= xExtent[0] && cursor <= xExtent[1] && (
            <g data-export-hide pointerEvents="none">
              <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={ih} stroke="#1B201C" strokeOpacity={0.35} />
              {p.series.map((s) => { const i = s.x.indexOf(cursor); return i < 0 ? null : { s, v: s.y[i] }; }).filter(Boolean).map((r) => <circle key={r!.s.id} cx={x(cursor)} cy={y(r!.v)} r={3.5} fill="#fff" stroke={r!.s.color} strokeWidth={2} />)}
            </g>
          )}
          {drag && <rect data-export-hide x={Math.min(drag[0], drag[1])} y={0} width={Math.abs(drag[1] - drag[0])} height={ih} fill="#347A55" fillOpacity={0.08} stroke="#347A55" strokeOpacity={0.4} />}
        </g>
      </svg>
      {hover != null && tipRows.length > 0 && (
        <div role="status" aria-live="polite"
          className="pointer-events-none absolute z-20 min-w-56 rounded-md border border-line bg-white/97 px-3 py-2 text-[12px] shadow-md"
          style={{ left: Math.min(Math.max(8, tipLeft * ((wrapRef.current?.clientWidth ?? width) / width) + 14), (wrapRef.current?.clientWidth ?? width) - 230), top: 8 }}>
          <div className="mb-1 font-medium text-ink">{p.xLabel.replace(/\s*\(.*\)/, "")} : {xf(hover)}</div>
          {tipRows.map((r) => (
            <div key={r.s.id} className="flex items-center justify-between gap-3 tnum">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-muted"><svg width="16" height="6" aria-hidden><line x1="0" x2="16" y1="3" y2="3" stroke={r.s.color} strokeWidth="2.4" strokeDasharray={r.s.dash} /></svg>{r.s.label}</span>
              <span className="whitespace-nowrap text-ink">{vf(r.v)}{r.sd != null && r.sd > 0 ? <span className="text-muted"> ± {vf(r.sd)}</span> : null}</span>
            </div>
          ))}
          {p.uncertaintyLabel && <div className="mt-1 text-[10.5px] text-muted">{p.uncertaintyLabel}</div>}
        </div>
      )}
    </div>
  );
});

function symlogTicks(max: number) {
  const t = [0, 1];
  for (let v = 10; v <= max * 1.01; v *= 10) t.push(v);
  return t;
}

function Marker({ kind, cx, cy, color }: { kind: string; cx: number; cy: number; color: string }) {
  if (kind === "square") return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill={color} stroke="#fff" strokeWidth={1} />;
  if (kind === "triangle") return <path d={`M${cx},${cy - 5} L${cx + 5},${cy + 4} L${cx - 5},${cy + 4}Z`} fill={color} stroke="#fff" strokeWidth={1} />;
  if (kind === "diamond") return <path d={`M${cx},${cy - 5} L${cx + 5},${cy} L${cx},${cy + 5} L${cx - 5},${cy}Z`} fill={color} stroke="#fff" strokeWidth={1} />;
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1} />;
}
