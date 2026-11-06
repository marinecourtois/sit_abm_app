import * as React from 'react';

/* « Pas de descendance » : œufs et larve barrés d'un trait terracotta. */

function Egg({ x, y, a, s = 1 }: { x: number; y: number; a: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
      {/* dorsal filaments, typical of Drosophilid eggs */}
      <path d="M-1 -5.6Q-2.6 -9 -4.4 -10.2M1 -5.6Q2.4 -9 4.2 -10.4" fill="none" stroke="#C9A66B" strokeWidth={0.6} strokeLinecap="round" />
      <ellipse rx={2.6} ry={6} fill="url(#no-egg)" stroke="#C9A66B" strokeWidth={0.7} />
      <ellipse cx={-0.9} cy={-1.8} rx={0.7} ry={2} fill="#FFFFFF" opacity={0.6} />
    </g>
  );
}

export function NoOffspring(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 80 80" role="img" aria-label="Pas de descendance" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <radialGradient id="no-egg" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FBF4E2" />
          <stop offset="0.7" stopColor="#F3E7C9" />
          <stop offset="1" stopColor="#E4D0A4" />
        </radialGradient>
      </defs>
      <Egg x={29} y={32} a={-28} />
      <Egg x={41} y={27} a={12} s={0.92} />
      <Egg x={51} y={38} a={52} s={0.95} />
      {/* larve segmentée */}
      <g transform="translate(36 52) rotate(-8)">
        <path d="M-10 0C-10 -3.2 -6 -3.8 0 -3.8C6 -3.8 10.6 -2.6 11 0C10.6 2.6 6 3.8 0 3.8C-6 3.8 -10 3.2 -10 0Z" fill="url(#no-egg)" stroke="#C9A66B" strokeWidth={0.7} />
        <path d="M-6 -3.4Q-5.4 0 -6 3.4M-2.4 -3.7Q-1.8 0 -2.4 3.7M1.2 -3.8Q1.8 0 1.2 3.8M4.8 -3.5Q5.4 0 4.8 3.5M8 -2.8Q8.4 0 8 2.8" fill="none" stroke="#C9A66B" strokeWidth={0.45} />
        <circle cx={-8.2} cy={-0.4} r={0.6} fill="#8A6A3A" />
      </g>
      <circle cx={40} cy={40} r={31} fill="none" stroke="#BF532E" strokeWidth={2.2} />
      <path d="M18.1 61.9L61.9 18.1" stroke="#BF532E" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

export default NoOffspring;
