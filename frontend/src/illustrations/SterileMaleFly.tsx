import * as React from 'react';
import { FlyArt, type FlyPalette } from './FlyBase';

/* Mâle stérile élevé en laboratoire : teintes grises désaturées, abdomen arrondi
 * à extrémité sombre, discret marquage poudreux (repère de lâcher) sur le thorax. */

const PALETTE: FlyPalette = {
  light: '#A9A9A2',
  mid: '#8C8C86',
  dark: '#6E6E68',
  band: '#4A4A45',
  eyeHi: '#C2665C',
  eye: '#9E3E36',
  eyeLo: '#5E2420',
  legNear: '#6E6E68',
  legFar: '#A4A49E',
};

export function SterileMaleFly(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="Mouche mâle stérile élevée en laboratoire, vue de profil" xmlns="http://www.w3.org/2000/svg" {...props}>
      <FlyArt idp="smf" c={PALETTE} label="Mâle stérile" />
      {/* marquage fluorescent de lâcher */}
      <g fill="#8FB8C2" opacity={0.85}>
        <circle cx={47.4} cy={35.6} r={0.9} />
        <circle cx={49.6} cy={37.2} r={0.55} />
        <circle cx={45.6} cy={37.6} r={0.45} />
      </g>
    </svg>
  );
}

export default SterileMaleFly;
