import * as React from 'react';
import { FlyArt, type FlyPalette } from './FlyBase';

/* Femelle sauvage : teintes ambrées, abdomen plus volumineux terminé en pointe (ovipositeur). */

const PALETTE: FlyPalette = {
  light: '#D3A262',
  mid: '#B07A3A',
  dark: '#8A5A2B',
  band: '#5A3618',
  eyeHi: '#E0654F',
  eye: '#A8322C',
  eyeLo: '#661A16',
  legNear: '#9A6A34',
  legFar: '#C9A574',
};

export function WildFemaleFly(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="Mouche femelle sauvage avec ovipositeur, vue de profil" xmlns="http://www.w3.org/2000/svg" {...props}>
      <FlyArt idp="wff" c={PALETTE} female label="Femelle sauvage" />
    </svg>
  );
}

export default WildFemaleFly;
