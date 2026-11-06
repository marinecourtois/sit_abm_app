import * as React from 'react';

/*
 * Prunus avium — rameau fructifère.
 * Branche ligneuse à lenticelles, feuilles elliptiques acuminées finement dentées
 * (glandes pétiolaires), grappe de cerises sur longs pédicelles depuis un dard.
 */

type P = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const ps = (p: P) => `${r1(p[0])} ${r1(p[1])}`;

interface LeafOpts {
  teeth: number;
  depth: number;
  start: number;
  bend: number;
  asym?: number;
  veins: number;
  vStart?: number;
  vEnd?: number;
}

/** Serrated leaf outline in local coordinates: base (0,0), apex towards +x. */
function makeLeaf(L: number, W: number, prof: (t: number) => number, o: LeafOpts) {
  const asym = o.asym ?? 1;
  const pt = (t: number, s: number): P => {
    const tc = Math.min(Math.max(t, 0), 1);
    const ax = tc * L;
    const ay = o.bend * L * tc * tc;
    const dy = 2 * o.bend * L * tc;
    const len = Math.hypot(L, dy);
    const w = (W / 2) * prof(tc) * (s > 0 ? asym : 1);
    return [ax + (-dy / len) * w * s, ay + (L / len) * w * s];
  };
  type Seg = { from: P; c: P; tip: P; to: P };
  const side = (sg: number): Seg[] => {
    const v0 = pt(o.start, sg * (1 - o.depth));
    const segs: Seg[] = [{ from: [0, 0], c: pt(o.start * 0.5, sg * 1.1), tip: v0, to: v0 }];
    const dt = (1 - o.start) / o.teeth;
    let prev = v0;
    for (let k = 0; k < o.teeth; k++) {
      const t0 = o.start + k * dt;
      const last = k === o.teeth - 1;
      const tip = last ? pt(1, 0) : pt(t0 + 0.78 * dt, sg);
      const c = pt(t0 + 0.45 * dt, sg * (1 - o.depth * 0.1));
      const to = last ? tip : pt(t0 + dt, sg * (1 - o.depth));
      segs.push({ from: prev, c, tip, to });
      prev = to;
    }
    return segs;
  };
  const up = side(-1);
  const lo = side(1);
  const fwd = (s: Seg[]) => s.map((g) => `Q${ps(g.c)} ${ps(g.tip)}L${ps(g.to)}`).join('');
  const rev = (s: Seg[]) =>
    s
      .slice()
      .reverse()
      .map((g) => `L${ps(g.tip)}Q${ps(g.c)} ${ps(g.from)}`)
      .join('');
  const apex = pt(1, 0);
  const mid: P = [L / 2, 0];
  const vs = o.vStart ?? 0.12;
  const ve = o.vEnd ?? 0.8;
  let veins = '';
  let fine = '';
  for (let i = 0; i < o.veins; i++) {
    const t = vs + (i * (ve - vs)) / Math.max(1, o.veins - 1);
    for (const sg of [-1, 1]) {
      const a = pt(t, 0);
      const e = pt(Math.min(t + 0.17, 0.97), sg * 0.84);
      veins += `M${ps(a)}Q${ps(pt(t + 0.05, sg * 0.55))} ${ps(e)}`;
      // anastomosing loop towards the next vein
      fine += `M${ps(e)}Q${ps(pt(t + 0.22, sg * 0.93))} ${ps(pt(Math.min(t + 0.25, 0.98), sg * 0.84))}`;
    }
  }
  return {
    outline: `M0 0${fwd(up)}${rev(lo)}Z`,
    half: `M0 0${fwd(lo)}Q${ps(mid)} 0 0Z`,
    midrib: `M0 0Q${ps(mid)} ${ps(apex)}`,
    veins,
    fine,
  };
}

const cherryProf = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.12)), 0.8) * (1 - 0.25 * Math.pow(t, 3));

