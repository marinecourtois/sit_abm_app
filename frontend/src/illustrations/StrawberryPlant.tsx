import * as React from 'react';

/*
 * Fragaria × ananassa — planche botanique.
 * Feuilles trifoliées dentées (géométrie générée), fleur blanche à 5 pétales,
 * fruits mûrs avec akènes et calice, fruit vert immature.
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
    const nx = -dy / len;
    const ny = L / len;
    const w = (W / 2) * prof(tc) * (s > 0 ? asym : 1);
    return [ax + nx * w * s, ay + ny * w * s];
  };
  type Seg = { from: P; c: P; tip: P; to: P };
  const side = (sg: number): Seg[] => {
    const v0 = pt(o.start, sg * (1 - o.depth));
    const segs: Seg[] = [{ from: [0, 0], c: pt(o.start * 0.5, sg * 1.15), tip: v0, to: v0 }];
    const dt = (1 - o.start) / o.teeth;
    let prev = v0;
    for (let k = 0; k < o.teeth; k++) {
      const t0 = o.start + k * dt;
      const last = k === o.teeth - 1;
      const tip = last ? pt(1, 0) : pt(t0 + 0.74 * dt, sg);
      const c = pt(t0 + 0.42 * dt, sg * (1 - o.depth * 0.15));
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
  for (let i = 0; i < o.veins; i++) {
    const t = vs + (i * (ve - vs)) / Math.max(1, o.veins - 1);
    for (const sg of [-1, 1]) {
      veins += `M${ps(pt(t, 0))}Q${ps(pt(t + 0.06, sg * 0.5))} ${ps(pt(Math.min(t + 0.15, 0.97), sg * 0.9))}`;
    }
  }
  return {
    outline: `M0 0${fwd(up)}${rev(lo)}Z`,
    half: `M0 0${fwd(lo)}Q${ps(mid)} 0 0Z`,
    midrib: `M0 0Q${ps(mid)} ${ps(apex)}`,
    veins,
  };
}

const strawProf = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.18)), 0.7);

type Shade = 'a' | 'b' | 'c';

function Leaflet(p: { x: number; y: number; a: number; L: number; W: number; shade: Shade; asym?: number; flip?: boolean; bend?: number }) {
  const g = makeLeaf(p.L, p.W, strawProf, {
    teeth: 10,
    depth: 0.14,
    start: 0.26,
    bend: p.bend ?? 0.04,
    asym: p.asym,
    veins: 8,
    vStart: 0.14,
    vEnd: 0.82,
  });
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${p.a})${p.flip ? ' scale(1 -1)' : ''}`}>
      <path d={g.outline} fill={`url(#sp-leaf-${p.shade})`} stroke="#1D4529" strokeWidth={0.7} strokeLinejoin="round" />
      <path d={g.half} fill="#10351F" opacity={0.2} />
      <path d={g.veins} fill="none" stroke="#D3E4BC" strokeOpacity={0.5} strokeWidth={0.42} strokeLinecap="round" />
      <path d={g.midrib} fill="none" stroke="#DDEBC8" strokeOpacity={0.75} strokeWidth={0.7} strokeLinecap="round" />
    </g>
  );
}

function Trifoliate(p: { x: number; y: number; a: number; s: number; shade: Shade; latShade?: Shade }) {
  const ls = p.latShade ?? p.shade;
  return (
    <g>
      <Leaflet x={p.x} y={p.y} a={p.a - 54} L={34 * p.s} W={28 * p.s} shade={ls} asym={0.72} bend={-0.05} />
      <Leaflet x={p.x} y={p.y} a={p.a + 54} L={34 * p.s} W={28 * p.s} shade={ls} asym={0.72} flip bend={-0.05} />
      <Leaflet x={p.x} y={p.y} a={p.a} L={40 * p.s} W={31 * p.s} shade={p.shade} />
      <circle cx={p.x} cy={p.y} r={1.3 * p.s} fill="#3E6A33" />
    </g>
  );
}

function Stem({ d, w = 1.5 }: { d: string; w?: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#2E4C25" strokeWidth={w + 0.9} />
      <path d={d} stroke="url(#sp-stem)" strokeWidth={w} />
    </g>
  );
}

function Calyx({ s }: { s: number }) {
  const sepal = 'M0 0Q2.7 -4.6 0.4 -9.2Q0 -9.8 -0.4 -9.2Q-2.7 -4.6 0 0Z';
  const angles = [-150, -110, -72, -36, 0, 36, 72, 110, 150, 180];
  return (
    <g transform={`scale(${s} ${s * 0.55})`}>
      {angles.map((a) => (
        <path key={a} d={sepal} transform={`rotate(${a + 180})`} fill="url(#sp-sepal)" stroke="#1F4A2A" strokeWidth={0.45} />
      ))}
      <ellipse cx={0} cy={0} rx={2.4} ry={2.4} fill="#4F7F3A" stroke="#1F4A2A" strokeWidth={0.4} />
    </g>
  );
}

function Berry({ x, y, a, s, ripe = true }: { x: number; y: number; a: number; s: number; ripe?: boolean }) {
  const w = 13;
  const H = 30;
  const body = `M${-0.55 * w} 0C${-1.05 * w} ${0.15 * H} ${-0.85 * w} ${0.66 * H} 0 ${H}C${0.85 * w} ${0.66 * H} ${1.05 * w} ${0.15 * H} ${0.55 * w} 0C${0.3 * w} ${-0.07 * H} ${-0.3 * w} ${-0.07 * H} ${-0.55 * w} 0Z`;
  const hw = (u: number) => (u < 0.28 ? w * (0.62 + 0.3 * (u / 0.28)) : w * 0.92 * (1 - Math.pow((u - 0.28) / 0.72, 1.7)));
  const achenes: { x: number; y: number; o: number; r: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const u = 0.1 + i * 0.105;
    const h = hw(u) * 0.8;
    const n = Math.max(1, Math.floor((2 * h) / 3.9));
    for (let j = 0; j < n; j++) {
      const xx = -h + (j + 0.5) * ((2 * h) / n) + (i % 2 ? 0.7 : -0.7);
      const k = Math.min(1, Math.abs(xx) / Math.max(h, 0.1));
      achenes.push({ x: xx, y: u * H, o: 1 - 0.55 * k * k, r: (xx / Math.max(h, 1)) * 28 });
    }
  }
  const f = ripe ? 'sp-berry' : 'sp-green';
  return (
    <g transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
      <path d={body} fill={`url(#${f})`} stroke={ripe ? '#6E1512' : '#5E7B3A'} strokeWidth={0.7} />
      <path d={body} fill="url(#sp-berry-shade)" />
      {achenes.map((c, i) => (
        <g key={i} transform={`translate(${r1(c.x)} ${r1(c.y)}) rotate(${r1(c.r)})`} opacity={r1(c.o)}>
          <ellipse rx={1.35} ry={1.75} fill={ripe ? '#7A1714' : '#6F8C45'} opacity={0.28} />
          <ellipse rx={0.8} ry={1.2} cy={-0.15} fill={ripe ? 'url(#sp-achene)' : '#E8E6B4'} stroke={ripe ? '#B0852E' : '#9EAF6A'} strokeWidth={0.25} />
        </g>
      ))}
      <ellipse cx={-0.38 * w} cy={0.32 * H} rx={0.2 * w} ry={0.28 * H} transform={`rotate(14 ${-0.38 * w} ${0.32 * H})`} fill="url(#sp-hl)" />
      <Calyx s={ripe ? 0.95 : 0.9} />
    </g>
  );
}

function Petals() {
  const petal = 'M0 -2C-5 -4 -10.5 -11 -8.4 -16.2C-6.2 -20.8 -1.6 -20.4 0 -18.6C1.6 -20.4 6.2 -20.8 8.4 -16.2C10.5 -11 5 -4 0 -2Z';
  const vein = 'M0 -3Q-2 -10 -4.6 -16.5M0 -3Q0 -11 0 -17.4M0 -3Q2 -10 4.6 -16.5';
  return (
    <>
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a} transform={`rotate(${a + 8})`}>
          <path d={petal} fill="url(#sp-petal)" stroke="#BDB9A2" strokeWidth={0.5} strokeLinejoin="round" />
          <path d={vein} fill="none" stroke="#D8D4C0" strokeWidth={0.3} />
        </g>
      ))}
    </>
  );
}

function Flower({ x, y, s }: { x: number; y: number; s: number }) {
  const stamens = Array.from({ length: 20 }, (_, i) => (i * 360) / 20);
  const pist: P[] = [];
  for (let rr = 0.8; rr < 3.6; rr += 1.05) {
    const n = Math.round(rr * 5.5);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 + rr;
      pist.push([Math.cos(t) * rr, Math.sin(t) * rr]);
    }
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(-14) scale(${s} ${s * 0.86})`}>
      {[44, 116, 188, 260, 332].map((a) => (
        <path key={a} d="M0 0Q3.2 -9 0 -20Q-3.2 -9 0 0Z" transform={`rotate(${a})`} fill="url(#sp-sepal)" stroke="#1F4A2A" strokeWidth={0.4} />
      ))}
      <Petals />
      {stamens.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0 -4.2L0 -6.6" stroke="#C99A2A" strokeWidth={0.45} />
          <ellipse cx={0} cy={-7} rx={0.9} ry={0.7} fill="#EBC650" stroke="#A97A16" strokeWidth={0.25} />
        </g>
      ))}
      <circle r={4.6} fill="url(#sp-centre)" stroke="#A9801A" strokeWidth={0.4} />
      {pist.map((q, i) => (
        <circle key={i} cx={r1(q[0])} cy={r1(q[1])} r={0.32} fill="#B98A1C" opacity={0.8} />
      ))}
    </g>
  );
}

function Crown() {
  const stip = [
    { a: -38, l: 11, c: '#9C7E52' },
    { a: 30, l: 12, c: '#8E7048' },
    { a: -14, l: 15, c: '#7A5E3C' },
    { a: 10, l: 14, c: '#A88B5E' },
    { a: -2, l: 10, c: '#6E8F4A' },
  ];
  return (
    <g>
      <path d="M90 211Q129 207 170 211" fill="none" stroke="#B7B09A" strokeWidth={0.6} strokeOpacity={0.55} />
      <path d="M70 214Q129 210.5 190 214" fill="none" stroke="#C9C3AE" strokeWidth={0.5} strokeOpacity={0.45} />
      {stip.map((t, i) => (
        <path
          key={i}
          d={`M-2.2 0Q-2.6 ${-t.l * 0.6} 0 ${-t.l}Q2.6 ${-t.l * 0.6} 2.2 0Z`}
          transform={`translate(129 210) rotate(${t.a})`}
          fill={t.c}
          stroke="#4E3A24"
          strokeWidth={0.4}
        />
      ))}
      <ellipse cx={129} cy={210} rx={5} ry={1.6} fill="#5E4730" />
    </g>
  );
}

function Bud({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(150) scale(1.45)`}>
      <ellipse cx={0} cy={-5} rx={3.6} ry={5} fill="#F3F0E2" stroke="#BDB9A2" strokeWidth={0.5} />
      {[-40, 0, 40].map((a) => (
        <path key={a} d="M0 0Q2.6 -4 0 -8.5Q-2.6 -4 0 0Z" transform={`rotate(${a})`} fill="url(#sp-sepal)" stroke="#1F4A2A" strokeWidth={0.4} />
      ))}
    </g>
  );
}

export function StrawberryPlant(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 260 220" role="img" aria-label="Planche botanique : plant de fraisier (Fragaria × ananassa) avec feuilles trifoliées, fleur et fraises" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="sp-leaf-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5E9A58" />
          <stop offset="0.55" stopColor="#4E8B4F" />
          <stop offset="1" stopColor="#2F6B3F" />
        </linearGradient>
        <linearGradient id="sp-leaf-b" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#A9C98F" />
          <stop offset="0.5" stopColor="#7FAF6A" />
          <stop offset="1" stopColor="#4E8B4F" />
        </linearGradient>
        <linearGradient id="sp-leaf-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3D7A47" />
          <stop offset="0.6" stopColor="#2F6B3F" />
          <stop offset="1" stopColor="#145A3D" />
        </linearGradient>
        <linearGradient id="sp-stem" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#7E6A3E" />
          <stop offset="0.4" stopColor="#6E9447" />
          <stop offset="1" stopColor="#86AB5C" />
        </linearGradient>
        <linearGradient id="sp-sepal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2F6B3F" />
          <stop offset="1" stopColor="#7FAF6A" />
        </linearGradient>
        <radialGradient id="sp-berry" cx="0.36" cy="0.34" r="0.78">
          <stop offset="0" stopColor="#E8634F" />
          <stop offset="0.42" stopColor="#C7302A" />
          <stop offset="1" stopColor="#A3221E" />
        </radialGradient>
        <radialGradient id="sp-green" cx="0.36" cy="0.34" r="0.8">
          <stop offset="0" stopColor="#E3EDB8" />
          <stop offset="0.5" stopColor="#BFD58E" />
          <stop offset="1" stopColor="#8DAE5E" />
        </radialGradient>
        <linearGradient id="sp-berry-shade" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#3A0806" stopOpacity="0" />
          <stop offset="0.55" stopColor="#3A0806" stopOpacity="0" />
          <stop offset="1" stopColor="#3A0806" stopOpacity="0.32" />
        </linearGradient>
        <radialGradient id="sp-hl" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0" stopColor="#FFF4EC" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFF4EC" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sp-achene" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#F3DA8E" />
          <stop offset="0.6" stopColor="#E9C46A" />
          <stop offset="1" stopColor="#C99A3B" />
        </radialGradient>
        <radialGradient id="sp-petal" cx="0.5" cy="1" r="1.05">
          <stop offset="0" stopColor="#E9E6C8" />
          <stop offset="0.32" stopColor="#F7F5EA" />
          <stop offset="0.7" stopColor="#FBFAF4" />
          <stop offset="1" stopColor="#EFECE0" />
        </radialGradient>
        <radialGradient id="sp-centre" cx="0.4" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#F6DC74" />
          <stop offset="0.6" stopColor="#E7B932" />
          <stop offset="1" stopColor="#C58F1C" />
        </radialGradient>
      </defs>

      {/* feuilles arrière */}
      <Stem d="M126 207C120 168 108 110 100 64" w={1.3} />
      <Trifoliate x={100} y={64} a={-100} s={1.0} shade="c" />
      <Stem d="M131 207C130 160 142 112 140 70" w={1.4} />
      <Trifoliate x={140} y={70} a={-84} s={1.18} shade="c" latShade="a" />

      {/* pétioles */}
      <Stem d="M125 207C116 170 86 132 70 94" />
      <Stem d="M133 207C146 168 182 130 194 88" />
      <Stem d="M123 208C104 194 58 180 42 152" w={1.2} />

      <Trifoliate x={42} y={152} a={-166} s={0.86} shade="b" latShade="a" />
      <Trifoliate x={70} y={94} a={-128} s={1.3} shade="a" latShade="b" />
      <Trifoliate x={194} y={88} a={-54} s={1.3} shade="a" latShade="c" />

      {/* hampes florales et pédoncules */}
      <Stem d="M134 206C166 178 210 162 222 134" w={1.1} />
      <Stem d="M212 150C222 154 236 158 240 168" w={0.8} />
      <Stem d="M124 206C112 150 74 116 60 146" w={1} />
      <Stem d="M127 206C122 172 104 140 98 160" w={1} />
      <Stem d="M131 206C148 152 176 132 182 160" w={1} />
      <Stem d="M129 206C136 176 148 140 153 150" w={0.9} />

      <Flower x={222} y={130} s={1.05} />
      <Bud x={240} y={168} />

      <Berry x={153} y={150} a={-6} s={0.72} ripe={false} />
      <Berry x={60} y={146} a={16} s={1.18} />
      <Berry x={182} y={160} a={-12} s={1.22} />
      <Berry x={98} y={160} a={-4} s={1.28} />

      <Crown />
    </svg>
  );
}

export default StrawberryPlant;
