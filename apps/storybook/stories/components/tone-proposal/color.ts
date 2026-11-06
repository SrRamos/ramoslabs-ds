// Colour math for the tone proposal (story-only, not shipped): OKLCH <-> sRGB hex with chroma-reducing
// gamut fit, WCAG 2.x contrast (same rounding as packages/testing/contrast), APCA 0.0.98G-4g, and the
// Machado, Oliveira & Fernandes (2009) colour-vision-deficiency matrices at severity 1.0.
// Sources: bottosson.github.io/posts/oklab, w3.org/TR/WCAG22/#dfn-contrast-ratio,
// github.com/Myndex/apca-w3, doi.org/10.1109/TVCG.2009.113.

export type Rgb = [number, number, number];

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) =>
      Math.round(clamp01(v) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function linToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLin([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** [L 0..1, C, h degrees] of an sRGB hex. */
export function hexToOklch(hex: string): Rgb {
  const [L, a, b] = linToOklab(hexToRgb(hex).map(lin) as Rgb);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH to sRGB hex. Out-of-gamut colours keep L and h and lose chroma (binary search), never clip hue. */
export function oklch(L: number, C: number, h: number): string {
  const at = (c: number) =>
    oklabToLin([L, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]);
  let c = C;
  if (!inGamut(at(c))) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  return rgbToHex(at(c).map(gam) as Rgb);
}

/** CSS text for a hex, rounded the way the docs print it. */
export function fmtOklch(hex: string): string {
  const [L, C, h] = hexToOklch(hex);
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(0)})`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x ratio floored to 2 dp, like packages/testing/contrast `meets`. */
export function wcag(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

/** `fg` at `alpha` over opaque `bg`, sRGB mix (packages/testing/contrast compositeOver; CSS color-mix in srgb). */
export function over(fg: string, alpha: number, bg: string): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return rgbToHex(f.map((v, i) => Math.round((v * alpha + b[i]! * (1 - alpha)) * 255) / 255) as Rgb);
}

/** APCA Lc (0.0.98G-4g constants). Positive: dark text on light; negative: light text on dark. */
export function apca(text: string, bg: string): number {
  const Y = (hex: string) => {
    const [r, g, b] = hexToRgb(hex).map((v) => v ** 2.4) as Rgb;
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
  };
  const yt = Y(text);
  const yb = Y(bg);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : Math.round((s - 0.027) * 1000) / 10;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : Math.round((s + 0.027) * 1000) / 10;
}

export type Cvd = 'deuteranopia' | 'protanopia' | 'tritanopia';

/** Machado 2009, severity 1.0, row-major 3x3 in linear RGB. The SVG filters reuse these rows. */
export const CVD_MATRIX: Record<Cvd, number[]> = {
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

export function simulate(hex: string, kind: Cvd): string {
  const m = CVD_MATRIX[kind];
  const [r, g, b] = hexToRgb(hex).map(lin) as Rgb;
  const out: Rgb = [
    m[0]! * r + m[1]! * g + m[2]! * b,
    m[3]! * r + m[4]! * g + m[5]! * b,
    m[6]! * r + m[7]! * g + m[8]! * b,
  ];
  return rgbToHex(out.map((v) => gam(clamp01(v))) as Rgb);
}

/** OKLab Euclidean distance x100 (deltaE OK). About 2 is a just-noticeable difference for flat swatches. */
export function deltaE(a: string, b: string): number {
  const p = linToOklab(hexToRgb(a).map(lin) as Rgb);
  const q = linToOklab(hexToRgb(b).map(lin) as Rgb);
  return Math.round(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 1000) / 10;
}

/** feColorMatrix `values` (4x5) for one deficiency; SVG filters run in linearRGB by default, like Machado. */
export function cvdFilterValues(kind: Cvd): string {
  const m = CVD_MATRIX[kind];
  return [0, 1, 2]
    .map((r) => `${m[r * 3]} ${m[r * 3 + 1]} ${m[r * 3 + 2]} 0 0`)
    .concat('0 0 0 1 0')
    .join(' ');
}