function Leaf(p: { x: number; y: number; a: number; L: number; W: number; bend: number; shade: 'a' | 'b' | 'c'; petiole?: number }) {
  const g = makeLeaf(p.L, p.W, cherryProf, { teeth: 30, depth: 0.05, start: 0.08, bend: p.bend, veins: 9, vStart: 0.08, vEnd: 0.78, asym: 0.94 });
  const pl = p.petiole ?? 14;
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${p.a})`}>
      <path d={`M0 0Q${pl * 0.5} ${-pl * 0.04} ${pl} 0`} stroke="#5A3A24" strokeWidth={2.1} fill="none" strokeLinecap="round" />
      <path d={`M0 0Q${pl * 0.5} ${-pl * 0.04} ${pl} 0`} stroke="#9A5E3E" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <circle cx={pl - 2.2} cy={-1} r={0.9} fill="#B2453A" stroke="#6E2A22" strokeWidth={0.3} />
      <circle cx={pl - 4.2} cy={0.9} r={0.8} fill="#B2453A" stroke="#6E2A22" strokeWidth={0.3} />
      <g transform={`translate(${pl} 0)`}>
        <path d={g.outline} fill={`url(#cb-leaf-${p.shade})`} stroke="#1B4228" strokeWidth={0.7} strokeLinejoin="round" />
        <path d={g.half} fill="#0E321D" opacity={0.18} />
        <path d={g.outline} fill="url(#cb-gloss)" />
        <path d={g.fine} fill="none" stroke="#CFE2B8" strokeOpacity={0.22} strokeWidth={0.25} />
        <path d={g.veins} fill="none" stroke="#D3E5BD" strokeOpacity={0.55} strokeWidth={0.45} strokeLinecap="round" />
        <path d={g.midrib} fill="none" stroke="#E2EDCD" strokeOpacity={0.8} strokeWidth={0.85} strokeLinecap="round" />
      </g>
    </g>
  );
}

function Cherry({ x, y, a, s = 1 }: { x: number; y: number; a: number; s?: number }) {
  const body = 'M0 1.2C4 -1.6 11.4 -0.6 12.8 7.2C14 15 8.2 22.4 0 22.4C-8.2 22.4 -14 15 -12.8 7.2C-11.4 -0.6 -4 -1.6 0 1.2Z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
      <path d={body} fill="url(#cb-cherry)" stroke="#4A1010" strokeWidth={0.7} />
      <path d={body} fill="url(#cb-cherry-rim)" />
      <path d="M0.4 2.5C1.6 8 1.2 15 -0.6 21" fill="none" stroke="#5E1515" strokeWidth={0.45} strokeOpacity={0.45} />
      <ellipse cx={0} cy={1.4} rx={2.2} ry={0.9} fill="#3E0C0C" opacity={0.55} />
      <ellipse cx={-5.2} cy={7.6} rx={3.4} ry={5} transform="rotate(28 -5.2 7.6)" fill="url(#cb-spec)" />
      <ellipse cx={-5.8} cy={6.6} rx={0.9} ry={1.5} transform="rotate(28 -5.8 6.6)" fill="#FFFFFF" opacity={0.85} />
      <path d="M6 18.6C8.6 17 10.4 14 10.8 10.8" fill="none" stroke="#D86A60" strokeWidth={0.9} strokeOpacity={0.45} strokeLinecap="round" />
    </g>
  );
}

const SPUR: P = [121, 58];
const fruits: { end: P; c1: P; c2: P; a: number; s: number }[] = [
  { end: [92, 136], c1: [116, 80], c2: [96, 106], a: 18, s: 0.98 },
  { end: [142, 138], c1: [126, 80], c2: [142, 108], a: -12, s: 0.96 },
  { end: [117, 146], c1: [120, 84], c2: [116, 118], a: 3, s: 1 },
  { end: [161, 162], c1: [130, 84], c2: [160, 122], a: -18, s: 0.98 },
  { end: [100, 170], c1: [118, 90], c2: [98, 130], a: 10, s: 1.04 },
  { end: [131, 178], c1: [123, 92], c2: [134, 138], a: -5, s: 1.06 },
];

