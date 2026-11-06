import * as React from 'react';

/*
 * Paysage agricole brumeux pour le pied de la barre latérale.
 * Collines lointaines, rangs de culture en perspective, rameau feuillu au premier plan.
 * Le haut de l'image s'efface vers la transparence (masque en dégradé).
 */

type P = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const ps = (p: P) => `${r1(p[0])} ${r1(p[1])}`;

function leafPaths(L: number, W: number, bend: number) {
  const prof = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.1)), 0.8);
  const pt = (t: number, s: number): P => {
    const dy = 2 * bend * L * t;
    const len = Math.hypot(L, dy);
    const w = (W / 2) * prof(t);
    return [t * L + (-dy / len) * w * s, bend * L * t * t + (L / len) * w * s];
  };
  const n = 14;
  const side = (sg: number) => {
    const out: string[] = [];
    for (let k = 1; k <= n; k++) {
      const t0 = (k - 1) / n;
      const t1 = k / n;
      out.push(`Q${ps(pt(t0 + 0.6 / n, sg * 1.02))} ${ps(pt(t1, sg * (k === n ? 0 : 0.93)))}`);
    }
    return out;
  };
  const up = side(-1).join('');
  // lower side traced back from the apex
  let lo = '';
  for (let k = n; k >= 1; k--) {
    const t0 = (k - 1) / n;
    lo += `Q${ps(pt(t0 + 0.6 / n, 1.02))} ${ps(k === 1 ? [0, 0] : pt(t0, 0.93))}`;
  }
  let veins = '';
  for (let i = 0; i < 6; i++) {
    const t = 0.14 + i * 0.12;
    for (const sg of [-1, 1]) veins += `M${ps(pt(t, 0))}Q${ps(pt(t + 0.05, sg * 0.5))} ${ps(pt(t + 0.16, sg * 0.85))}`;
  }
  return {
    outline: `M0 0${up}${lo}Z`,
    midrib: `M0 0Q${ps([L / 2, 0])} ${ps(pt(1, 0))}`,
    veins,
  };
}

function Leaf({ x, y, a, L, W, bend, fill }: { x: number; y: number; a: number; L: number; W: number; bend: number; fill: string }) {
  const g = leafPaths(L, W, bend);
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <path d={g.outline} fill={`url(#fl-${fill})`} stroke="#285638" strokeWidth={0.6} strokeOpacity={0.8} />
      <path d={g.veins} fill="none" stroke="#D6E7C2" strokeOpacity={0.45} strokeWidth={0.4} />
      <path d={g.midrib} fill="none" stroke="#DDEBC9" strokeOpacity={0.7} strokeWidth={0.65} />
    </g>
  );
}

const VP: P = [104, 176];
const ROWS = Array.from({ length: 17 }, (_, i) => -150 + i * 30);
const rowX = (bx: number, y: number) => VP[0] + (bx - VP[0]) * ((y - VP[1]) / (300 - VP[1]));

export function FieldLandscape(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 240 300" role="img" aria-label="Paysage agricole brumeux avec rangs de culture et rameau feuillu" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="fl-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.2" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
        </linearGradient>
        <mask id="fl-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="300">
          <rect width="240" height="300" fill="url(#fl-fade)" />
        </mask>
        <linearGradient id="fl-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D5DFCD" stopOpacity="0" />
          <stop offset="0.25" stopColor="#C9D8BF" stopOpacity="0.7" />
          <stop offset="1" stopColor="#A9C29C" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="fl-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0F2EB" stopOpacity="0" />
          <stop offset="0.5" stopColor="#F0F2EB" stopOpacity="0.75" />
          <stop offset="1" stopColor="#F0F2EB" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fl-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6FA064" />
          <stop offset="1" stopColor="#2F6B3F" />
        </linearGradient>
        <linearGradient id="fl-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9C98F" />
          <stop offset="1" stopColor="#5E9A58" />
        </linearGradient>
        <linearGradient id="fl-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3E7C4A" />
          <stop offset="1" stopColor="#145A3D" />
        </linearGradient>
        <clipPath id="fl-field">
          <rect x="0" y="178" width="240" height="122" />
        </clipPath>
      </defs>

      <g mask="url(#fl-mask)">
        {/* collines lointaines */}
        <path d="M0 140C34 122 76 126 112 140C150 154 196 128 240 134V186H0Z" fill="#BFCFBB" opacity={0.85} />
        <g fill="#AFC3AB" opacity={0.5}>
          <ellipse cx={58} cy={150} rx={7} ry={3.4} />
          <ellipse cx={68} cy={151} rx={5} ry={2.8} />
          <ellipse cx={178} cy={146} rx={6} ry={3} />
          <ellipse cx={20} cy={154} rx={5} ry={2.6} />
        </g>
        <path d="M0 166C42 150 98 164 140 162C178 160 212 152 240 156V190H0Z" fill="#A9C0A4" opacity={0.8} />
        <rect x="0" y="150" width="240" height="40" fill="url(#fl-mist)" />

        {/* champ et rangs en perspective */}
        <rect x="0" y="178" width="240" height="122" fill="url(#fl-ground)" />
        <g clipPath="url(#fl-field)">
          {ROWS.map((bx, i) => {
            const d = `M${ps([rowX(bx, 178) - 0.3, 178])}L${ps([rowX(bx, 178) + 0.3, 178])}L${ps([bx + 6, 300])}L${ps([bx - 6, 300])}Z`;
            return <path key={bx} d={d} fill={i % 2 ? '#7FA675' : '#5C8A56'} opacity={0.62} />;
          })}
          {ROWS.flatMap((bx, i) =>
            [186, 196, 209, 225, 246, 272].map((y0) => {
              const y = y0 + ((i * 7) % 5) * ((y0 - VP[1]) / 40);
              const k = (y - VP[1]) / (300 - VP[1]);
              return <ellipse key={`${bx}-${y}`} cx={r1(rowX(bx, y))} cy={y} rx={r1(1 + 7 * k)} ry={r1(0.6 + 3.2 * k)} fill="#4F7F4A" opacity={0.42} />;
            }),
          )}
        </g>
        <rect x="0" y="174" width="240" height="14" fill="url(#fl-mist)" />
      </g>

      {/* rameau du premier plan */}
      <g transform="translate(250 262) scale(1.55) translate(-246 -262)">
        <path d="M246 192C230 208 214 232 200 262" fill="none" stroke="#4A3220" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M246 192C230 208 214 232 200 262" fill="none" stroke="#8A6A48" strokeWidth={1.2} strokeLinecap="round" />
        <Leaf x={240} y={198} a={198} L={40} W={17} bend={-0.08} fill="c" />
        <Leaf x={236} y={204} a={112} L={44} W={18} bend={0.1} fill="a" />
        <Leaf x={225} y={219} a={168} L={46} W={19} bend={0.09} fill="a" />
        <Leaf x={216} y={234} a={220} L={36} W={15} bend={-0.1} fill="b" />
        <Leaf x={208} y={248} a={140} L={42} W={17} bend={-0.08} fill="c" />
        <Leaf x={201} y={260} a={238} L={28} W={12} bend={0.08} fill="b" />
      </g>
    </svg>
  );
}

export default FieldLandscape;
