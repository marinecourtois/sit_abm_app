import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { fmt } from "../../lib/format";

export interface ScatterPoint { id: string; x: number; y: number; size?: number; color: string; shape: "circle" | "square" | "triangle" | "diamond"; label: string; detail?: string[]; group: string }
export interface ScatterProps {
  points: ScatterPoint[]; xLabel: string; yLabel: string; height?: number; ariaLabel: string;
  frontier?: string[];  // ids des points du front de Pareto, dans l'ordre
  sizeLabel?: string;
}
const M = { top: 16, right: 20, bottom: 48, left: 62 };

export const ScatterChart = forwardRef<SVGSVGElement | null, ScatterProps>(function ScatterChart(p, fwd) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<SVGSVGElement>(null);
  useImperativeHandle(fwd, () => ref.current as SVGSVGElement);
  const [w, setW] = useState(700);
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(300, e.contentRect.width))); if (wrap.current) ro.observe(wrap.current); return () => ro.disconnect(); }, []);
  const h = p.height ?? 380, iw = w - M.left - M.right, ih = h - M.top - M.bottom;
  const xs = p.points.map((d) => d.x), ys = p.points.map((d) => d.y);
  const x = scaleLinear().domain([Math.min(0, ...xs), Math.max(...xs, 1) * 1.05]).range([0, iw]).nice();
  const y = scaleLinear().domain([Math.min(0, ...ys), Math.max(...ys, 1) * 1.08]).range([ih, 0]).nice();
  const sizes = p.points.map((d) => d.size ?? 1);
  const r = scaleSqrt().domain([Math.min(...sizes), Math.max(...sizes)]).range([4, 9]);
  const front = (p.frontier ?? []).map((id) => p.points.find((d) => d.id === id)!).filter(Boolean);
  return (
    <div ref={wrap} className="relative">
      <svg ref={ref} viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={p.ariaLabel}>
        <g transform={`translate(${M.left},${M.top})`}>
          {y.ticks(6).map((t) => <g key={"y" + t}><line x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="#E3E8E1" /><text x={-9} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} className="tnum" fill="#1B201C">{fmt(t, 0)}</text></g>)}
          {x.ticks(8).map((t) => <g key={"x" + t}><line y1={0} y2={ih} x1={x(t)} x2={x(t)} stroke="#EEF1EC" /><text x={x(t)} y={ih + 18} textAnchor="middle" fontSize={11} className="tnum" fill="#1B201C">{fmt(t, 0)}</text></g>)}
          <line x1={0} x2={iw} y1={ih} y2={ih} stroke="#1B201C" /><line x1={0} x2={0} y1={0} y2={ih} stroke="#1B201C" />
          {front.length > 1 && <path d={"M" + front.map((d) => `${x(d.x)},${y(d.y)}`).join("L")} fill="none" stroke="#1B201C" strokeWidth={1.3} strokeDasharray="5 3" />}
          {p.points.map((d) => {
            const cx = x(d.x), cy = y(d.y), rr = r(d.size ?? 1);
            const common = { fill: d.color, fillOpacity: 0.78, stroke: front.includes(d) ? "#1B201C" : "#fff", strokeWidth: front.includes(d) ? 1.4 : 0.8,
              onPointerEnter: () => setHover(d), onPointerLeave: () => setHover(null), tabIndex: 0, onFocus: () => setHover(d), onBlur: () => setHover(null),
              "aria-label": `${d.label} : ${fmt(d.x, 1)} ; ${fmt(d.y, 1)}` };
            if (d.shape === "square") return <rect key={d.id} x={cx - rr} y={cy - rr} width={2 * rr} height={2 * rr} {...common} />;
            if (d.shape === "triangle") return <path key={d.id} d={`M${cx},${cy - rr * 1.2}L${cx + rr * 1.1},${cy + rr * 0.8}L${cx - rr * 1.1},${cy + rr * 0.8}Z`} {...common} />;
            if (d.shape === "diamond") return <path key={d.id} d={`M${cx},${cy - rr * 1.2}L${cx + rr * 1.2},${cy}L${cx},${cy + rr * 1.2}L${cx - rr * 1.2},${cy}Z`} {...common} />;
            return <circle key={d.id} cx={cx} cy={cy} r={rr} {...common} />;
          })}
          <text x={iw / 2} y={ih + 40} textAnchor="middle" fontSize={12.5} fill="#1B201C">{p.xLabel}</text>
          <text transform={`translate(-46,${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={12.5} fill="#1B201C">{p.yLabel}</text>
        </g>
      </svg>
      {hover && (
        <div role="status" className="pointer-events-none absolute z-20 rounded-md border border-line bg-white px-3 py-2 text-[12px] shadow-md"
          style={{ left: Math.min(M.left + x(hover.x) * ((wrap.current?.clientWidth ?? w) / w) + 12, (wrap.current?.clientWidth ?? w) - 240), top: Math.max(0, M.top + y(hover.y) - 20) }}>
          <div className="font-medium">{hover.label}</div>
          <div className="tnum text-muted">{p.xLabel} : {fmt(hover.x, 2)}</div>
          <div className="tnum text-muted">{p.yLabel} : {fmt(hover.y, 2)}</div>
          {hover.detail?.map((l) => <div key={l} className="tnum text-muted">{l}</div>)}
        </div>
      )}
    </div>
  );
});