export function CherryBranch(props: React.SVGProps<SVGSVGElement>) {
  const lenticels: { x: number; y: number; a: number; w: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const x = 4 + i * 12.6 + (i % 3) * 2;
    const t = x / 212;
    const y = 27 + 26 * t + (1 - t) * ((i % 2) - 0.5) * 5;
    lenticels.push({ x, y, a: 6 - t * 4, w: 2.6 - t * 1.2 });
  }
  return (
    <svg viewBox="0 0 260 220" role="img" aria-label="Planche botanique : rameau de cerisier (Prunus avium) avec feuilles dentées et grappe de cerises" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="cb-leaf-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5E9A58" />
          <stop offset="0.5" stopColor="#4E8B4F" />
          <stop offset="1" stopColor="#2F6B3F" />
        </linearGradient>
        <linearGradient id="cb-leaf-b" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#A9C98F" />
          <stop offset="0.45" stopColor="#7FAF6A" />
          <stop offset="1" stopColor="#4E8B4F" />
        </linearGradient>
        <linearGradient id="cb-leaf-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B7646" />
          <stop offset="0.6" stopColor="#2F6B3F" />
          <stop offset="1" stopColor="#145A3D" />
        </linearGradient>
        <linearGradient id="cb-gloss" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cb-bark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9A7A56" />
          <stop offset="0.4" stopColor="#6B4A2E" />
          <stop offset="1" stopColor="#3F2A1A" />
        </linearGradient>
        <linearGradient id="cb-pedicel" gradientUnits="userSpaceOnUse" x1="0" y1="62" x2="0" y2="170">
          <stop offset="0" stopColor="#7A5A34" />
          <stop offset="0.35" stopColor="#8A9446" />
          <stop offset="1" stopColor="#9AAA52" />
        </linearGradient>
        <radialGradient id="cb-cherry" cx="0.36" cy="0.36" r="0.72">
          <stop offset="0" stopColor="#C94A43" />
          <stop offset="0.22" stopColor="#A83D36" />
          <stop offset="0.55" stopColor="#7A1F1E" />
          <stop offset="0.88" stopColor="#561414" />
          <stop offset="1" stopColor="#3C0D0D" />
        </radialGradient>
        <radialGradient id="cb-cherry-rim" cx="0.3" cy="0.25" r="0.95">
          <stop offset="0.6" stopColor="#2A0606" stopOpacity="0" />
          <stop offset="1" stopColor="#2A0606" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="cb-spec" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#FFE9E4" stopOpacity="0.3" />
          <stop offset="1" stopColor="#FFE9E4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* feuilles arrière */}
      <Leaf x={86} y={40} a={62} L={80} W={32} bend={0.1} shade="c" petiole={9} />
      <Leaf x={194} y={55} a={64} L={92} W={36} bend={0.14} shade="c" petiole={10} />

      {/* branche */}
      <path
        d="M-4 19C40 26 90 38 140 46C168 50.4 192 53.4 212 54.6L212.4 57.6C192 58.4 168 57.6 140 54.2C90 47.4 40 36.4 -4 32Z"
        fill="url(#cb-bark)"
        stroke="#3A2615"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <path d="M-4 21.6C40 28.6 90 40.4 140 48.2C168 52.4 192 55.2 211 56" fill="none" stroke="#C4A684" strokeOpacity={0.35} strokeWidth={0.7} />
      {lenticels.map((l, i) => (
        <ellipse key={i} cx={r1(l.x)} cy={r1(l.y)} rx={r1(l.w)} ry={0.42} transform={`rotate(${r1(l.a + 8)} ${r1(l.x)} ${r1(l.y)})`} fill="#D2B48C" opacity={0.55} />
      ))}
      <path d="M40 26.6Q41.4 32 39.6 37.4M176 51.6Q177 54.4 176 57.2" fill="none" stroke="#3A2615" strokeWidth={0.6} strokeOpacity={0.6} />
      {/* bourgeon terminal */}
      <path d="M211 54C217 53.6 223 55.4 228 57C223 58.8 217 60.4 211 58.4Z" fill="#8A5E38" stroke="#3A2615" strokeWidth={0.6} />
      <path d="M213 54.8Q219 56 226.4 57M213 57.8Q218 57.6 226 57.2" fill="none" stroke="#C49A6A" strokeWidth={0.4} />

      <Leaf x={40} y={32} a={104} L={100} W={42} bend={-0.12} shade="a" />
      <Leaf x={202} y={56} a={-40} L={46} W={21} bend={0.1} shade="b" petiole={10} />
      <Leaf x={126} y={50} a={16} L={100} W={40} bend={0.16} shade="a" />

      {/* dard (rameau court) */}
      <path d="M116 44C116.4 49 117.2 54 118 58.6L124.4 58.6C125 54 125.6 49 126 45Z" fill="url(#cb-bark)" stroke="#3A2615" strokeWidth={0.6} />
      <path d="M116.6 49Q121 50.6 125.6 49.4M117.4 54Q121 55.4 125 54.2" fill="none" stroke="#3A2615" strokeWidth={0.5} strokeOpacity={0.7} />
      {[-34, -10, 14, 36].map((a) => (
        <path key={a} d="M0 0Q2.2 4 0.4 8.6Q-1.6 4.4 0 0Z" transform={`translate(121 58) rotate(${a})`} fill="#B08A5A" stroke="#5E4026" strokeWidth={0.35} />
      ))}

      {/* pédicelles */}
      {fruits.map((f, i) => {
        const d = `M${ps(SPUR)}C${ps(f.c1)} ${ps(f.c2)} ${ps(f.end)}`;
        return (
          <g key={i} fill="none" strokeLinecap="round">
            <path d={d} stroke="#3F3A1C" strokeWidth={1.7} />
            <path d={d} stroke="url(#cb-pedicel)" strokeWidth={1} />
          </g>
        );
      })}

      {/* cerises */}
      {fruits.map((f, i) => (
        <Cherry key={i} x={f.end[0]} y={f.end[1] - 1} a={f.a} s={f.s} />
      ))}
    </svg>
  );
}

export default CherryBranch;
