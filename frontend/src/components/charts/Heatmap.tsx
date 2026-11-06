import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { fmt } from "../../lib/format";

export interface HeatmapProps {
  rows: string[]; cols: string[];
  values: (number | null)[][];        // [row][col]
  sd?: (number | null)[][];
  domain: [number, number];
  palette: "green" | "terracotta" | "blue";
  unit: string; ariaLabel: string;
  rowGroupLabel?: string; colGroupLabel?: string;
  highIsGood?: boolean;
}
const PAL = {
  green: ["#F6F8F2", "#DDEADF", "#A9CDB3", "#5E9C75", "#145A3D"],
  terracotta: ["#FBF6F1", "#F6DCCD", "#E8A586", "#C8643F", "#8E3519"],
  blue: ["#F4F7F9", "#D9E5EC", "#A7C1CF", "#6E97AE", "#355A70"],
};
function interp(stops: string[], t: number) {
  t = Math.max(0, Math.min(1, t));
  const k = t * (stops.length - 1), i = Math.floor(k), f = k - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  const c = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16);
  const mix = (o: number) => Math.round(c(a, o) + (c(b, o) - c(a, o)) * f).toString(16).padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

export const Heatmap = forwardRef<SVGSVGElement | null, HeatmapProps>(function Heatmap(p, fwd) {
  const ref = useRef<SVGSVGElement>(null);
  useImperativeHandle(fwd, () => ref.current as SVGSVGElement);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const cw = 92, ch = 34, left = 178, top = 54;
  const W = left + p.cols.length * cw + 90, H = top + p.rows.length * ch + 20;
  const stops = PAL[p.palette];
  return (
    <div className="scroll-x">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, maxWidth: W * 1.25 }} role="img" aria-label={p.ariaLabel}>
        {p.cols.map((c, j) => (
          <text key={c} x={left + j * cw + cw / 2} y={top - 10} textAnchor="middle" fontSize={11} fill="#1B201C">{c}</text>
        ))}
        {p.colGroupLabel && <text x={left} y={16} fontSize={11} fill="#657068">{p.colGroupLabel}</text>}
        {p.rows.map((r, i) => (
          <g key={r}>
            <text x={left - 10} y={top + i * ch + ch / 2} dy="0.32em" textAnchor="end" fontSize={11} fill="#1B201C" className="tnum">{r}</text>
            {p.cols.map((_, j) => {
              const v = p.values[i][j];
              const t = v == null ? 0 : (v - p.domain[0]) / (p.domain[1] - p.domain[0]);
              const fill = v == null ? "#F3F4F0" : interp(stops, t);
              const dark = t > 0.6;
              const isH = hover?.[0] === i && hover?.[1] === j;
              return (
                <g key={j} onPointerEnter={() => setHover([i, j])} onPointerLeave={() => setHover(null)} tabIndex={0}
                  onFocus={() => setHover([i, j])} onBlur={() => setHover(null)}
                  aria-label={`${r}, ${p.cols[j]} : ${v == null ? "non simulé" : `${fmt(v, 1)} ${p.unit}`}`}>
                  <rect x={left + j * cw + 1} y={top + i * ch + 1} width={cw - 2} height={ch - 2} fill={fill}
                    stroke={isH ? "#1B201C" : "none"} strokeWidth={1.2} rx={2} />
                  <text x={left + j * cw + cw / 2} y={top + i * ch + ch / 2} dy="0.32em" textAnchor="middle" fontSize={11.5}
                    fill={dark ? "#fff" : "#1B201C"} className="tnum">
                    {v == null ? "—" : fmt(v, 1)}{v != null && p.sd?.[i][j] ? <tspan fontSize={9} fillOpacity={0.75}>{` ±${fmt(p.sd[i][j]!, 1)}`}</tspan> : null}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
        {/* échelle de couleur */}
        <defs><linearGradient id={`hm-${p.palette}`} x1="0" y1="1" x2="0" y2="0">
          {stops.map((s, i) => <stop key={i} offset={i / (stops.length - 1)} stopColor={s} />)}
        </linearGradient></defs>
        <rect x={W - 70} y={top} width={12} height={p.rows.length * ch} fill={`url(#hm-${p.palette})`} stroke="#D6DDD4" />
        <text x={W - 52} y={top + 8} fontSize={10} fill="#1B201C" className="tnum">{fmt(p.domain[1], 0)}</text>
        <text x={W - 52} y={top + p.rows.length * ch} fontSize={10} fill="#1B201C" className="tnum">{fmt(p.domain[0], 0)}</text>
        <text x={W - 52} y={top + (p.rows.length * ch) / 2} fontSize={10} fill="#657068">{p.unit}</text>
      </svg>
    </div>
  );
});
