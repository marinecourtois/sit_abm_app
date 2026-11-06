import * as React from 'react';

/* Monogramme botanique : une feuille unique, nervure médiane courbe. */

export function LeafMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Modelly TIS Research — emblème feuille" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="lm-leaf" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#3E9462" />
          <stop offset="0.45" stopColor="#2F7A4F" />
          <stop offset="1" stopColor="#145A3D" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 24 24)">
        <path d="M12 41C8.4 30 11 17.6 20.6 10.4C26 6.4 33 5 39.4 5.2C40.6 12.6 39.4 22 33.8 29.6C28.6 36.6 20 41.2 12 41Z" fill="url(#lm-leaf)" />
        <path d="M12 41C8.4 30 11 17.6 20.6 10.4C17.8 18 16.6 30 12 41Z" fill="#0F4A31" opacity={0.25} />
        <path d="M10.2 44.4Q11 42 12.6 40.4C20 31.6 28 18.6 38.6 6.2" fill="none" stroke="#A9D4B0" strokeWidth={1.05} strokeLinecap="round" />
        <path
          d="M17.4 33.4Q22.4 33.2 27.6 30.8M21.8 27Q27.4 25.8 32.6 22.4M26.4 20.6Q31.4 18.6 36.2 14.4M20.6 29.8Q18.6 25.4 18.8 20.4M25.4 23.2Q23.6 18.8 24.4 13.6"
          fill="none"
          stroke="#A9D4B0"
          strokeOpacity={0.7}
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export default LeafMark;
