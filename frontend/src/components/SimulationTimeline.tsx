import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "../icons";
import type { ScenarioEvent } from "../lib/api";
import { fmtInt } from "../lib/format";

/** Calendrier des lâchers : barres proportionnelles à √(stériles lâchés le jour J).
 *  Rendu HTML en pourcentages : pas de déformation du texte quelle que soit la largeur. */
export function ReleaseCalendar({ schedule, seasonLength, color = "#347A55", label, cursor, height = 46, maxValue }: {
  schedule: Record<string, number>; seasonLength: number; color?: string; label: string; cursor?: number | null; height?: number; maxValue?: number;
}) {
  const entries = Object.entries(schedule).map(([d, n]) => [Number(d), n] as const).filter(([, n]) => n > 0);
  const max = maxValue ?? Math.max(1, ...entries.map(([, n]) => n));
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const bw = Math.max(0.35, (100 / seasonLength) * 0.6);
  const ticks = [0, Math.round(seasonLength / 2), seasonLength];
  return (
    <figure className="w-full" role="img" aria-label={`${label} : ${entries.length} lâchers, ${fmtInt(total)} stériles au total`}>
      <div className="relative w-full border-b border-line" style={{ height }}>
        {entries.map(([d, n]) => (
          <span key={d} title={`J${d} : ${fmtInt(n)} stériles`}
            className="absolute bottom-0 rounded-t-[1px]"
            style={{ left: `${(d / seasonLength) * 100}%`, width: `max(2px, ${bw}%)`, height: Math.max(2, ((height - 2) * Math.sqrt(n)) / Math.sqrt(max)),
              background: color, opacity: cursor != null && d > cursor ? 0.3 : 0.9 }} />
        ))}
        {cursor != null && <span aria-hidden className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${(Math.min(cursor, seasonLength) / seasonLength) * 100}%` }} />}
      </div>
      <div className="relative mt-0.5 h-3.5 text-[10px] text-muted tnum" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute top-0" style={{ left: `${(t / seasonLength) * 100}%`, transform: t === 0 ? "none" : t === seasonLength ? "translateX(-100%)" : "translateX(-50%)" }}>J{t}</span>
        ))}
      </div>
      <figcaption className="sr-only">Hauteur des barres proportionnelle à la racine carrée du nombre de stériles lâchés.</figcaption>
    </figure>
  );
}

/** Frise chronologique interactive : avancer, reculer, lecture, sélection d'un jour. */
export function SimulationTimeline({ max, value, onChange, events = [], available }: {
  max: number; value: number; onChange: (d: number) => void; events?: ScenarioEvent[]; available?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const vRef = useRef(value); vRef.current = value;
  const lim = available ?? max;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (vRef.current >= lim) { setPlaying(false); return; }
      onChange(vRef.current + 1);
    }, Math.max(40, 2400 / Math.max(1, max)));
    return () => clearInterval(t);
  }, [playing, lim, max, onChange]);
  const btn = "rounded p-1.5 text-ink hover:bg-sage disabled:opacity-40";
  const EV_COLOR: Record<string, string> = { release: "#347A55", harvest_start: "#BF532E", harvest_end: "#BF532E", peak: "#A83D36", larvae_peak: "#8E3519", threshold: "#547B91", threshold_down: "#547B91" };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button className={btn} aria-label="Début" onClick={() => onChange(0)}><SkipBack size={16} /></button>
        <button className={btn} aria-label="Jour précédent" onClick={() => onChange(Math.max(0, value - 1))}><StepBack size={16} /></button>
        <button className={`${btn} bg-white border border-line`} aria-label={playing ? "Pause" : "Lecture"} onClick={() => { if (value >= lim) onChange(0); setPlaying((p) => !p); }}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className={btn} aria-label="Jour suivant" onClick={() => onChange(Math.min(lim, value + 1))}><StepForward size={16} /></button>
        <button className={btn} aria-label="Fin" onClick={() => onChange(lim)}><SkipForward size={16} /></button>
        <span className="ml-2 text-[13px] tnum">Jour <strong>{value}</strong> / {max}</span>
      </div>
      <div className="relative pt-4">
        <div className="absolute inset-x-0 top-0 h-4">
          {events.map((e, i) => (
            <button key={i} type="button" onClick={() => onChange(Math.min(lim, e.day))} title={`J${e.day} — ${e.label}`} aria-label={`Aller au jour ${e.day} : ${e.label}`}
              className="absolute top-0 -translate-x-1/2" style={{ left: `${(e.day / max) * 100}%` }}>
              <span className="block h-3 w-[3px] rounded-sm" style={{ background: EV_COLOR[e.type] ?? "#657068" }} />
            </button>
          ))}
        </div>
        <input type="range" min={0} max={max} value={value} aria-label="Jour de simulation"
          onChange={(e) => onChange(Math.min(lim, Number(e.target.value)))} className="w-full accent-[#347A55]" />
      </div>
    </div>
  );
}
