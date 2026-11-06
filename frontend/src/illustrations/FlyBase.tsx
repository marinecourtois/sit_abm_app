/*
 * Shared drawing for the Drosophilid illustrations (internal module).
 * Side / three-quarter dorsal view, head facing left, viewBox 0 0 120 90.
 */

export interface FlyPalette {
  light: string;
  mid: string;
  dark: string;
  band: string;
  eyeHi: string;
  eye: string;
  eyeLo: string;
  legNear: string;
  legFar: string;
}

type P = [number, number];
const poly = (pts: P[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');

const LEGS_FAR: P[][] = [
  [[34, 47], [27, 54], [18, 59], [11.5, 65.5], [9, 66.4]],
  [[42, 50], [38, 60], [32, 70], [28.5, 77.5], [26.4, 78.6]],
  [[50, 49], [57, 58], [61.5, 70], [65, 79], [67.6, 79.6]],
];
const LEGS_NEAR: P[][] = [
  [[37, 49], [30.5, 58], [22.5, 66.5], [17.5, 74.5], [14.6, 75.4]],
  [[45, 51], [48.5, 62], [45, 72.5], [43.2, 80], [40.6, 80.8]],
  [[53, 50], [62.5, 60], [70.5, 70], [76, 78.6], [79, 79.2]],
];

function Leg({ pts, color, w }: { pts: P[]; color: string; w: number }) {
  const [a, b, c, d, e] = pts;
  return (
    <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <path d={poly([a, b])} strokeWidth={w * 1.45} />
      <path d={poly([b, c])} strokeWidth={w} />
      <path d={poly([c, d, e])} strokeWidth={w * 0.62} />
      <circle cx={b[0]} cy={b[1]} r={w * 0.62} fill={color} stroke="none" />
      <circle cx={c[0]} cy={c[1]} r={w * 0.45} fill={color} stroke="none" />
      {/* tarsal segments */}
      {[0.3, 0.55, 0.78].map((t) => (
        <circle key={t} cx={c[0] + (d[0] - c[0]) * t} cy={c[1] + (d[1] - c[1]) * t} r={w * 0.36} fill={color} stroke="none" />
      ))}
    </g>
  );
}

const ABD_MALE = 'M58 40C64 34.4 79 34 87 39C93.4 43 93 51.4 86.4 55.4C78 59.6 65 57.4 59 50.4Z';
const ABD_FEMALE = 'M58 40C64 33 82 32.4 92.6 38.6C99 42.4 100.4 47.4 107.4 50.8C100.4 54.8 92 59.4 80.4 59.6C68 59.8 61 55.6 58 50.4Z';

export function FlyArt({ idp, c, female, label }: { idp: string; c: FlyPalette; female?: boolean; label: string }) {
  const abd = female ? ABD_FEMALE : ABD_MALE;
  const bands = female ? [67, 74.6, 82, 89.4] : [66.4, 73.4, 80];
  const id = (s: string) => `${idp}-${s}`;
  const u = (s: string) => `url(#${idp}-${s})`;
  return (
    <>
      <title>{label}</title>
      <defs>
        <radialGradient id={id('body')} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.55" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </radialGradient>
        <linearGradient id={id('abd')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.6" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
        <radialGradient id={id('eye')} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor={c.eyeHi} />
          <stop offset="0.5" stopColor={c.eye} />
          <stop offset="1" stopColor={c.eyeLo} />
        </radialGradient>
        <linearGradient id={id('wing')} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="rgb(205,214,218)" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="rgb(200,210,215)" stopOpacity="0.35" />
          <stop offset="0.8" stopColor="rgb(214,206,226)" stopOpacity="0.3" />
          <stop offset="1" stopColor="rgb(200,216,212)" stopOpacity="0.28" />
        </linearGradient>
        <pattern id={id('facets')} width="1.5" height="1.3" patternUnits="userSpaceOnUse">
          <circle cx="0.75" cy="0.65" r="0.52" fill="none" stroke="#2A0808" strokeWidth="0.18" strokeOpacity="0.5" />
        </pattern>
        <clipPath id={id('abdclip')}>
          <path d={abd} />
        </clipPath>
      </defs>

      <ellipse cx={female ? 54 : 50} cy={81.5} rx={36} ry={2.2} fill="#2B2A22" opacity={0.07} />

      {/* far-side legs */}
      {LEGS_FAR.map((l, i) => (
        <Leg key={i} pts={l} color={c.legFar} w={1} />
      ))}

      {/* far wing (raised) */}
      <path d="M52 30C58 22 76 12.4 98 9.6C106.6 8.6 110.6 13.8 104.6 18.4C92 26 72 30.6 53 32.4Z" fill={u('wing')} stroke="#6D7C80" strokeWidth={0.5} strokeLinejoin="round" />
      <path
        d="M53 31Q74 18 100.6 11.4M53.4 31.4Q78 22 106.4 14.2M54 32Q80 25.6 103.4 18.4M55 32.2Q78 28.4 96 23.4M76 22.4L79.8 24.6M86 19.6L88.6 22.6"
        fill="none"
        stroke="#6D7C80"
        strokeWidth={0.32}
        strokeOpacity={0.85}
      />

      {/* abdomen */}
      <path d={abd} fill={u('abd')} stroke={c.band} strokeWidth={0.7} />
      <g clipPath={u('abdclip')}>
        {bands.map((x, i) => (
          <path key={x} d={`M${x} 30Q${x + 3.4} 46 ${x - 0.6} 62`} fill="none" stroke={c.band} strokeWidth={female ? 2.6 : 2.9} strokeOpacity={0.78 - i * 0.04} />
        ))}
        {!female && <path d="M84 30Q90 46 84 62L100 62L100 30Z" fill={c.band} opacity={0.82} />}
        <path d="M56 54Q74 62 100 52L100 64L56 64Z" fill={c.dark} opacity={0.35} />
        <path d="M60 41Q72 36 86 38.6" fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1.4} strokeLinecap="round" />
      </g>
      {female && <path d="M104 49.4L111.4 51.4L104.6 52.8Z" fill={c.band} stroke={c.band} strokeWidth={0.4} strokeLinejoin="round" />}
      <path d="M70 38.6l2 -2.2M77 38.4l2.2 -2M84 40l2.2 -1.6M74 55l1.6 1.8M82 54.6l1.6 1.8" stroke={c.band} strokeWidth={0.3} strokeLinecap="round" />

      {/* thorax */}
      <path d="M32 44C31 32 40 26 50 27C58 28 62.4 34 61.4 42C60.4 49 50.4 52.4 42 51.4C36 50.6 32.6 47.4 32 44Z" fill={u('body')} stroke={c.band} strokeWidth={0.7} />
      <path d="M38 33Q48 28.4 58 33M37 37.4Q48 32 60 37.6" fill="none" stroke={c.dark} strokeWidth={0.9} strokeOpacity={0.35} />
      <path d="M53.4 31.4C57.6 28 63.6 30 64 34.8C61 36.4 56.6 35.6 53.6 33.4Z" fill={u('body')} stroke={c.band} strokeWidth={0.5} />
      <path d="M41 30.4L45.4 24.6M46.6 28.4L51.6 23.2M51.8 28.6L57.4 24.4M56.4 31L62.6 28M63.6 33.4L72 29.6M63.2 34.8L71.6 33.4M34.4 37.6L31 32.6" fill="none" stroke="#2C2620" strokeWidth={0.45} strokeLinecap="round" />
      <ellipse cx={60.6} cy={44.6} rx={1.2} ry={1.6} fill={c.mid} stroke={c.band} strokeWidth={0.3} />

      {/* head */}
      <ellipse cx={24} cy={42} rx={9.6} ry={9.2} fill={u('body')} stroke={c.band} strokeWidth={0.7} />
      <path d="M17 50.4Q18.4 55.4 21.6 54.8Q22.6 52.6 21.4 50.6" fill={c.mid} stroke={c.band} strokeWidth={0.45} />
      <g transform="rotate(-10 23 40.6)">
        <ellipse cx={23} cy={40.6} rx={7} ry={7.8} fill={u('eye')} stroke="#4E1210" strokeWidth={0.55} />
        <ellipse cx={23} cy={40.6} rx={7} ry={7.8} fill={u('facets')} />
        <ellipse cx={20.6} cy={37.2} rx={2.2} ry={1.4} fill="#FFFFFF" opacity={0.32} />
      </g>
      <circle cx={27.4} cy={33.6} r={0.45} fill="#3A2A20" />
      <circle cx={28.8} cy={34.2} r={0.45} fill="#3A2A20" />
      <path d="M25 33.2L28.4 28.6M27.4 33.4L32 30M22 33.6L22.6 28.8" fill="none" stroke="#2C2620" strokeWidth={0.4} strokeLinecap="round" />
      {/* antenna + plumose arista */}
      <ellipse cx={15.2} cy={40.4} rx={2.2} ry={1.5} transform="rotate(-24 15.2 40.4)" fill={c.mid} stroke={c.band} strokeWidth={0.4} />
      <path d="M14 39.4Q10.6 36 6.4 33.8" fill="none" stroke="#3A322A" strokeWidth={0.35} />
      <path d="M12.6 38L13 35.6M11.2 36.8L11.4 34.4M9.6 35.6L9.6 33.4M12.2 38.2L10.8 39.4M10.6 37L9.2 38M9 35.8L7.6 36.6" fill="none" stroke="#3A322A" strokeWidth={0.22} />

      {/* near-side legs */}
      {LEGS_NEAR.map((l, i) => (
        <Leg key={i} pts={l} color={c.legNear} w={1.15} />
      ))}

      {/* near wing (folded back over the abdomen) */}
      <path d="M52 33C60 30.4 84 30.6 103.6 34C112 35.6 113.4 41.6 106 43.8C92 47.4 70 44.6 54 37.4Z" fill={u('wing')} stroke="#6D7C80" strokeWidth={0.55} strokeLinejoin="round" />
      <path d="M52.6 33.2Q78 30.6 104 34.2" fill="none" stroke="#5E6C70" strokeWidth={0.6} />
      <path
        d="M53.6 34Q80 33 108.6 37.6M54 35Q82 36.6 106.4 42.4M54.6 36Q80 40.4 97 44.8M55.4 36.8Q72 41.4 82 44.4M78 34.2L77.6 37.6M90 36.4L89 41.6"
        fill="none"
        stroke="#6D7C80"
        strokeWidth={0.36}
        strokeOpacity={0.9}
      />
      <path d="M58 33.4Q78 32 96 33.4" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.8} strokeLinecap="round" />
    </>
  );
}
